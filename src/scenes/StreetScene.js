import Phaser from 'phaser';
import { Player } from '../entities/Player.js';
import { MobileJoystick } from '../input/MobileJoystick.js';
import { PlayerController } from '../input/PlayerController.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { TeleportSystem } from '../systems/TeleportSystem.js';

const WORLD_WIDTH = 1360;
const WORLD_HEIGHT = 720;

const STREET_ENTRANCES = [
  { key: 'groceryEntrance', x: 312, y: 334, width: 76, height: 48, targetScene: 'GameplayScene' },
  { key: 'stationeryEntrance', x: 598, y: 334, width: 76, height: 48, targetScene: 'StationeryStoreScene' },
  { key: 'hypermarketEntrance', x: 973, y: 334, width: 142, height: 48, targetScene: 'HypermarketScene' },
];

export class StreetScene extends Phaser.Scene {
  constructor() {
    super('StreetScene');
  }

  create(data = {}) {
    this.cameras.main.setBackgroundColor('#d8c69f');
    this.physics.world.setBounds(45, 145, WORLD_WIDTH - 90, WORLD_HEIGHT - 185);
    this.add.tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 'street-sand-tile').setDepth(-10);
    this.obstacles = this.physics.add.staticGroup();

    this.drawStreet();
    this.createPlayer(data);
    this.createTeleports();

    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.fadeIn(160, 20, 28, 24);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.joystick?.destroy();
    });
  }

  drawStreet() {
    const roadShadow = this.add.graphics().setDepth(-2);
    roadShadow.fillStyle(0x8f7f61, 0.16);
    roadShadow.fillRect(90, 336, 1180, 176);
    const roadBase = this.add.graphics().setDepth(-1);
    roadBase.fillStyle(0xe9ddc8, 1);
    roadBase.fillRect(90, 324, 1180, 174);
    roadBase.lineStyle(8, 0xf3e8d4, 1);
    roadBase.strokeRect(94, 328, 1172, 166);
    roadBase.lineStyle(3, 0xa79d86, 0.35);
    roadBase.strokeRect(98, 332, 1164, 158);

    this.add.tileSprite(680, 410, 1120, 138, 'street-pavement-tile').setTint(0xf3ead9).setDepth(-0.5);
    this.add.image(680, 410, 'street-pavement-straight').setDisplaySize(1180, 178).setTint(0xf1eadc).setDepth(0);

    this.add.image(312, 187, 'street-shop-grocery').setDisplaySize(244, 262).setDepth(160);
    this.add.image(598, 187, 'street-shop-stationery').setDisplaySize(235, 267).setDepth(160);
    this.add.image(973, 181, 'street-shop-hypermarket').setDisplaySize(494, 272).setDepth(160);

    this.add.image(170, 616, 'street-planter-fern-1').setDisplaySize(222, 169).setDepth(650);
    this.add.image(420, 615, 'street-planter-fern-2').setDisplaySize(232, 175).setDepth(650);
    this.add.image(680, 617, 'street-planter-fern-3').setDisplaySize(230, 175).setDepth(650);
    this.add.image(935, 610, 'street-planter-fern-4').setDisplaySize(214, 202).setDepth(650);
    this.add.image(1187, 612, 'street-planter-fern-5').setDisplaySize(220, 198).setDepth(650);

    this.addDecorations();
    this.addColliders();
  }

  addDecorations() {
    [
      [190, 430], [435, 430], [680, 430], [925, 430], [1170, 430],
    ].forEach(([x, y]) => this.add.image(x, y, 'street-decor-tile').setDisplaySize(44, 44).setDepth(2));

    this.add.image(198, 262, 'street-fern-bush').setDisplaySize(88, 82).setDepth(155);
    this.add.image(456, 262, 'street-bush-clump').setDisplaySize(82, 74).setDepth(155);
    this.add.image(746, 264, 'street-fern-bush').setDisplaySize(88, 82).setDepth(155);
    this.add.image(1222, 262, 'street-bush-clump').setDisplaySize(88, 80).setDepth(155);
    this.add.image(143, 289, 'street-flower-bush').setDisplaySize(58, 52).setDepth(155);
    this.add.image(1200, 296, 'street-flower-planter').setDisplaySize(58, 48).setDepth(320);
  }

  addSmallObject(x, y, key, width, height, depth) {
    this.add.image(x, y, key).setDisplaySize(width, height).setDepth(depth);
  }

  addColliders() {
    this.addCollider(312, 196, 226, 206);
    this.addCollider(598, 196, 218, 206);
    this.addCollider(973, 188, 468, 210);

    this.addCollider(170, 662, 210, 86);
    this.addCollider(420, 662, 222, 88);
    this.addCollider(680, 664, 220, 88);
    this.addCollider(935, 664, 202, 90);
    this.addCollider(1187, 665, 210, 90);

    this.addCollider(28, 405, 36, 360);
    this.addCollider(1332, 405, 36, 360);
    this.addCollider(680, 126, 1270, 36);
    this.addCollider(680, 704, 1270, 36);
  }

  addCollider(x, y, width, height) {
    const blocker = this.add.rectangle(x, y, width, height, 0x000000, 0);
    this.obstacles.add(blocker);
    blocker.body.setSize(width, height);
    blocker.body.updateFromGameObject();
    return blocker;
  }

  createPlayer(data) {
    this.balance = this.registry.get('balance');
    this.saveManager = this.registry.get('saveManager');
    this.state = this.saveManager.load();
    this.economy = new EconomySystem(this.state, this.balance);
    const start = data.from === 'HypermarketScene' ? { x: 973, y: 392 } : { x: 680, y: 505 };

    this.player = new Player(this, start.x, start.y, this.economy.stats);
    this.physics.add.collider(this.player.sprite, this.obstacles);
    this.joystick = new MobileJoystick(this);
    this.controller = new PlayerController(this, this.joystick);
  }

  createTeleports() {
    this.teleports = new TeleportSystem(this, this.player.sprite, STREET_ENTRANCES);
  }

  update() {
    if (!this.player?.sprite.body?.enable) return;
    this.player.update(this.controller);
  }
}

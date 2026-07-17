import Phaser from 'phaser';
import { Player } from '../entities/Player.js';
import { MobileJoystick } from '../input/MobileJoystick.js';
import { PlayerController } from '../input/PlayerController.js';
import { AdService } from '../yandex/AdService.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { ShelfSystem } from '../systems/ShelfSystem.js';
import { CheckoutSystem } from '../systems/CheckoutSystem.js';
import { CustomerSystem } from '../systems/CustomerSystem.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { ZoneSystem } from '../systems/ZoneSystem.js';
import { RestockSystem } from '../systems/RestockSystem.js';
import { BoostSystem } from '../systems/BoostSystem.js';
import { TeleportSystem } from '../systems/TeleportSystem.js';
import { DailyRewardSystem } from '../systems/DailyRewardSystem.js';
import { OfflineProgressSystem } from '../systems/OfflineProgressSystem.js';
import { PrestigeSystem } from '../systems/PrestigeSystem.js';
import { DayCycleSystem } from '../systems/DayCycleSystem.js';
import { EventBus, Events } from '../core/EventBus.js';
import { ENTRANCE_POINT, SIDE_AISLE_X } from '../core/WorldPoints.js';

export class GameplayScene extends Phaser.Scene {
  constructor() {
    super('GameplayScene');
  }

  create() {
    this.balance = this.registry.get('balance');
    this.saveManager = this.registry.get('saveManager');
    this.state = this.saveManager.load();
    this.physics.world.setBounds(60, 120, 1120, 860);
    this.drawWorld();

    this.economy = new EconomySystem(this.state, this.balance);
    this.adService = new AdService(this.registry.get('yandex'), this.balance, this.economy, this.state);
    this.shelves = new ShelfSystem(this, this.state, this.balance);
    this.checkout = new CheckoutSystem(this, this.state, this.economy);
    this.player = new Player(this, 700, 780, this.economy.stats);
    this.physics.add.collider(this.player.sprite, this.shelves.obstacles);
    this.physics.add.collider(this.player.sprite, this.checkout.obstacles);
    this.physics.add.collider(this.player.sprite, this.environmentObstacles);
    this.teleports = new TeleportSystem(this, this.player.sprite, [
      { ...ENTRANCE_POINT, width: 220, height: 58, targetScene: 'StreetScene', stopScenes: ['UIScene'] },
    ]);
    this.joystick = new MobileJoystick(this);
    this.controller = new PlayerController(this, this.joystick);

    this.boosts = new BoostSystem(this.state, this.economy);
    this.systems = {
      shelves: this.shelves,
      checkout: this.checkout,
      economy: this.economy,
      boosts: this.boosts,
      environmentObstacles: this.environmentObstacles,
    };
    this.customers = new CustomerSystem(this, this.balance, this.systems);
    this.systems.customers = this.customers;
    this.upgrades = new UpgradeSystem(this.state, this.balance, this.economy);
    this.zones = new ZoneSystem(this, this.state, this.balance, this.economy, this.shelves);
    this.drawCustomerRoads();
    this.restock = new RestockSystem(this.state, this.balance, this.economy, this.shelves, this.zones);
    this.daily = new DailyRewardSystem(this.state, this.balance, this.saveManager, this.economy);
    this.offline = new OfflineProgressSystem(this.state, this.balance, this.economy);
    this.prestige = new PrestigeSystem(this.state, this.balance, this.saveManager);
    this.dayCycle = new DayCycleSystem(this.state, this.balance, this.adService);

    const earnedOffline = this.offline.apply();
    if (earnedOffline > 0) EventBus.emit(Events.UI_TOAST, `Пока вас не было: +$${earnedOffline}`);

    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(40, 80, 1160, 940);
    this.scene.launch('UIScene', { state: this.state, balance: this.balance, shelves: this.shelves.shelves, boosts: this.boosts });

    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.saveManager.save(this.state) });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.saveManager.save(this.state);
      this.joystick?.destroy();
      this.customers?.destroy();
      this.restock?.destroy();
      this.zones?.destroy();
      this.shelves?.destroy();
      this.boosts?.destroy();
      this.adService?.destroy();
    });
    window.addEventListener('beforeunload', () => this.saveManager.save(this.state), { once: true });
  }

  drawWorld() {
    this.add.rectangle(650, 560, 1120, 940, 0xcbd8bf).setDepth(-5);
    this.add.grid(650, 560, 1120, 940, 40, 40, 0xffffff, 0.16, 0xb8c7ad, 0.32).setDepth(-4);
    this.environmentObstacles = this.physics.add.staticGroup();

    const entranceX = ENTRANCE_POINT.x;
    const entranceY = ENTRANCE_POINT.y;
    this.add.image(entranceX, entranceY, 'entrance').setDisplaySize(260, 62).setDepth(2);
    this.addEntranceBlocker(entranceX - 76, entranceY, 14, 46);
    this.addEntranceBlocker(entranceX + 77, entranceY, 14, 46);
    this.addEntranceBlocker(entranceX - 108, entranceY + 14, 30, 18);
    this.addEntranceBlocker(entranceX + 108, entranceY + 14, 30, 18);
  }

  addEntranceBlocker(x, y, width, height) {
    const blocker = this.add.rectangle(x, y, width, height, 0x000000, 0);
    this.environmentObstacles.add(blocker);
    blocker.body.setSize(width, height);
    blocker.body.updateFromGameObject();
    return blocker;
  }

  drawCustomerRoads() {
    const roadColor = 0xd9deca;
    const edgeColor = 0xb9c2aa;
    const markColor = 0xf5f1d8;
    const roadDepth = 1;
    const markDepth = 1.1;
    const roadSize = 28;
    const edgeSize = roadSize + 8;
    const horizontalRoads = [362, 502, 642];
    const horizontalStartX = SIDE_AISLE_X;
    const horizontalEndX = 1070;
    const verticalRoads = [
      { x: SIDE_AISLE_X, y1: 362, y2: ENTRANCE_POINT.y },
      { x: 700, y1: 220, y2: 642 },
    ];
    const roadGraphics = this.add.graphics().setDepth(roadDepth);
    const markGraphics = this.add.graphics().setDepth(markDepth);
    const roadSegments = [
      ...horizontalRoads.map((y) => ({ x1: horizontalStartX, y1: y, x2: horizontalEndX, y2: y })),
      ...verticalRoads.map((road) => ({ x1: road.x, y1: road.y1, x2: road.x, y2: road.y2 })),
      { x1: SIDE_AISLE_X, y1: ENTRANCE_POINT.y, x2: ENTRANCE_POINT.x, y2: ENTRANCE_POINT.y },
    ];
    const joints = [
      ...horizontalRoads.map((y) => ({ x: SIDE_AISLE_X, y })),
      ...horizontalRoads.map((y) => ({ x: 700, y })),
      ...horizontalRoads.map((y) => ({ x: horizontalEndX, y })),
      { x: 700, y: 220 },
      { x: SIDE_AISLE_X, y: ENTRANCE_POINT.y },
      ENTRANCE_POINT,
    ];

    const drawNetwork = (width, color, alpha) => {
      roadGraphics.lineStyle(width, color, alpha);
      roadSegments.forEach((segment) => {
        roadGraphics.beginPath();
        roadGraphics.moveTo(segment.x1, segment.y1);
        roadGraphics.lineTo(segment.x2, segment.y2);
        roadGraphics.strokePath();
      });
      roadGraphics.fillStyle(color, alpha);
      joints.forEach((point) => roadGraphics.fillCircle(point.x, point.y, width / 2));
    };

    const drawDashedHorizontal = (y, x1, x2, blockedX = []) => {
      markGraphics.fillStyle(markColor, 0.78);
      for (let x = x1 + 34; x < x2 - 8; x += 44) {
        if (blockedX.some((blocked) => Math.abs(x - blocked) < 28)) continue;
        markGraphics.fillRoundedRect(x - 9, y - 1.5, 18, 3, 1.5);
      }
    };

    const drawDashedVertical = (x, y1, y2, blockedY = []) => {
      markGraphics.fillStyle(markColor, 0.78);
      for (let y = y1 + 34; y < y2 - 8; y += 44) {
        if (blockedY.some((blocked) => Math.abs(y - blocked) < 28)) continue;
        markGraphics.fillRoundedRect(x - 1.5, y - 9, 3, 18, 1.5);
      }
    };

    drawNetwork(edgeSize, edgeColor, 0.86);
    drawNetwork(roadSize, roadColor, 0.86);
    horizontalRoads.forEach((y) => drawDashedHorizontal(y, horizontalStartX, horizontalEndX, [305, 700]));
    verticalRoads.forEach((road) => drawDashedVertical(road.x, road.y1, road.y2, horizontalRoads));
  }

  update(_time, delta) {
    this.player.update(this.controller);
    this.customers.update(delta);
    this.checkout.update(delta);
    this.dayCycle.update(delta);
  }
}

import { EventBus, Events } from '../core/EventBus.js';

export class TeleportSystem {
  constructor(scene, playerSprite, zones) {
    this.scene = scene;
    this.playerSprite = playerSprite;
    this.locked = false;

    zones.forEach((zoneConfig) => this.createZone(zoneConfig));
  }

  createZone({ key, x, y, width, height, targetScene, stopScenes = [] }) {
    const zone = this.scene.add.zone(x, y, width, height);
    this.scene.physics.add.existing(zone, true);
    zone.setName(key ?? targetScene);
    zone.setData('targetScene', targetScene);
    zone.setData('stopScenes', stopScenes);
    this.scene.physics.add.overlap(this.playerSprite, zone, () => this.teleport(zone));
  }

  teleport(zone) {
    if (this.locked) return;
    this.locked = true;

    const targetScene = zone.getData('targetScene');
    const stopScenes = zone.getData('stopScenes') ?? [];
    const from = this.scene.scene.key;
    this.playerSprite.body?.setVelocity(0, 0);
    if (this.playerSprite.body) this.playerSprite.body.enable = false;
    EventBus.emit(Events.PLAYER_TELEPORTED, { from, targetScene, key: zone.name });

    this.scene.cameras.main.once('camerafadeoutcomplete', () => {
      stopScenes.forEach((sceneKey) => this.scene.scene.stop(sceneKey));
      this.scene.scene.start(targetScene, { from });
    });
    this.scene.cameras.main.fadeOut(180, 20, 28, 24);
  }
}

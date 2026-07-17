import Phaser from 'phaser';
import { BalanceManager } from '../managers/BalanceManager.js';
import { SaveManager } from '../managers/SaveManager.js';
import { YandexSDK } from '../yandex/YandexSDK.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.add.text(640, 360, 'Supermarket Empire', { fontSize: '34px', color: '#f7d05b' }).setOrigin(0.5);
    this.boot();
  }

  async boot() {
    const balance = new BalanceManager();
    const saveManager = new SaveManager(balance);
    const yandex = await new YandexSDK().init();
    this.registry.set('balance', balance);
    this.registry.set('saveManager', saveManager);
    this.registry.set('yandex', yandex);
    this.scene.start('PreloadScene');
  }
}

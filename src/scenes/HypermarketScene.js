import Phaser from 'phaser';

export class HypermarketScene extends Phaser.Scene {
  constructor() {
    super('HypermarketScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#6f7578');
  }
}

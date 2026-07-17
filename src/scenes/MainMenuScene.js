import Phaser from 'phaser';
import { Button } from '../ui/Button.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#22372e');
    this.add.rectangle(640, 360, 760, 470, 0xe6ead7).setStrokeStyle(4, 0xf7d05b);
    this.add.text(640, 210, 'Supermarket Empire', { fontSize: '54px', color: '#193026' }).setOrigin(0.5);
    this.add.text(640, 290, 'Пополни полки, обслужи очередь и вырасти до гипермаркета', {
      fontSize: '22px',
      color: '#31443a',
      align: 'center',
    }).setOrigin(0.5);
    new Button(this, 640, 400, 230, 58, 'Играть', () => this.startGame());
    this.add.text(640, 500, 'WASD или мобильный джойстик', { fontSize: '18px', color: '#31443a' }).setOrigin(0.5);
  }

  startGame() {
    this.registry.get('yandex').gameplayStart();
    this.scene.start('GameplayScene');
  }
}

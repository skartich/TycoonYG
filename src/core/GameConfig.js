import Phaser from 'phaser';

export const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#d8c69f',
  width: 1280,
  height: 720,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

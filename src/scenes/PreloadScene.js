import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.load.image('self-checkout', '/assets/self-checkout.png');
    this.load.image('customer-front', '/assets/customer-front.png');
    this.load.image('customer-back', '/assets/customer-back.png');
    this.load.image('player-front', '/assets/player-front.png');
    this.load.image('player-back', '/assets/player-back.png');
    this.load.spritesheet('player-idle', '/assets/player-idle.png', { frameWidth: 232, frameHeight: 276 });
    this.load.spritesheet('player-walk', '/assets/player-walk.png', { frameWidth: 232, frameHeight: 276 });
    this.load.image('top-panel', '/assets/top-panel.png');
    this.load.image('entrance', '/assets/entrance.png');
    [
      'air-conditioner',
      'bollard-low',
      'bollard-tall',
      'bush-clump',
      'curb-corner',
      'curb-straight',
      'deadend-left',
      'deadend-right',
      'decor-tile',
      'drain-tile',
      'fern-bush',
      'flower-bush',
      'flower-planter',
      'pavement-straight',
      'pavement-tile',
      'plant-pot',
      'planter-fern-1',
      'planter-fern-2',
      'planter-fern-3',
      'planter-fern-4',
      'planter-fern-5',
      'roof-vent-large',
      'roof-vent-small',
      'sand-tile',
      'shop-grocery',
      'shop-hypermarket',
      'shop-stationery',
      'street-lamp',
    ].forEach((asset) => this.load.image(`street-${asset}`, `/assets/street/${asset}.png`));
    ['groceries', 'dairy', 'snacks', 'drinks', 'bakery', 'frozen'].forEach((product) => {
      this.load.image(`shelf-${product}`, `/assets/shelf-${product}.png`);
      this.load.image(`progress-${product}`, `/assets/progress-${product}.png`);
    });
    this.load.image('stationery-checkout', '/assets/stationery/stationery-checkout.png');
    this.load.image('stationery-entrance', '/assets/stationery/stationery-entrance.png');
    [
      'notebooks',
      'writing',
      'markers',
      'paper',
      'folders',
      'school',
      'art',
      'desk',
      'envelopes',
    ].forEach((product) => {
      this.load.image(`progress-${product}`, '/assets/progress-groceries.png');
    });
    [
      'notebooks-a',
      'notebooks-b',
      'writing-a',
      'writing-b',
      'markers-a',
      'markers-b',
      'paper-a',
      'paper-b',
      'folders-a',
      'folders-b',
      'school-a',
      'school-b',
      'art-a',
      'art-b',
      'desk-a',
      'desk-b',
      'envelopes-a',
      'envelopes-b',
    ].forEach((asset) => {
      this.load.image(`stationery-${asset}`, `/assets/stationery/stationery-${asset}.png`);
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#16211c');
    this.add.text(640, 300, 'Загрузка магазина...', { fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
    this.add.rectangle(640, 365, 360, 18, 0xf7d05b);
    this.registry.get('yandex').loadingReady();
    const requestedScene = import.meta.env.DEV
      ? new URLSearchParams(window.location.search).get('scene')
      : null;
    this.time.delayedCall(450, () => this.scene.start(requestedScene ?? 'MainMenuScene'));
  }
}

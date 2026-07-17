import Phaser from 'phaser';
import { gameConfig } from './core/GameConfig.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameplayScene } from './scenes/GameplayScene.js';
import { StreetScene } from './scenes/StreetScene.js';
import { StationeryStoreScene } from './scenes/StationeryStoreScene.js';
import { HypermarketScene } from './scenes/HypermarketScene.js';
import { UIScene } from './scenes/UIScene.js';
import './style.css';

const game = new Phaser.Game({
  ...gameConfig,
  scene: [BootScene, PreloadScene, MainMenuScene, GameplayScene, StreetScene, StationeryStoreScene, HypermarketScene, UIScene],
});

if (import.meta.env.DEV) {
  window.__game = game;
}

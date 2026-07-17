import Phaser from 'phaser';
import { clamp } from '../utils/math.js';

export class MobileJoystick {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = {
      mode: 'auto',
      x: 88,
      bottom: 88,
      maxViewportWidth: 1180,
      onModeChange: null,
      ...options,
    };
    this.vector = { x: 0, y: 0 };
    this.activePointer = null;
    this.origin = new Phaser.Math.Vector2(this.options.x, scene.scale.height - this.options.bottom);
    this.enabled = false;
    this.base = null;
    this.thumb = null;

    scene.scale.on('resize', this.onResize, this);
    this.syncMode();
  }

  shouldEnable() {
    const selectedScheme = this.scene.registry.get('controlScheme') ?? this.options.mode;
    if (selectedScheme === 'keyboard') return false;
    if (selectedScheme === 'touch') return true;

    const touchAvailable = Boolean(
      this.scene.sys.game.device.input.touch
      || globalThis.navigator?.maxTouchPoints > 0,
    );
    const viewportWidth = globalThis.innerWidth ?? this.scene.scale.parentSize?.width ?? this.scene.scale.width;
    const viewportHeight = globalThis.innerHeight ?? this.scene.scale.parentSize?.height ?? this.scene.scale.height;
    const compactViewport = Math.min(viewportWidth, viewportHeight) <= 900
      && Math.max(viewportWidth, viewportHeight) <= this.options.maxViewportWidth;
    return touchAvailable && compactViewport;
  }

  syncMode() {
    const nextEnabled = this.shouldEnable();
    if (nextEnabled === this.enabled) {
      if (this.enabled) this.resetThumb();
      return;
    }

    this.enabled = nextEnabled;
    if (this.enabled) {
      this.createVisuals();
      this.bindPointerEvents();
    } else {
      this.unbindPointerEvents();
      this.destroyVisuals();
    }
    this.options.onModeChange?.(this.enabled);
  }

  createVisuals() {
    this.base = this.scene.add.circle(this.origin.x, this.origin.y, 54, 0x111c18, 0.48)
      .setScrollFactor(0)
      .setDepth(2000);
    this.thumb = this.scene.add.circle(this.origin.x, this.origin.y, 22, 0xf7d05b, 0.9)
      .setScrollFactor(0)
      .setDepth(2001);
  }

  destroyVisuals() {
    this.base?.destroy();
    this.thumb?.destroy();
    this.base = null;
    this.thumb = null;
    this.activePointer = null;
    this.vector.x = 0;
    this.vector.y = 0;
  }

  bindPointerEvents() {
    this.scene.input.on('pointerdown', this.onDown, this);
    this.scene.input.on('pointermove', this.onMove, this);
    this.scene.input.on('pointerup', this.onUp, this);
  }

  unbindPointerEvents() {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
  }

  onResize() {
    this.origin.set(this.options.x, this.scene.scale.height - this.options.bottom);
    this.syncMode();
    if (this.enabled) this.resetThumb();
  }

  onDown(pointer) {
    if (!this.enabled || pointer.x > this.scene.scale.width * 0.45 || this.activePointer !== null) return;
    this.activePointer = pointer.id;
    this.updateThumb(pointer);
  }

  onMove(pointer) {
    if (!this.enabled || pointer.id !== this.activePointer) return;
    this.updateThumb(pointer);
  }

  onUp(pointer) {
    if (pointer.id !== this.activePointer) return;
    this.activePointer = null;
    this.vector.x = 0;
    this.vector.y = 0;
    this.resetThumb();
  }

  updateThumb(pointer) {
    const dx = pointer.x - this.origin.x;
    const dy = pointer.y - this.origin.y;
    const length = Math.hypot(dx, dy) || 1;
    const radius = clamp(length, 0, 50);
    this.vector.x = dx / length;
    this.vector.y = dy / length;
    this.thumb?.setPosition(this.origin.x + this.vector.x * radius, this.origin.y + this.vector.y * radius);
  }

  resetThumb() {
    this.base?.setPosition(this.origin.x, this.origin.y);
    this.thumb?.setPosition(this.origin.x, this.origin.y);
  }

  getVector() {
    return this.enabled ? this.vector : { x: 0, y: 0 };
  }

  destroy() {
    this.scene.scale.off('resize', this.onResize, this);
    this.unbindPointerEvents();
    this.destroyVisuals();
  }
}

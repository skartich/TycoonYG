const PLAYER_DEPTH_OFFSET = 22;
const PLAYER_DISPLAY_WIDTH = 64;
const PLAYER_DISPLAY_HEIGHT = 76;
const PLAYER_ANIMATIONS = {
  down: { start: 0, end: 3, frameRate: 7 },
  up: { start: 4, end: 7, frameRate: 7 },
  left: { start: 8, end: 11, frameRate: 4 },
  right: { start: 12, end: 15, frameRate: 4 },
};
const PLAYER_IDLE_FRAMES = {
  down: 0,
  up: 1,
  left: 2,
  right: 3,
};

export class Player {
  constructor(scene, x, y, stats) {
    this.scene = scene;
    this.stats = stats;
    this.carrying = 0;
    this.facing = 'down';
    this.sprite = scene.add.container(x, y).setDepth(50);
    this.createAnimations();
    this.shadow = scene.add.ellipse(0, 19, 34, 12, 0x000000, 0.14);
    this.owner = scene.add.sprite(0, -17, 'player-idle', PLAYER_IDLE_FRAMES.down)
      .setDisplaySize(PLAYER_DISPLAY_WIDTH, PLAYER_DISPLAY_HEIGHT);
    this.crate = scene.add.rectangle(20, 9, 18, 12, 0xf2c35d).setStrokeStyle(2, 0xb77b43).setVisible(false);
    this.sprite.add([
      this.shadow,
      this.owner,
      this.crate,
    ]);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setSize(28, 24).setOffset(-14, -3).setCollideWorldBounds(true);
  }

  update(controller) {
    const vector = controller.getVector();
    this.updateAnimation(vector);
    this.sprite.body.setVelocity(vector.x * this.stats.playerSpeed, vector.y * this.stats.playerSpeed);
    this.crate.setVisible(this.carrying > 0);
    this.sprite.setDepth(this.sprite.y + PLAYER_DEPTH_OFFSET);
  }

  createAnimations() {
    Object.entries(PLAYER_ANIMATIONS).forEach(([direction, config]) => {
      const key = `player-walk-${direction}`;
      if (this.scene.anims.exists(key)) return;
      this.scene.anims.create({
        key,
        frames: this.scene.anims.generateFrameNumbers('player-walk', { start: config.start, end: config.end }),
        frameRate: config.frameRate,
        repeat: -1,
      });
    });
  }

  updateAnimation(vector) {
    const moving = Math.abs(vector.x) > 0.05 || Math.abs(vector.y) > 0.05;
    if (!moving) {
      this.owner.stop();
      this.owner.setTexture('player-idle', PLAYER_IDLE_FRAMES[this.facing]);
      return;
    }

    const nextFacing = Math.abs(vector.x) > Math.abs(vector.y)
      ? (vector.x < 0 ? 'left' : 'right')
      : (vector.y < 0 ? 'up' : 'down');
    this.facing = nextFacing;
    this.owner.play(`player-walk-${nextFacing}`, true);
  }

  addProducts(amount) {
    const accepted = Math.min(amount, this.stats.carryCapacity - this.carrying);
    this.carrying += accepted;
    return accepted;
  }

  removeProducts(amount) {
    const removed = Math.min(amount, this.carrying);
    this.carrying -= removed;
    return removed;
  }
}

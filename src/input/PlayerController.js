export class PlayerController {
  constructor(scene, joystick) {
    this.keys = scene.input.keyboard.addKeys('W,A,S,D');
    this.joystick = joystick;
  }

  getVector() {
    const keyboardX = (this.keys.D.isDown ? 1 : 0) - (this.keys.A.isDown ? 1 : 0);
    const keyboardY = (this.keys.S.isDown ? 1 : 0) - (this.keys.W.isDown ? 1 : 0);
    const joy = this.joystick.getVector();
    const x = keyboardX || joy.x;
    const y = keyboardY || joy.y;
    const length = Math.hypot(x, y);
    return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
  }
}

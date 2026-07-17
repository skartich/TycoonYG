export class Button {
  constructor(scene, x, y, width, height, text, onClick, options = {}) {
    this.scene = scene;
    this.colors = {
      base: options.baseColor ?? 0xf7d05b,
      hover: options.hoverColor ?? 0xffdd73,
      selected: options.selectedColor ?? 0x8bd5ee,
    };
    this.selected = false;
    this.container = scene.add.container(x, y).setDepth(3000).setScrollFactor(0);
    this.bg = scene.add.rectangle(0, 0, width, height, this.colors.base, 1).setStrokeStyle(2, 0x2a332d);
    this.label = scene.add.text(0, 0, text, {
      fontSize: height <= 38 || width <= 125 ? '12px' : '15px',
      color: '#18251f',
      align: 'center',
      lineSpacing: -2,
      wordWrap: { width: width - 14 },
    }).setOrigin(0.5);
    this.container.add([this.bg, this.label]);
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => this.bg.setFillStyle(this.colors.hover));
    this.bg.on('pointerout', () => this.refreshColor());
    this.bg.on('pointerdown', () => {
      this.bg.setScale(0.97);
      onClick();
    });
    this.bg.on('pointerup', () => this.bg.setScale(1));
  }

  setText(text) {
    this.label.setText(text);
  }

  setSelected(selected) {
    this.selected = selected;
    this.refreshColor();
  }

  setEnabled(enabled) {
    if (enabled) this.bg.setInteractive({ useHandCursor: true });
    else this.bg.disableInteractive();
  }

  refreshColor() {
    this.bg.setFillStyle(this.selected ? this.colors.selected : this.colors.base);
  }

  destroy() {
    this.container.destroy(true);
  }
}

import { EventBus, Events } from '../core/EventBus.js';

export class ZoneSystem {
  constructor(scene, state, balance, economy, shelves, options = {}) {
    this.scene = scene;
    this.state = state;
    this.balance = balance;
    this.economy = economy;
    this.shelves = shelves;
    this.zonesPath = options.zonesPath ?? 'zones';
    this.rects = options.rects ?? null;
    this.showLabels = options.showLabels ?? true;
    this.zoneDepth = options.zoneDepth ?? 0;
    this.visualStyle = {
      unlockedColor: 0xe6ead7,
      unlockedAlpha: 0.54,
      unlockedStroke: 0xbfc8ac,
      lockedColor: 0x46504a,
      lockedAlpha: 0.36,
      lockedStroke: 0x7a8179,
      strokeWidth: 3,
      ...(options.visualStyle ?? {}),
    };
    this.zoneVisuals = new Map();
    this.createZones();
    this.onUnlockZone = (id) => {
      const zone = this.balance.get(this.zonesPath).find((item) => item.id === id);
      if (zone) this.unlock(zone);
    };
    EventBus.on(Events.UI_UNLOCK_ZONE, this.onUnlockZone);
  }

  createZones() {
    this.balance.get(this.zonesPath).forEach((zone) => {
      const unlocked = this.state.unlockedZones.includes(zone.id);
      const { x, y, w, h } = this.rects?.[zone.id] ?? zone.rect;
      const color = unlocked ? this.visualStyle.unlockedColor : this.visualStyle.lockedColor;
      const alpha = unlocked ? this.visualStyle.unlockedAlpha : this.visualStyle.lockedAlpha;
      const stroke = unlocked ? this.visualStyle.unlockedStroke : this.visualStyle.lockedStroke;
      const rect = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h, color, alpha).setDepth(this.zoneDepth);
      rect.setStrokeStyle(this.visualStyle.strokeWidth, stroke);
      const label = this.scene.add.text(x + 18, y + 16, unlocked ? zone.name : `${zone.name}\n$${zone.cost}`, {
        fontSize: '18px',
        color: unlocked ? '#293b32' : '#eef5e8',
        lineSpacing: 4,
      }).setDepth(2).setVisible(this.showLabels);
      this.zoneVisuals.set(zone.id, { rect, label });
    });
  }

  unlock(zone) {
    if (this.state.unlockedZones.includes(zone.id)) return false;
    if (!this.economy.spend(zone.cost)) {
      EventBus.emit(Events.UI_TOAST, 'Недостаточно денег');
      return false;
    }
    this.state.unlockedZones.push(zone.id);
    const visual = this.zoneVisuals.get(zone.id);
    visual.rect
      .setFillStyle(this.visualStyle.unlockedColor, this.visualStyle.unlockedAlpha)
      .setStrokeStyle(this.visualStyle.strokeWidth, this.visualStyle.unlockedStroke);
    visual.label.setText(zone.name).setColor('#293b32');
    this.shelves.unlockZone(zone.id);
    EventBus.emit(Events.ZONE_UNLOCKED, zone);
    EventBus.emit(Events.ROUTES_CHANGED, { zone });
    return true;
  }

  destroy() {
    EventBus.off(Events.UI_UNLOCK_ZONE, this.onUnlockZone);
  }
}

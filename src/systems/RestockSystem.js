import { EventBus, Events } from '../core/EventBus.js';

export class RestockSystem {
  constructor(state, balance, economy, shelves, zones, options = {}) {
    this.state = state;
    this.balance = balance;
    this.economy = economy;
    this.shelves = shelves;
    this.zones = zones;
    this.zonesPath = options.zonesPath ?? 'zones';
    this.onRestockShelf = (id) => this.restockOrUnlock(id);
    EventBus.on(Events.UI_RESTOCK_SHELF, this.onRestockShelf);
  }

  restockOrUnlock(id) {
    const shelf = this.shelves.getShelf(id);
    if (!shelf) return false;

    if (!this.state.unlockedZones.includes(shelf.zone)) {
      const zone = this.balance.get(this.zonesPath).find((item) => item.id === shelf.zone);
      return this.zones.unlock(zone);
    }

    const current = this.state.shelves[shelf.id] ?? 0;
    const missing = shelf.capacity - current;
    if (missing <= 0) {
      EventBus.emit(Events.UI_TOAST, `${shelf.productMeta.name}: витрина уже полная`);
      return false;
    }

    const buyPrice = shelf.productMeta.buyPrice;
    const affordable = Math.floor(this.state.money / buyPrice);
    const amount = Math.min(missing, affordable);
    if (amount <= 0) {
      EventBus.emit(Events.UI_TOAST, `${shelf.productMeta.name}: нужно $${buyPrice} за товар`);
      return false;
    }

    this.economy.spend(amount * buyPrice);
    this.shelves.stockShelf(shelf.id, amount);
    EventBus.emit(Events.UI_TOAST, `${shelf.productMeta.name}: +${amount} за $${amount * buyPrice}`);
    return true;
  }
  destroy() {
    EventBus.off(Events.UI_RESTOCK_SHELF, this.onRestockShelf);
  }
}

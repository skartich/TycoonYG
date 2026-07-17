import { EventBus, Events } from '../core/EventBus.js';

export class OfflineProgressSystem {
  constructor(state, balance, economy) {
    this.state = state;
    this.balance = balance;
    this.economy = economy;
  }

  apply() {
    const elapsedSeconds = Math.max(0, (Date.now() - (this.state.lastSavedAt ?? Date.now())) / 1000);
    if (elapsedSeconds < 30) return 0;
    const stocked = Object.values(this.state.shelves).reduce((sum, value) => sum + value, 0);
    const cycles = Math.min(360, Math.floor(elapsedSeconds / 12));
    const sold = Math.min(stocked, cycles);
    const prices = Object.values(this.balance.get('products.types')).map((product) => product.sellPrice);
    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const earned = Math.floor(sold * averagePrice * this.balance.get('start.offlineEfficiency'));
    if (earned <= 0) return 0;
    this.economy.addMoney(earned);
    EventBus.emit(Events.OFFLINE_PROGRESS, { earned, minutes: Math.floor(elapsedSeconds / 60) });
    return earned;
  }
}

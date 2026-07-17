import { EventBus, Events } from '../core/EventBus.js';

export class EconomySystem {
  constructor(state, balance) {
    this.state = state;
    this.balance = balance;
    this.stats = {
      playerSpeed: balance.get('player.speed'),
      carryCapacity: balance.get('player.carryCapacity'),
      stockAmount: balance.get('player.stockAmount'),
      checkoutSeconds: balance.get('player.checkoutSeconds'),
      sellPriceBonus: 0,
    };
    this.applyPurchasedUpgrades();
  }

  applyPurchasedUpgrades() {
    this.balance.get('upgrades').forEach((upgrade) => {
      if (this.state.purchasedUpgrades.includes(upgrade.id)) this.applyUpgrade(upgrade, false);
    });
  }

  canAfford(cost) {
    return this.state.money >= cost;
  }

  spend(cost) {
    if (!this.canAfford(cost)) return false;
    this.state.money -= cost;
    EventBus.emit(Events.MONEY_CHANGED, this.state.money);
    return true;
  }

  addMoney(amount) {
    this.state.money += amount;
    this.state.revenue += amount;
    EventBus.emit(Events.MONEY_CHANGED, this.state.money);
    EventBus.emit(Events.STATS_CHANGED, this.state);
  }

  addProducts(amount) {
    this.state.products += amount;
    EventBus.emit(Events.PRODUCT_CHANGED, this.state.products);
  }

  takeProducts(amount) {
    const taken = Math.min(amount, this.state.products);
    this.state.products -= taken;
    EventBus.emit(Events.PRODUCT_CHANGED, this.state.products);
    return taken;
  }

  applyUpgrade(upgrade, announce = true) {
    if (upgrade.type === 'playerSpeed') this.stats.playerSpeed += upgrade.value;
    if (upgrade.type === 'carryCapacity') this.stats.carryCapacity += upgrade.value;
    if (upgrade.type === 'checkoutSpeed') this.stats.checkoutSeconds = Math.max(0.35, this.stats.checkoutSeconds - upgrade.value);
    if (upgrade.type === 'sellPrice') this.stats.sellPriceBonus += upgrade.value;
    if (announce) EventBus.emit(Events.UPGRADE_PURCHASED, upgrade);
    EventBus.emit(Events.STATS_CHANGED, this.state);
  }
}

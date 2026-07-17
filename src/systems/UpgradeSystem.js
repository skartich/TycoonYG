import { EventBus, Events } from '../core/EventBus.js';

export class UpgradeSystem {
  constructor(state, balance, economy) {
    this.state = state;
    this.balance = balance;
    this.economy = economy;
    EventBus.on(Events.UI_BUY_UPGRADE, (id) => {
      const upgrade = this.balance.get('upgrades').find((item) => item.id === id);
      if (upgrade) this.buy(upgrade);
    });
  }

  buy(upgrade) {
    if (this.state.purchasedUpgrades.includes(upgrade.id)) return false;
    if (!this.economy.spend(upgrade.cost)) {
      EventBus.emit(Events.UI_TOAST, 'Недостаточно денег');
      return false;
    }
    this.state.purchasedUpgrades.push(upgrade.id);
    this.economy.applyUpgrade(upgrade);
    return true;
  }
}

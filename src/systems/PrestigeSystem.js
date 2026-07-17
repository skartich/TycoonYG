import { EventBus, Events } from '../core/EventBus.js';

export class PrestigeSystem {
  constructor(state, balance, saveManager) {
    this.state = state;
    this.balance = balance;
    this.saveManager = saveManager;
    EventBus.on(Events.UI_CLAIM_PRESTIGE, () => this.claim());
  }

  canPrestige() {
    return this.state.revenue >= this.balance.get('start.prestigeRevenueRequired');
  }

  claim() {
    if (!this.canPrestige()) {
      EventBus.emit(Events.UI_TOAST, 'Престиж откроется после большего оборота');
      return null;
    }
    const gained = Math.max(1, Math.floor(this.state.revenue / this.balance.get('start.prestigeRevenueRequired')));
    const defaultState = this.saveManager.createDefaultState();
    Object.assign(this.state, defaultState, { prestigePoints: this.state.prestigePoints + gained });
    EventBus.emit(Events.PRESTIGE_CLAIMED, { gained });
    return gained;
  }
}

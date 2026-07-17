import { EventBus, Events } from '../core/EventBus.js';

export class DayCycleSystem {
  constructor(state, balance, adService) {
    this.state = state;
    this.balance = balance;
    this.adService = adService;
    this.remaining = balance.get('start.dayLengthSeconds');
  }

  update(delta) {
    this.remaining -= delta / 1000;
    if (this.remaining > 0) return;
    this.remaining = this.balance.get('start.dayLengthSeconds');
    this.state.day += 1;
    EventBus.emit(Events.DAY_ROLLED, this.state.day);
    this.adService.showDayInterstitial(this.state.day);
  }
}

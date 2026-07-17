import { EventBus, Events } from '../core/EventBus.js';
import { todayKey } from '../utils/math.js';

export class DailyRewardSystem {
  constructor(state, balance, saveManager, economy) {
    this.state = state;
    this.balance = balance;
    this.saveManager = saveManager;
    this.economy = economy;
    EventBus.on(Events.UI_CLAIM_DAILY, () => this.claim());
  }

  claim() {
    if (!this.saveManager.canClaimDailyReward(this.state)) {
      EventBus.emit(Events.UI_TOAST, 'Ежедневная награда уже получена');
      return false;
    }
    const rewards = this.balance.get('dailyRewards');
    const index = this.state.dailyStreak % rewards.length;
    const amount = rewards[index];
    this.state.dailyStreak += 1;
    this.state.lastDailyReward = todayKey();
    this.economy.addMoney(amount);
    EventBus.emit(Events.DAILY_REWARD_CLAIMED, { amount, streak: this.state.dailyStreak });
    return true;
  }
}

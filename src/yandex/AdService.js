import { EventBus, Events } from '../core/EventBus.js';

export class AdService {
  constructor(yandex, balance, economy, state) {
    this.yandex = yandex;
    this.balance = balance;
    this.economy = economy;
    this.state = state;
    this.onShowRewarded = () => this.showRewardedMoney();
    EventBus.on(Events.UI_SHOW_REWARDED, this.onShowRewarded);
  }

  async showRewardedMoney() {
    const rewarded = await this.yandex.showRewardedAd();
    if (rewarded) {
      const amount = this.state.rewardedAdReward ?? this.balance.get('ads.rewardedMoneyStart');
      const nextAmount = Math.min(
        this.balance.get('ads.rewardedMoneyMax'),
        amount + this.balance.get('ads.rewardedMoneyStep'),
      );
      this.economy.addMoney(amount);
      this.state.rewardedAdReward = nextAmount;
      EventBus.emit(Events.STATS_CHANGED, this.state);
      EventBus.emit(Events.UI_TOAST, `Реклама просмотрена: +$${amount}`);
    }
    return rewarded;
  }

  showDayInterstitial(day) {
    const every = this.balance.get('ads.fullscreenEveryDays');
    if (day > 1 && day % every === 0) return this.yandex.showFullscreenAd();
    return Promise.resolve(false);
  }

  destroy() {
    EventBus.off(Events.UI_SHOW_REWARDED, this.onShowRewarded);
  }
}

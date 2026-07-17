import { EventBus, Events } from '../core/EventBus.js';

export class YandexSDK {
  constructor() {
    this.ysdk = null;
    this.ready = false;
    this.mock = true;
  }

  async init() {
    try {
      await this.loadScript();
      if (!window.YaGames) throw new Error('YaGames is unavailable');
      this.ysdk = await window.YaGames.init();
      this.mock = false;
      this.ready = true;
      return this;
    } catch (error) {
      console.info('[YandexSDK] Local mock mode:', error.message);
      this.ready = true;
      return this;
    }
  }

  loadScript() {
    if (window.YaGames) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/sdk.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('SDK script failed to load'));
      document.head.append(script);
    });
  }

  loadingReady() {
    this.ysdk?.features?.LoadingAPI?.ready?.();
    EventBus.emit(Events.GAME_READY);
  }

  gameplayStart() {
    this.ysdk?.features?.GameplayAPI?.start?.();
    EventBus.emit(Events.GAMEPLAY_STARTED);
  }

  gameplayStop() {
    this.ysdk?.features?.GameplayAPI?.stop?.();
    EventBus.emit(Events.GAMEPLAY_STOPPED);
  }

  showFullscreenAd() {
    this.gameplayStop();
    return new Promise((resolve) => {
      if (!this.ysdk?.adv) {
        setTimeout(() => {
          EventBus.emit(Events.AD_FULLSCREEN_CLOSED, false);
          this.gameplayStart();
          resolve(false);
        }, 350);
        return;
      }
      this.ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => this.gameplayStop(),
          onClose: (wasShown) => {
            EventBus.emit(Events.AD_FULLSCREEN_CLOSED, wasShown);
            this.gameplayStart();
            resolve(wasShown);
          },
          onError: () => {
            this.gameplayStart();
            resolve(false);
          },
        },
      });
    });
  }

  showRewardedAd() {
    this.gameplayStop();
    return new Promise((resolve) => {
      let rewarded = false;
      if (!this.ysdk?.adv) {
        setTimeout(() => {
          EventBus.emit(Events.AD_REWARDED);
          this.gameplayStart();
          resolve(true);
        }, 350);
        return;
      }
      this.ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => this.gameplayStop(),
          onRewarded: () => {
            rewarded = true;
            EventBus.emit(Events.AD_REWARDED);
          },
          onClose: () => {
            this.gameplayStart();
            resolve(rewarded);
          },
          onError: () => {
            this.gameplayStart();
            resolve(false);
          },
        },
      });
    });
  }
}

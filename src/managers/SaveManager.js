import { EventBus, Events } from '../core/EventBus.js';
import { todayKey } from '../utils/math.js';

const SAVE_KEY = 'supermarket-empire-save-v1';

export class SaveManager {
  constructor(balance) {
    this.balance = balance;
  }

  createDefaultState() {
    const defaultUnlockedZones = this.balance.get('start.unlockedZones', ['starter']);
    const shelves = [
      ...this.balance.get('shelves'),
      ...this.balance.get('stationeryShelves', []),
    ];
    return {
      money: this.balance.get('start.money'),
      products: this.balance.get('start.products'),
      revenue: 0,
      prestigePoints: 0,
      day: 1,
      lastSavedAt: Date.now(),
      lastDailyReward: '',
      dailyStreak: 0,
      customerSpeedBoosts: 0,
      customerFlowBoosts: 0,
      rewardedAdReward: this.balance.get('ads.rewardedMoneyStart'),
      unlockedZones: defaultUnlockedZones,
      purchasedUpgrades: [],
      shelves: Object.fromEntries(
        shelves.map((shelf) => [shelf.id, defaultUnlockedZones.includes(shelf.zone) ? 8 : 0]),
      ),
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const defaultState = this.createDefaultState();
      const state = raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
      state.shelves = { ...defaultState.shelves, ...(state.shelves ?? {}) };
      state.unlockedZones = Array.from(new Set([
        ...defaultState.unlockedZones,
        ...((state.unlockedZones?.length ? state.unlockedZones : defaultState.unlockedZones) ?? []),
      ]));
      state.rewardedAdReward = state.rewardedAdReward ?? this.balance.get('ads.rewardedMoneyStart');
      EventBus.emit(Events.SAVE_LOADED, state);
      return state;
    } catch {
      return this.createDefaultState();
    }
  }

  save(state) {
    const savedState = { ...state, lastSavedAt: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(savedState));
    EventBus.emit(Events.SAVE_REQUESTED, savedState);
  }

  canClaimDailyReward(state) {
    return state.lastDailyReward !== todayKey();
  }

  clear() {
    localStorage.removeItem(SAVE_KEY);
  }
}

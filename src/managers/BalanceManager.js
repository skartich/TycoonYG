import balance from '../data/balance.json';

export class BalanceManager {
  constructor() {
    this.data = balance;
  }

  get(path, fallback = undefined) {
    const value = path.split('.').reduce((node, key) => node?.[key], this.data);
    return value ?? fallback;
  }
}

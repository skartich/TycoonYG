import balance from '../data/balance.json';
import { hypermarketBalance } from '../data/hypermarketBalance.js';

export class BalanceManager {
  constructor() {
    this.data = {
      ...balance,
      start: {
        ...balance.start,
        unlockedZones: [
          ...balance.start.unlockedZones,
          ...hypermarketBalance.defaultUnlockedZones,
        ],
      },
      products: {
        ...balance.products,
        types: {
          ...balance.products.types,
          ...hypermarketBalance.products,
        },
      },
      hypermarketShelves: hypermarketBalance.shelves,
      hypermarketZones: hypermarketBalance.zones,
    };
  }

  get(path, fallback = undefined) {
    const value = path.split('.').reduce((node, key) => node?.[key], this.data);
    return value ?? fallback;
  }
}

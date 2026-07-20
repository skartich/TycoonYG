import { ObjectPool } from '../pool/ObjectPool.js';
import { Customer } from '../entities/Customer.js';
import { ENTRANCE_POINT } from '../core/WorldPoints.js';
import { EventBus, Events } from '../core/EventBus.js';

export class CustomerSystem {
  constructor(scene, balance, systems, options = {}) {
    this.scene = scene;
    this.balance = balance;
    this.systems = systems;
    this.spawnPoint = options.spawnPoint ?? ENTRANCE_POINT;
    this.spawnEnabled = options.spawnEnabled ?? true;
    this.autoRefreshRoutes = options.autoRefreshRoutes ?? true;
    this.minSpawnDistance = options.minSpawnDistance ?? 28;
    this.customerOptions = options.customer ?? {};
    this.spawnTimer = 1;
    this.pool = new ObjectPool(() => new Customer(scene, this.customerOptions));
    this.onRoutesChanged = () => this.refreshActiveRoutes();
    if (this.autoRefreshRoutes) EventBus.on(Events.ROUTES_CHANGED, this.onRoutesChanged);
  }

  release(customer) {
    this.pool.release(customer);
  }

  update(delta) {
    if (!this.spawnEnabled) {
      this.pool.used.forEach((customer) => customer.update(delta));
      return;
    }
    this.spawnTimer -= delta / 1000;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.systems.boosts?.getCustomerSpawnSeconds() ?? this.balance.get('start.customerSpawnSeconds');
      const spawnPosition = this.getAvailableSpawnPosition();
      if (spawnPosition && this.systems.shelves.getRandomStockedShelf()) {
        this.pool.acquire(spawnPosition.x, spawnPosition.y, this.systems);
      } else if (!spawnPosition) {
        this.spawnTimer = Math.min(this.spawnTimer, 0.5);
      }
    }
    this.pool.used.forEach((customer) => customer.update(delta));
  }

  refreshActiveRoutes() {
    this.pool.used.forEach((customer) => customer.refreshRoute?.());
  }

  setSpawnEnabled(enabled) {
    this.spawnEnabled = Boolean(enabled);
    if (this.spawnEnabled) this.spawnTimer = Math.min(this.spawnTimer, 0.5);
  }

  getAvailableSpawnPosition() {
    const offsets = [0, 38, -38, 76, -76];
    return offsets
      .map((offset) => ({ x: this.spawnPoint.x + offset, y: this.spawnPoint.y }))
      .find((candidate) => [...this.pool.used].every((customer) => (
        !customer.container.visible
        || Math.hypot(customer.container.x - candidate.x, customer.container.y - candidate.y) >= this.minSpawnDistance
      ))) ?? null;
  }

  destroy() {
    if (this.autoRefreshRoutes) EventBus.off(Events.ROUTES_CHANGED, this.onRoutesChanged);
    this.pool.clear();
  }
}

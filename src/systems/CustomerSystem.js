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
    this.spawnTimer = 1;
    this.pool = new ObjectPool(() => new Customer(scene));
    this.onRoutesChanged = () => this.refreshActiveRoutes();
    EventBus.on(Events.ROUTES_CHANGED, this.onRoutesChanged);
  }

  release(customer) {
    this.pool.release(customer);
  }

  update(delta) {
    this.spawnTimer -= delta / 1000;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.systems.boosts?.getCustomerSpawnSeconds() ?? this.balance.get('start.customerSpawnSeconds');
      if (this.systems.shelves.getRandomStockedShelf()) this.pool.acquire(this.spawnPoint.x, this.spawnPoint.y, this.systems);
    }
    this.pool.used.forEach((customer) => customer.update(delta));
  }

  refreshActiveRoutes() {
    this.pool.used.forEach((customer) => customer.refreshRoute?.());
  }

  destroy() {
    EventBus.off(Events.ROUTES_CHANGED, this.onRoutesChanged);
  }
}

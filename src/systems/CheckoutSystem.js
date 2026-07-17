import Phaser from 'phaser';
import { EventBus, Events } from '../core/EventBus.js';
import { ENTRANCE_POINT } from '../core/WorldPoints.js';

const DEFAULT_TERMINAL_POSITIONS = [
  { x: 190, y: 415 },
  { x: 190, y: 535 },
  { x: 190, y: 655 },
];

const DEFAULT_TERMINAL_SPOTS = [
  { x: 190, y: 474 },
  { x: 190, y: 594 },
  { x: 190, y: 714 },
];

export class CheckoutSystem {
  constructor(scene, state, economy, options = {}) {
    this.scene = scene;
    this.state = state;
    this.economy = economy;
    this.options = {
      imageKey: 'self-checkout',
      displayWidth: 96,
      displayHeight: 96,
      terminalPositions: DEFAULT_TERMINAL_POSITIONS,
      terminalSpots: DEFAULT_TERMINAL_SPOTS,
      sideLaneX: 305,
      waitingStartY: 790,
      waitingStepY: 34,
      laneMinY: 362,
      laneMaxY: 760,
      entrancePoint: ENTRANCE_POINT,
      ...options,
    };
    this.queue = [];
    this.sessions = new Map();
    this.terminalPositions = this.options.terminalPositions;
    this.terminalSpots = this.options.terminalSpots;
    this.sideLaneX = this.options.sideLaneX;
    this.visual = scene.add.container(0, 0).setDepth(15);
    this.checkoutSprites = this.terminalPositions.map((spot) => {
      const terminal = scene.add.image(spot.x, spot.y, this.options.imageKey)
        .setDisplaySize(this.options.displayWidth, this.options.displayHeight);
      return terminal;
    });
    this.visual.add(this.checkoutSprites);
    this.obstacles = scene.physics.add.staticGroup();
    this.terminalPositions.forEach((spot) => {
      const blocker = scene.add.rectangle(spot.x, spot.y + 2, 72, 54, 0x000000, 0);
      this.obstacles.add(blocker);
      blocker.body.setSize(72, 54);
      blocker.body.updateFromGameObject();
    });
  }

  joinQueue(customer) {
    if (!this.queue.includes(customer)) this.queue.push(customer);
    this.reflowQueue();
    return customer.checkoutSpot;
  }

  reflowQueue() {
    const occupiedSpots = new Set(
      [...this.sessions.keys()].map((customer) => `${customer.checkoutSpot?.x}:${customer.checkoutSpot?.y}`),
    );
    const availableSpots = this.terminalSpots.filter((spot) => !occupiedSpots.has(`${spot.x}:${spot.y}`));
    let terminalIndex = 0;
    let waitingIndex = 0;

    this.queue.forEach((customer) => {
      if (this.sessions.has(customer)) return;
      const nextSpot = terminalIndex < availableSpots.length
        ? availableSpots[terminalIndex++]
        : { x: this.sideLaneX, y: this.options.waitingStartY + waitingIndex++ * this.options.waitingStepY };
      customer.setCheckoutSpot(nextSpot);
    });
  }

  getRouteToSpot(spot, from) {
    const laneY = Phaser.Math.Clamp(from.y, this.options.laneMinY, this.options.laneMaxY);
    return [
      { x: this.sideLaneX, y: from.y },
      { x: this.sideLaneX, y: laneY },
      { x: this.sideLaneX, y: spot.y },
      spot,
    ];
  }

  getExitRoute(from) {
    const entrance = this.options.entrancePoint;
    const laneY = Phaser.Math.Clamp(from.y, this.options.laneMinY, entrance.y);
    return [
      { x: this.sideLaneX, y: laneY },
      { x: this.sideLaneX, y: entrance.y },
      entrance,
    ];
  }

  update(delta) {
    this.queue.filter((customer) => this.isTerminalSpot(customer.checkoutSpot)).forEach((customer) => {
      const closeEnough = customer.checkoutSpot
        && Math.hypot(customer.container.x - customer.checkoutSpot.x, customer.container.y - customer.checkoutSpot.y) < 14;
      if (closeEnough && !this.sessions.has(customer)) this.sessions.set(customer, Math.max(0.25, this.economy.stats.checkoutSeconds));
    });

    [...this.sessions.entries()].forEach(([customer, timer]) => {
      const nextTimer = timer - delta / 1000;
      if (nextTimer > 0) {
        this.sessions.set(customer, nextTimer);
        return;
      }
      this.completeCheckout(customer);
    });
  }

  completeCheckout(customer) {
    const value = Math.max(0, customer.basketValue);
    this.economy.addMoney(value);
    this.sessions.delete(customer);
    this.queue = this.queue.filter((queued) => queued !== customer);
    customer.state = 'leaving';
    EventBus.emit(Events.CHECKOUT_COMPLETED, { money: value, items: customer.basketItems });
    this.reflowQueue();
  }

  isTerminalSpot(spot) {
    return this.terminalSpots.some((terminalSpot) => terminalSpot.x === spot?.x && terminalSpot.y === spot?.y);
  }
}

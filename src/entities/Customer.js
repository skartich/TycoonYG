import Phaser from 'phaser';
import { EventBus, Events } from '../core/EventBus.js';

const CUSTOMER_DEPTH_OFFSET = 22;

export class Customer {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.frontTexture = options.frontTexture ?? 'customer-front';
    this.backTexture = options.backTexture ?? 'customer-back';
    this.container = scene.add.container(-100, -100).setVisible(false).setDepth(40);
    this.sprite = scene.add.image(0, options.spriteY ?? 0, this.frontTexture)
      .setDisplaySize(options.displayWidth ?? 56, options.displayHeight ?? 44);
    this.container.add(this.sprite);
    this.facing = 'front';
    scene.physics.add.existing(this.container);
    const bodyWidth = options.bodyWidth ?? 30;
    const bodyHeight = options.bodyHeight ?? 30;
    this.container.body.setSize(bodyWidth, bodyHeight).setOffset(-bodyWidth / 2, -bodyHeight / 2);
  }

  spawn(x, y, systems) {
    this.systems = systems;
    this.state = 'choosingShelf';
    this.targetShelf = systems.shelves.getRandomStockedShelf();
    this.shoppingRoute = [];
    this.shoppingRouteIndex = 0;
    this.checkoutSpot = null;
    this.checkoutRoute = [];
    this.checkoutRouteIndex = 0;
    this.leaveRoute = [];
    this.leaveRouteIndex = 0;
    this.basketValue = 0;
    this.basketItems = 0;
    this.targetItems = Phaser.Math.Between(1, 3);
    this.routeRetries = 0;
    this.patience = 32;
    if (!this.checkoutCollider && systems.checkout.obstacles) {
      this.checkoutCollider = this.scene.physics.add.collider(this.container, systems.checkout.obstacles);
    }
    if (!this.shelfCollider && systems.shelves.obstacles) {
      this.shelfCollider = this.scene.physics.add.collider(this.container, systems.shelves.obstacles);
    }
    if (!this.environmentCollider && systems.environmentObstacles) {
      this.environmentCollider = this.scene.physics.add.collider(this.container, systems.environmentObstacles);
    }
    this.container.setPosition(x, y).setVisible(true).setActive(true);
    this.updateDepth();
  }

  despawn() {
    this.container.setVisible(false).setActive(false);
    this.container.body.setVelocity(0, 0);
    this.shoppingRoute = [];
    this.checkoutRoute = [];
    this.leaveRoute = [];
  }

  update(delta) {
    if (!this.container.visible) return;
    if (!['walkingToCheckout', 'selfCheckout', 'leaving'].includes(this.state)) {
      this.patience -= delta / 1000;
      if (this.patience <= 0) this.state = 'leaving';
    }
    if (this.state === 'choosingShelf') this.chooseShelf();
    if (this.state === 'walkingToShelf') this.goToShelf();
    if (this.state === 'walkingToCheckout') this.goToCheckout();
    if (this.state === 'selfCheckout') this.useSelfCheckout();
    if (this.state === 'leaving') this.leave();
    this.updateDepth();
  }

  moveTo(target, speed = 95) {
    if (!target) return true;
    const boostedSpeed = speed * (this.systems.boosts?.getCustomerSpeedMultiplier() ?? 1);
    const dx = target.x - this.container.x;
    const dy = target.y - this.container.y;
    const length = Math.hypot(dx, dy);
    if (length < 10) {
      this.container.body.setVelocity(0, 0);
      return true;
    }
    this.updateFacing(dy);
    this.container.body.setVelocity((dx / length) * boostedSpeed, (dy / length) * boostedSpeed);
    return false;
  }

  updateFacing(dy) {
    if (Math.abs(dy) < 2) return;
    const nextFacing = dy < 0 ? 'back' : 'front';
    if (nextFacing === this.facing) return;
    this.facing = nextFacing;
    this.sprite.setTexture(nextFacing === 'back' ? this.backTexture : this.frontTexture);
  }

  updateDepth() {
    this.container.setDepth(this.container.y + CUSTOMER_DEPTH_OFFSET);
  }

  goToShelf() {
    if (!this.systems.shelves.isShelfReachable(this.targetShelf)) {
      this.chooseShelf();
      return;
    }

    if (!this.shoppingRoute.length) {
      this.shoppingRoute = this.systems.shelves.getRouteToShelf(this.targetShelf, this.container);
      this.shoppingRouteIndex = 0;
      if (!this.shoppingRoute.length) {
        this.routeRetries += 1;
        if (this.routeRetries <= 1) this.systems.refreshNavigation?.();
        this.targetShelf = this.systems.shelves.getRandomStockedShelf();
        this.state = this.targetShelf && this.routeRetries <= 2 ? 'walkingToShelf' : (this.basketItems > 0 ? 'walkingToCheckout' : 'leaving');
        return;
      }
      this.routeRetries = 0;
    }

    const nextPoint = this.shoppingRoute[this.shoppingRouteIndex] ?? this.systems.shelves.getCustomerSpot(this.targetShelf);
    if (this.moveTo(nextPoint)) {
      if (this.shoppingRouteIndex < this.shoppingRoute.length - 1) {
        this.shoppingRouteIndex += 1;
        return;
      }

      const item = this.systems.shelves.takeFromShelf(this.targetShelf.id, 1);
      if (!item) {
        this.shoppingRoute = [];
        this.state = 'choosingShelf';
        return;
      }
      this.basketValue += item.value;
      this.basketItems += item.amount;
      this.shoppingRoute = [];
      this.state = this.basketItems >= this.targetItems ? 'walkingToCheckout' : 'choosingShelf';
    }
  }

  refreshRoute() {
    const safePosition = this.systems.shelves.getSafePosition?.(this.container);
    if (safePosition) {
      this.container.setPosition(safePosition.x, safePosition.y);
      this.container.body.setVelocity(0, 0);
    }

    if (this.state !== 'walkingToShelf') return;
    if (!this.systems.shelves.isShelfReachable(this.targetShelf)) {
      this.chooseShelf();
      return;
    }
    this.shoppingRoute = this.systems.shelves.getRouteToShelf(this.targetShelf, this.container);
    this.shoppingRouteIndex = 0;
    if (!this.shoppingRoute.length) this.chooseShelf();
  }

  chooseShelf() {
    this.targetShelf = this.systems.shelves.getRandomStockedShelf();
    this.shoppingRoute = [];
    this.shoppingRouteIndex = 0;
    this.routeRetries = 0;
    this.state = this.targetShelf ? 'walkingToShelf' : (this.basketItems > 0 ? 'walkingToCheckout' : 'leaving');
  }

  goToCheckout() {
    this.checkoutSpot = this.systems.checkout.joinQueue(this);
    this.checkoutRoute = this.systems.checkout.getRouteToSpot(this.checkoutSpot, this.container);
    this.checkoutRouteIndex = 0;
    this.state = 'selfCheckout';
    EventBus.emit(Events.CHECKOUT_REQUESTED, this);
  }

  setCheckoutSpot(spot) {
    const changed = !this.checkoutSpot || this.checkoutSpot.x !== spot.x || this.checkoutSpot.y !== spot.y;
    this.checkoutSpot = spot;
    if (changed && this.state === 'selfCheckout') {
      this.checkoutRoute = this.systems.checkout.getRouteToSpot(this.checkoutSpot, this.container);
      this.checkoutRouteIndex = 0;
    }
  }

  useSelfCheckout() {
    const nextPoint = this.checkoutRoute[this.checkoutRouteIndex] ?? this.checkoutSpot;
    if (!nextPoint) return;
    if (this.moveTo(nextPoint, 80) && this.checkoutRouteIndex < this.checkoutRoute.length - 1) {
      this.checkoutRouteIndex += 1;
    }
  }

  leave() {
    if (!this.leaveRoute.length) {
      this.leaveRoute = this.systems.checkout.getExitRoute(this.container);
      this.leaveRouteIndex = 0;
    }
    const nextPoint = this.leaveRoute[this.leaveRouteIndex];
    if (!nextPoint) return;
    if (this.moveTo(nextPoint, 120) && this.leaveRouteIndex < this.leaveRoute.length - 1) {
      this.leaveRouteIndex += 1;
      return;
    }
    if (this.leaveRouteIndex >= this.leaveRoute.length - 1 && this.moveTo(nextPoint, 120)) {
      EventBus.emit(Events.CUSTOMER_LEFT);
      this.systems.customers.release(this);
    }
  }
}

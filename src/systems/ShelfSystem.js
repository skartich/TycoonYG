import Phaser from 'phaser';
import { EventBus, Events } from '../core/EventBus.js';

const DEFAULT_SHELF_WIDTH = 90;
const DEFAULT_SHELF_HEIGHT = 112;
const DEFAULT_PROGRESS_WIDTH = 70;
const DEFAULT_PROGRESS_HEIGHT = 40;
const DEFAULT_PROGRESS_Y = -44;
const FILL_X = -22.5;
const FILL_Y = -9.4;
const FILL_WIDTH = 45;
const FILL_HEIGHT = 7;
const FILL_RADIUS = 3;
const TEXT_Y = 8.8;
const DEFAULT_SHELF_BLOCKER_WIDTH = 80;
const DEFAULT_SHELF_BLOCKER_HEIGHT = 24;
const DEFAULT_SHELF_BLOCKER_Y = 35;
const DEFAULT_CUSTOMER_SPOT_Y = 72;
const DEFAULT_SIDE_AISLE_X = 305;
const DEFAULT_CENTER_AISLE_X = 700;

export class ShelfSystem {
  constructor(scene, state, balance, options = {}) {
    this.scene = scene;
    this.state = state;
    this.balance = balance;
    this.options = {
      shelvesPath: 'shelves',
      productsPath: 'products.types',
      shelfWidth: DEFAULT_SHELF_WIDTH,
      shelfHeight: DEFAULT_SHELF_HEIGHT,
      progressWidth: DEFAULT_PROGRESS_WIDTH,
      progressHeight: DEFAULT_PROGRESS_HEIGHT,
      progressY: DEFAULT_PROGRESS_Y,
      progressStyle: 'image',
      showLockedVisuals: false,
      lockedVisualAlpha: 0.42,
      positions: null,
      blockerWidth: DEFAULT_SHELF_BLOCKER_WIDTH,
      blockerHeight: DEFAULT_SHELF_BLOCKER_HEIGHT,
      blockerY: DEFAULT_SHELF_BLOCKER_Y,
      customerSpotY: DEFAULT_CUSTOMER_SPOT_Y,
      route: {
        sideAisleX: DEFAULT_SIDE_AISLE_X,
        centerAisleX: DEFAULT_CENTER_AISLE_X,
        connectorXs: [DEFAULT_SIDE_AISLE_X, DEFAULT_CENTER_AISLE_X],
        columns: null,
        switches: [],
        entranceThreshold: 80,
      },
      ...options,
      route: {
        sideAisleX: DEFAULT_SIDE_AISLE_X,
        centerAisleX: DEFAULT_CENTER_AISLE_X,
        connectorXs: [DEFAULT_SIDE_AISLE_X, DEFAULT_CENTER_AISLE_X],
        columns: null,
        switches: [],
        entranceThreshold: 80,
        ...(options.route ?? {}),
      },
    };
    this.productTypes = balance.get(this.options.productsPath);
    this.shelves = balance.get(this.options.shelvesPath).map((config) => ({
      ...config,
      ...(this.options.positions?.[config.id] ?? {}),
      productMeta: balance.get(`${this.options.productsPath}.${config.product}`),
      visual: null,
      blocker: null,
      customerSpot: null,
      progressFill: null,
      progressText: null,
      selectedGlow: null,
    }));
    this.createVisuals();
    this.stockWasAvailable = this.hasAnyStock();
    this.onShelfSelected = (id) => this.setSelectedShelf(id);
    EventBus.on(Events.UI_SHELF_SELECTED, this.onShelfSelected);
  }

  createVisuals() {
    this.obstacles = this.scene.physics.add.staticGroup();
    this.shelves.forEach((shelf) => {
      const unlocked = this.state.unlockedZones.includes(shelf.zone);
      const visual = this.scene.add.container(shelf.x, shelf.y)
        .setDepth(shelf.y + this.options.shelfHeight / 2)
        .setVisible(unlocked || this.options.showLockedVisuals)
        .setAlpha(unlocked ? 1 : this.options.lockedVisualAlpha);
      const productColor = Number(shelf.productMeta.color);
      const shelfKey = shelf.asset ?? `shelf-${shelf.product}`;
      const progressKey = shelf.progressAsset ?? `progress-${shelf.product}`;
      const selectedGlow = this.scene.add.rectangle(0, 3, this.options.shelfWidth + 10, this.options.shelfHeight + 8, 0x62c6e8, 0.08)
        .setStrokeStyle(3, 0x62c6e8, 0.9)
        .setVisible(false);
      const shelfImage = this.scene.add.image(0, 0, shelfKey).setDisplaySize(this.options.shelfWidth, this.options.shelfHeight);
      const progressFrame = this.options.progressStyle === 'compact'
        ? this.createCompactProgressFrame()
        : this.scene.add.image(0, this.options.progressY, progressKey).setDisplaySize(this.options.progressWidth, this.options.progressHeight);
      const progressFill = this.scene.add.graphics();
      const progressText = this.scene.add.text(0, this.options.progressY + (this.options.progressStyle === 'compact' ? -1 : TEXT_Y), '', {
        fontSize: this.options.progressStyle === 'compact' ? '11px' : '12px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#111111',
        strokeThickness: 2,
        align: 'center',
      }).setOrigin(0.5);
      visual.add([selectedGlow, shelfImage, progressFrame, progressFill, progressText]);
      shelf.progressFill = progressFill;
      shelf.progressColor = productColor;
      shelf.progressText = progressText;
      shelf.selectedGlow = selectedGlow;
      shelf.visual = visual;
      shelf.customerSpot = { x: shelf.x, y: shelf.y + this.options.customerSpotY };
      shelf.blocker = this.createBlocker(shelf, unlocked);
      this.updateLabel(shelf);
    });
  }

  createCompactProgressFrame() {
    const frame = this.scene.add.graphics();
    const width = this.options.progressWidth;
    const height = this.options.progressHeight;
    frame.fillStyle(0x18211f, 0.96);
    frame.fillRoundedRect(-width / 2, this.options.progressY - height / 2, width, height, 5);
    frame.lineStyle(2, 0x5f6d67, 1);
    frame.strokeRoundedRect(-width / 2, this.options.progressY - height / 2, width, height, 5);
    return frame;
  }

  createBlocker(shelf, unlocked) {
    const blocker = this.scene.add.rectangle(
      shelf.x,
      shelf.y + this.options.blockerY,
      this.options.blockerWidth,
      this.options.blockerHeight,
      0x000000,
      0,
    );
    this.obstacles.add(blocker);
    blocker.body.setSize(this.options.blockerWidth, this.options.blockerHeight);
    blocker.body.updateFromGameObject();
    blocker.body.enable = unlocked;
    blocker.setActive(unlocked);
    return blocker;
  }

  updateLabel(shelf) {
    const current = this.state.shelves[shelf.id] ?? 0;
    const ratio = Phaser.Math.Clamp(current / shelf.capacity, 0, 1);
    shelf.progressText.setText(`${current}/${shelf.capacity}`);
    this.drawProgressFill(shelf, ratio);
  }

  drawProgressFill(shelf, ratio) {
    if (this.options.progressStyle === 'compact') {
      this.animateCompactProgress(shelf, ratio);
      return;
    }
    const fill = shelf.progressFill;
    fill.clear();
    if (ratio <= 0) return;

    const width = Phaser.Math.Clamp(FILL_WIDTH * ratio, 1, FILL_WIDTH);
    const radius = Math.min(FILL_RADIUS, width / 2, FILL_HEIGHT / 2);
    fill.fillStyle(shelf.progressColor, 1);
    fill.fillRoundedRect(FILL_X, this.options.progressY + FILL_Y - FILL_HEIGHT / 2, width, FILL_HEIGHT, radius);
  }

  animateCompactProgress(shelf, ratio) {
    const previous = shelf.displayedRatio;
    if (previous == null) {
      shelf.displayedRatio = ratio;
      this.renderCompactProgress(shelf, ratio);
      return;
    }

    this.scene.tweens.killTweensOf(shelf.progressTweenState);
    const tweenState = { value: previous };
    shelf.progressTweenState = tweenState;
    this.scene.tweens.add({
      targets: tweenState,
      value: ratio,
      duration: 180,
      ease: 'Sine.Out',
      onUpdate: () => {
        shelf.displayedRatio = tweenState.value;
        this.renderCompactProgress(shelf, tweenState.value);
      },
      onComplete: () => {
        shelf.displayedRatio = ratio;
        this.renderCompactProgress(shelf, ratio);
      },
    });
  }

  renderCompactProgress(shelf, ratio) {
    const fill = shelf.progressFill;
    const innerWidth = this.options.progressWidth - 8;
    const width = Phaser.Math.Clamp(innerWidth * ratio, 0, innerWidth);
    const color = ratio <= 0.25 ? 0xe45b64 : ratio <= 0.6 ? 0xf2c94c : 0x43bde5;
    fill.clear();
    if (width <= 0) return;
    fill.fillStyle(color, 1);
    fill.fillRoundedRect(
      -this.options.progressWidth / 2 + 4,
      this.options.progressY - 4,
      width,
      8,
      Math.min(4, width / 2),
    );
  }

  setSelectedShelf(id) {
    this.shelves.forEach((shelf) => shelf.selectedGlow?.setVisible(shelf.id === id && shelf.visual.visible));
  }

  unlockZone(zoneId) {
    this.shelves.filter((shelf) => shelf.zone === zoneId).forEach((shelf) => {
      shelf.visual.setVisible(true).setAlpha(1);
      shelf.blocker.body.enable = true;
      shelf.blocker.setActive(true);
      this.updateLabel(shelf);
    });
  }

  stockShelf(id, amount) {
    const shelf = this.shelves.find((item) => item.id === id);
    if (!shelf || !this.state.unlockedZones.includes(shelf.zone)) return 0;
    const current = this.state.shelves[id] ?? 0;
    const stocked = Math.min(amount, shelf.capacity - current);
    this.state.shelves[id] = current + stocked;
    this.updateLabel(shelf);
    if (stocked > 0) this.stockWasAvailable = true;
    EventBus.emit(Events.SHELF_STOCKED, { id, stocked });
    return stocked;
  }

  getShelf(id) {
    return this.shelves.find((shelf) => shelf.id === id);
  }

  getCustomerSpot(shelf) {
    return shelf?.customerSpot ?? shelf;
  }

  getRouteToShelf(shelf, from) {
    const spot = this.getCustomerSpot(shelf);
    const route = [];
    let current = { x: from.x, y: from.y };
    const lowestRoadY = this.getLowestRoadY();
    const sideAisleX = this.options.route.sideAisleX;

    if (from.y > lowestRoadY + this.options.route.entranceThreshold) {
      if (Math.abs(current.x - sideAisleX) > 1) route.push({ x: sideAisleX, y: current.y });
      route.push({ x: sideAisleX, y: lowestRoadY });
      current = { x: sideAisleX, y: lowestRoadY };
    } else if (from.x < sideAisleX) {
      route.push({ x: sideAisleX, y: current.y });
      current = { x: sideAisleX, y: current.y };
    }

    if (Math.abs(current.y - spot.y) > 1) {
      const connectorX = this.getConnectorX(current.x, spot.x);
      if (Math.abs(current.x - connectorX) > 1) route.push({ x: connectorX, y: current.y });
      route.push({ x: connectorX, y: spot.y });
      current = { x: connectorX, y: spot.y };
    }

    if (Math.abs(current.x - spot.x) > 1 || Math.abs(current.y - spot.y) > 1) route.push(spot);
    return route;
  }

  getConnectorX(fromX, targetX) {
    const routeColumn = this.options.route.columns?.find((column) => (
      column.maxX == null || targetX <= column.maxX
    ));
    if (routeColumn) return this.getActiveConnectorX(routeColumn.connectorX);

    const connectors = this.options.route.connectorXs;
    if (!connectors?.length) return this.options.route.centerAisleX;
    const connectorX = connectors.reduce((closest, x) => (
      Math.abs(targetX - x) < Math.abs(targetX - closest) ? x : closest
    ), connectors[0]);
    return this.getActiveConnectorX(connectorX);
  }

  getActiveConnectorX(connectorX) {
    const routeSwitch = this.options.route.switches.find((item) => (
      item.originalConnectorX === connectorX && this.isRouteSwitchActive(item)
    ));
    return routeSwitch?.detourConnectorX ?? connectorX;
  }

  isRouteSwitchActive(routeSwitch) {
    return routeSwitch.blockingShelfIds.some((id) => {
      const shelf = this.getShelf(id);
      return shelf && this.state.unlockedZones.includes(shelf.zone);
    });
  }

  getSafePosition(position) {
    const blockingShelf = this.shelves.find((shelf) => {
      if (!shelf.blocker?.body?.enable) return false;
      const x = shelf.x;
      const y = shelf.y + this.options.blockerY;
      const halfWidth = this.options.blockerWidth / 2 + 17;
      const halfHeight = this.options.blockerHeight / 2 + 17;
      return Math.abs(position.x - x) < halfWidth && Math.abs(position.y - y) < halfHeight;
    });
    if (!blockingShelf) return null;
    return {
      x: this.getConnectorX(position.x, blockingShelf.x),
      y: position.y,
    };
  }

  getLowestRoadY() {
    return Math.max(...this.shelves.map((shelf) => shelf.customerSpot?.y ?? shelf.y + this.options.customerSpotY));
  }

  destroy() {
    EventBus.off(Events.UI_SHELF_SELECTED, this.onShelfSelected);
  }

  takeFromShelf(id, amount) {
    const shelf = this.shelves.find((item) => item.id === id);
    if (!shelf) return null;
    const current = this.state.shelves[id] ?? 0;
    const taken = Math.min(amount, current);
    this.state.shelves[id] = current - taken;
    this.updateLabel(shelf);
    this.checkAllStockEmpty();
    if (taken <= 0) return null;
    return {
      amount: taken,
      product: shelf.product,
      name: shelf.productMeta.name,
      value: shelf.productMeta.sellPrice * taken,
    };
  }

  getRandomStockedShelf() {
    const candidates = this.shelves.filter((shelf) => this.state.unlockedZones.includes(shelf.zone) && this.state.shelves[shelf.id] > 0);
    return Phaser.Utils.Array.GetRandom(candidates);
  }

  getNeedyShelf() {
    return this.shelves.find((shelf) => this.state.unlockedZones.includes(shelf.zone) && (this.state.shelves[shelf.id] ?? 0) < shelf.capacity);
  }

  getNearbyShelf(position, radius = 70) {
    return this.shelves.find((shelf) => {
      const unlocked = this.state.unlockedZones.includes(shelf.zone);
      return unlocked && Math.hypot(shelf.x - position.x, shelf.y - position.y) <= radius;
    });
  }

  hasAnyStock() {
    return this.shelves.some((shelf) => this.state.unlockedZones.includes(shelf.zone) && (this.state.shelves[shelf.id] ?? 0) > 0);
  }

  checkAllStockEmpty() {
    const hasStock = this.hasAnyStock();
    if (!hasStock && this.stockWasAvailable) {
      this.stockWasAvailable = false;
      EventBus.emit(Events.ALL_STOCK_EMPTY);
    }
  }
}

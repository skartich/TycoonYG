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
      embeddedProgressCropTop: 0,
      shelfImageRepairs: null,
      preserveShelfAspect: false,
      shelfImageY: 0,
      shelfImageHeight: null,
      showLockedPreviews: false,
      lockedPreviewAlpha: 0.3,
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
        entranceWaypoint: null,
        entranceWaypoints: null,
        lowestRoadY: null,
      },
      ...options,
      route: {
        sideAisleX: DEFAULT_SIDE_AISLE_X,
        centerAisleX: DEFAULT_CENTER_AISLE_X,
        connectorXs: [DEFAULT_SIDE_AISLE_X, DEFAULT_CENTER_AISLE_X],
        columns: null,
        switches: [],
        entranceThreshold: 80,
        entranceWaypoint: null,
        entranceWaypoints: null,
        lowestRoadY: null,
        ...(options.route ?? {}),
      },
    };
    this.productTypes = balance.get(this.options.productsPath);
    this.shelves = balance.get(this.options.shelvesPath).map((config) => ({
      ...config,
      ...(this.options.positions?.[config.id] ?? {}),
      productMeta: balance.get(`${this.options.productsPath}.${config.product}`),
      visual: null,
      preview: null,
      blocker: null,
      customerSpot: null,
      progressFill: null,
      progressText: null,
      selectedGlow: null,
    }));
    this.shelfIndicators = new Map();
    this.createVisuals();
    this.stockWasAvailable = this.hasAnyStock();
    this.onShelfSelected = (id) => this.setSelectedShelf(id);
    EventBus.on(Events.UI_SHELF_SELECTED, this.onShelfSelected);
  }

  createVisuals() {
    this.obstacles = this.scene.physics.add.staticGroup();
    this.shelves.forEach((shelf) => {
      if (this.isShelfPurchased(shelf)) this.activateShelf(shelf);
      else if (this.options.showLockedPreviews) this.createLockedPreview(shelf);
    });
  }

  createLockedPreview(shelf) {
    if (!shelf || shelf.preview) return shelf?.preview ?? null;
    const shelfKey = shelf.asset ?? `shelf-${shelf.product}`;
    shelf.preview = this.scene.add.container(shelf.x, shelf.y)
      .add(this.createShelfImage(shelfKey))
      .setAlpha(this.options.lockedPreviewAlpha)
      .setDepth(shelf.y + this.options.shelfHeight / 2 - 1);
    return shelf.preview;
  }

  activateShelf(shelf) {
    if (!shelf || shelf.visual) return shelf?.visual ?? null;
    shelf.preview?.destroy(true);
    shelf.preview = null;
    const visual = this.scene.add.container(shelf.x, shelf.y)
      .setDepth(shelf.y + this.options.shelfHeight / 2);
    const shelfKey = shelf.asset ?? `shelf-${shelf.product}`;
    const selectedGlow = this.scene.add.rectangle(0, 3, this.options.shelfWidth + 10, this.options.shelfHeight + 8, 0x62c6e8, 0.08)
      .setStrokeStyle(3, 0x62c6e8, 0.9)
      .setVisible(false);
    const shelfImage = this.createShelfImage(shelfKey);
    const indicator = this.createIndicator(shelf);
    visual.add([selectedGlow, shelfImage, ...indicator.objects]);
    shelf.progressFill = indicator.fill;
    shelf.progressColor = Number(shelf.productMeta.color);
    shelf.progressText = indicator.text;
    shelf.selectedGlow = selectedGlow;
    shelf.visual = visual;
    shelf.customerSpot = { x: shelf.x, y: shelf.y + this.options.customerSpotY };
    shelf.blocker = this.createBlocker(shelf);
    this.shelfIndicators.set(shelf.id, indicator);
    this.updateLabel(shelf);
    return visual;
  }

  createShelfImage(shelfKey) {
    let frame;
    const cropConfig = this.options.embeddedProgressCropTop;
    const cropTop = typeof cropConfig === 'object' ? (cropConfig[shelfKey] ?? 0) : cropConfig;
    const texture = this.scene.textures.get(shelfKey);
    const source = texture.getSourceImage();
    if (cropTop > 0) {
      const frameName = `shelf-content-${cropTop}`;
      if (!texture.frames[frameName]) {
        texture.add(frameName, 0, 0, cropTop, source.width, source.height - cropTop);
      }
      frame = frameName;
    }
    const contentWidth = source.width;
    const contentHeight = source.height - cropTop;
    const targetHeight = this.options.shelfImageHeight ?? this.options.shelfHeight;
    const scale = this.options.preserveShelfAspect
      ? Math.min(this.options.shelfWidth / contentWidth, targetHeight / contentHeight)
      : null;
    const displayWidth = scale == null ? this.options.shelfWidth : contentWidth * scale;
    const displayHeight = scale == null ? targetHeight : contentHeight * scale;
    const artwork = this.scene.add.container(0, this.options.shelfImageY);
    const repair = this.options.shelfImageRepairs?.[shelfKey];
    const repairWidth = repair?.mirrorRightEdgeWidth ?? 0;
    const repairDisplayWidth = repairWidth > 0 ? displayWidth * repairWidth / contentWidth : 0;
    const image = this.scene.add.image(repairDisplayWidth / 2, 0, shelfKey, frame)
      .setDisplaySize(displayWidth, displayHeight);
    artwork.add(image);

    if (repairWidth > 0) {
      const repairFrame = `shelf-edge-${cropTop}-${repairWidth}`;
      if (!texture.frames[repairFrame]) {
        texture.add(repairFrame, 0, source.width - repairWidth, cropTop, repairWidth, contentHeight);
      }
      const edge = this.scene.add.image(-displayWidth / 2, 0, shelfKey, repairFrame)
        .setDisplaySize(repairDisplayWidth, displayHeight)
        .setFlipX(true);
      artwork.add(edge);
    }
    return artwork;
  }

  createIndicator(shelf) {
    const existing = this.shelfIndicators.get(shelf.id);
    if (existing) return existing;
    const progressKey = shelf.progressAsset ?? `progress-${shelf.product}`;
    const frame = this.options.progressStyle === 'compact'
      ? this.createCompactProgressFrame()
      : this.scene.add.image(0, this.options.progressY, progressKey).setDisplaySize(this.options.progressWidth, this.options.progressHeight);
    const fill = this.scene.add.graphics();
    const text = this.scene.add.text(0, this.options.progressY + (this.options.progressStyle === 'compact' ? -1 : TEXT_Y), '', {
      fontSize: this.options.progressStyle === 'compact' ? '11px' : '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#111111',
      strokeThickness: 2,
      align: 'center',
    }).setOrigin(0.5);
    return { objects: [frame, fill, text], frame, fill, text };
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

  createBlocker(shelf) {
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
    this.shelves.forEach((shelf) => shelf.selectedGlow?.setVisible(shelf.id === id && this.isShelfActive(shelf)));
  }

  unlockZone(zoneId) {
    this.shelves.filter((shelf) => shelf.zone === zoneId).forEach((shelf) => {
      this.activateShelf(shelf);
    });
  }

  getShelfState(idOrShelf) {
    const shelf = typeof idOrShelf === 'string' ? this.getShelf(idOrShelf) : idOrShelf;
    if (!shelf || !this.state.unlockedZones.includes(shelf.zone)) return 'locked';
    return shelf.visual?.active && shelf.blocker?.body?.enable && shelf.customerSpot ? 'active' : 'purchased';
  }

  isShelfPurchased(shelf) {
    return this.getShelfState(shelf) !== 'locked';
  }

  isShelfActive(shelf) {
    return this.getShelfState(shelf) === 'active';
  }

  isShelfReachable(shelf) {
    return this.isShelfActive(shelf) && Boolean(shelf.customerSpot);
  }

  stockShelf(id, amount) {
    const shelf = this.shelves.find((item) => item.id === id);
    if (!this.isShelfActive(shelf)) return 0;
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
    if (!this.isShelfReachable(shelf)) return [];
    const spot = this.getCustomerSpot(shelf);
    const route = [];
    let current = { x: from.x, y: from.y };
    const lowestRoadY = this.getLowestRoadY();
    const sideAisleX = this.options.route.sideAisleX;

    if (from.y > lowestRoadY + this.options.route.entranceThreshold) {
      const entranceWaypoints = this.options.route.entranceWaypoints
        ?? (this.options.route.entranceWaypoint ? [this.options.route.entranceWaypoint] : []);
      entranceWaypoints.forEach((entranceWaypoint) => {
        if (Math.hypot(current.x - entranceWaypoint.x, current.y - entranceWaypoint.y) <= 1) return;
        route.push({ ...entranceWaypoint });
        current = { ...entranceWaypoint };
      });
      if (Math.abs(current.x - sideAisleX) > 1) route.push({ x: sideAisleX, y: current.y });
      if (Math.abs(current.y - lowestRoadY) > 1) route.push({ x: sideAisleX, y: lowestRoadY });
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
      return this.isShelfActive(shelf);
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
    if (this.options.route.lowestRoadY != null) return this.options.route.lowestRoadY;
    return Math.max(...this.shelves.map((shelf) => shelf.y + this.options.customerSpotY));
  }

  destroy() {
    EventBus.off(Events.UI_SHELF_SELECTED, this.onShelfSelected);
    this.shelfIndicators.forEach((indicator) => {
      indicator.objects.forEach((object) => object.destroy());
    });
    this.shelfIndicators.clear();
  }

  takeFromShelf(id, amount) {
    const shelf = this.shelves.find((item) => item.id === id);
    if (!this.isShelfActive(shelf)) return null;
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
    const candidates = this.shelves.filter((shelf) => this.isShelfReachable(shelf) && this.state.shelves[shelf.id] > 0);
    return Phaser.Utils.Array.GetRandom(candidates);
  }

  getNeedyShelf() {
    return this.shelves.find((shelf) => this.isShelfActive(shelf) && (this.state.shelves[shelf.id] ?? 0) < shelf.capacity);
  }

  getNearbyShelf(position, radius = 70) {
    return this.shelves.find((shelf) => {
      return this.isShelfActive(shelf) && Math.hypot(shelf.x - position.x, shelf.y - position.y) <= radius;
    });
  }

  hasAnyStock() {
    return this.shelves.some((shelf) => this.isShelfActive(shelf) && (this.state.shelves[shelf.id] ?? 0) > 0);
  }

  checkAllStockEmpty() {
    const hasStock = this.hasAnyStock();
    if (!hasStock && this.stockWasAvailable) {
      this.stockWasAvailable = false;
      EventBus.emit(Events.ALL_STOCK_EMPTY);
    }
  }
}

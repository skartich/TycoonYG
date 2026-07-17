import Phaser from 'phaser';
import { Player } from '../entities/Player.js';
import { MobileJoystick } from '../input/MobileJoystick.js';
import { PlayerController } from '../input/PlayerController.js';
import { AdService } from '../yandex/AdService.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { ShelfSystem } from '../systems/ShelfSystem.js';
import { CheckoutSystem } from '../systems/CheckoutSystem.js';
import { CustomerSystem } from '../systems/CustomerSystem.js';
import { ZoneSystem } from '../systems/ZoneSystem.js';
import { RestockSystem } from '../systems/RestockSystem.js';
import { BoostSystem } from '../systems/BoostSystem.js';
import { TeleportSystem } from '../systems/TeleportSystem.js';
import { EventBus, Events } from '../core/EventBus.js';
import { STATIONERY_LAYOUT } from '../config/StationeryLayout.js';
import { WaypointGraph } from '../navigation/WaypointGraph.js';

export class StationeryStoreScene extends Phaser.Scene {
  constructor() {
    super('StationeryStoreScene');
  }

  create() {
    this.layout = STATIONERY_LAYOUT;
    this.balance = this.registry.get('balance');
    this.saveManager = this.registry.get('saveManager');
    this.state = this.saveManager.load();
    this.panelOpen = true;
    const { world } = this.layout;
    this.physics.world.setBounds(world.x, world.y, world.width, world.height);
    this.drawWorld();

    this.economy = new EconomySystem(this.state, this.balance);
    this.adService = new AdService(this.registry.get('yandex'), this.balance, this.economy, this.state);
    this.shelves = new ShelfSystem(this, this.state, this.balance, {
      shelvesPath: 'stationeryShelves',
      positions: this.layout.shelf.positions,
      shelfWidth: this.layout.shelf.width,
      shelfHeight: this.layout.shelf.height,
      progressWidth: this.layout.shelf.progressWidth,
      progressHeight: this.layout.shelf.progressHeight,
      progressY: this.layout.shelf.progressY,
      progressStyle: 'compact',
      embeddedProgressCropTop: this.layout.shelf.contentCropTops,
      shelfImageRepairs: this.layout.shelf.imageRepairs,
      preserveShelfAspect: true,
      shelfImageY: 8,
      shelfImageHeight: 98,
      blockerWidth: this.layout.shelf.blockerWidth,
      blockerHeight: this.layout.shelf.blockerHeight,
      blockerY: this.layout.shelf.blockerY,
      customerSpotY: this.layout.shelf.customerSpotY,
      route: {
        sideAisleX: this.layout.aisles.sideX,
        centerAisleX: this.layout.aisles.connectorXs[1],
        connectorXs: this.layout.aisles.connectorXs,
        columns: this.layout.aisles.columns,
        switches: this.layout.aisles.switches,
        entranceThreshold: 30,
        entranceWaypoints: [this.layout.entranceWaypoint, this.layout.entranceRoadWaypoint],
        lowestRoadY: this.layout.aisles.rowYs[2],
      },
    });
    this.checkout = new CheckoutSystem(this, this.state, this.economy, {
      imageKey: 'stationery-checkout',
      displayWidth: this.layout.checkout.displayWidth,
      displayHeight: this.layout.checkout.displayHeight,
      textureCrop: this.layout.checkout.textureCrop,
      terminalPositions: this.layout.checkout.terminalPositions,
      terminalSpots: this.layout.checkout.terminalSpots,
      sideLaneX: this.layout.checkout.sideLaneX,
      waitingStartY: this.layout.checkout.waitingStartY,
      waitingStepY: this.layout.checkout.waitingStepY,
      laneMinY: this.layout.aisles.rowYs[0],
      laneMaxY: this.layout.entrance.y,
      entrancePoint: this.layout.entranceWaypoint,
      exitRoute: [
        this.layout.entranceRoadWaypoint,
        this.layout.entranceWaypoint,
        this.layout.customerSpawn,
      ],
    });
    this.player = new Player(this, this.layout.playerSpawn.x, this.layout.playerSpawn.y, this.economy.stats);
    this.physics.add.collider(this.player.sprite, this.shelves.obstacles);
    this.physics.add.collider(this.player.sprite, this.checkout.obstacles);
    this.physics.add.collider(this.player.sprite, this.environmentObstacles);
    this.teleports = new TeleportSystem(this, this.player.sprite, [
      {
        ...this.layout.entrance,
        width: 196,
        height: 34,
        targetScene: 'StreetScene',
        stopScenes: ['UIScene'],
      },
    ]);
    this.joystick = new MobileJoystick(this, {
      x: 84,
      bottom: 82,
      onModeChange: () => this.reflowStationeryLayout(),
    });
    this.controller = new PlayerController(this, this.joystick);

    this.boosts = new BoostSystem(this.state, this.economy);
    this.systems = {
      shelves: this.shelves,
      checkout: this.checkout,
      economy: this.economy,
      boosts: this.boosts,
      environmentObstacles: this.environmentObstacles,
    };
    this.systems.refreshNavigation = () => {
      this.rebuildStationeryNavigation();
      return this.validateStationeryNavigation();
    };
    this.zones = new ZoneSystem(this, this.state, this.balance, this.economy, this.shelves, {
      zonesPath: 'stationeryZones',
      rects: this.layout.zones.rects,
      showLabels: false,
      zoneDepth: 0,
      visualStyle: {
        unlockedColor: 0xf5f7ee,
        unlockedAlpha: 0.08,
        unlockedStroke: 0xcbd3c5,
        lockedColor: 0xd9ddd5,
        lockedAlpha: 0.16,
        lockedStroke: 0xb7beb6,
        strokeWidth: 1,
      },
    });
    this.createDepartmentSigns();
    this.restock = new RestockSystem(this.state, this.balance, this.economy, this.shelves, this.zones, {
      zonesPath: 'stationeryZones',
    });
    this.rebuildStationeryNavigation();
    this.customers = new CustomerSystem(this, this.balance, this.systems, {
      spawnPoint: this.layout.customerSpawn,
      spawnEnabled: false,
      autoRefreshRoutes: false,
      minSpawnDistance: 34,
    });
    this.systems.customers = this.customers;
    this.customers.setSpawnEnabled(this.validateStationeryNavigation());
    this.onRoutesChanged = () => {
      this.rebuildStationeryNavigation();
      this.customers.setSpawnEnabled(this.validateStationeryNavigation());
      this.customers.refreshActiveRoutes();
    };
    this.onPanelToggled = ({ open }) => {
      this.panelOpen = open;
      this.reflowStationeryLayout();
    };
    EventBus.on(Events.ROUTES_CHANGED, this.onRoutesChanged);
    EventBus.on(Events.UI_PANEL_TOGGLED, this.onPanelToggled);
    this.scale.on('resize', this.reflowStationeryLayout, this);
    this.reflowStationeryLayout();
    this.scene.launch('UIScene', {
      state: this.state,
      balance: this.balance,
      shelves: this.shelves.shelves,
      zones: this.balance.get('stationeryZones'),
      boosts: this.boosts,
      ui: {
        gameAreaWidth: this.layout.sidePanel.x,
        panelWidth: this.layout.sidePanel.width,
        theme: 'stationery',
        collapsible: true,
      },
    });

    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.saveManager.save(this.state) });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.saveManager.save(this.state);
      this.scale.off('resize', this.reflowStationeryLayout, this);
      this.joystick?.destroy();
      this.customers?.destroy();
      this.restock?.destroy();
      this.zones?.destroy();
      this.shelves?.destroy();
      this.boosts?.destroy();
      this.adService?.destroy();
      EventBus.off(Events.ROUTES_CHANGED, this.onRoutesChanged);
      EventBus.off(Events.UI_PANEL_TOGGLED, this.onPanelToggled);
    });
  }

  reflowStationeryLayout() {
    if (!this.layout) return;
    const { viewport, sidePanel, canvas, world } = this.layout;
    const viewportWidth = this.panelOpen ? viewport.width : canvas.width - sidePanel.collapsedWidth;
    this.cameras.main.stopFollow();
    this.cameras.main.setViewport(viewport.x, viewport.y, viewportWidth, viewport.height);
    this.cameras.main.setBounds(world.x, world.y, world.width, world.height);
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setBackgroundColor('#d9e1d3');
    if (this.shelves && this.checkout) {
      this.rebuildStationeryNavigation();
      const navigationReady = this.validateStationeryNavigation();
      this.customers?.setSpawnEnabled(navigationReady);
      this.customers?.refreshActiveRoutes();
    }
  }

  drawWorld() {
    const { room, world, entrance } = this.layout;
    this.environmentObstacles = this.physics.add.staticGroup();
    this.add.rectangle(world.width / 2, world.height / 2, world.width, world.height, 0xd9c9a5).setDepth(-10);
    this.add.rectangle(room.x + room.width / 2 + 5, room.y + room.height / 2 + 7, room.width, room.height, 0x000000, 0.2).setDepth(-9);
    this.add.rectangle(room.x + room.width / 2, room.y + room.height / 2, room.width, room.height, 0xe9ede2).setDepth(-8);
    this.add.grid(
      room.x + room.width / 2,
      room.y + room.height / 2,
      room.width - 16,
      room.height - 16,
      32,
      32,
      0xffffff,
      0.13,
      0xc6cec0,
      0.34,
    ).setDepth(-7);
    this.add.rectangle(room.x + room.width / 2, room.y + room.height / 2, room.width, room.height, 0x000000, 0)
      .setStrokeStyle(4, 0x8d988d, 1)
      .setDepth(-6);
    this.add.rectangle(room.x + room.width / 2, room.y + 12, room.width - 8, 24, 0xb7bdb3, 0.95)
      .setStrokeStyle(2, 0x7f8981, 0.8)
      .setDepth(-5);
    this.add.rectangle(room.x + room.width / 2, room.y + room.height - 9, room.width - 8, 18, 0xabb5ab, 0.9)
      .setDepth(-5);

    this.drawWallFrames();
    this.drawDecorations();
    this.drawEntrance(entrance);
  }

  drawWallFrames() {
    [120, 920].forEach((x, index) => {
      const frame = this.add.graphics().setDepth(-3);
      frame.fillStyle(0xf7f3e8, 1);
      frame.fillRoundedRect(x - 22, 26, 44, 28, 2);
      frame.lineStyle(2, 0x8b7b62, 1);
      frame.strokeRoundedRect(x - 22, 26, 44, 28, 2);
      frame.fillStyle(index === 0 ? 0x73b5d3 : 0xe8a26f, 0.75);
      frame.fillRect(x - 14, 34, 28, 10);
    });
  }

  drawDecorations() {
    this.drawPlant(46, 82, 0.8);
    this.drawPlant(958, 568, 0.72);

    const boxes = this.add.graphics().setDepth(565);
    boxes.fillStyle(0xc89455, 1).fillRect(27, 548, 34, 24);
    boxes.lineStyle(2, 0x8a6038, 1).strokeRect(27, 548, 34, 24);
    boxes.fillStyle(0xd9ac6d, 1).fillRect(42, 530, 29, 22);
    boxes.lineStyle(2, 0x8a6038, 1).strokeRect(42, 530, 29, 22);
    boxes.lineStyle(2, 0x9b6c3e, 0.8).lineBetween(56, 530, 56, 552);

    const trash = this.add.graphics().setDepth(600);
    trash.fillStyle(0x53645c, 1).fillRoundedRect(900, 548, 25, 36, 4);
    trash.lineStyle(2, 0x29352f, 1).strokeRoundedRect(900, 548, 25, 36, 4);
    trash.fillStyle(0x35443d, 1).fillRoundedRect(897, 545, 31, 7, 3);

    const stand = this.add.container(955, 112).setDepth(150);
    const standShadow = this.add.ellipse(0, 29, 34, 10, 0x000000, 0.13);
    const board = this.add.rectangle(0, 0, 34, 48, 0xf4efe0, 1).setStrokeStyle(2, 0x6d776f, 1);
    const boardAccent = this.add.rectangle(0, -12, 22, 5, 0x55c7ee, 1);
    const boardLines = this.add.graphics().lineStyle(2, 0x8a968e, 0.8);
    boardLines.lineBetween(-10, -2, 10, -2).lineBetween(-10, 6, 7, 6).lineBetween(-10, 14, 10, 14);
    stand.add([standShadow, board, boardAccent, boardLines]);
  }

  drawPlant(x, y, scale) {
    const plant = this.add.container(x, y).setDepth(y + 28).setScale(scale);
    const shadow = this.add.ellipse(0, 24, 44, 15, 0x000000, 0.15);
    const pot = this.add.graphics();
    pot.fillStyle(0xb66d42, 1).fillRoundedRect(-15, 10, 30, 28, 5);
    pot.lineStyle(2, 0x70422c, 1).strokeRoundedRect(-15, 10, 30, 28, 5);
    pot.fillStyle(0x7d4a31, 1).fillRoundedRect(-18, 7, 36, 8, 3);
    const leaves = this.add.graphics();
    leaves.fillStyle(0x3f7f45, 1);
    [[-12, -7], [0, -15], [13, -7], [-8, 2], [8, 1], [0, -1]].forEach(([leafX, leafY], index) => {
      leaves.fillEllipse(leafX, leafY, index % 2 ? 16 : 19, 29);
    });
    leaves.fillStyle(0x76a84e, 0.85).fillEllipse(-5, -12, 8, 18);
    plant.add([shadow, pot, leaves]);
    return plant;
  }

  drawEntrance(entrance) {
    const platform = this.add.graphics().setDepth(0.6);
    platform.fillStyle(0xd7ddd5, 1).fillRoundedRect(entrance.x - 146, entrance.y - 48, 292, 92, 5);
    platform.lineStyle(2, 0x87948d, 0.85).strokeRoundedRect(entrance.x - 146, entrance.y - 48, 292, 92, 5);
    platform.fillStyle(0x7e8983, 1).fillRect(entrance.x - 146, entrance.y + 38, 292, 8);

    const texture = this.textures.get('stationery-entrance');
    const frameName = 'stationery-entrance-core';
    if (!texture.frames[frameName]) texture.add(frameName, 0, 194, 20, 354, 170);
    this.add.image(entrance.x, entrance.y, 'stationery-entrance', frameName)
      .setDisplaySize(entrance.width, entrance.height)
      .setDepth(2);

    const barriers = this.add.graphics().setDepth(entrance.y + 20);
    barriers.fillStyle(0x303735, 1);
    barriers.fillRoundedRect(entrance.x - 130, entrance.y - 15, 17, 58, 4);
    barriers.fillRoundedRect(entrance.x + 113, entrance.y - 15, 17, 58, 4);
    barriers.lineStyle(2, 0x161b1a, 1);
    barriers.strokeRoundedRect(entrance.x - 130, entrance.y - 15, 17, 58, 4);
    barriers.strokeRoundedRect(entrance.x + 113, entrance.y - 15, 17, 58, 4);
    barriers.fillStyle(0x65716c, 0.9);
    barriers.fillRect(entrance.x - 126, entrance.y - 10, 4, 43);
    barriers.fillRect(entrance.x + 118, entrance.y - 10, 4, 43);

    this.add.rectangle(entrance.x, entrance.y + 38, 156, 24, 0x26352f, 0.97)
      .setStrokeStyle(2, 0x70857a, 1)
      .setDepth(entrance.y + 28);
    this.add.text(entrance.x, entrance.y + 38, 'ВХОД / ВЫХОД', {
      fontSize: '13px', color: '#f4ead0', fontStyle: 'bold', stroke: '#121a17', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(entrance.y + 29);

    this.drawPlant(entrance.x - 147, entrance.y + 12, 0.62);
    this.drawPlant(entrance.x + 147, entrance.y + 12, 0.62);
    this.addEnvironmentBlocker(entrance.x - 122, entrance.y + 14, 17, 42);
    this.addEnvironmentBlocker(entrance.x + 122, entrance.y + 14, 17, 42);
    this.addEnvironmentBlocker(entrance.x - 147, entrance.y + 24, 26, 24);
    this.addEnvironmentBlocker(entrance.x + 147, entrance.y + 24, 26, 24);
  }

  addEnvironmentBlocker(x, y, width, height) {
    const blocker = this.add.rectangle(x, y, width, height, 0x000000, 0);
    this.environmentObstacles.add(blocker);
    blocker.body.setSize(width, height);
    blocker.body.updateFromGameObject();
    return blocker;
  }

  createDepartmentSigns() {
    this.layout.departmentSigns.forEach((sign) => {
      const panel = this.add.rectangle(sign.x, sign.y, 116, 25, 0xf5f1e5, 0.96)
        .setStrokeStyle(2, 0x87928a, 0.9)
        .setDepth(900);
      const text = this.add.text(sign.x, sign.y, sign.text, {
        fontSize: '13px', color: '#33433b', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(901);
      panel.setData('label', text);
    });
  }

  drawCustomerRoads() {
    this.customerRoadGraphics?.forEach((graphic) => graphic.destroy());
    const { aisles, checkout, entranceWaypoint, entranceRoadWaypoint, customerSpawn } = this.layout;
    const roadGraphics = this.add.graphics().setDepth(1);
    const markGraphics = this.add.graphics().setDepth(1.1);
    this.customerRoadGraphics = [roadGraphics, markGraphics];
    const activeConnectors = aisles.connectorXs.map((x) => this.getActiveStationeryConnectorX(x));
    const roadSegments = [
      ...aisles.rowYs.map((y) => ({ x1: aisles.sideX, y1: y, x2: aisles.endX, y2: y })),
      { x1: aisles.sideX, y1: aisles.rowYs[0], x2: aisles.sideX, y2: aisles.rowYs[2] },
      { x1: activeConnectors[1], y1: aisles.rowYs[0], x2: activeConnectors[1], y2: aisles.rowYs[2] },
      { x1: activeConnectors[2], y1: aisles.rowYs[0], x2: activeConnectors[2], y2: aisles.rowYs[2] },
      { x1: entranceRoadWaypoint.x, y1: entranceRoadWaypoint.y, x2: entranceWaypoint.x, y2: entranceWaypoint.y },
      { x1: entranceWaypoint.x, y1: entranceWaypoint.y, x2: customerSpawn.x, y2: customerSpawn.y },
      ...checkout.terminalSpots.map((spot) => ({ x1: spot.x, y1: spot.y, x2: aisles.sideX, y2: spot.y })),
    ];
    const joints = [
      ...aisles.rowYs.flatMap((y) => activeConnectors.map((x) => ({ x, y }))),
      ...aisles.rowYs.map((y) => ({ x: aisles.endX, y })),
      ...checkout.terminalSpots.map((spot) => ({ x: aisles.sideX, y: spot.y })),
      entranceRoadWaypoint,
      entranceWaypoint,
      customerSpawn,
    ];

    const drawNetwork = (width, color, alpha) => {
      roadGraphics.lineStyle(width, color, alpha);
      roadSegments.forEach((segment) => {
        roadGraphics.beginPath();
        roadGraphics.moveTo(segment.x1, segment.y1);
        roadGraphics.lineTo(segment.x2, segment.y2);
        roadGraphics.strokePath();
      });
      roadGraphics.fillStyle(color, alpha);
      joints.forEach((point) => roadGraphics.fillCircle(point.x, point.y, width / 2));
    };

    drawNetwork(aisles.roadWidth + 6, 0xaebcb7, 0.82);
    drawNetwork(aisles.roadWidth, 0xdce5e2, 0.94);
    markGraphics.fillStyle(0xffffff, 0.72);
    roadSegments.forEach((segment) => this.drawDashedSegment(markGraphics, segment, joints));
  }

  drawDashedSegment(graphics, segment, joints) {
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const length = Math.hypot(dx, dy);
    if (length < 18) return;
    const ux = dx / length;
    const uy = dy / length;
    for (let distance = 24; distance < length - 12; distance += 34) {
      const x = segment.x1 + ux * distance;
      const y = segment.y1 + uy * distance;
      if (joints.some((joint) => Math.hypot(joint.x - x, joint.y - y) < 18)) continue;
      if (Math.abs(dx) >= Math.abs(dy)) graphics.fillRoundedRect(x - 7, y - 1.2, 14, 2.4, 1.2);
      else graphics.fillRoundedRect(x - 1.2, y - 7, 2.4, 14, 1.2);
    }
  }

  getActiveStationeryConnectorX(connectorX) {
    const routeSwitch = this.layout.aisles.switches.find((item) => (
      item.originalConnectorX === connectorX && item.blockingShelfIds.some((id) => {
        const shelf = this.shelves?.getShelf(id);
        return this.shelves.isShelfActive(shelf);
      })
    ));
    return routeSwitch?.detourConnectorX ?? connectorX;
  }

  rebuildStationeryNavigation() {
    if (!this.shelves || !this.checkout || !this.systems) return;
    this.drawCustomerRoads();
    const { aisles, checkout, entranceWaypoint, entranceRoadWaypoint, customerSpawn } = this.layout;
    const graph = new WaypointGraph();
    graph.addNode('spawn', customerSpawn.x, customerSpawn.y, 'spawn');
    graph.addNode('entrance', entranceWaypoint.x, entranceWaypoint.y, 'entrance');
    graph.addNode('entrance-road', entranceRoadWaypoint.x, entranceRoadWaypoint.y, 'road');
    graph.connect('spawn', 'entrance');
    graph.connect('entrance', 'entrance-road');

    const sideYs = [...new Set([
      ...aisles.rowYs,
      ...checkout.terminalSpots.map((spot) => spot.y),
      checkout.waitingStartY,
    ])].sort((a, b) => a - b);
    sideYs.forEach((y) => graph.addNode(`side:${y}`, aisles.sideX, y));
    sideYs.slice(1).forEach((y, index) => graph.connect(`side:${sideYs[index]}`, `side:${y}`));

    const activeConnectors = aisles.connectorXs.map((x) => this.getActiveStationeryConnectorX(x));
    aisles.rowYs.forEach((y, rowIndex) => {
      const shelfXs = this.shelves.shelves
        .filter((shelf) => this.shelves.isShelfActive(shelf) && shelf.customerSpot?.y === y)
        .map((shelf) => shelf.customerSpot.x);
      const entranceXs = y === entranceRoadWaypoint.y ? [entranceRoadWaypoint.x] : [];
      const rowXs = [...new Set([aisles.sideX, ...activeConnectors, aisles.endX, ...shelfXs, ...entranceXs])].sort((a, b) => a - b);
      rowXs.forEach((x) => graph.addNode(`row:${rowIndex}:${x}`, x, y));
      rowXs.slice(1).forEach((x, index) => graph.connect(`row:${rowIndex}:${rowXs[index]}`, `row:${rowIndex}:${x}`));
      graph.connect(`side:${y}`, `row:${rowIndex}:${aisles.sideX}`);
      if (y === entranceRoadWaypoint.y) graph.connect('entrance-road', `row:${rowIndex}:${entranceRoadWaypoint.x}`);
    });

    activeConnectors.slice(1).forEach((x) => {
      aisles.rowYs.slice(1).forEach((_y, rowIndex) => {
        graph.connect(`row:${rowIndex}:${x}`, `row:${rowIndex + 1}:${x}`);
      });
    });

    this.shelves.shelves.filter((shelf) => this.shelves.isShelfActive(shelf)).forEach((shelf) => {
      const rowIndex = aisles.rowYs.indexOf(shelf.customerSpot.y);
      const serviceId = `shelf:${shelf.id}`;
      graph.addNode(serviceId, shelf.customerSpot.x, shelf.customerSpot.y, 'service');
      graph.connect(serviceId, `row:${rowIndex}:${shelf.customerSpot.x}`);
      shelf.navigationNodeId = serviceId;
    });

    checkout.terminalSpots.forEach((spot, index) => {
      const checkoutId = `checkout:${index}`;
      graph.addNode(checkoutId, spot.x, spot.y, 'checkout');
      graph.connect(checkoutId, `side:${spot.y}`);
    });

    this.navigationGraph = graph;
    this.systems.navigationGraph = graph;
    this.drawNavigationDebug();
  }

  validateStationeryNavigation() {
    if (!this.navigationGraph) return false;
    const issues = [];
    this.shelves.shelves.filter((shelf) => this.shelves.isShelfActive(shelf)).forEach((shelf) => {
      const serviceId = `shelf:${shelf.id}`;
      if (!this.navigationGraph.hasPath('entrance', serviceId)) issues.push(`${shelf.id}:entrance`);
      if (!this.navigationGraph.hasPath(serviceId, 'checkout:0')) issues.push(`${shelf.id}:checkout`);
    });
    if (!this.navigationGraph.hasPath('checkout:0', 'entrance')) issues.push('checkout:exit');
    this.navigationIssues = issues;
    return issues.length === 0;
  }

  drawNavigationDebug() {
    this.navigationDebugGraphics?.destroy();
    this.navigationDebugGraphics = null;
    if (!this.layout.debugNavigation || !this.navigationGraph) return;
    const graphics = this.add.graphics().setDepth(5000);
    graphics.lineStyle(2, 0x35d07f, 0.9);
    this.navigationGraph.getConnections().forEach(([from, to]) => graphics.lineBetween(from.x, from.y, to.x, to.y));
    graphics.lineStyle(2, 0xee5a63, 0.9);
    this.layout.aisles.switches.filter((routeSwitch) => (
      this.shelves.isRouteSwitchActive(routeSwitch)
    )).forEach((routeSwitch) => {
      graphics.lineBetween(
        routeSwitch.originalConnectorX,
        this.layout.aisles.rowYs[0],
        routeSwitch.originalConnectorX,
        this.layout.aisles.rowYs[2],
      );
    });
    this.shelves.shelves.filter((shelf) => this.shelves.isShelfActive(shelf)).forEach((shelf) => {
      graphics.strokeRect(
        shelf.x - this.layout.shelf.blockerWidth / 2,
        shelf.y + this.layout.shelf.blockerY - this.layout.shelf.blockerHeight / 2,
        this.layout.shelf.blockerWidth,
        this.layout.shelf.blockerHeight,
      );
    });
    this.navigationGraph.nodes.forEach((node) => {
      const color = node.kind === 'spawn' ? 0x3da5ff : node.kind === 'service' ? 0xffd65a : 0x35d07f;
      graphics.fillStyle(color, 1).fillCircle(node.x, node.y, 4);
    });
    this.navigationDebugGraphics = graphics;
  }

  update(_time, delta) {
    this.player.update(this.controller);
    this.customers.update(delta);
    this.checkout.update(delta);
  }
}

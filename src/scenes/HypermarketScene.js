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
import { HYPERMARKET_LAYOUT } from '../config/HypermarketLayout.js';
import { WaypointGraph } from '../navigation/WaypointGraph.js';

export class HypermarketScene extends Phaser.Scene {
  constructor() {
    super('HypermarketScene');
  }

  create() {
    this.layout = HYPERMARKET_LAYOUT;
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
      shelvesPath: 'hypermarketShelves',
      positions: this.layout.shelf.positions,
      shelfWidth: this.layout.shelf.width,
      shelfHeight: this.layout.shelf.height,
      progressWidth: this.layout.shelf.progressWidth,
      progressHeight: this.layout.shelf.progressHeight,
      progressY: this.layout.shelf.progressY,
      progressStyle: 'compact',
      preserveShelfAspect: true,
      shelfImageY: this.layout.shelf.imageY,
      shelfImageHeight: this.layout.shelf.imageHeight,
      showLockedPreviews: true,
      lockedPreviewAlpha: 0.28,
      blockerWidth: this.layout.shelf.blockerWidth,
      blockerHeight: this.layout.shelf.blockerHeight,
      blockerY: this.layout.shelf.blockerY,
      customerSpotY: this.layout.shelf.customerSpotY,
      route: {
        sideAisleX: this.layout.aisles.sideX,
        centerAisleX: this.layout.aisles.connectorXs[1],
        connectorXs: this.layout.aisles.connectorXs,
        columns: this.layout.aisles.columns,
        entranceThreshold: 30,
        entranceWaypoints: [this.layout.entranceWaypoint, this.layout.entranceRoadWaypoint],
        lowestRoadY: this.layout.aisles.rowYs.at(-1),
      },
    });
    this.checkout = new CheckoutSystem(this, this.state, this.economy, {
      imageKey: 'hypermarket-checkout',
      displayWidth: this.layout.checkout.displayWidth,
      displayHeight: this.layout.checkout.displayHeight,
      blockerWidth: this.layout.checkout.blockerWidth,
      blockerHeight: this.layout.checkout.blockerHeight,
      blockerY: this.layout.checkout.blockerY,
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
    this.drawQueueRails();

    this.player = new Player(this, this.layout.playerSpawn.x, this.layout.playerSpawn.y, this.economy.stats);
    this.physics.add.collider(this.player.sprite, this.shelves.obstacles);
    this.physics.add.collider(this.player.sprite, this.checkout.obstacles);
    this.physics.add.collider(this.player.sprite, this.environmentObstacles);
    this.teleports = new TeleportSystem(this, this.player.sprite, [{
      ...this.layout.teleport,
      targetScene: 'StreetScene',
      stopScenes: ['UIScene'],
    }]);
    this.joystick = new MobileJoystick(this, {
      x: 84,
      bottom: 82,
      onModeChange: () => this.reflowHypermarketLayout(),
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
      this.rebuildHypermarketNavigation();
      return this.validateHypermarketNavigation();
    };

    this.zones = new ZoneSystem(this, this.state, this.balance, this.economy, this.shelves, {
      zonesPath: 'hypermarketZones',
      rects: this.layout.zones.rects,
      showLabels: false,
      zoneDepth: 0,
      visualStyle: {
        unlockedColor: 0xf5f7ee,
        unlockedAlpha: 0.05,
        unlockedStroke: 0xcbd3c5,
        lockedColor: 0xd9ddd5,
        lockedAlpha: 0.18,
        lockedStroke: 0xaeb7ae,
        strokeWidth: 1,
      },
    });
    this.restock = new RestockSystem(this.state, this.balance, this.economy, this.shelves, this.zones, {
      zonesPath: 'hypermarketZones',
    });
    this.rebuildHypermarketNavigation();
    this.customers = new CustomerSystem(this, this.balance, this.systems, {
      spawnPoint: this.layout.customerSpawn,
      spawnEnabled: false,
      autoRefreshRoutes: false,
      minSpawnDistance: 34,
      customer: {
        frontTexture: 'grocery-customer-robot',
        backTexture: 'grocery-customer-robot',
        displayWidth: 46,
        displayHeight: 46,
        bodyWidth: 24,
        bodyHeight: 22,
      },
    });
    this.systems.customers = this.customers;
    this.customers.setSpawnEnabled(this.validateHypermarketNavigation());

    this.onRoutesChanged = () => {
      this.rebuildHypermarketNavigation();
      this.customers.setSpawnEnabled(this.validateHypermarketNavigation());
      this.customers.refreshActiveRoutes();
    };
    this.onPanelToggled = ({ open }) => {
      this.panelOpen = open;
      this.reflowHypermarketLayout();
    };
    EventBus.on(Events.ROUTES_CHANGED, this.onRoutesChanged);
    EventBus.on(Events.UI_PANEL_TOGGLED, this.onPanelToggled);
    this.scale.on('resize', this.reflowHypermarketLayout, this);
    this.reflowHypermarketLayout();

    this.scene.launch('UIScene', {
      state: this.state,
      balance: this.balance,
      shelves: this.shelves.shelves,
      zones: this.balance.get('hypermarketZones'),
      boosts: this.boosts,
      ui: {
        gameAreaWidth: this.layout.sidePanel.x,
        panelWidth: this.layout.sidePanel.width,
        theme: 'hypermarket',
        collapsible: true,
        groupedShelves: true,
        scrollableShelves: true,
      },
    });

    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.saveManager.save(this.state) });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.saveManager.save(this.state);
      this.scale.off('resize', this.reflowHypermarketLayout, this);
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

  reflowHypermarketLayout() {
    if (!this.layout) return;
    const { viewport, sidePanel, canvas, world } = this.layout;
    const viewportWidth = this.panelOpen ? viewport.width : canvas.width - sidePanel.collapsedWidth;
    this.cameras.main.stopFollow();
    this.cameras.main.setViewport(viewport.x, viewport.y, viewportWidth, viewport.height);
    this.cameras.main.setBounds(world.x, world.y, world.width, world.height);
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setBackgroundColor('#dbe3da');
    if (this.shelves && this.checkout) {
      this.rebuildHypermarketNavigation();
      const navigationReady = this.validateHypermarketNavigation();
      this.customers?.setSpawnEnabled(navigationReady);
      this.customers?.refreshActiveRoutes();
    }
  }

  drawWorld() {
    const { room, world, walls } = this.layout;
    this.environmentObstacles = this.physics.add.staticGroup();
    this.add.rectangle(world.width / 2, world.height / 2, world.width, world.height, 0xd9c7a1).setDepth(-10);
    this.add.rectangle(room.x + room.width / 2 + 5, room.y + room.height / 2 + 7, room.width, room.height, 0x000000, 0.18).setDepth(-9);
    this.add.rectangle(room.x + room.width / 2, room.y + room.height / 2, room.width, room.height, 0xe9eee5).setDepth(-8);
    this.add.tileSprite(
      room.x + room.width / 2,
      room.y + room.height / 2,
      room.width - 18,
      room.height - 18,
      'hypermarket-floor-tile',
    ).setAlpha(0.42).setDepth(-7);
    this.add.rectangle(room.x + room.width / 2, room.y + room.height / 2, room.width, room.height, 0x000000, 0)
      .setStrokeStyle(4, 0x84918a, 1)
      .setDepth(-6);

    Object.values(walls).forEach((wall) => this.drawWall(wall));
    this.drawDecorations();
    this.drawPromoIslands();
    this.drawEntrance();
  }

  drawWall(wall) {
    this.add.rectangle(wall.x, wall.y, wall.width, wall.height, 0xaeb8b0, 1)
      .setStrokeStyle(2, 0x78857e, 0.9)
      .setDepth(-4);
    this.addEnvironmentBlocker(wall.x, wall.y, wall.width, wall.height);
  }

  drawDecorations() {
    const { decorations } = this.layout;
    decorations.wallPlants.forEach((position) => {
      this.add.image(position.x, position.y, 'hypermarket-plant')
        .setDisplaySize(34, 52)
        .setDepth(position.y + 25);
      this.addEnvironmentBlocker(position.x, position.y + 14, 24, 24);
    });
    this.add.image(decorations.trash.x, decorations.trash.y, 'hypermarket-trash-bin')
      .setDisplaySize(30, 45)
      .setDepth(decorations.trash.y + 22);
    this.addEnvironmentBlocker(decorations.trash.x, decorations.trash.y + 10, 24, 24);
  }

  drawPromoIslands() {
    this.layout.promoIslands.forEach((island) => {
      this.add.image(island.x, island.y, island.asset)
        .setDisplaySize(island.width, island.height)
        .setDepth(island.y + island.height / 2);
      this.addEnvironmentBlocker(island.x, island.y + 17, island.width - 14, 24);
    });
  }

  drawEntrance() {
    const { entrance, decorations } = this.layout;
    this.add.image(entrance.x, entrance.y, 'hypermarket-entrance')
      .setDisplaySize(entrance.width, entrance.height)
      .setDepth(2);
    decorations.entranceTopiaries.forEach((position) => {
      this.add.image(position.x, position.y, 'hypermarket-topiary')
        .setDisplaySize(52, 67)
        .setDepth(position.y + 30);
      this.addEnvironmentBlocker(position.x, position.y + 17, 30, 28);
    });
    decorations.entranceBollards.forEach((position) => {
      this.add.image(position.x, position.y, 'hypermarket-entrance-bollard')
        .setDisplaySize(20, 55)
        .setDepth(position.y + 26);
      this.addEnvironmentBlocker(position.x, position.y + 10, 14, 34);
    });
  }

  drawQueueRails() {
    this.layout.checkout.terminalPositions.forEach((terminal) => {
      this.add.image(154, terminal.y + 4, 'hypermarket-queue-rope')
        .setDisplaySize(58, 42)
        .setDepth(terminal.y + 34);
    });
  }

  addEnvironmentBlocker(x, y, width, height) {
    const blocker = this.add.rectangle(x, y, width, height, 0x000000, 0);
    this.environmentObstacles.add(blocker);
    blocker.body.setSize(width, height);
    blocker.body.updateFromGameObject();
    return blocker;
  }

  drawCustomerRoads() {
    this.customerRoadGraphics?.forEach((graphic) => graphic.destroy());
    const { aisles, checkout, entranceWaypoint, entranceRoadWaypoint, customerSpawn } = this.layout;
    const roadGraphics = this.add.graphics().setDepth(1);
    const markGraphics = this.add.graphics().setDepth(1.1);
    this.customerRoadGraphics = [roadGraphics, markGraphics];
    const roadSegments = [
      ...aisles.rowYs.map((y) => ({ x1: aisles.sideX, y1: y, x2: aisles.endX, y2: y })),
      ...aisles.connectorXs.map((x) => ({ x1: x, y1: aisles.rowYs[0], x2: x, y2: aisles.rowYs.at(-1) })),
      { x1: entranceRoadWaypoint.x, y1: entranceRoadWaypoint.y, x2: entranceWaypoint.x, y2: entranceWaypoint.y },
      { x1: entranceWaypoint.x, y1: entranceWaypoint.y, x2: customerSpawn.x, y2: customerSpawn.y },
      ...checkout.terminalSpots.map((spot) => ({ x1: spot.x, y1: spot.y, x2: aisles.sideX, y2: spot.y })),
    ];
    const joints = [
      ...aisles.rowYs.flatMap((y) => aisles.connectorXs.map((x) => ({ x, y }))),
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

  rebuildHypermarketNavigation() {
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

    aisles.rowYs.forEach((y, rowIndex) => {
      const shelfXs = this.shelves.shelves
        .filter((shelf) => this.shelves.isShelfActive(shelf) && shelf.customerSpot?.y === y)
        .map((shelf) => shelf.customerSpot.x);
      const rowXs = [...new Set([aisles.sideX, ...aisles.connectorXs, aisles.endX, ...shelfXs])].sort((a, b) => a - b);
      rowXs.forEach((x) => graph.addNode(`row:${rowIndex}:${x}`, x, y));
      rowXs.slice(1).forEach((x, index) => graph.connect(`row:${rowIndex}:${rowXs[index]}`, `row:${rowIndex}:${x}`));
      graph.connect(`side:${y}`, `row:${rowIndex}:${aisles.sideX}`);
      if (y === entranceRoadWaypoint.y) graph.connect('entrance-road', `row:${rowIndex}:${entranceRoadWaypoint.x}`);
    });

    aisles.connectorXs.forEach((x) => {
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

  validateHypermarketNavigation() {
    if (!this.navigationGraph) return false;
    const issues = [];
    this.shelves.shelves.filter((shelf) => this.shelves.isShelfActive(shelf)).forEach((shelf) => {
      const serviceId = `shelf:${shelf.id}`;
      if (!this.navigationGraph.hasPath('entrance', serviceId)) issues.push(`${shelf.id}:entrance`);
      this.layout.checkout.terminalSpots.forEach((_spot, index) => {
        if (!this.navigationGraph.hasPath(serviceId, `checkout:${index}`)) issues.push(`${shelf.id}:checkout-${index}`);
      });
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

import Phaser from 'phaser';
import { Player } from '../entities/Player.js';
import { MobileJoystick } from '../input/MobileJoystick.js';
import { PlayerController } from '../input/PlayerController.js';
import { AdService } from '../yandex/AdService.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { ShelfSystem } from '../systems/ShelfSystem.js';
import { CheckoutSystem } from '../systems/CheckoutSystem.js';
import { CustomerSystem } from '../systems/CustomerSystem.js';
import { UpgradeSystem } from '../systems/UpgradeSystem.js';
import { ZoneSystem } from '../systems/ZoneSystem.js';
import { RestockSystem } from '../systems/RestockSystem.js';
import { BoostSystem } from '../systems/BoostSystem.js';
import { TeleportSystem } from '../systems/TeleportSystem.js';
import { DailyRewardSystem } from '../systems/DailyRewardSystem.js';
import { OfflineProgressSystem } from '../systems/OfflineProgressSystem.js';
import { PrestigeSystem } from '../systems/PrestigeSystem.js';
import { DayCycleSystem } from '../systems/DayCycleSystem.js';
import { EventBus, Events } from '../core/EventBus.js';
import { GROCERY_LAYOUT } from '../config/GroceryLayout.js';
import { WaypointGraph } from '../navigation/WaypointGraph.js';

export class GameplayScene extends Phaser.Scene {
  constructor() {
    super('GameplayScene');
  }

  create() {
    this.layout = GROCERY_LAYOUT;
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
      shelfWidth: this.layout.shelf.width,
      shelfHeight: this.layout.shelf.height,
      progressWidth: this.layout.shelf.progressWidth,
      progressHeight: this.layout.shelf.progressHeight,
      progressY: this.layout.shelf.progressY,
      progressStyle: 'compact',
      shelfImageY: this.layout.shelf.imageY,
      shelfImageHeight: this.layout.shelf.imageHeight,
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
        lowestRoadY: this.layout.aisles.rowYs[2],
      },
    });
    this.checkout = new CheckoutSystem(this, this.state, this.economy, {
      imageKey: 'grocery-self-checkout',
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
    this.player = new Player(
      this,
      this.layout.playerSpawn.x,
      this.layout.playerSpawn.y,
      this.economy.stats,
    );
    this.physics.add.collider(this.player.sprite, this.shelves.obstacles);
    this.physics.add.collider(this.player.sprite, this.checkout.obstacles);
    this.physics.add.collider(this.player.sprite, this.environmentObstacles);
    this.teleports = new TeleportSystem(this, this.player.sprite, [
      {
        ...this.layout.teleport,
        targetScene: 'StreetScene',
        stopScenes: ['UIScene'],
      },
    ]);
    this.joystick = new MobileJoystick(this, {
      x: 84,
      bottom: 82,
      onModeChange: () => this.reflowGroceryLayout(),
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
      this.rebuildGroceryNavigation();
      return this.validateGroceryNavigation();
    };
    this.upgrades = new UpgradeSystem(this.state, this.balance, this.economy);
    this.zones = new ZoneSystem(this, this.state, this.balance, this.economy, this.shelves, {
      rects: this.layout.zones.rects,
      showLabels: false,
      zoneDepth: 0,
      visualStyle: {
        unlockedColor: 0xf5f7ee,
        unlockedAlpha: 0.07,
        unlockedStroke: 0xcbd3c5,
        lockedColor: 0xd9ddd5,
        lockedAlpha: 0.15,
        lockedStroke: 0xb7beb6,
        strokeWidth: 1,
      },
    });
    this.restock = new RestockSystem(this.state, this.balance, this.economy, this.shelves, this.zones);
    this.rebuildGroceryNavigation();
    this.customers = new CustomerSystem(this, this.balance, this.systems, {
      spawnPoint: this.layout.customerSpawn,
      spawnEnabled: false,
      autoRefreshRoutes: false,
      minSpawnDistance: 34,
      customer: {
        frontTexture: 'grocery-customer-robot',
        backTexture: 'grocery-customer-robot',
        displayWidth: 48,
        displayHeight: 48,
        bodyWidth: 24,
        bodyHeight: 22,
      },
    });
    this.systems.customers = this.customers;
    this.customers.setSpawnEnabled(this.validateGroceryNavigation());

    this.onRoutesChanged = () => {
      this.rebuildGroceryNavigation();
      this.customers.setSpawnEnabled(this.validateGroceryNavigation());
      this.customers.refreshActiveRoutes();
    };
    this.onPanelToggled = ({ open }) => {
      this.panelOpen = open;
      this.reflowGroceryLayout();
    };
    EventBus.on(Events.ROUTES_CHANGED, this.onRoutesChanged);
    EventBus.on(Events.UI_PANEL_TOGGLED, this.onPanelToggled);

    this.daily = new DailyRewardSystem(this.state, this.balance, this.saveManager, this.economy);
    this.offline = new OfflineProgressSystem(this.state, this.balance, this.economy);
    this.prestige = new PrestigeSystem(this.state, this.balance, this.saveManager);
    this.dayCycle = new DayCycleSystem(this.state, this.balance, this.adService);
    const earnedOffline = this.offline.apply();
    if (earnedOffline > 0) EventBus.emit(Events.UI_TOAST, `Пока вас не было: +$${earnedOffline}`);

    this.scale.on('resize', this.reflowGroceryLayout, this);
    this.reflowGroceryLayout();
    this.scene.launch('UIScene', {
      state: this.state,
      balance: this.balance,
      shelves: this.shelves.shelves,
      zones: this.balance.get('zones'),
      boosts: this.boosts,
      ui: {
        gameAreaWidth: this.layout.sidePanel.x,
        panelWidth: this.layout.sidePanel.width,
        theme: 'grocery',
        collapsible: true,
        groupedShelves: true,
      },
    });

    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.saveManager.save(this.state) });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.saveManager.save(this.state);
      this.scale.off('resize', this.reflowGroceryLayout, this);
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
    window.addEventListener('beforeunload', () => this.saveManager.save(this.state), { once: true });
  }

  reflowGroceryLayout() {
    if (!this.layout) return;
    const { viewport, sidePanel, canvas, world } = this.layout;
    const viewportWidth = this.panelOpen ? viewport.width : canvas.width - sidePanel.collapsedWidth;
    this.cameras.main.stopFollow();
    this.cameras.main.setViewport(viewport.x, viewport.y, viewportWidth, viewport.height);
    this.cameras.main.setBounds(world.x, world.y, world.width, world.height);
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setBackgroundColor('#d9e1d3');
    if (this.shelves && this.checkout) {
      this.rebuildGroceryNavigation();
      const navigationReady = this.validateGroceryNavigation();
      this.customers?.setSpawnEnabled(navigationReady);
      this.customers?.refreshActiveRoutes();
    }
  }

  drawWorld() {
    const { room, world } = this.layout;
    this.environmentObstacles = this.physics.add.staticGroup();
    this.add.rectangle(world.width / 2, world.height / 2, world.width, world.height, 0xd7c8a5).setDepth(-10);
    this.add.rectangle(room.x + room.width / 2 + 5, room.y + room.height / 2 + 7, room.width, room.height, 0x000000, 0.2).setDepth(-9);
    this.add.rectangle(room.x + room.width / 2, room.y + room.height / 2, room.width, room.height, 0xe9ede4).setDepth(-8);
    this.add.tileSprite(
      room.x + room.width / 2,
      room.y + room.height / 2,
      room.width - 22,
      room.height - 22,
      'grocery-floor-tile',
    ).setTileScale(0.27).setAlpha(0.33).setDepth(-7);
    this.drawRoomWalls();
    this.drawDecorations();
    this.drawEntrance();
  }

  drawRoomWalls() {
    const { room, walls, entranceGap } = this.layout;
    const graphics = this.add.graphics().setDepth(-5);
    graphics.fillStyle(0xb9c0ba, 1);
    graphics.fillRect(room.x, room.y, room.width, 18);
    graphics.fillRect(room.x, room.y, 18, room.height);
    graphics.fillRect(room.x + room.width - 18, room.y, 18, room.height);
    graphics.fillRect(room.x, room.y + room.height - 18, entranceGap.x - room.x, 18);
    graphics.fillRect(
      entranceGap.x + entranceGap.width,
      room.y + room.height - 18,
      room.x + room.width - entranceGap.x - entranceGap.width,
      18,
    );
    graphics.lineStyle(3, 0x7f8984, 1);
    graphics.strokeRect(room.x, room.y, room.width, room.height - 16);
    graphics.lineBetween(room.x, room.y + room.height, entranceGap.x, room.y + room.height);
    graphics.lineBetween(
      entranceGap.x + entranceGap.width,
      room.y + room.height,
      room.x + room.width,
      room.y + room.height,
    );
    Object.values(walls).forEach((wall) => this.addEnvironmentBlocker(wall));
  }

  drawDecorations() {
    const { decorations } = this.layout;
    decorations.wallPlants.forEach((position) => {
      this.add.image(position.x, position.y, 'grocery-plant').setDisplaySize(38, 61).setDepth(position.y + 22);
      this.addEnvironmentBlocker({ x: position.x, y: position.y + 19, width: 28, height: 22 });
    });
    this.add.image(decorations.trash.x, decorations.trash.y, 'grocery-trash-bin')
      .setDisplaySize(34, 55)
      .setDepth(decorations.trash.y + 28);
    this.addEnvironmentBlocker({
      x: decorations.trash.x,
      y: decorations.trash.y + 17,
      width: 29,
      height: 22,
    });
  }

  drawEntrance() {
    const { entrance, decorations } = this.layout;
    this.add.image(entrance.x, entrance.y, 'grocery-entrance-mat')
      .setDisplaySize(entrance.width, entrance.height)
      .setDepth(2);
    decorations.entranceTopiaries.forEach((position) => {
      this.add.image(position.x, position.y, 'grocery-topiary')
        .setDisplaySize(43, 76)
        .setDepth(position.y + 38);
      this.addEnvironmentBlocker({ x: position.x, y: position.y + 26, width: 29, height: 23 });
    });
    decorations.entranceBollards.forEach((position) => {
      this.add.image(position.x, position.y, 'grocery-entrance-bollard')
        .setDisplaySize(18, 58)
        .setDepth(position.y + 30);
      this.addEnvironmentBlocker({ x: position.x, y: position.y + 11, width: 14, height: 38 });
    });
  }

  addEnvironmentBlocker({ x, y, width, height }) {
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
      ...aisles.connectorXs.map((x) => ({ x1: x, y1: aisles.rowYs[0], x2: x, y2: aisles.rowYs[2] })),
      { x1: entranceRoadWaypoint.x, y1: entranceRoadWaypoint.y, x2: entranceWaypoint.x, y2: entranceWaypoint.y },
      { x1: entranceWaypoint.x, y1: entranceWaypoint.y, x2: customerSpawn.x, y2: customerSpawn.y },
      ...checkout.terminalSpots.map((spot) => ({ x1: spot.x, y1: spot.y, x2: aisles.sideX, y2: spot.y })),
    ];
    const joints = [
      ...aisles.rowYs.flatMap((y) => aisles.connectorXs.map((x) => ({ x, y }))),
      ...checkout.terminalSpots,
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

    drawNetwork(aisles.roadWidth + 7, 0xafbbb6, 0.84);
    drawNetwork(aisles.roadWidth, 0xdde4e1, 0.96);
    markGraphics.fillStyle(0xffffff, 0.75);
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

  rebuildGroceryNavigation() {
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
      if (y === entranceRoadWaypoint.y) {
        graph.connect('entrance-road', `row:${rowIndex}:${entranceRoadWaypoint.x}`);
      }
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

  validateGroceryNavigation() {
    if (!this.navigationGraph) return false;
    const issues = [];
    const activeShelves = this.shelves.shelves.filter((shelf) => this.shelves.isShelfActive(shelf));
    activeShelves.forEach((shelf) => {
      const serviceId = `shelf:${shelf.id}`;
      if (!this.navigationGraph.hasPath('entrance', serviceId)) issues.push(`${shelf.id}:entrance`);
      this.layout.checkout.terminalSpots.forEach((_spot, index) => {
        if (!this.navigationGraph.hasPath(serviceId, `checkout:${index}`)) {
          issues.push(`${shelf.id}:checkout:${index}`);
        }
      });
    });
    this.layout.checkout.terminalSpots.forEach((_spot, index) => {
      if (!this.navigationGraph.hasPath(`checkout:${index}`, 'entrance')) issues.push(`checkout:${index}:exit`);
    });
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
    this.dayCycle.update(delta);
  }
}

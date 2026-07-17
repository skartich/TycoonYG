import Phaser from 'phaser';
import { Button } from '../ui/Button.js';
import { EventBus, Events } from '../core/EventBus.js';
import { formatMoney } from '../utils/math.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create(data) {
    this.state = data.state;
    this.balance = data.balance;
    this.shelves = data.shelves;
    this.zones = data.zones ?? this.balance.get('zones');
    this.boosts = data.boosts;
    this.uiOptions = {
      gameAreaWidth: data.ui?.gameAreaWidth ?? 1008,
      panelWidth: data.ui?.panelWidth ?? 272,
      theme: data.ui?.theme ?? 'default',
      collapsible: data.ui?.collapsible ?? true,
    };
    this.shelfButtons = new Map();
    this.boostButtons = new Map();
    this.toastQueue = [];
    this.toastActive = false;
    this.panelOpen = true;
    this.selectedShelfId = null;

    this.createTopHud();
    this.createActionPanel();
    this.createToast();
    this.createEmptyStockNotice();
    this.refresh();
    this.bindEvents();
    this.scale.on('resize', this.reflowUILayout, this);
    this.reflowUILayout();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.reflowUILayout, this);
      this.eventHandlers?.forEach(([event, handler]) => EventBus.off(event, handler));
    });
  }

  createTopHud() {
    this.topPanel = this.add.image(258, 46, 'top-panel')
      .setDisplaySize(500, 84)
      .setScrollFactor(0)
      .setDepth(3000);
    if (this.uiOptions.theme === 'stationery') {
      this.add.rectangle(258, 86, 452, 3, 0x55c7ee, 0.85).setScrollFactor(0).setDepth(3001);
    }

    const textStyle = {
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    };
    this.moneyText = this.add.text(140, 52, '', textStyle).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
    this.revenueText = this.add.text(307, 52, '', textStyle).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
    this.prestigeText = this.add.text(450, 52, '', textStyle).setOrigin(0.5).setScrollFactor(0).setDepth(3001);
  }

  createToast() {
    this.toast = this.add.text(this.uiOptions.gameAreaWidth / 2, 112, '', {
      fontSize: '17px',
      color: '#ffffff',
      backgroundColor: '#1e332a',
      padding: { x: 14, y: 8 },
      align: 'center',
      wordWrap: { width: Math.min(520, this.uiOptions.gameAreaWidth - 80) },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(5001).setVisible(false);
  }

  bindEvents() {
    this.eventHandlers = [
      [Events.MONEY_CHANGED, () => this.refresh()],
      [Events.PRODUCT_CHANGED, () => this.refresh()],
      [Events.STATS_CHANGED, () => this.refresh()],
      [Events.SHELF_STOCKED, () => this.refresh()],
      [Events.UI_TOAST, (message) => this.showToast(message)],
      [Events.ALL_STOCK_EMPTY, () => this.showEmptyStockNotice()],
      [Events.ZONE_UNLOCKED, (zone) => {
        this.refresh();
        this.showToast(`Открыто: ${zone.name}`);
      }],
      [Events.CHECKOUT_COMPLETED, ({ money, items }) => this.showToast(`Чек покупки: ${items} шт. +$${money}`)],
    ];
    this.eventHandlers.forEach(([event, handler]) => EventBus.on(event, handler));
  }

  createActionPanel() {
    const panelX = this.uiOptions.gameAreaWidth;
    const panelWidth = this.uiOptions.panelWidth;
    this.panelContent = this.add.container(panelX, 0).setScrollFactor(0).setDepth(2999);

    const backdrop = this.add.rectangle(panelWidth / 2, 402, panelWidth - 8, 628, 0x182720, 0.96)
      .setStrokeStyle(2, 0x4f655a, 1);
    const accent = this.add.rectangle(panelWidth / 2, 91, panelWidth - 18, 4, 0x55c7ee, 0.9);
    const title = this.add.text(panelWidth / 2, 108, 'Пополнение', {
      fontSize: '19px', color: '#f7d05b', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.panelContent.add([backdrop, accent, title]);

    const columns = 2;
    const buttonWidth = 120;
    const buttonHeight = 30;
    const rowGap = 34;
    const startY = 140;
    this.shelves.forEach((shelf, index) => {
      const x = 70 + (index % columns) * 132;
      const y = startY + Math.floor(index / columns) * rowGap;
      const button = new Button(this, x, y, buttonWidth, buttonHeight, '', () => this.selectAndRestock(shelf.id), {
        baseColor: 0xf3cf62,
        hoverColor: 0xffdf7f,
        selectedColor: 0x8bd5ee,
      });
      this.panelContent.add(button.container);
      this.shelfButtons.set(shelf.id, button);
    });

    const shelfRows = Math.ceil(this.shelves.length / columns);
    const boostsTop = Math.max(420, startY + shelfRows * rowGap + 8);
    const divider = this.add.rectangle(panelWidth / 2, boostsTop - 18, panelWidth - 28, 2, 0x4f655a, 0.8);
    const boostsTitle = this.add.text(panelWidth / 2, boostsTop, 'Бусты', {
      fontSize: '19px', color: '#f7d05b', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.panelContent.add([divider, boostsTitle]);

    const addBoostButton = (id, y, callback) => {
      const button = new Button(this, panelWidth / 2, y, panelWidth - 30, 38, '', callback, {
        baseColor: 0xf3cf62,
        hoverColor: 0xffdf7f,
        selectedColor: 0x8bd5ee,
      });
      this.panelContent.add(button.container);
      this.boostButtons.set(id, button);
    };
    addBoostButton('rewarded', boostsTop + 42, () => EventBus.emit(Events.UI_SHOW_REWARDED));
    addBoostButton('customerSpeed', boostsTop + 88, () => EventBus.emit(Events.UI_BUY_CUSTOMER_SPEED));
    addBoostButton('customerFlow', boostsTop + 134, () => EventBus.emit(Events.UI_BUY_CUSTOMER_FLOW));

    this.panelToggle = this.add.container(panelX - 19, 112).setScrollFactor(0).setDepth(5002);
    const toggleBg = this.add.rectangle(0, 0, 38, 40, 0x243a30, 1).setStrokeStyle(2, 0x6c8477);
    this.panelToggleText = this.add.text(0, -1, '›', { fontSize: '28px', color: '#f7d05b', fontStyle: 'bold' }).setOrigin(0.5);
    toggleBg.setInteractive({ useHandCursor: true });
    toggleBg.on('pointerdown', () => this.setPanelOpen(!this.panelOpen));
    this.panelToggle.add([toggleBg, this.panelToggleText]);
  }

  selectAndRestock(id) {
    this.selectedShelfId = id;
    this.shelfButtons.forEach((button, shelfId) => button.setSelected(shelfId === id));
    EventBus.emit(Events.UI_SHELF_SELECTED, id);
    EventBus.emit(Events.UI_RESTOCK_SHELF, id);
  }

  setPanelOpen(open) {
    if (!this.uiOptions.collapsible) open = true;
    this.panelOpen = open;
    this.panelContent.setVisible(open);
    this.shelfButtons.forEach((button) => button.setEnabled(open));
    this.boostButtons.forEach((button) => button.setEnabled(open));
    this.panelToggleText.setText(open ? '›' : '‹');
    this.panelToggle.setPosition(open ? this.uiOptions.gameAreaWidth - 19 : this.scale.width - 22, 112);
    EventBus.emit(Events.UI_PANEL_TOGGLED, { open });
  }

  reflowUILayout() {
    const viewportWidth = globalThis.innerWidth ?? this.scale.parentSize?.width ?? this.scale.width;
    const viewportHeight = globalThis.innerHeight ?? this.scale.parentSize?.height ?? this.scale.height;
    const compact = viewportWidth < 950 || viewportHeight > viewportWidth;
    if (compact && this.panelOpen) this.setPanelOpen(false);
    else this.panelToggle.setPosition(this.panelOpen ? this.uiOptions.gameAreaWidth - 19 : this.scale.width - 22, 112);
    this.toast?.setPosition(this.uiOptions.gameAreaWidth / 2, 112);
    this.emptyStockNotice?.setPosition(this.uiOptions.gameAreaWidth / 2, 270);
  }

  createEmptyStockNotice() {
    this.emptyStockNotice = this.add.container(this.uiOptions.gameAreaWidth / 2, 270).setScrollFactor(0).setDepth(5000).setVisible(false);
    const shadow = this.add.rectangle(6, 8, 410, 138, 0x000000, 0.22);
    const panel = this.add.rectangle(0, 0, 410, 138, 0xf4f2e8, 1).setStrokeStyle(3, 0x1d2b24);
    const closeBg = this.add.rectangle(180, -50, 32, 32, 0xe45b64, 1).setStrokeStyle(2, 0x8f2f39);
    const closeText = this.add.text(180, -51, 'X', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const title = this.add.text(0, -17, 'Весь товар закончился', {
      fontSize: '22px', color: '#1d2b24', fontStyle: 'bold',
    }).setOrigin(0.5);
    const body = this.add.text(0, 25, 'Пополните витрины, чтобы покупатели снова приносили прибыль.', {
      fontSize: '16px', color: '#34463c', align: 'center', wordWrap: { width: 350 },
    }).setOrigin(0.5);
    const close = () => this.emptyStockNotice.setVisible(false);
    closeBg.setInteractive({ useHandCursor: true }).on('pointerdown', close);
    closeText.setInteractive({ useHandCursor: true }).on('pointerdown', close);
    this.emptyStockNotice.add([shadow, panel, closeBg, closeText, title, body]);
  }

  refresh() {
    this.moneyText.setText(formatMoney(this.state.money));
    this.revenueText.setText(formatMoney(this.state.revenue));
    this.prestigeText.setText(`${this.state.prestigePoints}`);
    this.refreshShelfButtons();
    this.refreshBoostButtons();
  }

  refreshShelfButtons() {
    this.shelves.forEach((shelf) => {
      const button = this.shelfButtons.get(shelf.id);
      if (!button) return;
      const unlocked = this.state.unlockedZones.includes(shelf.zone);
      const current = this.state.shelves[shelf.id] ?? 0;
      const zone = this.zones.find((item) => item.id === shelf.zone);
      const shelfMark = shelf.id.endsWith('-a') ? 'A' : 'B';
      const productName = shelf.productMeta.shortName ?? shelf.productMeta.name;
      if (!unlocked) {
        button.setText(`${productName} ${shelfMark}\nОткрыть $${zone.cost}`);
        return;
      }
      const missing = Math.max(0, shelf.capacity - current);
      const maxCost = missing * shelf.productMeta.buyPrice;
      const status = missing > 0 ? `${current}/${shelf.capacity}  $${maxCost}` : `${current}/${shelf.capacity}  max`;
      button.setText(`${productName} ${shelfMark}  $${shelf.productMeta.buyPrice}\n${status}`);
      button.setSelected(shelf.id === this.selectedShelfId);
    });
  }

  refreshBoostButtons() {
    this.boostButtons.get('rewarded')?.setText(`Реклама  +$${this.state.rewardedAdReward ?? this.balance.get('ads.rewardedMoneyStart')}`);

    const speed = this.boostButtons.get('customerSpeed');
    const level = this.boosts.getCustomerSpeedLevel();
    const maxLevel = 10;
    speed?.setText(level >= maxLevel
      ? `Скорость покупателей  ${level}/${maxLevel}`
      : `Скорость ${level}/${maxLevel}  +10%  $${this.boosts.getCustomerSpeedPrice()}`);

    const flow = this.boostButtons.get('customerFlow');
    const flowLevel = this.boosts.getCustomerFlowLevel();
    const flowMaxLevel = 30;
    flow?.setText(flowLevel >= flowMaxLevel
      ? `Поток покупателей  ${this.boosts.getCustomerSpawnSeconds()} с.`
      : `Поток ${flowLevel}/${flowMaxLevel}  ${this.boosts.getCustomerSpawnSeconds()} с.  $${this.boosts.getCustomerFlowPrice()}`);
  }

  showToast(message) {
    this.toastQueue.push(message);
    if (!this.toastActive) this.playNextToast();
  }

  playNextToast() {
    const message = this.toastQueue.shift();
    if (!message) {
      this.toastActive = false;
      return;
    }
    this.toastActive = true;
    this.toast.setText(message).setVisible(true).setAlpha(0).setY(106);
    this.tweens.add({
      targets: this.toast,
      alpha: 1,
      y: 114,
      duration: 160,
      ease: 'Sine.Out',
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: this.toast,
            alpha: 0,
            y: 106,
            duration: 180,
            ease: 'Sine.In',
            onComplete: () => {
              this.toast.setVisible(false);
              this.playNextToast();
            },
          });
        });
      },
    });
  }

  showEmptyStockNotice() {
    this.emptyStockNotice.setVisible(true);
  }
}

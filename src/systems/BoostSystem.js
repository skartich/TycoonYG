import { EventBus, Events } from '../core/EventBus.js';

const CUSTOMER_SPEED_BASE_COST = 100;
const CUSTOMER_SPEED_MAX_LEVEL = 10;
const CUSTOMER_FLOW_BASE_COST = 50;
const CUSTOMER_FLOW_COST_STEP = 50;
const CUSTOMER_FLOW_MAX_LEVEL = 30;
const CUSTOMER_FLOW_BASE_SECONDS = 5;
const CUSTOMER_FLOW_MIN_SECONDS = 2;

export class BoostSystem {
  constructor(state, economy) {
    this.state = state;
    this.economy = economy;
    this.onBuyCustomerSpeed = () => this.buyCustomerSpeed();
    this.onBuyCustomerFlow = () => this.buyCustomerFlow();
    EventBus.on(Events.UI_BUY_CUSTOMER_SPEED, this.onBuyCustomerSpeed);
    EventBus.on(Events.UI_BUY_CUSTOMER_FLOW, this.onBuyCustomerFlow);
  }

  getCustomerSpeedLevel() {
    return Math.min(this.state.customerSpeedBoosts ?? 0, CUSTOMER_SPEED_MAX_LEVEL);
  }

  getCustomerSpeedPrice() {
    return CUSTOMER_SPEED_BASE_COST * 2 ** this.getCustomerSpeedLevel();
  }

  getCustomerSpeedMultiplier() {
    return 1.1 ** this.getCustomerSpeedLevel();
  }

  getCustomerFlowLevel() {
    return Math.min(this.state.customerFlowBoosts ?? 0, CUSTOMER_FLOW_MAX_LEVEL);
  }

  getCustomerFlowPrice() {
    return CUSTOMER_FLOW_BASE_COST + this.getCustomerFlowLevel() * CUSTOMER_FLOW_COST_STEP;
  }

  getCustomerSpawnSeconds() {
    const seconds = CUSTOMER_FLOW_BASE_SECONDS - this.getCustomerFlowLevel() * 0.1;
    return Math.max(CUSTOMER_FLOW_MIN_SECONDS, Number(seconds.toFixed(1)));
  }

  buyCustomerSpeed() {
    const level = this.getCustomerSpeedLevel();
    if (level >= CUSTOMER_SPEED_MAX_LEVEL) {
      EventBus.emit(Events.UI_TOAST, 'Скорость покупателей уже на максимуме');
      return false;
    }

    const price = this.getCustomerSpeedPrice();
    if (!this.economy.spend(price)) {
      EventBus.emit(Events.UI_TOAST, `Нужно $${price} для буста скорости`);
      return false;
    }

    this.state.customerSpeedBoosts = level + 1;
    EventBus.emit(Events.STATS_CHANGED, this.state);
    EventBus.emit(Events.UI_TOAST, `Скорость покупателей +10% (${this.state.customerSpeedBoosts}/${CUSTOMER_SPEED_MAX_LEVEL})`);
    return true;
  }

  buyCustomerFlow() {
    const level = this.getCustomerFlowLevel();
    if (level >= CUSTOMER_FLOW_MAX_LEVEL) {
      EventBus.emit(Events.UI_TOAST, 'Приход покупателей уже на максимуме');
      return false;
    }

    const price = this.getCustomerFlowPrice();
    if (!this.economy.spend(price)) {
      EventBus.emit(Events.UI_TOAST, `Нужно $${price} для буста покупателей`);
      return false;
    }

    this.state.customerFlowBoosts = level + 1;
    EventBus.emit(Events.STATS_CHANGED, this.state);
    EventBus.emit(Events.UI_TOAST, `Покупатели приходят чаще: ${this.getCustomerSpawnSeconds()} сек.`);
    return true;
  }
  destroy() {
    EventBus.off(Events.UI_BUY_CUSTOMER_SPEED, this.onBuyCustomerSpeed);
    EventBus.off(Events.UI_BUY_CUSTOMER_FLOW, this.onBuyCustomerFlow);
  }
}

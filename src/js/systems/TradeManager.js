// @ts-check

/**
 * @fileoverview TradeManager.js - 統一交易管理器
 * 職責：統一交易入口，整合租金收取和租客交易系統
 * 架構：繼承 BaseManager，協調 RentManager 和 UniversalTrader
 */

import BaseManager from "./BaseManager.js";
import RentManager from "./RentManager.js";
import UniversalTrader from "./UniversalTrader.js";

/**
 * 交易統計資料
 * @typedef {Object} TradeStats
 * @property {number} rentTransactions - 租金交易次數
 * @property {number} resourceTransactions - 資源交易次數
 * @property {number} mutualAidEvents - 互助事件次數
 * @property {number} totalValue - 總交易價值
 * @property {DailyStats} dailyStats - 每日統計
 */

/**
 * 每日統計資料
 * @typedef {Object} DailyStats
 * @property {number} day - 天數
 * @property {number} rentCollected - 收取的租金
 * @property {number} resourceTrades - 資源交易數量
 * @property {number} mutualAidEvents - 互助事件數量
 * @property {number} totalDailyValue - 當日總價值
 */

/**
 * 統一交易管理器
 * 提供簡潔的交易API，協調租金收取和租客交易功能
 * @class
 * @extends BaseManager
 */
export class TradeManager extends BaseManager {
  /**
   * 建立 TradeManager 實例
   * @param {Object} gameStateRef - 遊戲狀態參考
   * @param {Object} resourceManager - 資源管理器實例
   * @param {Object} dataManager - 資料管理器實例
   * @param {Object} eventBus - 事件總線實例
   */
  constructor(gameStateRef, resourceManager, tenantManager, dataManager, eventBus) {
    super(gameStateRef, eventBus, "TradeManager");

    /** @type {Object} 資源管理器實例 */
    this.resourceManager = resourceManager;

    /** @type {Object} 資料管理器實例 */
    this.dataManager = dataManager;

    /** @type {Object} 租客管理器實例 */
    this.tenantManager = tenantManager

    /** @type {RentManager|null} 租金管理器 */
    this.rentManager = null;

    /** @type {UniversalTrader|null} 租客交易器 */
    this.universalTrader = null;

    /** @type {TradeStats} 交易統計 */
    this.tradeStats = {
      rentTransactions: 0,
      resourceTransactions: 0,
      mutualAidEvents: 0,
      totalValue: 0,
      dailyStats: {
        day: 1,
        rentCollected: 0,
        resourceTrades: 0,
        mutualAidEvents: 0,
        totalDailyValue: 0,
      },
    };

    this.logSuccess("TradeManager 已建立");
  }

  // ==========================================
  // BaseManager 抽象方法實作
  // ==========================================

  /**
   * 取得模組事件前綴
   * @returns {string} 事件前綴
   */
  getModulePrefix() {
    return "trade";
  }

  /**
   * 設置事件監聽器
   * @returns {void}
   */
  setupEventListeners() {
    // 監聽新一天開始，重置每日統計
    this.onEvent(
      "day_advanced",
      () => {
        this.resetDailyStats();
      },
      { skipPrefix: true }
    );

    // 監聽租金收取完成事件
    this.onEvent("rentCollectionCompleted", (eventObj) => {
      const { totalCashRent, bonusIncome } = eventObj.data;
      this.updateStats("rent", totalCashRent + bonusIncome);
      this.logSuccess(`租金收取統計已更新: $${totalCashRent + bonusIncome}`);
    });

    // 監聽資源交易完成事件
    this.onEvent("trade_tradeCompleted", (eventObj) => {
      const transaction = eventObj.data.result?.transaction;
      if (transaction?.price) {
        this.updateStats("resource", transaction.price);
      }
    });

    // 監聽互助事件完成
    this.onEvent("trade_autoMutualAidExecuted", (eventObj) => {
      this.updateStats("mutual_aid", 0); // 互助事件不計入金額統計
    });
  }

  /**
   * 取得擴展狀態資訊
   * @returns {Object} 擴展狀態物件
   */
  getExtendedStatus() {
    return {
      rentManagerReady: this.rentManager?.isInitialized() || false,
      universalTraderReady: this.universalTrader?.isInitialized() || false,
      totalTransactions: this.getTotalTransactions(),
      systemHealth: this.validateSystemHealth(),
      tradeStats: { ...this.tradeStats },
    };
  }

  // ==========================================
  // 系統初始化
  // ==========================================

  /**
   * 系統初始化
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      this.logSuccess("開始初始化統一交易系統");

      // 初始化子模組
      await this.initializeSubModules();

      // 設置事件監聽器
      this.setupEventListeners();

      // 初始化統計
      this.initializeStats();

      // 標記初始化完成
      this.markInitialized(true);

      this.logSuccess("TradeManager v3.0 統一交易系統初始化完成");
      return true;
    } catch (error) {
      this.logError("TradeManager 初始化失敗", error);
      this.markInitialized(false);
      return false;
    }
  }

  /**
   * 初始化子模組
   * @returns {Promise<void>}
   */
  async initializeSubModules() {
    // 初始化租金管理器
    this.rentManager = new RentManager(
      this.gameState,
      this.resourceManager,
      this.dataManager,
      this.eventBus
    );

    const rentInitSuccess = await this.rentManager.initialize();
    if (!rentInitSuccess) {
      throw new Error("RentManager 初始化失敗");
    }

    // 初始化租客交易器
    this.universalTrader = new UniversalTrader(
      this.gameState,
      this.resourceManager,
      this.tenantManager,
      this.dataManager,
      this.eventBus
    );

    const traderInitSuccess = await this.universalTrader.initialize();
    if (!traderInitSuccess) {
      throw new Error("UniversalTrader 初始化失敗");
    }

    this.logSuccess("所有子模組初始化完成");
  }

  /**
   * 初始化統計
   * @returns {void}
   */
  initializeStats() {
    this.tradeStats.dailyStats.day = this.gameState.getStateValue("day", 1);
  }

  // ==========================================
  // 統一API介面
  // ==========================================

  /**
   * 收取租金（統一入口）
   * @returns {Promise<Object>} 租金收取結果
   */
  async collectRent() {
    if (!this.rentManager) {
      return { success: false, error: "租金管理器未初始化" };
    }

    try {
      const result = await this.rentManager.collectRent();
      this.emitEvent("collectRentCompleted", result);
      return result;
    } catch (error) {
      this.logError("租金收取失敗", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 執行資源交易（統一入口）
   * @param {string} tradeOptionId - 交易選項ID
   * @returns {Promise<Object>} 交易結果
   */
  async executeResourceTrade(tradeOptionId) {
    if (!this.universalTrader) {
      return { success: false, error: "租客交易器未初始化" };
    }

    try {
      // 解析交易選項
      const [characterId] = tradeOptionId.split('_');
      const tradeOptions = this.universalTrader.getCharacterTradeOptions(characterId);
      const selectedOption = tradeOptions.find(option => option.id === tradeOptionId);

      if (!selectedOption) {
        return { success: false, error: "找不到指定的交易選項" };
      }

      const result = await this.universalTrader.executeTrade(selectedOption);
      this.emitEvent("resourceTradeCompleted", { tradeOptionId, result });
      return result;
    } catch (error) {
      this.logError("資源交易失敗", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 處理互助系統（統一入口）
   * @returns {Promise<Object>} 互助處理結果
   */
  async processMutualAid() {
    if (!this.universalTrader) {
      return { success: false, error: "租客交易器未初始化" };
    }

    try {
      const result = this.universalTrader.processAutoMutualAid();
      this.emitEvent("mutualAidCompleted", { events: result });
      return { success: true, events: result };
    } catch (error) {
      this.logError("互助處理失敗", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 取得角色交易選項
   * @param {string} characterId - 角色ID
   * @returns {Array} 交易選項陣列
   */
  getCharacterTradeOptions(characterId) {
    if (!this.universalTrader) {
      this.logWarning("租客交易器未初始化");
      return [];
    }

    return this.universalTrader.getCharacterTradeOptions(characterId);
  }

  // ==========================================
  // 統計與狀態管理
  // ==========================================

  /**
   * 更新交易統計
   * @param {"rent"|"resource"|"mutual_aid"} type - 交易類型
   * @param {number} value - 交易價值
   * @returns {void}
   */
  updateStats(type, value) {
    this.tradeStats.totalValue += value;
    this.tradeStats.dailyStats.totalDailyValue += value;

    switch (type) {
      case "rent":
        this.tradeStats.rentTransactions++;
        this.tradeStats.dailyStats.rentCollected += value;
        break;
      case "resource":
        this.tradeStats.resourceTransactions++;
        this.tradeStats.dailyStats.resourceTrades++;
        break;
      case "mutual_aid":
        this.tradeStats.mutualAidEvents++;
        this.tradeStats.dailyStats.mutualAidEvents++;
        break;
    }
  }

  /**
   * 重置每日統計
   * @returns {void}
   */
  resetDailyStats() {
    this.tradeStats.dailyStats = {
      day: this.gameState.getStateValue("day", 1),
      rentCollected: 0,
      resourceTrades: 0,
      mutualAidEvents: 0,
      totalDailyValue: 0,
    };

    this.logSuccess("每日交易統計已重置");
  }

  /**
   * 取得總交易數量
   * @returns {number} 總交易數量
   */
  getTotalTransactions() {
    return (
      this.tradeStats.rentTransactions +
      this.tradeStats.resourceTransactions +
      this.tradeStats.mutualAidEvents
    );
  }

  /**
   * 驗證系統健康狀態
   * @returns {{healthy: boolean, issues: string[]}} 系統健康狀態
   */
  validateSystemHealth() {
    const issues = [];

    if (!this.rentManager?.isInitialized()) {
      issues.push("RentManager 未正確初始化");
    }

    if (!this.universalTrader?.isInitialized()) {
      issues.push("UniversalTrader 未正確初始化");
    }

    return {
      healthy: issues.length === 0,
      issues: issues,
    };
  }

  /**
   * 取得交易統計摘要
   * @returns {Object} 統計摘要
   */
  getStatsSummary() {
    return {
      ...this.tradeStats,
      averageDailyValue:
        this.tradeStats.dailyStats.day > 0
          ? Math.floor(this.tradeStats.totalValue / this.tradeStats.dailyStats.day)
          : 0,
      systemHealth: this.validateSystemHealth(),
    };
  }
}

export default TradeManager;
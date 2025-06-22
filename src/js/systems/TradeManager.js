// @ts-check

/**
 * @fileoverview TradeManager.js - 統一交易管理器
 * 職責：統一交易入口，整合租金收取、租客交易和委託探索系統
 */

import BaseManager from "./BaseManager.js";
import RentManager from "./RentManager.js";
import UniversalTrader from "./UniversalTrader.js";
import CommissionHandler from "./CommissionHandler.js";
import ExplorationManager from "./ExplorationManager.js";

/**
 * 交易統計資料
 * @typedef {Object} TradeStats
 * @property {number} rentTransactions - 租金交易次數
 * @property {number} resourceTransactions - 資源交易次數
 * @property {number} mutualAidEvents - 互助事件次數
 * @property {number} commissionOffers - 委託邀約次數
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
 * @property {number} commissionsProcessed - 處理的委託數量
 * @property {number} totalDailyValue - 當日總價值
 */

/**
 * 委託請求參數
 * @typedef {Object} CommissionRequest
 * @property {string} tenantId - 目標租客ID
 * @property {string} resourceType - 需要資源類型
 * @property {number} targetAmount - 目標數量
 * @property {Object} basePayment - 基礎報酬
 * @property {Object} commission - 佣金
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
   * @param {Object} tenantManager - 租客管理器實例
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

    /** @type {ExplorationManager|null} 探索系統管理器 */
    this.explorationManager = null;

    /** @type {CommissionHandler|null} 委託處理器 */
    this.commissionHandler = null;

    /** @type {TradeStats} 交易統計 */
    this.tradeStats = {
      rentTransactions: 0,
      resourceTransactions: 0,
      mutualAidEvents: 0,
      commissionOffers: 0,
      totalValue: 0,
      dailyStats: {
        day: 1,
        rentCollected: 0,
        resourceTrades: 0,
        mutualAidEvents: 0,
        commissionsProcessed: 0,
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

    // 監聽探索完成事件（統一處理）
    this.onEvent("exploration_completed", (eventObj) => {
      const { type, result } = eventObj.data;

      if (type === 'commission') {
        this.updateStats("commission", 0); // 委託不直接計入金額，單獨統計
        this.logSuccess(`委託探索完成: ${eventObj.data.requestId}`);
      } else if (type === 'autonomous') {
        console.log(`自主探索完成: ${result.success ? '成功' : '失敗'}`);
      }
    }, { skipPrefix: true });

    // 監聽探索開始事件
    this.onEvent("exploration_started", (eventObj) => {
      const { type, participants, resourceType } = eventObj.data;
      console.log(`${type === 'commission' ? '委託' : '自主'}探索開始: ${participants.length} 人探索 ${resourceType}`);
    }, { skipPrefix: true });
  }

  /**
   * 取得擴展狀態資訊
   * @returns {Object} 擴展狀態物件
   */
  getExtendedStatus() {
    return {
      rentManagerReady: this.rentManager?.isInitialized() || false,
      universalTraderReady: this.universalTrader?.isInitialized() || false,
      explorationManagerReady: this.explorationManager?.isInitialized() || false,
      commissionHandlerReady: !!this.commissionHandler,
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

      this.logSuccess("TradeManager 統一交易系統初始化完成");
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
    // 1. 建立租金管理器
    this.rentManager = new RentManager(
      this.gameState,
      this.resourceManager,
      this.dataManager,
      this.eventBus
    );

    // 2. 建立租客交易器
    this.universalTrader = new UniversalTrader(
      this.gameState,
      this.resourceManager,
      this.tenantManager,
      this.dataManager,
      this.eventBus
    );

    // 3. 建立探索系統管理器（核心組件）
    await this._initializeExplorationManager();

    // 4. 建立委託處理器（依賴探索引擎）
    await this._initializeCommissionHandler();

    // 5. 初始化子模組
    const initResults = await Promise.all([
      this.rentManager.initialize(),
      this.universalTrader.initialize(),
    ]);

    if (initResults.some(result => !result)) {
      this.logWarning("部分子模組初始化失敗，系統將以降級模式運行");
    }

    this.logSuccess("所有子模組初始化完成");
  }

  /**
   * 初始化探索系統管理器
   * @returns {Promise<void>}
   * @private
   */
  async _initializeExplorationManager() {
    try {
      // 建立探索管理器實例
      this.explorationManager = new ExplorationManager(
        this.gameState,
        this.resourceManager,
        this.eventBus,
        this.dataManager
      );

      // 初始化探索管理器
      const initSuccess = await this.explorationManager.initialize();
      if (!initSuccess) {
        throw new Error('探索管理器初始化失敗');
      }

      this.logSuccess("探索系統管理器初始化完成");

    } catch (error) {
      this.logError("探索系統管理器初始化失敗", error);
      this.explorationManager = null;
      throw error;
    }
  }

  /**
   * 初始化委託處理器
   * @returns {Promise<void>}
   * @private
   */
  async _initializeCommissionHandler() {
    try {
      if (!this.explorationManager) {
        throw new Error('探索系統管理器未初始化，無法建立委託處理器');
      }

      // 載入探索系統配置
      const explorationConfig = this.dataManager.getRuleValue('mechanics.explorationSystem');

      if (!explorationConfig) {
        throw new Error('explorationSystem 配置未找到');
      }

      // 建立委託處理器實例
      this.commissionHandler = new CommissionHandler(
        this.tenantManager,
        this.eventBus,
        explorationConfig,
        this.explorationManager
      );

      this.logSuccess("委託處理器初始化完成");

    } catch (error) {
      this.logError("委託處理器初始化失敗", error);
      this.commissionHandler = null;
      throw error;
    }
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
  // 委託探索 API
  // ==========================================

  /**
   * 發起委託邀約
   * @param {CommissionRequest} request - 委託請求
   * @returns {Promise<Object>} 委託處理結果
   */
  async offerCommission(request) {
    if (!this.commissionHandler) {
      return {
        success: false,
        error: '委託系統未初始化'
      };
    }

    try {
      const result = await this.commissionHandler.processCommissionOffer(request);

      // 更新統計
      this.tradeStats.commissionOffers++;
      this.tradeStats.dailyStats.commissionsProcessed++;

      console.log(`委託邀約處理完成: ${result.success ? '接受' : '拒絕'}`);

      return result;
    } catch (error) {
      this.logError("委託邀約處理失敗", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 取得活躍委託列表
   * @returns {Array} 活躍委託列表
   */
  getActiveCommissions() {
    if (!this.commissionHandler) {
      return [];
    }
    return this.commissionHandler.getActiveCommissions();
  }

  /**
   * 取得委託歷史
   * @returns {Array} 完成歷史列表
   */
  getCommissionHistory() {
    if (!this.commissionHandler) {
      return [];
    }
    return this.commissionHandler.getCommissionHistory();
  }

  /**
   * 取得委託統計資訊
   * @returns {Object} 委託統計
   */
  getCommissionStats() {
    if (!this.commissionHandler) {
      return {
        activeCommissions: 0,
        totalCommissions: 0,
        successfulCommissions: 0,
        successRate: 0
      };
    }
    return this.commissionHandler.getStats();
  }

  /**
   * 取得探索系統統計（更新 API）
   * @returns {Object} 探索系統統計
   */
  getExplorationStats() {
    if (!this.explorationManager) {
      return {
        totalExplorations: 0,
        successfulExplorations: 0,
        successRate: 0
      };
    }
    return this.explorationManager.getExplorationStats();
  }

  /**
   * 取得探索歷史（更新 API）
   * @param {number} [limit=20] - 限制數量
   * @returns {Array} 探索歷史記錄
   */
  getExplorationHistory(limit = 20) {
    if (!this.explorationManager) {
      return [];
    }
    return this.explorationManager.getExplorationHistory(limit);
  }

  canAffordCommission(basePayment, commission) {
    const resources = this.gameState.getStateValue('resources', {});

    // 檢查基礎報酬
    for (const [resourceType, amount] of Object.entries(basePayment)) {
      if ((resources[resourceType] || 0) < amount) {
        return { canAfford: false, missingResource: resourceType, shortfall: amount - (resources[resourceType] || 0) };
      }
    }

    // 檢查佣金
    for (const [resourceType, amount] of Object.entries(commission)) {
      if ((resources[resourceType] || 0) < amount) {
        return { canAfford: false, missingResource: resourceType, shortfall: amount - (resources[resourceType] || 0) };
      }
    }

    return { canAfford: true };
  }

  // ==========================================
  // 統計與狀態管理
  // ==========================================

  /**
   * 更新交易統計
  * @param {string} type - 統計類型
   * @param {number} value - 數值
   * @private
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
      case "commission":
        this.tradeStats.commissionOffers++;
        this.tradeStats.dailyStats.commissionsProcessed++;
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
      commissionsProcessed: 0,
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
      this.tradeStats.mutualAidEvents +
      this.tradeStats.commissionOffers
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

    if (!!this.explorationManager) {
      issues.push("ExplorationManager 未正確初始化");
    }

    if (!!this.commissionHandler) {
      issues.push("CommissionHandler 未正確初始化");
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

  // ==========================================
  // 除錯和監控
  // ==========================================

  /**
   * 除錯資訊輸出
   * @returns {void}
   */
  debugInfo() {
    if (!this.isDebugMode()) return;

    console.group("🔄 TradeManager 除錯資訊");
    console.log("📊 統計資料:", this.tradeStats);
    console.log("⚙️ 子模組狀態:", this.getExtendedStatus());
    console.log("📋 委託狀態:", this.getCommissionStats());
    console.groupEnd();
  }

  /**
   * 清理資源
   * @returns {void}
   */
  cleanup() {
    // 清理子模組
    if (this.rentManager) {
      this.rentManager.cleanup();
      this.rentManager = null;
    }

    if (this.universalTrader) {
      this.universalTrader.cleanup();
      this.universalTrader = null;
    }

    if (this.explorationManager) {
      this.explorationManager.cleanup();
      this.explorationManager = null;
    }

    if (this.commissionHandler) {
      this.commissionHandler.cleanup();
      this.commissionHandler = null;
    }

    // 重置統計
    this.tradeStats = {
      rentTransactions: 0,
      resourceTransactions: 0,
      mutualAidEvents: 0,
      commissionOffers: 0,
      totalValue: 0,
      dailyStats: {
        day: 1,
        rentCollected: 0,
        resourceTrades: 0,
        mutualAidEvents: 0,
        commissionsProcessed: 0,
        totalDailyValue: 0,
      },
    };

    // 調用父類清理
    super.cleanup();
  }
}

export default TradeManager;
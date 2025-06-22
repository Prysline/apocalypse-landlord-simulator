// @ts-check

/**
 * @fileoverview ResourceManager.js v2.0 - 資源流轉控制核心（BaseManager 繼承版）
 * 職責：統一管理所有資源流轉、閾值監控、驗證控制、稀缺性分析
 */

import BaseManager from "./BaseManager.js";
import { SYSTEM_LIMITS } from "../utils/constants.js";

/**
 * @see {@link ../Type.js} 完整類型定義
 * @typedef {import('../Type.js').ResourceType} ResourceType
 * @typedef {import('../Type.js').ResourceThresholds} ResourceThresholds
 * @typedef {import('../Type.js').ResourceStatus} ResourceStatus
 * @typedef {import('../Type.js').Resources} Resources
 */

/**
 * 資源修改記錄
 * @typedef {Object} ResourceModification
 * @property {ResourceType} resourceType - 資源類型
 * @property {number} oldValue - 修改前數值
 * @property {number} newValue - 修改後數值
 * @property {number} changeAmount - 變更數量
 * @property {string} reason - 修改原因
 * @property {string} source - 修改來源
 * @property {string} timestamp - 修改時間戳記
 */

/**
 * 資源轉移記錄
 * @typedef {Object} ResourceTransfer
 * @property {string} from - 來源（'landlord' 或租客 ID）
 * @property {string} to - 目標（'landlord' 或租客 ID）
 * @property {Partial<Resources>} resources - 轉移的資源
 * @property {string} reason - 轉移原因
 * @property {boolean} success - 轉移是否成功
 * @property {string} timestamp - 轉移時間戳記
 */

/**
 * 稀缺性分析結果
 * @typedef {Object} ScarcityAnalysis
 * @property {ResourceType} resourceType - 資源類型
 * @property {number} scarcityIndex - 稀缺指數 (0-100)
 * @property {number} consumptionRate - 每日消耗率
 * @property {number} productionRate - 每日生產率
 * @property {number} netChange - 淨變化率
 * @property {string} trend - 趨勢 ('increasing'|'stable'|'decreasing')
 * @property {number} depletionDays - 預估耗盡天數
 */

/**
 * 資源價值配置
 * @typedef {Object} ResourceValues
 * @property {number} food - 食物單位價值
 * @property {number} materials - 建材單位價值
 * @property {number} medical - 醫療用品單位價值
 * @property {number} fuel - 燃料單位價值
 * @property {number} cash - 現金單位價值（基準）
 */

/**
 * 消費統計
 * @typedef {Object} ConsumptionStats
 * @property {number} dailyConsumption - 每日消費量
 * @property {number} weeklyAverage - 週平均消費
 * @property {number} trend - 趨勢係數
 * @property {number} lastUpdated - 最後更新時間戳記
 */

/**
 * 批量資源修改參數
 * @typedef {Object} BulkModification
 * @property {Partial<Resources>} changes - 資源變更對應表
 * @property {string} reason - 修改原因
 * @property {string} [source] - 修改來源
 * @property {boolean} [allowNegative] - 是否允許負數結果
 */

/**
 * 資源流轉控制管理器 v2.0（BaseManager 繼承版）
 * 統一管理所有資源相關操作，提供閾值監控、驗證控制和稀缺性分析
 * 核心改進：統一事件命名，簡化重複邏輯，完全繼承 BaseManager 能力
 * @class
 * @extends {BaseManager}
 */
export class ResourceManager extends BaseManager {
  /**
   * 建立 ResourceManager 實例
   * @param {Object} gameState - 遊戲狀態管理器
   * @param {Object} eventBus - 事件通信系統
   */
  constructor(gameState, eventBus) {
    // 調用 BaseManager 建構函數
    super(gameState, eventBus, "ResourceManager");

    /**
     * 資源閾值配置
     * @type {Map<ResourceType, ResourceThresholds>}
     * @private
     */
    this.thresholds = new Map();

    /**
     * 資源價值配置
     * @type {ResourceValues}
     * @private
     */
    this.resourceValues = {
      food: 1.5,
      materials: 3.0,
      medical: 4.0,
      fuel: 3.0,
      cash: 1.0,
    };

    /**
     * 消費統計追蹤
     * @type {Map<ResourceType, ConsumptionStats>}
     * @private
     */
    this.consumptionStats = new Map();

    /**
     * 資源修改歷史
     * @type {ResourceModification[]}
     * @private
     */
    this.modificationHistory = [];

    /**
     * 資源轉移歷史
     * @type {ResourceTransfer[]}
     * @private
     */
    this.transferHistory = [];

    // 初始化資源管理器
    this._initialize();

    // 標記初始化完成
    this.markInitialized();
  }

  // ==========================================
  // BaseManager 抽象方法實作
  // ==========================================

  /**
   * 取得模組事件前綴（BaseManager 要求實作）
   * @returns {string} 模組前綴 "resource"
   */
  getModulePrefix() {
    return "resource";
  }

  /**
   * 設置事件監聽器（BaseManager 要求實作）
   * 整合原有的事件監聽邏輯，使用 BaseManager 的統一介面
   * @returns {void}
   */
  setupEventListeners() {
    // 監聽每日推進（系統級事件，直接使用）
    this.onEvent("day_advanced", () => {
      this._updateConsumptionStats();
      this._checkAllResourceThresholds();
      this.resetDailyHarvestStatus();
    });

    // 監聽院子採集請求（業務級事件，使用 harvest_ 前綴）
    this.onEvent("harvest_request", () => {
      const result = this.harvestYard();
      this.emitEvent("harvest_result", { success: result });
    });

    // 監聽租客變更，更新消費基準（模組級事件，自動添加 tenant_ 前綴）
    this.onEvent("tenant_hired", () => this._recalculateBaselines());
    this.onEvent("tenant_evicted", () => this._recalculateBaselines());

    // 監聽技能使用，記錄消費（跨模組事件，需指定完整名稱）
    this.onEvent(
      "skill_used",
      (eventObj) => {
        const data = eventObj.data;
        if (this._isValidEventData(data) && data.resourceCost) {
          this._recordConsumption(data.resourceCost, "skill_usage");
        }
      },
      { skipPrefix: true }
    ); // 跳過前綴處理，使用完整事件名
  }

  /**
   * 取得擴展狀態資訊（BaseManager 擴展點）
   * 提供 ResourceManager 特有的狀態資訊
   * @protected
   * @returns {Object} 擴展狀態物件
   */
  getExtendedStatus() {
    return {
      // ResourceManager 特有狀態
      thresholdCount: this.thresholds.size,
      modificationHistory: this.modificationHistory.length,
      transferHistory: this.transferHistory.length,
      consumptionStats: Object.fromEntries(this.consumptionStats),

      // 院子採集狀態
      harvestStatus: this.getHarvestStatus(),

      // 資源評估摘要
      resourceSummary: this._getResourceSummary(),
    };
  }

  // ==========================================
  // 初始化與配置載入
  // ==========================================

  /**
   * 初始化資源管理器
   * @private
   * @returns {void}
   */
  _initialize() {
    try {
      // 載入閾值配置
      this._loadThresholds();

      // 載入資源價值配置
      this._loadResourceValues();

      // 設定事件監聽器（使用 BaseManager 統一介面）
      this.setupEventListeners();

      // 初始化消費統計
      this._initializeConsumptionStats();

      this.logSuccess("資源管理器核心功能初始化完成");
    } catch (error) {
      this.logError("資源管理器初始化失敗", error);
      throw error;
    }
  }

  /**
   * 從遊戲規則載入閾值配置
   * @private
   * @returns {void}
   */
  _loadThresholds() {
    try {
      // 從 GameState 透過 DataManager 取得規則配置
      const rules = this.gameState.getStateValue("system.gameRules") || {};
      const thresholdConfig = rules.resourceThresholds || {};

      // 設定預設閾值
      const defaultThresholds = {
        food: { warning: 10, critical: 5, emergency: 2 },
        materials: { warning: 8, critical: 3, emergency: 1 },
        medical: { warning: 6, critical: 2, emergency: 0 },
        fuel: { warning: 5, critical: 2, emergency: 0 },
        cash: { warning: 20, critical: 10, emergency: 5 },
      };

      // 合併配置
      Object.entries(defaultThresholds).forEach(([resourceType, defaults]) => {
        const config = {
          ...defaults,
          ...(thresholdConfig[resourceType] || {}),
        };
        this.thresholds.set(/** @type {ResourceType} */ (resourceType), config);
      });

      this.logSuccess("資源閾值配置載入完成");
    } catch (error) {
      this.logError("載入閾值配置失敗，使用預設值", error);
      this._setDefaultThresholds();
    }
  }

  /**
   * 從遊戲規則載入資源價值配置
   * @private
   * @returns {void}
   */
  _loadResourceValues() {
    try {
      const rules = this.gameState.getStateValue("system.gameRules") || {};
      const valueConfig = rules.resourceValues || {};

      // 合併配置，保留預設值作為後備
      this.resourceValues = { ...this.resourceValues, ...valueConfig };

      this.logSuccess("資源價值配置載入完成");
    } catch (error) {
      this.logError("載入資源價值配置失敗，使用預設值", error);
    }
  }

  /**
   * 設定預設閾值（後備方案）
   * @private
   * @returns {void}
   */
  _setDefaultThresholds() {
    const defaults = {
      food: { warning: 10, critical: 5, emergency: 2 },
      materials: { warning: 8, critical: 3, emergency: 1 },
      medical: { warning: 6, critical: 2, emergency: 0 },
      fuel: { warning: 5, critical: 2, emergency: 0 },
      cash: { warning: 20, critical: 10, emergency: 5 },
    };

    Object.entries(defaults).forEach(([type, config]) => {
      this.thresholds.set(/** @type {ResourceType} */ (type), config);
    });
  }

  /**
   * 初始化消費統計
   * @private
   * @returns {void}
   */
  _initializeConsumptionStats() {
    const resourceTypes = ["food", "materials", "medical", "fuel", "cash"];

    resourceTypes.forEach((type) => {
      this.consumptionStats.set(/** @type {ResourceType} */ (type), {
        dailyConsumption: 0,
        weeklyAverage: 0,
        trend: 0,
        lastUpdated: Date.now(),
      });
    });
  }

  // ==========================================
  // 資源修改核心功能
  // ==========================================

  /**
   * 修改單一資源數量
   * @param {ResourceType} resourceType - 資源類型
   * @param {number} amount - 變更數量（可為負數）
   * @param {string} [reason='資源修改'] - 修改原因
   * @param {string} [source='system'] - 修改來源
   * @returns {boolean} 修改是否成功
   */
  modifyResource(resourceType, amount, reason = "資源修改", source = "system") {
    if (!this.isActive) {
      this.logWarning("ResourceManager 已停用，無法修改資源");
      return false;
    }

    // 驗證輸入參數
    if (!this._isValidResourceType(resourceType)) {
      this.logError(`無效的資源類型: ${resourceType}`);
      return false;
    }

    if (!this._isValidNumber(amount)) {
      this.logError(`無效的數量: ${amount}`);
      return false;
    }

    try {
      const oldValue = this.gameState.getStateValue(
        `resources.${resourceType}`,
        0
      );
      const newValue = Math.max(0, oldValue + amount); // 防止負數

      // 執行狀態修改
      const success = this.gameState.setStateValue(
        `resources.${resourceType}`,
        newValue,
        reason
      );

      if (success) {
        // 記錄修改歷史
        this._recordModification({
          resourceType,
          oldValue,
          newValue,
          changeAmount: amount,
          reason,
          source,
          timestamp: new Date().toISOString(),
        });

        // 檢查閾值
        this._checkResourceThreshold(resourceType, newValue);

        // 發送事件通知（使用 BaseManager 統一介面）
        this.emitEvent("modified", {
          resourceType,
          oldValue,
          newValue,
          changeAmount: amount,
          reason,
          source,
        });

        return true;
      }

      return false;
    } catch (error) {
      this.logError(`修改資源失敗 (${resourceType})`, error);
      return false;
    }
  }

  /**
   * 批量修改多種資源
   * @param {BulkModification} modification - 批量修改參數
   * @returns {boolean} 修改是否成功
   */
  bulkModifyResources(modification) {
    const {
      changes,
      reason,
      source = "system",
      allowNegative = false,
    } = modification;

    if (!this.isActive) {
      this.logWarning("ResourceManager 已停用，無法批量修改資源");
      return false;
    }

    try {
      const modifications = [];
      let allSuccessful = true;

      // 預先驗證所有修改
      for (const [resourceType, amount] of Object.entries(changes)) {
        if (
          !this._isValidResourceType(resourceType) ||
          !this._isValidNumber(amount)
        ) {
          this.logError(`無效的批量修改參數: ${resourceType}=${amount}`);
          return false;
        }

        const oldValue = this.gameState.getStateValue(
          `resources.${resourceType}`,
          0
        );
        const newValue = allowNegative
          ? oldValue + amount
          : Math.max(0, oldValue + amount);

        modifications.push({
          resourceType: /** @type {ResourceType} */ (resourceType),
          oldValue,
          newValue,
          changeAmount: amount,
        });
      }

      // 執行所有修改
      for (const mod of modifications) {
        const success = this.gameState.setStateValue(
          `resources.${mod.resourceType}`,
          mod.newValue,
          reason
        );

        if (success) {
          this._recordModification({
            ...mod,
            reason,
            source,
            timestamp: new Date().toISOString(),
          });

          this._checkResourceThreshold(mod.resourceType, mod.newValue);
        } else {
          allSuccessful = false;
        }
      }

      // 發送批量修改事件（使用 BaseManager 統一介面）
      if (allSuccessful) {
        this.emitEvent("bulk_modified", {
          changes: modifications,
          reason,
          source,
        });
      }

      return allSuccessful;
    } catch (error) {
      this.logError("批量修改資源失敗", error);
      return false;
    }
  }

  /**
   * 資源轉移（租客與房東之間）
   * @param {string} from - 來源（'landlord' 或租客 ID）
   * @param {string} to - 目標（'landlord' 或租客 ID）
   * @param {Partial<Resources>} resources - 要轉移的資源
   * @param {string} reason - 轉移原因
   * @returns {boolean} 轉移是否成功
   */
  transferResource(from, to, resources, reason) {
    if (!this.isActive) {
      this.logWarning("ResourceManager 已停用，無法轉移資源");
      return false;
    }

    try {
      let success = true;

      // 驗證來源是否有足夠資源
      for (const [resourceType, amount] of Object.entries(resources)) {
        if (
          !this._hasEnoughResource(
            from,
            /** @type {ResourceType} */ (resourceType),
            amount
          )
        ) {
          this.logWarning(`${from} 的 ${resourceType} 不足，需要 ${amount}`);
          success = false;
          break;
        }
      }

      if (!success) {
        this._recordTransfer({
          from,
          to,
          resources,
          reason,
          success: false,
          timestamp: new Date().toISOString(),
        });
        return false;
      }

      // 執行轉移
      for (const [resourceType, amount] of Object.entries(resources)) {
        const type = /** @type {ResourceType} */ (resourceType);

        // 從來源扣除
        this._modifyResourceByOwner(
          from,
          type,
          -amount,
          `轉移給${to}: ${reason}`
        );

        // 增加到目標
        this._modifyResourceByOwner(
          to,
          type,
          amount,
          `從${from}轉移: ${reason}`
        );
      }

      // 記錄成功轉移
      this._recordTransfer({
        from,
        to,
        resources,
        reason,
        success: true,
        timestamp: new Date().toISOString(),
      });

      // 發送轉移完成事件（使用 BaseManager 統一介面）
      this.emitEvent("transfer_completed", {
        from,
        to,
        resources,
        reason,
      });

      return true;
    } catch (error) {
      this.logError("資源轉移失敗", error);
      return false;
    }
  }

  // ==========================================
  // 資源檢查與驗證
  // ==========================================

  /**
   * 檢查資源是否足夠
   * @param {ResourceType} resourceType - 資源類型
   * @param {number} amount - 需要的數量
   * @returns {boolean} 資源是否足夠
   */
  hasEnoughResource(resourceType, amount) {
    if (
      !this._isValidResourceType(resourceType) ||
      !this._isValidNumber(amount)
    ) {
      return false;
    }

    const currentAmount = this.gameState.getStateValue(
      `resources.${resourceType}`,
      0
    );
    return currentAmount >= amount;
  }

  /**
   * 檢查多種資源是否足夠
   * @param {Partial<Resources>} requirements - 資源需求
   * @returns {boolean} 所有資源是否都足夠
   */
  hasEnoughResources(requirements) {
    return Object.entries(requirements).every(([type, amount]) =>
      this.hasEnoughResource(/** @type {ResourceType} */ (type), amount)
    );
  }

  // ==========================================
  // 資源狀態分析
  // ==========================================

  /**
   * 取得資源狀態評估
   * @param {ResourceType} resourceType - 資源類型
   * @returns {ResourceStatus} 資源狀態評估結果
   */
  getResourceStatus(resourceType) {
    if (!this._isValidResourceType(resourceType)) {
      throw new Error(`無效的資源類型: ${resourceType}`);
    }

    const currentValue = this.gameState.getStateValue(
      `resources.${resourceType}`,
      0
    );
    const thresholds = this.thresholds.get(resourceType);
    const consumptionStats = this.consumptionStats.get(resourceType);

    if (!thresholds || !consumptionStats) {
      throw new Error(`缺少 ${resourceType} 的配置資料`);
    }

    // 判斷狀態等級
    let level = "abundant";
    if (currentValue <= thresholds.emergency) {
      level = "emergency";
    } else if (currentValue <= thresholds.critical) {
      level = "critical";
    } else if (currentValue <= thresholds.warning) {
      level = "warning";
    } else if (currentValue <= thresholds.warning * 2) {
      level = "normal";
    }

    // 計算預估剩餘天數
    const dailyConsumption = consumptionStats.dailyConsumption || 1;
    const daysRemaining = Math.floor(currentValue / dailyConsumption);

    // 生成建議
    const recommendations = this._generateRecommendations(
      resourceType,
      level,
      daysRemaining
    );

    return {
      resourceType,
      currentValue,
      level:
        /** @type {'abundant'|'normal'|'warning'|'critical'|'emergency'} */ (
          level
        ),
      daysRemaining,
      recommendations,
    };
  }

  /**
   * 分析資源稀缺性
   * @param {ResourceType} resourceType - 資源類型
   * @returns {ScarcityAnalysis} 稀缺性分析結果
   */
  analyzeResourceScarcity(resourceType) {
    if (!this._isValidResourceType(resourceType)) {
      throw new Error(`無效的資源類型: ${resourceType}`);
    }

    const currentValue = this.gameState.getStateValue(
      `resources.${resourceType}`,
      0
    );
    const stats = this.consumptionStats.get(resourceType);
    const thresholds = this.thresholds.get(resourceType);

    if (!stats || !thresholds) {
      throw new Error(`缺少 ${resourceType} 的統計資料`);
    }

    // 計算稀缺指數 (0-100)
    const maxValue = thresholds.warning * 3; // 假設最大正常值
    const scarcityIndex = Math.max(
      0,
      Math.min(100, 100 - (currentValue / maxValue) * 100)
    );

    // 計算趨勢
    const trend =
      stats.trend > 0.1
        ? "increasing"
        : stats.trend < -0.1
        ? "decreasing"
        : "stable";

    // 預估耗盡天數
    const netChange = stats.dailyConsumption; // 簡化計算
    const depletionDays =
      netChange > 0 ? Math.floor(currentValue / netChange) : Infinity;

    return {
      resourceType,
      scarcityIndex,
      consumptionRate: stats.dailyConsumption,
      productionRate: 0, // TODO: 實作生產率統計
      netChange: -netChange,
      trend: /** @type {'increasing'|'stable'|'decreasing'} */ (trend),
      depletionDays: Math.min(depletionDays, 9999),
    };
  }

  // ==========================================
  // 資源價值與交易
  // ==========================================

  /**
   * 取得資源市場價值
   * @param {ResourceType} resourceType - 資源類型
   * @param {number} amount - 數量
   * @returns {number} 市場價值（以現金為單位）
   */
  getResourceValue(resourceType, amount) {
    if (
      !this._isValidResourceType(resourceType) ||
      !this._isValidNumber(amount)
    ) {
      return 0;
    }

    const unitValue = this.resourceValues[resourceType] || 1;
    return Math.floor(unitValue * amount);
  }

  /**
   * 計算交易等價物
   * @param {ResourceType} fromType - 來源資源類型
   * @param {number} fromAmount - 來源數量
   * @param {ResourceType} toType - 目標資源類型
   * @returns {number} 等價的目標資源數量
   */
  calculateTradeEquivalents(fromType, fromAmount, toType) {
    if (
      !this._isValidResourceType(fromType) ||
      !this._isValidResourceType(toType)
    ) {
      return 0;
    }

    const fromValue = this.getResourceValue(fromType, fromAmount);
    const toUnitValue = this.resourceValues[toType] || 1;

    return Math.floor(fromValue / toUnitValue);
  }

  // ==========================================
  // 院子採集系統（統一 harvest_ 業務事件命名）
  // ==========================================

  /**
   * 院子採集 - 主要入口點
   * @returns {boolean} 採集是否成功
   */
  harvestYard() {
    if (!this.isActive) {
      this.logWarning("ResourceManager 已停用，無法進行院子採集");
      return false;
    }

    try {
      // 檢查採集條件
      if (!this.canHarvest()) {
        return false;
      }

      // 取得基礎採集量（純基礎功能，不計算技能加成）
      const harvestConfig = this._getHarvestConfig();
      const baseAmount = harvestConfig.baseAmount || 2;

      // 執行資源修改
      const success = this.modifyResource("food", baseAmount, "院子採集");

      if (success) {
        // 更新採集狀態
        this._updateHarvestState();

        // 發送採集完成事件（使用 harvest_ 業務前綴，BaseManager 自動處理）
        this.emitEvent("harvest_completed", {
          baseAmount: baseAmount,
          finalAmount: baseAmount, // 當前階段等於基礎值
          source: "yard_harvest",
          timestamp: new Date().toISOString(),
        });

        this.addLog(`院子採集獲得 ${baseAmount} 食物`, "event");
        return true;
      }

      return false;
    } catch (error) {
      this.logError("院子採集失敗", error);
      return false;
    }
  }

  /**
   * 檢查是否可以進行院子採集
   * @returns {boolean} 是否可以採集
   */
  canHarvest() {
    try {
      // 檢查是否已使用每日採集
      const harvestUsed = this.gameState.getStateValue("harvestUsed", false);
      if (harvestUsed) {
        this.addLog("今日已進行過院子採集", "event");
        return false;
      }

      // 檢查採集冷卻時間
      const harvestCooldown = this.gameState.getStateValue(
        "harvestCooldown",
        0
      );
      if (harvestCooldown > 0) {
        this.addLog(`院子採集冷卻中，剩餘 ${harvestCooldown} 天`, "event");
        return false;
      }

      return true;
    } catch (error) {
      this.logError("檢查採集條件失敗", error);
      return false;
    }
  }

  /**
   * 檢查採集冷卻狀態
   * @returns {Object} 採集狀態資訊
   */
  getHarvestStatus() {
    const harvestUsed = this.gameState.getStateValue("harvestUsed", false);
    const harvestCooldown = this.gameState.getStateValue("harvestCooldown", 0);
    const config = this._getHarvestConfig();

    return {
      canHarvest: this.canHarvest(),
      usedToday: harvestUsed,
      cooldownRemaining: harvestCooldown,
      cooldownDays: config.cooldownDays || 2,
      baseAmount: config.baseAmount || 2,
    };
  }

  /**
   * 重置每日採集狀態（由日夜循環調用）
   * @returns {void}
   */
  resetDailyHarvestStatus() {
    try {
      // 重置每日採集標記
      this.gameState.setStateValue(
        "dailyActions.harvestUsed",
        false,
        "daily_reset"
      );

      // 減少採集冷卻
      const currentCooldown = this.gameState.getStateValue(
        "dailyActions.harvestCooldown",
        0
      );
      if (currentCooldown > 0) {
        const newCooldown = Math.max(0, currentCooldown - 1);
        this.gameState.setStateValue(
          "dailyActions.harvestCooldown",
          newCooldown,
          "cooldown_decrease"
        );

        if (newCooldown === 0) {
          this.logSuccess("院子採集冷卻完成，明日可再次採集");
        } else {
          this.addLog(`院子採集冷卻剩餘 ${newCooldown} 天`, "event");
        }
      }
    } catch (error) {
      this.logError("重置每日採集狀態失敗", error);
    }
  }

  // ==========================================
  // 閾值檢查與警告系統
  // ==========================================

  /**
   * 檢查所有資源閾值
   * @private
   * @returns {void}
   */
  _checkAllResourceThresholds() {
    ["food", "materials", "medical", "fuel", "cash"].forEach((resourceType) => {
      const currentValue = this.gameState.getStateValue(
        `resources.${resourceType}`,
        0
      );
      this._checkResourceThreshold(
        /** @type {ResourceType} */ (resourceType),
        currentValue
      );
    });
  }

  /**
   * 檢查單一資源閾值
   * @param {ResourceType} resourceType - 資源類型
   * @param {number} currentValue - 當前數值
   * @private
   * @returns {void}
   */
  _checkResourceThreshold(resourceType, currentValue) {
    const thresholds = this.thresholds.get(resourceType);
    if (!thresholds) return;

    let alertLevel = null;
    let thresholdType = "";

    if (currentValue <= thresholds.emergency) {
      alertLevel = "emergency";
      thresholdType = "emergency";
    } else if (currentValue <= thresholds.critical) {
      alertLevel = "critical";
      thresholdType = "critical";
    } else if (currentValue <= thresholds.warning) {
      alertLevel = "warning";
      thresholdType = "warning";
    }

    if (alertLevel) {
      // 使用 BaseManager 統一事件介面發送閾值警告
      this.emitEvent("threshold_warning", {
        resourceType,
        currentValue,
        warningLevel: alertLevel,
        thresholdType,
        daysRemaining: this._estimateDaysRemaining(resourceType, currentValue),
      });

      if (alertLevel === "critical" || alertLevel === "emergency") {
        this.emitEvent("critical_low", {
          resourceType,
          currentValue,
          criticalLevel: alertLevel,
        });
      }
    }
  }

  // ==========================================
  // 歷史記錄與統計
  // ==========================================

  /**
   * 取得資源修改歷史
   * @param {number} [limit=20] - 返回記錄數量限制
   * @returns {ResourceModification[]} 資源修改歷史
   */
  getModificationHistory(limit = 20) {
    return this.modificationHistory.slice(-limit);
  }

  /**
   * 取得資源轉移歷史
   * @param {number} [limit=20] - 返回記錄數量限制
   * @returns {ResourceTransfer[]} 資源轉移歷史
   */
  getTransferHistory(limit = 20) {
    return this.transferHistory.slice(-limit);
  }

  // ==========================================
  // 私有輔助方法
  // ==========================================

  /**
   * 驗證事件資料是否有效
   * @param {any} data - 要驗證的事件資料
   * @private
   * @returns {boolean} 是否為有效的事件資料物件
   */
  _isValidEventData(data) {
    return data && typeof data === "object" && data !== null;
  }

  /**
   * 更新消費統計
   * @private
   * @returns {void}
   */
  _updateConsumptionStats() {
    // TODO: 實作詳細的消費統計更新邏輯
    // 這裡先簡化處理
    const currentDay = this.gameState.getStateValue("day", 1);

    ["food", "materials", "medical", "fuel", "cash"].forEach((resourceType) => {
      const stats = this.consumptionStats.get(
        /** @type {ResourceType} */ (resourceType)
      );
      if (stats) {
        stats.lastUpdated = Date.now();
        // 基於租客數量更新消費基準
        const tenantCount = this.gameState.getAllTenants().length;

        switch (resourceType) {
          case "food":
            stats.dailyConsumption = 2 + tenantCount * 2; // 房東2 + 租客每人2
            break;
          case "fuel":
            stats.dailyConsumption = 1; // 固定每日消耗
            break;
          default:
            // 其他資源根據實際使用情況動態計算
            break;
        }
      }
    });
  }

  /**
   * 重新計算消費基準線
   * @private
   * @returns {void}
   */
  _recalculateBaselines() {
    this._updateConsumptionStats();
    this.logSuccess("重新計算資源消費基準線");
  }

  /**
   * 記錄消費行為
   * @param {Partial<Resources>} consumption - 消費的資源
   * @param {string} source - 消費來源
   * @private
   * @returns {void}
   */
  _recordConsumption(consumption, source) {
    // TODO: 實作詳細的消費記錄邏輯
    Object.entries(consumption).forEach(([resourceType, amount]) => {
      const stats = this.consumptionStats.get(
        /** @type {ResourceType} */ (resourceType)
      );
      if (stats && amount > 0) {
        // 更新消費統計
        stats.dailyConsumption = (stats.dailyConsumption + amount) / 2; // 簡化的移動平均
      }
    });
  }

  /**
   * 檢查指定擁有者（房東或租客）的資源是否足夠
   * @private
   * @param {string} owner - 資源擁有者 ('landlord' 或租客 ID)
   * @param {ResourceType} resourceType - 資源類型
   * @param {number} amount - 需要的數量
   * @returns {boolean} 資源是否足夠
   */
  _hasEnoughResource(owner, resourceType, amount) {
    if (owner === "landlord") {
      return this.hasEnoughResource(resourceType, amount);
    } else {
      // 檢查租客個人資源
      const tenants = this.gameState.getAllTenants();
      const tenant = tenants.find((t) => t.id === owner);

      if (!tenant || !tenant.personalResources) {
        return false;
      }

      const currentAmount = tenant.personalResources[resourceType] || 0;
      return currentAmount >= amount;
    }
  }

  /**
   * 修改指定擁有者（房東或租客）的資源數量
   * @private
   * @param {string} owner - 資源擁有者 ('landlord' 或租客 ID)
   * @param {ResourceType} resourceType - 資源類型
   * @param {number} amount - 變更數量（可為負數）
   * @param {string} reason - 修改原因
   * @returns {boolean} 修改是否成功
   */
  _modifyResourceByOwner(owner, resourceType, amount, reason) {
    if (owner === "landlord") {
      return this.modifyResource(resourceType, amount, reason, "transfer");
    } else {
      // 修改租客個人資源
      const tenants = this.gameState.getAllTenants();
      const tenant = tenants.find((t) => t.id === owner);

      if (!tenant) {
        this.logError(`找不到租客: ${owner}`);
        return false;
      }

      if (!tenant.personalResources) {
        tenant.personalResources = {
          food: 0,
          materials: 0,
          medical: 0,
          fuel: 0,
          cash: 0,
        };
      }

      const oldValue = tenant.personalResources[resourceType] || 0;
      const newValue = Math.max(0, oldValue + amount);
      tenant.personalResources[resourceType] = newValue;

      // 更新遊戲狀態中的租客資料
      return this.gameState.setState(
        {
          rooms: this.gameState.getStateValue("rooms", []),
        },
        reason
      );
    }
  }

  /**
   * 記錄資源修改歷史
   * @param {ResourceModification} modification - 修改記錄
   * @private
   * @returns {void}
   */
  _recordModification(modification) {
    this.modificationHistory.push(modification);

    // 限制歷史記錄數量
    if (
      this.modificationHistory.length >
      SYSTEM_LIMITS.HISTORY.MAX_EXECUTION_HISTORY
    ) {
      this.modificationHistory.shift();
    }
  }

  /**
   * 記錄資源轉移歷史
   * @param {ResourceTransfer} transfer - 轉移記錄
   * @private
   * @returns {void}
   */
  _recordTransfer(transfer) {
    this.transferHistory.push(transfer);

    // 限制歷史記錄數量
    if (
      this.transferHistory.length > SYSTEM_LIMITS.HISTORY.MAX_EXECUTION_HISTORY
    ) {
      this.transferHistory.shift();
    }
  }

  /**
   * 取得採集配置
   * @private
   * @returns {Object} 採集配置
   */
  _getHarvestConfig() {
    try {
      const rules = this.gameState.getStateValue("system.gameRules") || {};
      return (
        rules.mechanics?.harvest || {
          baseAmount: 2,
          cooldownDays: 2,
        }
      );
    } catch (error) {
      this.logWarning("載入採集配置失敗，使用預設值");
      return {
        baseAmount: 2,
        cooldownDays: 2,
      };
    }
  }

  /**
   * 更新採集狀態
   * @private
   * @returns {void}
   */
  _updateHarvestState() {
    try {
      const config = this._getHarvestConfig();

      // 標記今日已使用採集
      this.gameState.setStateValue(
        "dailyActions.harvestUsed",
        true,
        "yard_harvest_used"
      );

      // 設定採集冷卻
      this.gameState.setStateValue(
        "dailyActions.harvestCooldown",
        config.cooldownDays || 2,
        "harvest_cooldown_set"
      );

      this.addLog(`院子採集冷卻 ${config.cooldownDays || 2} 天已設定`, "event");
    } catch (error) {
      this.logError("更新採集狀態失敗", error);
    }
  }

  /**
   * 預估資源剩餘天數
   * @param {ResourceType} resourceType - 資源類型
   * @param {number} currentValue - 當前數值
   * @private
   * @returns {number} 預估剩餘天數
   */
  _estimateDaysRemaining(resourceType, currentValue) {
    const stats = this.consumptionStats.get(resourceType);
    if (!stats || stats.dailyConsumption <= 0) {
      return 999; // 無消耗或未知
    }

    return Math.floor(currentValue / stats.dailyConsumption);
  }

  /**
   * 生成資源建議
   * @param {ResourceType} resourceType - 資源類型
   * @param {string} level - 狀態等級
   * @param {number} daysRemaining - 剩餘天數
   * @private
   * @returns {string[]} 建議列表
   */
  _generateRecommendations(resourceType, level, daysRemaining) {
    const recommendations = [];

    if (level === "emergency") {
      recommendations.push(`🚨 ${resourceType} 極度短缺！立即尋找補給來源`);
      recommendations.push(`考慮使用其他資源與商人交易獲得 ${resourceType}`);
    } else if (level === "critical") {
      recommendations.push(
        `⚠️ ${resourceType} 嚴重不足，剩餘約 ${daysRemaining} 天`
      );
      recommendations.push(`優先派遣租客搜刮 ${resourceType}`);
    } else if (level === "warning") {
      recommendations.push(`📋 ${resourceType} 存量偏低，建議補充`);
      recommendations.push(`檢查是否有租客技能可生產 ${resourceType}`);
    }

    return recommendations;
  }

  /**
   * 取得資源摘要
   * @private
   * @returns {Object} 資源摘要
   */
  _getResourceSummary() {
    const resources = this.gameState.getStateValue("resources", {});
    const summary = {};

    Object.entries(resources).forEach(([type, value]) => {
      const status = this.getResourceStatus(/** @type {ResourceType} */ (type));
      summary[type] = {
        current: value,
        level: status.level,
        daysRemaining: status.daysRemaining,
      };
    });

    return summary;
  }

  /**
   * 驗證資源類型是否有效
   * @param {string} resourceType - 要驗證的資源類型
   * @private
   * @returns {resourceType is ResourceType} 是否為有效的資源類型
   */
  _isValidResourceType(resourceType) {
    return ["food", "materials", "medical", "fuel", "cash"].includes(
      resourceType
    );
  }

  /**
   * 驗證數字是否有效
   * @param {any} value - 要驗證的值
   * @private
   * @returns {value is number} 是否為有效數字
   */
  _isValidNumber(value) {
    return typeof value === "number" && !isNaN(value) && isFinite(value);
  }


  /**
   * 處理每日資源消費（最小實作）
   * @returns {Promise<boolean>} 處理是否成功
   */
  async processDailyConsumption() {
    try {
      const tenants = this.gameState.getAllTenants();

      // 簡單消費計算：房東2食物 + 租客每人2食物 + 1燃料
      const foodConsumption = 2 + (tenants.length * 2);
      const fuelConsumption = 1;

      // 執行消費
      this.modifyResource('food', -foodConsumption, '每日食物消費', 'daily_cycle');
      this.modifyResource('fuel', -fuelConsumption, '每日燃料消費', 'daily_cycle');

      return true;
    } catch (error) {
      this.logError("每日消費處理失敗", error);
      return false;
    }
  }

  /**
   * 檢查所有資源閾值（公開現有私有方法）
   * @returns {void}
   */
  checkAllResourceThresholds() {
    this._checkAllResourceThresholds();
  }

  // ==========================================
  // 清理與維護
  // ==========================================

  /**
   * 清理資源管理器（覆寫 BaseManager 方法）
   * @returns {void}
   */
  cleanup() {
    this.thresholds.clear();
    this.consumptionStats.clear();
    this.modificationHistory = [];
    this.transferHistory = [];

    // 調用父類清理方法
    super.cleanup();

    this.logSuccess("ResourceManager 已清理");
  }
}

export default ResourceManager;

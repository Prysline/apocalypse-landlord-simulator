// @ts-check

/**
 * @fileoverview ResourceManager.js - 資源流轉控制核心
 * 職責：統一管理所有資源流轉、閾值監控、驗證控制、稀缺性分析
 */

import GameState from "../core/GameState.js";
import EventBus from "../core/EventBus.js";
import { SYSTEM_LIMITS } from "../utils/constants.js";

/**
 * 資源類型聯合型別
 * @typedef {'food'|'materials'|'medical'|'fuel'|'cash'} ResourceType
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
 * @property {string} from - 來源（'landlord' 或租客名稱）
 * @property {string} to - 目標（'landlord' 或租客名稱）
 * @property {Partial<Resources>} resources - 轉移的資源
 * @property {string} reason - 轉移原因
 * @property {boolean} success - 轉移是否成功
 * @property {string} timestamp - 轉移時間戳記
 */

/**
 * 資源閾值配置
 * @typedef {Object} ResourceThresholds
 * @property {number} warning - 警告線
 * @property {number} critical - 危險線
 * @property {number} emergency - 緊急線
 * @property {number} [maximum] - 最大值（可選）
 */

/**
 * 資源狀態評估結果
 * @typedef {Object} ResourceStatus
 * @property {ResourceType} resourceType - 資源類型
 * @property {number} currentValue - 當前數值
 * @property {'abundant'|'normal'|'warning'|'critical'|'emergency'} level - 狀態等級
 * @property {number} daysRemaining - 預估剩餘天數
 * @property {string[]} recommendations - 建議操作
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
 * 資源物件
 * @typedef {Object} Resources
 * @property {number} food - 食物數量
 * @property {number} materials - 建材數量
 * @property {number} medical - 醫療用品數量
 * @property {number} fuel - 燃料數量
 * @property {number} cash - 現金數量
 */

/**
 * 資源流轉控制管理器
 * 統一管理所有資源相關操作，提供閾值監控、驗證控制和稀缺性分析
 * @class
 */
export class ResourceManager {
  /**
   * 建立 ResourceManager 實例
   * @param {GameState} gameState - 遊戲狀態管理器
   * @param {EventBus} eventBus - 事件通信系統
   */
  constructor(gameState, eventBus) {
    /**
     * 遊戲狀態管理器
     * @type {GameState}
     * @private
     */
    this.gameState = gameState;

    /**
     * 事件通信系統
     * @type {EventBus}
     * @private
     */
    this.eventBus = eventBus;

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

    /**
     * 管理器啟用狀態
     * @type {boolean}
     * @private
     */
    this.isActive = true;

    this._initialize();
    console.log("ResourceManager 初始化完成");
  }

  /**
   * 初始化資源管理器
   * @private
   * @returns {void}
   */
  _initialize() {
    // 載入閾值配置
    this._loadThresholds();

    // 載入資源價值配置
    this._loadResourceValues();

    // 設定事件監聽器
    this._setupEventListeners();

    // 初始化消費統計
    this._initializeConsumptionStats();
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

      console.log("資源閾值配置載入完成");
    } catch (error) {
      console.error("載入閾值配置失敗，使用預設值:", error);
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

      console.log("資源價值配置載入完成");
    } catch (error) {
      console.error("載入資源價值配置失敗，使用預設值:", error);
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
   * 設定事件監聽器
   * @private
   * @returns {void}
   */
  _setupEventListeners() {
    // 監聽每日推進，觸發資源分析
    this.eventBus.on("day_advanced", () => {
      this._updateConsumptionStats();
      this._checkAllResourceThresholds();
    });

    // 監聽租客變更，更新消費基準
    this.eventBus.on("tenant_hired", () => this._recalculateBaselines());
    this.eventBus.on("tenant_evicted", () => this._recalculateBaselines());

    // 監聽技能使用，記錄消費
    this.eventBus.on("skill_used", (eventObj) => {
      const data = eventObj.data;
      if (this._isValidEventData(data) && data.resourceCost) {
        // ✅ 型別安全
        this._recordConsumption(data.resourceCost, "skill_usage");
      }
    });
  }

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
      console.warn("ResourceManager 已停用，無法修改資源");
      return false;
    }

    // 驗證輸入參數
    if (!this._isValidResourceType(resourceType)) {
      console.error(`無效的資源類型: ${resourceType}`);
      return false;
    }

    if (!this._isValidNumber(amount)) {
      console.error(`無效的數量: ${amount}`);
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

        // 發送事件通知
        this.eventBus.emit("resource_modified", {
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
      console.error(`修改資源失敗 (${resourceType}):`, error);
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
      console.warn("ResourceManager 已停用，無法批量修改資源");
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
          console.error(`無效的批量修改參數: ${resourceType}=${amount}`);
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

      // 發送批量修改事件
      if (allSuccessful) {
        this.eventBus.emit("resources_bulk_modified", {
          changes: modifications,
          reason,
          source,
        });
      }

      return allSuccessful;
    } catch (error) {
      console.error("批量修改資源失敗:", error);
      return false;
    }
  }

  /**
   * 資源轉移（租客與房東之間）
   * @param {string} from - 來源（'landlord' 或租客名稱）
   * @param {string} to - 目標（'landlord' 或租客名稱）
   * @param {Partial<Resources>} resources - 要轉移的資源
   * @param {string} reason - 轉移原因
   * @returns {boolean} 轉移是否成功
   */
  transferResource(from, to, resources, reason) {
    if (!this.isActive) {
      console.warn("ResourceManager 已停用，無法轉移資源");
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
          console.warn(`${from} 的 ${resourceType} 不足，需要 ${amount}`);
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

      // 發送轉移完成事件
      this.eventBus.emit("resource_transfer_completed", {
        from,
        to,
        resources,
        reason,
      });

      return true;
    } catch (error) {
      console.error("資源轉移失敗:", error);
      return false;
    }
  }

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
      this.eventBus.emit("resource_threshold_warning", {
        resourceType,
        currentValue,
        warningLevel: alertLevel,
        thresholdType,
        daysRemaining: this._estimateDaysRemaining(resourceType, currentValue),
      });

      if (alertLevel === "critical" || alertLevel === "emergency") {
        this.eventBus.emit("resource_critical_low", {
          resourceType,
          currentValue,
          criticalLevel: alertLevel,
        });
      }
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
    console.log("重新計算資源消費基準線");
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
   * 檢查特定擁有者是否有足夠資源
   * @param {string} owner - 擁有者（'landlord' 或租客名稱）
   * @param {ResourceType} resourceType - 資源類型
   * @param {number} amount - 需要的數量
   * @private
   * @returns {boolean} 是否有足夠資源
   */
  _hasEnoughResource(owner, resourceType, amount) {
    if (owner === "landlord") {
      return this.hasEnoughResource(resourceType, amount);
    } else {
      // 檢查租客個人資源
      const tenants = this.gameState.getAllTenants();
      const tenant = tenants.find((t) => t.name === owner);

      if (!tenant || !tenant.personalResources) {
        return false;
      }

      const currentAmount = tenant.personalResources[resourceType] || 0;
      return currentAmount >= amount;
    }
  }

  /**
   * 按擁有者修改資源
   * @param {string} owner - 擁有者（'landlord' 或租客名稱）
   * @param {ResourceType} resourceType - 資源類型
   * @param {number} amount - 變更數量
   * @param {string} reason - 變更原因
   * @private
   * @returns {boolean} 修改是否成功
   */
  _modifyResourceByOwner(owner, resourceType, amount, reason) {
    if (owner === "landlord") {
      return this.modifyResource(resourceType, amount, reason, "transfer");
    } else {
      // 修改租客個人資源
      const tenants = this.gameState.getAllTenants();
      const tenant = tenants.find((t) => t.name === owner);

      if (!tenant) {
        console.error(`找不到租客: ${owner}`);
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

  /**
   * 取得系統統計資訊
   * @returns {Object} 系統統計資訊
   */
  getStatus() {
    return {
      isActive: this.isActive,
      thresholdCount: this.thresholds.size,
      modificationHistory: this.modificationHistory.length,
      transferHistory: this.transferHistory.length,
      consumptionStats: Object.fromEntries(this.consumptionStats),
    };
  }

  /**
   * 暫停資源管理器
   * @returns {void}
   */
  pause() {
    this.isActive = false;
    console.log("ResourceManager 已暫停");
  }

  /**
   * 恢復資源管理器
   * @returns {void}
   */
  resume() {
    this.isActive = true;
    console.log("ResourceManager 已恢復");
  }

  /**
   * 清理資源管理器
   * @returns {void}
   */
  cleanup() {
    this.thresholds.clear();
    this.consumptionStats.clear();
    this.modificationHistory = [];
    this.transferHistory = [];
    this.isActive = false;
    console.log("ResourceManager 已清理");
  }
}

export default ResourceManager;

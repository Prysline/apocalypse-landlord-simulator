// @ts-check

/**
 * @fileoverview SatisfactionManager.js - 租客滿意度專責管理系統
 * 職責：滿意度計算、狀態評估、歷史追蹤、警告機制
 * 設計模式：單一職責原則，專注滿意度相關邏輯
 */

import BaseManager from "./BaseManager.js";
import { SYSTEM_LIMITS } from "../utils/constants.js";

/**
 * @see {@link ../Type.js} 完整類型定義
 * @typedef {import('../Type.js').SatisfactionLevel} SatisfactionLevel
 * @typedef {import('../Type.js').Tenant} Tenant
 * @typedef {import('../Type.js').Room} Room
 */

/**
 * 滿意度狀態
 * @typedef {Object} SatisfactionStatus
 * @property {number} value - 滿意度數值 (0-100)
 * @property {SatisfactionLevel} level - 滿意度等級
 * @property {string} emoji - 對應表情符號
 * @property {string} description - 狀態描述
 * @property {string[]} issues - 負面影響因子
 * @property {string[]} positives - 正面影響因子
 */

/**
 * 滿意度歷史記錄
 * @typedef {Object} SatisfactionHistory
 * @property {number} tenantId - 租客ID
 * @property {number} day - 遊戲天數
 * @property {number} oldValue - 變更前數值
 * @property {number} newValue - 變更後數值
 * @property {string} reason - 變更原因
 * @property {string} timestamp - 時間戳記
 */

/**
 * 滿意度因子配置
 * @typedef {Object} SatisfactionFactors
 * @property {number} reinforcedRoom - 加固房間加成
 * @property {number} needsRepair - 房間需維修扣分
 * @property {number} lowPersonalFood - 個人食物不足扣分
 * @property {number} highPersonalCash - 個人現金充足加分
 * @property {number} highBuildingDefense - 建築防禦高加分
 * @property {number} lowBuildingDefense - 建築防禦低扣分
 * @property {number} elderHarmonyBonus - 長者和諧加成
 */

/**
 * 滿意度專責管理系統
 * 負責所有與租客滿意度相關的計算、評估、追蹤和警告機制
 * @class
 * @extends BaseManager
 */
export class SatisfactionManager extends BaseManager {
  /**
   * 建立 SatisfactionManager 實例
   * @param {Object} gameState - 遊戲狀態管理器
   * @param {Object} eventBus - 事件總線
   * @param {Object} satisfactionConfig - 滿意度系統配置
   * @param {Object} satisfactionFactors - 滿意度因子配置
   */
  constructor(gameState, eventBus, satisfactionConfig, satisfactionFactors) {
    super(gameState, eventBus, "SatisfactionManager");

    // 配置參數
    this.satisfactionConfig = satisfactionConfig;
    this.satisfactionFactors = satisfactionFactors;

    // 運行時數據
    /** @type {Map<number, number>} 租客滿意度映射 */
    this.tenantSatisfaction = new Map();

    /** @type {SatisfactionHistory[]} 滿意度變更歷史 */
    this.satisfactionHistory = [];

    // 快取數據
    this.lastCalculationCache = new Map();
    this.cacheValidityTime = 5000; // 5秒快取有效期

    console.log("😊 SatisfactionManager 初始化中...");
  }

  // ==========================================
  // BaseManager 實作
  // ==========================================

  getModulePrefix() {
    return "satisfaction";
  }

  setupEventListeners() {
    // 監聽資源變更影響滿意度
    this.onEvent("resource_modified", (eventObj) => {
      const data = eventObj.data;
      if (data?.reason === "tenant_purchase") {
        this.handleResourceChange(data);
      }
    }, { skipPrefix: true });

    // 監聽建築防禦變更
    this.onEvent("building_defense_changed", () => {
      this.handleDefenseChange();
    }, { skipPrefix: true });

    // 監聽新一天開始
    this.onEvent("day_advanced", () => {
      this.performDailyUpdate();
    }, { skipPrefix: true });

    console.log("✅ SatisfactionManager 事件監聽器設置完成");
  }

  async initialize() {
    this.loadExistingSatisfaction();
    this.setupEventListeners();
    this.markInitialized(true);
    console.log("✅ SatisfactionManager 初始化完成");
    return true;
  }

  // ==========================================
  // 核心滿意度管理
  // ==========================================

  /**
   * 更新租客滿意度
   * @param {number} [tenantId] - 特定租客ID，不提供則更新所有租客
   * @returns {void}
   */
  updateSatisfaction(tenantId) {
    if (!this.initialized) {
      console.warn("SatisfactionManager 未初始化");
      return;
    }

    if (tenantId) {
      this.updateIndividualSatisfaction(tenantId);
    } else {
      this.updateAllTenantsSatisfaction();
    }

    this.syncToGameState();
  }

  /**
   * 取得租客滿意度
   * @param {number} tenantId - 租客ID
   * @returns {number} 滿意度數值 (0-100)
   */
  getSatisfaction(tenantId) {
    return this.tenantSatisfaction.get(tenantId) || this.satisfactionConfig.baseValue;
  }

  /**
   * 修改租客滿意度
   * @param {number} tenantId - 租客ID
   * @param {number} change - 變更量
   * @param {string} reason - 變更原因
   * @returns {number} 新的滿意度值
   */
  modifySatisfaction(tenantId, change, reason) {
    const oldValue = this.getSatisfaction(tenantId);
    const newValue = this.clampSatisfaction(oldValue + change);

    this.tenantSatisfaction.set(tenantId, newValue);

    if (Math.abs(change) >= 1) {
      this.recordSatisfactionChange(tenantId, oldValue, newValue, reason);
      this.checkSatisfactionWarnings(tenantId, newValue);
    }

    this.syncToGameState();
    return newValue;
  }

  /**
   * 計算租客滿意度
   * @param {Tenant} tenant - 租客物件
   * @param {Room} room - 房間物件
   * @returns {number} 計算後的滿意度值 (0-100)
   */
  calculateSatisfaction(tenant, room) {
    // 檢查快取
    const cacheKey = `${tenant.id}_${Date.now()}`;
    const cached = this.getCachedCalculation(tenant.id);
    if (cached) {
      return cached;
    }

    let satisfaction = this.satisfactionConfig.baseValue;
    const factors = this.satisfactionFactors;

    // 房間狀況影響
    if (room.reinforced) {
      satisfaction += factors.reinforcedRoom || 0;
    }
    if (room.needsRepair) {
      satisfaction += factors.needsRepair || 0;
    }

    // 個人資源影響
    if (tenant.personalResources) {
      if (tenant.personalResources.food < 2) {
        satisfaction += factors.lowPersonalFood || 0;
      }
      if (tenant.personalResources.cash > 25) {
        satisfaction += factors.highPersonalCash || 0;
      }
    }

    // 建築防禦影響
    const buildingDefense = this.gameState.getStateValue("buildingDefense", 0);
    if (buildingDefense >= 8) {
      satisfaction += factors.highBuildingDefense || 0;
    } else if (buildingDefense <= 2) {
      satisfaction += factors.lowBuildingDefense || 0;
    }

    // 長者和諧氛圍加成
    const elderCount = this.gameState.getAllTenants().filter(t => t.type === "elder").length;
    satisfaction += elderCount * (factors.elderHarmonyBonus || 0);

    const finalSatisfaction = this.clampSatisfaction(satisfaction);

    // 更新快取
    this.setCachedCalculation(tenant.id, finalSatisfaction);

    return finalSatisfaction;
  }

  /**
   * 取得滿意度狀態分析
   * @param {number} satisfaction - 滿意度數值
   * @returns {SatisfactionStatus} 滿意度狀態
   */
  getSatisfactionStatus(satisfaction) {
    const levels = this.getSatisfactionLevels();
    let selectedLevel = levels[levels.length - 1]; // 預設最低等級

    for (const level of levels) {
      if (satisfaction >= level.threshold) {
        selectedLevel = level;
        break;
      }
    }

    return {
      value: satisfaction,
      level: /** @type {SatisfactionLevel} */ (selectedLevel.severity),
      emoji: selectedLevel.emoji,
      description: selectedLevel.name,
      issues: this.getInfluencingFactors(satisfaction, false),
      positives: this.getInfluencingFactors(satisfaction, true),
    };
  }

  // ==========================================
  // 統計與分析
  // ==========================================

  /**
   * 計算平均滿意度
   * @returns {number} 平均滿意度
   */
  calculateAverageSatisfaction() {
    if (this.tenantSatisfaction.size === 0) return 0;

    const total = Array.from(this.tenantSatisfaction.values()).reduce(
      (sum, val) => sum + val, 0
    );
    return Math.round(total / this.tenantSatisfaction.size);
  }

  /**
   * 取得滿意度分布統計
   * @returns {Object.<string, number>} 滿意度分布
   */
  getSatisfactionDistribution() {
    const distribution = {
      excellent: 0,
      good: 0,
      normal: 0,
      warning: 0,
      critical: 0,
    };

    this.tenantSatisfaction.forEach((satisfaction) => {
      const status = this.getSatisfactionStatus(satisfaction);
      distribution[status.level]++;
    });

    return distribution;
  }

  /**
   * 取得滿意度歷史記錄
   * @param {number} [limit=20] - 返回記錄數量限制
   * @returns {SatisfactionHistory[]} 滿意度歷史
   */
  getSatisfactionHistory(limit = 20) {
    return this.satisfactionHistory.slice(-limit);
  }

  /**
   * 取得租客滿意度趨勢
   * @param {number} tenantId - 租客ID
   * @param {number} [days=7] - 分析天數
   * @returns {Object} 趨勢分析結果
   */
  getSatisfactionTrend(tenantId, days = 7) {
    const recentHistory = this.satisfactionHistory
      .filter(record => record.tenantId === tenantId)
      .slice(-days);

    if (recentHistory.length < 2) {
      return { trend: "stable", change: 0, confidence: "low" };
    }

    const firstValue = recentHistory[0].newValue;
    const lastValue = recentHistory[recentHistory.length - 1].newValue;
    const change = lastValue - firstValue;

    let trend = "stable";
    if (change > 5) trend = "improving";
    else if (change < -5) trend = "declining";

    return {
      trend: trend,
      change: change,
      confidence: recentHistory.length >= 5 ? "high" : "medium",
      recentChanges: recentHistory.length
    };
  }

  // ==========================================
  // 事件處理
  // ==========================================

  /**
   * 每日滿意度更新
   * @returns {void}
   */
  performDailyUpdate() {
    console.log("📊 執行每日滿意度更新");
    this.updateAllTenantsSatisfaction();

    const averageSatisfaction = this.calculateAverageSatisfaction();
    const distribution = this.getSatisfactionDistribution();

    this.emitEvent("dailyReport", {
      averageSatisfaction: averageSatisfaction,
      totalTenants: this.tenantSatisfaction.size,
      distribution: distribution,
    });
  }

  /**
   * 處理資源變更對滿意度的影響
   * @param {Object} data - 資源變更數據
   * @returns {void}
   */
  handleResourceChange(data) {
    if (data.resourceType === "food" && data.changeAmount > 0) {
      // 食物增加時，所有租客滿意度微幅提升
      this.tenantSatisfaction.forEach((satisfaction, tenantId) => {
        this.modifySatisfaction(tenantId, 2, "食物補給");
      });
    }
  }

  /**
   * 處理建築防禦變更對滿意度的影響
   * @returns {void}
   */
  handleDefenseChange() {
    // 建築防禦提升時，所有租客滿意度微幅上升
    this.tenantSatisfaction.forEach((satisfaction, tenantId) => {
      this.modifySatisfaction(tenantId, 1, "防禦強化");
    });
  }

  // ==========================================
  // 私有方法
  // ==========================================

  /**
   * 更新個別租客滿意度
   * @private
   * @param {number} tenantId - 租客ID
   * @returns {void}
   */
  updateIndividualSatisfaction(tenantId) {
    const tenantInfo = this.findTenantAndRoom(tenantId);
    if (!tenantInfo) {
      console.warn(`找不到租客: ${tenantId}`);
      return;
    }

    const { tenant, room } = tenantInfo;
    const oldSatisfaction = this.getSatisfaction(tenantId);
    const newSatisfaction = this.calculateSatisfaction(tenant, room);

    this.tenantSatisfaction.set(tenantId, newSatisfaction);

    if (Math.abs(newSatisfaction - oldSatisfaction) >= 1) {
      this.recordSatisfactionChange(tenantId, oldSatisfaction, newSatisfaction, "daily_update");
    }

    this.checkSatisfactionWarnings(tenantId, newSatisfaction);
  }

  /**
   * 更新所有租客滿意度
   * @private
   * @returns {void}
   */
  updateAllTenantsSatisfaction() {
    const tenants = this.gameState.getAllTenants();
    tenants.forEach((tenant) => {
      this.updateIndividualSatisfaction(tenant.id);
    });
  }

  /**
   * 尋找租客和對應房間
   * @private
   * @param {number} tenantId - 租客ID
   * @returns {{tenant: Tenant, room: Room}|null} 租客和房間資訊
   */
  findTenantAndRoom(tenantId) {
    const rooms = this.gameState.getStateValue("rooms", []);
    for (const room of rooms) {
      const tenant = this.gameState.getRoomTenant(room.id);
      if (tenant?.id === tenantId) {
        return { tenant, room };
      }
    }
    return null;
  }

  /**
   * 檢查滿意度警告
   * @private
   * @param {number} tenantId - 租客ID
   * @param {number} satisfaction - 滿意度值
   * @returns {void}
   */
  checkSatisfactionWarnings(tenantId, satisfaction) {
    const status = this.getSatisfactionStatus(satisfaction);

    if (status.level === "critical") {
      this.emitEvent("critical", {
        tenantId: tenantId,
        satisfaction: satisfaction,
        status: status,
      });

      const tenant = this.findTenantAndRoom(tenantId)?.tenant;
      if (tenant) {
        this.addLog(
          `⚠️ ${tenant.name} 滿意度極低 (${satisfaction})，可能搬離`,
          "danger"
        );
      }
    } else if (status.level === "warning") {
      this.emitEvent("warning", {
        tenantId: tenantId,
        satisfaction: satisfaction,
        status: status,
      });
    }
  }

  /**
   * 記錄滿意度變更歷史
   * @private
   * @param {number} tenantId - 租客ID
   * @param {number} oldValue - 舊值
   * @param {number} newValue - 新值
   * @param {string} reason - 變更原因
   * @returns {void}
   */
  recordSatisfactionChange(tenantId, oldValue, newValue, reason) {
    /** @type {SatisfactionHistory} */
    const record = {
      tenantId: tenantId,
      day: this.gameState.getStateValue("day", 1),
      oldValue: oldValue,
      newValue: newValue,
      reason: reason,
      timestamp: new Date().toISOString(),
    };

    this.satisfactionHistory.push(record);

    // 限制歷史記錄數量
    if (this.satisfactionHistory.length > SYSTEM_LIMITS.HISTORY.MAX_EXECUTION_HISTORY) {
      this.satisfactionHistory.shift();
    }
  }

  /**
   * 載入現有滿意度數據
   * @private
   * @returns {void}
   */
  loadExistingSatisfaction() {
    const existingSatisfaction = this.gameState.getStateValue("tenantSatisfaction", {});

    Object.entries(existingSatisfaction).forEach(([id, value]) => {
      if (typeof value === "number") {
        this.tenantSatisfaction.set(Number(id), value);
      }
    });

    console.log(`📊 載入 ${this.tenantSatisfaction.size} 個租客的滿意度記錄`);
  }

  /**
   * 同步滿意度到遊戲狀態
   * @private
   * @returns {void}
   */
  syncToGameState() {
    const satisfactionObject = Object.fromEntries(this.tenantSatisfaction);
    this.gameState.setStateValue("tenantSatisfaction", satisfactionObject, "satisfaction_sync");
  }

  /**
   * 限制滿意度值在有效範圍內
   * @private
   * @param {number} value - 滿意度值
   * @returns {number} 限制後的滿意度值
   */
  clampSatisfaction(value) {
    return Math.max(
      this.satisfactionConfig.range.min,
      Math.min(this.satisfactionConfig.range.max, Math.round(value))
    );
  }

  /**
   * 取得滿意度等級配置
   * @private
   * @returns {Array} 滿意度等級陣列
   */
  getSatisfactionLevels() {
    return this.satisfactionConfig.display?.levels || [
      { threshold: 80, name: "非常滿意", emoji: "😁", severity: "excellent" },
      { threshold: 60, name: "滿意", emoji: "😊", severity: "good" },
      { threshold: 40, name: "普通", emoji: "😐", severity: "normal" },
      { threshold: 20, name: "不滿", emoji: "😞", severity: "warning" },
      { threshold: 0, name: "極度不滿", emoji: "😡", severity: "critical" },
    ];
  }

  /**
   * 取得影響因子分析
   * @private
   * @param {number} satisfaction - 滿意度值
   * @param {boolean} isPositive - 是否為正面因子
   * @returns {string[]} 影響因子列表
   */
  getInfluencingFactors(satisfaction, isPositive) {
    // 簡化實作，實際應根據滿意度計算邏輯分析
    const factors = [];

    if (isPositive && satisfaction >= 60) {
      factors.push("房間狀況良好", "個人資源充足");
    } else if (!isPositive && satisfaction <= 40) {
      factors.push("個人資源不足", "居住環境待改善");
    }

    return factors;
  }

  /**
   * 取得快取的計算結果
   * @private
   * @param {number} tenantId - 租客ID
   * @returns {number|null} 快取的滿意度值
   */
  getCachedCalculation(tenantId) {
    const cached = this.lastCalculationCache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < this.cacheValidityTime) {
      return cached.value;
    }
    return null;
  }

  /**
   * 設置計算結果快取
   * @private
   * @param {number} tenantId - 租客ID
   * @param {number} value - 滿意度值
   * @returns {void}
   */
  setCachedCalculation(tenantId, value) {
    this.lastCalculationCache.set(tenantId, {
      value: value,
      timestamp: Date.now()
    });
  }

  /**
   * 清理系統數據
   * @returns {void}
   */
  cleanup() {
    this.tenantSatisfaction.clear();
    this.satisfactionHistory = [];
    this.lastCalculationCache.clear();
    super.cleanup();
    console.log("SatisfactionManager 已清理");
  }
}

export default SatisfactionManager;
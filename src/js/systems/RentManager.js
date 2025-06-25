// @ts-check

/**
 * @fileoverview RentManager.js - 配置驅動租金收取管理器
 * 職責：專門處理租金收取、現金/資源抵付、加固房間加成
 * 架構：繼承 BaseManager，採用快速失敗配置載入模式
 */

import systemLogger from "../utils/SystemLogger.js";
import BaseManager from "./BaseManager.js";

/**
 * 租金收取結果
 * @typedef {Object} RentCollectionResult
 * @property {boolean} success - 是否成功
 * @property {number} totalCashRent - 總現金租金
 * @property {number} bonusIncome - 加固房間加成收入
 * @property {ResourcePayment[]} resourcePayments - 資源抵付記錄
 * @property {FailedPayment[]} failedPayments - 失敗支付記錄
 * @property {string} summary - 收取摘要
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 資源支付記錄
 * @typedef {Object} ResourcePayment
 * @property {string} tenant - 租客姓名
 * @property {string} resourceType - 資源類型
 * @property {number} amount - 支付數量
 * @property {number} value - 等價價值
 */

/**
 * 失敗支付記錄
 * @typedef {Object} FailedPayment
 * @property {string} tenant - 租客姓名
 * @property {string} reason - 失敗原因
 * @property {number} shortage - 短缺金額
 */

/**
 * 租金管理器 - 配置驅動專業租金收取系統
 * @class
 * @extends BaseManager
 */
export class RentManager extends BaseManager {
  /**
   * 建立 RentManager 實例
   * @param {Object} gameStateRef - 遊戲狀態參考
   * @param {Object} resourceManager - 資源管理器實例
   * @param {Object} dataManager - 資料管理器實例
   * @param {Object} eventBus - 事件總線實例
   */
  constructor(gameStateRef, resourceManager, dataManager, eventBus) {
    super(gameStateRef, eventBus, "RentManager");

    /** @type {Object} 資源管理器實例 */
    this.resourceManager = resourceManager;

    /** @type {Object} 資料管理器實例 */
    this.dataManager = dataManager;

    // === 配置項目（從 rules.json 載入，快速失敗模式）===
    /** @type {Object|null} 資源交換匯率 */
    this.exchangeRates = null;

    /** @type {number|null} 加固房間租金加成比率 */
    this.reinforcementBonus = null;

    /** @type {string[]|null} 資源處理順序 */
    this.resourceProcessingOrder = null;

    /** @type {Object|null} 資源顯示名稱映射 */
    this.resourceNames = null;

    this.logSuccess('RentManager 已建立');
  }

  // ==========================================
  // BaseManager 抽象方法實作
  // ==========================================

  /**
   * 取得模組事件前綴
   * @returns {string} 事件前綴 "rent"
   */
  getModulePrefix() {
    return "trade";
  }

  /**
   * 設置事件監聽器
   * @returns {void}
   */
  setupEventListeners() {
    // 監聽新一天開始，重置收租狀態（系統級事件，保持原名）
    this.onEvent("day_advanced", () => {
      this.resetDailyRentStatus();
    }, { skipPrefix: true });

    // 監聽手動收租請求（模組級事件，自動添加 rent_ 前綴）
    this.onEvent("collect_request", async () => {
      const result = await this.collectRent();
      this.emitEvent("collection_completed", result);
    });
  }

  /**
   * 取得擴展狀態資訊
   * @returns {Object} 擴展狀態物件
   */
  getExtendedStatus() {
    return {
      configurationLoaded: !!(this.exchangeRates && this.reinforcementBonus !== null),
      exchangeRatesCount: this.exchangeRates ? Object.keys(this.exchangeRates).length : 0,
      resourceProcessingOrderLength: this.resourceProcessingOrder ? this.resourceProcessingOrder.length : 0
    };
  }

  // ==========================================
  // 系統初始化與配置載入
  // ==========================================

  /**
   * 系統初始化
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      this.logSuccess("開始初始化租金管理器");

      // 載入租金配置（快速失敗模式）
      await this.loadRentConfigurations();

      // 設置事件監聽器（BaseManager會自動呼叫）
      this.setupEventListeners();

      // 標記初始化完成
      this.markInitialized(true);

      this.logSuccess("RentManager 初始化完成");
      return true;

    } catch (error) {
      this.logError("租金管理器初始化失敗", error);
      this.markInitialized(false);
      return false;
    }
  }

  /**
   * 載入租金配置（快速失敗模式）
   * @returns {Promise<void>}
   * @throws {Error} 當關鍵配置缺失時
   */
  async loadRentConfigurations() {
    const gameRules = this.dataManager.getGameRules();

    // 直接載入，無預設值（快速失敗策略）
    this.exchangeRates = gameRules.gameBalance?.economy?.rentPayment?.resourceExchangeRates;
    this.reinforcementBonus = gameRules.gameBalance?.economy?.rentPayment?.reinforcementBonus;
    this.resourceProcessingOrder = gameRules.gameBalance?.economy?.rentPayment?.resourceProcessingOrder;
    this.resourceNames = gameRules.gameBalance?.personalWealth?.resourceNames;

    // 配置完整性檢查（關鍵配置缺失時快速失敗）
    const missingConfigs = [];

    if (!this.exchangeRates) missingConfigs.push('resourceExchangeRates');
    if (this.reinforcementBonus === undefined) missingConfigs.push('reinforcementBonus');
    if (!this.resourceProcessingOrder) missingConfigs.push('resourceProcessingOrder');
    if (!this.resourceNames) missingConfigs.push('resourceNames');

    if (missingConfigs.length > 0) {
      const error = new Error(
        `Critical rent configuration missing in rules.json: ${missingConfigs.join(', ')}\n` +
        `Check: gameBalance.economy.rentPayment and gameBalance.personalWealth sections`
      );

      // 提供具體修復建議
      systemLogger.error("🔧 RentManager 配置修復建議：");
      systemLogger.error("1. 確認 rules.json 中的 gameBalance.economy.rentPayment 包含：");
      systemLogger.error("   - resourceExchangeRates: { food: 1.5, materials: 3, medical: 4, fuel: 3 }");
      systemLogger.error("   - reinforcementBonus: 0.2");
      systemLogger.error("   - resourceProcessingOrder: ['food', 'materials', 'medical', 'fuel']");
      systemLogger.error("2. 確認 gameBalance.personalWealth.resourceNames 存在");

      throw error;
    }

    this.logSuccess(`租金配置載入完成 - 匯率${Object.keys(this.exchangeRates).length}項，處理順序${this.resourceProcessingOrder.length}項`);
  }

  // ==========================================
  // 核心租金收取邏輯
  // ==========================================

  /**
   * 收取今日房租（主要入口點）
   * @returns {Promise<RentCollectionResult>} 租金收取結果
   */
  async collectRent() {
    if (!this.isInitialized()) {
      return this.createFailureResult("租金系統未初始化");
    }

    if (this.gameState.getStateValue('dailyActions.rentCollected')) {
      return this.createFailureResult("今日已收取過租金");
    }

    this.logSuccess("開始處理租金收取");

    try {
      const result = {
        success: true,
        totalCashRent: 0,
        bonusIncome: 0,
        resourcePayments: [],
        failedPayments: [],
        summary: ""
      };

      // 取得所有健康且在家的租客
      const healthyTenants = this.getHealthyTenants();
      const availableTenants = healthyTenants.filter(tenant => !tenant.onMission);
      const onMissionTenants = healthyTenants.filter(tenant => tenant.onMission);

      // 處理外出租客的欠款累積
      for (const tenant of onMissionTenants) {
        this.accumulateRentDebt(tenant);
      }

      if (availableTenants.length === 0) {
        let summary = "📭 今日沒有租客繳納房租";
        if (onMissionTenants.length > 0) {
          summary += ` (${onMissionTenants.length} 位租客外出中，累積欠款)`;
        }
        result.summary = summary;
        this.addLog(result.summary, "event");
        return result;
      }

      // 逐個處理可用租客租金
      for (const tenant of availableTenants) {
        const tenantResult = this.processIndividualRent(tenant);

        if (tenantResult.success) {
          result.totalCashRent += tenantResult.cashAmount;
          result.bonusIncome += tenantResult.bonusAmount;

          if (tenantResult.resourcePayments) {
            result.resourcePayments.push(...tenantResult.resourcePayments);
          }
        } else {
          result.failedPayments.push({
            tenant: tenant.name,
            reason: tenantResult.reason,
            shortage: tenantResult.shortage
          });
        }
      }

      // 更新房東總收入
      const totalIncome = result.totalCashRent + result.bonusIncome;
      if (totalIncome > 0) {
        this.resourceManager.modifyResource("cash", totalIncome, "rent_collection");
        this.updateLandlordTotalIncome(totalIncome);
      }

      // 標記今日已收租
      this.gameState.setStateValue("dailyActions.rentCollected", true, "rent_collection_completed");

      // 生成摘要
      result.summary = this.generateRentSummary(result);
      this.addLog(result.summary, "rent");

      // 發送事件
      this.emitEvent("collectionCompleted", result);

      this.logSuccess("租金收取處理完成");
      return result;

    } catch (error) {
      this.logError("租金收取處理失敗", error);
      return this.createFailureResult(error.message);
    }
  }

  /**
   * 處理個別租客租金
   * @param {Object} tenant - 租客物件
   * @returns {Object} 個別租客處理結果
   */
  processIndividualRent(tenant) {
    // 確保租客有個人資源
    this.ensurePersonalResources(tenant);
    
    // 處理累積欠款
    const totalRentDue = tenant.rent + (tenant.rentDebt || 0);
    const room = this.findTenantRoom(tenant);

    // 嘗試現金支付
    if (tenant.personalResources.cash >= totalRentDue) {
      const result = this.processDirectCashPayment(tenant, totalRentDue, room);
      if (result.success && tenant.rentDebt > 0) {
        this.addLog(`${tenant.name} 結清了 $${tenant.rentDebt} 的欠款`, "rent");
        tenant.rentDebt = 0;
      }
      return result;
    }

    // 嘗試資源抵付
    const result = this.processResourcePayment(tenant, totalRentDue, room);
    if (result.success && tenant.rentDebt > 0) {
      this.addLog(`${tenant.name} 結清了 $${tenant.rentDebt} 的欠款`, "rent");
      tenant.rentDebt = 0;
    }
    return result;
  }

  /**
   * 累積租客租金欠款
   * @param {Object} tenant - 租客物件
   */
  accumulateRentDebt(tenant) {
    if (!tenant.rentDebt) {
      tenant.rentDebt = 0;
    }
    tenant.rentDebt += tenant.rent;
    
    this.addLog(`${tenant.name} 外出中，累積租金欠款 $${tenant.rent} (總欠款: $${tenant.rentDebt})`, "rent");
  }

  /**
   * 處理直接現金支付
   * @param {Object} tenant - 租客物件
   * @param {number} rentDue - 應付租金
   * @param {Object} room - 房間物件
   * @returns {Object} 支付結果
   */
  processDirectCashPayment(tenant, rentDue, room) {
    tenant.personalResources.cash -= rentDue;

    const result = {
      success: true,
      tenant: tenant.name,
      cashAmount: rentDue,
      bonusAmount: 0,
      resourcePayments: [],
      shortage: 0,
      reason: "direct_cash"
    };

    // 計算加固房間加成
    if (room?.reinforced) {
      const bonus = Math.floor(rentDue * this.reinforcementBonus);
      result.bonusAmount = bonus;
      this.addLog(`🛡️ 加固房間 ${room.id} 額外收取 $${bonus}`, "rent");
    }

    this.addLog(`${tenant.name} 支付現金房租 $${rentDue}`, "rent");
    return result;
  }

  /**
   * 處理資源抵付租金（使用配置化順序）
   * @param {Object} tenant - 租客物件
   * @param {number} rentDue - 應付租金
   * @param {Object} room - 房間物件
   * @returns {Object} 支付結果
   */
  processResourcePayment(tenant, rentDue, room) {
    const result = {
      success: false,
      tenant: tenant.name,
      cashAmount: 0,
      bonusAmount: 0,
      resourcePayments: [],
      shortage: 0,
      reason: ""
    };

    let remainingDebt = rentDue;
    const paymentDetails = [];

    // 優先使用現有現金
    if (tenant.personalResources.cash > 0) {
      const cashPayment = Math.min(remainingDebt, tenant.personalResources.cash);
      tenant.personalResources.cash -= cashPayment;
      remainingDebt -= cashPayment;
      result.cashAmount = cashPayment;
      paymentDetails.push(`現金 $${cashPayment}`);
    }

    // 使用配置化的資源處理順序
    for (const resourceType of this.resourceProcessingOrder) {
      if (remainingDebt <= 0) break;

      const available = tenant.personalResources[resourceType] || 0;
      if (available <= 0) continue;

      const rate = this.exchangeRates[resourceType];
      const resourceNeeded = Math.ceil(remainingDebt / rate);
      const resourceUsed = Math.min(resourceNeeded, available);
      const valueProvided = resourceUsed * rate;

      if (resourceUsed > 0) {
        // 從租客個人資源轉移到主資源池
        tenant.personalResources[resourceType] -= resourceUsed;
        this.resourceManager.modifyResource(resourceType, resourceUsed, "rent_payment");

        remainingDebt -= valueProvided;

        const payment = {
          tenant: tenant.name,
          resourceType: resourceType,
          amount: resourceUsed,
          value: Math.floor(valueProvided)
        };

        result.resourcePayments.push(payment);
        paymentDetails.push(`${resourceUsed}${this.getResourceDisplayName(resourceType)} (價值$${Math.floor(valueProvided)})`);
      }
    }

    // 檢查支付結果
    if (remainingDebt <= 0) {
      result.success = true;
      result.reason = "resource_payment";

      // 計算加固房間加成
      if (room?.reinforced) {
        const bonus = Math.floor(rentDue * this.reinforcementBonus);
        result.bonusAmount = bonus;
        this.addLog(`🛡️ 加固房間 ${room.id} 額外收取 $${bonus}`, "rent");
      }

      // 記錄詳細支付信息
      this.addLog(`📋 ${tenant.name} 房租支付明細：`, "rent");
      this.addLog(`   • 應付房租：$${rentDue}`, "rent");
      this.addLog(`   • 實際支付：${paymentDetails.join(" + ")}`, "rent");
    } else {
      result.success = false;
      result.shortage = Math.floor(remainingDebt);
      result.reason = "insufficient_resources";
      this.addLog(`${tenant.name} 無法支付完整房租，欠款 $${result.shortage}`, "danger");
    }

    return result;
  }

  // ==========================================
  // 工具方法
  // ==========================================

  /**
   * 取得健康租客列表
   * @returns {Array} 健康租客陣列
   */
  getHealthyTenants() {
    return this.gameState.getAllTenants().filter(tenant => !tenant.infected);
  }

  /**
   * 尋找租客的房間
   * @param {Object} tenant - 租客物件
   * @returns {Object|null} 房間物件
   */
  findTenantRoom(tenant) {
    const roomId = this.gameState.state.roles.tenantRooms.get(tenant.id);
    return this.gameState.state.rooms.find(r => r.id === roomId) || null;
  }

  /**
   * 確保租客有個人資源物件
   * @param {Object} tenant - 租客物件
   */
  ensurePersonalResources(tenant) {
    if (!tenant.personalResources) {
      tenant.personalResources = {
        food: 0,
        materials: 0,
        medical: 0,
        fuel: 0,
        cash: 0
      };
    }
  }

  /**
   * 更新房東總收入
   * @param {number} income - 收入金額
   */
  updateLandlordTotalIncome(income) {
    const landlord = this.gameState.getStateValue("landlord", {});
    landlord.totalIncome = (landlord.totalIncome || 0) + income;
    this.gameState.setStateValue("landlord", landlord, "rent_income_update");
  }

  /**
   * 生成租金收取摘要
   * @param {RentCollectionResult} result - 收取結果
   * @returns {string} 摘要字串
   */
  generateRentSummary(result) {
    const parts = [];

    if (result.totalCashRent > 0) {
      parts.push(`現金收入 $${result.totalCashRent}`);
    }

    if (result.bonusIncome > 0) {
      parts.push(`加固加成 $${result.bonusIncome}`);
    }

    if (result.resourcePayments.length > 0) {
      parts.push(`資源抵付 ${result.resourcePayments.length} 筆`);
    }

    if (result.failedPayments.length > 0) {
      parts.push(`未付租金 ${result.failedPayments.length} 筆`);
    }

    const totalIncome = result.totalCashRent + result.bonusIncome;
    return `💰 今日租金收取：${parts.join(", ")} | 總計 $${totalIncome}`;
  }

  /**
   * 重置每日收租狀態
   */
  resetDailyRentStatus() {
    this.gameState.setStateValue('dailyActions.rentCollected', false, '每日收租狀態重置');
    this.logSuccess("每日收租狀態已重置");
  }

  /**
   * 創建失敗結果
   * @param {string} error - 錯誤訊息
   * @returns {RentCollectionResult} 失敗結果
   */
  createFailureResult(error) {
    return {
      success: false,
      totalCashRent: 0,
      bonusIncome: 0,
      resourcePayments: [],
      failedPayments: [],
      summary: "",
      error: error
    };
  }

  /**
   * 取得資源顯示名稱
   * @param {string} resourceType - 資源類型
   * @returns {string} 顯示名稱
   */
  getResourceDisplayName(resourceType) {
    return this.resourceNames[resourceType] || resourceType;
  }
}

export default RentManager;
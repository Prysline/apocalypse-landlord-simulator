// @ts-check

/**
 * @fileoverview TradeManager.js v3.0 - 統一交易系統（基於 BaseManager）
 * 職責：租金收取、商人交易、商隊交易、互助交易系統
 * 架構特點：繼承 BaseManager，專注核心交易邏輯，移除重複基礎設施
 */

import BaseManager from "./BaseManager.js";
import { getValidator } from "../utils/validators.js";

/**
 * @see {@link ../Type.js} 完整類型定義
 * @typedef {import('../Type.js').TradeType} TradeType
 * @typedef {import('../Type.js').MerchantTradeType} MerchantTradeType
 * @typedef {import('../Type.js').MerchantServiceType} MerchantServiceType
 * @typedef {import('../Type.js').ResourceType} ResourceType
 * @typedef {import('../Type.js').TenantType} TenantType
 * @typedef {import('../Type.js').MutualAidType} MutualAidType
 * @typedef {import('../Type.js').Resources} Resources
 * @typedef {import('../Type.js').PersonalResources} PersonalResources
 * @typedef {import('../Type.js').Tenant} Tenant
 * @typedef {import('../Type.js').Room} Room
 * @typedef {import('../Type.js').MerchantOffer} MerchantOffer
 * @typedef {import('../Type.js').CaravanOffer} CaravanOffer
 */

/**
 * 商人物件
 * @typedef {Object} Merchant
 * @property {string} name - 商人姓名
 * @property {TenantType} type - 商人類型
 * @property {boolean} isTrader - 是否為商人
 * @property {MerchantOffer[]} [tradeOffers] - 交易選項
 * @property {boolean} [leavingAfterTrade] - 是否交易後離開
 */

/**
 * 租金收取結果
 * @typedef {Object} RentCollectionResult
 * @property {boolean} success - 是否成功
 * @property {number} totalCashRent - 總現金租金
 * @property {ResourcePayment[]} resourcePayments - 資源抵付記錄
 * @property {FailedPayment[]} failedPayments - 失敗支付記錄
 * @property {number} bonusIncome - 加固房間加成收入
 * @property {string} summary - 收取摘要
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 資源支付記錄
 * @typedef {Object} ResourcePayment
 * @property {ResourceType} type - 資源類型
 * @property {number} amount - 支付數量
 * @property {number} value - 等價價值
 * @property {string} description - 支付描述
 */

/**
 * 失敗支付記錄
 * @typedef {Object} FailedPayment
 * @property {string} tenant - 租客姓名
 * @property {string} reason - 失敗原因
 * @property {number} shortage - 短缺金額
 */

/**
 * 個別租客租金處理結果
 * @typedef {Object} IndividualRentResult
 * @property {boolean} success - 是否成功
 * @property {string} tenant - 租客姓名
 * @property {number} cashAmount - 現金支付金額
 * @property {number} bonusAmount - 加成金額
 * @property {ResourcePayment[]} resourcePayments - 資源支付記錄
 * @property {number} shortage - 短缺金額
 * @property {string} reason - 支付方式或失敗原因
 */

/**
 * 商人交易結果
 * @typedef {Object} MerchantTradeResult
 * @property {boolean} success - 是否成功
 * @property {string} [type] - 交易類型
 * @property {number} [value] - 交易價值
 * @property {string} [description] - 交易描述
 * @property {Object} [serviceResult] - 服務結果
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 商隊交易結果
 * @typedef {Object} CaravanTradeResult
 * @property {boolean} success - 是否成功
 * @property {number} [value] - 交易價值
 * @property {string} [description] - 交易描述
 * @property {CaravanOffer} [offer] - 交易選項
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 互助系統結果
 * @typedef {Object} MutualAidResult
 * @property {boolean} success - 是否成功
 * @property {Object} [results] - 詳細結果
 * @property {number} results.mutualAidEvents - 互助事件數量
 * @property {number} results.landlordTrades - 房東交易數量
 * @property {number} results.totalValue - 總價值
 * @property {MutualAidDetail[]} results.events - 事件詳情
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 互助詳情
 * @typedef {Object} MutualAidDetail
 * @property {boolean} success - 是否成功
 * @property {MutualAidType} [type] - 互助類型
 * @property {string} [helper] - 幫助者
 * @property {string} [recipient] - 受助者
 * @property {string} [tenant] - 租客姓名
 * @property {number} [amount] - 數量
 * @property {number} [cost] - 費用
 * @property {number} [payment] - 支付金額
 * @property {ResourceType} [item] - 物品類型
 * @property {number} [value] - 價值
 */

/**
 * 每日交易統計
 * @typedef {Object} DailyTradeStats
 * @property {number} day - 天數
 * @property {number} rentCollected - 收取的租金
 * @property {number} merchantTrades - 商人交易數量
 * @property {number} caravanTrades - 商隊交易數量
 * @property {number} mutualAidEvents - 互助事件數量
 * @property {number} totalDailyValue - 當日總價值
 */

/**
 * 交易統計
 * @typedef {Object} TradeStats
 * @property {number} rentTransactions - 租金交易次數
 * @property {number} merchantTransactions - 商人交易次數
 * @property {number} caravanTransactions - 商隊交易次數
 * @property {number} mutualAidTransactions - 互助交易次數
 * @property {number} totalValue - 總交易價值
 * @property {DailyTradeStats} dailyStats - 每日統計
 */

/**
 * 交易配置
 * @typedef {Object} TradeConfig
 * @property {number} rentBonusRate - 加固房間租金加成比率
 * @property {number} mutualAidProbability - 互助發生機率
 * @property {number} landlordTradeProbability - 房東交易機率
 */

/**
 * 交易匯率表
 * @typedef {Object.<ResourceType, number>} ExchangeRates
 */

/**
 * 統一交易系統管理類 v3.0（基於 BaseManager）
 * 負責處理租金收取、商人交易、商隊交易、互助交易等所有交易相關功能
 * @class
 * @extends BaseManager
 */
export class TradeManager extends BaseManager {
  /**
   * 建立 TradeManager 實例
   * @param {Object} gameStateRef - 遊戲狀態參考
   * @param {Object} resourceManager - 資源系統實例
   * @param {Object} dataManager - 資料管理器實例
   * @param {Object} eventBus - 事件總線實例
   */
  constructor(gameStateRef, resourceManager, dataManager, eventBus) {
    // 繼承 BaseManager，自動獲得事件處理、日誌記錄、狀態管理功能
    super(gameStateRef, eventBus, "TradeManager");

    /** @type {Object} 資源系統實例 */
    this.resourceManager = resourceManager;

    /** @type {Object} 資料管理器實例 */
    this.dataManager = dataManager;

    // 交易配置
    /** @type {TradeConfig|null} 交易配置 */
    this.tradeConfig = null;

    /** @type {ExchangeRates|null} 交易匯率表 */
    this.exchangeRates = null;

    /** @type {Object|null} 商人模板 */
    this.merchantTemplates = null;

    /** @type {Object|null} 商隊交易選項 */
    this.caravanOffers = null;

    // 交易統計
    /** @type {TradeStats} 交易統計資料 */
    this.tradeStats = {
      rentTransactions: 0,
      merchantTransactions: 0,
      caravanTransactions: 0,
      mutualAidTransactions: 0,
      totalValue: 0,
      dailyStats: {
        day: 0,
        rentCollected: 0,
        merchantTrades: 0,
        caravanTrades: 0,
        mutualAidEvents: 0,
        totalDailyValue: 0,
      },
    };

    // 驗證器
    /** @type {Object|null} 交易驗證器 */
    this.tradeValidator = null;

    console.log("🏪 TradeManager v3.0 初始化中...");
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
    ); // 跳過前綴，因為這是系統級事件

    // 監聽資源管理器事件
    this.onEvent("resource_modified", (eventObj) => {
      // 可以在此處添加資源變更的響應邏輯
    });
  }

  /**
   * 取得擴展狀態資訊
   * @protected
   * @returns {Object} 擴展狀態物件
   */
  getExtendedStatus() {
    return {
      tradeStats: { ...this.tradeStats },
      exchangeRatesLoaded: !!this.exchangeRates,
      merchantTemplatesLoaded: !!this.merchantTemplates,
      caravanOffersLoaded: !!this.caravanOffers,
      systemHealth: this.validateSystemHealth(),
    };
  }

  // ==========================================
  // 系統初始化
  // ==========================================

  /**
   * 系統初始化
   * @returns {Promise<boolean>} 初始化是否成功
   * @throws {Error} 當初始化過程發生致命錯誤時
   */
  async initialize() {
    try {
      this.logSuccess("開始載入交易系統配置");

      // 初始化驗證器
      this.initializeValidators();

      // 載入交易配置
      await this.loadTradeConfigurations();

      // 設置事件監聽器（BaseManager 會自動呼叫）
      this.setupEventListeners();

      // 初始化統計數據
      this.initializeTradeStats();

      // 標記初始化完成（BaseManager 統一方法）
      this.markInitialized(true);

      this.logSuccess("TradeManager v3.0 初始化完成");
      return true;
    } catch (error) {
      this.logError("TradeManager 初始化失敗", error);
      this.markInitialized(false);
      return false;
    }
  }

  /**
   * 初始化驗證器
   * @returns {void}
   */
  initializeValidators() {
    try {
      this.tradeValidator = getValidator({
        enabled: true,
        strictMode: false,
        logErrors: true,
      });
      this.logSuccess("交易驗證器初始化完成");
    } catch (error) {
      this.logWarning("TradeValidator 初始化失敗，使用後備驗證");
      this.tradeValidator = null;
    }
  }

  /**
   * 載入交易配置
   * @returns {Promise<void>} 載入完成的 Promise
   * @throws {Error} 當配置載入失敗時
   */
  async loadTradeConfigurations() {
    // 從 DataManager 載入遊戲規則
    const gameRules = this.dataManager.getGameRules();

    // 載入交易匯率表
    this.exchangeRates = gameRules.gameBalance?.economy?.rentPayment
      ?.resourceExchangeRates || {
      food: 1.5,
      materials: 3,
      medical: 4,
      fuel: 3,
    };

    // 載入商人交易模板
    this.merchantTemplates =
      gameRules.gameBalance?.economy?.merchantTrade ||
      this.getDefaultMerchantTemplates();

    // 載入商隊交易選項
    this.caravanOffers =
      gameRules.gameBalance?.economy?.caravanTrade ||
      this.getDefaultCaravanOffers();

    // 載入通用交易配置
    this.tradeConfig = gameRules.gameBalance?.economy?.tradeRules || {
      rentBonusRate: 0.2, // 加固房間租金加成
      mutualAidProbability: 0.3, // 互助發生機率
      landlordTradeProbability: 0.25, // 房東交易機率
    };

    this.logSuccess("交易配置載入完成");
  }

  /**
   * 初始化交易統計
   * @returns {void}
   */
  initializeTradeStats() {
    this.tradeStats.dailyStats = {
      day: this.gameState.getStateValue("day", 1),
      rentCollected: 0,
      merchantTrades: 0,
      caravanTrades: 0,
      mutualAidEvents: 0,
      totalDailyValue: 0,
    };
  }

  // ==========================================
  // 1. 租金收取系統
  // ==========================================

  /**
   * 處理租金收取 - 主要入口點
   * @returns {Promise<RentCollectionResult>} 租金收取結果
   * @throws {Error} 當系統未初始化或處理過程發生錯誤時
   */
  async processRentCollection() {
    if (!this.isInitialized()) {
      this.logWarning("TradeManager 未初始化");
      return {
        success: false,
        error: "系統未初始化",
        totalCashRent: 0,
        resourcePayments: [],
        failedPayments: [],
        bonusIncome: 0,
        summary: "",
      };
    }

    // 檢查今日是否已收租
    const dailyActions = this.gameState.getStateValue("dailyActions", {});
    if (dailyActions.rentCollected) {
      this.addLog("今日已收取過租金", "event");
      return {
        success: false,
        error: "今日已收取過租金",
        totalCashRent: 0,
        resourcePayments: [],
        failedPayments: [],
        bonusIncome: 0,
        summary: "今日已收取過租金",
      };
    }

    this.logSuccess("開始處理租金收取");

    /** @type {RentCollectionResult} */
    const results = {
      success: true,
      totalCashRent: 0,
      resourcePayments: [],
      failedPayments: [],
      bonusIncome: 0,
      summary: "",
    };

    try {
      // 取得所有房間
      const rooms = this.gameState.getStateValue("rooms", []);

      // 檢查是否有租客
      const roomsWithTenants = rooms.filter(
        /** @type {function(Room): boolean} */(room) => room.tenant !== null
      );
      if (roomsWithTenants.length === 0) {
        results.success = false;
        results.summary = "❌ 目前沒有租客，無法進行收租";
        this.addLog(results.summary, "rent");
        return results;
      }

      // 篩選可收租的租客（未感染）
      const occupiedRooms = rooms.filter(
        /** @type {function(Room): boolean} */(room) =>
          room.tenant && !room.tenant.infected
      );

      if (occupiedRooms.length === 0) {
        results.summary = "📭 今日沒有租客繳納房租";
        this.addLog(results.summary, "event");
        return results;
      }

      // 逐個處理租客租金
      for (const room of occupiedRooms) {
        const tenantResult = await this.processIndividualRent(room);

        if (tenantResult.success) {
          results.totalCashRent += tenantResult.cashAmount;
          results.bonusIncome += tenantResult.bonusAmount;

          if (tenantResult.resourcePayments.length > 0) {
            results.resourcePayments.push(...tenantResult.resourcePayments);
          }
        } else {
          results.failedPayments.push({
            tenant: room.tenant.name,
            reason: tenantResult.reason,
            shortage: tenantResult.shortage,
          });
        }
      }

      // 更新總收入
      if (results.totalCashRent > 0) {
        this.resourceManager.modifyResource(
          "cash",
          results.totalCashRent + results.bonusIncome,
          "rent_collection"
        );

        // 更新房東總收入
        const landlord = this.gameState.getStateValue("landlord", {});
        if (landlord) {
          landlord.totalIncome =
            (landlord.totalIncome || 0) +
            results.totalCashRent +
            results.bonusIncome;
          this.gameState.setStateValue(
            "landlord",
            landlord,
            "rent_income_update"
          );
        }
      }

      // 成功收租後的處理
      if (results.success && (results.totalCashRent > 0 || results.resourcePayments.length > 0)) {

        // 設置今日已收租狀態
        this.gameState.setStateValue(
          "dailyActions.rentCollected",
          true,
          "rent_collection_completed"
        );

        // 更新統計
        this.updateTradeStats("rent", results.totalCashRent + results.bonusIncome);

        // 生成摘要
        results.summary = this.generateRentCollectionSummary(results);
        this.addLog(results.summary, "rent");

        // 發送租金收取完成事件
        this.emitEvent("rentCollectionCompleted", results);

        this.logSuccess("租金收取處理完成");
      }

      return results;
    } catch (error) {
      this.logError("租金收取處理失敗", error);
      results.success = false;
      results.error = error instanceof Error ? error.message : String(error);
      return results;
    }
  }

  /**
   * 處理個別租客租金
   * @param {Room} room - 房間物件
   * @returns {Promise<IndividualRentResult>} 個別租客租金處理結果
   * @throws {Error} 當房間或租客資料無效時
   */
  async processIndividualRent(room) {
    if (!room || !room.tenant) {
      throw new Error("無效的房間或租客資料");
    }

    const tenant = room.tenant;
    const rentOwed = tenant.rent;

    /** @type {IndividualRentResult} */
    const result = {
      success: false,
      tenant: tenant.name,
      cashAmount: 0,
      bonusAmount: 0,
      resourcePayments: [],
      shortage: 0,
      reason: "",
    };

    // 確保租客有個人資源
    this.ensurePersonalResources(tenant);

    // 嘗試現金支付
    if (tenant.personalResources && tenant.personalResources.cash >= rentOwed) {
      return this.processDirectCashPayment(tenant, rentOwed, room);
    }

    // 嘗試資源抵付
    return this.processResourcePayment(tenant, rentOwed, room);
  }

  /**
   * 處理直接現金支付
   * @param {Tenant} tenant - 租客物件
   * @param {number} rentOwed - 應付租金
   * @param {Room} room - 房間物件
   * @returns {IndividualRentResult} 支付結果
   */
  processDirectCashPayment(tenant, rentOwed, room) {
    if (!tenant.personalResources) {
      throw new Error("租客個人資源不存在");
    }

    tenant.personalResources.cash -= rentOwed;

    /** @type {IndividualRentResult} */
    const result = {
      success: true,
      tenant: tenant.name,
      cashAmount: rentOwed,
      bonusAmount: 0,
      resourcePayments: [],
      shortage: 0,
      reason: "direct_cash",
    };

    // 計算加固房間加成
    if (room.reinforced && this.tradeConfig) {
      const bonus = Math.floor(rentOwed * this.tradeConfig.rentBonusRate);
      result.bonusAmount = bonus;
      this.addLog(`🛡️ 加固房間 ${room.id} 額外收取 $${bonus}`, "rent");
    }

    this.addLog(`${tenant.name} 支付現金房租 $${rentOwed}`, "rent");
    return result;
  }

  /**
   * 處理資源抵付租金
   * @param {Tenant} tenant - 租客物件
   * @param {number} rentOwed - 應付租金
   * @param {Room} room - 房間物件
   * @returns {IndividualRentResult} 支付結果
   */
  processResourcePayment(tenant, rentOwed, room) {
    if (!tenant.personalResources) {
      throw new Error("租客個人資源不存在");
    }

    /** @type {IndividualRentResult} */
    const result = {
      success: false,
      tenant: tenant.name,
      cashAmount: 0,
      bonusAmount: 0,
      resourcePayments: [],
      shortage: 0,
      reason: "",
    };

    let remainingDebt = rentOwed;
    const paymentDetails = [];

    // 優先使用現有現金
    if (tenant.personalResources.cash > 0) {
      const cashPayment = Math.min(
        remainingDebt,
        tenant.personalResources.cash
      );
      tenant.personalResources.cash -= cashPayment;
      remainingDebt -= cashPayment;
      result.cashAmount = cashPayment;
      paymentDetails.push(`現金 $${cashPayment}`);
    }

    // 使用資源抵付剩餘房租
    /** @type {ResourceType[]} */
    const resourceOrder = ["food", "materials", "medical", "fuel"];

    for (const resourceType of resourceOrder) {
      if (remainingDebt <= 0) break;

      const available = tenant.personalResources[resourceType] || 0;
      if (available <= 0) continue;

      const rate =
        this.exchangeRates && this.exchangeRates[resourceType]
          ? this.exchangeRates[resourceType]
          : 1;
      const resourceNeeded = Math.ceil(remainingDebt / rate);
      const resourceUsed = Math.min(resourceNeeded, available);
      const valueProvided = resourceUsed * rate;

      if (resourceUsed > 0) {
        // 從租客個人資源轉移到主資源池
        tenant.personalResources[resourceType] -= resourceUsed;
        this.resourceManager.modifyResource(
          resourceType,
          resourceUsed,
          "rent_payment"
        );

        remainingDebt -= valueProvided;

        const resourceNames = {
          food: "食物",
          materials: "建材",
          medical: "醫療用品",
          fuel: "燃料",
        };

        /** @type {ResourcePayment} */
        const paymentRecord = {
          type: resourceType,
          amount: resourceUsed,
          value: Math.floor(valueProvided),
          description: `${resourceUsed}份${resourceNames[resourceType]
            } (價值$${Math.floor(valueProvided)})`,
        };

        result.resourcePayments.push(paymentRecord);
        paymentDetails.push(paymentRecord.description);
      }
    }

    // 檢查支付結果
    if (remainingDebt <= 0) {
      result.success = true;
      result.reason = "resource_payment";

      // 計算加固房間加成
      if (room.reinforced && this.tradeConfig) {
        const bonus = Math.floor(rentOwed * this.tradeConfig.rentBonusRate);
        result.bonusAmount = bonus;
        this.addLog(`🛡️ 加固房間 ${room.id} 額外收取 $${bonus}`, "rent");
      }

      // 記錄詳細支付信息
      this.addLog(`📋 ${tenant.name} 房租支付明細：`, "rent");
      this.addLog(`   • 應付房租：$${rentOwed}`, "rent");
      this.addLog(`   • 實際支付：${paymentDetails.join(" + ")}`, "rent");
      this.addLog(
        `   • 支付總值：$${Math.floor(rentOwed - remainingDebt)}`,
        "rent"
      );
    } else {
      result.success = false;
      result.shortage = Math.floor(remainingDebt);
      result.reason = "insufficient_resources";

      this.addLog(
        `❌ ${tenant.name} 無法支付完整房租，欠款 $${result.shortage}`,
        "danger"
      );
    }

    return result;
  }

  /**
   * 生成租金收取摘要
   * @param {RentCollectionResult} results - 租金收取結果
   * @returns {string} 摘要字串
   */
  generateRentCollectionSummary(results) {
    const parts = [];

    if (results.totalCashRent > 0) {
      parts.push(`現金收入 $${results.totalCashRent}`);
    }

    if (results.bonusIncome > 0) {
      parts.push(`加固加成 $${results.bonusIncome}`);
    }

    if (results.resourcePayments.length > 0) {
      parts.push(`資源抵付 ${results.resourcePayments.length} 筆`);
    }

    if (results.failedPayments.length > 0) {
      parts.push(`未付租金 ${results.failedPayments.length} 筆`);
    }

    const totalIncome = results.totalCashRent + results.bonusIncome;
    return `💰 今日租金收取：${parts.join(", ")} | 總計 $${totalIncome}`;
  }

  // ==========================================
  // 2. 商人交易系統
  // ==========================================

  /**
   * 處理商人交易
   * @param {Merchant} merchant - 商人物件
   * @param {MerchantOffer} selectedOffer - 選擇的交易選項
   * @returns {Promise<MerchantTradeResult>} 商人交易結果
   * @throws {Error} 當系統未初始化或交易處理失敗時
   */
  async processMerchantTrade(merchant, selectedOffer) {
    if (!this.isInitialized()) {
      return { success: false, error: "系統未初始化" };
    }

    this.logSuccess(`處理商人交易: ${merchant.name} (${merchant.type})`);

    try {
      // 驗證商人和交易選項
      const validation = this.validateMerchantTrade(merchant, selectedOffer);
      if (!validation.valid) {
        return { success: false, error: validation.error || "驗證失敗" };
      }

      // 根據交易類型執行交易
      const result = await this.executeMerchantTrade(merchant, selectedOffer);

      if (result.success) {
        // 更新商人狀態
        this.updateMerchantAfterTrade(merchant, selectedOffer);

        // 更新統計
        this.updateTradeStats("merchant", result.value || 0);

        // 記錄交易
        if (result.description) {
          this.addLog(result.description, "rent");
        }

        // 發送交易完成事件
        this.emitEvent("merchantTradeCompleted", {
          merchant: merchant,
          offer: selectedOffer,
          result: result,
        });
      }

      return result;
    } catch (error) {
      this.logError("商人交易處理失敗", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 驗證商人交易
   * @param {Merchant} merchant - 商人物件
   * @param {MerchantOffer} offer - 交易選項
   * @returns {import("../utils/validators.js").ValidationResult} 驗證結果
   */
  validateMerchantTrade(merchant, offer) {
    // 如果沒有驗證器，返回通過結果
    if (!this.tradeValidator) {
      return { valid: true, reason: "validator_unavailable" };
    }

    // 基本參數驗證
    if (!merchant || !merchant.isTrader) {
      return {
        valid: false,
        error: "無效的商人",
        suggestion: "確認商人物件和 isTrader 屬性",
      };
    }

    if (!offer || typeof offer !== "object") {
      return {
        valid: false,
        error: "無效的交易選項",
        suggestion: "確認交易選項物件格式",
      };
    }

    // 額外的資源檢查
    if (offer && offer.type) {
      switch (offer.type) {
        case "buy":
          if (
            offer.item &&
            offer.amount &&
            !this.resourceManager.hasEnoughResources({
              [offer.item]: offer.amount,
            })
          ) {
            return {
              valid: false,
              error: `資源不足: 需要 ${offer.amount} ${offer.item}`,
              suggestion: "檢查資源庫存或降低交易數量",
            };
          }
          break;

        case "sell":
        case "service":
          if (!this.resourceManager.hasEnoughResources({ cash: offer.price })) {
            return {
              valid: false,
              error: `現金不足: 需要 ${offer.price}`,
              suggestion: "增加現金收入或選擇較便宜的交易",
            };
          }
          break;
      }
    }

    return { valid: true, reason: "validation_passed" };
  }

  /**
   * 執行商人交易
   * @param {Merchant} merchant - 商人物件
   * @param {MerchantOffer} offer - 交易選項
   * @returns {Promise<MerchantTradeResult>} 交易結果
   */
  async executeMerchantTrade(merchant, offer) {
    const { type, item, amount, price, service, description } = offer;

    switch (type) {
      case "buy":
        // 玩家出售資源給商人
        if (item && amount) {
          this.resourceManager.modifyResource(item, -amount, "merchant_sale");
          this.resourceManager.modifyResource("cash", price, "merchant_sale");

          return {
            success: true,
            type: "sale",
            value: price,
            description: `向商人 ${merchant.name} 出售 ${amount} ${item}，獲得 $${price}`,
          };
        }
        return { success: false, error: "交易選項缺少必要參數" };

      case "sell":
        // 玩家從商人購買資源
        if (item && amount) {
          this.resourceManager.modifyResource(
            "cash",
            -price,
            "merchant_purchase"
          );
          this.resourceManager.modifyResource(
            item,
            amount,
            "merchant_purchase"
          );

          return {
            success: true,
            type: "purchase",
            value: price,
            description: `從商人 ${merchant.name} 購買 ${amount} ${item}，花費 $${price}`,
          };
        }
        return { success: false, error: "交易選項缺少必要參數" };

      case "service":
        // 玩家購買商人服務
        if (service) {
          this.resourceManager.modifyResource(
            "cash",
            -price,
            "merchant_service"
          );

          const serviceResult = await this.executeMerchantService(
            merchant,
            service
          );

          return {
            success: true,
            type: "service",
            value: price,
            description: `購買商人 ${merchant.name} 的${serviceResult.description}，花費 $${price}`,
            serviceResult: serviceResult,
          };
        }
        return { success: false, error: "服務類型未指定" };

      default:
        return { success: false, error: `未知的交易類型: ${type}` };
    }
  }

  /**
   * 執行商人服務
   * @param {Merchant} merchant - 商人物件
   * @param {MerchantServiceType} service - 服務類型
   * @returns {Promise<{description: string, effect: string|null}>} 服務結果
   */
  async executeMerchantService(merchant, service) {
    switch (service) {
      case "healthCheck":
        return this.performMerchantHealthCheck(merchant);

      case "quickRepair":
        return this.performMerchantRepair(merchant);

      case "security":
        return this.performSecurityConsultation(merchant);

      case "information":
        return this.performInformationService(merchant);

      default:
        return { description: "未知服務", effect: null };
    }
  }

  /**
   * 商人健康檢查服務
   * @param {Merchant} merchant - 商人物件
   * @returns {{description: string, effect: string|null}} 服務結果
   */
  performMerchantHealthCheck(merchant) {
    let foundIssues = false;

    // 檢查訪客
    const visitors = this.gameState.getStateValue("visitors", []);
    if (Array.isArray(visitors) && visitors.length > 0) {
      visitors.forEach((visitor) => {
        if (visitor.infected && !visitor.revealedInfection) {
          visitor.revealedInfection = true;
          this.addLog(
            `商人醫生檢測發現訪客 ${visitor.name} 已被感染！`,
            "danger"
          );
          foundIssues = true;
        }
      });
    }

    // 檢查租客（早期感染偵測）
    const rooms = this.gameState.getStateValue("rooms", []);
    const healthyTenants = rooms
      .filter((room) => room.tenant && !room.tenant.infected)
      .map((room) => room.tenant);

    healthyTenants.forEach((tenant) => {
      if (Math.random() < 0.15) {
        // 15% 機率發現早期感染
        tenant.infected = true;
        this.addLog(
          `商人醫生檢查發現 ${tenant.name} 出現早期感染症狀！`,
          "danger"
        );
        foundIssues = true;
      }
    });

    if (!foundIssues) {
      this.addLog(
        `商人醫生 ${merchant.name} 完成健康檢查，所有人健康狀況良好`,
        "skill"
      );
    }

    return {
      description: "專業健康檢查服務",
      effect: foundIssues ? "發現感染" : "確認健康",
    };
  }

  /**
   * 商人快速維修服務
   * @param {Merchant} merchant - 商人物件
   * @returns {{description: string, effect: string|null}} 服務結果
   */
  performMerchantRepair(merchant) {
    const rooms = this.gameState.getStateValue("rooms", []);
    const repairRooms = rooms.filter((room) => room.needsRepair);

    if (repairRooms.length > 0) {
      repairRooms[0].needsRepair = false;
      this.gameState.setStateValue("rooms", rooms, "merchant_repair");
      this.addLog(
        `商人工人 ${merchant.name} 快速修復了房間 ${repairRooms[0].id}`,
        "skill"
      );

      return {
        description: "快速維修服務",
        effect: `修復房間 ${repairRooms[0].id}`,
      };
    } else {
      this.addLog(
        `商人工人 ${merchant.name} 檢查了建築，目前沒有需要維修的地方`,
        "event"
      );

      return {
        description: "建築檢查服務",
        effect: "無需維修",
      };
    }
  }

  /**
   * 安全諮詢服務
   * @param {Merchant} merchant - 商人物件
   * @returns {{description: string, effect: string|null}} 服務結果
   */
  performSecurityConsultation(merchant) {
    const currentDefense = this.gameState.getStateValue("building.defense", 0);
    this.gameState.setStateValue(
      "building.defense",
      currentDefense + 1,
      "security_consultation"
    );

    this.addLog(
      `商人軍人 ${merchant.name} 提供了安全建議，建築防禦提升1點`,
      "skill"
    );

    return {
      description: "安全諮詢服務",
      effect: "+1 建築防禦",
    };
  }

  /**
   * 情報服務
   * @param {Merchant} merchant - 商人物件
   * @returns {{description: string, effect: string|null}} 服務結果
   */
  performInformationService(merchant) {
    const infoEffects = [
      {
        description: "獲得搜刮地點情報",
        effect: () => {
          this.addLog(
            `商人老人 ${merchant.name} 告訴你附近有廢棄的醫院`,
            "event"
          );
          this.emitEvent("scavengeBonus", { source: "merchant_info" });
        },
      },
      {
        description: "獲得食物保存技巧",
        effect: () => {
          this.addLog(`商人老人 ${merchant.name} 分享了食物保存技巧`, "event");
          this.emitEvent("harvestBonus", { source: "merchant_info" });
        },
      },
      {
        description: "獲得應急補給",
        effect: () => {
          const bonus = Math.floor(Math.random() * 5) + 3;
          this.resourceManager.modifyResource("food", bonus, "merchant_gift");
          this.addLog(
            `商人老人 ${merchant.name} 給了你 ${bonus} 份應急食物`,
            "rent"
          );
        },
      },
    ];

    const selectedEffect =
      infoEffects[Math.floor(Math.random() * infoEffects.length)];
    selectedEffect.effect();

    return {
      description: selectedEffect.description,
      effect: "獲得有用情報",
    };
  }

  /**
   * 更新商人交易後狀態
   * @param {Merchant} merchant - 商人物件
   * @param {MerchantOffer} offer - 已完成的交易選項
   * @returns {void}
   */
  updateMerchantAfterTrade(merchant, offer) {
    // 移除已使用的交易選項
    if (merchant.tradeOffers && Array.isArray(merchant.tradeOffers)) {
      const offerIndex = merchant.tradeOffers.findIndex(
        (o) =>
          o.type === offer.type &&
          o.item === offer.item &&
          o.price === offer.price
      );

      if (offerIndex !== -1) {
        merchant.tradeOffers.splice(offerIndex, 1);
      }

      // 如果沒有更多交易選項，標記商人離開
      if (merchant.tradeOffers.length === 0) {
        merchant.leavingAfterTrade = true;
        this.addLog(`商人 ${merchant.name} 完成所有交易後準備離開`, "event");
      }
    }
  }

  // ==========================================
  // 3. 商隊交易系統
  // ==========================================

  /**
   * 生成今日可用的商隊交易選項（智慧選擇3-5個合理組合）
   * @returns {Object.<string, CaravanOffer>} 今日可用的商隊交易選項
   */
  generateTodaysCaravanOffers() {
    const allOffers = this.caravanOffers || this.getDefaultCaravanOffers();
    const offerKeys = Object.keys(allOffers);

    // 隨機選擇3-5個選項
    const targetCount = Math.floor(Math.random() * 3) + 3; // 3-5個
    /** @type {Object.<string, CaravanOffer>} */
    const selectedOffers = {};
    const selectedKeys = [];

    // 使用智慧選擇避免衝突
    const compatibleGroups = this.categorizeCompatibleOffers(allOffers);

    // 從每個相容群組中最多選擇1-2個
    const groupKeys = Object.keys(compatibleGroups);
    const shuffledGroups = this.shuffleArray([...groupKeys]);

    for (const groupName of shuffledGroups) {
      if (selectedKeys.length >= targetCount) break;

      const groupOffers = compatibleGroups[groupName];
      const groupKeys = Object.keys(groupOffers);
      const shuffledGroupKeys = this.shuffleArray([...groupKeys]);

      // 從此群組選擇1個（特殊群組可選2個）
      const maxFromGroup = groupName === "special" ? 2 : 1;
      const selectCount = Math.min(
        maxFromGroup,
        groupKeys.length,
        targetCount - selectedKeys.length
      );

      for (let i = 0; i < selectCount; i++) {
        const key = shuffledGroupKeys[i];
        selectedOffers[key] = groupOffers[key];
        selectedKeys.push(key);
      }
    }

    // 如果還沒選夠，從剩餘選項中隨機補充（確保無衝突）
    while (
      selectedKeys.length < targetCount &&
      selectedKeys.length < offerKeys.length
    ) {
      const remainingKeys = offerKeys.filter(
        (key) => !selectedKeys.includes(key)
      );
      if (remainingKeys.length === 0) break;

      const randomKey =
        remainingKeys[Math.floor(Math.random() * remainingKeys.length)];

      // 檢查是否與已選選項產生衝突
      if (!this.hasTradeConflict(selectedOffers, allOffers[randomKey])) {
        selectedOffers[randomKey] = allOffers[randomKey];
        selectedKeys.push(randomKey);
      } else {
        // 如果產生衝突，就停止添加
        break;
      }
    }

    this.logSuccess(
      `生成今日商隊選項：${selectedKeys.length}個 (${selectedKeys.join(", ")})`
    );
    return selectedOffers;
  }

  /**
   * 將交易選項按相容性分組
   * @param {Object} allOffers - 所有交易選項
   * @returns {Object} 分組後的交易選項
   */
  categorizeCompatibleOffers(allOffers) {
    return {
      // 食物主導群組（食物流出）
      food_out: {
        food_for_materials: allOffers.food_for_materials,
        luxury_trade: allOffers.luxury_trade,
        resource_exchange: allOffers.resource_exchange,
        emergency_supplies: allOffers.emergency_supplies,
        food_caravan: allOffers.food_caravan,
      },

      // 食物獲取群組（食物流入）
      food_in: {
        fuel_for_food: allOffers.fuel_for_food,
        medical_for_food: allOffers.medical_for_food,
        cash_for_food: allOffers.cash_for_food,
        survival_bundle: allOffers.survival_bundle,
      },

      // 建材主導群組
      materials_focused: {
        materials_for_cash: allOffers.materials_for_cash,
        materials_for_medical: allOffers.materials_for_medical,
        materials_for_fuel: allOffers.materials_for_fuel,
        cash_for_materials: allOffers.cash_for_materials,
        building_bundle: allOffers.building_bundle,
        military_surplus: allOffers.military_surplus,
        scrap_dealer: allOffers.scrap_dealer,
      },

      // 醫療主導群組
      medical_focused: {
        cash_for_medical: allOffers.cash_for_medical,
        medical_for_cash: allOffers.medical_for_cash,
        medical_for_fuel: allOffers.medical_for_fuel,
        medical_convoy: allOffers.medical_convoy,
      },

      // 燃料主導群組
      fuel_focused: {
        cash_for_fuel: allOffers.cash_for_fuel,
        fuel_for_cash: allOffers.fuel_for_cash,
        fuel_for_materials: allOffers.fuel_for_materials,
        fuel_depot: allOffers.fuel_depot,
      },

      // 特殊組合（可與多數群組相容）
      special: {
        survival_bundle: allOffers.survival_bundle,
        building_bundle: allOffers.building_bundle,
        emergency_supplies: allOffers.emergency_supplies,
      },
    };
  }

  /**
   * 檢查交易是否與已選交易產生衝突
   * @param {Object} selectedOffers - 已選擇的交易
   * @param {CaravanOffer} newOffer - 新的交易選項
   * @returns {boolean} 是否產生衝突
   */
  hasTradeConflict(selectedOffers, newOffer) {
    // 計算新交易的資源隱含價格
    const newPrices = this.calculateImpliedPrices(newOffer);

    // 檢查與每個已選交易的價格衝突
    for (const [key, existingOffer] of Object.entries(selectedOffers)) {
      const existingPrices = this.calculateImpliedPrices(existingOffer);

      // 檢查同一資源的價格衝突（容忍20%差異）
      for (const resource of ["food", "materials", "medical", "fuel"]) {
        if (newPrices[resource] && existingPrices[resource]) {
          const priceDiff = Math.abs(
            newPrices[resource] - existingPrices[resource]
          );
          const avgPrice = (newPrices[resource] + existingPrices[resource]) / 2;
          const diffPercentage = priceDiff / avgPrice;

          // 如果價格差異超過30%，認為有衝突
          if (diffPercentage > 0.3) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 計算交易中各資源的隱含價格
   * @param {CaravanOffer} offer - 交易選項
   * @returns {Object.<ResourceType, number>} 各資源的隱含價格
   */
  calculateImpliedPrices(offer) {
    const prices = {};
    const exchangeRates = this.exchangeRates || {
      food: 1.5,
      materials: 3,
      medical: 4,
      fuel: 3,
      cash: 1,
    };

    // 計算付出資源的總價值
    let totalGiveValue = 0;
    for (const [resource, amount] of Object.entries(offer.give)) {
      totalGiveValue += amount * (exchangeRates[resource] || 1);
    }

    // 計算接收資源的總價值
    let totalReceiveValue = 0;
    for (const [resource, amount] of Object.entries(offer.receive)) {
      totalReceiveValue += amount * (exchangeRates[resource] || 1);
    }

    // 計算各資源的隱含價格（基於總價值比例）
    for (const [resource, amount] of Object.entries(offer.receive)) {
      prices[resource] = totalGiveValue / amount;
    }

    return prices;
  }

  /**
   * 洗牌陣列（Fisher-Yates演算法）
   * @param {Array} array - 要洗牌的陣列
   * @returns {Array} 洗牌後的陣列
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * 處理商隊交易
   * @param {string} tradeType - 交易類型
   * @returns {Promise<CaravanTradeResult>} 商隊交易結果
   * @throws {Error} 當系統未初始化或交易處理失敗時
   */
  async processCaravanTrade(tradeType) {
    if (!this.isInitialized()) {
      return { success: false, error: "系統未初始化" };
    }

    this.logSuccess(`處理商隊交易: ${tradeType}`);

    try {
      // 使用今日可用選項而非全部選項
      const todaysOffers = this.generateTodaysCaravanOffers();
      const tradeOffer = todaysOffers[tradeType];

      if (!tradeOffer) {
        return {
          success: false,
          error: `今日商隊未提供此交易類型: ${tradeType}`,
        };
      }

      // 驗證交易條件
      const validation = this.validateCaravanTrade(tradeOffer);
      if (!validation.valid) {
        return { success: false, error: validation.error || "驗證失敗" };
      }

      // 執行交易
      const result = await this.executeCaravanTrade(tradeOffer);

      if (result.success) {
        // 更新統計
        this.updateTradeStats("caravan", result.value || 0);

        // 記錄交易
        if (result.description) {
          this.addLog(result.description, "rent");
        }

        // 發送交易完成事件
        this.emitEvent("caravanTradeCompleted", {
          tradeType: tradeType,
          offer: tradeOffer,
          result: result,
        });
      }

      return result;
    } catch (error) {
      this.logError("商隊交易處理失敗", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 驗證商隊交易
   * @param {CaravanOffer} offer - 商隊交易選項
   * @returns {import("../utils/validators.js").ValidationResult} 驗證結果
   */
  validateCaravanTrade(offer) {
    // 如果沒有驗證器，返回通過結果
    if (!this.tradeValidator) {
      return { valid: true, reason: "validator_unavailable" };
    }

    // 基本結構驗證
    if (!offer.give || !offer.receive) {
      return {
        valid: false,
        error: "交易選項不完整",
        suggestion: "確認交易選項包含 give 和 receive 屬性",
      };
    }

    // 檢查是否有足夠的資源
    for (const [resourceType, required] of Object.entries(offer.give)) {
      if (
        !this.resourceManager.hasEnoughResources({ [resourceType]: required })
      ) {
        return {
          valid: false,
          error: `${resourceType} 不足: 需要 ${required}`,
          suggestion: `增加 ${resourceType} 或選擇其他交易選項`,
        };
      }
    }

    return { valid: true, reason: "validation_passed" };
  }

  /**
   * 執行商隊交易
   * @param {CaravanOffer} offer - 商隊交易選項
   * @returns {Promise<CaravanTradeResult>} 交易結果
   */
  async executeCaravanTrade(offer) {
    try {
      // 扣除付出的資源
      Object.keys(offer.give).forEach((resourceType) => {
        const amount = offer.give[resourceType];
        this.resourceManager.modifyResource(
          /** @type {ResourceType} */(resourceType),
          -amount,
          "caravan_trade"
        );
      });

      // 增加獲得的資源
      Object.keys(offer.receive).forEach((resourceType) => {
        const amount = offer.receive[resourceType];
        this.resourceManager.modifyResource(
          /** @type {ResourceType} */(resourceType),
          amount,
          "caravan_trade"
        );
      });

      // 計算交易價值
      const value = this.calculateTradeValue(offer.give);

      const description = this.generateCaravanTradeDescription(offer);

      return {
        success: true,
        value: value,
        description: description,
        offer: offer,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 計算交易價值
   * @param {Object.<string, number>} resources - 資源對應表
   * @returns {number} 總價值
   */
  calculateTradeValue(resources) {
    let totalValue = 0;

    Object.keys(resources).forEach((resourceType) => {
      const amount = resources[resourceType];
      const rate =
        (this.exchangeRates &&
          this.exchangeRates[/** @type {ResourceType} */ (resourceType)]) ||
        1;
      totalValue += amount * rate;
    });

    return Math.floor(totalValue);
  }

  /**
   * 生成商隊交易描述
   * @param {CaravanOffer} offer - 商隊交易選項
   * @returns {string} 交易描述
   */
  generateCaravanTradeDescription(offer) {
    const giveDesc = Object.keys(offer.give)
      .map(
        (type) =>
          `${offer.give[type]} ${this.getResourceDisplayName(
            /** @type {ResourceType} */(type)
          )}`
      )
      .join(", ");

    const receiveDesc = Object.keys(offer.receive)
      .map(
        (type) =>
          `${offer.receive[type]} ${this.getResourceDisplayName(
            /** @type {ResourceType} */(type)
          )}`
      )
      .join(", ");

    return `與商隊交易：${giveDesc} → ${receiveDesc}`;
  }

  /**
   * 取得資源顯示名稱
   * @param {ResourceType} resourceType - 資源類型
   * @returns {string} 顯示名稱
   */
  getResourceDisplayName(resourceType) {
    const names = {
      food: "食物",
      materials: "建材",
      medical: "醫療用品",
      fuel: "燃料",
      cash: "現金",
    };
    return names[resourceType] || resourceType;
  }

  // ==========================================
  // 4. 互助交易系統
  // ==========================================

  /**
   * 處理租客互助
   * @returns {Promise<MutualAidResult>} 互助系統結果
   * @throws {Error} 當系統未初始化或處理失敗時
   */
  async processMutualAid() {
    if (!this.isInitialized()) {
      return { success: false, error: "系統未初始化" };
    }

    console.log("處理租客互助系統");

    try {
      /** @type {Object} */
      const results = {
        mutualAidEvents: 0,
        landlordTrades: 0,
        totalValue: 0,
        events: [],
      };

      // 處理租客間互助
      const mutualAidResult = await this.processTenantMutualAid();
      results.mutualAidEvents = mutualAidResult.events;
      results.events.push(...mutualAidResult.details);

      // 處理房東與租客交易
      const landlordTradeResult = await this.processLandlordTenantTrade();
      results.landlordTrades = landlordTradeResult.trades;
      results.totalValue += landlordTradeResult.value;
      results.events.push(...landlordTradeResult.details);

      // 更新統計
      if (results.mutualAidEvents > 0 || results.landlordTrades > 0) {
        this.updateTradeStats("mutual_aid", results.totalValue);

        // 發送互助完成事件
        this.emitEvent("mutualAidCompleted", results);
      }

      return { success: true, results: results };
    } catch (error) {
      this.logError("互助系統處理失敗", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 處理租客間互助
   * @returns {Promise<{events: number, details: MutualAidDetail[]}>} 互助結果
   */
  async processTenantMutualAid() {
    /** @type {{events: number, details: MutualAidDetail[]}} */
    const results = { events: 0, details: [] };

    if (
      !this.tradeConfig ||
      Math.random() > this.tradeConfig.mutualAidProbability
    ) {
      return results;
    }

    const rooms = this.gameState.getStateValue("rooms", []);
    const tenants = rooms
      .filter(
        (room) => room.tenant !== null && room.tenant.personalResources !== null
      )
      .map((room) => room.tenant);

    if (tenants.length < 2) {
      return results;
    }

    // 尋找需要幫助的租客
    const needyTenant = tenants.find(
      (tenant) =>
        tenant.personalResources &&
        (tenant.personalResources.food <= 1 ||
          tenant.personalResources.cash <= 5 ||
          (tenant.type === "elder" && tenant.personalResources.medical <= 1))
    );

    // 尋找可以提供幫助的租客
    const helpfulTenant = tenants.find(
      (tenant) =>
        tenant !== needyTenant &&
        tenant.personalResources &&
        (tenant.personalResources.food >= 5 ||
          tenant.personalResources.cash >= 15 ||
          tenant.personalResources.medical >= 3)
    );

    if (!needyTenant || !helpfulTenant) {
      return results;
    }

    // 執行互助
    const aidResult = this.executeIndividualMutualAid(
      needyTenant,
      helpfulTenant
    );
    if (aidResult.success) {
      results.events++;
      results.details.push(aidResult);
    }

    return results;
  }

  /**
   * 執行個別互助
   * @param {Tenant} needyTenant - 需要幫助的租客
   * @param {Tenant} helpfulTenant - 提供幫助的租客
   * @returns {MutualAidDetail} 互助結果
   */
  executeIndividualMutualAid(needyTenant, helpfulTenant) {
    this.ensurePersonalResources(needyTenant);
    this.ensurePersonalResources(helpfulTenant);

    if (!needyTenant.personalResources || !helpfulTenant.personalResources) {
      return { success: false };
    }

    // 食物互助
    if (
      needyTenant.personalResources.food <= 1 &&
      helpfulTenant.personalResources.food >= 3
    ) {
      helpfulTenant.personalResources.food -= 2;
      needyTenant.personalResources.food += 2;

      this.addLog(
        `${helpfulTenant.name} 分享了2食物給 ${needyTenant.name}`,
        "event"
      );
      return {
        success: true,
        type: "food_aid",
        helper: helpfulTenant.name,
        recipient: needyTenant.name,
        amount: 2,
      };
    }

    // 現金互助
    if (
      needyTenant.personalResources.cash <= 5 &&
      helpfulTenant.personalResources.cash >= 12
    ) {
      const loanAmount = 5;
      helpfulTenant.personalResources.cash -= loanAmount;
      needyTenant.personalResources.cash += loanAmount;

      this.addLog(
        `${helpfulTenant.name} 借了 $${loanAmount} 給 ${needyTenant.name}`,
        "event"
      );
      return {
        success: true,
        type: "cash_loan",
        helper: helpfulTenant.name,
        recipient: needyTenant.name,
        amount: loanAmount,
      };
    }

    // 醫療互助（針對老人）
    if (
      needyTenant.type === "elder" &&
      needyTenant.personalResources.medical <= 1 &&
      helpfulTenant.personalResources.medical >= 2
    ) {
      helpfulTenant.personalResources.medical -= 1;
      needyTenant.personalResources.medical += 1;

      this.addLog(
        `${helpfulTenant.name} 給了1醫療用品給老人 ${needyTenant.name}`,
        "event"
      );
      return {
        success: true,
        type: "medical_aid",
        helper: helpfulTenant.name,
        recipient: needyTenant.name,
        amount: 1,
      };
    }

    return { success: false };
  }

  /**
   * 處理房東與租客交易
   * @returns {Promise<{trades: number, value: number, details: MutualAidDetail[]}>} 交易結果
   */
  async processLandlordTenantTrade() {
    /** @type {{trades: number, value: number, details: MutualAidDetail[]}} */
    const results = { trades: 0, value: 0, details: [] };

    if (
      !this.tradeConfig ||
      Math.random() > this.tradeConfig.landlordTradeProbability
    ) {
      return results;
    }

    const rooms = this.gameState.getStateValue("rooms", []);
    const tenants = rooms
      .filter(
        (room) => room.tenant !== null && room.tenant.personalResources !== null
      )
      .map((room) => room.tenant);

    for (const tenant of tenants) {
      const tradeResult = this.attemptLandlordTenantTrade(tenant);
      if (tradeResult.success) {
        results.trades++;
        results.value += tradeResult.value || 0;
        results.details.push(tradeResult);
      }
    }

    return results;
  }

  /**
   * 嘗試房東與租客交易
   * @param {Tenant} tenant - 租客物件
   * @returns {MutualAidDetail} 交易結果
   */
  attemptLandlordTenantTrade(tenant) {
    this.ensurePersonalResources(tenant);

    if (!tenant.personalResources) {
      return { success: false };
    }

    // 租客缺乏食物，向房東購買
    if (
      tenant.personalResources.food <= 2 &&
      tenant.personalResources.cash >= 8 &&
      this.gameState.getStateValue("resources.food", 0) >= 4
    ) {
      const cost = 8;
      const foodAmount = 4;

      tenant.personalResources.cash -= cost;
      tenant.personalResources.food += foodAmount;
      this.resourceManager.modifyResource("cash", cost, "tenant_purchase");
      this.resourceManager.modifyResource(
        "food",
        -foodAmount,
        "tenant_purchase"
      );

      this.addLog(
        `${tenant.name} 用 $${cost} 向房東購買了 ${foodAmount} 食物`,
        "rent"
      );

      return {
        success: true,
        type: "tenant_purchase",
        tenant: tenant.name,
        cost: cost,
        item: "food",
        amount: foodAmount,
        value: cost,
      };
    }

    // 房東缺乏食物，向租客購買
    if (
      tenant.personalResources.cash >= 18 &&
      tenant.personalResources.food >= 6 &&
      this.gameState.getStateValue("resources.food", 0) <= 12 &&
      this.gameState.getStateValue("resources.cash", 0) >= 10
    ) {
      const payment = 10;
      const foodAmount = 5;

      tenant.personalResources.cash += payment;
      tenant.personalResources.food -= foodAmount;
      this.resourceManager.modifyResource(
        "cash",
        -payment,
        "landlord_purchase"
      );
      this.resourceManager.modifyResource(
        "food",
        foodAmount,
        "landlord_purchase"
      );

      this.addLog(
        `房東用 $${payment} 向 ${tenant.name} 購買了 ${foodAmount} 食物`,
        "rent"
      );

      return {
        success: true,
        type: "landlord_purchase",
        tenant: tenant.name,
        payment: payment,
        item: "food",
        amount: foodAmount,
        value: payment,
      };
    }

    return { success: false };
  }

  // ==========================================
  // 工具函數與系統管理
  // ==========================================

  /**
   * 確保租客有個人資源物件
   * @param {Tenant} tenant - 租客物件
   * @returns {void}
   */
  ensurePersonalResources(tenant) {
    if (!tenant.personalResources) {
      tenant.personalResources = {
        food: 0,
        materials: 0,
        medical: 0,
        fuel: 0,
        cash: 0,
      };
    }
  }

  /**
   * 更新交易統計
   * @param {TradeType} tradeType - 交易類型
   * @param {number} value - 交易價值
   * @returns {void}
   */
  updateTradeStats(tradeType, value) {
    this.tradeStats.totalValue += value;
    this.tradeStats.dailyStats.totalDailyValue += value;

    switch (tradeType) {
      case "rent":
        this.tradeStats.rentTransactions++;
        this.tradeStats.dailyStats.rentCollected += value;
        break;
      case "merchant":
        this.tradeStats.merchantTransactions++;
        this.tradeStats.dailyStats.merchantTrades++;
        break;
      case "caravan":
        this.tradeStats.caravanTransactions++;
        this.tradeStats.dailyStats.caravanTrades++;
        break;
      case "mutual_aid":
        this.tradeStats.mutualAidTransactions++;
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
      merchantTrades: 0,
      caravanTrades: 0,
      mutualAidEvents: 0,
      totalDailyValue: 0,
    };
  }

  /**
   * 驗證系統健康狀態
   * @returns {{healthy: boolean, issues: string[], stats: Object}} 系統健康狀態物件
   */
  validateSystemHealth() {
    const issues = [];

    if (!this.configLoaded) {
      issues.push("配置未正確載入");
    }

    if (!this.exchangeRates) {
      issues.push("交易匯率未載入");
    }

    if (!this.merchantTemplates) {
      issues.push("商人模板未載入");
    }

    if (!this.caravanOffers) {
      issues.push("商隊選項未載入");
    }

    if (!this.tradeValidator) {
      issues.push("TradeValidator 不可用");
    }

    return {
      healthy: issues.length === 0,
      issues: issues,
      stats: {
        totalTransactions:
          this.tradeStats.rentTransactions +
          this.tradeStats.merchantTransactions +
          this.tradeStats.caravanTransactions +
          this.tradeStats.mutualAidTransactions,
        totalValue: this.tradeStats.totalValue,
        dailyValue: this.tradeStats.dailyStats.totalDailyValue,
      },
    };
  }

  /**
   * 取得預設商人模板
   * @returns {Object} 預設商人模板集合
   */
  getDefaultMerchantTemplates() {
    return {
      doctor: {
        offers: [
          {
            type: "sell",
            item: "medical",
            amount: 3,
            price: 15,
            description: "出售3醫療用品 (+$15)",
          },
          {
            type: "buy",
            item: "medical",
            amount: 2,
            price: 12,
            description: "購買2醫療用品 (-$12)",
          },
          {
            type: "service",
            service: "healthCheck",
            price: 8,
            description: "健康檢查服務 (-$8)",
          },
        ],
      },
      worker: {
        offers: [
          {
            type: "sell",
            item: "materials",
            amount: 4,
            price: 18,
            description: "出售4建材 (+$18)",
          },
          {
            type: "buy",
            item: "materials",
            amount: 5,
            price: 20,
            description: "購買5建材 (-$20)",
          },
          {
            type: "service",
            service: "quickRepair",
            price: 10,
            description: "快速維修服務 (-$10)",
          },
        ],
      },
      farmer: {
        offers: [
          {
            type: "sell",
            item: "food",
            amount: 8,
            price: 12,
            description: "出售8食物 (+$12)",
          },
          {
            type: "buy",
            item: "food",
            amount: 6,
            price: 15,
            description: "購買6新鮮食物 (-$15)",
          },
          {
            type: "buy",
            item: "fuel",
            amount: 3,
            price: 12,
            description: "購買3生物燃料 (-$12)",
          },
        ],
      },
      soldier: {
        offers: [
          {
            type: "buy",
            item: "materials",
            amount: 6,
            price: 25,
            description: "購買6軍用建材 (-$25)",
          },
          {
            type: "service",
            service: "security",
            price: 15,
            description: "安全諮詢服務 (-$15)",
          },
        ],
      },
      elder: {
        offers: [
          {
            type: "buy",
            item: "medical",
            amount: 2,
            price: 8,
            description: "購買2草藥 (-$8)",
          },
          {
            type: "service",
            service: "information",
            price: 5,
            description: "情報服務 (-$5)",
          },
        ],
      },
    };
  }

  /**
   * 取得預設商隊交易選項
   * @returns {Object} 預設商隊交易選項集合
   */
  getDefaultCaravanOffers() {
    return {
      // ===== 食物相關交易 =====
      fuel_for_food: {
        give: { fuel: 3 },
        receive: { food: 10 },
        description: "用燃料換食物",
      },
      medical_for_food: {
        give: { medical: 2 },
        receive: { food: 8 },
        description: "用醫療用品換食物",
      },
      cash_for_food: {
        give: { cash: 12 },
        receive: { food: 9 },
        description: "用現金購買食物",
      },
      food_for_materials: {
        give: { food: 8 },
        receive: { materials: 3 },
        description: "用食物換建材",
      },

      // ===== 建材相關交易 =====
      materials_for_cash: {
        give: { materials: 6 },
        receive: { cash: 20 },
        description: "出售建材換現金",
      },
      cash_for_materials: {
        give: { cash: 18 },
        receive: { materials: 5 },
        description: "用現金購買建材",
      },
      fuel_for_materials: {
        give: { fuel: 4 },
        receive: { materials: 4 },
        description: "用燃料換建材",
      },
      materials_for_medical: {
        give: { materials: 4 },
        receive: { medical: 3 },
        description: "用建材換醫療用品",
      },

      // ===== 醫療用品相關交易 =====
      cash_for_medical: {
        give: { cash: 15 },
        receive: { medical: 4 },
        description: "用現金買醫療用品",
      },
      medical_for_cash: {
        give: { medical: 3 },
        receive: { cash: 14 },
        description: "出售醫療用品換現金",
      },
      medical_for_fuel: {
        give: { medical: 2 },
        receive: { fuel: 3 },
        description: "用醫療用品換燃料",
      },

      // ===== 燃料相關交易 =====
      cash_for_fuel: {
        give: { cash: 12 },
        receive: { fuel: 4 },
        description: "用現金購買燃料",
      },
      materials_for_fuel: {
        give: { materials: 3 },
        receive: { fuel: 4 },
        description: "用建材換燃料",
      },
      fuel_for_cash: {
        give: { fuel: 4 },
        receive: { cash: 13 },
        description: "出售燃料換現金",
      },

      // ===== 特殊組合交易 =====
      survival_bundle: {
        give: { cash: 25 },
        receive: { food: 6, medical: 2, fuel: 2 },
        description: "購買生存套餐",
      },
      building_bundle: {
        give: { cash: 30 },
        receive: { materials: 8, fuel: 3 },
        description: "購買建設套餐",
      },
      emergency_supplies: {
        give: { materials: 5, fuel: 2 },
        receive: { food: 8, medical: 3 },
        description: "緊急物資交換",
      },
      luxury_trade: {
        give: { food: 12, materials: 4 },
        receive: { cash: 35 },
        description: "奢侈品交易",
      },
      resource_exchange: {
        give: { food: 4, medical: 1 },
        receive: { materials: 3, fuel: 2 },
        description: "綜合資源互換",
      },

      // ===== 季節性/特殊商隊 =====
      military_surplus: {
        give: { cash: 40 },
        receive: { materials: 10, medical: 3 },
        description: "軍用物資批發",
      },
      medical_convoy: {
        give: { food: 15, fuel: 3 },
        receive: { medical: 8 },
        description: "醫療商隊特供",
      },
      fuel_depot: {
        give: { materials: 8, cash: 10 },
        receive: { fuel: 12 },
        description: "燃料補給站",
      },
      food_caravan: {
        give: { medical: 4, cash: 15 },
        receive: { food: 20 },
        description: "食物商隊大宗交易",
      },
      scrap_dealer: {
        give: { fuel: 6, food: 8 },
        receive: { materials: 12 },
        description: "廢料回收商",
      },
    };
  }
}

export default TradeManager;

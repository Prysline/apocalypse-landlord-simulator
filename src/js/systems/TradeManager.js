// @ts-check

/**
 * @fileoverview TradeManager.js - 統一交易系統
 * 職責：租金收取、商人交易、商隊交易、互助交易系統
 * 架構特點：配置驅動、事件通信、與 resourceManager 協作
 */

import { getValidator } from "../utils/validators.js";

/**
 * 交易類型聯合型別
 * @typedef {'rent'|'merchant'|'caravan'|'mutual_aid'} TradeType
 */

/**
 * 商人交易類型
 * @typedef {'buy'|'sell'|'service'} MerchantTradeType
 */

/**
 * 商人服務類型
 * @typedef {'healthCheck'|'quickRepair'|'security'|'information'} MerchantServiceType
 */

/**
 * 資源類型聯合型別
 * @typedef {'food'|'materials'|'medical'|'fuel'|'cash'} ResourceType
 */

/**
 * 租客類型聯合型別
 * @typedef {'doctor'|'worker'|'farmer'|'soldier'|'elder'} TenantType
 */

/**
 * 互助類型
 * @typedef {'food_aid'|'cash_loan'|'medical_aid'|'tenant_purchase'|'landlord_purchase'} MutualAidType
 */

/**
 * 日誌類型
 * @typedef {'event'|'rent'|'danger'|'skill'} LogType
 */

/**
 * 租客個人資源
 * @typedef {Object} PersonalResources
 * @property {number} food - 個人食物
 * @property {number} materials - 個人建材
 * @property {number} medical - 個人醫療用品
 * @property {number} fuel - 個人燃料
 * @property {number} cash - 個人現金
 */

/**
 * 租客物件
 * @typedef {Object} Tenant
 * @property {string} name - 租客姓名
 * @property {TenantType} type - 租客類型
 * @property {string} skill - 技能描述
 * @property {number} rent - 房租金額
 * @property {boolean} [infected] - 是否感染
 * @property {boolean} [onMission] - 是否執行任務中
 * @property {PersonalResources} [personalResources] - 個人資源
 * @property {string} [appearance] - 外觀描述
 * @property {number} [infectionRisk] - 感染風險
 */

/**
 * 房間物件
 * @typedef {Object} Room
 * @property {number} id - 房間ID
 * @property {Tenant|null} tenant - 入住的租客
 * @property {boolean} needsRepair - 是否需要維修
 * @property {boolean} reinforced - 是否已加固
 */

/**
 * 價格範圍配置
 * @typedef {Object} PriceRange
 * @property {number} min - 最小價格
 * @property {number} max - 最大價格
 */

/**
 * 數量範圍配置
 * @typedef {Object} AmountRange
 * @property {number} min - 最小數量
 * @property {number} max - 最大數量
 */

/**
 * 商人交易選項
 * @typedef {Object} MerchantOffer
 * @property {MerchantTradeType} type - 交易類型
 * @property {ResourceType} [item] - 交易物品類型
 * @property {number} [amount] - 交易數量
 * @property {number} price - 交易價格
 * @property {MerchantServiceType} [service] - 服務類型
 * @property {string} description - 交易描述
 * @property {PriceRange} [priceRange] - 價格範圍（用於隨機生成）
 * @property {AmountRange} [amountRange] - 數量範圍（用於隨機生成）
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
 * 商隊交易選項
 * @typedef {Object} CaravanOffer
 * @property {Object.<ResourceType, number>} give - 付出的資源
 * @property {Object.<ResourceType, number>} receive - 獲得的資源
 * @property {string} description - 交易描述
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
 * 商人模板
 * @typedef {Object} MerchantTemplate
 * @property {MerchantOffer[]} offers - 交易選項列表
 */

/**
 * 商人模板集合
 * @typedef {Object.<TenantType, MerchantTemplate>} MerchantTemplates
 */

/**
 * 商隊交易集合
 * @typedef {Object.<string, CaravanOffer>} CaravanOffers
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
 * 服務執行結果
 * @typedef {Object} ServiceResult
 * @property {string} description - 服務描述
 * @property {string|null} effect - 服務效果
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
 * 系統健康狀態
 * @typedef {Object} SystemHealth
 * @property {boolean} healthy - 是否健康
 * @property {string[]} issues - 問題列表
 * @property {Object} stats - 統計資料
 * @property {number} stats.totalTransactions - 總交易數
 * @property {number} stats.totalValue - 總價值
 * @property {number} stats.dailyValue - 當日價值
 */

/**
 * 系統狀態
 * @typedef {Object} TradeManagerStatus
 * @property {boolean} initialized - 是否已初始化
 * @property {boolean} configLoaded - 配置是否載入
 * @property {TradeStats} tradeStats - 交易統計
 * @property {boolean} exchangeRatesLoaded - 匯率是否載入
 * @property {boolean} merchantTemplatesLoaded - 商人模板是否載入
 * @property {boolean} caravanOffersLoaded - 商隊選項是否載入
 * @property {SystemHealth} systemHealth - 系統健康狀態
 */

/**
 * 交易建議
 * @typedef {Object} TradeRecommendation
 * @property {'warning'|'suggestion'|'economic'} type - 建議類型
 * @property {string} message - 建議訊息
 * @property {number} priority - 優先級 (1-3)
 */

/**
 * 交易報告
 * @typedef {Object} TradeReport
 * @property {TradeStats} stats - 交易統計
 * @property {SystemHealth} systemHealth - 系統健康狀態
 * @property {Object} configuration - 配置資訊
 * @property {ExchangeRates} configuration.exchangeRates - 交易匯率
 * @property {TradeConfig} configuration.tradeConfig - 交易配置
 * @property {TradeRecommendation[]} recommendations - 交易建議
 */

/**
 * 事件監聽器回調函數
 * @typedef {function(Object): void} EventListener
 */

/**
 * 統一交易系統管理類
 * 負責處理租金收取、商人交易、商隊交易、互助交易等所有交易相關功能
 * @class
 */
export class TradeManager {
  /**
   * 建立 TradeManager 實例
   * @param {Object} gameStateRef - 遊戲狀態參考
   * @param {Object} resourceManager - 資源系統實例
   * @param {Object} dataManager - 資料管理器實例
   * @param {Object} eventBus - 事件總線實例
   */
  constructor(gameStateRef, resourceManager, dataManager, eventBus) {
    /** @type {Object} 遊戲狀態參考 */
    this.gameState = gameStateRef;

    /** @type {Object} 資源系統實例 */
    this.resourceManager = resourceManager;

    /** @type {Object} 資料管理器實例 */
    this.dataManager = dataManager;

    /** @type {Object} 事件總線實例 */
    this.eventBus = eventBus;

    // 系統狀態
    /** @type {boolean} 是否已初始化 */
    this.initialized = false;

    /** @type {boolean} 配置是否已載入 */
    this.configLoaded = false;

    // 交易配置
    /** @type {TradeConfig|null} 交易配置 */
    this.tradeConfig = null;

    /** @type {ExchangeRates|null} 交易匯率表 */
    this.exchangeRates = null;

    /** @type {MerchantTemplates|null} 商人模板 */
    this.merchantTemplates = null;

    /** @type {CaravanOffers|null} 商隊交易選項 */
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

    // 事件監聽器
    /** @type {Map<string, EventListener[]>} 事件監聽器映射 */
    this.eventListeners = new Map();

    console.log("🏪 TradeManager v2.1 初始化中...");
  }

  /**
   * 系統初始化
   * @returns {Promise<boolean>} 初始化是否成功
   * @throws {Error} 當初始化過程發生致命錯誤時
   */
  async initialize() {
    try {
      console.log("💼 載入交易系統配置...");

      // 初始化驗證器
      this.initializeValidators();

      // 載入交易配置
      await this.loadTradeConfigurations();

      // 設置事件監聽器
      this.setupEventListeners();

      // 初始化統計數據
      this.initializeTradeStats();

      this.configLoaded = true;
      this.initialized = true;

      console.log("✅ TradeManager 初始化完成");
      console.log("📋 系統配置:", {
        exchangeRates: !!this.exchangeRates,
        merchantTemplates: !!this.merchantTemplates,
        caravanOffers: !!this.caravanOffers,
        validator: !!this.tradeValidator,
      });

      return true;
    } catch (error) {
      console.error("❌ TradeManager 初始化失敗:", error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * 初始化驗證器
   * 建立交易驗證器實例，用於驗證交易參數和條件
   * @returns {void}
   */
  initializeValidators() {
    try {
      this.tradeValidator = getValidator({
        enabled: true,
        strictMode: false,
        logErrors: true,
      });
      console.log("🔍 TradeManager 驗證器初始化完成");
    } catch (error) {
      console.warn("⚠️ TradeValidator 初始化失敗，使用後備驗證:", error);
      this.tradeValidator = null;
    }
  }

  /**
   * 載入交易配置
   * 從 DataManager 載入所有交易相關配置
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

    console.log("📋 交易配置載入完成");
  }

  /**
   * 設置事件監聽器
   * 註冊系統事件監聽器，處理天數推進等事件
   * @returns {void}
   */
  setupEventListeners() {
    // 監聽新一天開始，重置每日統計
    if (this.eventBus) {
      this.eventBus.on("day_advanced", () => {
        this.resetDailyStats();
      });
    }
  }

  /**
   * 初始化交易統計
   * 設置當日交易統計的初始值
   * @returns {void}
   */
  initializeTradeStats() {
    this.tradeStats.dailyStats = {
      day: this.gameState.day,
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
   * 處理所有租客的租金收取，包括現金支付和資源抵付
   * @returns {Promise<RentCollectionResult>} 租金收取結果
   * @throws {Error} 當系統未初始化或處理過程發生錯誤時
   */
  async processRentCollection() {
    if (!this.initialized) {
      console.warn("⚠️ TradeManager 未初始化");
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

    console.log("💰 開始處理租金收取");

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
      // 取得所有已出租房間
      const occupiedRooms = this.gameState.rooms.filter(
        /** @type {function(Room): boolean} */ (room) =>
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

        if (this.gameState.landlord) {
          this.gameState.landlord.totalIncome +=
            results.totalCashRent + results.bonusIncome;
        }
      }

      // 更新統計
      this.updateTradeStats(
        "rent",
        results.totalCashRent + results.bonusIncome
      );

      // 生成摘要
      results.summary = this.generateRentCollectionSummary(results);
      this.addLog(results.summary, "rent");

      // 發送租金收取完成事件
      this.emitEvent("rentCollectionCompleted", results);

      console.log("✅ 租金收取處理完成");
      return results;
    } catch (error) {
      console.error("❌ 租金收取處理失敗:", error);
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
          description: `${resourceUsed}份${
            resourceNames[resourceType]
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
    if (!this.initialized) {
      return { success: false, error: "系統未初始化" };
    }

    console.log(`🛒 處理商人交易: ${merchant.name} (${merchant.type})`);

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
      console.error("❌ 商人交易處理失敗:", error);
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

    // 使用 validators.js 的交易驗證
    const tradeOperation = {
      type:
        offer.type === "buy"
          ? "rent"
          : offer.type === "sell"
          ? "merchant"
          : "caravan",
      from: "player",
      to: merchant.name,
      cost:
        offer.type === "buy"
          ? { [offer.item || "cash"]: offer.amount || 0 }
          : { cash: offer.price },
    };

    const tradeValidation =
      this.tradeValidator.validateTradeOperation(tradeOperation);
    if (!tradeValidation.valid) {
      return tradeValidation;
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
   * @returns {Promise<ServiceResult>} 服務結果
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
   * @returns {ServiceResult} 服務結果
   */
  performMerchantHealthCheck(merchant) {
    let foundIssues = false;

    // 檢查訪客
    if (
      this.gameState.visitors &&
      Array.isArray(this.gameState.visitors) &&
      this.gameState.visitors.length > 0
    ) {
      this.gameState.visitors.forEach(
        /** @type {function(Object): void} */ (visitor) => {
          if (visitor.infected && !visitor.revealedInfection) {
            visitor.revealedInfection = true;
            this.addLog(
              `商人醫生檢測發現訪客 ${visitor.name} 已被感染！`,
              "danger"
            );
            foundIssues = true;
          }
        }
      );
    }

    // 檢查租客（早期感染偵測）
    const healthyTenants = this.gameState.rooms
      .filter(
        /** @type {function(Room): boolean} */ (room) =>
          room.tenant && !room.tenant.infected
      )
      .map(/** @type {function(Room): Tenant} */ (room) => room.tenant);

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
   * @returns {ServiceResult} 服務結果
   */
  performMerchantRepair(merchant) {
    const repairRooms = this.gameState.rooms.filter(
      /** @type {function(Room): boolean} */ (room) => room.needsRepair
    );

    if (repairRooms.length > 0) {
      repairRooms[0].needsRepair = false;
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
   * @returns {ServiceResult} 服務結果
   */
  performSecurityConsultation(merchant) {
    // 使用 GameState 的安全存取方式
    const currentDefense = this.gameState.getStateValue("buildingDefense", 0);
    this.gameState.setStateValue(
      "buildingDefense",
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
   * @returns {ServiceResult} 服務結果
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
          // 設置搜刮加成標記（由其他系統處理）
          this.emitEvent("scavengeBonus", { source: "merchant_info" });
        },
      },
      {
        description: "獲得食物保存技巧",
        effect: () => {
          this.addLog(`商人老人 ${merchant.name} 分享了食物保存技巧`, "event");
          // 設置採集加成標記
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

  /**
   * 生成商人交易選項
   * @param {Merchant} merchant - 商人物件
   * @returns {MerchantOffer[]} 交易選項列表
   */
  generateMerchantOffers(merchant) {
    const tenantType = /** @type {TenantType} */ (merchant.type);
    const template =
      this.merchantTemplates && this.merchantTemplates[tenantType];

    if (!template) {
      return this.getDefaultMerchantOffers(tenantType);
    }

    const offers = [];
    const availableOffers = [...template.offers];

    // 隨機選擇2-3個交易選項
    const numOffers = Math.min(
      availableOffers.length,
      Math.floor(Math.random() * 2) + 2
    );

    for (let i = 0; i < numOffers; i++) {
      if (availableOffers.length === 0) break;

      const randomIndex = Math.floor(Math.random() * availableOffers.length);
      const offer = availableOffers.splice(randomIndex, 1)[0];

      if (offer) {
        offers.push(this.processOfferTemplate(offer, merchant));
      }
    }

    return offers;
  }

  /**
   * 處理交易選項模板
   * @param {MerchantOffer} template - 交易選項模板
   * @param {Merchant} merchant - 商人物件
   * @returns {MerchantOffer} 處理後的交易選項
   */
  processOfferTemplate(template, merchant) {
    /** @type {MerchantOffer} */
    const offer = { ...template };

    // 基於商人狀態調整價格
    if (offer.priceRange) {
      offer.price =
        Math.floor(
          Math.random() * (offer.priceRange.max - offer.priceRange.min + 1)
        ) + offer.priceRange.min;
    }

    // 基於商人狀態調整數量
    if (offer.amountRange && offer.amount !== undefined) {
      offer.amount =
        Math.floor(
          Math.random() * (offer.amountRange.max - offer.amountRange.min + 1)
        ) + offer.amountRange.min;
    }

    return offer;
  }

  // ==========================================
  // 3. 商隊交易系統
  // ==========================================

  /**
   * 處理商隊交易
   * @param {string} tradeType - 交易類型
   * @returns {Promise<CaravanTradeResult>} 商隊交易結果
   * @throws {Error} 當系統未初始化或交易處理失敗時
   */
  async processCaravanTrade(tradeType) {
    if (!this.initialized) {
      return { success: false, error: "系統未初始化" };
    }

    console.log(`🚛 處理商隊交易: ${tradeType}`);

    try {
      const tradeOffer = this.caravanOffers && this.caravanOffers[tradeType];
      if (!tradeOffer) {
        return { success: false, error: `未知的商隊交易類型: ${tradeType}` };
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
      console.error("❌ 商隊交易處理失敗:", error);
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

    // 使用 validators.js 的交易驗證
    const tradeOperation = {
      type: "caravan",
      from: "player",
      to: "caravan",
      cost: offer.give,
    };

    const tradeValidation =
      this.tradeValidator.validateTradeOperation(tradeOperation);
    if (!tradeValidation.valid) {
      return tradeValidation;
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
          /** @type {ResourceType} */ (resourceType),
          -amount,
          "caravan_trade"
        );
      });

      // 增加獲得的資源
      Object.keys(offer.receive).forEach((resourceType) => {
        const amount = offer.receive[resourceType];
        this.resourceManager.modifyResource(
          /** @type {ResourceType} */ (resourceType),
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
            /** @type {ResourceType} */ (type)
          )}`
      )
      .join(", ");

    const receiveDesc = Object.keys(offer.receive)
      .map(
        (type) =>
          `${offer.receive[type]} ${this.getResourceDisplayName(
            /** @type {ResourceType} */ (type)
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
    if (!this.initialized) {
      return { success: false, error: "系統未初始化" };
    }

    console.log("🤝 處理租客互助系統");

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
      console.error("❌ 互助系統處理失敗:", error);
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

    const tenants = this.gameState.rooms
      .filter(
        /** @type {function(Room): boolean} */ (room) =>
          room.tenant !== null &&
          room.tenant.personalResources !== null &&
          room.tenant.personalResources !== undefined
      )
      .map(/** @type {function(Room): Tenant} */ (room) => room.tenant);

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

    const tenants = this.gameState.rooms
      .filter(
        /** @type {function(Room): boolean} */ (room) =>
          room.tenant !== null &&
          room.tenant.personalResources !== null &&
          room.tenant.personalResources !== undefined
      )
      .map(/** @type {function(Room): Tenant} */ (room) => room.tenant);

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
      day: this.gameState.day,
      rentCollected: 0,
      merchantTrades: 0,
      caravanTrades: 0,
      mutualAidEvents: 0,
      totalDailyValue: 0,
    };
  }

  /**
   * 取得預設商人模板
   * @returns {MerchantTemplates} 預設商人模板集合
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
   * @returns {CaravanOffers} 預設商隊交易選項集合
   */
  getDefaultCaravanOffers() {
    return {
      fuel_for_food: {
        give: { fuel: 3 },
        receive: { food: 10 },
        description: "用燃料換食物",
      },
      cash_for_medical: {
        give: { cash: 15 },
        receive: { medical: 4 },
        description: "用現金買醫療用品",
      },
      materials_for_cash: {
        give: { materials: 6 },
        receive: { cash: 20 },
        description: "出售建材換現金",
      },
    };
  }

  /**
   * 取得預設商人交易選項（後備）
   * @param {TenantType} tenantType - 租客類型
   * @returns {MerchantOffer[]} 預設交易選項
   */
  getDefaultMerchantOffers(tenantType) {
    const templates = this.getDefaultMerchantTemplates();
    const template = templates[tenantType];

    if (!template) {
      return [
        {
          type: "buy",
          item: "food",
          amount: 2,
          price: 5,
          description: "購買食物",
        },
      ];
    }

    return template.offers.slice(0, 2); // 返回前兩個選項
  }

  /**
   * 事件監聽器註冊
   * @param {string} eventName - 事件名稱
   * @param {EventListener} callback - 回調函數
   * @returns {void}
   */
  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.push(callback);
    }
  }

  /**
   * 發送事件
   * @param {string} eventName - 事件名稱
   * @param {Object} data - 事件資料
   * @returns {void}
   */
  emitEvent(eventName, data) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ 交易事件處理器錯誤 (${eventName}):`, error);
        }
      });
    }

    // 同時透過 EventBus 發送事件
    if (this.eventBus) {
      this.eventBus.emit(`trade_${eventName}`, data);
    }
  }

  /**
   * 添加遊戲日誌 - 透過 GameState 統一管理
   * @param {string} message - 日誌訊息
   * @param {LogType} [type='event'] - 日誌類型
   * @returns {void}
   */
  addLog(message, type = "event") {
    // 優先使用 GameState 的 addLog 方法
    if (this.gameState && typeof this.gameState.addLog === "function") {
      this.gameState.addLog(message, type);
    } else {
      // 後備方案：直接輸出到控制台
      console.log(`[${type.toUpperCase()}] ${message}`);
    }

    // 同時透過 EventBus 發送日誌事件（供其他模組監聽）
    if (this.eventBus) {
      this.eventBus.emit("trade_log_added", {
        source: "TradeManager",
        message,
        type,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 取得系統狀態
   * @returns {TradeManagerStatus} 系統狀態物件
   */
  getStatus() {
    return {
      initialized: this.initialized,
      configLoaded: this.configLoaded,
      tradeStats: { ...this.tradeStats },
      exchangeRatesLoaded: !!this.exchangeRates,
      merchantTemplatesLoaded: !!this.merchantTemplates,
      caravanOffersLoaded: !!this.caravanOffers,
      systemHealth: this.validateSystemHealth(),
    };
  }

  /**
   * 驗證系統健康狀態
   * @returns {SystemHealth} 系統健康狀態物件
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
   * 取得交易報告
   * @returns {TradeReport} 完整交易報告
   */
  getTradeReport() {
    return {
      stats: this.tradeStats,
      systemHealth: this.validateSystemHealth(),
      configuration: {
        exchangeRates: this.exchangeRates || {},
        tradeConfig: this.tradeConfig || {
          rentBonusRate: 0.2,
          mutualAidProbability: 0.3,
          landlordTradeProbability: 0.25,
        },
      },
      recommendations: this.generateTradeRecommendations(),
    };
  }

  /**
   * 生成交易建議
   * @returns {TradeRecommendation[]} 交易建議列表
   */
  generateTradeRecommendations() {
    /** @type {TradeRecommendation[]} */
    const recommendations = [];
    const dailyStats = this.tradeStats.dailyStats;

    if (dailyStats.rentCollected === 0) {
      recommendations.push({
        type: "warning",
        message: "今日尚未收取房租",
        priority: 3,
      });
    }

    if (
      dailyStats.merchantTrades === 0 &&
      this.gameState.visitors &&
      this.gameState.visitors.length > 0
    ) {
      recommendations.push({
        type: "suggestion",
        message: "考慮與訪客進行交易",
        priority: 2,
      });
    }

    if (dailyStats.totalDailyValue < 50) {
      recommendations.push({
        type: "economic",
        message: "今日交易價值偏低，考慮提升經濟活動",
        priority: 1,
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }
}

export default TradeManager;

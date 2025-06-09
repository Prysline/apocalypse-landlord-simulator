// @ts-check

/**
 * @fileoverview TenantManager.js v2.1 - 租客生命週期管理系統
 * 職責：租客雇用/驅逐、滿意度系統、關係管理、個人資源管理、申請者篩選、搜刮派遣
 */

import BaseManager from "./BaseManager.js";
import { getValidator } from "../utils/validators.js";
import { SYSTEM_LIMITS } from "../utils/constants.js";

/**
 * @see {@link ../Type.js} 完整類型定義
 * @typedef {import('../Type.js').TenantType} TenantType
 * @typedef {import('../Type.js').ResourceType} ResourceType
 * @typedef {import('../Type.js').LogType} LogType
 * @typedef {import('../Type.js').SatisfactionLevel} SatisfactionLevel
 * @typedef {import('../Type.js').TenantStatus} TenantStatus
 * @typedef {import('../Type.js').PersonalResources} PersonalResources
 * @typedef {import('../Type.js').Tenant} Tenant
 * @typedef {import('../Type.js').Applicant} Applicant
 * @typedef {import('../Type.js').Room} Room
 * @typedef {import('../Type.js').TenantRelationship} TenantRelationship
 * @typedef {import('../Type.js').TenantStats} TenantStats
 */

/**
 * 滿意度因子
 * @typedef {Object} SatisfactionFactors
 * @property {number} reinforcedRoom - 加固房間加成
 * @property {number} needsRepair - 房間需維修扣分
 * @property {number} lowPersonalFood - 個人食物不足扣分
 * @property {number} highPersonalCash - 個人現金充足加分
 * @property {number} highBuildingDefense - 建築防禦高加分
 * @property {number} lowBuildingDefense - 建築防禦低扣分
 * @property {number} emergencyTraining - 急救訓練加分
 * @property {number} buildingQuality - 建築品質加分
 * @property {number} patrolSystem - 巡邏系統加分
 * @property {number} socialNetwork - 社交網絡加分
 * @property {number} elderHarmonyBonus - 長者和諧加成
 */

/**
 * 滿意度狀態
 * @typedef {Object} SatisfactionStatus
 * @property {number} value - 滿意度數值 (0-100)
 * @property {SatisfactionLevel} level - 滿意度等級
 * @property {string} emoji - 對應表情符號
 * @property {string} description - 狀態描述
 * @property {string[]} issues - 影響因子清單
 * @property {string[]} positives - 正面因子清單
 */

/**
 * 衝突事件
 * @typedef {Object} ConflictEvent
 * @property {string} id - 衝突ID
 * @property {string} type - 衝突類型
 * @property {number[]} involvedTenants - 涉及的租客ID
 * @property {string} description - 衝突描述
 * @property {number} severity - 嚴重程度 (1-5)
 * @property {string} timestamp - 發生時間
 * @property {boolean} resolved - 是否已解決
 */

/**
 * 雇用結果
 * @typedef {Object} HiringResult
 * @property {boolean} success - 是否成功
 * @property {string} [reason] - 失敗原因或成功訊息
 * @property {Tenant} [tenant] - 雇用的租客
 * @property {number} [roomId] - 分配的房間ID
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 驅逐結果
 * @typedef {Object} EvictionResult
 * @property {boolean} success - 是否成功
 * @property {string} reason - 驅逐原因
 * @property {number} [refund] - 退還金額
 * @property {number} [penalty] - 處理費用
 * @property {PersonalResources} [leftBehind] - 遺留物品
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 面試結果
 * @typedef {Object} InterviewResult
 * @property {boolean} passed - 是否通過面試
 * @property {string} reason - 面試結果原因
 * @property {number} riskLevel - 風險等級 (1-5)
 * @property {string[]} recommendations - 建議事項
 * @property {boolean} backgroundCheckPassed - 背景檢查是否通過
 */

/**
 * 搬家處理結果
 * @typedef {Object} MovingResult
 * @property {boolean} success - 是否成功
 * @property {number} [fromRoomId] - 原房間ID
 * @property {number} [toRoomId] - 目標房間ID
 * @property {string} reason - 搬家原因
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 滿意度歷史記錄
 * @typedef {Object} SatisfactionHistory
 * @property {number} tenantId - 租客ID
 * @property {number} day - 遊戲天數
 * @property {number} oldValue - 舊滿意度
 * @property {number} newValue - 新滿意度
 * @property {string} reason - 變更原因
 * @property {string} timestamp - 變更時間戳記
 */

/**
 * 系統配置
 * @typedef {Object} TenantManagerConfig
 * @property {SatisfactionFactors} satisfactionFactors - 滿意度因子
 * @property {number} maxTenants - 最大租客數
 * @property {number} maxApplicants - 最大申請者數
 * @property {number} conflictThreshold - 衝突觸發閾值
 * @property {number} evictionPenalty - 驅逐處理費
 * @property {number} refundRate - 退租退款比率
 */

/**
 * 系統狀態
 * @typedef {Object} TenantManagerStatus
 * @property {boolean} initialized - 是否已初始化
 * @property {boolean} configLoaded - 配置是否載入
 * @property {TenantStats} stats - 租客統計
 * @property {number} activeConflicts - 活躍衝突數量
 * @property {number} satisfactionHistorySize - 滿意度歷史記錄數量
 * @property {boolean} validatorAvailable - 驗證器是否可用
 */

/**
 * 租客生命週期管理系統 v2.1（BaseManager 整合版）
 * 負責處理租客的雇用、驅逐、滿意度管理、關係系統、搜刮派遣等核心功能
 * 重構亮點：統一事件命名、移除重複實現、使用 BaseManager 統一架構
 * @class
 * @extends BaseManager
 */
export class TenantManager extends BaseManager {
  /**
   * 建立 TenantManager 實例
   * @param {Object} gameState - 遊戲狀態管理器
   * @param {Object} resourceManager - 資源管理器
   * @param {Object} tradeManager - 交易管理器
   * @param {Object} dataManager - 資料管理器
   * @param {Object} eventBus - 事件總線
   */
  constructor(gameState, resourceManager, tradeManager, dataManager, eventBus) {
    // 調用 BaseManager 建構函式
    super(gameState, eventBus, "TenantManager");

    // 依賴注入
    /** @type {Object} 資源管理器 */
    this.resourceManager = resourceManager;

    /** @type {Object} 交易管理器 */
    this.tradeManager = tradeManager;

    /** @type {Object} 資料管理器 */
    this.dataManager = dataManager;

    // 配置數據
    /** @type {TenantManagerConfig|null} 系統配置 */
    this.config = null;

    /** @type {Object|null} 租客類型配置 */
    this.tenantTypes = null;

    /** @type {Object|null} 滿意度配置 */
    this.satisfactionConfig = null;

    // === 統一ID管理系統 ===
    /** @type {number} 統一個人ID計數器 */
    this.nextPersonId = 1;

    /** @type {Map<number, Object>} 個人註冊表 - 統一管理所有個人 */
    this.personRegistry = new Map();

    // 運行時數據
    /** @type {Map<number, number>} 租客滿意度 */
    this.tenantSatisfaction = new Map();

    /** @type {TenantRelationship[]} 租客關係記錄 */
    this.tenantRelationships = [];

    /** @type {ConflictEvent[]} 衝突事件歷史 */
    this.conflictHistory = [];

    /** @type {SatisfactionHistory[]} 滿意度變更歷史 */
    this.satisfactionHistory = [];

    /** @type {Applicant[]} 當前申請者列表 */
    this.currentApplicants = [];

    // 工具
    /** @type {Object|null} 驗證器實例 */
    this.validator = null;

    console.log("🏘️ TenantManager v2.0 (BaseManager 整合版) 初始化中...");
  }

  // ==========================================
  // BaseManager 抽象方法實作
  // ==========================================

  /**
   * 取得模組事件前綴
   * @returns {string} 事件前綴
   */
  getModulePrefix() {
    return "tenant";
  }

  /**
   * 設置事件監聽器
   * @returns {void}
   */
  setupEventListeners() {
    if (!this.eventBus) return;

    // 監聽新一天開始，更新滿意度、重置搜刮狀態
    this.onEvent(
      "day_advanced",
      () => {
        this.updateDailySatisfaction();
        this.checkConflictTriggers();
        this.resetDailyScavengeStatus();
      },
      { skipPrefix: true }
    ); // 系統級事件，跳過前綴處理

    // 監聽資源變更，影響滿意度
    this.onEvent(
      "resource_modified",
      (eventObj) => {
        const data = eventObj.data;
        if (data && data.reason === "tenant_purchase") {
          this.updateSatisfactionFromResourceChange(data);
        }
      },
      { skipPrefix: true }
    ); // 已有前綴

    // 監聽建築防禦變更
    this.onEvent("building_defense_changed", () => {
      this.updateSatisfactionFromDefenseChange();
    });

    // 監聽搜刮請求（統一使用 scavenge_ 前綴）
    this.onEvent(
      "scavenge_request",
      async (eventObj) => {
        const data = eventObj.data;
        if (data && data.tenantId) {
          const result = await this.sendTenantScavenging(data.tenantId);
          this.emitEvent("scavenge_result", result, { skipPrefix: true }); // 業務領域事件
        }
      },
      { skipPrefix: true }
    ); // 業務領域事件

    // 監聽資源獎勵（從搜刮系統獲得）
    this.onEvent(
      "scavenge_rewards_received",
      (eventObj) => {
        const data = eventObj.data;
        if (data && data.rewards) {
          Object.entries(data.rewards).forEach(([resourceType, amount]) => {
            if (amount > 0) {
              this.addLog(`搜刮獲得 ${amount} ${resourceType}`, "event");
            }
          });
        }
      },
      { skipPrefix: true }
    ); // 業務領域事件

    console.log("✅ TenantManager 事件監聽器設置完成");
  }

  /**
   * 取得擴展狀態資訊
   * @protected
   * @returns {Object} 擴展狀態物件
   */
  getExtendedStatus() {
    return {
      stats: this.getTenantStats(),
      activeConflicts: this.conflictHistory.filter((c) => !c.resolved).length,
      satisfactionHistorySize: this.satisfactionHistory.length,
      validatorAvailable: !!this.validator,
      currentApplicants: this.currentApplicants.length,
      scavengeStatus: this.getScavengeStatus(),
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
      console.log("👥 載入租客管理系統配置...");

      // 初始化驗證器
      this.initializeValidator();

      // 載入配置數據
      await this.loadConfigurations();

      // 初始化租客數據
      this.initializeTenantData();

      // 設置事件監聽器（BaseManager 管理）
      this.setupEventListeners();

      // 載入現有租客滿意度
      this.loadExistingTenantSatisfaction();

      // 標記初始化完成（BaseManager 統一方法）
      this.markInitialized(true);

      console.log("✅ TenantManager 初始化完成");
      console.log("📋 系統配置:", {
        tenantTypes: !!this.tenantTypes,
        satisfactionConfig: !!this.satisfactionConfig,
        validator: !!this.validator,
        maxTenants: this.config?.maxTenants || 0,
        eventBusActive: !!this.eventBus,
      });

      return true;
    } catch (error) {
      console.error("❌ TenantManager 初始化失敗:", error);
      this.logError("初始化失敗", error);
      return false;
    }
  }

  /**
   * 初始化驗證器
   * @returns {void}
   */
  initializeValidator() {
    try {
      this.validator = getValidator({
        enabled: true,
        strictMode: false,
        logErrors: true,
      });
      console.log("🔍 TenantManager 驗證器初始化完成");
    } catch (error) {
      console.warn("⚠️ TenantValidator 初始化失敗，使用後備驗證:", error);
      this.validator = null;
    }
  }

  /**
   * 載入配置數據
   * @returns {Promise<void>} 載入完成的 Promise
   * @throws {Error} 當配置載入失敗時
   */
  async loadConfigurations() {
    // 從 DataManager 載入租客類型配置
    this.tenantTypes = this.dataManager.getTenantTypes();

    // 從 DataManager 載入遊戲規則
    const gameRules = this.dataManager.getGameRules();

    // 載入滿意度系統配置
    this.satisfactionConfig = gameRules.gameBalance?.tenants
      ?.satisfactionSystem || {
      baseValue: 50,
      range: { min: 0, max: 100 },
      factors: {
        reinforcedRoom: 3,
        needsRepair: -8,
        lowPersonalFood: -10,
        highPersonalCash: 5,
        highBuildingDefense: 4,
        lowBuildingDefense: -6,
        emergencyTraining: 2,
        buildingQuality: 3,
        patrolSystem: 4,
        socialNetwork: 3,
        elderHarmonyBonus: 2,
      },
    };

    // 載入系統配置
    this.config = {
      satisfactionFactors: this.satisfactionConfig.factors,
      maxTenants: gameRules.gameDefaults?.initialRooms?.count || 6,
      maxApplicants: 5,
      conflictThreshold: 40, // 滿意度低於此值時可能引發衝突
      evictionPenalty: 10, // 驅逐處理費
      refundRate: 0.5, // 退租退款比率
    };

    console.log("📋 租客系統配置載入完成");
  }

  /**
   * 初始化租客數據
   * @returns {void}
   */
  initializeTenantData() {
    // 初始化現有租客的滿意度
    const existingTenants = this.gameState.getAllTenants();
    existingTenants.forEach((tenant) => {
      if (!this.tenantSatisfaction.has(tenant.name)) {
        this.tenantSatisfaction.set(
          tenant.name,
          this.satisfactionConfig.baseValue
        );
      }
      this.ensurePersonalResources(tenant);
    });

    // 初始化租客關係
    this.initializeTenantRelationships(existingTenants);
  }

  /**
   * 初始化租客關係
   * @param {Tenant[]} tenants - 租客列表
   * @returns {void}
   */
  initializeTenantRelationships(tenants) {
    for (let i = 0; i < tenants.length; i++) {
      for (let j = i + 1; j < tenants.length; j++) {
        const tenant1 = tenants[i];
        const tenant2 = tenants[j];

        // 檢查是否已存在關係記錄
        const existingRelation = this.tenantRelationships.find(
          (rel) =>
            (rel.tenant1Id === tenant1.id && rel.tenant2Id === tenant2.id) ||
            (rel.tenant1Id === tenant2.id && rel.tenant2Id === tenant1.id)
        );

        if (!existingRelation) {
          /** @type {TenantRelationship} */
          const relationship = {
            tenant1Id: tenant1.id,
            tenant2Id: tenant2.id,
            relationship: 50, // 中性關係
            lastInteraction: new Date().toISOString(),
            interactionHistory: [],
          };
          this.tenantRelationships.push(relationship);
        }
      }
    }
  }

  /**
   * 載入現有租客滿意度
   * @returns {void}
   */
  loadExistingTenantSatisfaction() {
    const existingSatisfaction = this.gameState.getStateValue(
      "tenantSatisfaction",
      {}
    );

    Object.entries(existingSatisfaction).forEach(([id, value]) => {
      if (typeof value === "number") {
        this.tenantSatisfaction.set(Number(id), value);
      }
    });
  }

  // ==========================================
  // 統一ID管理方法
  // ==========================================

  /**
   * 生成統一個人ID
   * @returns {number} 新的個人ID
   */
  generatePersonId() {
    return this.nextPersonId++;
  }

  /**
   * 註冊個人到系統
   * @param {number} id - 個人ID
   * @param {Object} person - 個人物件
   * @param {string} role - 角色標識 ('tenant', 'applicant', 'visitor')
   */
  registerPerson(id, person, role) {
    this.personRegistry.set(id, {
      ...person,
      _systemRole: role,
      _registeredAt: new Date().toISOString(),
    });
  }

  /**
   * 根據ID取得個人
   * @param {number} id - 個人ID
   * @returns {Object|null} 個人物件
   */
  getPersonById(id) {
    return this.personRegistry.get(id) || null;
  }

  /**
   * 移除個人註冊
   * @param {number} id - 個人ID
   */
  unregisterPerson(id) {
    this.personRegistry.delete(id);
  }

  /**
   * 從配置檔案取得類型顯示名稱
   * @param {string} typeId - 類型ID
   * @returns {string} 中文顯示名稱
   */
  getTypeName(typeId) {
    // 從 tenants.json 配置中取得顯示名稱
    const tenantType = this.tenantTypes.find((t) => t.typeId === typeId);
    return tenantType ? tenantType.typeName : typeId;
  }

  // ==========================================
  // 1. 租客雇用系統
  // ==========================================

  /**
   * 雇用租客 - 主要入口點
   * @param {Applicant} applicant - 申請者物件
   * @param {number} [targetRoomId] - 指定房間ID（可選）
   * @returns {Promise<HiringResult>} 雇用結果
   * @throws {Error} 當系統未初始化或雇用過程失敗時
   */
  async hireTenant(applicant, targetRoomId) {
    if (!this.initialized) {
      return { success: false, error: "系統未初始化" };
    }

    console.log(`👤 開始雇用租客: ${applicant.name} (${applicant.type})`);

    try {
      // 驗證雇用條件
      const validation = this.validateHiring(applicant, targetRoomId);
      if (!validation.valid) {
        return { success: false, error: validation.error || "驗證失敗" };
      }

      // 進行面試評估
      const interviewResult = this.conductInterview(applicant);
      if (false) {
        if (!interviewResult.passed) {
          return {
            success: false,
            reason: `面試未通過：${interviewResult.reason}`,
          };
        }
      }

      // 分配房間
      const room = this.assignRoom(targetRoomId);
      if (!room) {
        return { success: false, error: "沒有可用房間" };
      }

      // 建立租客物件
      const tenant = this.createTenantFromApplicant(applicant);

      // 執行雇用流程
      const result = await this.executeHiring(tenant, room);

      if (result.success) {
        // 從申請者列表移除
        this.removeApplicant(applicant.id);

        // 發送雇用完成事件（使用 BaseManager 統一事件方法）
        this.emitEvent("tenantHired", {
          tenant: tenant,
          room: room,
          interviewResult: interviewResult,
        });

        this.addLog(`新租客 ${tenant.name} 入住房間 ${room.id}`, "rent");
      }

      return result;
    } catch (error) {
      console.error("❌ 租客雇用失敗:", error);
      this.logError("租客雇用失敗", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 驗證雇用條件
   * @param {Applicant} applicant - 申請者物件
   * @param {number} [targetRoomId] - 指定房間ID
   * @returns {import("../utils/validators.js").ValidationResult} 驗證結果
   */
  validateHiring(applicant, targetRoomId) {
    if (!this.validator) {
      return { valid: true, reason: "validator_unavailable" };
    }

    // 基本參數驗證
    if (!applicant || !applicant.name || !applicant.type) {
      return {
        valid: false,
        error: "申請者資料不完整",
        suggestion: "確認申請者包含姓名和類型",
      };
    }

    // 檢查是否已達最大租客數
    const currentTenants = this.gameState.getAllTenants();
    if (currentTenants.length >= (this.config?.maxTenants || 6)) {
      return {
        valid: false,
        error: "已達最大租客數量限制",
        suggestion: "驅逐部分租客或擴建房間",
      };
    }

    // 檢查房間可用性
    if (targetRoomId) {
      const rooms = this.gameState.getStateValue("rooms", []);
      const targetRoom = rooms.find(
        /** @type {function(Room): boolean} */ (r) => r.id === targetRoomId
      );

      if (!targetRoom) {
        return {
          valid: false,
          error: `房間 ${targetRoomId} 不存在`,
          suggestion: "選擇有效的房間ID",
        };
      }

      if (targetRoom.tenant) {
        return {
          valid: false,
          error: `房間 ${targetRoomId} 已有租客`,
          suggestion: "選擇空置房間",
        };
      }
    } else {
      // 檢查是否有空房
      const emptyRooms = this.getEmptyRooms();
      if (emptyRooms.length === 0) {
        return {
          valid: false,
          error: "沒有可用的空房間",
          suggestion: "等待租客搬出或擴建房間",
        };
      }
    }

    // 使用 validators.js 的租客操作驗證
    const tenantOperation = {
      type: "hire",
      tenant: {
        name: applicant.name,
        type: applicant.type,
        infected: applicant.infected,
      },
      room: targetRoomId ? { tenant: null } : { tenant: null },
    };

    return this.validator.validateTenantOperation(tenantOperation);
  }

  /**
   * 進行面試評估
   * @param {Applicant} applicant - 申請者物件
   * @returns {InterviewResult} 面試結果
   */
  conductInterview(applicant) {
    let riskLevel = 1;
    const recommendations = [];
    let backgroundCheckPassed = true;

    // 感染風險評估
    if (applicant.infected) {
      riskLevel = 5;
      backgroundCheckPassed = false;
      return {
        passed: false,
        reason: "健康檢查未通過（感染風險極高）",
        riskLevel: riskLevel,
        recommendations: ["建議隔離觀察", "進行詳細醫療檢查"],
        backgroundCheckPassed: backgroundCheckPassed,
      };
    }

    // 基於外觀描述的風險評估
    if (applicant.appearance) {
      const suspiciousKeywords = [
        "呆滯",
        "蒼白",
        "顫抖",
        "血跡",
        "僵硬",
        "腐肉",
      ];
      const suspiciousCount = suspiciousKeywords.filter((keyword) =>
        applicant.appearance.includes(keyword)
      ).length;

      if (suspiciousCount >= 2) {
        riskLevel = Math.min(4, riskLevel + suspiciousCount);
        recommendations.push("建議加強健康監控");
      }
    }

    // 基於感染風險數值的評估
    if (applicant.infectionRisk > 0.2) {
      riskLevel = Math.min(5, riskLevel + 1);
      recommendations.push("定期健康檢查");
    }

    // 個人資源評估
    if (applicant.personalResources) {
      const totalResources = Object.values(applicant.personalResources).reduce(
        (sum, val) => sum + val,
        0
      );

      if (totalResources < 10) {
        riskLevel = Math.min(3, riskLevel + 1);
        recommendations.push("財務狀況需關注");
      }
    }

    // 職業適性評估
    const currentTenants = this.gameState.getAllTenants();
    const sameTypeCount = currentTenants.filter(
      (t) => t.type === applicant.type
    ).length;

    if (sameTypeCount >= 2) {
      recommendations.push(`已有多位${applicant.type}，考慮職業多樣性`);
    }

    // 最終評估
    const passed = riskLevel <= 3 && backgroundCheckPassed;

    return {
      passed: passed,
      reason: passed
        ? "面試通過，符合入住條件"
        : `風險等級過高 (${riskLevel}/5)`,
      riskLevel: riskLevel,
      recommendations: recommendations,
      backgroundCheckPassed: backgroundCheckPassed,
    };
  }

  /**
   * 分配房間
   * @param {number} [targetRoomId] - 指定房間ID
   * @returns {Room|null} 分配的房間，失敗時返回 null
   */
  assignRoom(targetRoomId) {
    const rooms = this.gameState.getStateValue("rooms", []);

    if (targetRoomId) {
      const targetRoom = rooms.find(
        /** @type {function(Room): boolean} */ (r) => r.id === targetRoomId
      );
      return targetRoom && !targetRoom.tenant ? targetRoom : null;
    }

    // 自動分配：優先選擇已加固的空房
    const emptyRooms = rooms.filter(
      /** @type {function(Room): boolean} */ (r) => !r.tenant
    );

    // 按優先級排序：加固房間 > 普通房間 > 需維修房間
    emptyRooms.sort((a, b) => {
      if (a.reinforced && !b.reinforced) return -1;
      if (!a.reinforced && b.reinforced) return 1;
      if (a.needsRepair && !b.needsRepair) return 1;
      if (!a.needsRepair && b.needsRepair) return -1;
      return 0;
    });

    return emptyRooms.length > 0 ? emptyRooms[0] : null;
  }

  /**
   * 從申請者建立租客物件
   * @param {Applicant} applicant - 申請者物件
   * @returns {Tenant} 租客物件
   */
  createTenantFromApplicant(applicant) {
    /** @type {Tenant} */
    const tenant = {
      id: applicant.id,
      name: applicant.name,
      type: applicant.type,
      typeName: applicant.typeName,
      skill: applicant.skill,
      rent: applicant.rent,
      infected: applicant.infected || false,
      onMission: false,
      personalResources: { ...applicant.personalResources },
      appearance: applicant.appearance,
      infectionRisk: applicant.infectionRisk,
      moveInDate: new Date().toISOString(),
      preferences: {},
      skillHistory: {},
    };

    // 更新註冊角色（從申請者變為租客）
    this.registerPerson(applicant.id, tenant, "tenant");

    return tenant;
  }

  /**
   * 執行雇用流程
   * @param {Tenant} tenant - 租客物件
   * @param {Room} room - 分配的房間
   * @returns {Promise<HiringResult>} 雇用結果
   */
  async executeHiring(tenant, room) {
    try {
      // 分配房間
      room.tenant = tenant;

      // 更新遊戲狀態
      const updateSuccess = this.gameState.setState(
        {
          rooms: this.gameState.getStateValue("rooms", []),
        },
        `租客${tenant.name}入住`
      );

      if (!updateSuccess) {
        return { success: false, error: "狀態更新失敗" };
      }

      // 初始化租客滿意度
      this.tenantSatisfaction.set(tenant.id, this.satisfactionConfig.baseValue);

      // 建立與其他租客的關係
      this.establishTenantRelationships(tenant);

      // 確保個人資源完整性
      this.ensurePersonalResources(tenant);

      // 更新統計
      this.updateTenantStats();

      return {
        success: true,
        reason: "雇用成功",
        tenant: tenant,
        roomId: room.id,
      };
    } catch (error) {
      console.error("執行雇用流程失敗:", error);
      this.logError("執行雇用流程失敗", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 建立租客關係
   * @param {Tenant} newTenant - 新租客
   * @returns {void}
   */
  establishTenantRelationships(newTenant) {
    const existingTenants = this.gameState
      .getAllTenants()
      .filter((t) => t.id !== newTenant.id);

    existingTenants.forEach((tenant) => {
      /** @type {TenantRelationship} */
      const relationship = {
        tenant1Id: newTenant.id,
        tenant2Id: tenant.id,
        relationship: this.calculateInitialRelationship(newTenant, tenant),
        lastInteraction: new Date().toISOString(),
        interactionHistory: [`${newTenant.name} 入住`],
      };

      this.tenantRelationships.push(relationship);
    });
  }

  /**
   * 計算初始關係值
   * @param {Tenant} tenant1 - 租客1
   * @param {Tenant} tenant2 - 租客2
   * @returns {number} 初始關係值 (0-100)
   */
  calculateInitialRelationship(tenant1, tenant2) {
    let relationship = 50; // 基礎中性關係

    // 基於職業相性調整
    const compatibilityMatrix = {
      doctor: { worker: 10, farmer: 5, soldier: -5, elder: 15 },
      worker: { doctor: 10, farmer: 15, soldier: 5, elder: 0 },
      farmer: { doctor: 5, worker: 15, soldier: -10, elder: 20 },
      soldier: { doctor: -5, worker: 5, farmer: -10, elder: -15 },
      elder: { doctor: 15, worker: 0, farmer: 20, soldier: -15 },
    };

    const compatibility =
      compatibilityMatrix[tenant1.type]?.[tenant2.type] || 0;
    relationship += compatibility;

    // 隨機因子 (-10 到 +10)
    relationship += Math.floor(Math.random() * 21) - 10;

    return Math.max(0, Math.min(100, relationship));
  }

  // ==========================================
  // 2. 租客驅逐系統
  // ==========================================

  /**
   * 驅逐租客 - 主要入口點
   * @param {number} tenantId - 租客ID
   * @param {boolean} [isInfected=false] - 是否因感染驅逐
   * @param {string} [reason="正常退租"] - 驅逐原因
   * @returns {Promise<EvictionResult>} 驅逐結果
   * @throws {Error} 當系統未初始化或驅逐過程失敗時
   */
  async evictTenant(tenantId, isInfected = false, reason = "正常退租") {
    if (!this.initialized) {
      return { success: false, reason: "系統未初始化", error: "系統未初始化" };
    }

    console.log(`🚪 開始驅逐租客ID: ${tenantId} (原因: ${reason})`);

    try {
      // 尋找租客和房間
      const tenantInfo = this.findTenantAndRoom(tenantId);
      if (!tenantInfo) {
        return {
          success: false,
          reason: "找不到指定租客",
          error: "找不到指定租客",
        };
      }

      const { tenant, room } = tenantInfo;

      // 驗證驅逐條件
      const validation = this.validateEviction(tenant, room, isInfected);
      if (!validation.valid) {
        return {
          success: false,
          reason: validation.error || "驗證失敗",
          error: validation.error,
        };
      }

      // 執行驅逐流程
      const result = await this.executeEviction(
        tenant,
        room,
        isInfected,
        reason
      );

      if (result.success) {
        // 發送驅逐完成事件（使用 BaseManager 統一事件方法）
        this.emitEvent("tenantEvicted", {
          tenant: tenant,
          room: room,
          reason: reason,
          isInfected: isInfected,
          result: result,
        });

        this.addLog(
          `${tenant.name} 離開了房間 ${room.id}`,
          isInfected ? "danger" : "event"
        );
      }

      return result;
    } catch (error) {
      console.error("❌ 租客驅逐失敗:", error);
      this.logError("租客驅逐失敗", error);
      return {
        success: false,
        reason: "驅逐過程發生錯誤",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 尋找租客和房間
   * @param {number} tenantId - 租客ID
   * @returns {{tenant: Tenant, room: Room}|null} 租客和房間信息
   */
  findTenantAndRoom(tenantId) {
    const rooms = this.gameState.getStateValue("rooms", []);

    for (const room of rooms) {
      if (room.tenant && room.tenant.id === tenantId) {
        return { tenant: room.tenant, room: room };
      }
    }

    return null;
  }

  /**
   * 根據申請者ID尋找申請者
   * @param {number} applicantId - 申請者ID
   * @returns {Applicant|null} 申請者物件
   */
  findApplicantById(applicantId) {
    const applicants = this.gameState.getStateValue("applicants", []);
    return applicants.find((applicant) => applicant.id === applicantId) || null;
  }

  /**
   * 根據訪客ID尋找訪客
   * @param {number} visitorId - 訪客ID
   * @returns {Object|null} 訪客物件
   */
  findVisitorById(visitorId) {
    const visitors = this.gameState.getStateValue("visitors", []);
    return visitors.find((visitor) => visitor.id === visitorId) || null;
  }

  /**
   * 驗證驅逐條件
   * @param {Tenant} tenant - 租客物件
   * @param {Room} room - 房間物件
   * @param {boolean} isInfected - 是否因感染驅逐
   * @returns {import("../utils/validators.js").ValidationResult} 驗證結果
   */
  validateEviction(tenant, room, isInfected) {
    if (!this.validator) {
      return { valid: true, reason: "validator_unavailable" };
    }

    // 基本參數驗證
    if (!tenant || !room) {
      return {
        valid: false,
        error: "租客或房間資料無效",
        suggestion: "確認租客存在且在指定房間中",
      };
    }

    // 使用 validators.js 的租客操作驗證
    const tenantOperation = {
      type: "evict",
      tenant: tenant,
      room: room,
    };

    return this.validator.validateTenantOperation(tenantOperation);
  }

  /**
   * 執行驅逐流程
   * @param {Tenant} tenant - 租客物件
   * @param {Room} room - 房間物件
   * @param {boolean} isInfected - 是否因感染驅逐
   * @param {string} reason - 驅逐原因
   * @returns {Promise<EvictionResult>} 驅逐結果
   */
  async executeEviction(tenant, room, isInfected, reason) {
    /** @type {EvictionResult} */
    const result = {
      success: false,
      reason: reason,
      refund: 0,
      penalty: 0,
      leftBehind: { food: 0, materials: 0, medical: 0, fuel: 0, cash: 0 },
    };

    try {
      // 處理感染驅逐的特殊邏輯
      if (isInfected) {
        result.penalty = this.config?.evictionPenalty || 10;

        // 感染驅逐需要消毒費用
        if (this.resourceManager.hasEnoughResource("medical", 2)) {
          this.resourceManager.modifyResource("medical", -2, "disinfection");
          this.addLog("驅逐感染租客花費了 2 醫療用品進行消毒", "danger");
        } else {
          this.addLog("缺乏醫療用品，房間可能存在感染風險", "danger");
          room.needsRepair = true; // 標記需要維修（代表需要消毒）
        }
      } else {
        // 正常退租可能有退款
        if (Math.random() < (this.config?.refundRate || 0.5)) {
          result.refund = Math.floor(
            tenant.rent * (this.config?.refundRate || 0.5)
          );
          if (result.refund > 0) {
            this.resourceManager.modifyResource(
              "cash",
              -result.refund,
              "eviction_refund"
            );
            this.addLog(
              `退還 ${tenant.name} 的押金 $${result.refund}`,
              "event"
            );
          }
        }
      }

      // 處理遺留物品
      if (tenant.personalResources) {
        result.leftBehind = { ...tenant.personalResources };

        // 將遺留物品轉移到主資源池
        Object.keys(result.leftBehind).forEach((resourceType) => {
          const amount =
            result.leftBehind[/** @type {ResourceType} */ (resourceType)];
          if (amount > 0) {
            this.resourceManager.modifyResource(
              /** @type {ResourceType} */ (resourceType),
              amount,
              "tenant_leftBehind"
            );
          }
        });

        const totalLeftBehind = Object.values(result.leftBehind).reduce(
          (sum, val) => sum + val,
          0
        );
        if (totalLeftBehind > 0) {
          this.addLog(`${tenant.name} 留下了個人物品`, "event");
        }
      }

      // 移除租客
      room.tenant = null;

      // 更新遊戲狀態
      const updateSuccess = this.gameState.setState(
        {
          rooms: this.gameState.getStateValue("rooms", []),
        },
        `租客${tenant.name}離開`
      );

      if (!updateSuccess) {
        result.error = "狀態更新失敗";
        return result;
      }

      // 清理租客相關數據
      this.cleanupTenantData(tenant.id);

      // 更新統計
      this.updateTenantStats();

      result.success = true;
      return result;
    } catch (error) {
      console.error("執行驅逐流程失敗:", error);
      this.logError("執行驅逐流程失敗", error);
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  /**
   * 清理租客數據
   * @param {number} tenantId - 租客姓名
   * @returns {void}
   */
  cleanupTenantData(tenantId) {
    // 移除滿意度記錄
    this.tenantSatisfaction.delete(tenantId);

    // 移除個人註冊
    this.unregisterPerson(tenantId);

    // 移除關係記錄
    this.tenantRelationships = this.tenantRelationships.filter(
      (rel) => rel.tenant1Id !== tenantId && rel.tenant2Id !== tenantId
    );

    // 清理滿意度歷史（保留記錄但標記為已離開）
    this.satisfactionHistory.forEach((record) => {
      if (record.tenantId === tenantId) {
        record.reason = `${record.reason} (已離開)`;
      }
    });

    // 更新遊戲狀態中的滿意度記錄
    const currentSatisfaction = this.gameState.getStateValue(
      "tenantSatisfaction",
      {}
    );
    delete currentSatisfaction[tenantId];
    this.gameState.setStateValue(
      "tenantSatisfaction",
      currentSatisfaction,
      "tenant_cleanup"
    );
  }

  // ==========================================
  // 3. 滿意度系統
  // ==========================================

  /**
   * 更新租客滿意度 - 主要入口點
   * @param {number} [tenantId] - 特定租客ID，不提供則更新所有租客
   * @returns {void}
   */
  updateTenantSatisfaction(tenantId) {
    if (!this.initialized) {
      this.logWarning("系統未初始化，無法更新滿意度");
      return;
    }

    if (tenantId) {
      this.updateIndividualSatisfaction(tenantId);
    } else {
      this.updateAllTenantsatisfaction();
    }

    // 更新遊戲狀態中的滿意度記錄
    this.syncSatisfactionToGameState();
  }

  /**
   * 更新個別租客滿意度
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
    const oldSatisfaction =
      this.tenantSatisfaction.get(tenantId) ||
      this.satisfactionConfig.baseValue;
    const newSatisfaction = this.calculateSatisfaction(tenant, room);

    this.tenantSatisfaction.set(tenantId, newSatisfaction);

    // 記錄變更歷史
    if (Math.abs(newSatisfaction - oldSatisfaction) >= 1) {
      this.recordSatisfactionChange(
        tenantId,
        oldSatisfaction,
        newSatisfaction,
        "daily_update"
      );
    }

    // 檢查滿意度警告
    this.checkSatisfactionWarnings(tenantId, newSatisfaction);
  }

  /**
   * 更新所有租客滿意度
   * @returns {void}
   */
  updateAllTenantsatisfaction() {
    const tenants = this.gameState.getAllTenants();

    tenants.forEach((tenant) => {
      this.updateIndividualSatisfaction(tenant.id);
    });
  }

  /**
   * 計算租客滿意度
   * @param {Tenant} tenant - 租客物件
   * @param {Room} room - 房間物件
   * @returns {number} 滿意度值 (0-100)
   */
  calculateSatisfaction(tenant, room) {
    let satisfaction = this.satisfactionConfig.baseValue;
    const factors = this.config?.satisfactionFactors;

    if (!factors) return satisfaction;

    // 房間狀況影響
    if (room.reinforced) {
      satisfaction += factors.reinforcedRoom;
    }
    if (room.needsRepair) {
      satisfaction += factors.needsRepair;
    }

    // 個人資源影響
    if (tenant.personalResources) {
      if (tenant.personalResources.food < 2) {
        satisfaction += factors.lowPersonalFood;
      }
      if (tenant.personalResources.cash > 25) {
        satisfaction += factors.highPersonalCash;
      }
    }

    // 建築防禦影響
    const buildingDefense = this.gameState.getStateValue("buildingDefense", 0);
    if (buildingDefense >= 8) {
      satisfaction += factors.highBuildingDefense;
    } else if (buildingDefense <= 2) {
      satisfaction += factors.lowBuildingDefense;
    }

    // 全局效果影響
    if (this.gameState.getStateValue("emergencyTraining", false)) {
      satisfaction += factors.emergencyTraining;
    }
    if (this.gameState.getStateValue("buildingQuality", 0) >= 1) {
      satisfaction += factors.buildingQuality;
    }
    if (this.gameState.getStateValue("patrolSystem", false)) {
      satisfaction += factors.patrolSystem;
    }
    if (this.gameState.getStateValue("socialNetwork", false)) {
      satisfaction += factors.socialNetwork;
    }

    // 長者和諧氛圍加成
    const elderCount = this.gameState
      .getAllTenants()
      .filter((t) => t.type === "elder").length;
    satisfaction += elderCount * factors.elderHarmonyBonus;

    // 關係影響
    satisfaction += this.calculateRelationshipBonus(tenant.id);

    // 確保在有效範圍內
    return Math.max(
      this.satisfactionConfig.range.min,
      Math.min(this.satisfactionConfig.range.max, Math.round(satisfaction))
    );
  }

  /**
   * 計算關係加成
   * @param {number} tenantId - 租客ID
   * @returns {number} 關係加成值
   */
  calculateRelationshipBonus(tenantId) {
    const relationships = this.tenantRelationships.filter(
      (rel) => rel.tenant1Id === tenantId || rel.tenant2Id === tenantId
    );

    if (relationships.length === 0) return 0;

    const averageRelationship =
      relationships.reduce((sum, rel) => sum + rel.relationship, 0) /
      relationships.length;

    // 將關係值 (0-100) 轉換為滿意度影響 (-10 到 +10)
    return Math.round((averageRelationship - 50) * 0.2);
  }

  /**
   * 記錄滿意度變更歷史
   * @param {number} tenantId - 租客ID
   * @param {number} oldValue - 舊滿意度
   * @param {number} newValue - 新滿意度
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
    if (
      this.satisfactionHistory.length >
      SYSTEM_LIMITS.HISTORY.MAX_EXECUTION_HISTORY
    ) {
      this.satisfactionHistory.shift();
    }
  }

  /**
   * 檢查滿意度警告
   * @param {number} tenantId - 租客ID
   * @param {number} satisfaction - 滿意度值
   * @returns {void}
   */
  checkSatisfactionWarnings(tenantId, satisfaction) {
    const status = this.getSatisfactionStatus(satisfaction);
    const tenant = this.findTenantAndRoom(tenantId).tenant;

    if (status.level === "critical") {
      this.emitEvent("satisfactionCritical", {
        tenantId: tenantId,
        satisfaction: satisfaction,
        status: status,
      });

      this.addLog(
        `⚠️ ${tenant.name} 滿意度極低 (${satisfaction})，可能搬離`,
        "danger"
      );
    } else if (status.level === "warning") {
      this.emitEvent("satisfactionWarning", {
        tenantId: tenantId,
        satisfaction: satisfaction,
        status: status,
      });
    }
  }

  /**
   * 取得滿意度狀態
   * @param {number} satisfaction - 滿意度值
   * @returns {SatisfactionStatus} 滿意度狀態
   */
  getSatisfactionStatus(satisfaction) {
    const levels = this.satisfactionConfig.display?.levels || [
      { threshold: 80, name: "非常滿意", emoji: "😁", severity: "excellent" },
      { threshold: 60, name: "滿意", emoji: "😊", severity: "good" },
      { threshold: 40, name: "普通", emoji: "😐", severity: "normal" },
      { threshold: 20, name: "不滿", emoji: "😞", severity: "warning" },
      { threshold: 0, name: "極度不滿", emoji: "😡", severity: "critical" },
    ];

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
      issues: [],
      positives: [],
    };
  }

  /**
   * 同步滿意度到遊戲狀態
   * @returns {void}
   */
  syncSatisfactionToGameState() {
    const satisfactionObject = Object.fromEntries(this.tenantSatisfaction);
    this.gameState.setStateValue(
      "tenantSatisfaction",
      satisfactionObject,
      "satisfaction_sync"
    );
  }

  /**
   * 每日滿意度更新
   * @returns {void}
   */
  updateDailySatisfaction() {
    console.log("📊 執行每日滿意度更新");
    this.updateAllTenantsatisfaction();

    // 計算平均滿意度
    const averageSatisfaction = this.calculateAverageSatisfaction();

    // 發送每日滿意度報告事件（使用 BaseManager 統一事件方法）
    this.emitEvent("dailySatisfactionReport", {
      averageSatisfaction: averageSatisfaction,
      totalTenants: this.tenantSatisfaction.size,
      satisfactionDistribution: this.getSatisfactionDistribution(),
    });
  }

  /**
   * 計算平均滿意度
   * @returns {number} 平均滿意度
   */
  calculateAverageSatisfaction() {
    if (this.tenantSatisfaction.size === 0) return 0;

    const total = Array.from(this.tenantSatisfaction.values()).reduce(
      (sum, val) => sum + val,
      0
    );
    return Math.round(total / this.tenantSatisfaction.size);
  }

  /**
   * 取得滿意度分布
   * @returns {Object.<SatisfactionLevel, number>} 滿意度分布
   */
  getSatisfactionDistribution() {
    /** @type {Object.<string, number>} */
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

  // ==========================================
  // 4. 申請者系統
  // ==========================================

  /**
   * 生成申請者 - 主要入口點
   * @param {number} [count] - 生成數量，不提供則使用預設值
   * @returns {Applicant[]} 申請者列表
   */
  generateApplicants(count) {
    if (!this.initialized) {
      this.logWarning("系統未初始化，無法生成申請者");
      return [];
    }

    const generateCount = count || Math.floor(Math.random() * 3) + 1; // 1-3個申請者
    const applicants = [];

    for (let i = 0; i < generateCount; i++) {
      const applicant = this.createRandomApplicant();
      applicants.push(applicant);
    }

    this.currentApplicants = applicants;

    console.log(`👥 生成了 ${applicants.length} 個申請者`);
    return applicants;
  }

  /**
   * 建立隨機申請者
   * @returns {Applicant} 申請者物件
   */
  createRandomApplicant() {
    // 從租客類型配置中隨機選擇
    const tenantType = this.getRandomTenantType();
    const name = this.generateRandomName();
    const personId = this.generatePersonId();

    /** @type {Applicant} */
    const applicant = {
      id: personId,
      name: name,
      type: tenantType.typeId,
      typeName: tenantType.typeName,
      skill: tenantType.skill,
      rent: tenantType.rent,
      infected: Math.random() < tenantType.infectionRisk,
      revealedInfection: false,
      appearance: "",
      infectionRisk: tenantType.infectionRisk,
      personalResources: { ...tenantType.personalResources },
      description: tenantType.description,
    };

    // 註冊到統一系統
    this.registerPerson(personId, applicant, "applicant");

    // 生成外觀描述
    applicant.appearance = applicant.infected
      ? this.getInfectedAppearance()
      : this.getNormalAppearance();

    return applicant;
  }

  /**
   * 取得隨機租客類型
   * @returns {Object} 租客類型配置
   */
  getRandomTenantType() {
    if (!this.tenantTypes || this.tenantTypes.length === 0) {
      // 後備方案
      return {
        typeId: "worker",
        skill: "維修",
        rent: 12,
        infectionRisk: 0.2,
        personalResources: {
          food: 4,
          materials: 8,
          medical: 0,
          fuel: 0,
          cash: 15,
        },
        description: "擅長維修建築，房間升級，建築改良",
      };
    }

    return this.tenantTypes[
      Math.floor(Math.random() * this.tenantTypes.length)
    ];
  }

  /**
   * 生成隨機姓名 (從配置檔案讀取)
   * @returns {string} 隨機姓名
   */
  generateRandomName() {
    try {
      // 從配置中獲取名字列表
      const rules = this.dataManager.getGameRules();
      const names = rules.characterGeneration?.names;

      if (!names || !Array.isArray(names) || names.length === 0) {
        this.logWarning("名字配置不存在或為空，使用後備名字列表");
        return this._getFallbackName();
      }

      const randomIndex = Math.floor(Math.random() * names.length);
      return names[randomIndex];
    } catch (error) {
      this.logError("生成隨機姓名失敗，使用後備方案", error);
      return this._getFallbackName();
    }
  }

  /**
   * 取得感染者外觀描述 (從配置檔案讀取)
   * @returns {string} 外觀描述
   */
  getInfectedAppearance() {
    try {
      // 從配置中獲取感染者外觀描述列表
      const rules = this.dataManager.getGameRules();
      const infectedAppearances =
        rules.characterGeneration?.appearances?.infected;

      if (
        !infectedAppearances ||
        !Array.isArray(infectedAppearances) ||
        infectedAppearances.length === 0
      ) {
        this.logWarning("感染者外觀配置不存在或為空，使用後備描述");
        return this._getFallbackInfectedAppearance();
      }

      const randomIndex = Math.floor(
        Math.random() * infectedAppearances.length
      );
      return infectedAppearances[randomIndex];
    } catch (error) {
      this.logError("取得感染者外觀描述失敗，使用後備方案", error);
      return this._getFallbackInfectedAppearance();
    }
  }

  /**
   * 取得正常外觀描述 (從配置檔案讀取)
   * @returns {string} 外觀描述
   */
  getNormalAppearance() {
    try {
      // 從配置中獲取正常外觀描述列表
      const rules = this.dataManager.getGameRules();
      const normalAppearances = rules.characterGeneration?.appearances?.normal;

      if (
        !normalAppearances ||
        !Array.isArray(normalAppearances) ||
        normalAppearances.length === 0
      ) {
        this.logWarning("正常外觀配置不存在或為空，使用後備描述");
        return this._getFallbackNormalAppearance();
      }

      const randomIndex = Math.floor(Math.random() * normalAppearances.length);
      return normalAppearances[randomIndex];
    } catch (error) {
      this.logError("取得正常外觀描述失敗，使用後備方案", error);
      return this._getFallbackNormalAppearance();
    }
  }

  // ==========================================
  // 後備方案方法 (確保向下相容性)
  // ==========================================

  /**
   * 後備姓名生成 (當配置載入失敗時使用)
   * @returns {string} 後備姓名
   * @private
   */
  _getFallbackName() {
    const fallbackNames = [
      "小明",
      "小華",
      "小李",
      "老王",
      "阿強",
      "小美",
      "阿珍",
      "大雄",
      "靜香",
      "胖虎",
      "小張",
      "阿陳",
      "小林",
      "老劉",
      "阿花",
      "小玉",
      "阿寶",
      "小鳳",
      "阿義",
      "小雲",
    ];

    const randomIndex = Math.floor(Math.random() * fallbackNames.length);
    return fallbackNames[randomIndex];
  }

  /**
   * 後備感染者外觀描述 (當配置載入失敗時使用)
   * @returns {string} 後備感染者外觀描述
   * @private
   */
  _getFallbackInfectedAppearance() {
    const fallbackTraits = [
      "眼神有點呆滯，反應遲鈍",
      "皮膚蒼白，手有輕微顫抖",
      "說話時偶爾停頓，像在想什麼",
      "衣服有些血跡，說是意外受傷",
      "體溫似乎偏低，一直在發抖",
    ];

    const randomIndex = Math.floor(Math.random() * fallbackTraits.length);
    return fallbackTraits[randomIndex];
  }

  /**
   * 後備正常外觀描述 (當配置載入失敗時使用)
   * @returns {string} 後備正常外觀描述
   * @private
   */
  _getFallbackNormalAppearance() {
    const fallbackTraits = [
      "看起來精神狀態不錯",
      "衣著整潔，談吐得體",
      "眼神清澈，反應靈敏",
      "握手時手掌溫暖有力",
      "說話條理清晰，很有條理",
    ];

    const randomIndex = Math.floor(Math.random() * fallbackTraits.length);
    return fallbackTraits[randomIndex];
  }

  /**
   * 驗證角色生成配置的完整性
   * @returns {boolean} 配置是否完整
   */
  validateCharacterGenerationConfig() {
    try {
      const rules = this.dataManager.getGameRules();
      const charGenConfig = rules.characterGeneration;

      if (!charGenConfig) {
        this.logWarning("角色生成配置區塊不存在");
        return false;
      }

      // 檢查名字配置
      if (
        !charGenConfig.names ||
        !Array.isArray(charGenConfig.names) ||
        charGenConfig.names.length === 0
      ) {
        this.logWarning("名字配置無效");
        return false;
      }

      // 檢查外觀配置
      if (!charGenConfig.appearances) {
        this.logWarning("外觀配置區塊不存在");
        return false;
      }

      if (
        !charGenConfig.appearances.normal ||
        !Array.isArray(charGenConfig.appearances.normal)
      ) {
        this.logWarning("正常外觀配置無效");
        return false;
      }

      if (
        !charGenConfig.appearances.infected ||
        !Array.isArray(charGenConfig.appearances.infected)
      ) {
        this.logWarning("感染者外觀配置無效");
        return false;
      }

      this.logSuccess("角色生成配置驗證通過");
      return true;
    } catch (error) {
      this.logError("驗證角色生成配置時發生錯誤", error);
      return false;
    }
  }

  /**
   * 取得角色生成配置統計資訊
   * @returns {Object} 配置統計資訊
   */
  getCharacterGenerationStats() {
    try {
      const rules = this.dataManager.getGameRules();
      const charGenConfig = rules.characterGeneration;

      if (!charGenConfig) {
        return {
          valid: false,
          message: "配置不存在",
        };
      }

      return {
        valid: true,
        nameCount: charGenConfig.names?.length || 0,
        normalAppearanceCount: charGenConfig.appearances?.normal?.length || 0,
        infectedAppearanceCount:
          charGenConfig.appearances?.infected?.length || 0,
        totalDescriptions:
          (charGenConfig.appearances?.normal?.length || 0) +
          (charGenConfig.appearances?.infected?.length || 0),
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message,
        error: error,
      };
    }
  }

  /**
   * 移除申請者
   * @param {number} applicantId - 申請者ID
   * @returns {boolean} 移除是否成功
   */
  removeApplicant(applicantId) {
    const initialLength = this.currentApplicants.length;
    this.currentApplicants = this.currentApplicants.filter(
      (a) => a.id !== applicantId
    );
    return this.currentApplicants.length < initialLength;
  }

  /**
   * 取得當前申請者列表
   * @returns {Applicant[]} 申請者列表
   */
  getCurrentApplicants() {
    return [...this.currentApplicants];
  }

  /**
   * 清空申請者列表
   * @returns {void}
   */
  clearApplicants() {
    this.currentApplicants = [];
  }

  // ==========================================
  // 5. 關係與衝突管理
  // ==========================================

  /**
   * 檢查衝突觸發條件
   * @returns {void}
   */
  checkConflictTriggers() {
    if (!this.initialized) return;

    const tenants = this.gameState.getAllTenants();
    if (tenants.length < 2) return;

    console.log("🔍 檢查租客衝突觸發條件");

    // 基於滿意度檢查衝突
    this.checkSatisfactionBasedConflicts();

    // 基於資源稀缺檢查衝突
    this.checkResourceScarcityConflicts();

    // 基於關係檢查衝突
    this.checkRelationshipConflicts();
  }

  /**
   * 檢查基於滿意度的衝突
   * @returns {void}
   */
  checkSatisfactionBasedConflicts() {
    const lowSatisfactionTenants = [];

    this.tenantSatisfaction.forEach((satisfaction, tenantId) => {
      if (satisfaction < (this.config?.conflictThreshold || 40)) {
        lowSatisfactionTenants.push(tenantId);
      }
    });

    if (lowSatisfactionTenants.length >= 2) {
      this.triggerSatisfactionConflict(lowSatisfactionTenants);
    }
  }

  /**
   * 檢查基於資源稀缺的衝突
   * @returns {void}
   */
  checkResourceScarcityConflicts() {
    const totalTenants = this.gameState.getAllTenants().length;
    const currentFood = this.gameState.getStateValue("resources.food", 0);
    const currentFuel = this.gameState.getStateValue("resources.fuel", 0);

    // 食物稀缺衝突
    if (currentFood < totalTenants * 3) {
      this.triggerResourceConflict("food", currentFood, totalTenants * 3);
    }

    // 燃料稀缺衝突
    if (currentFuel < 3) {
      this.triggerResourceConflict("fuel", currentFuel, 5);
    }
  }

  /**
   * 檢查基於關係的衝突
   * @returns {void}
   */
  checkRelationshipConflicts() {
    const poorRelationships = this.tenantRelationships.filter(
      (rel) => rel.relationship < 20
    );

    poorRelationships.forEach((rel) => {
      if (Math.random() < 0.3) {
        // 30% 機率觸發關係衝突
        this.triggerRelationshipConflict(rel);
      }
    });
  }

  /**
   * 觸發滿意度衝突
   * @param {number[]} involvedTenants - 涉及的租客
   * @returns {void}
   */
  triggerSatisfactionConflict(involvedTenants) {
    /** @type {ConflictEvent} */
    const conflict = {
      id: `conflict_${Date.now()}`,
      type: "satisfaction_dispute",
      involvedTenants: involvedTenants,
      description: "租客們對生活條件產生不滿，情緒緊張",
      severity: 3,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    this.conflictHistory.push(conflict);
    this.emitEvent("conflictTriggered", conflict);

    this.addLog(
      `⚠️ 檢測到租客間緊張情緒，涉及: ${involvedTenants.join(", ")}`,
      "danger"
    );
  }

  /**
   * 觸發資源衝突
   * @param {string} resourceType - 資源類型
   * @param {number} current - 當前數量
   * @param {number} needed - 需要數量
   * @returns {void}
   */
  triggerResourceConflict(resourceType, current, needed) {
    const tenants = this.gameState.getAllTenants();
    if (tenants.length < 2) return;

    const involvedTenants = tenants.slice(0, 2).map((t) => t.id);

    /** @type {ConflictEvent} */
    const conflict = {
      id: `conflict_${Date.now()}`,
      type: "resource_scarcity",
      involvedTenants: involvedTenants,
      description: `${resourceType} 資源稀缺引發分配爭議 (需要 ${needed}，目前 ${current})`,
      severity: 4,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    this.conflictHistory.push(conflict);
    this.emitEvent("conflictTriggered", conflict);

    this.addLog(`🔥 ${resourceType} 資源稀缺引發租客爭議`, "danger");
  }

  /**
   * 觸發關係衝突
   * @param {TenantRelationship} relationship - 關係記錄
   * @returns {void}
   */
  triggerRelationshipConflict(relationship) {
    const tenant1 = this.findTenantAndRoom(relationship.tenant1Id).tenant;
    const tenant2 = this.findTenantAndRoom(relationship.tenant2Id).tenant;
    /** @type {ConflictEvent} */
    const conflict = {
      id: `conflict_${Date.now()}`,
      type: "interpersonal_conflict",
      involvedTenants: [tenant1.id, tenant2.id],
      description: `${tenant1.name} 和 ${tenant2.name} 之間關係惡化`,
      severity: 2,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    this.conflictHistory.push(conflict);
    this.emitEvent("conflictTriggered", conflict);

    this.addLog(`💥 ${tenant1.name} 和 ${tenant2.name} 發生爭執`, "danger");
  }

  /**
   * 解決衝突
   * @param {string} conflictId - 衝突ID
   * @param {string} resolution - 解決方案
   * @returns {boolean} 解決是否成功
   */
  resolveConflict(conflictId, resolution) {
    const conflict = this.conflictHistory.find((c) => c.id === conflictId);
    if (!conflict) {
      console.warn(`找不到衝突記錄: ${conflictId}`);
      return false;
    }

    conflict.resolved = true;
    conflict.description += ` | 解決方案: ${resolution}`;

    // 提升涉及租客的滿意度
    conflict.involvedTenants.forEach((tenantId) => {
      const currentSatisfaction =
        this.tenantSatisfaction.get(tenantId) ||
        this.satisfactionConfig.baseValue;
      const newSatisfaction = Math.min(100, currentSatisfaction + 10);
      this.tenantSatisfaction.set(tenantId, newSatisfaction);

      this.recordSatisfactionChange(
        tenantId,
        currentSatisfaction,
        newSatisfaction,
        "conflict_resolved"
      );
    });

    this.emitEvent("conflictResolved", { conflict, resolution });
    this.addLog(`✅ 衝突已解決: ${resolution}`, "event");

    return true;
  }

  // ==========================================
  // 6. 搜刮派遣系統（統一 scavenge_ 事件）
  // ==========================================

  /**
   * 派遣租客進行搜刮 - 主要入口點
   * @param {number} tenantId - 租客ID
   * @returns {Promise<Object>} 搜刮結果
   */
  async sendTenantScavenging(tenantId) {
    if (!this.initialized) {
      return { success: false, error: "系統未初始化" };
    }

    console.log(`🚶 派遣租客搜刮ID: ${tenantId}`);

    try {
      // 檢查搜刮條件
      const canScavengeResult = this.canScavenge();
      if (!canScavengeResult.canScavenge) {
        return {
          success: false,
          error: canScavengeResult.reason,
          remainingAttempts: canScavengeResult.remaining,
        };
      }

      // 尋找租客
      const tenantInfo = this.findTenantAndRoom(tenantId);
      if (!tenantInfo) {
        return { success: false, error: "找不到指定租客" };
      }

      const { tenant, room } = tenantInfo;

      // 檢查租客狀態
      const tenantValidation = this.validateTenantForScavenging(tenant);
      if (!tenantValidation.valid) {
        return { success: false, error: tenantValidation.error };
      }

      // 計算成功率
      const successRate = this.calculateScavengeSuccessRate(tenant);

      // 發送搜刮開始事件（統一使用 scavenge_ 前綴，業務領域事件）
      this.emitEvent(
        "scavenge_started",
        {
          tenant: tenant,
          baseSuccessRate: successRate,
          timestamp: new Date().toISOString(),
        },
        { skipPrefix: true }
      ); // 業務領域事件

      // 執行搜刮結果
      const result = await this.executeScavengeResult(tenant, successRate);

      // 更新搜刮狀態
      this._updateScavengeState(result.success);

      // 發送搜刮完成事件（統一使用 scavenge_ 前綴）
      this.emitEvent(
        "scavenge_completed",
        {
          tenant: tenant,
          result: result,
          timestamp: new Date().toISOString(),
        },
        { skipPrefix: true }
      ); // 業務領域事件

      return result;
    } catch (error) {
      console.error("❌ 搜刮派遣失敗:", error);
      this.logError("搜刮派遣失敗", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 檢查是否可以進行搜刮
   * @returns {Object} 搜刮條件檢查結果
   */
  canScavenge() {
    try {
      const scavengeConfig = this._getScavengeConfig();
      const maxPerDay = scavengeConfig.maxPerDay || 2;
      const currentUsed = this.gameState.getStateValue("scavengeUsed", 0);

      if (currentUsed >= maxPerDay) {
        return {
          canScavenge: false,
          reason: `今日搜刮次數已用完 (${currentUsed}/${maxPerDay})`,
          remaining: 0,
          maxPerDay: maxPerDay,
        };
      }

      return {
        canScavenge: true,
        reason: "可以進行搜刮",
        remaining: maxPerDay - currentUsed,
        maxPerDay: maxPerDay,
      };
    } catch (error) {
      console.error("檢查搜刮條件失敗:", error);
      this.logError("檢查搜刮條件失敗", error);
      return {
        canScavenge: false,
        reason: "系統錯誤",
        remaining: 0,
      };
    }
  }

  /**
   * 取得可用的搜刮人員列表
   * @returns {Tenant[]} 可派遣租客列表
   */
  getAvailableScavengers() {
    if (!this.initialized) {
      this.logWarning("系統未初始化");
      return [];
    }

    try {
      const allTenants = this.gameState.getAllTenants();

      // 過濾出可派遣的租客
      const availableScavengers = allTenants.filter((tenant) => {
        // 排除感染租客
        if (tenant.infected) return false;

        // 排除正在執行任務的租客
        if (tenant.onMission) return false;

        // 排除健康狀況不佳的租客（可以擴展更多條件）
        return true;
      });

      // 按搜刮能力排序（軍人 > 工人 > 農夫 > 醫生 > 老人）
      const typeOrder = {
        soldier: 5,
        worker: 4,
        farmer: 3,
        doctor: 2,
        elder: 1,
      };
      availableScavengers.sort((a, b) => {
        const aOrder = typeOrder[a.type] || 0;
        const bOrder = typeOrder[b.type] || 0;
        return bOrder - aOrder;
      });

      return availableScavengers;
    } catch (error) {
      console.error("取得可用搜刮人員失敗:", error);
      this.logError("取得可用搜刮人員失敗", error);
      return [];
    }
  }

  /**
   * 驗證租客是否可以執行搜刮任務
   * @param {Tenant} tenant - 租客物件
   * @returns {import("../utils/validators.js").ValidationResult} 驗證結果
   */
  validateTenantForScavenging(tenant) {
    if (!tenant) {
      return { valid: false, error: "租客資料無效" };
    }

    if (tenant.infected) {
      return { valid: false, error: `${tenant.name} 已感染，無法外出搜刮` };
    }

    if (tenant.onMission) {
      return { valid: false, error: `${tenant.name} 正在執行其他任務` };
    }

    // 檢查租客個人健康狀況（可擴展）
    if (tenant.personalResources?.food === 0) {
      return {
        valid: false,
        error: `${tenant.name} 飢餓狀態，不適合外出搜刮`,
      };
    }

    return { valid: true };
  }

  /**
   * 計算搜刮成功率（純基礎功能）
   * @param {Tenant} tenant - 租客物件
   * @returns {number} 成功率百分比 (0-100)
   */
  calculateScavengeSuccessRate(tenant) {
    try {
      const scavengeConfig = this._getScavengeConfig();
      const baseRates = scavengeConfig.baseSuccessRates || {};

      // 取得租客類型的基礎成功率
      const baseRate = baseRates[tenant.type] || 50; // 預設50%

      console.log(
        `📊 ${tenant.name} (${tenant.type}) 搜刮基礎成功率: ${baseRate}%`
      );

      return baseRate;
    } catch (error) {
      console.error("計算搜刮成功率失敗:", error);
      this.logError("計算搜刮成功率失敗", error);
      return 50; // 預設成功率
    }
  }

  /**
   * 執行搜刮並處理結果
   * @param {Tenant} tenant - 執行搜刮的租客
   * @param {number} successRate - 成功率
   * @returns {Promise<Object>} 搜刮結果
   */
  async executeScavengeResult(tenant, successRate) {
    try {
      // 隨機判定是否成功
      const isSuccess = Math.random() * 100 < successRate;

      /** @type {Object} */
      const result = {
        success: isSuccess,
        tenantId: tenant.id,
        tenantType: tenant.type,
        successRate: successRate,
        rewards: {},
        risks: {},
        message: "",
      };

      if (isSuccess) {
        // 成功：獲得資源獎勵
        result.rewards = this._generateScavengeRewards();
        result.message = `${tenant.name} 搜刮成功！`;

        // 將獎勵添加到主資源池
        Object.entries(result.rewards).forEach(([resourceType, amount]) => {
          if (amount > 0) {
            this.resourceManager.modifyResource(
              /** @type {ResourceType} */ (resourceType),
              amount,
              `${tenant.name}搜刮獲得`
            );
          }
        });

        this.addLog(`${tenant.name} 搜刮成功，獲得了一些物資`, "event");
      } else {
        // 失敗：可能受傷或其他風險
        result.risks = this._processScavengeRisks(tenant);
        result.message = `${tenant.name} 搜刮失敗`;

        this.addLog(`${tenant.name} 搜刮失敗，空手而歸`, "danger");
      }

      return result;
    } catch (error) {
      console.error("執行搜刮結果失敗:", error);
      this.logError("執行搜刮結果失敗", error);
      return {
        success: false,
        tenantId: tenant.id,
        error: error instanceof Error ? error.message : String(error),
        message: "搜刮過程發生錯誤",
      };
    }
  }

  /**
   * 生成搜刮獎勵
   * @private
   * @returns {Object} 獎勵資源
   */
  _generateScavengeRewards() {
    const scavengeConfig = this._getScavengeConfig();
    const rewardRanges = scavengeConfig.rewardRanges || {};

    const rewards = {};

    // 隨機選擇 1-2 種資源類型
    const resourceTypes = ["food", "materials", "medical"];
    const selectedTypes = resourceTypes
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 2) + 1);

    selectedTypes.forEach((resourceType) => {
      const range = rewardRanges[resourceType];
      if (range) {
        const min = range.min || 1;
        const max = range.max || 3;
        const amount = Math.floor(Math.random() * (max - min + 1)) + min;
        rewards[resourceType] = amount;
      }
    });

    return rewards;
  }

  /**
   * 處理搜刮風險
   * @private
   * @param {Tenant} tenant - 租客物件
   * @returns {Object} 風險處理結果
   */
  _processScavengeRisks(tenant) {
    const risks = {};

    // 10% 機率受輕傷（消耗個人食物恢復）
    if (Math.random() < 0.1) {
      if (tenant.personalResources && tenant.personalResources.food > 0) {
        tenant.personalResources.food = Math.max(
          0,
          tenant.personalResources.food - 1
        );
        risks.minorInjury = true;
        this.addLog(`${tenant.name} 在搜刮中受了輕傷`, "danger");
      }
    }

    // 5% 機率感染風險增加（但不會立即感染）
    if (Math.random() < 0.05) {
      risks.infectionRisk = true;
      this.addLog(`${tenant.name} 接觸了可疑物質，需要注意健康`, "danger");
    }

    return risks;
  }

  /**
   * 取得搜刮配置
   * @private
   * @returns {Object} 搜刮配置
   */
  _getScavengeConfig() {
    try {
      const rules = this.gameState.getStateValue("system.gameRules") || {};
      return (
        rules.mechanics?.scavenging || {
          maxPerDay: 2,
          baseSuccessRates: {
            soldier: 85,
            worker: 75,
            farmer: 65,
            doctor: 50,
            elder: 40,
          },
          rewardRanges: {
            food: { min: 3, max: 8 },
            materials: { min: 2, max: 6 },
            medical: { min: 1, max: 4 },
          },
        }
      );
    } catch (error) {
      console.warn("載入搜刮配置失敗，使用預設值:", error);
      return {
        maxPerDay: 2,
        baseSuccessRates: {
          soldier: 85,
          worker: 75,
          farmer: 65,
          doctor: 50,
          elder: 40,
        },
        rewardRanges: {
          food: { min: 3, max: 8 },
          materials: { min: 2, max: 6 },
          medical: { min: 1, max: 4 },
        },
      };
    }
  }

  /**
   * 更新搜刮狀態
   * @private
   * @param {boolean} wasSuccessful - 搜刮是否成功
   * @returns {void}
   */
  _updateScavengeState(wasSuccessful) {
    try {
      // 增加今日搜刮使用次數
      const currentUsed = this.gameState.getStateValue("scavengeUsed", 0);
      this.gameState.setStateValue(
        "scavengeUsed",
        currentUsed + 1,
        "scavenge_attempt"
      );

      console.log(`📊 今日搜刮次數: ${currentUsed + 1}`);
    } catch (error) {
      console.error("更新搜刮狀態失敗:", error);
      this.logError("更新搜刮狀態失敗", error);
    }
  }

  /**
   * 重置每日搜刮狀態（由日夜循環調用）
   * @returns {void}
   */
  resetDailyScavengeStatus() {
    try {
      // 重置每日搜刮次數
      this.gameState.setStateValue("scavengeUsed", 0, "daily_reset");
      console.log("🔄 每日搜刮次數已重置");
    } catch (error) {
      console.error("重置每日搜刮狀態失敗:", error);
      this.logError("重置每日搜刮狀態失敗", error);
    }
  }

  /**
   * 取得搜刮狀態資訊
   * @returns {Object} 搜刮狀態
   */
  getScavengeStatus() {
    const scavengeResult = this.canScavenge();
    const availableScavengers = this.getAvailableScavengers();

    return {
      canScavenge: scavengeResult.canScavenge,
      reason: scavengeResult.reason,
      remainingAttempts: scavengeResult.remaining,
      maxPerDay: scavengeResult.maxPerDay,
      availableScavengers: availableScavengers.length,
      scavengerList: availableScavengers.map((t) => ({
        id: t.id,
        type: t.type,
        successRate: this.calculateScavengeSuccessRate(t),
      })),
    };
  }

  // ==========================================
  // 7. 工具函數與系統管理
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
   * 取得空房間列表
   * @returns {Room[]} 空房間列表
   */
  getEmptyRooms() {
    const rooms = this.gameState.getStateValue("rooms", []);
    return rooms.filter(
      /** @type {function(Room): boolean} */ (room) => !room.tenant
    );
  }

  /**
   * 取得所有租客的滿意度
   * @returns {Map<number, number>} 租客滿意度映射
   */
  getAllSatisfaction() {
    return new Map(this.tenantSatisfaction);
  }

  /**
   * 取得租客統計資料
   * @returns {TenantStats} 租客統計
   */
  getTenantStats() {
    const tenants = this.gameState.getAllTenants();

    /** @type {TenantStats} */
    const stats = {
      totalTenants: tenants.length,
      healthyTenants: tenants.filter((t) => !t.infected).length,
      infectedTenants: tenants.filter((t) => t.infected).length,
      onMissionTenants: tenants.filter((t) => t.onMission).length,
      averageSatisfaction: this.calculateAverageSatisfaction(),
      totalRentIncome: tenants.reduce((sum, t) => sum + t.rent, 0),
      typeDistribution: {},
    };

    // 計算職業分布
    /** @type {TenantType[]} */
    const types = ["doctor", "worker", "farmer", "soldier", "elder"];
    types.forEach((type) => {
      stats.typeDistribution[type] = tenants.filter(
        (t) => t.type === type
      ).length;
    });

    return stats;
  }

  /**
   * 更新租客統計
   * @returns {void}
   */
  updateTenantStats() {
    const stats = this.getTenantStats();

    // 發送統計更新事件（使用 BaseManager 統一事件方法）
    this.emitEvent("tenantStatsUpdated", stats);
  }

  /**
   * 從資源變更更新滿意度
   * @param {Object} data - 資源變更事件數據
   * @returns {void}
   */
  updateSatisfactionFromResourceChange(data) {
    // 如果是租客購買資源，提升滿意度
    if (data.resourceType === "food" && data.changeAmount > 0) {
      // 這裡需要確定是哪個租客進行了購買
      // 暫時提升所有租客滿意度
      this.tenantSatisfaction.forEach((satisfaction, tenantId) => {
        const newSatisfaction = Math.min(100, satisfaction + 2);
        this.tenantSatisfaction.set(tenantId, newSatisfaction);
      });
    }
  }

  /**
   * 從防禦變更更新滿意度
   * @returns {void}
   */
  updateSatisfactionFromDefenseChange() {
    // 建築防禦提升時，所有租客滿意度微幅上升
    this.tenantSatisfaction.forEach((satisfaction, tenantId) => {
      const newSatisfaction = Math.min(100, satisfaction + 1);
      this.tenantSatisfaction.set(tenantId, newSatisfaction);
    });
  }

  /**
   * 取得滿意度歷史
   * @param {number} [limit=20] - 返回記錄數量限制
   * @returns {SatisfactionHistory[]} 滿意度歷史
   */
  getSatisfactionHistory(limit = 20) {
    return this.satisfactionHistory.slice(-limit);
  }

  /**
   * 取得衝突歷史
   * @param {number} [limit=10] - 返回記錄數量限制
   * @returns {ConflictEvent[]} 衝突歷史
   */
  getConflictHistory(limit = 10) {
    return this.conflictHistory.slice(-limit);
  }

  /**
   * 取得租客關係列表
   * @returns {TenantRelationship[]} 租客關係列表
   */
  getTenantRelationships() {
    return [...this.tenantRelationships];
  }

  /**
   * 取得ID使用統計
   * @returns {Object} ID統計資料
   */
  getIDStats() {
    const roleStats = {};
    for (const [id, person] of this.personRegistry) {
      const role = person._systemRole;
      roleStats[role] = (roleStats[role] || 0) + 1;
    }

    return {
      nextPersonId: this.nextPersonId,
      totalPersons: this.personRegistry.size,
      roleDistribution: roleStats,
      satisfactionMappings: this.tenantSatisfaction.size,
    };
  }

  /**
   * 驗證ID系統完整性
   * @returns {Object} 驗證結果
   */
  validateIDSystemIntegrity() {
    const issues = [];
    const warnings = [];

    // 檢查房間中的租客是否都有ID
    const rooms = this.gameState.getStateValue("rooms", []);
    const tenantsWithoutID = rooms
      .filter((r) => r.tenant && !r.tenant.id)
      .map((r) => r.tenant.name);

    if (tenantsWithoutID.length > 0) {
      issues.push(`房間租客缺少ID: ${tenantsWithoutID.join(", ")}`);
    }

    // 檢查申請者是否都有ID
    const applicants = this.gameState.getStateValue("applicants", []);
    const applicantsWithoutID = applicants
      .filter((a) => !a.id)
      .map((a) => a.name);

    if (applicantsWithoutID.length > 0) {
      issues.push(`申請者缺少ID: ${applicantsWithoutID.join(", ")}`);
    }

    // 檢查滿意度映射的一致性
    const tenantIds = rooms
      .filter((r) => r.tenant && r.tenant.id)
      .map((r) => r.tenant.id);

    const satisfactionIds = Array.from(this.tenantSatisfaction.keys());
    const unmappedSatisfactions = satisfactionIds.filter(
      (id) => !tenantIds.includes(id)
    );

    if (unmappedSatisfactions.length > 0) {
      warnings.push(
        `存在無對應租客的滿意度記錄: ${unmappedSatisfactions.join(", ")}`
      );
    }

    return {
      isValid: issues.length === 0,
      issues: issues,
      warnings: warnings,
      stats: this.getIDStats(),
    };
  }

  /**
   * 清理系統數據
   * @returns {void}
   */
  cleanup() {
    this.tenantSatisfaction.clear();
    this.tenantRelationships = [];
    this.conflictHistory = [];
    this.satisfactionHistory = [];
    this.currentApplicants = [];

    // 調用 BaseManager 的清理方法
    super.cleanup();

    console.log("TenantManager 已清理");
  }
}

export default TenantManager;

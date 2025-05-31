/**
 * TenantSystem.js - 租客生命週期管理系統
 *
 * 職責：
 * - 租客申請者生成與篩選
 * - 租客雇用與解僱流程
 * - 滿意度計算與狀態管理
 * - 個人資源與感染狀態控制
 * - 租客日常行為與互動處理
 *
 * 架構特點：
 * - 完全配置驅動，所有參數來自 rules.json
 * - 整合InstanceValidator，統一驗證機制
 * - 事件驅動通信，與其他系統解耦
 * - 狀態管理分離，支援序列化與復原
 *
 * v2.1 更新：
 * - 整合TenantInstanceValidator和GameStateInstanceValidator
 * - 統一ValidationResult錯誤處理機制
 * - 增強資料完整性驗證
 */

import {
  defaultValidatorFactory,
  ValidationResult,
  ValidationUtils,
} from "../utils/validators.js";
import {
  DATA_TYPES,
  ERROR_CODES,
  MESSAGE_TEMPLATES,
} from "../utils/constants.js";

export class TenantSystem {
  constructor(gameStateRef, dataManager, gameHelpers) {
    this.gameState = gameStateRef;
    this.dataManager = dataManager;
    this.gameHelpers = gameHelpers;

    // 租客狀態管理
    this.tenantStates = new Map(); // tenantName -> TenantState
    this.applicantPool = [];
    this.lastApplicantGeneration = 0;

    // 系統狀態
    this.initialized = false;
    this.configLoaded = false;
    this.tenantConfigs = null;

    // 事件監聽器
    this.eventListeners = new Map();

    // ID 生成器
    this.idCounter = 0;

    // 驗證器快取（效能優化）
    this.tenantValidator = null;
    this.gameStateValidator = null;

    // 驗證統計
    this.validationStats = {
      applicantsValidated: 0,
      tenantsValidated: 0,
      validationErrors: 0,
      validationWarnings: 0,
    };

    console.log("🏠 TenantSystem v2.1 初始化中（整合InstanceValidator）...");
  }

  /**
   * 系統初始化
   */
  async initialize() {
    try {
      console.log("📋 載入租客配置資料...");

      // 載入租客配置
      this.tenantConfigs = this.dataManager.getCachedData("tenants");
      if (!this.tenantConfigs) {
        console.warn("⚠️ 租客配置未載入，使用預設配置");
        this.tenantConfigs = this.getDefaultTenantConfigs();
      }

      // 初始化驗證器
      this.initializeValidators();

      // 驗證遊戲狀態
      await this.validateGameStateIntegrity();

      this.configLoaded = true;
      this.initialized = true;

      console.log("✅ TenantSystem v2.1 初始化完成");
      console.log("🔍 驗證器狀態:", {
        tenantValidator: !!this.tenantValidator,
        gameStateValidator: !!this.gameStateValidator,
      });

      return true;
    } catch (error) {
      console.error("❌ TenantSystem 初始化失敗:", error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * 初始化驗證器實例
   */
  initializeValidators() {
    // 取得實例驗證器
    this.tenantValidator =
      defaultValidatorFactory.getInstanceValidator("tenant");
    this.gameStateValidator =
      defaultValidatorFactory.getInstanceValidator("gameState");

    if (!this.tenantValidator) {
      console.warn("⚠️ TenantInstanceValidator 不可用，使用後備驗證");
    }

    if (!this.gameStateValidator) {
      console.warn("⚠️ GameStateInstanceValidator 不可用，使用後備驗證");
    }

    console.log("🔍 驗證器初始化完成");
  }

  /**
   * 驗證遊戲狀態完整性
   */
  async validateGameStateIntegrity() {
    if (!this.gameStateValidator) {
      console.warn("⚠️ GameStateValidator 不可用，跳過狀態驗證");
      return;
    }

    console.log("🔍 驗證遊戲狀態完整性...");

    const validationResult = this.gameStateValidator.validateGameState(
      this.gameState
    );

    if (!validationResult.isValid) {
      console.error("❌ 遊戲狀態驗證失敗:");
      validationResult.errors.forEach((error, index) => {
        console.error(`  ${index + 1}. ${error.message}`);
      });

      // 嘗試修復關鍵問題
      this.attemptGameStateRepair(validationResult);
    } else {
      console.log("✅ 遊戲狀態驗證通過");
    }

    if (validationResult.warnings.length > 0) {
      console.warn(`⚠️ 遊戲狀態警告 (${validationResult.warnings.length}個):`);
      validationResult.warnings.forEach((warning, index) => {
        console.warn(`  ${index + 1}. ${warning.message}`);
      });
    }
  }

  /**
   * 嘗試修復遊戲狀態問題
   */
  attemptGameStateRepair(validationResult) {
    console.log("🔧 嘗試修復遊戲狀態問題...");

    let repairCount = 0;

    validationResult.errors.forEach((error) => {
      switch (error.code) {
        case "INVALID_DAY":
          if (this.gameState.day < 1) {
            this.gameState.day = 1;
            repairCount++;
            console.log("🔧 修復：重設遊戲天數為 1");
          }
          break;

        case "INVALID_RESOURCES_TYPE":
          if (
            !this.gameState.resources ||
            typeof this.gameState.resources !== "object"
          ) {
            this.gameState.resources = this.getDefaultResources();
            repairCount++;
            console.log("🔧 修復：重建資源物件");
          }
          break;

        case "INVALID_ROOMS_TYPE":
          if (!Array.isArray(this.gameState.rooms)) {
            this.gameState.rooms = this.getDefaultRooms();
            repairCount++;
            console.log("🔧 修復：重建房間陣列");
          }
          break;

        case "NEGATIVE_RESOURCE_VALUE":
          if (error.field && error.field.startsWith("resources.")) {
            const resourceType = error.field.split(".")[1];
            if (this.gameState.resources[resourceType] < 0) {
              this.gameState.resources[resourceType] = 0;
              repairCount++;
              console.log(`🔧 修復：重設 ${resourceType} 為 0`);
            }
          }
          break;
      }
    });

    console.log(`🔧 完成狀態修復，共修復 ${repairCount} 個問題`);
  }

  /**
   * 生成申請者列表 - 核心功能（增強驗證版）
   */
  generateApplicants(count = null) {
    if (!this.initialized) {
      console.warn("⚠️ TenantSystem 未初始化，使用簡化生成");
      return this.generateFallbackApplicants(count);
    }

    // 防止重複生成（當日限制）
    if (
      this.applicantPool.length > 0 &&
      this.lastApplicantGeneration === this.gameState.day
    ) {
      return this.applicantPool;
    }

    const finalCount = count || this.calculateApplicantCount();
    console.log(`📋 生成 ${finalCount} 個租客申請者...`);

    // 取得可用租客類型（基於解鎖條件）
    const availableTypes = this.getAvailableTenantTypes();
    if (availableTypes.length === 0) {
      console.warn("⚠️ 沒有可用的租客類型");
      return [];
    }

    this.applicantPool = [];
    let validApplicants = 0;

    for (let i = 0; i < finalCount; i++) {
      const typeConfig = this.selectTenantType(availableTypes);
      const applicant = this.createApplicantFromConfig(typeConfig);

      // 使用InstanceValidator驗證申請者
      const validationResult = this.validateApplicant(applicant);

      if (validationResult.isValid) {
        this.applicantPool.push(applicant);
        validApplicants++;
      } else {
        console.warn(
          `⚠️ 申請者 ${applicant.name} 驗證失敗:`,
          validationResult.getFirstError()?.message
        );
        this.validationStats.validationErrors++;

        // 嘗試創建後備申請者
        const fallbackApplicant = this.createFallbackApplicant(typeConfig);
        const fallbackValidation = this.validateApplicant(fallbackApplicant);

        if (fallbackValidation.isValid) {
          this.applicantPool.push(fallbackApplicant);
          validApplicants++;
          console.log(`✅ 使用後備申請者 ${fallbackApplicant.name}`);
        }
      }

      // 處理驗證警告
      if (validationResult.warnings.length > 0) {
        this.validationStats.validationWarnings +=
          validationResult.warnings.length;
        console.warn(
          `⚠️ 申請者 ${applicant.name} 驗證警告:`,
          validationResult.warnings
        );
      }
    }

    this.lastApplicantGeneration = this.gameState.day;
    this.validationStats.applicantsValidated += finalCount;

    console.log(`✅ 成功生成 ${validApplicants}/${finalCount} 個有效申請者`);
    console.log(
      `📊 驗證統計: 錯誤 ${this.validationStats.validationErrors}, 警告 ${this.validationStats.validationWarnings}`
    );

    return [...this.applicantPool]; // 返回副本避免外部修改
  }

  /**
   * 驗證申請者實例
   */
  validateApplicant(applicant) {
    if (!this.tenantValidator) {
      // 後備驗證
      return this.validateApplicantFallback(applicant);
    }

    try {
      const result = this.tenantValidator.validateApplicant(applicant);
      return result;
    } catch (error) {
      console.error("❌ 申請者驗證過程發生錯誤:", error);
      return new ValidationResult(false).addError(
        `申請者驗證失敗: ${error.message}`,
        null,
        ERROR_CODES.DATA_VALIDATION_FAILED
      );
    }
  }

  /**
   * 後備申請者驗證
   */
  validateApplicantFallback(applicant) {
    const result = new ValidationResult(true);

    // 基本欄位檢查
    const requiredFields = ["id", "name", "type", "rent", "infected"];
    requiredFields.forEach((field) => {
      if (!(field in applicant)) {
        result.addError(
          `申請者缺少必要欄位: ${field}`,
          field,
          "MISSING_REQUIRED_FIELD"
        );
      }
    });

    // 基本類型檢查
    if (
      typeof applicant.name !== "string" ||
      applicant.name.trim().length === 0
    ) {
      result.addError("申請者姓名無效", "name", "INVALID_NAME");
    }

    if (typeof applicant.rent !== "number" || applicant.rent <= 0) {
      result.addError("房租必須是正數", "rent", "INVALID_RENT_VALUE");
    }

    if (typeof applicant.infected !== "boolean") {
      result.addError(
        "感染狀態必須是布林值",
        "infected",
        "INVALID_INFECTION_STATUS"
      );
    }

    return result;
  }

  /**
   * 計算申請者數量（配置驅動）
   */
  calculateApplicantCount() {
    const maxApplicants = this.gameHelpers
      ? this.gameHelpers.getUIConfig("display.maxApplicantsPerVisit", 3)
      : 3;

    const baseCount = Math.floor(Math.random() * 3) + 1;
    return Math.min(baseCount, maxApplicants);
  }

  /**
   * 取得可用租客類型（根據解鎖條件）
   */
  getAvailableTenantTypes() {
    if (!this.tenantConfigs || !Array.isArray(this.tenantConfigs)) {
      return this.getDefaultTenantConfigs();
    }

    return this.tenantConfigs.filter((config) => {
      const unlockConditions = config.unlockConditions;
      if (!unlockConditions) return true;

      // 檢查日期條件
      if (unlockConditions.day && this.gameState.day < unlockConditions.day) {
        return false;
      }

      // 檢查建築防禦條件
      if (
        unlockConditions.buildingDefense &&
        this.gameState.buildingDefense < unlockConditions.buildingDefense
      ) {
        return false;
      }

      // 檢查租客總數條件
      if (unlockConditions.totalTenants) {
        const currentTenants = this.getCurrentTenantCount();
        if (currentTenants < unlockConditions.totalTenants) {
          return false;
        }
      }

      // 檢查特殊事件條件
      if (unlockConditions.events && Array.isArray(unlockConditions.events)) {
        // 這裡可以擴展事件系統整合
        // 暫時允許通過
      }

      return true;
    });
  }

  /**
   * 選擇租客類型（加權隨機）
   */
  selectTenantType(availableTypes) {
    // 根據稀有度進行加權選擇
    const weights = availableTypes.map((config) => {
      switch (config.rarity) {
        case "common":
          return 50;
        case "uncommon":
          return 30;
        case "rare":
          return 15;
        case "epic":
          return 4;
        case "legendary":
          return 1;
        default:
          return 40;
      }
    });

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;

    let currentWeight = 0;
    for (let i = 0; i < availableTypes.length; i++) {
      currentWeight += weights[i];
      if (random <= currentWeight) {
        return availableTypes[i];
      }
    }

    // 後備選擇
    return availableTypes[Math.floor(Math.random() * availableTypes.length)];
  }

  /**
   * 從配置創建申請者（增強驗證版）
   */
  createApplicantFromConfig(config) {
    const infected = this.rollInfectionStatus(config.infectionRisk);

    const applicant = {
      id: this.generateUniqueId(),
      name: this.generateTenantName(),

      // 租客類型資訊
      type: config.typeId,
      typeId: config.typeId,
      typeName: config.typeName,
      category: config.category,

      // 基本屬性
      rent: this.calculateRent(config.rent),
      skill: config.skill,
      description: config.description,
      infected: infected,
      rarity: config.rarity,

      // 個人資源（深拷貝避免引用問題）
      personalResources: this.initializePersonalResources(
        config.personalResources
      ),

      // 特徵與偏好
      traits: [...(config.traits || [])],
      preferences: config.preferences ? { ...config.preferences } : {},

      // 基礎統計
      baseStats: config.baseStats ? { ...config.baseStats } : {},

      // 技能列表
      skillIds: [...(config.skillIds || [])],

      // 外觀描述
      appearance: this.generateAppearance(infected),

      // 創建時間戳
      createdAt: this.gameState.day,
    };

    return applicant;
  }

  /**
   * 判定感染狀態
   */
  rollInfectionStatus(baseRisk) {
    const probabilities = this.gameHelpers
      ? this.gameHelpers.getProbabilities()
      : { baseInfectionRisk: 0.2 };

    const finalRisk = baseRisk || probabilities.baseInfectionRisk;
    return Math.random() < finalRisk;
  }

  /**
   * 計算實際房租（考慮市場波動）
   */
  calculateRent(baseRent) {
    // 基於遊戲天數的小幅波動
    const dayFactor = 1 + this.gameState.day * 0.01; // 每天1%通膨
    const randomFactor = 0.9 + Math.random() * 0.2; // ±10%隨機

    return Math.floor(baseRent * dayFactor * randomFactor);
  }

  /**
   * 初始化個人資源
   */
  initializePersonalResources(template) {
    if (!template) {
      return {
        food: 3,
        materials: 1,
        medical: 1,
        fuel: 0,
        cash: 15,
      };
    }

    // 添加隨機變化（±20%）
    const resources = {};
    Object.keys(template).forEach((key) => {
      const base = template[key];
      const variation = 0.8 + Math.random() * 0.4; // 80% - 120%
      resources[key] = Math.max(0, Math.floor(base * variation));
    });

    return resources;
  }

  /**
   * 生成租客姓名
   */
  generateTenantName() {
    if (this.gameHelpers) {
      return this.gameHelpers.generateName("nickname");
    }

    // 後備姓名生成
    const names = [
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
      "小夫",
      "阿義",
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * 生成外觀描述
   */
  generateAppearance(infected) {
    if (this.gameHelpers) {
      return infected
        ? this.gameHelpers.getInfectedAppearance()
        : this.gameHelpers.getNormalAppearance();
    }

    // 後備外觀描述
    if (infected) {
      const infectedApps = [
        "眼神有點呆滯，反應遲鈍",
        "皮膚蒼白，手有輕微顫抖",
        "有股奇怪的味道，像是腐肉",
      ];
      return infectedApps[Math.floor(Math.random() * infectedApps.length)];
    } else {
      const normalApps = [
        "看起來精神狀態不錯",
        "衣著整潔，談吐得體",
        "眼神清澈，反應靈敏",
      ];
      return normalApps[Math.floor(Math.random() * normalApps.length)];
    }
  }

  /**
   * 雇用租客 - 核心功能（增強驗證版）
   */
  hireTenant(applicantId, roomId = null) {
    console.log(`🤝 嘗試雇用申請者: ${applicantId}`);

    // 尋找申請者
    const applicant = this.applicantPool.find((a) => a.id === applicantId);
    if (!applicant) {
      console.warn("❌ 找不到指定申請者");
      this.emitEvent("tenantHireFailed", {
        reason: "applicant_not_found",
        applicantId,
      });
      return false;
    }

    // 再次驗證申請者（防止資料被外部修改）
    const applicantValidation = this.validateApplicant(applicant);
    if (!applicantValidation.isValid) {
      console.error("❌ 申請者資料已損壞:", applicantValidation.errors);
      this.emitEvent("tenantHireFailed", {
        reason: "applicant_data_corrupted",
        applicant,
        errors: applicantValidation.errors,
      });
      return false;
    }

    // 尋找可用房間
    const targetRoom = this.findAvailableRoom(roomId);
    if (!targetRoom) {
      console.warn("❌ 沒有可用房間");
      this.emitEvent("tenantHireFailed", {
        reason: "no_available_room",
        applicant,
      });
      return false;
    }

    // 創建租客實例
    const tenant = this.createTenantFromApplicant(applicant);

    // 驗證租客實例
    const tenantValidation = this.validateTenant(tenant);
    if (!tenantValidation.isValid) {
      console.error("❌ 租客實例創建失敗:", tenantValidation.errors);
      this.emitEvent("tenantHireFailed", {
        reason: "tenant_creation_failed",
        applicant,
        errors: tenantValidation.errors,
      });
      return false;
    }

    // 分配房間
    targetRoom.tenant = tenant;

    // 初始化租客狀態
    this.initializeTenantState(tenant);

    // 從申請者池移除
    this.applicantPool = this.applicantPool.filter((a) => a.id !== applicantId);

    // 更新驗證統計
    this.validationStats.tenantsValidated++;

    // 觸發事件
    this.emitEvent("tenantHired", {
      tenant,
      room: targetRoom,
      day: this.gameState.day,
    });

    // 記錄日誌
    const logMessage = MESSAGE_TEMPLATES.GAME?.ACTION_SUCCESS
      ? MESSAGE_TEMPLATES.GAME.ACTION_SUCCESS(
          `${tenant.name} 入住房間 ${targetRoom.id}`
        )
      : `新租客 ${tenant.name} 入住房間 ${targetRoom.id}`;

    this.addLog(logMessage, "rent");

    console.log(`✅ 租客 ${tenant.name} 成功入住房間 ${targetRoom.id}`);
    return true;
  }

  /**
   * 驗證租客實例
   */
  validateTenant(tenant) {
    if (!this.tenantValidator) {
      // 後備驗證
      return this.validateTenantFallback(tenant);
    }

    try {
      const result = this.tenantValidator.validateTenant(tenant);
      return result;
    } catch (error) {
      console.error("❌ 租客驗證過程發生錯誤:", error);
      return new ValidationResult(false).addError(
        `租客驗證失敗: ${error.message}`,
        null,
        ERROR_CODES.DATA_VALIDATION_FAILED
      );
    }
  }

  /**
   * 後備租客驗證
   */
  validateTenantFallback(tenant) {
    const result = this.validateApplicantFallback(tenant);

    // 額外檢查租客特有欄位
    if (tenant.moveInDate !== undefined) {
      if (typeof tenant.moveInDate !== "number" || tenant.moveInDate < 1) {
        result.addError(
          "入住日期必須是正整數",
          "moveInDate",
          "INVALID_MOVE_IN_DATE"
        );
      }
    }

    // 檢查個人資源
    if (tenant.personalResources) {
      const resourceResult = this.validatePersonalResourcesFallback(
        tenant.personalResources
      );
      result.merge(resourceResult);
    }

    return result;
  }

  /**
   * 後備個人資源驗證
   */
  validatePersonalResourcesFallback(resources) {
    const result = new ValidationResult(true);

    if (typeof resources !== "object" || resources === null) {
      return result.addError(
        "個人資源必須是物件",
        "personalResources",
        "INVALID_RESOURCE_TYPE"
      );
    }

    const resourceKeys = ["food", "materials", "medical", "fuel", "cash"];

    resourceKeys.forEach((key) => {
      if (resources[key] !== undefined) {
        if (typeof resources[key] !== "number") {
          result.addError(
            `資源 ${key} 必須是數值`,
            `personalResources.${key}`,
            "INVALID_RESOURCE_TYPE"
          );
        } else if (resources[key] < 0) {
          result.addWarning(
            `資源 ${key} 為負值`,
            `personalResources.${key}`,
            "NEGATIVE_RESOURCE_VALUE"
          );
        }
      }
    });

    return result;
  }

  /**
   * 尋找可用房間
   */
  findAvailableRoom(preferredRoomId = null) {
    if (preferredRoomId) {
      const specificRoom = this.gameState.rooms.find(
        (r) => r.id === preferredRoomId && !r.tenant
      );
      if (specificRoom) return specificRoom;
    }

    // 尋找任何可用房間
    return this.gameState.rooms.find((room) => !room.tenant);
  }

  /**
   * 從申請者創建租客
   */
  createTenantFromApplicant(applicant) {
    return {
      ...applicant,
      // 租住相關屬性
      moveInDate: this.gameState.day,
      lastInteraction: this.gameState.day,

      // 技能冷卻狀態
      skillCooldowns: new Map(),
      lastSkillUse: new Map(),
      skillUsageCount: new Map(),

      // 行為狀態
      onMission: false,
      lastMissionDay: 0,

      // 關係狀態
      relationships: new Map(),

      // 健康狀態追蹤
      healthHistory: [],
      lastHealthCheck: 0,
    };
  }

  /**
   * 初始化租客狀態
   */
  initializeTenantState(tenant) {
    const baseValue = this.gameHelpers
      ? this.gameHelpers.getGameBalance(
          "tenants.satisfactionSystem.baseValue",
          50
        )
      : 50;

    const tenantState = {
      id: tenant.id,
      satisfaction: baseValue,
      healthStatus: tenant.infected ? "infected" : "healthy",
      lastInteraction: this.gameState.day,
      skillCooldowns: new Map(),
      personalHistory: [],
      relationships: new Map(),

      // 行為追蹤
      dailyActivities: [],
      moodModifiers: [],

      // 統計資料
      stats: {
        daysLived: 0,
        rentPaid: 0,
        skillsUsed: 0,
        satisfactionHistory: [baseValue],
      },
    };

    this.tenantStates.set(tenant.name, tenantState);

    // 初始化遊戲狀態中的滿意度記錄
    if (!this.gameState.tenantSatisfaction) {
      this.gameState.tenantSatisfaction = {};
    }
    this.gameState.tenantSatisfaction[tenant.name] = baseValue;

    console.log(`📊 租客 ${tenant.name} 狀態初始化完成`);
  }

  /**
   * 解僱租客 - 核心功能
   */
  evictTenant(tenantName, reason = "evicted") {
    console.log(`🚪 解僱租客: ${tenantName}, 原因: ${reason}`);

    const room = this.gameState.rooms.find(
      (r) => r.tenant && r.tenant.name === tenantName
    );

    if (!room) {
      console.warn(`❌ 找不到租客: ${tenantName}`);
      return false;
    }

    const tenant = room.tenant;

    // 驗證租客狀態（確保資料一致性）
    const tenantValidation = this.validateTenant(tenant);
    if (!tenantValidation.isValid) {
      console.warn(
        `⚠️ 租客 ${tenantName} 狀態異常，強制處理`,
        tenantValidation.warnings
      );
    }

    // 處理離開後果
    this.handleTenantDeparture(tenant, reason, room);

    // 清理房間
    room.tenant = null;

    // 清理狀態記錄
    this.tenantStates.delete(tenantName);
    if (this.gameState.tenantSatisfaction) {
      delete this.gameState.tenantSatisfaction[tenantName];
    }

    // 觸發事件
    this.emitEvent("tenantEvicted", {
      tenant,
      reason,
      room,
      day: this.gameState.day,
    });

    // 記錄日誌
    const reasonText = this.getEvictionReasonText(reason);
    this.addLog(
      `租客 ${tenantName} 離開了房間 ${room.id} (${reasonText})`,
      reason === "infected" ? "danger" : "event"
    );

    console.log(`✅ 租客 ${tenantName} 已離開`);
    return true;
  }

  /**
   * 處理租客離開的後果
   */
  handleTenantDeparture(tenant, reason, room) {
    const economicParams = this.gameHelpers
      ? this.gameHelpers.getEconomicParameters()
      : { evictionCompensationRate: 0.5 };

    switch (reason) {
      case "infected":
        // 感染離開需要消毒
        if (this.gameState.resources.medical >= 2) {
          this.gameState.resources.medical -= 2;
          this.addLog("消毒感染房間花費了 2 醫療用品", "danger");
        } else {
          // 沒有醫療用品，房間需要維修
          room.needsRepair = true;
          this.addLog("缺乏醫療用品，房間存在感染風險", "danger");
        }
        break;

      case "dissatisfied":
        // 不滿離開可能要求賠償
        if (Math.random() < 0.3) {
          const compensation = Math.floor(
            tenant.rent * economicParams.evictionCompensationRate
          );
          this.gameState.resources.cash = Math.max(
            0,
            this.gameState.resources.cash - compensation
          );
          this.addLog(
            `支付了 ${tenant.name} 的補償金 $${compensation}`,
            "event"
          );
        }
        break;

      case "evicted":
        // 強制驅逐可能產生聲譽影響
        if (Math.random() < 0.2) {
          this.addLog("強制驅逐影響了房東聲譽", "danger");
          // 可以在這裡添加聲譽系統的邏輯
        }
        break;

      case "resource_shortage":
        // 資源不足離開不需要特殊處理
        break;
    }
  }

  /**
   * 每日租客狀態更新 - 核心功能（增強驗證版）
   */
  updateDailyTenantStates() {
    console.log("🔄 更新租客日常狀態...");

    // 先驗證遊戲狀態
    if (this.gameStateValidator) {
      const stateValidation = this.gameStateValidator.validateGameState(
        this.gameState
      );
      if (!stateValidation.isValid) {
        console.error("❌ 遊戲狀態異常，嘗試修復後繼續");
        this.attemptGameStateRepair(stateValidation);
      }
    }

    const occupiedRooms = this.gameState.rooms.filter((room) => room.tenant);
    let updatedCount = 0;
    let validationErrors = 0;

    occupiedRooms.forEach((room) => {
      const tenant = room.tenant;
      const tenantState = this.tenantStates.get(tenant.name);

      if (!tenantState) {
        console.warn(`⚠️ 找不到租客狀態: ${tenant.name}`);
        return;
      }

      try {
        // 驗證租客實例
        const tenantValidation = this.validateTenant(tenant);
        if (!tenantValidation.isValid) {
          console.warn(
            `⚠️ 租客 ${tenant.name} 資料異常:`,
            tenantValidation.getFirstError()?.message
          );
          validationErrors++;

          // 嘗試修復關鍵問題
          this.attemptTenantRepair(tenant, tenantValidation);
        }

        // 更新滿意度
        this.updateTenantSatisfaction(tenant, room, tenantState);

        // 處理個人資源消費
        this.processTenantResourceConsumption(tenant, tenantState);

        // 更新健康狀態
        this.updateTenantHealth(tenant, tenantState);

        // 檢查離開條件
        this.checkTenantDepartureConditions(tenant, tenantState);

        // 更新技能冷卻
        this.updateSkillCooldowns(tenant, tenantState);

        // 更新統計資料
        this.updateTenantStats(tenant, tenantState);

        updatedCount++;
      } catch (error) {
        console.error(`❌ 更新租客 ${tenant.name} 狀態失敗:`, error);
        validationErrors++;
      }
    });

    // 處理租客互動
    if (occupiedRooms.length >= 2) {
      this.processTenantInteractions(occupiedRooms);
    }

    // 更新驗證統計
    if (validationErrors > 0) {
      this.validationStats.validationErrors += validationErrors;
    }

    console.log(`✅ 已更新 ${updatedCount} 位租客的狀態`);
    if (validationErrors > 0) {
      console.warn(`⚠️ 發現 ${validationErrors} 個驗證問題`);
    }
  }

  /**
   * 嘗試修復租客資料問題
   */
  attemptTenantRepair(tenant, validationResult) {
    let repairCount = 0;

    validationResult.errors.forEach((error) => {
      switch (error.code) {
        case "INVALID_MOVE_IN_DATE":
          if (!tenant.moveInDate || tenant.moveInDate < 1) {
            tenant.moveInDate = this.gameState.day;
            repairCount++;
            console.log(`🔧 修復租客 ${tenant.name} 的入住日期`);
          }
          break;

        case "INVALID_RESOURCE_TYPE":
          if (
            !tenant.personalResources ||
            typeof tenant.personalResources !== "object"
          ) {
            tenant.personalResources = this.getDefaultPersonalResources();
            repairCount++;
            console.log(`🔧 修復租客 ${tenant.name} 的個人資源`);
          }
          break;

        case "NEGATIVE_RESOURCE_VALUE":
          if (error.field && error.field.startsWith("personalResources.")) {
            const resourceType = error.field.split(".")[1];
            if (tenant.personalResources[resourceType] < 0) {
              tenant.personalResources[resourceType] = 0;
              repairCount++;
              console.log(`🔧 修復租客 ${tenant.name} 的 ${resourceType} 資源`);
            }
          }
          break;
      }
    });

    if (repairCount > 0) {
      console.log(
        `🔧 完成租客 ${tenant.name} 資料修復，共修復 ${repairCount} 個問題`
      );
    }
  }

  /**
   * 更新租客滿意度
   */
  updateTenantSatisfaction(tenant, room, tenantState) {
    const factors = this.gameHelpers
      ? this.gameHelpers.getGameBalance(
          "tenants.satisfactionSystem.factors",
          {}
        )
      : {};

    let satisfaction = tenantState.satisfaction;

    // 房間條件影響
    if (room.reinforced) satisfaction += factors.reinforcedRoom || 3;
    if (room.needsRepair) satisfaction += factors.needsRepair || -8;

    // 個人資源狀況
    if (tenant.personalResources) {
      if (tenant.personalResources.food < 2) {
        satisfaction += factors.lowPersonalFood || -10;
      }
      if (tenant.personalResources.cash > 25) {
        satisfaction += factors.highPersonalCash || 5;
      }
    }

    // 建築安全
    if (this.gameState.buildingDefense >= 8) {
      satisfaction += factors.highBuildingDefense || 4;
    }
    if (this.gameState.buildingDefense <= 2) {
      satisfaction += factors.lowBuildingDefense || -6;
    }

    // 全局效果影響
    if (this.gameState.emergencyTraining) {
      satisfaction += factors.emergencyTraining || 2;
    }
    if (this.gameState.patrolSystem) {
      satisfaction += factors.patrolSystem || 4;
    }
    if (this.gameState.socialNetwork) {
      satisfaction += factors.socialNetwork || 3;
    }

    // 老人和諧氛圍加成
    const elderCount = this.getTenantCountByType("elder");
    satisfaction += elderCount * (factors.elderHarmonyBonus || 2);

    // 限制範圍
    const range = this.gameHelpers
      ? this.gameHelpers.getGameBalance("tenants.satisfactionSystem.range", {
          min: 0,
          max: 100,
        })
      : { min: 0, max: 100 };

    satisfaction = Math.max(range.min, Math.min(range.max, satisfaction));

    // 更新狀態
    tenantState.satisfaction = satisfaction;
    tenantState.stats.satisfactionHistory.push(satisfaction);

    // 保持最近10天記錄
    if (tenantState.stats.satisfactionHistory.length > 10) {
      tenantState.stats.satisfactionHistory.shift();
    }

    this.gameState.tenantSatisfaction[tenant.name] = satisfaction;
  }

  /**
   * 處理租客資源消費
   */
  processTenantResourceConsumption(tenant, tenantState) {
    if (!tenant.personalResources) return;

    const consumption = this.gameHelpers
      ? this.gameHelpers.getConsumption()
      : { tenantDailyFood: 2, elderMedicalConsumption: 1 };

    // 食物消費
    const foodNeeded = consumption.tenantDailyFood || 2;
    if (tenant.personalResources.food >= foodNeeded) {
      tenant.personalResources.food -= foodNeeded;
    } else {
      // 食物不足影響滿意度和健康
      tenantState.satisfaction -= 5;
      this.addLog(`${tenant.name} 缺乏食物`, "danger");
    }

    // 老人特殊醫療消費
    if (tenant.type === "elder" || tenant.typeId === "elder") {
      const medicalNeeded = consumption.elderMedicalConsumption || 1;
      if (tenant.personalResources.medical >= medicalNeeded) {
        tenant.personalResources.medical -= medicalNeeded;
      } else {
        tenantState.satisfaction -= 3;
      }
    }
  }

  /**
   * 更新租客健康狀態
   */
  updateTenantHealth(tenant, tenantState) {
    // 感染惡化檢查
    if (tenant.infected && Math.random() < 0.1) {
      this.addLog(`${tenant.name} 的感染狀況惡化`, "danger");
      tenantState.satisfaction -= 10;
    }

    // 健康恢復機制
    if (
      !tenant.infected &&
      tenantState.satisfaction > 70 &&
      Math.random() < 0.05
    ) {
      tenantState.satisfaction += 2;
    }
  }

  /**
   * 檢查租客離開條件
   */
  checkTenantDepartureConditions(tenant, tenantState) {
    // 滿意度過低
    if (tenantState.satisfaction < 20 && Math.random() < 0.3) {
      this.evictTenant(tenant.name, "dissatisfied");
      return;
    }

    // 資源不足導致離開
    if (
      tenant.personalResources &&
      tenant.personalResources.food <= 0 &&
      tenant.personalResources.cash <= 0 &&
      Math.random() < 0.4
    ) {
      this.evictTenant(tenant.name, "resource_shortage");
      return;
    }

    // 感染惡化離開
    if (
      tenant.infected &&
      tenantState.satisfaction < 10 &&
      Math.random() < 0.2
    ) {
      this.evictTenant(tenant.name, "infected");
      return;
    }
  }

  /**
   * 更新技能冷卻
   */
  updateSkillCooldowns(tenant, tenantState) {
    // 這裡預留給後續技能系統整合
    // 暫時空實作
  }

  /**
   * 更新租客統計資料
   */
  updateTenantStats(tenant, tenantState) {
    tenantState.stats.daysLived++;
    tenantState.lastInteraction = this.gameState.day;
  }

  /**
   * 處理租客間互動
   */
  processTenantInteractions(occupiedRooms) {
    // 互助機制
    if (Math.random() < 0.3) {
      this.processMutualAid(occupiedRooms);
    }

    // 衝突機制（簡化版，預留給EventSystem）
    const conflictChance = this.calculateConflictChance(occupiedRooms);
    if (Math.random() < conflictChance) {
      this.emitEvent("tenantConflict", {
        tenants: occupiedRooms.map((r) => r.tenant),
        day: this.gameState.day,
      });
    }
  }

  /**
   * 處理租客互助
   */
  processMutualAid(occupiedRooms) {
    const tenants = occupiedRooms.map((room) => room.tenant);

    // 找到需要幫助的租客
    const needyTenant = tenants.find(
      (t) =>
        t.personalResources &&
        (t.personalResources.food <= 1 ||
          t.personalResources.cash <= 5 ||
          (t.typeId === "elder" && t.personalResources.medical <= 1))
    );

    // 找到能提供幫助的租客
    const helpfulTenant = tenants.find(
      (t) =>
        t !== needyTenant &&
        t.personalResources &&
        (t.personalResources.food >= 5 ||
          t.personalResources.cash >= 15 ||
          t.personalResources.medical >= 3)
    );

    if (needyTenant && helpfulTenant) {
      this.executeMutualAid(needyTenant, helpfulTenant);
    }
  }

  /**
   * 執行互助行為
   */
  executeMutualAid(needyTenant, helpfulTenant) {
    let aidType = "";

    if (
      needyTenant.personalResources.food <= 1 &&
      helpfulTenant.personalResources.food >= 3
    ) {
      helpfulTenant.personalResources.food -= 2;
      needyTenant.personalResources.food += 2;
      aidType = "食物";
    } else if (
      needyTenant.personalResources.cash <= 5 &&
      helpfulTenant.personalResources.cash >= 12
    ) {
      const loanAmount = 5;
      helpfulTenant.personalResources.cash -= loanAmount;
      needyTenant.personalResources.cash += loanAmount;
      aidType = "現金";
    } else if (
      needyTenant.typeId === "elder" &&
      needyTenant.personalResources.medical <= 1 &&
      helpfulTenant.personalResources.medical >= 2
    ) {
      helpfulTenant.personalResources.medical -= 1;
      needyTenant.personalResources.medical += 1;
      aidType = "醫療用品";
    }

    if (aidType) {
      this.addLog(
        `${helpfulTenant.name} 分享了${aidType}給 ${needyTenant.name}`,
        "event"
      );

      // 提升雙方滿意度
      const helpfulState = this.tenantStates.get(helpfulTenant.name);
      const needyState = this.tenantStates.get(needyTenant.name);

      if (helpfulState) helpfulState.satisfaction += 3;
      if (needyState) needyState.satisfaction += 5;
    }
  }

  /**
   * 計算衝突機率
   */
  calculateConflictChance(occupiedRooms) {
    const tenantCount = occupiedRooms.length;
    if (tenantCount < 2) return 0;

    const modifiers = this.gameHelpers
      ? this.gameHelpers.getGameBalance(
          "mechanics.events.conflictModifiers",
          {}
        )
      : {};

    let baseChance = modifiers.baseChance || 0.25;

    // 計算平均滿意度
    const avgSatisfaction =
      occupiedRooms.reduce((sum, room) => {
        const state = this.tenantStates.get(room.tenant.name);
        return sum + (state ? state.satisfaction : 50);
      }, 0) / tenantCount;

    baseChance -=
      (avgSatisfaction - 50) * (modifiers.satisfactionPenalty || 0.003);
    baseChance += (tenantCount - 2) * (modifiers.tenantCountMultiplier || 0.08);

    // 資源短缺增加衝突
    if (this.gameState.resources.food < tenantCount * 3) {
      baseChance += modifiers.resourceScarcityBonus || 0.1;
    }

    // 老人減少衝突
    const elderCount = this.getTenantCountByType("elder");
    baseChance -= elderCount * (modifiers.elderReduction || 0.12);

    return Math.max(0.02, Math.min(0.6, baseChance));
  }

  /**
   * 工具函數
   */

  generateUniqueId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const counter = ++this.idCounter;
    return `tenant_${timestamp}_${random}_${counter}`;
  }

  getCurrentTenantCount() {
    return this.gameState.rooms.filter((room) => room.tenant).length;
  }

  getTenantCountByType(type) {
    return this.gameState.rooms.filter(
      (room) =>
        room.tenant &&
        (room.tenant.type === type || room.tenant.typeId === type) &&
        !room.tenant.infected
    ).length;
  }

  getTenantsByType(type) {
    return this.gameState.rooms
      .filter(
        (room) =>
          room.tenant &&
          (room.tenant.type === type || room.tenant.typeId === type) &&
          !room.tenant.infected
      )
      .map((room) => room.tenant);
  }

  getTenantSatisfaction(tenantName) {
    const state = this.tenantStates.get(tenantName);
    return state ? state.satisfaction : 0;
  }

  getTenantState(tenantName) {
    return this.tenantStates.get(tenantName);
  }

  getEvictionReasonText(reason) {
    const reasons = {
      evicted: "房東驅逐",
      dissatisfied: "不滿離開",
      infected: "感染離開",
      resource_shortage: "資源不足",
      health_crisis: "健康危機",
    };
    return reasons[reason] || reason;
  }

  /**
   * 預設資料方法
   */

  getDefaultResources() {
    return {
      food: 20,
      materials: 15,
      medical: 10,
      fuel: 8,
      cash: 50,
    };
  }

  getDefaultRooms() {
    return [
      { id: 1, tenant: null, needsRepair: false, reinforced: false },
      { id: 2, tenant: null, needsRepair: false, reinforced: false },
    ];
  }

  getDefaultPersonalResources() {
    return {
      food: 3,
      materials: 1,
      medical: 1,
      fuel: 0,
      cash: 15,
    };
  }

  /**
   * 後備功能實作
   */

  getDefaultTenantConfigs() {
    return [
      {
        typeId: "doctor",
        typeName: "醫生",
        category: "doctor",
        rent: 15,
        skill: "醫療",
        infectionRisk: 0.1,
        rarity: "uncommon",
        description: "可以治療感染，檢測可疑租客",
        personalResources: {
          food: 3,
          materials: 0,
          medical: 5,
          fuel: 0,
          cash: 20,
        },
      },
      {
        typeId: "worker",
        typeName: "工人",
        category: "worker",
        rent: 12,
        skill: "維修",
        infectionRisk: 0.2,
        rarity: "common",
        description: "擅長維修建築，房間升級",
        personalResources: {
          food: 4,
          materials: 8,
          medical: 0,
          fuel: 0,
          cash: 15,
        },
      },
      {
        typeId: "farmer",
        typeName: "農夫",
        category: "farmer",
        rent: 10,
        skill: "種植",
        infectionRisk: 0.15,
        rarity: "common",
        description: "提升院子採集效率，種植作物",
        personalResources: {
          food: 8,
          materials: 2,
          medical: 0,
          fuel: 0,
          cash: 12,
        },
      },
    ];
  }

  generateFallbackApplicants(count) {
    const finalCount = count || Math.floor(Math.random() * 3) + 1;
    const configs = this.getDefaultTenantConfigs();
    const applicants = [];

    for (let i = 0; i < finalCount; i++) {
      const config = configs[Math.floor(Math.random() * configs.length)];
      applicants.push(this.createFallbackApplicant(config));
    }

    return applicants;
  }

  createFallbackApplicant(config = null) {
    if (!config) {
      config = {
        typeId: "worker",
        typeName: "工人",
        rent: 12,
        skill: "維修",
        infectionRisk: 0.2,
        description: "一般的倖存者",
        personalResources: {
          food: 4,
          materials: 2,
          medical: 1,
          fuel: 0,
          cash: 15,
        },
      };
    }

    return {
      id: this.generateUniqueId(),
      name: this.generateTenantName(),
      type: config.typeId,
      typeId: config.typeId,
      typeName: config.typeName,
      rent: config.rent,
      skill: config.skill,
      description: config.description,
      infected: Math.random() < (config.infectionRisk || 0.2),
      personalResources: { ...config.personalResources },
      appearance: this.generateAppearance(Math.random() < 0.2),
      createdAt: this.gameState.day,
    };
  }

  /**
   * 事件系統介面
   */

  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
  }

  emitEvent(eventName, data) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ 事件處理器錯誤 (${eventName}):`, error);
        }
      });
    }
  }

  addLog(message, type = "event") {
    if (typeof window !== "undefined" && typeof window.addLog === "function") {
      window.addLog(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * 系統狀態與診斷（增強版）
   */

  getStatus() {
    return {
      initialized: this.initialized,
      configLoaded: this.configLoaded,
      tenantCount: this.getCurrentTenantCount(),
      applicantCount: this.applicantPool.length,
      stateRecords: this.tenantStates.size,
      lastGeneration: this.lastApplicantGeneration,
      systemHealth: this.validateSystemHealth(),
      validationStats: { ...this.validationStats },
      validators: {
        tenantValidator: !!this.tenantValidator,
        gameStateValidator: !!this.gameStateValidator,
      },
    };
  }

  validateSystemHealth() {
    const issues = [];

    // 檢查狀態一致性
    const gameStateTenants = this.gameState.rooms.filter(
      (r) => r.tenant
    ).length;
    const stateRecords = this.tenantStates.size;

    if (gameStateTenants !== stateRecords) {
      issues.push(
        `狀態記錄不一致: 遊戲中${gameStateTenants}位租客，狀態記錄${stateRecords}筆`
      );
    }

    // 檢查配置完整性
    if (!this.configLoaded) {
      issues.push("配置未正確載入");
    }

    // 檢查驗證器可用性
    if (!this.tenantValidator) {
      issues.push("TenantValidator 不可用");
    }

    if (!this.gameStateValidator) {
      issues.push("GameStateValidator 不可用");
    }

    // 檢查驗證錯誤率
    const totalValidations =
      this.validationStats.applicantsValidated +
      this.validationStats.tenantsValidated;
    if (totalValidations > 0) {
      const errorRate =
        this.validationStats.validationErrors / totalValidations;
      if (errorRate > 0.1) {
        // 10%以上錯誤率
        issues.push(`驗證錯誤率過高: ${(errorRate * 100).toFixed(1)}%`);
      }
    }

    return {
      healthy: issues.length === 0,
      issues: issues,
      stats: {
        errorRate:
          totalValidations > 0
            ? this.validationStats.validationErrors / totalValidations
            : 0,
        totalValidations: totalValidations,
      },
    };
  }

  /**
   * 獲取詳細的驗證報告
   */
  getValidationReport() {
    return {
      summary: this.validationStats,
      validators: {
        tenantValidator: {
          available: !!this.tenantValidator,
          type: this.tenantValidator?.constructor.name || null,
        },
        gameStateValidator: {
          available: !!this.gameStateValidator,
          type: this.gameStateValidator?.constructor.name || null,
        },
      },
      recentIssues: this.getRecentValidationIssues(),
    };
  }

  /**
   * 獲取最近的驗證問題
   */
  getRecentValidationIssues() {
    // 這裡可以擴展來追蹤最近的驗證問題
    // 暫時返回空陣列
    return [];
  }

  /**
   * 執行完整的系統驗證
   */
  async performFullSystemValidation() {
    console.log("🔍 執行完整的 TenantSystem 驗證...");

    const report = {
      gameState: null,
      tenants: [],
      applicants: [],
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        warnings: 0,
      },
    };

    // 驗證遊戲狀態
    if (this.gameStateValidator) {
      report.gameState = this.gameStateValidator.validateGameState(
        this.gameState
      );
      if (!report.gameState.isValid) {
        report.summary.criticalIssues += report.gameState.errors.length;
      }
      report.summary.warnings += report.gameState.warnings.length;
    }

    // 驗證所有租客
    this.gameState.rooms.forEach((room, index) => {
      if (room.tenant) {
        const validation = this.validateTenant(room.tenant);
        report.tenants.push({
          roomId: room.id,
          tenantName: room.tenant.name,
          validation: validation,
        });

        if (!validation.isValid) {
          report.summary.criticalIssues += validation.errors.length;
        }
        report.summary.warnings += validation.warnings.length;
      }
    });

    // 驗證申請者
    this.applicantPool.forEach((applicant, index) => {
      const validation = this.validateApplicant(applicant);
      report.applicants.push({
        applicantId: applicant.id,
        applicantName: applicant.name,
        validation: validation,
      });

      if (!validation.isValid) {
        report.summary.criticalIssues += validation.errors.length;
      }
      report.summary.warnings += validation.warnings.length;
    });

    report.summary.totalIssues =
      report.summary.criticalIssues + report.summary.warnings;

    console.log("✅ TenantSystem 完整驗證完成:", report.summary);
    return report;
  }
}

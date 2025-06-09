// @ts-check

/**
 * @fileoverview SkillManager.js - 技能執行與管理系統
 * 職責：技能執行與效果處理、冷卻時間與使用次數管理、成本計算與工資支付、被動技能的事件驅動觸發
 */

import BaseManager from "./BaseManager.js";
import { getValidator } from "../utils/validators.js";
import { SYSTEM_LIMITS } from "../utils/constants.js";

/**
 * @see {@link ../Type.js} 完整類型定義
 * @typedef {import('../Type.js').TenantType} TenantType
 * @typedef {import('../Type.js').ResourceType} ResourceType
 * @typedef {import('../Type.js').Tenant} Tenant
 * @typedef {import('../Type.js').Room} Room
 */

/**
 * 技能類型聯合型別
 * @typedef {'active'|'passive'|'special'} SkillType
 */

/**
 * 效果類型聯合型別
 * @typedef {'modifyResource'|'modifyState'|'healTenant'|'repairRoom'|'logMessage'|'triggerEvent'|'scheduledEffect'|'reinforceRoom'|'autoRepair'|'removeTenant'|'improveTenantSatisfaction'|'detectEarlyInfection'|'revealInfection'} EffectType
 */

/**
 * 條件類型聯合型別
 * @typedef {'hasTenantType'|'hasResource'|'gameStateCheck'|'trigger'|'probability'} ConditionType
 */

/**
 * 驗證失敗原因聯合型別
 * @typedef {'tenant_not_found'|'tenant_infected'|'skill_not_found'|'insufficient_resources'|'on_cooldown'|'requirements_not_met'|'execution_error'} ValidationFailureReason
 */

/**
 * 技能條件配置
 * @typedef {Object} SkillCondition
 * @property {ConditionType} type - 條件類型
 * @property {string} [value] - 條件值
 * @property {number} [count] - 數量要求
 * @property {string} [resource] - 資源類型
 * @property {number} [amount] - 數量
 * @property {string} [path] - 狀態路徑
 * @property {string} [operator] - 操作符
 * @property {number} [chance] - 機率值
 */

/**
 * 技能需求配置
 * @typedef {Object} SkillRequirements
 * @property {SkillCondition[]} conditions - 條件列表
 */

/**
 * 技能效果配置
 * @typedef {Object} SkillEffect
 * @property {EffectType} type - 效果類型
 * @property {ResourceType} [resource] - 資源類型
 * @property {number} [amount] - 數量
 * @property {string} [path] - 狀態路徑
 * @property {any} [value] - 設定值
 * @property {'set'|'add'} [operation] - 操作類型
 * @property {string} [message] - 訊息內容
 * @property {'event'|'rent'|'danger'|'skill'} [logType] - 日誌類型
 * @property {string} [eventId] - 事件ID
 * @property {number} [delay] - 延遲天數
 * @property {SkillEffect} [effect] - 巢狀效果
 * @property {string} [target] - 目標對象
 * @property {string[]} [targets] - 目標列表
 * @property {number} [probability] - 機率值
 */

/**
 * 技能成本配置
 * @typedef {Object} SkillCost
 * @property {number} [food] - 食物成本
 * @property {number} [materials] - 建材成本
 * @property {number} [medical] - 醫療用品成本
 * @property {number} [fuel] - 燃料成本
 * @property {number} [cash] - 現金成本
 */

/**
 * 技能配置物件
 * @typedef {Object} SkillConfig
 * @property {string} id - 技能ID
 * @property {string} name - 技能名稱
 * @property {SkillType} type - 技能類型
 * @property {string} description - 技能描述
 * @property {SkillCost} [cost] - 技能成本
 * @property {SkillEffect[]} [effects] - 技能效果
 * @property {number} [cooldown] - 冷卻天數
 * @property {number} [maxUses] - 最大使用次數
 * @property {SkillRequirements} [requirements] - 使用需求
 */

/**
 * 技能執行上下文
 * @typedef {Object} SkillExecutionContext
 * @property {Tenant} tenant - 執行技能的租客
 * @property {SkillConfig} skill - 技能配置
 * @property {Object} gameState - 遊戲狀態物件
 * @property {Object} options - 執行選項
 * @property {string} [trigger] - 觸發條件
 * @property {boolean} [passive] - 是否為被動技能
 * @property {number} timestamp - 時間戳記
 * @property {string} executionId - 執行ID
 */

/**
 * 驗證結果
 * @typedef {Object} SkillValidationResult
 * @property {boolean} valid - 是否通過驗證
 * @property {ValidationFailureReason} [reason] - 失敗原因
 * @property {string} [message] - 錯誤訊息
 */

/**
 * 技能執行結果
 * @typedef {Object} SkillExecutionResult
 * @property {boolean} success - 是否執行成功
 * @property {string} [skillId] - 技能ID
 * @property {Object[]} [effects] - 執行的效果列表
 * @property {Object} [cost] - 支付的成本
 * @property {boolean} [passive] - 是否為被動技能
 * @property {ValidationFailureReason} [reason] - 失敗原因
 * @property {string} [message] - 結果訊息
 * @property {Object} [result] - 詳細結果
 */

/**
 * 技能統計資料
 * @typedef {Object} SkillStats
 * @property {number} totalSkillsExecuted - 總執行次數
 * @property {number} successfulExecutions - 成功執行次數
 * @property {number} failedExecutions - 失敗執行次數
 * @property {number} passiveTriggered - 被動技能觸發次數
 * @property {string} [successRate] - 成功率字串
 */

/**
 * 技能系統狀態
 * @typedef {Object} SkillManagerStatus
 * @property {boolean} skillsLoaded - 技能是否載入
 * @property {boolean} executorsReady - 執行器是否就緒
 * @property {boolean} effectHandlersReady - 效果處理器是否就緒
 * @property {boolean} validationReady - 驗證器是否就緒
 */

/**
 * 執行歷史記錄
 * @typedef {Object} ExecutionHistory
 * @property {string} executionId - 執行ID
 * @property {number} tenantId - 租客ID
 * @property {string} skillId - 技能ID
 * @property {number} timestamp - 時間戳記
 * @property {number} day - 遊戲天數
 * @property {boolean} success - 是否成功
 * @property {Object[]} effects - 效果列表
 */

/**
 * 成本支付結果
 * @typedef {Object} CostPaymentResult
 * @property {Object} paid - 已支付的資源
 * @property {number} totalPayment - 總支付金額
 */

/**
 * 效果處理結果
 * @typedef {Object} EffectResult
 * @property {string} type - 效果類型
 * @property {string} [message] - 結果訊息
 * @property {any} [data] - 相關資料
 * @property {string} [error] - 錯誤訊息
 * @property {ResourceType} [resource] - 資源類型
 * @property {number} [amount] - 數量
 * @property {any} [oldValue] - 舊值
 * @property {any} [newValue] - 新值
 * @property {string} [path] - 狀態路徑
 * @property {string} [patient] - 患者姓名
 * @property {string} [healer] - 治療者姓名
 * @property {string} [roomId] - 房間ID
 * @property {string} [repairer] - 維修者姓名
 * @property {string} [worker] - 工人姓名
 * @property {'event'|'rent'|'danger'|'skill'} [logType] - 日誌類型
 * @property {string} [eventId] - 事件ID
 * @property {number} [delay] - 延遲天數
 * @property {number} [executeDay] - 執行天數
 * @property {string} [target] - 目標對象
 * @property {string} [reason] - 原因
 * @property {string} [source] - 來源
 * @property {string[]} [targets] - 目標列表
 * @property {number} [probability] - 機率值
 * @property {string} [detector] - 檢測者姓名
 * @property {string} [revealer] - 揭露者姓名
 * @property {SkillEffect} [effect] - 技能效果
 */

/**
 * 技能執行與管理系統
 * @class
 * @extends {BaseManager}
 */
export class SkillManager extends BaseManager {
  /**
   * 建立 SkillManager 實例
   * @param {Object} gameState - 遊戲狀態管理器
   * @param {Object} eventBus - 事件總線
   * @param {Object} dataManager - 資料管理器實例
   */
  constructor(gameState, eventBus, dataManager) {
    super(gameState, eventBus, "SkillManager");

    /** @type {Object} 資料管理器實例 */
    this.dataManager = dataManager;

    /** @type {Map<string, BaseSkillExecutor>} 技能執行器映射表 (skillId -> SkillExecutor) */
    this.skillExecutors = new Map();

    /** @type {Map<TenantType, SkillConfig[]>} 技能註冊表 (tenantType -> skills) */
    this.skillRegistry = new Map();

    /** @type {CooldownManager} 冷卻管理器 */
    this.cooldownManager = new CooldownManager();

    /** @type {CostCalculator} 成本計算器 */
    this.costCalculator = new CostCalculator();

    /** @type {Map<EffectType, EffectHandler>} 效果處理器映射表 (effectType -> EffectHandler) */
    this.effectHandlers = new Map();

    /** @type {ExecutionHistory[]} 技能執行歷史記錄 */
    this.executionHistory = [];

    /** @type {SkillValidator[]} 驗證器鏈 */
    this.validationChain = [];

    /** @type {Object|null} 驗證器實例 */
    this.validator = getValidator({ enabled: true });

    /** @type {SkillManagerStatus} 技能系統專屬狀態 */
    this.skillManagerStatus = {
      skillsLoaded: false,
      executorsReady: false,
      effectHandlersReady: false,
      validationReady: false,
    };

    /** @type {SkillStats} 技能執行統計資訊 */
    this.stats = {
      totalSkillsExecuted: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      passiveTriggered: 0,
    };
  }

  /**
   * 取得模組事件前綴
   * @returns {string} 事件前綴
   */
  getModulePrefix() {
    return "skill";
  }

  /**
   * 設置事件監聽器
   * @returns {void}
   */
  setupEventListeners() {
    this.onEvent("game_state_changed", (eventObj) => {
      if (eventObj.data && eventObj.data.trigger) {
        this.processPassiveSkills(eventObj.data.trigger, eventObj.data.context);
      }
    });

    this.onEvent(
      "day_advanced",
      () => {
        this.processPassiveSkills("daily_cycle");
        const currentDay = this.gameState.getStateValue("day", 1);
        this.cooldownManager.advanceDay(currentDay);
      },
      { skipPrefix: true }
    );

    this.onEvent(
      "harvest_completed",
      (eventObj) => {
        this.processPassiveSkills("harvestYard", eventObj.data);
      },
      { skipPrefix: true }
    );

    this.onEvent(
      "scavenge_started",
      (eventObj) => {
        this.processPassiveSkills("scavengeStarted", eventObj.data);
      },
      { skipPrefix: true }
    );

    this.onEvent("tenant_tenantHired", (eventObj) => {
      this.processPassiveSkills("tenantHired", eventObj.data);
    });

    this.onEvent("tenant_tenantRemoved", (eventObj) => {
      this.processPassiveSkills("tenantRemoved", eventObj.data);
    });
  }

  /**
   * 取得擴展狀態資訊
   * @protected
   * @returns {Object} 擴展狀態物件
   */
  getExtendedStatus() {
    return {
      ...this.skillManagerStatus,
      skillRegistrySize: this.skillRegistry.size,
      skillExecutorsSize: this.skillExecutors.size,
      effectHandlersSize: this.effectHandlers.size,
      stats: { ...this.stats },
      executionHistorySize: this.executionHistory.length,
      validatorStatus: this.validator ? this.validator.getStats() : null,
    };
  }

  /**
   * 初始化技能系統
   * @returns {Promise<boolean>} 初始化是否成功
   * @throws {Error} 當技能配置載入失敗時
   */
  async initialize() {
    this.logSuccess("開始初始化 SkillManager...");

    try {
      await this.loadSkillConfigurations();
      this.skillManagerStatus.skillsLoaded = true;

      this.registerBuiltinEffectHandlers();
      this.skillManagerStatus.effectHandlersReady = true;

      this.buildValidationChain();
      this.skillManagerStatus.validationReady = true;

      this.createSkillExecutors();
      this.skillManagerStatus.executorsReady = true;

      this.markInitialized(true);

      this.logSuccess(
        `SkillManager 初始化完成，載入了 ${this.skillExecutors.size} 個技能執行器`
      );

      return true;
    } catch (error) {
      this.logError("SkillManager 初始化失敗", error);
      this.markInitialized(false);
      this.initializeFallbackSystem();
      return false;
    }
  }

  /**
   * 載入技能配置
   * @returns {Promise<void>}
   * @throws {Error} 當技能配置不可用時
   */
  async loadSkillConfigurations() {
    this.logSuccess("載入技能配置資料...");

    const skillConfigs = this.dataManager.getAllSkills();
    if (!skillConfigs) {
      throw new Error("技能配置不可用");
    }

    Object.entries(skillConfigs).forEach(([tenantType, skills]) => {
      this.skillRegistry.set(
        /** @type {TenantType} */(tenantType),
        /** @type {SkillConfig[]} */(skills)
      );
    });

    this.logSuccess(
      `註冊了 ${Object.keys(skillConfigs).length} 種租客類型的技能`
    );
  }

  /**
   * 建立技能執行器
   * @returns {void}
   */
  createSkillExecutors() {
    this.logSuccess("建立技能執行器...");

    this.skillRegistry.forEach((skills, tenantType) => {
      skills.forEach((skillConfig) => {
        const executor = this.createSkillExecutor(skillConfig);
        this.skillExecutors.set(skillConfig.id, executor);
      });
    });
  }

  /**
   * 建立技能執行器工廠
   * @param {SkillConfig} skillConfig - 技能配置
   * @returns {BaseSkillExecutor} 技能執行器實例
   */
  createSkillExecutor(skillConfig) {
    switch (skillConfig.type) {
      case "active":
        return new ActiveSkillExecutor(skillConfig, this);
      case "passive":
        return new PassiveSkillExecutor(skillConfig, this);
      case "special":
        return new SpecialSkillExecutor(skillConfig, this);
      default:
        return new BaseSkillExecutor(skillConfig, this);
    }
  }

  /**
   * 註冊內建效果處理器
   * @returns {void}
   */
  registerBuiltinEffectHandlers() {
    this.effectHandlers.set(
      "modifyResource",
      new ResourceModificationHandler()
    );
    this.effectHandlers.set("modifyState", new StateModificationHandler());
    this.effectHandlers.set("healTenant", new TenantHealingHandler());
    this.effectHandlers.set("repairRoom", new RoomRepairHandler());
    this.effectHandlers.set("logMessage", new LogMessageHandler());
    this.effectHandlers.set("triggerEvent", new EventTriggerHandler());
    this.effectHandlers.set("scheduledEffect", new ScheduledEffectHandler());
    this.effectHandlers.set("reinforceRoom", new RoomReinforcementHandler());
    this.effectHandlers.set("autoRepair", new AutoRepairHandler());
    this.effectHandlers.set("removeTenant", new TenantRemovalHandler());
    this.effectHandlers.set(
      "improveTenantSatisfaction",
      new TenantSatisfactionHandler()
    );
    this.effectHandlers.set(
      "detectEarlyInfection",
      new InfectionDetectionHandler()
    );
    this.effectHandlers.set("revealInfection", new InfectionRevealHandler());
  }

  /**
   * 建立驗證鏈
   * @returns {void}
   */
  buildValidationChain() {
    this.validationChain = [
      new TenantExistenceValidator(),
      new TenantHealthValidator(),
      new SkillAvailabilityValidator(),
      new CostAffordabilityValidator(),
      new CooldownValidator(this.cooldownManager),
      new RequirementValidator(this),
    ];
  }

  /**
   * 執行技能
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @param {Object} [options={}] - 額外選項
   * @returns {Promise<SkillExecutionResult>} 執行結果
   * @throws {Error} 當執行過程發生未預期錯誤時
   */
  async executeSkill(tenantId, skillId, options = {}) {
    if (typeof tenantId !== "number") {
      throw new Error("租客姓名必須為數字");
    }
    if (typeof skillId !== "string") {
      throw new Error("技能ID必須為字串");
    }

    this.logSuccess(`嘗試執行技能: ${skillId} (租客ID: ${tenantId})`);
    this.stats.totalSkillsExecuted++;

    try {
      const context = await this.prepareExecutionContext(
        tenantId,
        skillId,
        options
      );
      const validationResult = this.validateSkillExecution(context);

      if (!validationResult.valid) {
        this.stats.failedExecutions++;
        this.logWarning(`技能執行驗證失敗: ${validationResult.message}`);
        return {
          success: false,
          reason: validationResult.reason,
          message: validationResult.message,
        };
      }

      const executor = this.skillExecutors.get(skillId);
      if (!executor) {
        this.stats.failedExecutions++;
        return {
          success: false,
          reason: "skill_not_found",
          message: `找不到技能執行器: ${skillId}`,
        };
      }

      const executionResult = await executor.execute(context);
      this.postProcessExecution(context, executionResult);
      this.stats.successfulExecutions++;

      this.emitEvent("executed", {
        tenantId,
        skillId,
        skillName: context.skill.name,
        result: executionResult,
        context,
      });

      return {
        success: true,
        result: executionResult,
        effects: executionResult.effects || [],
      };
    } catch (error) {
      this.stats.failedExecutions++;
      this.logError(`技能執行失敗 (${skillId})`, error);

      return {
        success: false,
        reason: "execution_error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 準備執行上下文
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @param {Object} options - 執行選項
   * @returns {Promise<SkillExecutionContext>} 執行上下文
   * @throws {Error} 當租客不存在或技能配置不存在時
   */
  async prepareExecutionContext(tenantId, skillId, options) {
    const tenant = this.findTenantById(tenantId);
    if (!tenant) {
      throw new Error(`找不到租客ID: ${tenantId}`);
    }

    const skillConfig = this.getSkillConfig(skillId);
    if (!skillConfig) {
      throw new Error(`找不到技能配置: ${skillId}`);
    }

    return {
      tenant,
      skill: skillConfig,
      gameState: this.gameState,
      options,
      trigger: options.trigger || null,
      passive: options.passive || false,
      timestamp: Date.now(),
      executionId: `exec_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
    };
  }

  /**
   * 驗證技能執行
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {SkillValidationResult} 驗證結果
   */
  validateSkillExecution(context) {
    for (const validator of this.validationChain) {
      const result = validator.validate(context);
      if (!result.valid) {
        this.logWarning(
          `技能驗證失敗 (${validator.constructor.name}): ${result.message}`
        );
        return result;
      }
    }

    return { valid: true };
  }

  /**
   * 後處理執行結果
   * @param {SkillExecutionContext} context - 執行上下文
   * @param {Object} executionResult - 執行結果
   * @returns {void}
   */
  postProcessExecution(context, executionResult) {
    this.recordExecutionHistory(context, executionResult);

    const currentDay = this.gameState.getStateValue("day", 1);
    this.cooldownManager.setSkillCooldown(
      context.tenant.id,
      context.skill.id,
      context.skill.cooldown || 0,
      currentDay
    );

    if (context.skill.cooldown === -1) {
      const usageKey = `${context.tenant.id}_${context.skill.id}_used`;
      this.gameState.setState(
        usageKey,
        (this.gameState.getStateValue(usageKey) || 0) + 1
      );
    }

    this.logSuccess(`技能執行完成: ${context.skill.name}`);
  }

  /**
   * 取得所有租客的可用技能
   * @returns {SkillConfig[]} 所有租客的可用技能列表
   */
  getAvailableSkills() {
    // 獲取所有租客
    const rooms = this.gameState.getStateValue("rooms", []);
    const tenants = rooms
      .filter(room => room.tenant && room.tenant.id)
      .map(room => room.tenant);

    if (tenants.length === 0) {
      this.logWarning("沒有可用的租客");
      return [];
    }

    // 從所有租客中收集可用技能
    const allSkills = [];
    tenants.forEach(tenant => {
      if (tenant && tenant.id) {
        const tenantSkills = this.getAvailableSkillsForTenant(tenant.id);
        allSkills.push(...tenantSkills);
      }
    });

    return allSkills;
  }

  /**
   * 取得租客可用技能
   * @param {number} tenantId - 租客ID
   * @returns {SkillConfig[]} 可用技能列表
   */
  getAvailableSkillsForTenant(tenantId) {
    if (typeof tenantId !== "number") {
      this.logWarning("租客ID必須為數字");
      return [];
    }

    const tenant = this.findTenantById(tenantId);
    if (!tenant) {
      this.logWarning(`找不到租客ID: ${tenantId}`);
      return [];
    }

    const tenantTypeId = /** @type {TenantType} */ (
      tenant.type
    );
    const tenantSkills = this.skillRegistry.get(tenantTypeId) || [];
    const currentDay = this.gameState.getStateValue("day", 1);

    return tenantSkills
      .filter((skill) => {
        if (skill.type === "passive") {
          return false;
        }

        if (!this.isSkillAvailable(skill, tenant)) {
          return false;
        }

        if (!this.checkSkillRequirements(skill, tenant)) {
          return false;
        }

        return true;
      })
      .map((skill) => ({
        ...skill,
        cooldownRemaining: this.cooldownManager.getCooldownRemaining(
          tenant.id,
          skill.id,
          currentDay
        ),
        canAfford: this.costCalculator.canAffordCost(
          skill.cost || {},
          this.gameState
        ),
        usageCount: this.getSkillUsageCount(tenant.id, skill.id),
        tenantId: tenant.id,  // 添加租客ID，以便在執行技能時使用
        tenantName: tenant.name  // 添加租客名稱，以便在UI中顯示
      }));
  }

  /**
   * 檢查技能是否可用
   * @param {SkillConfig} skill - 技能配置
   * @param {Tenant} tenant - 租客物件
   * @returns {boolean} 是否可用
   */
  isSkillAvailable(skill, tenant) {
    const currentDay = this.gameState.getStateValue("day", 1);

    if (this.cooldownManager.isOnCooldown(tenant.id, skill.id, currentDay)) {
      return false;
    }

    if (
      skill.maxUses &&
      this.getSkillUsageCount(tenant.id, skill.id) >= skill.maxUses
    ) {
      return false;
    }

    if (!this.costCalculator.canAffordCost(skill.cost || {}, this.gameState)) {
      return false;
    }

    if (tenant.infected) {
      return false;
    }

    return true;
  }

  /**
   * 檢查技能需求
   * @param {SkillConfig} skill - 技能配置
   * @param {Tenant} tenant - 租客物件
   * @param {Object|null} [context=null] - 額外上下文
   * @returns {boolean} 是否滿足需求
   */
  checkSkillRequirements(skill, tenant, context = null) {
    const requirements = skill.requirements;
    if (!requirements || !requirements.conditions) return true;

    return requirements.conditions.every((condition) => {
      return this.evaluateCondition(condition, {
        tenant,
        gameState: this.gameState,
        ...context,
      });
    });
  }

  /**
   * 評估條件
   * @param {SkillCondition} condition - 技能條件
   * @param {Object} context - 評估上下文
   * @returns {boolean} 條件是否滿足
   */
  evaluateCondition(condition, context) {
    switch (condition.type) {
      case "hasTenantType":
        return this.checkTenantTypeCondition(condition, context);
      case "hasResource":
        return this.checkResourceCondition(condition, context);
      case "gameStateCheck":
        return this.checkGameStateCondition(condition, context);
      case "trigger":
        return this.checkTriggerCondition(condition, context);
      case "probability":
        return Math.random() < (condition.chance || 0);
      default:
        this.logWarning(`未知的條件類型: ${condition.type}`);
        return false;
    }
  }

  /**
   * 檢查租客類型條件
   * @param {SkillCondition} condition - 技能條件
   * @param {Object} context - 評估上下文
   * @returns {boolean} 條件是否滿足
   */
  checkTenantTypeCondition(condition, context) {
    const { value, count = 1 } = condition;
    const rooms = /** @type {Room[]} */ (
      this.gameState.getStateValue("rooms", [])
    );

    if (value === "infected") {
      const infectedCount = rooms.filter(
        (room) => room.tenant && room.tenant.infected
      ).length;
      return infectedCount >= count;
    }

    if (value === "any") {
      const tenantCount = rooms.filter((room) => room.tenant).length;
      return tenantCount >= count;
    }

    const typeCount = rooms.filter(
      (room) =>
        room.tenant &&
        (room.tenant.type === value)
    ).length;
    return typeCount >= count;
  }

  /**
   * 檢查資源條件
   * @param {SkillCondition} condition - 技能條件
   * @param {Object} context - 評估上下文
   * @returns {boolean} 條件是否滿足
   */
  checkResourceCondition(condition, context) {
    const { resource, amount } = condition;
    if (!resource || typeof amount !== "number") {
      return false;
    }
    return this.gameState.hasEnoughResource(
      /** @type {ResourceType} */(resource),
      amount
    );
  }

  /**
   * 檢查遊戲狀態條件
   * @param {SkillCondition} condition - 技能條件
   * @param {Object} context - 評估上下文
   * @returns {boolean} 條件是否滿足
   */
  checkGameStateCondition(condition, context) {
    const { path, operator, value } = condition;
    const rooms = /** @type {Room[]} */ (
      this.gameState.getStateValue("rooms", [])
    );

    switch (path) {
      case "rooms":
        if (operator === "hasNeedsRepair") {
          return rooms.some((room) => room.needsRepair);
        }
        if (operator === "hasUnReinforced") {
          return rooms.some((room) => room.tenant && !room.reinforced);
        }
        break;

      default:
        const actualValue = this.gameState.getStateValue(path);
        return this.compareValues(actualValue, operator, value);
    }

    return false;
  }

  /**
   * 檢查觸發條件
   * @param {SkillCondition} condition - 技能條件
   * @param {Object} context - 評估上下文
   * @returns {boolean} 條件是否滿足
   */
  checkTriggerCondition(condition, context) {
    const { value } = condition;
    const { trigger } = context.options || {};
    return trigger === value;
  }

  /**
   * 處理被動技能
   * @param {string} trigger - 觸發條件
   * @param {Object} [context={}] - 上下文
   * @returns {void}
   */
  processPassiveSkills(trigger, context = {}) {
    if (!this.isInitialized()) {
      this.logWarning("SkillManager 未初始化，跳過被動技能處理");
      return;
    }

    const passiveSkills = [];
    const rooms = /** @type {Room[]} */ (
      this.gameState.getStateValue("rooms", [])
    );

    rooms.forEach((room) => {
      if (room.tenant && !room.tenant.infected) {
        const tenantTypeId = /** @type {TenantType} */ (
          room.tenant.type
        );
        const tenantSkills = this.skillRegistry.get(tenantTypeId) || [];
        const passives = tenantSkills.filter(
          (skill) =>
            skill.type === "passive" &&
            this.isPassiveTriggered(skill, trigger, context)
        );
        passives.forEach((skill) => {
          passiveSkills.push({ tenant: room.tenant, skill });
        });
      }
    });

    passiveSkills.forEach(async ({ tenant, skill }) => {
      try {
        this.stats.passiveTriggered++;
        await this.executeSkill(tenant.id, skill.id, {
          passive: true,
          trigger,
          context,
        });
      } catch (error) {
        this.logError("被動技能執行錯誤", error);
      }
    });

    if (passiveSkills.length > 0) {
      this.logSuccess(
        `觸發了 ${passiveSkills.length} 個被動技能 (觸發器: ${trigger})`
      );
    }
  }

  /**
   * 檢查被動技能是否被觸發
   * @param {SkillConfig} skill - 技能配置
   * @param {string} trigger - 觸發條件
   * @param {Object} context - 上下文
   * @returns {boolean} 是否被觸發
   */
  isPassiveTriggered(skill, trigger, context) {
    if (!skill.requirements || !skill.requirements.conditions) return false;

    return skill.requirements.conditions.some((condition) => {
      if (condition.type === "trigger") {
        return condition.value === trigger;
      }

      if (
        condition.type === "gameStateCheck" &&
        condition.path === "currentAction"
      ) {
        return condition.value === trigger;
      }
      if (condition.type === "gameStateCheck" && condition.path === "time") {
        return condition.value === trigger;
      }
      if (condition.type === "probability") {
        return Math.random() < (condition.chance || 0);
      }
      return false;
    });
  }

  /**
   * 根據姓名尋找租客
   * @param {number} id - 租客ID
   * @returns {Tenant|null} 租客物件或 null
   */
  findTenantById(id) {
    const rooms = /** @type {Room[]} */ (
      this.gameState.getStateValue("rooms", [])
    );
    const room = rooms.find((r) => r.tenant && r.tenant.id === id);
    return room ? room.tenant : null;
  }

  /**
   * 根據技能ID取得技能配置
   * @param {string} skillId - 技能ID
   * @returns {SkillConfig|null} 技能配置或 null
   */
  getSkillConfig(skillId) {
    for (const [tenantType, skills] of this.skillRegistry) {
      const skill = skills.find((s) => s.id === skillId);
      if (skill) return skill;
    }
    return null;
  }

  /**
   * 取得技能使用次數
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @returns {number} 使用次數
   */
  getSkillUsageCount(tenantId, skillId) {
    return this.executionHistory.filter(
      (record) => record.tenantId === tenantId && record.skillId === skillId
    ).length;
  }

  /**
   * 記錄執行歷史
   * @param {SkillExecutionContext} context - 執行上下文
   * @param {Object} result - 執行結果
   * @returns {void}
   */
  recordExecutionHistory(context, result) {
    /** @type {ExecutionHistory} */
    const record = {
      executionId: context.executionId,
      tenantId: context.tenant.id,
      skillId: context.skill.id,
      timestamp: context.timestamp,
      day: this.gameState.getStateValue("day", 1),
      success: result.success !== false,
      effects: result.effects || [],
    };

    this.executionHistory.push(record);

    if (
      this.executionHistory.length > SYSTEM_LIMITS.HISTORY.MAX_EXECUTION_HISTORY
    ) {
      this.executionHistory = this.executionHistory.slice(-50);
    }
  }

  /**
   * 比較數值
   * @param {any} actual - 實際值
   * @param {any} expected - 期望值
   * @param {string} [operator='==='] - 操作符
   * @returns {boolean} 比較結果
   */
  compareValues(actual, expected, operator = "===") {
    switch (operator) {
      case "===":
        return actual === expected;
      case "==":
        return actual == expected;
      case ">":
        return actual > expected;
      case ">=":
        return actual >= expected;
      case "<":
        return actual < expected;
      case "<=":
        return actual <= expected;
      case "hasNeedsRepair":
        return Array.isArray(actual) && actual.some((room) => room.needsRepair);
      case "hasUnReinforced":
        return (
          Array.isArray(actual) &&
          actual.some((room) => room.tenant && !room.reinforced)
        );
      default:
        return false;
    }
  }

  /**
   * 初始化後備系統
   * @returns {void}
   */
  initializeFallbackSystem() {
    this.logSuccess("初始化後備技能系統");
    this.skillRegistry.set("doctor", this.getFallbackSkills("doctor"));
    this.skillRegistry.set("worker", this.getFallbackSkills("worker"));
    this.skillRegistry.set("farmer", this.getFallbackSkills("farmer"));
    this.markInitialized(true);
  }

  /**
   * 取得後備技能配置
   * @param {TenantType} type - 租客類型
   * @returns {SkillConfig[]} 後備技能列表
   */
  getFallbackSkills(type) {
    /** @type {Record<TenantType, SkillConfig[]>} */
    const fallbackSkills = {
      doctor: [
        {
          id: "heal_infection",
          name: "治療感染",
          type: "active",
          description: "治療感染的租客",
          cost: { medical: 3, cash: 12 },
          effects: [{ type: "healTenant" }],
        },
      ],
      worker: [
        {
          id: "efficient_repair",
          name: "專業維修",
          type: "active",
          description: "維修房間",
          cost: { materials: 1, cash: 10 },
          effects: [{ type: "repairRoom" }],
        },
      ],
      farmer: [
        {
          id: "harvest_bonus",
          name: "採集加成",
          type: "passive",
          description: "院子採集 +2 食物",
          requirements: {
            conditions: [
              {
                type: "gameStateCheck",
                path: "currentAction",
                value: "harvestYard",
              },
            ],
          },
          effects: [{ type: "modifyResource", resource: "food", amount: 2 }],
        },
      ],
      soldier: [],
      elder: [],
    };

    return fallbackSkills[type] || [];
  }

  /**
   * 取得系統統計
   * @returns {SkillStats} 技能統計資料
   */
  getStats() {
    const successRate =
      this.stats.totalSkillsExecuted > 0
        ? (
          (this.stats.successfulExecutions / this.stats.totalSkillsExecuted) *
          100
        ).toFixed(1) + "%"
        : "0%";

    return {
      ...this.stats,
      successRate,
    };
  }
}

/**
 * 基礎技能執行器
 * @class
 */
class BaseSkillExecutor {
  /**
   * 建立基礎技能執行器實例
   * @param {SkillConfig} skillConfig - 技能配置
   * @param {SkillManager} skillManager - 技能系統實例
   */
  constructor(skillConfig, skillManager) {
    /** @type {SkillConfig} 技能配置 */
    this.skillConfig = skillConfig;

    /** @type {SkillManager} 技能系統實例 */
    this.skillManager = skillManager;
  }

  /**
   * 執行技能
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {Promise<Object>} 執行結果
   * @throws {Error} 當效果執行失敗時
   */
  async execute(context) {
    this.skillManager.logSuccess(`執行技能: ${this.skillConfig.name}`);

    const costResult = this.payCost(context);
    const effects = await this.executeEffects(context);

    return {
      success: true,
      skillId: this.skillConfig.id,
      effects,
      cost: costResult,
    };
  }

  /**
   * 支付技能成本
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {CostPaymentResult} 支付結果
   */
  payCost(context) {
    const cost = this.skillConfig.cost || {};
    return this.skillManager.costCalculator.payCost(
      cost,
      context.gameState,
      context.tenant
    );
  }

  /**
   * 執行技能效果
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {Promise<EffectResult[]>} 效果執行結果列表
   */
  async executeEffects(context) {
    const effects = this.skillConfig.effects || [];
    /** @type {EffectResult[]} */
    const results = [];

    for (const effect of effects) {
      try {
        const handler = this.skillManager.effectHandlers.get(effect.type);
        if (handler) {
          const result = await handler.handle(effect, context);
          if (result) {
            results.push(result);
          }
        } else {
          this.skillManager.logWarning(`未知的效果類型: ${effect.type}`);
          results.push({
            type: "unknown",
            effect,
            message: `未知的效果類型: ${effect.type}`,
          });
        }
      } catch (error) {
        this.skillManager.logError("效果執行錯誤", error);
        results.push({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
          message: "效果執行過程中發生錯誤",
        });
      }
    }

    return results;
  }
}

/**
 * 主動技能執行器
 * @class
 * @extends {BaseSkillExecutor}
 */
class ActiveSkillExecutor extends BaseSkillExecutor {
  /**
   * 執行主動技能
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {Promise<Object>} 執行結果
   */
  async execute(context) {
    const result = await super.execute(context);

    this.skillManager.emitEvent("activeSkillUsed", {
      tenant: context.tenant,
      skill: this.skillConfig,
      result,
    });

    return result;
  }
}

/**
 * 被動技能執行器
 * @class
 * @extends {BaseSkillExecutor}
 */
class PassiveSkillExecutor extends BaseSkillExecutor {
  /**
   * 執行被動技能
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {Promise<Object>} 執行結果
   */
  async execute(context) {
    const effects = await this.executeEffects(context);

    this.skillManager.emitEvent("passiveSkillTriggered", {
      tenant: context.tenant,
      skill: this.skillConfig,
      trigger: context.options.trigger,
      effects,
    });

    return {
      success: true,
      skillId: this.skillConfig.id,
      effects,
      passive: true,
    };
  }
}

/**
 * 特殊技能執行器
 * @class
 * @extends {BaseSkillExecutor}
 */
class SpecialSkillExecutor extends BaseSkillExecutor {
  /**
   * 執行特殊技能
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {Promise<Object>} 執行結果
   */
  async execute(context) {
    const result = await super.execute(context);

    if (this.skillConfig.maxUses) {
      const usageKey = `${context.tenant.id}_${this.skillConfig.id}_used`;
      const currentUsage = context.gameState.getStateValue(usageKey, 0);
      context.gameState.setState(usageKey, currentUsage + 1);
    }

    this.skillManager.emitEvent("specialSkillUsed", {
      tenant: context.tenant,
      skill: this.skillConfig,
      result,
      permanentEffect: this.skillConfig.cooldown === -1,
    });

    return result;
  }
}

/**
 * 冷卻管理器
 * @class
 */
class CooldownManager {
  /**
   * 建立冷卻管理器實例
   */
  constructor() {
    /** @type {Map<string, number>} 冷卻時間映射表 (tenantId_skillId -> expireDay) */
    this.cooldowns = new Map();
  }

  /**
   * 設置技能冷卻時間
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @param {number} cooldownDays - 冷卻天數
   * @param {number} currentDay - 當前天數
   * @returns {void}
   */
  setSkillCooldown(tenantId, skillId, cooldownDays, currentDay) {
    if (cooldownDays > 0) {
      const key = `${tenantId}_${skillId}`;
      const expireDay = currentDay + cooldownDays;
      this.cooldowns.set(key, expireDay);
    }
  }

  /**
   * 檢查技能是否在冷卻中
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @param {number} currentDay - 當前天數
   * @returns {boolean} 是否在冷卻中
   */
  isOnCooldown(tenantId, skillId, currentDay) {
    const key = `${tenantId}_${skillId}`;
    const expireDay = this.cooldowns.get(key);

    if (!expireDay) return false;

    if (currentDay >= expireDay) {
      this.cooldowns.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 取得剩餘冷卻時間
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @param {number} currentDay - 當前天數
   * @returns {number} 剩餘天數
   */
  getCooldownRemaining(tenantId, skillId, currentDay) {
    const key = `${tenantId}_${skillId}`;
    const expireDay = this.cooldowns.get(key);

    if (!expireDay) return 0;

    return Math.max(0, expireDay - currentDay);
  }

  /**
   * 推進一天，清理過期的冷卻時間
   * @param {number} currentDay - 當前天數
   * @returns {void}
   */
  advanceDay(currentDay) {
    for (const [key, expireDay] of this.cooldowns.entries()) {
      if (currentDay >= expireDay) {
        this.cooldowns.delete(key);
      }
    }
  }
}

/**
 * 成本計算器
 * @class
 */
class CostCalculator {
  /**
   * 檢查是否負擔得起成本
   * @param {SkillCost} cost - 技能成本
   * @param {Object} gameState - 遊戲狀態
   * @returns {boolean} 是否負擔得起
   */
  canAffordCost(cost, gameState) {
    return Object.keys(cost).every((resource) => {
      return gameState.hasEnoughResource(
        /** @type {ResourceType} */(resource),
        cost[resource]
      );
    });
  }

  /**
   * 支付成本
   * @param {SkillCost} cost - 技能成本
   * @param {Object} gameState - 遊戲狀態
   * @param {Tenant} tenant - 租客物件
   * @returns {CostPaymentResult} 支付結果
   */
  payCost(cost, gameState, tenant) {
    let totalPayment = 0;
    /** @type {Record<string, number>} */
    const paid = {};

    Object.keys(cost).forEach((resource) => {
      const amount = cost[resource];

      if (resource === "cash") {
        gameState.modifyResource("cash", -amount, `技能支付: ${tenant.id}`);
        totalPayment += amount;
      } else {
        gameState.modifyResource(
          /** @type {ResourceType} */(resource),
          -amount,
          `技能成本: ${tenant.id}`
        );
      }

      paid[resource] = amount;
    });

    if (totalPayment > 0 && tenant && tenant.personalResources) {
      tenant.personalResources.cash =
        (tenant.personalResources.cash || 0) + totalPayment;
    }

    return { paid, totalPayment };
  }
}

// =============== 驗證器 ===============

class SkillValidator {
  validate(context) {
    return { valid: true };
  }
}

class TenantExistenceValidator extends SkillValidator {
  validate(context) {
    if (!context.tenant) {
      return {
        valid: false,
        reason: "tenant_not_found",
        message: "找不到指定租客",
      };
    }
    return { valid: true };
  }
}

class TenantHealthValidator extends SkillValidator {
  validate(context) {
    if (context.tenant.infected) {
      return {
        valid: false,
        reason: "tenant_infected",
        message: "感染的租客無法使用技能",
      };
    }
    return { valid: true };
  }
}

class SkillAvailabilityValidator extends SkillValidator {
  validate(context) {
    if (!context.skill) {
      return {
        valid: false,
        reason: "skill_not_found",
        message: "找不到指定技能",
      };
    }
    return { valid: true };
  }
}

class CostAffordabilityValidator extends SkillValidator {
  validate(context) {
    const cost = context.skill.cost || {};
    const canAfford = Object.keys(cost).every((resource) => {
      return context.gameState.hasEnoughResource(resource, cost[resource]);
    });

    if (!canAfford) {
      return {
        valid: false,
        reason: "insufficient_resources",
        message: "資源不足",
      };
    }
    return { valid: true };
  }
}

/**
 * 冷卻驗證器
 * @class
 * @extends {SkillValidator}
 */
class CooldownValidator extends SkillValidator {
  /**
   * 建立冷卻驗證器實例
   * @param {CooldownManager} cooldownManager - 冷卻管理器
   */
  constructor(cooldownManager) {
    super();
    /** @type {CooldownManager} 冷卻管理器實例 */
    this.cooldownManager = cooldownManager;
  }

  /**
   * 驗證技能冷卻狀態
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {SkillValidationResult} 驗證結果
   */
  validate(context) {
    const currentDay = context.gameState.getStateValue("day", 1);

    if (
      this.cooldownManager.isOnCooldown(
        context.tenant.id,
        context.skill.id,
        currentDay
      )
    ) {
      const remaining = this.cooldownManager.getCooldownRemaining(
        context.tenant.id,
        context.skill.id,
        currentDay
      );
      return {
        valid: false,
        reason: "on_cooldown",
        message: `技能冷卻中，還需 ${remaining} 天`,
      };
    }
    return { valid: true };
  }
}

class RequirementValidator extends SkillValidator {
  constructor(skillManager) {
    super();
    this.skillManager = skillManager;
  }

  validate(context) {
    if (
      !this.skillManager.checkSkillRequirements(
        context.skill,
        context.tenant,
        context
      )
    ) {
      return {
        valid: false,
        reason: "requirements_not_met",
        message: "技能使用條件不滿足",
      };
    }
    return { valid: true };
  }
}

// =============== 效果處理器 ===============

/**
 * 基礎效果處理器
 * @class
 */
class EffectHandler {
  /**
   * 處理效果
   * @param {SkillEffect} effect - 技能效果配置
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {Promise<EffectResult>} 效果處理結果
   */
  async handle(effect, context) {
    throw new Error("EffectHandler.handle() must be implemented");
  }
}

class ResourceModificationHandler extends EffectHandler {
  async handle(effect, context) {
    const { resource, amount } = effect;
    const oldValue = context.gameState.getResourceValue(resource);
    context.gameState.modifyResource(
      resource,
      amount,
      `技能效果: ${context.skill.name}`
    );

    return {
      type: "resource_modified",
      resource,
      amount,
      oldValue,
      newValue: context.gameState.getResourceValue(resource),
    };
  }
}

class StateModificationHandler extends EffectHandler {
  async handle(effect, context) {
    const { path, value, operation = "set" } = effect;
    const oldValue = context.gameState.getStateValue(path);

    switch (operation) {
      case "set":
        context.gameState.setState(path, value);
        break;
      case "add":
        context.gameState.setState(path, oldValue + value);
        break;
    }

    return {
      type: "state_modified",
      path,
      oldValue,
      newValue: context.gameState.getStateValue(path),
    };
  }
}

class TenantHealingHandler extends EffectHandler {
  async handle(effect, context) {
    const rooms = context.gameState.getStateValue("rooms", []);
    const infectedTenants = rooms
      .filter((room) => room.tenant && room.tenant.infected)
      .map((room) => room.tenant);

    if (infectedTenants.length > 0) {
      const patient =
        infectedTenants[Math.floor(Math.random() * infectedTenants.length)];
      patient.infected = false;

      // 發送治療事件
      context.skillManager?.emitEvent("tenantHealed", {
        patient: patient.name,
        healer: context.tenant.id,
      });

      return {
        type: "tenant_healed",
        patient: patient.name,
        healer: context.tenant.id,
      };
    }

    return { type: "no_target", message: "沒有需要治療的租客" };
  }
}

class RoomRepairHandler extends EffectHandler {
  async handle(effect, context) {
    const rooms = context.gameState.getStateValue("rooms", []);
    const needRepairRooms = rooms.filter((r) => r.needsRepair);

    if (needRepairRooms.length > 0) {
      const room = needRepairRooms[0];
      room.needsRepair = false;

      return {
        type: "room_repaired",
        roomId: room.id,
        repairer: context.tenant.id,
      };
    }

    return { type: "no_target", message: "沒有需要維修的房間" };
  }
}

class RoomReinforcementHandler extends EffectHandler {
  async handle(effect, context) {
    const rooms = context.gameState.getStateValue("rooms", []);
    const unReinforcedRooms = rooms.filter(
      (room) => room.tenant && !room.reinforced
    );

    if (unReinforcedRooms.length > 0) {
      const room = unReinforcedRooms[0];
      room.reinforced = true;

      return {
        type: "room_reinforced",
        roomId: room.id,
        worker: context.tenant.id,
      };
    }

    return { type: "no_target", message: "沒有可加固的房間" };
  }
}

class AutoRepairHandler extends EffectHandler {
  async handle(effect, context) {
    const rooms = context.gameState.getStateValue("rooms", []);
    const damagedRooms = rooms.filter((r) => r.needsRepair);

    if (damagedRooms.length > 0) {
      const room =
        damagedRooms[Math.floor(Math.random() * damagedRooms.length)];
      room.needsRepair = false;

      return {
        type: "auto_repair",
        roomId: room.id,
        worker: context.tenant.id,
      };
    }

    return { type: "no_target" };
  }
}

class LogMessageHandler extends EffectHandler {
  async handle(effect, context) {
    const { message, logType = "skill" } = effect;

    context.gameState.addLog(message, logType);

    return {
      type: "log_message",
      message,
      logType,
    };
  }
}

class EventTriggerHandler extends EffectHandler {
  async handle(effect, context) {
    const { eventId } = effect;

    // 這裡應該與EventSystem整合
    context.skillManager.logSuccess(`🎲 觸發事件: ${eventId}`);

    return {
      type: "event_triggered",
      eventId,
    };
  }
}

class ScheduledEffectHandler extends EffectHandler {
  async handle(effect, context) {
    const { delay, effect: scheduledEffect } = effect;

    // 這裡需要實作延遲效果的排程系統
    context.skillManager.logSuccess(`⏰ 排程效果將在 ${delay} 天後執行`);

    return {
      type: "effect_scheduled",
      delay,
      executeDay: context.gameState.getStateValue("day", 1) + delay,
    };
  }
}

// 租客相關效果處理器（與其他系統協作）

class TenantRemovalHandler extends EffectHandler {
  async handle(effect, context) {
    const { target } = effect;

    // 發送租客移除請求事件
    context.skillManager?.emitEvent("requestTenantRemoval", {
      target,
      reason: "skill_effect",
      requestedBy: context.tenant.id,
    });

    return {
      type: "tenant_removal_requested",
      target,
      reason: "skill_effect",
    };
  }
}

class TenantSatisfactionHandler extends EffectHandler {
  async handle(effect, context) {
    const { target, amount } = effect;

    // 發送滿意度改善事件
    context.skillManager?.emitEvent("improveTenantSatisfaction", {
      target,
      amount,
      source: context.tenant.id,
    });

    return {
      type: "satisfaction_improved",
      target,
      amount,
      source: context.tenant.id,
    };
  }
}

class InfectionDetectionHandler extends EffectHandler {
  async handle(effect, context) {
    const { targets, probability } = effect;

    // 發送感染檢測事件
    context.skillManager?.emitEvent("detectInfection", {
      targets,
      probability,
      detector: context.tenant.id,
    });

    return {
      type: "infection_detection",
      targets,
      probability,
      detector: context.tenant.id,
    };
  }
}

class InfectionRevealHandler extends EffectHandler {
  async handle(effect, context) {
    const { targets } = effect;

    // 發送感染揭露事件
    context.skillManager?.emitEvent("revealInfection", {
      targets,
      revealer: context.tenant.id,
    });

    return {
      type: "infection_revealed",
      targets,
      revealer: context.tenant.id,
    };
  }
}

export default SkillManager;
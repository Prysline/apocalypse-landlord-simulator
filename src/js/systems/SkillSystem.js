/**
 * SkillSystem - 配置驅動的技能執行與管理系統
 *
 * 模組職責：
 * 1. 技能執行與效果處理
 * 2. 冷卻時間與使用次數管理
 * 3. 成本計算與工資支付
 * 4. 被動技能的事件驅動觸發
 * 5. 與 TenantSystem 的事件通信
 *
 * 架構特點：
 * - 配置驅動：技能數據來自 skills.json
 * - 命令模式：每個技能執行都是可追蹤的命令
 * - 責任鏈模式：驗證器鏈和效果處理鏈
 * - 事件驅動：與其他系統的鬆耦合通信
 */

export class SkillSystem extends EventTarget {
  constructor(gameStateRef, dataManager, gameHelpers = null) {
    super(); // 支援事件驅動通信

    this.gameState = gameStateRef;
    this.dataManager = dataManager;
    this.gameHelpers = gameHelpers;

    // 技能執行管理
    this.skillExecutors = new Map(); // skillId -> SkillExecutor
    this.skillRegistry = new Map(); // tenantType -> [skills]
    this.cooldownManager = new CooldownManager();
    this.costCalculator = new CostCalculator();

    // 效果系統
    this.effectHandlers = new Map(); // effectType -> EffectHandler
    this.executionHistory = [];

    // 驗證鏈
    this.validationChain = [];

    // 系統狀態
    this.initialized = false;
    this.status = {
      initialized: false,
      skillsLoaded: false,
      executorsReady: false,
      effectHandlersReady: false,
      validationReady: false,
    };

    // 統計資訊
    this.stats = {
      totalSkillsExecuted: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      passiveTriggered: 0,
    };
  }

  /**
   * 初始化技能系統
   */
  async initialize() {
    console.log("🔧 初始化 SkillSystem...");

    try {
      // 階段 1：載入技能配置
      await this.loadSkillConfigurations();
      this.status.skillsLoaded = true;

      // 階段 2：註冊內建效果處理器
      this.registerBuiltinEffectHandlers();
      this.status.effectHandlersReady = true;

      // 階段 3：建立驗證鏈
      this.buildValidationChain();
      this.status.validationReady = true;

      // 階段 4：建立技能執行器
      this.createSkillExecutors();
      this.status.executorsReady = true;

      this.initialized = true;
      this.status.initialized = true;

      console.log("✅ SkillSystem 初始化完成");
      console.log(`📊 載入了 ${this.skillExecutors.size} 個技能執行器`);

      // 發送初始化完成事件
      this.dispatchEvent(
        new CustomEvent("skillSystemReady", {
          detail: {
            status: this.status,
            skillCount: this.skillExecutors.size,
          },
        })
      );

      return true;
    } catch (error) {
      console.error("❌ SkillSystem 初始化失敗:", error);
      this.initialized = false;
      this.status.initialized = false;

      // 嘗試初始化後備系統
      this.initializeFallbackSystem();
      return false;
    }
  }

  /**
   * 載入技能配置
   */
  async loadSkillConfigurations() {
    console.log("📊 載入技能配置資料...");

    const skillConfigs = this.dataManager.getCachedData("skills");
    if (!skillConfigs) {
      throw new Error("技能配置不可用");
    }

    // 建立技能註冊表
    Object.entries(skillConfigs).forEach(([tenantType, skills]) => {
      this.skillRegistry.set(tenantType, skills);
    });

    console.log(
      `📋 註冊了 ${Object.keys(skillConfigs).length} 種租客類型的技能`
    );
  }

  /**
   * 建立技能執行器
   */
  createSkillExecutors() {
    console.log("⚙️ 建立技能執行器...");

    this.skillRegistry.forEach((skills, tenantType) => {
      skills.forEach((skillConfig) => {
        const executor = this.createSkillExecutor(skillConfig);
        this.skillExecutors.set(skillConfig.id, executor);
      });
    });
  }

  /**
   * 建立技能執行器工廠
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

    // 租客相關效果（與 TenantSystem 協作）
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
   * @param {string} tenantName - 租客姓名
   * @param {string} skillId - 技能ID
   * @param {Object} options - 額外選項
   * @returns {Object} 執行結果
   */
  async executeSkill(tenantName, skillId, options = {}) {
    console.log(`🎯 嘗試執行技能: ${skillId} (租客: ${tenantName})`);

    this.stats.totalSkillsExecuted++;

    try {
      // 階段1: 預處理和驗證
      const context = await this.prepareExecutionContext(
        tenantName,
        skillId,
        options
      );
      const validationResult = this.validateSkillExecution(context);

      if (!validationResult.valid) {
        this.stats.failedExecutions++;
        return {
          success: false,
          reason: validationResult.reason,
          message: validationResult.message,
        };
      }

      // 階段2: 執行技能
      const executor = this.skillExecutors.get(skillId);
      const executionResult = await executor.execute(context);

      // 階段3: 後處理
      this.postProcessExecution(context, executionResult);

      this.stats.successfulExecutions++;

      // 發送技能執行事件
      this.dispatchEvent(
        new CustomEvent("skillExecuted", {
          detail: {
            tenantName,
            skillId,
            skillName: context.skill.name,
            result: executionResult,
            context,
          },
        })
      );

      return {
        success: true,
        result: executionResult,
        effects: executionResult.effects || [],
      };
    } catch (error) {
      console.error(`❌ 技能執行失敗 (${skillId}):`, error);
      this.stats.failedExecutions++;

      return {
        success: false,
        reason: "execution_error",
        message: error.message,
      };
    }
  }

  /**
   * 準備執行上下文
   */
  async prepareExecutionContext(tenantName, skillId, options) {
    const tenant = this.findTenantByName(tenantName);
    const skillConfig = this.getSkillConfig(skillId);

    const context = {
      tenant,
      skill: skillConfig,
      gameState: this.gameState,
      gameHelpers: this.gameHelpers,
      options,
      trigger: options.trigger || null,
      passive: options.passive || false,
      timestamp: Date.now(),
      executionId: `exec_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
    };

    return context;
  }

  /**
   * 驗證技能執行
   */
  validateSkillExecution(context) {
    for (const validator of this.validationChain) {
      const result = validator.validate(context);
      if (!result.valid) {
        console.warn(
          `⚠️ 技能驗證失敗 (${validator.constructor.name}): ${result.message}`
        );
        return result;
      }
    }

    return { valid: true };
  }

  /**
   * 後處理執行結果
   */
  postProcessExecution(context, executionResult) {
    // 記錄執行歷史
    this.recordExecutionHistory(context, executionResult);

    // 更新冷卻時間
    this.cooldownManager.setSkillCooldown(
      context.tenant.name,
      context.skill.id,
      context.skill.cooldown || 0
    );

    // 如果是永久性技能，標記為已使用
    if (context.skill.cooldown === -1) {
      const usageKey = `${context.tenant.name}_${context.skill.id}_used`;
      context.gameState[usageKey] = (context.gameState[usageKey] || 0) + 1;
    }

    console.log(`✅ 技能執行完成: ${context.skill.name}`);
  }

  /**
   * 取得租客可用技能
   * @param {string} tenantName - 租客姓名
   * @returns {Array} 可用技能列表
   */
  getAvailableSkills(tenantName) {
    const tenant = this.findTenantByName(tenantName);
    if (!tenant) {
      console.warn(`⚠️ 找不到租客: ${tenantName}`);
      return [];
    }

    const tenantTypeId = tenant.typeId || tenant.type;
    const tenantSkills = this.skillRegistry.get(tenantTypeId) || [];

    return tenantSkills
      .filter((skill) => {
        // 1. 過濾被動技能 - 被動技能不應在手動技能選單中顯示
        if (skill.type === "passive") {
          return false;
        }

        // 2. 檢查基本可用性
        if (!this.isSkillAvailable(skill, tenant)) {
          return false;
        }

        // 3. 檢查特殊需求條件
        if (!this.checkSkillRequirements(skill, tenant)) {
          return false;
        }

        return true;
      })
      .map((skill) => ({
        ...skill,
        cooldownRemaining: this.cooldownManager.getCooldownRemaining(
          tenant.name,
          skill.id
        ),
        canAfford: this.costCalculator.canAffordCost(
          skill.cost || {},
          this.gameState
        ),
        usageCount: this.getSkillUsageCount(tenant.name, skill.id),
      }));
  }

  /**
   * 檢查技能是否可用
   */
  isSkillAvailable(skill, tenant) {
    // 1. 檢查冷卻時間
    if (this.cooldownManager.isOnCooldown(tenant.name, skill.id)) {
      return false;
    }

    // 2. 檢查使用次數限制
    if (
      skill.maxUses &&
      this.getSkillUsageCount(tenant.name, skill.id) >= skill.maxUses
    ) {
      return false;
    }

    // 3. 檢查成本
    if (!this.costCalculator.canAffordCost(skill.cost || {}, this.gameState)) {
      return false;
    }

    // 4. 檢查租客健康狀態
    if (tenant.infected) {
      return false;
    }

    return true;
  }

  /**
   * 檢查技能需求
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
        return Math.random() < condition.chance;
      default:
        console.warn(`⚠️ 未知的條件類型: ${condition.type}`);
        return false;
    }
  }

  checkTenantTypeCondition(condition, context) {
    const { value, count = 1 } = condition;

    if (value === "infected") {
      const infectedCount = this.gameState.rooms.filter(
        (room) => room.tenant && room.tenant.infected
      ).length;
      return infectedCount >= count;
    }

    if (value === "any") {
      const tenantCount = this.gameState.rooms.filter(
        (room) => room.tenant
      ).length;
      return tenantCount >= count;
    }

    const typeCount = this.gameState.rooms.filter(
      (room) =>
        room.tenant &&
        (room.tenant.typeId === value || room.tenant.type === value)
    ).length;
    return typeCount >= count;
  }

  checkResourceCondition(condition, context) {
    const { resource, amount } = condition;
    return (context.gameState.resources[resource] || 0) >= amount;
  }

  checkGameStateCondition(condition, context) {
    const { path, operator, value } = condition;

    switch (path) {
      case "rooms":
        if (operator === "hasNeedsRepair") {
          return this.gameState.rooms.some((room) => room.needsRepair);
        }
        if (operator === "hasUnReinforced") {
          return this.gameState.rooms.some(
            (room) => room.tenant && !room.reinforced
          );
        }
        break;

      default:
        const actualValue = this.getNestedValue(this.gameState, path);
        return this.compareValues(actualValue, operator, value);
    }

    return false;
  }

  /**
   * 檢查觸發條件
   */
  checkTriggerCondition(condition, context) {
    const { value } = condition;
    const { trigger } = context.options || {};

    // 直接匹配觸發器名稱
    return trigger === value;
  }

  /**
   * 處理被動技能
   * @param {string} trigger - 觸發條件
   * @param {Object} context - 上下文
   */
  processPassiveSkills(trigger, context = {}) {
    if (!this.initialized) {
      console.warn("⚠️ SkillSystem 未初始化，跳過被動技能處理");
      return;
    }

    const passiveSkills = [];

    // 收集所有租客的被動技能
    this.gameState.rooms.forEach((room) => {
      if (room.tenant && !room.tenant.infected) {
        const tenantTypeId = room.tenant.typeId || room.tenant.type;
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

    // 執行觸發的被動技能
    passiveSkills.forEach(async ({ tenant, skill }) => {
      try {
        this.stats.passiveTriggered++;
        await this.executeSkill(tenant.name, skill.id, {
          passive: true,
          trigger,
          context,
        });
      } catch (error) {
        console.error(`❌ 被動技能執行錯誤:`, error);
      }
    });

    if (passiveSkills.length > 0) {
      console.log(
        `🔄 觸發了 ${passiveSkills.length} 個被動技能 (觸發器: ${trigger})`
      );
    }
  }

  /**
   * 檢查被動技能是否被觸發
   */
  isPassiveTriggered(skill, trigger, context) {
    if (!skill.requirements || !skill.requirements.conditions) return false;

    return skill.requirements.conditions.some((condition) => {
      if (condition.type === "trigger") {
        return condition.value === trigger;
      }

      // 保留原有邏輯（向後相容）
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
        return Math.random() < condition.chance;
      }
      return false;
    });
  }

  // =============== 工具方法 ===============

  findTenantByName(name) {
    const room = this.gameState.rooms.find(
      (r) => r.tenant && r.tenant.name === name
    );
    return room ? room.tenant : null;
  }

  getSkillConfig(skillId) {
    for (const [tenantType, skills] of this.skillRegistry) {
      const skill = skills.find((s) => s.id === skillId);
      if (skill) return skill;
    }
    return null;
  }

  getSkillUsageCount(tenantName, skillId) {
    return this.executionHistory.filter(
      (record) => record.tenantName === tenantName && record.skillId === skillId
    ).length;
  }

  recordExecutionHistory(context, result) {
    this.executionHistory.push({
      executionId: context.executionId,
      tenantName: context.tenant.name,
      skillId: context.skill.id,
      timestamp: context.timestamp,
      day: this.gameState.day,
      success: result.success !== false,
      effects: result.effects || [],
    });

    // 限制歷史記錄大小
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-50);
    }
  }

  getNestedValue(obj, path) {
    return path
      .split(".")
      .reduce((current, key) => current && current[key], obj);
  }

  compareValues(actual, operator, expected) {
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
   */
  initializeFallbackSystem() {
    console.log("🔄 初始化後備技能系統");
    // 基本的後備實作，使用內建技能資料
    this.skillRegistry.set("doctor", this.getFallbackSkills("doctor"));
    this.skillRegistry.set("worker", this.getFallbackSkills("worker"));
    this.skillRegistry.set("farmer", this.getFallbackSkills("farmer"));

    this.initialized = true;
    this.status.initialized = true;
  }

  getFallbackSkills(type) {
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
    };

    return fallbackSkills[type] || [];
  }

  /**
   * 取得系統狀態
   */
  getStatus() {
    return {
      ...this.status,
      skillRegistrySize: this.skillRegistry.size,
      skillExecutorsSize: this.skillExecutors.size,
      effectHandlersSize: this.effectHandlers.size,
      stats: { ...this.stats },
      executionHistorySize: this.executionHistory.length,
    };
  }

  /**
   * 取得系統統計
   */
  getStats() {
    return {
      ...this.stats,
      successRate:
        this.stats.totalSkillsExecuted > 0
          ? (
              (this.stats.successfulExecutions /
                this.stats.totalSkillsExecuted) *
              100
            ).toFixed(1) + "%"
          : "0%",
    };
  }
}

// =============== 技能執行器 ===============

class BaseSkillExecutor {
  constructor(skillConfig, skillSystem) {
    this.skillConfig = skillConfig;
    this.skillSystem = skillSystem;
  }

  async execute(context) {
    console.log(`⚡ 執行技能: ${this.skillConfig.name}`);

    // 扣除成本
    const costResult = this.payCost(context);

    // 執行效果
    const effects = await this.executeEffects(context);

    return {
      success: true,
      skillId: this.skillConfig.id,
      effects,
      cost: costResult,
    };
  }

  payCost(context) {
    const cost = this.skillConfig.cost || {};
    return this.skillSystem.costCalculator.payCost(
      cost,
      context.gameState,
      context.tenant
    );
  }

  async executeEffects(context) {
    const effects = this.skillConfig.effects || [];
    const results = [];

    for (const effect of effects) {
      try {
        const handler = this.skillSystem.effectHandlers.get(effect.type);
        if (handler) {
          const result = await handler.handle(effect, context);
          results.push(result);
        } else {
          console.warn(`⚠️ 未知的效果類型: ${effect.type}`);
          results.push({ type: "unknown", effect });
        }
      } catch (error) {
        console.error(`❌ 效果執行錯誤:`, error);
        results.push({ type: "error", error: error.message });
      }
    }

    return results;
  }
}

class ActiveSkillExecutor extends BaseSkillExecutor {
  async execute(context) {
    // 主動技能的特殊邏輯
    const result = await super.execute(context);

    // 記錄主動技能的使用
    this.skillSystem.dispatchEvent(
      new CustomEvent("activeSkillUsed", {
        detail: {
          tenant: context.tenant,
          skill: this.skillConfig,
          result,
        },
      })
    );

    return result;
  }
}

class PassiveSkillExecutor extends BaseSkillExecutor {
  async execute(context) {
    // 被動技能通常不需要成本
    const effects = await this.executeEffects(context);

    this.skillSystem.dispatchEvent(
      new CustomEvent("passiveSkillTriggered", {
        detail: {
          tenant: context.tenant,
          skill: this.skillConfig,
          trigger: context.options.trigger,
          effects,
        },
      })
    );

    return {
      success: true,
      skillId: this.skillConfig.id,
      effects,
      passive: true,
    };
  }
}

class SpecialSkillExecutor extends BaseSkillExecutor {
  async execute(context) {
    // 特殊技能可能有額外的限制和效果
    const result = await super.execute(context);

    // 標記特殊技能已使用（如果有使用次數限制）
    if (this.skillConfig.maxUses) {
      const usageKey = `${context.tenant.name}_${this.skillConfig.id}_used`;
      context.gameState[usageKey] = (context.gameState[usageKey] || 0) + 1;
    }

    this.skillSystem.dispatchEvent(
      new CustomEvent("specialSkillUsed", {
        detail: {
          tenant: context.tenant,
          skill: this.skillConfig,
          result,
          permanentEffect: this.skillConfig.cooldown === -1,
        },
      })
    );

    return result;
  }
}

// =============== 冷卻管理器 ===============

class CooldownManager {
  constructor() {
    this.cooldowns = new Map(); // tenantName_skillId -> expireDay
  }

  setSkillCooldown(tenantName, skillId, cooldownDays) {
    if (cooldownDays > 0) {
      const key = `${tenantName}_${skillId}`;
      const expireDay = (window.gameState?.day || 1) + cooldownDays;
      this.cooldowns.set(key, expireDay);
    }
  }

  isOnCooldown(tenantName, skillId) {
    const key = `${tenantName}_${skillId}`;
    const expireDay = this.cooldowns.get(key);

    if (!expireDay) return false;

    const currentDay = window.gameState?.day || 1;
    if (currentDay >= expireDay) {
      this.cooldowns.delete(key);
      return false;
    }

    return true;
  }

  getCooldownRemaining(tenantName, skillId) {
    const key = `${tenantName}_${skillId}`;
    const expireDay = this.cooldowns.get(key);

    if (!expireDay) return 0;

    const currentDay = window.gameState?.day || 1;
    return Math.max(0, expireDay - currentDay);
  }
}

// =============== 成本計算器 ===============

class CostCalculator {
  canAffordCost(cost, gameState) {
    return Object.keys(cost).every((resource) => {
      if (resource === "cash") {
        return gameState.resources.cash >= cost[resource];
      } else {
        return (gameState.resources[resource] || 0) >= cost[resource];
      }
    });
  }

  payCost(cost, gameState, tenant) {
    let totalPayment = 0;
    const paid = {};

    Object.keys(cost).forEach((resource) => {
      const amount = cost[resource];

      if (resource === "cash") {
        gameState.resources.cash -= amount;
        totalPayment += amount;
      } else {
        gameState.resources[resource] -= amount;
      }

      paid[resource] = amount;
    });

    // 支付工資給租客
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
      if (resource === "cash") {
        return context.gameState.resources.cash >= cost[resource];
      } else {
        return (context.gameState.resources[resource] || 0) >= cost[resource];
      }
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

class CooldownValidator extends SkillValidator {
  constructor(cooldownManager) {
    super();
    this.cooldownManager = cooldownManager;
  }

  validate(context) {
    if (
      this.cooldownManager.isOnCooldown(context.tenant.name, context.skill.id)
    ) {
      const remaining = this.cooldownManager.getCooldownRemaining(
        context.tenant.name,
        context.skill.id
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
  constructor(skillSystem) {
    super();
    this.skillSystem = skillSystem;
  }

  validate(context) {
    if (
      !this.skillSystem.checkSkillRequirements(context.skill, context.tenant, context)
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

class EffectHandler {
  async handle(effect, context) {
    throw new Error("EffectHandler.handle() must be implemented");
  }
}

class ResourceModificationHandler extends EffectHandler {
  async handle(effect, context) {
    const { resource, amount } = effect;
    const oldValue = context.gameState.resources[resource] || 0;
    context.gameState.resources[resource] = Math.max(0, oldValue + amount);

    return {
      type: "resource_modified",
      resource,
      amount,
      oldValue,
      newValue: context.gameState.resources[resource],
    };
  }
}

class StateModificationHandler extends EffectHandler {
  async handle(effect, context) {
    const { path, value, operation = "set" } = effect;
    const oldValue = this.getNestedValue(context.gameState, path);

    switch (operation) {
      case "set":
        this.setNestedValue(context.gameState, path, value);
        break;
      case "add":
        this.setNestedValue(context.gameState, path, oldValue + value);
        break;
    }

    return {
      type: "state_modified",
      path,
      oldValue,
      newValue: this.getNestedValue(context.gameState, path),
    };
  }

  getNestedValue(obj, path) {
    return path
      .split(".")
      .reduce((current, key) => current && current[key], obj);
  }

  setNestedValue(obj, path, value) {
    const keys = path.split(".");
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}

class TenantHealingHandler extends EffectHandler {
  async handle(effect, context) {
    const infectedTenants = context.gameState.rooms
      .filter((room) => room.tenant && room.tenant.infected)
      .map((room) => room.tenant);

    if (infectedTenants.length > 0) {
      const patient =
        infectedTenants[Math.floor(Math.random() * infectedTenants.length)];
      patient.infected = false;

      // 發送治療事件
      context.skillSystem?.dispatchEvent(
        new CustomEvent("tenantHealed", {
          detail: { patient: patient.name, healer: context.tenant.name },
        })
      );

      return {
        type: "tenant_healed",
        patient: patient.name,
        healer: context.tenant.name,
      };
    }

    return { type: "no_target", message: "沒有需要治療的租客" };
  }
}

class RoomRepairHandler extends EffectHandler {
  async handle(effect, context) {
    const needRepairRooms = context.gameState.rooms.filter(
      (r) => r.needsRepair
    );

    if (needRepairRooms.length > 0) {
      const room = needRepairRooms[0];
      room.needsRepair = false;

      return {
        type: "room_repaired",
        roomId: room.id,
        repairer: context.tenant.name,
      };
    }

    return { type: "no_target", message: "沒有需要維修的房間" };
  }
}

class RoomReinforcementHandler extends EffectHandler {
  async handle(effect, context) {
    const unReinforcedRooms = context.gameState.rooms.filter(
      (room) => room.tenant && !room.reinforced
    );

    if (unReinforcedRooms.length > 0) {
      const room = unReinforcedRooms[0];
      room.reinforced = true;

      return {
        type: "room_reinforced",
        roomId: room.id,
        worker: context.tenant.name,
      };
    }

    return { type: "no_target", message: "沒有可加固的房間" };
  }
}

class AutoRepairHandler extends EffectHandler {
  async handle(effect, context) {
    const damagedRooms = context.gameState.rooms.filter((r) => r.needsRepair);

    if (damagedRooms.length > 0) {
      const room =
        damagedRooms[Math.floor(Math.random() * damagedRooms.length)];
      room.needsRepair = false;

      return {
        type: "auto_repair",
        roomId: room.id,
        worker: context.tenant.name,
      };
    }

    return { type: "no_target" };
  }
}

class LogMessageHandler extends EffectHandler {
  async handle(effect, context) {
    const { message, logType = "skill" } = effect;

    if (typeof window.addLog === "function") {
      window.addLog(message, logType);
    }

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
    console.log(`🎲 觸發事件: ${eventId}`);

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
    console.log(`⏰ 排程效果將在 ${delay} 天後執行`);

    return {
      type: "effect_scheduled",
      delay,
      executeDay: context.gameState.day + delay,
    };
  }
}

// 租客相關效果處理器（與 TenantSystem 協作）

class TenantRemovalHandler extends EffectHandler {
  async handle(effect, context) {
    const { target } = effect;

    // 發送租客移除請求事件
    context.skillSystem?.dispatchEvent(
      new CustomEvent("requestTenantRemoval", {
        detail: {
          target,
          reason: "skill_effect",
          requestedBy: context.tenant.name,
        },
      })
    );

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
    context.skillSystem?.dispatchEvent(
      new CustomEvent("improveTenantSatisfaction", {
        detail: { target, amount, source: context.tenant.name },
      })
    );

    return {
      type: "satisfaction_improved",
      target,
      amount,
      source: context.tenant.name,
    };
  }
}

class InfectionDetectionHandler extends EffectHandler {
  async handle(effect, context) {
    const { targets, probability } = effect;

    // 發送感染檢測事件
    context.skillSystem?.dispatchEvent(
      new CustomEvent("detectInfection", {
        detail: { targets, probability, detector: context.tenant.name },
      })
    );

    return {
      type: "infection_detection",
      targets,
      probability,
      detector: context.tenant.name,
    };
  }
}

class InfectionRevealHandler extends EffectHandler {
  async handle(effect, context) {
    const { targets } = effect;

    // 發送感染揭露事件
    context.skillSystem?.dispatchEvent(
      new CustomEvent("revealInfection", {
        detail: { targets, revealer: context.tenant.name },
      })
    );

    return {
      type: "infection_revealed",
      targets,
      revealer: context.tenant.name,
    };
  }
}

export default SkillSystem;

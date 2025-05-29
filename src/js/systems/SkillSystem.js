/**
 * SkillSystem - 技能執行與效果管理系統
 *
 * 架構設計原則：
 * 1. 命令模式：每個技能執行都是一個可撤銷的命令
 * 2. 裝飾器模式：技能效果可以組合和疊加
 * 3. 工廠模式：統一建立不同類型的技能執行器
 * 4. 責任鏈模式：技能執行的驗證鏈和效果鏈
 */

class SkillSystem {
  constructor(gameStateRef, dataManager, ruleEngine) {
    this.gameState = gameStateRef;
    this.dataManager = dataManager;
    this.ruleEngine = ruleEngine;

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

    // 初始化系統
    this.initializeSystem();
  }

  /**
   * 初始化技能系統
   */
  async initializeSystem() {
    try {
      // 載入技能配置
      await this.loadSkillConfigurations();

      // 註冊內建效果處理器
      this.registerBuiltinEffectHandlers();

      // 建立驗證鏈
      this.buildValidationChain();

      console.log("✅ SkillSystem 初始化完成");
    } catch (error) {
      console.error("❌ SkillSystem 初始化失敗:", error);
      this.initializeFallbackSystem();
    }
  }

  /**
   * 載入技能配置
   */
  async loadSkillConfigurations() {
    const skillConfigs = this.dataManager.getCachedData("skills");
    if (!skillConfigs) {
      throw new Error("技能配置不可用");
    }

    // 建立技能註冊表
    Object.entries(skillConfigs).forEach(([tenantType, skills]) => {
      this.skillRegistry.set(tenantType, skills);

      // 為每個技能建立執行器
      skills.forEach((skillConfig) => {
        const executor = this.createSkillExecutor(skillConfig);
        this.skillExecutors.set(skillConfig.id, executor);
      });
    });

    console.log(`📋 載入了 ${this.skillExecutors.size} 個技能配置`);
  }

  /**
   * 建立技能執行器
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
      new CooldownValidator(),
      new RequirementValidator(),
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

    try {
      // 階段1: 預處理和驗證
      const context = await this.prepareExecutionContext(
        tenantName,
        skillId,
        options
      );
      const validationResult = this.validateSkillExecution(context);

      if (!validationResult.valid) {
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

      return {
        success: true,
        result: executionResult,
        effects: executionResult.effects || [],
      };
    } catch (error) {
      console.error(`❌ 技能執行失敗 (${skillId}):`, error);
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
      options,
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

    // 觸發執行完成事件
    this.emitSkillExecutionEvent(context, executionResult);

    // 更新顯示（如果可用）
    if (typeof window.updateDisplay === "function") {
      window.updateDisplay();
    }
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

    const tenantSkills = this.skillRegistry.get(tenant.type) || [];

    return tenantSkills
      .filter((skill) => {
        const context = { tenant, skill, gameState: this.gameState };
        return this.isSkillAvailable(context);
      })
      .map((skill) => ({
        ...skill,
        cooldownRemaining: this.cooldownManager.getCooldownRemaining(
          tenantName,
          skill.id
        ),
        canAfford: this.costCalculator.canAffordCost(
          skill.cost || {},
          this.gameState
        ),
        usageCount: this.getSkillUsageCount(tenantName, skill.id),
      }));
  }

  /**
   * 檢查技能是否可用
   */
  isSkillAvailable(context) {
    const { tenant, skill } = context;

    // 檢查冷卻時間
    if (this.cooldownManager.isOnCooldown(tenant.name, skill.id)) {
      return false;
    }

    // 檢查使用次數限制
    if (
      skill.maxUses &&
      this.getSkillUsageCount(tenant.name, skill.id) >= skill.maxUses
    ) {
      return false;
    }

    // 檢查成本
    if (!this.costCalculator.canAffordCost(skill.cost || {}, this.gameState)) {
      return false;
    }

    // 檢查需求條件
    if (
      skill.requirements &&
      !this.checkSkillRequirements(skill.requirements, context)
    ) {
      return false;
    }

    return true;
  }

  /**
   * 檢查技能需求
   */
  checkSkillRequirements(requirements, context) {
    if (!requirements.conditions) return true;

    return requirements.conditions.every((condition) => {
      return this.evaluateCondition(condition, context);
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

    const typeCount = this.gameState.rooms.filter(
      (room) => room.tenant && room.tenant.type === value
    ).length;
    return typeCount >= count;
  }

  checkResourceCondition(condition, context) {
    const { resource, amount } = condition;
    return (context.gameState.resources[resource] || 0) >= amount;
  }

  checkGameStateCondition(condition, context) {
    const { path, operator, value } = condition;
    const actualValue = this.getNestedValue(context.gameState, path);
    return this.compareValues(actualValue, operator, value);
  }

  /**
   * 處理被動技能
   * @param {string} trigger - 觸發條件
   * @param {Object} context - 上下文
   */
  processPassiveSkills(trigger, context = {}) {
    const passiveSkills = [];

    // 收集所有租客的被動技能
    this.gameState.rooms.forEach((room) => {
      if (room.tenant && !room.tenant.infected) {
        const tenantSkills = this.skillRegistry.get(room.tenant.type) || [];
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
        await this.executeSkill(tenant.name, skill.id, {
          passive: true,
          trigger,
        });
      } catch (error) {
        console.error(`❌ 被動技能執行錯誤:`, error);
      }
    });
  }

  /**
   * 檢查被動技能是否被觸發
   */
  isPassiveTriggered(skill, trigger, context) {
    if (!skill.requirements || !skill.requirements.conditions) return false;

    return skill.requirements.conditions.some((condition) => {
      if (
        condition.type === "gameStateCheck" &&
        condition.path === "currentAction"
      ) {
        return condition.value === trigger;
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
    const executor = this.skillExecutors.get(skillId);
    return executor ? executor.skillConfig : null;
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

  emitSkillExecutionEvent(context, result) {
    const eventData = {
      tenant: context.tenant,
      skill: context.skill,
      result,
      timestamp: context.timestamp,
    };

    // 這裡可以與EventSystem整合
    if (typeof window.skillExecutionEvent === "function") {
      window.skillExecutionEvent(eventData);
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

  initializeFallbackSystem() {
    console.log("🔄 初始化後備技能系統");
    // 基本的後備實作
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
    if (typeof window.addLog === "function") {
      window.addLog(
        `${context.tenant.name} 使用了技能：${this.skillConfig.name}`,
        "skill"
      );
    }

    return result;
  }
}

class PassiveSkillExecutor extends BaseSkillExecutor {
  async execute(context) {
    // 被動技能通常不需要成本
    const effects = await this.executeEffects(context);

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
  validate(context) {
    // 這裡需要存取SkillSystem的cooldownManager
    // 簡化實作，假設冷卻檢查在別處進行
    return { valid: true };
  }
}

class RequirementValidator extends SkillValidator {
  validate(context) {
    // 需求條件的驗證邏輯
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

      if (typeof window.addLog === "function") {
        window.addLog(`${context.tenant.name} 治癒了 ${patient.name}`, "skill");
      }

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

      if (typeof window.addLog === "function") {
        window.addLog(`${context.tenant.name} 維修了房間 ${room.id}`, "skill");
      }

      return {
        type: "room_repaired",
        roomId: room.id,
        repairer: context.tenant.name,
      };
    }

    return { type: "no_target", message: "沒有需要維修的房間" };
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

// 匯出模組
if (typeof window !== "undefined") {
  window.SkillSystem = SkillSystem;
}

export default SkillSystem;

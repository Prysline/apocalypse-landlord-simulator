/**
 * RuleEngine - 通用規則執行引擎
 * 職責：
 * 1. 執行可配置的遊戲規則
 * 2. 處理條件判斷與效果執行
 * 3. 管理規則優先級與依賴關係
 * 4. 提供規則執行的追蹤與除錯機制
 *
 * 設計模式：命令模式 + 策略模式 + 責任鏈模式
 * 核心特性：聲明式規則定義、條件驗證、效果執行、執行歷史追蹤
 */

export class RuleEngine {
  constructor(gameStateRef) {
    this.gameState = gameStateRef;

    // 規則管理系統
    this.rules = new Map(); // ruleId -> RuleDefinition
    this.ruleGroups = new Map(); // groupName -> Set<ruleId>
    this.executionHistory = [];
    this.maxHistorySize = 100;

    // 條件檢查器註冊表（策略模式）
    this.conditionCheckers = new Map();

    // 效果執行器註冊表（命令模式）
    this.effectExecutors = new Map();

    // 執行統計
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      conditionFailures: 0,
      effectErrors: 0,
    };

    // 初始化內建系統
    this.registerBuiltinConditions();
    this.registerBuiltinEffects();
  }

  /**
   * 註冊內建條件檢查器
   * 使用策略模式，每種條件類型對應一個檢查策略
   */
  registerBuiltinConditions() {
    // 資源檢查策略
    this.conditionCheckers.set("hasResource", (condition, gameState) => {
      const { resource, amount, operator = ">=" } = condition;
      const currentAmount = gameState.resources[resource] || 0;

      switch (operator) {
        case ">=":
          return currentAmount >= amount;
        case ">":
          return currentAmount > amount;
        case "<=":
          return currentAmount <= amount;
        case "<":
          return currentAmount < amount;
        case "==":
          return currentAmount === amount;
        default:
          return currentAmount >= amount;
      }
    });

    // 租客類型檢查策略
    this.conditionCheckers.set("hasTenantType", (condition, gameState) => {
      const { type, count = 1, includeInfected = false } = condition;

      const tenants = gameState.rooms.filter((room) => {
        if (!room.tenant) return false;
        if (!includeInfected && room.tenant.infected) return false;
        return room.tenant.type === type || room.tenant.typeId === type;
      });

      return tenants.length >= count;
    });

    // 時間條件檢查策略
    this.conditionCheckers.set("dayRange", (condition, gameState) => {
      const { min = 0, max = Infinity } = condition;
      return gameState.day >= min && gameState.day <= max;
    });

    // 機率檢查策略
    this.conditionCheckers.set("probability", (condition, gameState) => {
      const { chance } = condition;
      return Math.random() < chance;
    });

    // 複合條件 - AND 邏輯
    this.conditionCheckers.set("and", (condition, gameState) => {
      return condition.conditions.every((cond) =>
        this.checkCondition(cond, gameState)
      );
    });

    // 複合條件 - OR 邏輯
    this.conditionCheckers.set("or", (condition, gameState) => {
      return condition.conditions.some((cond) =>
        this.checkCondition(cond, gameState)
      );
    });

    // 遊戲狀態檢查策略
    this.conditionCheckers.set("gameStateCheck", (condition, gameState) => {
      const { path, operator, value } = condition;
      const actualValue = this.getNestedValue(gameState, path);
      return this.compareValues(actualValue, operator, value);
    });

    // 資源稀缺性檢查策略
    this.conditionCheckers.set("resourceScarcity", (condition, gameState) => {
      const { resource, threshold } = condition;
      const currentAmount = gameState.resources[resource] || 0;

      // 基於閾值類型計算稀缺性
      switch (threshold) {
        case "critical":
          return currentAmount < 5;
        case "low":
          return currentAmount < 10;
        case "insufficient":
          return currentAmount < 15;
        default:
          return false;
      }
    });

    // 建築狀態檢查策略
    this.conditionCheckers.set("buildingState", (condition, gameState) => {
      const { property, operator, value } = condition;

      switch (property) {
        case "hasRepairNeeds":
          return gameState.rooms.some((room) => room.needsRepair);
        case "reinforcedCount":
          const reinforcedCount = gameState.rooms.filter(
            (room) => room.reinforced
          ).length;
          return this.compareValues(reinforcedCount, operator, value);
        case "occupancyRate":
          const occupied = gameState.rooms.filter((room) => room.tenant).length;
          const total = gameState.rooms.length;
          const rate = total > 0 ? occupied / total : 0;
          return this.compareValues(rate, operator, value);
        default:
          return false;
      }
    });
  }

  /**
   * 註冊內建效果執行器
   * 使用命令模式，每種效果類型對應一個執行命令
   */
  registerBuiltinEffects() {
    // 資源修改命令
    this.effectExecutors.set("modifyResource", (effect, gameState) => {
      const { resource, amount, operation = "add" } = effect;
      const oldValue = gameState.resources[resource] || 0;
      let newValue;

      switch (operation) {
        case "add":
          newValue = Math.max(0, oldValue + amount);
          break;
        case "set":
          newValue = Math.max(0, amount);
          break;
        case "multiply":
          newValue = Math.max(0, oldValue * amount);
          break;
        default:
          newValue = Math.max(0, oldValue + amount);
      }

      gameState.resources[resource] = newValue;

      return {
        type: "resource",
        resource,
        operation,
        oldValue,
        newValue,
        change: newValue - oldValue,
      };
    });

    // 狀態修改命令
    this.effectExecutors.set("modifyState", (effect, gameState) => {
      const { path, value, operation = "set" } = effect;
      const oldValue = this.getNestedValue(gameState, path);

      let newValue;
      switch (operation) {
        case "set":
          newValue = value;
          break;
        case "add":
          newValue = (oldValue || 0) + value;
          break;
        case "multiply":
          newValue = (oldValue || 0) * value;
          break;
        default:
          newValue = value;
      }

      this.setNestedValue(gameState, path, newValue);

      return {
        type: "state",
        path,
        operation,
        oldValue,
        newValue,
      };
    });

    // 記錄訊息命令
    this.effectExecutors.set("logMessage", (effect, gameState) => {
      const { message, logType = "event" } = effect;

      // 嘗試呼叫全域記錄函數
      if (
        typeof window !== "undefined" &&
        typeof window.addLog === "function"
      ) {
        window.addLog(message, logType);
      } else {
        console.log(`[${logType.toUpperCase()}] ${message}`);
      }

      return {
        type: "log",
        message,
        logType,
      };
    });

    // 觸發事件命令
    this.effectExecutors.set("triggerEvent", (effect, gameState) => {
      const { eventId, delay = 0, data = {} } = effect;

      if (delay === 0) {
        // 立即觸發事件
        this.executeEvent(eventId, gameState, data);
      } else {
        // 延遲觸發事件（需要與遊戲主循環整合）
        this.scheduleEvent(eventId, gameState.day + delay, data);
      }

      return {
        type: "event",
        eventId,
        delay,
        data,
      };
    });

    // 複合效果命令
    this.effectExecutors.set("multiple", (effect, gameState) => {
      const results = [];

      effect.effects.forEach((subEffect) => {
        try {
          const result = this.executeEffect(subEffect, gameState);
          results.push(result);
        } catch (error) {
          results.push({
            type: "error",
            error: error.message,
            originalEffect: subEffect,
          });
        }
      });

      return {
        type: "multiple",
        results,
        successCount: results.filter((r) => r.type !== "error").length,
        errorCount: results.filter((r) => r.type === "error").length,
      };
    });

    // 機率效果命令
    this.effectExecutors.set("probabilityCheck", (effect, gameState) => {
      const { condition, success = [], failure = [] } = effect;

      let successChance = condition.base || 0.5;

      // 處理修正值
      if (condition.modifiers) {
        condition.modifiers.forEach((modifier) => {
          if (this.checkCondition(modifier, gameState)) {
            successChance += modifier.bonus || 0;
          }
        });
      }

      // 限制機率範圍
      successChance = Math.max(0, Math.min(1, successChance));

      const isSuccess = Math.random() < successChance;
      const effectsToExecute = isSuccess ? success : failure;

      const results = effectsToExecute.map((eff) =>
        this.executeEffect(eff, gameState)
      );

      return {
        type: "probabilityCheck",
        success: isSuccess,
        chance: successChance,
        results,
      };
    });

    // 租客操作命令
    this.effectExecutors.set("tenantOperation", (effect, gameState) => {
      const { operation, target, data = {} } = effect;

      switch (operation) {
        case "heal":
          return this.healTenant(target, gameState, data);
        case "infect":
          return this.infectTenant(target, gameState, data);
        case "evict":
          return this.evictTenant(target, gameState, data);
        case "improveSatisfaction":
          return this.improveTenantSatisfaction(target, gameState, data);
        default:
          throw new Error(`未知的租客操作: ${operation}`);
      }
    });

    // 房間操作命令
    this.effectExecutors.set("roomOperation", (effect, gameState) => {
      const { operation, target, data = {} } = effect;

      switch (operation) {
        case "repair":
          return this.repairRoom(target, gameState, data);
        case "damage":
          return this.damageRoom(target, gameState, data);
        case "reinforce":
          return this.reinforceRoom(target, gameState, data);
        default:
          throw new Error(`未知的房間操作: ${operation}`);
      }
    });
  }

  /**
   * 註冊規則
   * @param {string} ruleId - 規則 ID
   * @param {Object} ruleConfig - 規則配置
   */
  registerRule(ruleId, ruleConfig) {
    // 驗證規則配置
    this.validateRuleConfig(ruleConfig);

    const rule = {
      id: ruleId,
      name: ruleConfig.name || ruleId,
      description: ruleConfig.description || "",
      priority: ruleConfig.priority || 0,
      conditions: ruleConfig.conditions || [],
      effects: ruleConfig.effects || [],
      group: ruleConfig.group || "default",
      enabled: ruleConfig.enabled !== false,
      cooldown: ruleConfig.cooldown || 0,
      lastExecuted: 0,
      maxExecutions: ruleConfig.maxExecutions || Infinity,
      executionCount: 0,
    };

    this.rules.set(ruleId, rule);

    // 添加到群組
    if (!this.ruleGroups.has(rule.group)) {
      this.ruleGroups.set(rule.group, new Set());
    }
    this.ruleGroups.get(rule.group).add(ruleId);

    console.log(`📋 註冊規則: ${ruleId} (群組: ${rule.group})`);
    return rule;
  }

  /**
   * 驗證規則配置
   */
  validateRuleConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("規則配置必須是物件");
    }

    if (config.conditions && !Array.isArray(config.conditions)) {
      throw new Error("規則條件必須是陣列");
    }

    if (config.effects && !Array.isArray(config.effects)) {
      throw new Error("規則效果必須是陣列");
    }

    if (config.priority !== undefined && typeof config.priority !== "number") {
      throw new Error("規則優先級必須是數值");
    }
  }

  /**
   * 執行指定規則
   * @param {string} ruleId - 規則 ID
   * @param {Object} context - 執行上下文
   */
  executeRule(ruleId, context = {}) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      console.warn(`⚠️ 規則不存在: ${ruleId}`);
      return { executed: false, reason: "rule_not_found" };
    }

    if (!rule.enabled) {
      return { executed: false, reason: "rule_disabled" };
    }

    // 檢查執行次數限制
    if (rule.executionCount >= rule.maxExecutions) {
      return { executed: false, reason: "max_executions_reached" };
    }

    // 檢查冷卻時間
    if (rule.cooldown > 0) {
      const timeSinceLastExecution = this.gameState.day - rule.lastExecuted;
      if (timeSinceLastExecution < rule.cooldown) {
        return {
          executed: false,
          reason: "cooldown_active",
          remainingCooldown: rule.cooldown - timeSinceLastExecution,
        };
      }
    }

    // 檢查條件
    const conditionResult = this.checkAllConditions(rule.conditions, context);
    if (!conditionResult.passed) {
      this.executionStats.conditionFailures++;
      return {
        executed: false,
        reason: "conditions_not_met",
        failedConditions: conditionResult.failedConditions,
      };
    }

    // 執行效果
    const results = [];
    let hasErrors = false;

    rule.effects.forEach((effect, index) => {
      try {
        const result = this.executeEffect(effect, this.gameState);
        results.push(result);
      } catch (error) {
        console.error(`❌ 規則 ${ruleId} 效果 ${index} 執行失敗:`, error);
        results.push({
          type: "error",
          error: error.message,
          effectIndex: index,
          originalEffect: effect,
        });
        hasErrors = true;
        this.executionStats.effectErrors++;
      }
    });

    // 更新執行記錄
    rule.lastExecuted = this.gameState.day;
    rule.executionCount++;
    this.executionStats.totalExecutions++;

    if (hasErrors) {
      this.executionStats.failedExecutions++;
    } else {
      this.executionStats.successfulExecutions++;
    }

    this.addExecutionHistory(ruleId, rule.name, results, context);

    return {
      executed: true,
      results,
      hasErrors,
      executionCount: rule.executionCount,
    };
  }

  /**
   * 執行規則群組
   * @param {string} groupName - 群組名稱
   * @param {Object} context - 執行上下文
   */
  executeRuleGroup(groupName, context = {}) {
    const ruleIds = this.ruleGroups.get(groupName);
    if (!ruleIds) {
      console.warn(`⚠️ 規則群組不存在: ${groupName}`);
      return { executed: 0, results: [] };
    }

    // 按優先級排序規則
    const sortedRules = Array.from(ruleIds)
      .map((id) => this.rules.get(id))
      .filter((rule) => rule && rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    const results = [];
    let executedCount = 0;

    sortedRules.forEach((rule) => {
      const result = this.executeRule(rule.id, context);
      if (result.executed) {
        results.push({ ruleId: rule.id, ...result });
        executedCount++;
      }
    });

    console.log(
      `📊 群組 ${groupName} 執行完成: ${executedCount}/${sortedRules.length} 規則執行`
    );

    return {
      executed: executedCount,
      total: sortedRules.length,
      results,
    };
  }

  /**
   * 檢查所有條件
   */
  checkAllConditions(conditions, context = {}) {
    if (!conditions || conditions.length === 0) {
      return { passed: true, failedConditions: [] };
    }

    const failedConditions = [];

    const allPassed = conditions.every((condition, index) => {
      const passed = this.checkCondition(condition, context);
      if (!passed) {
        failedConditions.push({ index, condition });
      }
      return passed;
    });

    return {
      passed: allPassed,
      failedConditions,
      totalConditions: conditions.length,
      passedConditions: conditions.length - failedConditions.length,
    };
  }

  /**
   * 檢查單一條件
   */
  checkCondition(condition, context = {}) {
    const { type } = condition;
    const checker = this.conditionCheckers.get(type);

    if (!checker) {
      console.warn(`⚠️ 未知的條件類型: ${type}`);
      return false;
    }

    try {
      return checker(condition, { ...this.gameState, ...context });
    } catch (error) {
      console.error(`❌ 條件檢查失敗 (${type}):`, error);
      return false;
    }
  }

  /**
   * 執行效果
   */
  executeEffect(effect, gameState) {
    const { type } = effect;
    const executor = this.effectExecutors.get(type);

    if (!executor) {
      console.warn(`⚠️ 未知的效果類型: ${type}`);
      return { type: "unknown", originalEffect: effect };
    }

    try {
      return executor(effect, gameState);
    } catch (error) {
      console.error(`❌ 效果執行失敗 (${type}):`, error);
      throw error; // 重新拋出錯誤以便上層處理
    }
  }

  /**
   * 工具方法：取得嵌套物件值
   */
  getNestedValue(obj, path) {
    return path
      .split(".")
      .reduce(
        (current, key) =>
          current && current[key] !== undefined ? current[key] : undefined,
        obj
      );
  }

  /**
   * 工具方法：設定嵌套物件值
   */
  setNestedValue(obj, path, value) {
    const keys = path.split(".");
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * 工具方法：比較數值
   */
  compareValues(actual, operator, expected) {
    switch (operator) {
      case "==":
        return actual == expected;
      case "===":
        return actual === expected;
      case "!=":
        return actual != expected;
      case "!==":
        return actual !== expected;
      case ">":
        return actual > expected;
      case ">=":
        return actual >= expected;
      case "<":
        return actual < expected;
      case "<=":
        return actual <= expected;
      case "contains":
        return Array.isArray(actual) && actual.includes(expected);
      case "hasProperty":
        return actual && actual.hasOwnProperty(expected);
      default:
        return false;
    }
  }

  /**
   * 租客操作實作
   */
  healTenant(target, gameState, data) {
    const infectedTenants = gameState.rooms.filter(
      (room) => room.tenant && room.tenant.infected
    );

    if (infectedTenants.length === 0) {
      return {
        type: "tenantOperation",
        operation: "heal",
        success: false,
        reason: "no_infected_tenants",
      };
    }

    let targetTenant;
    if (target === "random") {
      targetTenant =
        infectedTenants[Math.floor(Math.random() * infectedTenants.length)];
    } else {
      targetTenant = infectedTenants.find(
        (room) => room.tenant.name === target
      );
    }

    if (targetTenant) {
      targetTenant.tenant.infected = false;
      return {
        type: "tenantOperation",
        operation: "heal",
        success: true,
        tenant: targetTenant.tenant.name,
      };
    }

    return {
      type: "tenantOperation",
      operation: "heal",
      success: false,
      reason: "target_not_found",
    };
  }

  repairRoom(target, gameState, data) {
    const needRepairRooms = gameState.rooms.filter((room) => room.needsRepair);

    if (needRepairRooms.length === 0) {
      return {
        type: "roomOperation",
        operation: "repair",
        success: false,
        reason: "no_rooms_need_repair",
      };
    }

    let targetRoom;
    if (target === "random") {
      targetRoom =
        needRepairRooms[Math.floor(Math.random() * needRepairRooms.length)];
    } else if (typeof target === "number") {
      targetRoom = gameState.rooms.find(
        (room) => room.id === target && room.needsRepair
      );
    }

    if (targetRoom) {
      targetRoom.needsRepair = false;
      return {
        type: "roomOperation",
        operation: "repair",
        success: true,
        roomId: targetRoom.id,
      };
    }

    return {
      type: "roomOperation",
      operation: "repair",
      success: false,
      reason: "target_not_found",
    };
  }

  /**
   * 添加執行歷史
   */
  addExecutionHistory(ruleId, ruleName, results, context) {
    const entry = {
      timestamp: Date.now(),
      day: this.gameState.day,
      ruleId,
      ruleName,
      results,
      context,
      gameStateSnapshot: {
        resources: { ...this.gameState.resources },
        day: this.gameState.day,
        buildingDefense: this.gameState.buildingDefense,
      },
    };

    this.executionHistory.unshift(entry);

    // 限制歷史記錄大小
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(
        0,
        this.maxHistorySize
      );
    }
  }

  /**
   * 取得執行歷史
   */
  getExecutionHistory(limit = 10) {
    return this.executionHistory.slice(0, limit);
  }

  /**
   * 清除執行歷史
   */
  clearExecutionHistory() {
    this.executionHistory = [];
    console.log("🗑️ 已清除規則執行歷史");
  }

  /**
   * 取得規則資訊
   */
  getRuleInfo(ruleId) {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    return {
      ...rule,
      nextAvailableDay: rule.lastExecuted + rule.cooldown,
      canExecute: this.canExecuteRule(ruleId),
      executionsRemaining: rule.maxExecutions - rule.executionCount,
    };
  }

  /**
   * 檢查規則是否可執行
   */
  canExecuteRule(ruleId) {
    const rule = this.rules.get(ruleId);
    if (!rule || !rule.enabled) return false;

    if (rule.executionCount >= rule.maxExecutions) return false;

    if (rule.cooldown > 0) {
      const timeSinceLastExecution = this.gameState.day - rule.lastExecuted;
      if (timeSinceLastExecution < rule.cooldown) return false;
    }

    return true;
  }

  /**
   * 取得所有規則
   */
  getAllRules() {
    return Array.from(this.rules.values()).map((rule) =>
      this.getRuleInfo(rule.id)
    );
  }

  /**
   * 啟用/停用規則
   */
  setRuleEnabled(ruleId, enabled) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      console.log(`${enabled ? "✅ 啟用" : "❌ 停用"} 規則: ${ruleId}`);
      return true;
    }
    return false;
  }

  /**
   * 取得執行統計
   */
  getExecutionStats() {
    return {
      ...this.executionStats,
      rules: {
        total: this.rules.size,
        enabled: Array.from(this.rules.values()).filter((r) => r.enabled)
          .length,
        disabled: Array.from(this.rules.values()).filter((r) => !r.enabled)
          .length,
      },
      successRate:
        this.executionStats.totalExecutions > 0
          ? (
              (this.executionStats.successfulExecutions /
                this.executionStats.totalExecutions) *
              100
            ).toFixed(2) + "%"
          : "0%",
    };
  }

  /**
   * 重置執行統計
   */
  resetExecutionStats() {
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      conditionFailures: 0,
      effectErrors: 0,
    };
    console.log("🔄 已重置執行統計");
  }

  /**
   * 除錯：印出當前狀態
   */
  debugPrint() {
    console.group("🔧 RuleEngine 狀態");
    console.log("已註冊規則:", this.rules.size);
    console.log("規則群組:", Array.from(this.ruleGroups.keys()));
    console.log("執行歷史條目:", this.executionHistory.length);
    console.log("執行統計:", this.getExecutionStats());
    console.log("條件檢查器:", Array.from(this.conditionCheckers.keys()));
    console.log("效果執行器:", Array.from(this.effectExecutors.keys()));
    console.groupEnd();
  }
}

/**
 * RuleEngine - 通用規則執行引擎
 * 職責：
 * 1. 執行可配置的遊戲規則
 * 2. 處理條件判斷與效果執行
 * 3. 管理規則優先級與依賴關係
 * 4. 提供規則執行的追蹤與除錯機制
 */
class RuleEngine {
  constructor(gameStateRef) {
    this.gameState = gameStateRef;
    this.rules = new Map();
    this.ruleGroups = new Map();
    this.executionHistory = [];
    this.maxHistorySize = 100;

    // 註冊內建條件檢查器
    this.registerBuiltinConditions();

    // 註冊內建效果執行器
    this.registerBuiltinEffects();
  }

  /**
   * 註冊內建條件檢查器
   */
  registerBuiltinConditions() {
    this.conditionCheckers = new Map();

    // 資源檢查
    this.conditionCheckers.set("hasResource", (condition, gameState) => {
      const { resource, amount } = condition;
      return (gameState.resources[resource] || 0) >= amount;
    });

    // 租客類型檢查
    this.conditionCheckers.set("hasTenantType", (condition, gameState) => {
      const { type, count = 1 } = condition;
      const tenants = gameState.rooms.filter(
        (room) =>
          room.tenant && room.tenant.type === type && !room.tenant.infected
      ).length;
      return tenants >= count;
    });

    // 時間檢查
    this.conditionCheckers.set("dayRange", (condition, gameState) => {
      const { min = 0, max = Infinity } = condition;
      return gameState.day >= min && gameState.day <= max;
    });

    // 機率檢查
    this.conditionCheckers.set("probability", (condition, gameState) => {
      const { chance } = condition;
      return Math.random() < chance;
    });

    // 複合條件 - AND
    this.conditionCheckers.set("and", (condition, gameState) => {
      return condition.conditions.every((cond) =>
        this.checkCondition(cond, gameState)
      );
    });

    // 複合條件 - OR
    this.conditionCheckers.set("or", (condition, gameState) => {
      return condition.conditions.some((cond) =>
        this.checkCondition(cond, gameState)
      );
    });

    // 狀態檢查
    this.conditionCheckers.set("gameStateCheck", (condition, gameState) => {
      const { path, operator, value } = condition;
      const actualValue = this.getNestedValue(gameState, path);
      return this.compareValues(actualValue, operator, value);
    });
  }

  /**
   * 註冊內建效果執行器
   */
  registerBuiltinEffects() {
    this.effectExecutors = new Map();

    // 資源變化
    this.effectExecutors.set("modifyResource", (effect, gameState) => {
      const { resource, amount } = effect;
      gameState.resources[resource] = Math.max(
        0,
        (gameState.resources[resource] || 0) + amount
      );
      return {
        type: "resource",
        resource,
        amount,
        newValue: gameState.resources[resource],
      };
    });

    // 狀態修改
    this.effectExecutors.set("modifyState", (effect, gameState) => {
      const { path, value, operation = "set" } = effect;
      const oldValue = this.getNestedValue(gameState, path);

      switch (operation) {
        case "set":
          this.setNestedValue(gameState, path, value);
          break;
        case "add":
          this.setNestedValue(gameState, path, oldValue + value);
          break;
        case "multiply":
          this.setNestedValue(gameState, path, oldValue * value);
          break;
      }

      return {
        type: "state",
        path,
        oldValue,
        newValue: this.getNestedValue(gameState, path),
      };
    });

    // 記錄訊息
    this.effectExecutors.set("logMessage", (effect, gameState) => {
      const { message, type = "event" } = effect;
      this.addGameLog(message, type);
      return { type: "log", message, logType: type };
    });

    // 觸發事件
    this.effectExecutors.set("triggerEvent", (effect, gameState) => {
      const { eventId, delay = 0 } = effect;

      if (delay === 0) {
        this.executeEvent(eventId, gameState);
      } else {
        // 延遲觸發（需要與遊戲主循環整合）
        this.scheduleEvent(eventId, gameState.day + delay);
      }

      return { type: "event", eventId, delay };
    });

    // 複合效果
    this.effectExecutors.set("multiple", (effect, gameState) => {
      const results = [];
      effect.effects.forEach((subEffect) => {
        const result = this.executeEffect(subEffect, gameState);
        results.push(result);
      });
      return { type: "multiple", results };
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
    };

    this.rules.set(ruleId, rule);

    // 添加到群組
    if (!this.ruleGroups.has(rule.group)) {
      this.ruleGroups.set(rule.group, new Set());
    }
    this.ruleGroups.get(rule.group).add(ruleId);

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
      return null;
    }

    if (!rule.enabled) {
      return { executed: false, reason: "rule_disabled" };
    }

    // 檢查冷卻時間
    if (
      rule.cooldown > 0 &&
      this.gameState.day - rule.lastExecuted < rule.cooldown
    ) {
      return { executed: false, reason: "cooldown_active" };
    }

    // 檢查條件
    const conditionsMet = this.checkAllConditions(rule.conditions, context);
    if (!conditionsMet) {
      return { executed: false, reason: "conditions_not_met" };
    }

    // 執行效果
    const results = [];
    rule.effects.forEach((effect) => {
      try {
        const result = this.executeEffect(effect, this.gameState);
        results.push(result);
      } catch (error) {
        console.error(`❌ 規則 ${ruleId} 效果執行失敗:`, error);
        results.push({ type: "error", error: error.message });
      }
    });

    // 更新執行記錄
    rule.lastExecuted = this.gameState.day;
    this.addExecutionHistory(ruleId, rule.name, results);

    return { executed: true, results };
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
      return [];
    }

    // 按優先級排序
    const sortedRules = Array.from(ruleIds)
      .map((id) => this.rules.get(id))
      .filter((rule) => rule && rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    const results = [];
    sortedRules.forEach((rule) => {
      const result = this.executeRule(rule.id, context);
      if (result && result.executed) {
        results.push({ ruleId: rule.id, ...result });
      }
    });

    return results;
  }

  /**
   * 檢查所有條件
   */
  checkAllConditions(conditions, context = {}) {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    return conditions.every((condition) =>
      this.checkCondition(condition, context)
    );
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
      return { type: "error", error: error.message, originalEffect: effect };
    }
  }

  /**
   * 取得嵌套物件值
   */
  getNestedValue(obj, path) {
    return path
      .split(".")
      .reduce((current, key) => current && current[key], obj);
  }

  /**
   * 設定嵌套物件值
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
   * 比較數值
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
      default:
        return false;
    }
  }

  /**
   * 添加遊戲記錄
   */
  addGameLog(message, type = "event") {
    if (typeof window.addLog === "function") {
      window.addLog(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * 添加執行歷史
   */
  addExecutionHistory(ruleId, ruleName, results) {
    const entry = {
      timestamp: Date.now(),
      day: this.gameState.day,
      ruleId,
      ruleName,
      results,
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
  }

  /**
   * 取得規則資訊
   */
  getRuleInfo(ruleId) {
    return this.rules.get(ruleId);
  }

  /**
   * 取得所有規則
   */
  getAllRules() {
    return Array.from(this.rules.values());
  }

  /**
   * 啟用/停用規則
   */
  setRuleEnabled(ruleId, enabled) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * 除錯：印出當前狀態
   */
  debugPrint() {
    console.group("🔧 RuleEngine 狀態");
    console.log("已註冊規則:", this.rules.size);
    console.log("規則群組:", Array.from(this.ruleGroups.keys()));
    console.log("執行歷史條目:", this.executionHistory.length);
    console.groupEnd();
  }
}

// 建立全域實例（需要 gameState 參考）
window.createRuleEngine = (gameStateRef) => {
  window.ruleEngine = new RuleEngine(gameStateRef);
  return window.ruleEngine;
};

export default RuleEngine;

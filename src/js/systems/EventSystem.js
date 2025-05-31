/**
 * EventSystem - 事件管理與執行系統
 * 職責：事件觸發引擎、條件檢查、動態選擇生成、系統間事件協調
 */

import {
  DATA_TYPES,
  ERROR_CODES,
  MESSAGE_TEMPLATES,
} from "../utils/constants.js";

/**
 * 事件系統核心類別
 */
export class EventSystem extends EventTarget {
  constructor(gameState, dataManager, gameHelpers) {
    super();

    // 核心依賴
    this.gameState = gameState;
    this.dataManager = dataManager;
    this.gameHelpers = gameHelpers;

    // 系統狀態
    this.status = {
      initialized: false,
      eventsLoaded: false,
      configLoaded: false,
      error: null,
    };

    // 事件配置
    this.eventsConfig = null;
    this.eventParameters = null;

    // 事件處理器註冊表
    this.eventHandlers = new Map();
    this.conditionCheckers = new Map();
    this.effectExecutors = new Map();

    // 事件歷史追蹤
    this.eventHistory = [];
    this.activeEvents = new Map();

    // 系統引用（由主程式注入）
    this.tenantSystemRef = null;
    this.resourceSystemRef = null;
    this.ruleEngineRef = null;

    console.log("📅 EventSystem 已建立");
  }

  /**
   * 系統初始化
   */
  async initialize() {
    console.log("📅 正在初始化 EventSystem...");

    try {
      // 載入事件配置
      await this.loadEventConfiguration();

      // 載入系統參數
      await this.loadSystemParameters();

      // 註冊內建處理器
      this.registerBuiltinHandlers();

      // 設定事件監聽
      this.setupEventListeners();

      this.status.initialized = true;
      console.log("✅ EventSystem 初始化完成");

      return true;
    } catch (error) {
      console.error("❌ EventSystem 初始化失敗:", error);
      this.status.error = error.message;
      return false;
    }
  }

  /**
   * 載入事件配置
   */
  async loadEventConfiguration() {
    try {
      this.eventsConfig = await this.dataManager.loadData("events");

      if (!this.eventsConfig) {
        throw new Error("事件配置載入失敗");
      }

      this.status.eventsLoaded = true;
      console.log("✅ 事件配置載入完成");
    } catch (error) {
      console.warn("⚠️ 使用預設事件配置:", error.message);
      this.eventsConfig = this.getDefaultEventConfig();
      this.status.eventsLoaded = false;
    }
  }

  /**
   * 載入系統參數
   */
  async loadSystemParameters() {
    try {
      if (this.gameHelpers) {
        this.eventParameters = this.gameHelpers.getEventParameters();
        this.status.configLoaded = true;
      } else {
        this.eventParameters = this.getDefaultEventParameters();
        this.status.configLoaded = false;
      }

      console.log("✅ 事件參數載入完成");
    } catch (error) {
      console.warn("⚠️ 使用預設事件參數:", error.message);
      this.eventParameters = this.getDefaultEventParameters();
      this.status.configLoaded = false;
    }
  }

  /**
   * 註冊內建事件處理器
   */
  registerBuiltinHandlers() {
    // 註冊條件檢查器
    this.registerConditionCheckers();

    // 註冊效果執行器
    this.registerEffectExecutors();

    console.log("✅ 內建事件處理器註冊完成");
  }

  /**
   * 註冊條件檢查器
   */
  registerConditionCheckers() {
    // 資源檢查
    this.conditionCheckers.set("hasResource", (condition) => {
      const { resource, amount } = condition;
      return (this.gameState.resources[resource] || 0) >= amount;
    });

    // 時間範圍檢查
    this.conditionCheckers.set("dayRange", (condition) => {
      const { min, max } = condition;
      const currentDay = this.gameState.day;

      if (min !== undefined && currentDay < min) return false;
      if (max !== undefined && currentDay > max) return false;

      return true;
    });

    // 租客類型檢查
    this.conditionCheckers.set("hasTenantType", (condition) => {
      const { tenantType, count = 1 } = condition;

      if (tenantType === "any") {
        const tenantCount = this.gameState.rooms.filter(
          (room) => room.tenant
        ).length;
        return tenantCount >= count;
      }

      if (tenantType === "infected") {
        const infectedCount = this.gameState.rooms.filter(
          (room) => room.tenant && room.tenant.infected
        ).length;
        return infectedCount >= count;
      }

      const typeCount = this.gameState.rooms.filter(
        (room) =>
          room.tenant &&
          (room.tenant.type === tenantType || room.tenant.typeId === tenantType)
      ).length;

      return typeCount >= count;
    });

    // 機率檢查
    this.conditionCheckers.set("probability", (condition) => {
      const { chance } = condition;
      return Math.random() < chance;
    });

    // 資源稀缺性檢查
    this.conditionCheckers.set("resourceScarcity", (condition) => {
      const { resource, threshold } = condition;
      const currentAmount = this.gameState.resources[resource] || 0;

      // 使用 GameHelpers 取得稀缺閾值
      const warningThresholds = this.gameHelpers
        ? this.gameHelpers.getResourceWarningThresholds()
        : { food: 5, materials: 3, medical: 2, fuel: 2 };

      const warningLevel = warningThresholds[resource] || 5;

      switch (threshold) {
        case "insufficient":
          return currentAmount < warningLevel;
        case "critical":
          return currentAmount < warningLevel / 2;
        default:
          return false;
      }
    });

    // 複合條件檢查
    this.conditionCheckers.set("and", (condition) => {
      return condition.conditions.every((cond) =>
        this.checkSingleCondition(cond)
      );
    });

    this.conditionCheckers.set("or", (condition) => {
      return condition.conditions.some((cond) =>
        this.checkSingleCondition(cond)
      );
    });
  }

  /**
   * 註冊效果執行器
   */
  registerEffectExecutors() {
    // 資源修改
    this.effectExecutors.set("modifyResource", (effect) => {
      const { resource, amount } = effect;

      if (this.resourceSystemRef) {
        return this.resourceSystemRef.updateResource(
          resource,
          amount,
          "event_effect"
        );
      } else {
        // 後備處理
        const oldValue = this.gameState.resources[resource] || 0;
        this.gameState.resources[resource] = Math.max(0, oldValue + amount);
        return {
          success: true,
          oldValue,
          newValue: this.gameState.resources[resource],
        };
      }
    });

    // 記錄訊息
    this.effectExecutors.set("logMessage", (effect) => {
      const { message, logType = "event" } = effect;
      this.addLog(message, logType);
      return { success: true, message };
    });

    // 房間損壞
    this.effectExecutors.set("damageRandomRoom", (effect) => {
      const availableRooms = this.gameState.rooms.filter(
        (room) => !room.needsRepair
      );

      if (availableRooms.length === 0) {
        return { success: false, reason: "no_rooms_to_damage" };
      }

      const targetRoom =
        availableRooms[Math.floor(Math.random() * availableRooms.length)];
      targetRoom.needsRepair = true;

      this.addLog(`房間 ${targetRoom.id} 受損需要維修`, "danger");
      return { success: true, roomId: targetRoom.id };
    });

    // 機率檢查效果
    this.effectExecutors.set("probabilityCheck", (effect) => {
      const {
        condition,
        success: successEffects,
        failure: failureEffects,
      } = effect;

      const probability = this.calculateEventProbability(condition);
      const isSuccess = Math.random() < probability;

      const effectsToExecute = isSuccess ? successEffects : failureEffects;
      const results = [];

      if (effectsToExecute) {
        effectsToExecute.forEach((subEffect) => {
          const result = this.executeSingleEffect(subEffect);
          results.push(result);
        });
      }

      return {
        success: true,
        probabilityResult: isSuccess,
        probability,
        effects: results,
      };
    });

    // 租客相關效果
    this.effectExecutors.set("removeTenant", (effect) => {
      const { target } = effect;

      if (target === "sick" || target === "infected") {
        const targetTenants = this.gameState.rooms.filter(
          (room) => room.tenant && room.tenant.infected
        );

        if (targetTenants.length > 0) {
          const tenantToRemove = targetTenants[0].tenant;
          if (this.tenantSystemRef) {
            return this.tenantSystemRef.evictTenant(
              tenantToRemove.name,
              "medical_crisis"
            );
          }
        }
      }

      return { success: false, reason: "no_target_found" };
    });

    // 治療租客
    this.effectExecutors.set("healTenant", (effect) => {
      const { target } = effect;

      const infectedTenants = this.gameState.rooms.filter(
        (room) => room.tenant && room.tenant.infected
      );

      if (infectedTenants.length > 0) {
        const tenantToHeal = infectedTenants[0].tenant;
        tenantToHeal.infected = false;
        this.addLog(`${tenantToHeal.name} 已康復`, "skill");
        return { success: true, tenantName: tenantToHeal.name };
      }

      return { success: false, reason: "no_infected_tenants" };
    });

    // 軍人加成檢查
    this.effectExecutors.set("checkSoldierBonus", (effect) => {
      const soldierCount = this.gameState.rooms.filter(
        (room) =>
          room.tenant &&
          (room.tenant.type === "soldier" || room.tenant.typeId === "soldier")
      ).length;

      if (soldierCount > 0 && effect.effects) {
        const results = [];
        effect.effects.forEach((subEffect) => {
          const result = this.executeSingleEffect(subEffect);
          results.push(result);
        });
        return { success: true, soldierBonus: true, effects: results };
      }

      return { success: true, soldierBonus: false };
    });

    // 狀態修改
    this.effectExecutors.set("modifyState", (effect) => {
      const { path, value, operation = "set" } = effect;

      const currentValue = this.getNestedValue(this.gameState, path);

      switch (operation) {
        case "add":
          this.setNestedValue(
            this.gameState,
            path,
            (currentValue || 0) + value
          );
          break;
        case "multiply":
          this.setNestedValue(
            this.gameState,
            path,
            (currentValue || 0) * value
          );
          break;
        case "set":
        default:
          this.setNestedValue(this.gameState, path, value);
          break;
      }

      return { success: true, path, oldValue: currentValue, newValue: value };
    });
  }

  /**
   * 設定事件監聽
   */
  setupEventListeners() {
    // 監聽其他系統的事件
    if (this.tenantSystemRef) {
      this.tenantSystemRef.addEventListener("tenantHired", (event) => {
        this.onTenantHired(event.detail);
      });

      this.tenantSystemRef.addEventListener("tenantEvicted", (event) => {
        this.onTenantEvicted(event.detail);
      });
    }

    if (this.resourceSystemRef) {
      this.resourceSystemRef.addEventListener("resourceWarning", (event) => {
        this.onResourceWarning(event.detail);
      });
    }
  }

  /**
   * 主要事件處理方法
   */

  /**
   * 處理隨機事件
   */
  processRandomEvents() {
    if (!this.status.initialized || !this.eventsConfig.random_events) {
      return false;
    }

    const eventChance = this.eventParameters.randomEventChance || 0.3;

    if (Math.random() > eventChance) {
      return false; // 今天沒有隨機事件
    }

    // 篩選可觸發的隨機事件
    const availableEvents = this.eventsConfig.random_events.filter((event) =>
      this.checkEventConditions(event)
    );

    if (availableEvents.length === 0) {
      return false;
    }

    // 根據優先級選擇事件
    const selectedEvent = this.selectEventByPriority(availableEvents);

    if (selectedEvent) {
      this.triggerEvent(selectedEvent);
      return true;
    }

    return false;
  }

  /**
   * 處理衝突事件
   */
  processConflictEvents() {
    if (!this.status.initialized || !this.eventsConfig.conflict_events) {
      return false;
    }

    const conflictChance = this.calculateConflictProbability();

    if (Math.random() > conflictChance) {
      return false;
    }

    // 篩選可觸發的衝突事件
    const availableEvents = this.eventsConfig.conflict_events.filter((event) =>
      this.checkEventConditions(event)
    );

    if (availableEvents.length === 0) {
      return false;
    }

    const selectedEvent = this.selectEventByPriority(availableEvents);

    if (selectedEvent) {
      this.triggerEvent(selectedEvent);
      return true;
    }

    return false;
  }

  /**
   * 處理特殊事件
   */
  processSpecialEvents() {
    if (!this.status.initialized || !this.eventsConfig.special_events) {
      return false;
    }

    // 特殊事件通常有特定觸發條件
    const availableEvents = this.eventsConfig.special_events.filter((event) =>
      this.checkEventConditions(event)
    );

    if (availableEvents.length === 0) {
      return false;
    }

    const selectedEvent = this.selectEventByPriority(availableEvents);

    if (selectedEvent) {
      this.triggerEvent(selectedEvent);
      return true;
    }

    return false;
  }

  /**
   * 觸發特定事件
   */
  triggerEvent(event) {
    console.log(`📅 觸發事件: ${event.title}`);

    // 記錄事件歷史
    this.eventHistory.push({
      event: event,
      day: this.gameState.day,
      timestamp: Date.now(),
    });

    // 生成動態選擇
    const choices = this.generateEventChoices(event);

    // 顯示事件對話框
    this.showEventModal(event, choices);

    // 觸發事件開始事件
    this.dispatchEvent(
      new CustomEvent("eventTriggered", {
        detail: { event, choices },
      })
    );
  }

  /**
   * 生成事件選擇
   */
  generateEventChoices(event) {
    let choices = [];

    // 基礎選擇
    if (event.choices) {
      choices = event.choices.filter((choice) =>
        this.checkChoiceConditions(choice)
      );
    }

    // 動態選擇（基於租客類型）
    if (event.dynamicChoices) {
      const dynamicChoices = this.generateDynamicChoices(event.dynamicChoices);
      choices = choices.concat(dynamicChoices);
    }

    return choices;
  }

  /**
   * 生成動態選擇
   */
  generateDynamicChoices(dynamicConfig) {
    const choices = [];

    // 基礎選擇
    if (dynamicConfig.base) {
      const baseChoices = dynamicConfig.base.filter((choice) =>
        this.checkChoiceConditions(choice)
      );
      choices.push(...baseChoices);
    }

    // 條件選擇
    if (dynamicConfig.conditional) {
      dynamicConfig.conditional.forEach((conditionalChoice) => {
        if (this.checkSingleCondition(conditionalChoice.condition)) {
          choices.push(conditionalChoice.choice);
        }
      });
    }

    return choices;
  }

  /**
   * 執行事件選擇
   */
  executeEvent(eventId, choiceId) {
    const event = this.findEventById(eventId);
    if (!event) {
      console.error(`❌ 找不到事件: ${eventId}`);
      return false;
    }

    const choice = this.findChoiceById(event, choiceId);
    if (!choice) {
      console.error(`❌ 找不到選擇: ${choiceId}`);
      return false;
    }

    console.log(`⚡ 執行事件選擇: ${event.title} -> ${choice.text}`);

    // 檢查選擇條件
    if (!this.checkChoiceConditions(choice)) {
      this.addLog("選擇條件不滿足", "danger");
      return false;
    }

    // 執行效果
    const results = this.executeChoiceEffects(choice.effects);

    // 記錄執行結果
    this.recordEventExecution(event, choice, results);

    // 觸發事件完成事件
    this.dispatchEvent(
      new CustomEvent("eventCompleted", {
        detail: { event, choice, results },
      })
    );

    return true;
  }

  /**
   * 執行選擇效果
   */
  executeChoiceEffects(effects) {
    if (!effects || effects.length === 0) {
      return [];
    }

    const results = [];

    effects.forEach((effect) => {
      try {
        const result = this.executeSingleEffect(effect);
        results.push(result);
      } catch (error) {
        console.error("❌ 效果執行失敗:", error);
        results.push({ success: false, error: error.message });
      }
    });

    return results;
  }

  /**
   * 執行單一效果
   */
  executeSingleEffect(effect) {
    const { type } = effect;
    const executor = this.effectExecutors.get(type);

    if (!executor) {
      // 嘗試使用 RuleEngine
      if (this.ruleEngineRef) {
        return this.ruleEngineRef.executeEffect(effect, this.gameState);
      }

      console.warn(`⚠️ 未知的效果類型: ${type}`);
      return { success: false, reason: "unknown_effect_type", effect };
    }

    return executor(effect);
  }

  /**
   * 條件檢查方法
   */

  /**
   * 檢查事件條件
   */
  checkEventConditions(event) {
    if (!event.trigger || !event.trigger.conditions) {
      return true;
    }

    return event.trigger.conditions.every((condition) =>
      this.checkSingleCondition(condition)
    );
  }

  /**
   * 檢查選擇條件
   */
  checkChoiceConditions(choice) {
    if (!choice.conditions || choice.conditions.length === 0) {
      return true;
    }

    return choice.conditions.every((condition) =>
      this.checkSingleCondition(condition)
    );
  }

  /**
   * 檢查單一條件
   */
  checkSingleCondition(condition) {
    const { type } = condition;
    const checker = this.conditionCheckers.get(type);

    if (!checker) {
      // 嘗試使用 RuleEngine
      if (this.ruleEngineRef) {
        return this.ruleEngineRef.checkCondition(condition, this.gameState);
      }

      console.warn(`⚠️ 未知的條件類型: ${type}`);
      return false;
    }

    try {
      return checker(condition);
    } catch (error) {
      console.error(`❌ 條件檢查失敗 (${type}):`, error);
      return false;
    }
  }

  /**
   * 輔助方法
   */

  /**
   * 計算衝突機率
   */
  calculateConflictProbability() {
    const baseChance = this.eventParameters.conflictBaseChance || 0.25;
    let modifiedChance = baseChance;

    // 租客數量修飾符
    const tenantCount = this.gameState.rooms.filter(
      (room) => room.tenant
    ).length;
    modifiedChance +=
      tenantCount *
      (this.eventParameters.conflictModifiers?.tenantCountMultiplier || 0.08);

    // 滿意度修飾符
    const avgSatisfaction = this.calculateAverageSatisfaction();
    const satisfactionPenalty =
      Math.max(0, 70 - avgSatisfaction) *
      (this.eventParameters.conflictModifiers?.satisfactionPenalty || 0.003);
    modifiedChance += satisfactionPenalty;

    // 資源稀缺修飾符
    if (this.checkResourceScarcity()) {
      modifiedChance +=
        this.eventParameters.conflictModifiers?.resourceScarcityBonus || 0.1;
    }

    // 長者減少衝突
    const elderCount = this.gameState.rooms.filter(
      (room) =>
        room.tenant &&
        (room.tenant.type === "elder" || room.tenant.typeId === "elder")
    ).length;

    if (elderCount > 0) {
      modifiedChance -=
        this.eventParameters.conflictModifiers?.elderReduction || 0.12;
    }

    return Math.max(0, Math.min(1, modifiedChance));
  }

  /**
   * 計算平均滿意度
   */
  calculateAverageSatisfaction() {
    const satisfactionValues = Object.values(
      this.gameState.tenantSatisfaction || {}
    );

    if (satisfactionValues.length === 0) {
      return 50; // 預設滿意度
    }

    return (
      satisfactionValues.reduce((sum, value) => sum + value, 0) /
      satisfactionValues.length
    );
  }

  /**
   * 檢查資源稀缺性
   */
  checkResourceScarcity() {
    const criticalResources = ["food", "materials", "medical", "fuel"];
    const warningThresholds = this.gameHelpers
      ? this.gameHelpers.getResourceWarningThresholds()
      : { food: 5, materials: 3, medical: 2, fuel: 2 };

    return criticalResources.some(
      (resource) =>
        (this.gameState.resources[resource] || 0) <
        (warningThresholds[resource] || 5)
    );
  }

  /**
   * 計算事件機率
   */
  calculateEventProbability(condition) {
    if (this.gameHelpers) {
      return this.gameHelpers.calculateProbability(
        condition.base,
        condition.modifiers
      );
    }

    // 後備計算
    let probability = condition.base || 0.5;

    if (condition.modifiers) {
      condition.modifiers.forEach((modifier) => {
        if (this.checkSingleCondition(modifier)) {
          probability += modifier.bonus || 0;
        }
      });
    }

    return Math.max(0, Math.min(1, probability));
  }

  /**
   * 根據優先級選擇事件
   */
  selectEventByPriority(events) {
    if (events.length === 0) return null;
    if (events.length === 1) return events[0];

    // 按優先級排序（優先級越高越重要）
    const sortedEvents = events.sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    // 優先選擇高優先級事件，但仍有隨機性
    const highPriorityEvents = sortedEvents.filter(
      (event) => event.priority === sortedEvents[0].priority
    );

    return highPriorityEvents[
      Math.floor(Math.random() * highPriorityEvents.length)
    ];
  }

  /**
   * UI 交互方法
   */

  /**
   * 顯示事件對話框
   */
  showEventModal(event, choices) {
    const modal = document.getElementById("eventModal");
    const titleEl = document.getElementById("eventTitle");
    const descEl = document.getElementById("eventDescription");
    const choicesEl = document.getElementById("eventChoices");

    if (!modal || !titleEl || !descEl || !choicesEl) {
      console.error("❌ 事件對話框 DOM 元素缺失");
      return;
    }

    titleEl.textContent = event.title;
    descEl.textContent = event.description;

    choicesEl.innerHTML = choices
      .map(
        (choice) => `
      <button class="btn ${choice.icon ? "" : "success"}" 
              onclick="window.gameApp.handleEventChoice('${event.id}', '${
          choice.id
        }')">
        ${choice.icon || ""} ${choice.text}
      </button>
    `
      )
      .join("");

    modal.style.display = "block";
  }

  /**
   * 工具方法
   */

  /**
   * 找到事件 by ID
   */
  findEventById(eventId) {
    const allEvents = [
      ...(this.eventsConfig.random_events || []),
      ...(this.eventsConfig.conflict_events || []),
      ...(this.eventsConfig.special_events || []),
      ...(this.eventsConfig.scripted_events || []),
    ];

    return allEvents.find((event) => event.id === eventId);
  }

  /**
   * 找到選擇 by ID
   */
  findChoiceById(event, choiceId) {
    const allChoices = [
      ...(event.choices || []),
      ...(event.dynamicChoices?.base || []),
      ...(event.dynamicChoices?.conditional?.map((c) => c.choice) || []),
    ];

    return allChoices.find((choice) => choice.id === choiceId);
  }

  /**
   * 記錄事件執行
   */
  recordEventExecution(event, choice, results) {
    const record = {
      eventId: event.id,
      choiceId: choice.id,
      day: this.gameState.day,
      results: results,
      timestamp: Date.now(),
    };

    this.eventHistory.push(record);

    // 限制歷史記錄數量
    if (this.eventHistory.length > 100) {
      this.eventHistory = this.eventHistory.slice(-50);
    }
  }

  /**
   * 嵌套值操作
   */
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

  /**
   * 事件監聽處理
   */

  onTenantHired(data) {
    // 租客雇用可能觸發特殊事件
    this.processSpecialEvents();
  }

  onTenantEvicted(data) {
    // 租客離開可能改變事件觸發條件
    if (data.reason === "infected") {
      this.processSpecialEvents();
    }
  }

  onResourceWarning(data) {
    // 資源警告可能觸發資源相關事件
    this.processConflictEvents();
  }

  /**
   * 輔助功能
   */

  addLog(message, type = "event") {
    // 觸發日誌添加事件，由主應用程式處理
    this.dispatchEvent(
      new CustomEvent("addLog", {
        detail: { message, type },
      })
    );
  }

  /**
   * 預設配置
   */
  getDefaultEventConfig() {
    return {
      random_events: [],
      conflict_events: [],
      special_events: [],
      scripted_events: [],
    };
  }

  getDefaultEventParameters() {
    return {
      randomEventChance: 0.3,
      conflictBaseChance: 0.25,
      conflictModifiers: {
        tenantCountMultiplier: 0.08,
        satisfactionPenalty: 0.003,
        resourceScarcityBonus: 0.1,
        elderReduction: 0.12,
      },
    };
  }

  /**
   * 系統狀態查詢
   */
  getStatus() {
    return {
      ...this.status,
      eventCount: {
        random: this.eventsConfig?.random_events?.length || 0,
        conflict: this.eventsConfig?.conflict_events?.length || 0,
        special: this.eventsConfig?.special_events?.length || 0,
        scripted: this.eventsConfig?.scripted_events?.length || 0,
      },
      historyCount: this.eventHistory.length,
      parameters: this.eventParameters,
    };
  }

  /**
   * 系統清理
   */
  cleanup() {
    this.eventHistory = [];
    this.activeEvents.clear();
    this.removeAllEventListeners();

    console.log("🧹 EventSystem 已清理");
  }
}

// 預設匯出
export default EventSystem;

/**
 * GameBridge - 系統整合協調器
 * 職責：
 * 1. 協調各核心系統模組的交互作用
 * 2. 提供統一的服務介面給業務系統
 * 3. 管理系統生命週期和錯誤處理
 * 4. 實現事件驅動的模組間通信
 *
 * 設計模式：外觀模式 + 中介者模式 + 觀察者模式
 * 核心特性：服務註冊、事件協調、錯誤隔離、性能監控
 */

export class GameBridge extends EventTarget {
  constructor(gameStateRef, dataManager, ruleEngine) {
    super(); // 繼承 EventTarget 以支援事件機制

    this.gameState = gameStateRef;
    this.dataManager = dataManager;
    this.ruleEngine = ruleEngine;

    // 系統狀態管理
    this.systemStatus = {
      initialized: false,
      version: "2.0.0",
      architecture: "ES6 Modules",
      startTime: Date.now(),
      lastHealthCheck: 0,
    };

    // 服務註冊表（外觀模式）
    this.services = new Map();

    // 事件監聽器管理（觀察者模式）
    this.eventListeners = new Map();

    // 性能監控
    this.performanceMetrics = {
      eventCount: 0,
      serviceCallCount: 0,
      averageResponseTime: 0,
      errorCount: 0,
      lastError: null,
    };

    // 錯誤處理系統
    this.errorHandlers = new Map();

    // 初始化核心服務
    this.initializeCoreServices();
  }

  /**
   * 初始化核心服務
   */
  initializeCoreServices() {
    // 註冊核心服務
    this.registerService("dataManager", this.dataManager);
    this.registerService("ruleEngine", this.ruleEngine);
    this.registerService("gameState", this.gameState);

    // 註冊內建錯誤處理器
    this.registerErrorHandlers();

    // 建立核心事件監聽
    this.setupCoreEventListeners();

    console.log("🔗 GameBridge 核心服務初始化完成");
  }

  /**
   * 註冊錯誤處理器
   */
  registerErrorHandlers() {
    // 資料載入錯誤處理器
    this.errorHandlers.set("data_load_error", (error, context) => {
      console.error("❌ 資料載入錯誤:", error);
      this.emit("system:data_load_failed", { error, context });

      // 嘗試使用預設資料
      if (context.dataType && this.dataManager) {
        const defaultData = this.dataManager.getDefaultData(context.dataType);
        if (defaultData) {
          console.log(`🔄 使用 ${context.dataType} 預設資料`);
          return defaultData;
        }
      }

      throw error;
    });

    // 規則執行錯誤處理器
    this.errorHandlers.set("rule_execution_error", (error, context) => {
      console.error("❌ 規則執行錯誤:", error);
      this.emit("system:rule_execution_failed", { error, context });

      // 記錄錯誤但不中斷遊戲
      this.performanceMetrics.errorCount++;
      this.performanceMetrics.lastError = {
        timestamp: Date.now(),
        type: "rule_execution",
        message: error.message,
        context,
      };
    });

    // 系統通信錯誤處理器
    this.errorHandlers.set("communication_error", (error, context) => {
      console.error("❌ 系統通信錯誤:", error);
      this.emit("system:communication_failed", { error, context });

      // 嘗試重建通信連線
      setTimeout(() => {
        this.attemptReconnection(context);
      }, 1000);
    });
  }

  /**
   * 建立核心事件監聽
   */
  setupCoreEventListeners() {
    // 監聽系統健康檢查
    this.addEventListener(
      "system:health_check",
      this.handleHealthCheck.bind(this)
    );

    // 監聽資料更新事件
    this.addEventListener("data:updated", this.handleDataUpdate.bind(this));

    // 監聽規則執行事件
    this.addEventListener("rule:executed", this.handleRuleExecution.bind(this));

    // 設定定期健康檢查
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // 每30秒檢查一次
  }

  /**
   * 服務註冊與管理
   */

  /**
   * 註冊服務
   * @param {string} serviceName - 服務名稱
   * @param {any} serviceInstance - 服務實例
   * @param {Object} options - 服務選項
   */
  registerService(serviceName, serviceInstance, options = {}) {
    const service = {
      name: serviceName,
      instance: serviceInstance,
      registeredAt: Date.now(),
      callCount: 0,
      lastCall: 0,
      enabled: options.enabled !== false,
      metadata: options.metadata || {},
    };

    this.services.set(serviceName, service);

    console.log(`📋 註冊服務: ${serviceName}`);
    this.emit("service:registered", { serviceName, service });

    return service;
  }

  /**
   * 取得服務
   * @param {string} serviceName - 服務名稱
   * @returns {any} 服務實例
   */
  getService(serviceName) {
    const service = this.services.get(serviceName);

    if (!service) {
      throw new Error(`服務不存在: ${serviceName}`);
    }

    if (!service.enabled) {
      throw new Error(`服務已停用: ${serviceName}`);
    }

    // 更新調用統計
    service.callCount++;
    service.lastCall = Date.now();
    this.performanceMetrics.serviceCallCount++;

    return service.instance;
  }

  /**
   * 檢查服務是否可用
   * @param {string} serviceName - 服務名稱
   * @returns {boolean} 服務是否可用
   */
  hasService(serviceName) {
    const service = this.services.get(serviceName);
    return service && service.enabled;
  }

  /**
   * 停用服務
   * @param {string} serviceName - 服務名稱
   */
  disableService(serviceName) {
    const service = this.services.get(serviceName);
    if (service) {
      service.enabled = false;
      console.log(`❌ 停用服務: ${serviceName}`);
      this.emit("service:disabled", { serviceName });
    }
  }

  /**
   * 啟用服務
   * @param {string} serviceName - 服務名稱
   */
  enableService(serviceName) {
    const service = this.services.get(serviceName);
    if (service) {
      service.enabled = true;
      console.log(`✅ 啟用服務: ${serviceName}`);
      this.emit("service:enabled", { serviceName });
    }
  }

  /**
   * 事件管理與通信
   */

  /**
   * 發送事件（覆寫 EventTarget 的方法以增加統計）
   * @param {string} eventType - 事件類型
   * @param {any} data - 事件資料
   */
  emit(eventType, data = {}) {
    const event = new CustomEvent(eventType, {
      detail: {
        ...data,
        timestamp: Date.now(),
        source: "GameBridge",
      },
    });

    this.performanceMetrics.eventCount++;
    this.dispatchEvent(event);

    // 記錄重要事件
    if (eventType.startsWith("system:") || eventType.startsWith("error:")) {
      console.log(`📡 事件發送: ${eventType}`, data);
    }
  }

  /**
   * 監聽事件（增強版本）
   * @param {string} eventType - 事件類型
   * @param {Function} handler - 事件處理器
   * @param {Object} options - 監聽選項
   */
  on(eventType, handler, options = {}) {
    const wrappedHandler = (event) => {
      const startTime = Date.now();

      try {
        handler(event);

        // 更新性能統計
        const responseTime = Date.now() - startTime;
        this.updateResponseTimeMetrics(responseTime);
      } catch (error) {
        console.error(`❌ 事件處理器錯誤 (${eventType}):`, error);
        this.handleError("event_handler_error", error, {
          eventType,
          handler: handler.name,
        });
      }
    };

    this.addEventListener(eventType, wrappedHandler, options);

    // 記錄監聽器
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners
      .get(eventType)
      .push({ handler, wrappedHandler, options });

    return wrappedHandler;
  }

  /**
   * 移除事件監聽器
   * @param {string} eventType - 事件類型
   * @param {Function} handler - 原始處理器
   */
  off(eventType, handler) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const listenerInfo = listeners.find((l) => l.handler === handler);
      if (listenerInfo) {
        this.removeEventListener(eventType, listenerInfo.wrappedHandler);
        const index = listeners.indexOf(listenerInfo);
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 高級功能介面
   */

  /**
   * 執行資料載入操作
   * @param {string} dataType - 資料類型
   * @param {boolean} forceReload - 是否強制重新載入
   * @returns {Promise<any>} 載入的資料
   */
  async loadData(dataType, forceReload = false) {
    try {
      const dataManager = this.getService("dataManager");
      const data = await dataManager.loadData(dataType, forceReload);

      this.emit("data:loaded", { dataType, data });
      return data;
    } catch (error) {
      return this.handleError("data_load_error", error, { dataType });
    }
  }

  /**
   * 執行規則
   * @param {string} ruleId - 規則 ID
   * @param {Object} context - 執行上下文
   * @returns {Object} 執行結果
   */
  executeRule(ruleId, context = {}) {
    try {
      const ruleEngine = this.getService("ruleEngine");
      const result = ruleEngine.executeRule(ruleId, context);

      this.emit("rule:executed", { ruleId, result, context });
      return result;
    } catch (error) {
      this.handleError("rule_execution_error", error, { ruleId, context });
      return { executed: false, error: error.message };
    }
  }

  /**
   * 取得遊戲狀態
   * @param {string} path - 狀態路徑（可選）
   * @returns {any} 遊戲狀態或指定路徑的值
   */
  getGameState(path = null) {
    const gameState = this.getService("gameState");

    if (path) {
      return this.getNestedValue(gameState, path);
    }

    return gameState;
  }

  /**
   * 更新遊戲狀態
   * @param {string} path - 狀態路徑
   * @param {any} value - 新值
   * @param {string} operation - 操作類型（set, add, multiply）
   */
  updateGameState(path, value, operation = "set") {
    try {
      const gameState = this.getService("gameState");
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
          throw new Error(`未知的操作類型: ${operation}`);
      }

      this.setNestedValue(gameState, path, newValue);

      this.emit("gameState:updated", { path, oldValue, newValue, operation });
    } catch (error) {
      this.handleError("game_state_error", error, { path, value, operation });
    }
  }

  /**
   * 系統監控與維護
   */

  /**
   * 執行健康檢查
   */
  performHealthCheck() {
    const healthStatus = {
      timestamp: Date.now(),
      overallHealth: "healthy",
      services: {},
      performance: { ...this.performanceMetrics },
      memory: this.getMemoryUsage(),
      uptime: Date.now() - this.systemStatus.startTime,
    };

    // 檢查每個服務的健康狀態
    for (const [serviceName, service] of this.services) {
      healthStatus.services[serviceName] = {
        enabled: service.enabled,
        callCount: service.callCount,
        lastCall: service.lastCall,
        timeSinceLastCall: Date.now() - service.lastCall,
        healthy:
          service.enabled &&
          (service.lastCall > 0 || serviceName === "gameState"),
      };

      if (!healthStatus.services[serviceName].healthy) {
        healthStatus.overallHealth = "degraded";
      }
    }

    // 檢查錯誤率
    if (this.performanceMetrics.errorCount > 10) {
      healthStatus.overallHealth = "unhealthy";
    }

    this.systemStatus.lastHealthCheck = Date.now();
    this.emit("system:health_check_completed", healthStatus);

    return healthStatus;
  }

  /**
   * 取得記憶體使用狀況
   */
  getMemoryUsage() {
    try {
      if (performance && performance.memory) {
        return {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
        };
      }
    } catch (error) {
      // 某些瀏覽器可能不支援 performance.memory
    }

    return { used: "unknown", total: "unknown", limit: "unknown" };
  }

  /**
   * 更新響應時間統計
   */
  updateResponseTimeMetrics(responseTime) {
    const currentAvg = this.performanceMetrics.averageResponseTime;
    const count = this.performanceMetrics.eventCount;

    // 計算新的平均響應時間
    this.performanceMetrics.averageResponseTime =
      (currentAvg * (count - 1) + responseTime) / count;
  }

  /**
   * 事件處理器
   */

  handleHealthCheck(event) {
    console.log("🔍 執行系統健康檢查");
    return this.performHealthCheck();
  }

  handleDataUpdate(event) {
    const { dataType, data } = event.detail;
    console.log(`📊 資料更新: ${dataType}`);

    // 通知相關系統資料已更新
    this.emit(`data:${dataType}_updated`, { data });
  }

  handleRuleExecution(event) {
    const { ruleId, result } = event.detail;

    if (result.executed) {
      console.log(`⚙️ 規則執行成功: ${ruleId}`);
    } else {
      console.warn(`⚠️ 規則執行失敗: ${ruleId} - ${result.reason}`);
    }
  }

  /**
   * 錯誤處理
   */
  handleError(errorType, error, context = {}) {
    const handler = this.errorHandlers.get(errorType);

    if (handler) {
      try {
        return handler(error, context);
      } catch (handlerError) {
        console.error("❌ 錯誤處理器執行失敗:", handlerError);
      }
    }

    // 預設錯誤處理
    console.error(`❌ 未處理的錯誤 (${errorType}):`, error);
    this.emit("error:unhandled", { errorType, error, context });

    throw error;
  }

  /**
   * 嘗試重建連線
   */
  attemptReconnection(context) {
    console.log("🔄 嘗試重建系統連線...");

    // 這裡可以實作具體的重連邏輯
    // 例如重新初始化服務、重新載入資料等

    this.emit("system:reconnection_attempted", { context });
  }

  /**
   * 工具方法
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
   * 取得系統資訊
   */
  getSystemInfo() {
    return {
      status: this.systemStatus,
      services: Array.from(this.services.entries()).map(([name, service]) => ({
        name,
        enabled: service.enabled,
        callCount: service.callCount,
        lastCall: service.lastCall,
      })),
      performance: this.performanceMetrics,
      eventListeners: Array.from(this.eventListeners.keys()),
      errorHandlers: Array.from(this.errorHandlers.keys()),
      health: this.performHealthCheck(),
    };
  }

  /**
   * 取得詳細統計資訊
   */
  getDetailedStats() {
    const systemInfo = this.getSystemInfo();

    return {
      ...systemInfo,
      memory: this.getMemoryUsage(),
      uptime: Date.now() - this.systemStatus.startTime,
      detailedPerformance: {
        ...this.performanceMetrics,
        eventsPerMinute: this.calculateEventsPerMinute(),
        serviceCallsPerMinute: this.calculateServiceCallsPerMinute(),
        errorRate: this.calculateErrorRate(),
      },
    };
  }

  calculateEventsPerMinute() {
    const uptimeMinutes =
      (Date.now() - this.systemStatus.startTime) / 1000 / 60;
    return uptimeMinutes > 0
      ? (this.performanceMetrics.eventCount / uptimeMinutes).toFixed(2)
      : 0;
  }

  calculateServiceCallsPerMinute() {
    const uptimeMinutes =
      (Date.now() - this.systemStatus.startTime) / 1000 / 60;
    return uptimeMinutes > 0
      ? (this.performanceMetrics.serviceCallCount / uptimeMinutes).toFixed(2)
      : 0;
  }

  calculateErrorRate() {
    const totalOperations =
      this.performanceMetrics.eventCount +
      this.performanceMetrics.serviceCallCount;
    return totalOperations > 0
      ? ((this.performanceMetrics.errorCount / totalOperations) * 100).toFixed(
          2
        ) + "%"
      : "0%";
  }

  /**
   * 除錯方法
   */
  debugPrint() {
    console.group("🌉 GameBridge 系統狀態");
    console.log("系統狀態:", this.systemStatus);
    console.log("註冊服務:", Array.from(this.services.keys()));
    console.log("事件監聽器:", Array.from(this.eventListeners.keys()));
    console.log("性能統計:", this.performanceMetrics);
    console.log("詳細統計:", this.getDetailedStats());
    console.groupEnd();
  }
}

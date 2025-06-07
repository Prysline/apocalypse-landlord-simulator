// @ts-check

/**
 * @fileoverview BaseManager.js v2.0 - 業務管理器基礎類別（混合分層前綴策略）
 * 職責：提供統一的事件通信、日誌記錄、狀態管理等基礎功能
 * 核心特色：智慧事件前綴解析，支援系統級、業務領域、模組級分層命名
 */

/**
 * 日誌類型聯合型別
 * @typedef {'event'|'rent'|'danger'|'skill'} LogType
 */

/**
 * 基礎狀態介面
 * @typedef {Object} BaseManagerStatus
 * @property {boolean} initialized - 是否已初始化
 * @property {boolean} configLoaded - 配置是否載入
 * @property {string} managerType - 管理器類型
 * @property {string} version - 版本資訊
 * @property {number} lastUpdated - 最後更新時間戳記
 * @property {number} createdAt - 建立時間戳記
 * @property {number} uptime - 運行時間（毫秒）
 * @property {boolean} hasGameState - 是否有 GameState 依賴
 * @property {boolean} hasEventBus - 是否有 EventBus 依賴
 * @property {string} eventNamingStrategy - 事件命名策略
 */

/**
 * 事件資料介面
 * @typedef {Object} EventData
 * @property {string} source - 事件來源
 * @property {number} timestamp - 時間戳記
 * @property {*} [data] - 附加資料
 */

/**
 * 事件命名規則配置
 * @typedef {Object} EventNamingRules
 * @property {string[]} SYSTEM_PREFIXES - 系統級前綴
 * @property {string[]} BUSINESS_PREFIXES - 業務領域前綴
 * @property {string[]} MODULE_PREFIXES - 模組專屬前綴
 */

/**
 * 業務管理器基礎類別 v2.0（混合分層前綴策略）
 * 為所有業務管理器提供統一的基礎功能架構
 * 核心創新：智慧事件前綴解析，自動區分系統、業務、模組三層事件
 * @class
 * @abstract
 */
export class BaseManager {
  /**
   * 建立 BaseManager 實例
   * @param {Object} gameState - 遊戲狀態管理器
   * @param {Object} eventBus - 事件總線
   * @param {string} managerType - 管理器類型識別
   */
  constructor(gameState, eventBus, managerType) {
    /**
     * 遊戲狀態管理器參考
     * @type {Object}
     * @protected
     */
    this.gameState = gameState;

    /**
     * 事件總線參考
     * @type {Object}
     * @protected
     */
    this.eventBus = eventBus;

    /**
     * 管理器類型識別
     * @type {string}
     * @protected
     */
    this.managerType = managerType;

    /**
     * 初始化狀態（main.js 標準屬性）
     * @type {boolean}
     */
    this.initialized = false;

    /**
     * 管理器啟用狀態（main.js 標準屬性）
     * @type {boolean}
     */
    this.isActive = false;

    /**
     * 配置載入狀態
     * @type {boolean}
     * @protected
     */
    this.configLoaded = false;

    /**
     * 建立時間戳記
     * @type {number}
     * @private
     */
    this._createdAt = Date.now();

    /**
     * 最後更新時間戳記
     * @type {number}
     * @private
     */
    this._lastUpdated = Date.now();

    /**
     * 混合分層前綴命名規則
     * @type {EventNamingRules}
     * @private
     */
    this._eventNamingRules = {
      // 系統級前綴（系統生命週期事件，跨所有模組）
      SYSTEM_PREFIXES: ["system_", "game_", "day_"],

      // 業務領域前綴（跨模組業務流程事件）
      BUSINESS_PREFIXES: ["harvest_", "scavenge_"],

      // 模組專屬前綴（模組內部事件）
      MODULE_PREFIXES: ["resource_", "tenant_", "trade_"],
    };

    // 驗證必要依賴
    this._validateDependencies();

    console.log(
      `🏗️ ${managerType} BaseManager v2.0 混合分層前綴策略初始化完成`
    );
  }

  // ==========================================
  // 抽象方法 - 子類別必須實作
  // ==========================================

  /**
   * 取得模組事件前綴
   * 用於事件命名空間隔離，避免不同模組間的事件名稱衝突
   * @abstract
   * @returns {string} 事件前綴（如 'resource', 'trade', 'tenant'）
   * @throws {Error} 當子類別未實作此方法時
   */
  getModulePrefix() {
    throw new Error(`${this.managerType} 必須實作 getModulePrefix() 方法`);
  }

  /**
   * 設置事件監聽器
   * 子類別在此方法中註冊所需的事件監聽器
   * @abstract
   * @returns {void}
   * @throws {Error} 當子類別未實作此方法時
   */
  setupEventListeners() {
    throw new Error(`${this.managerType} 必須實作 setupEventListeners() 方法`);
  }

  /**
   * 取得管理器狀態（標準化格式，符合 main.js 期望）
   * 子類別可擴展此方法添加具體狀態資訊
   * @returns {Object} 標準化的管理器狀態物件
   */
  getStatus() {
    const baseStatus = this._getBaseStatus();

    // 確保包含 main.js 期望的標準屬性
    return {
      // main.js 標準屬性
      initialized: this.initialized,
      isActive: this.isActive,
      configLoaded: this.configLoaded,

      // BaseManager 基礎屬性
      ...baseStatus,

      // 子類別可通過 getExtendedStatus() 擴展
      ...this.getExtendedStatus(),
    };
  }

  /**
   * 取得擴展狀態資訊（子類別可覆寫）
   * @protected
   * @returns {Object} 擴展狀態物件
   */
  getExtendedStatus() {
    return {};
  }

  // ==========================================
  // 核心創新：混合分層前綴策略
  // ==========================================

  /**
   * 智慧事件前綴解析（核心演算法）
   * 根據混合分層策略自動決定事件的最終名稱
   * @private
   * @param {string} eventName - 原始事件名稱
   * @returns {string} 解析後的最終事件名稱
   */
  _resolveEventName(eventName) {
    // 1. 檢查系統級前綴（直接使用，無需模組前綴）
    if (
      this._eventNamingRules.SYSTEM_PREFIXES.some((prefix) =>
        eventName.startsWith(prefix)
      )
    ) {
      return eventName;
    }

    // 2. 檢查業務領域前綴（跨模組業務，無需模組前綴）
    if (
      this._eventNamingRules.BUSINESS_PREFIXES.some((prefix) =>
        eventName.startsWith(prefix)
      )
    ) {
      return eventName;
    }

    // 3. 檢查是否已包含任何模組前綴（避免重複添加）
    if (
      this._eventNamingRules.MODULE_PREFIXES.some((prefix) =>
        eventName.startsWith(prefix)
      )
    ) {
      return eventName;
    }

    // 4. 其他情況：添加當前模組前綴
    const modulePrefix = this.getModulePrefix();
    return `${modulePrefix}_${eventName}`;
  }

  /**
   * 檢查事件是否為跨模組事件
   * 用於日誌記錄和除錯分析
   * @private
   * @param {string} eventName - 事件名稱
   * @returns {boolean} 是否為跨模組事件
   */
  _isCrossModuleEvent(eventName) {
    return (
      this._eventNamingRules.SYSTEM_PREFIXES.some((prefix) =>
        eventName.startsWith(prefix)
      ) ||
      this._eventNamingRules.BUSINESS_PREFIXES.some((prefix) =>
        eventName.startsWith(prefix)
      )
    );
  }

  /**
   * 取得事件分類資訊
   * 用於除錯和分析
   * @private
   * @param {string} eventName - 事件名稱
   * @returns {string} 事件分類（'system'|'business'|'module'|'unknown'）
   */
  _getEventCategory(eventName) {
    if (
      this._eventNamingRules.SYSTEM_PREFIXES.some((prefix) =>
        eventName.startsWith(prefix)
      )
    ) {
      return "system";
    }
    if (
      this._eventNamingRules.BUSINESS_PREFIXES.some((prefix) =>
        eventName.startsWith(prefix)
      )
    ) {
      return "business";
    }
    if (
      this._eventNamingRules.MODULE_PREFIXES.some((prefix) =>
        eventName.startsWith(prefix)
      )
    ) {
      return "module";
    }
    return "unknown";
  }

  // ==========================================
  // 統一事件通信介面
  // ==========================================

  /**
   * 發送事件（智慧前綴處理 v2.0）
   * 使用混合分層策略自動解析最終事件名稱
   * @param {string} eventName - 事件名稱
   * @param {*} [data] - 事件資料
   * @param {Object} [options] - 事件選項
   * @param {boolean} [options.skipPrefix=false] - 是否跳過前綴處理
   * @param {boolean} [options.skipLog=false] - 是否跳過日誌記錄
   * @returns {void}
   */
  emitEvent(eventName, data = null, options = {}) {
    if (!this.eventBus) {
      console.warn(
        `⚠️ ${this.managerType} EventBus 不可用，無法發送事件: ${eventName}`
      );
      return;
    }

    try {
      // 智慧前綴解析
      const finalEventName = options.skipPrefix
        ? eventName
        : this._resolveEventName(eventName);

      // 準備事件選項，包含管理器元資料
      // 透過 options 傳遞元資料，避免包裝 data 造成嵌套
      const eventOptions = {
        ...options,
        // 管理器身份識別
        source: this.managerType,
        managerTimestamp: Date.now(),
        // 事件分類資訊
        eventCategory: this._getEventCategory(finalEventName),
        crossModule: this._isCrossModuleEvent(finalEventName),
      };

      // 直接發送實際業務資料，元資料通過 options 傳遞
      // EventBus 會將 options 合併到最終事件物件中
      // 結果：{ type, data: actualData, source, timestamp, managerTimestamp, ... }
      this.eventBus.emit(finalEventName, data, eventOptions);

      // 除錯日誌（僅在除錯模式下）
      if (!options.skipLog && this._isDebugMode()) {
        const category = this._getEventCategory(finalEventName);
        const crossModule = this._isCrossModuleEvent(finalEventName);

        console.debug(
          `📡 ${this.managerType} 發送事件: ${finalEventName}`,
          `[${category}${crossModule ? " | 跨模組" : ""}]`,
          { data, metadata: eventOptions }
        );
      }

      // 更新最後活動時間
      this._updateLastActivity();
    } catch (error) {
      console.error(
        `❌ ${this.managerType} 發送事件失敗 (${eventName}):`,
        error
      );
    }
  }

  /**
   * 監聽事件
   * 提供統一的事件監聽介面，支援智慧前綴解析
   * @param {string} eventName - 事件名稱
   * @param {Function} callback - 回調函數
   * @param {Object} [options] - 監聽選項
   * @param {boolean} [options.once=false] - 是否只監聽一次
   * @param {boolean} [options.skipPrefix=false] - 是否跳過前綴處理
   * @returns {void}
   */
  onEvent(eventName, callback, options = {}) {
    if (!this.eventBus) {
      console.warn(
        `⚠️ ${this.managerType} EventBus 不可用，無法監聽事件: ${eventName}`
      );
      return;
    }

    try {
      // 智慧前綴解析
      const finalEventName = options.skipPrefix
        ? eventName
        : this._resolveEventName(eventName);

      // 包裝回調函數以提供錯誤處理
      const wrappedCallback = (eventObj) => {
        try {
          callback(eventObj);
        } catch (error) {
          console.error(
            `❌ ${this.managerType} 事件處理器錯誤 (${finalEventName}):`,
            error
          );
        }
      };

      // 註冊事件監聽器
      if (options.once) {
        this.eventBus.once(finalEventName, wrappedCallback);
      } else {
        this.eventBus.on(finalEventName, wrappedCallback);
      }

      if (this._isDebugMode()) {
        const category = this._getEventCategory(finalEventName);
        console.debug(
          `👂 ${this.managerType} 監聽事件: ${finalEventName} [${category}]`
        );
      }
    } catch (error) {
      console.error(
        `❌ ${this.managerType} 註冊事件監聽器失敗 (${eventName}):`,
        error
      );
    }
  }

  // ==========================================
  // 統一日誌記錄介面
  // ==========================================

  /**
   * 記錄日誌
   * 統一的日誌記錄介面，自動處理多種輸出方式
   * @param {string} message - 日誌訊息
   * @param {LogType} [type='event'] - 日誌類型
   * @param {Object} [options] - 日誌選項
   * @param {boolean} [options.skipGameLog=false] - 是否跳過遊戲日誌
   * @param {boolean} [options.skipEvent=false] - 是否跳過事件發送
   * @param {boolean} [options.forceConsole=false] - 是否強制控制台輸出
   * @param {boolean} [options.forceSource=false] - 是否強制顯示來源標識（無視debug模式）
   * @returns {void}
   */
  addLog(message, type = "event", options = {}) {
    try {
      // 根據除錯模式決定是否添加管理器來源標識
      const shouldShowSource = this._isDebugMode() || options.forceSource;
      const displayMessage = shouldShowSource
        ? `[${this.managerType}] ${message}`
        : message;

      // 記錄到遊戲日誌系統
      if (
        !options.skipGameLog &&
        this.gameState &&
        typeof this.gameState.addLog === "function"
      ) {
        this.gameState.addLog(displayMessage, type);
      } else if (options.forceConsole || !this.gameState) {
        // 後備方案：控制台輸出
        console.log(`[${type.toUpperCase()}] ${displayMessage}`);
      }

      // 發送日誌事件（供其他模組監聽）
      if (!options.skipEvent) {
        this.emitEvent(
          "log_added",
          {
            message: displayMessage, // 實際顯示的訊息
            type: type,
            originalMessage: message, // 保留原始訊息
            managerType: this.managerType, // 明確提供來源資訊
            debugMode: this._isDebugMode(), // 提供模式資訊
            timestamp: new Date().toISOString(),
          },
          { skipLog: true }
        );
      }

      // 更新最後活動時間
      this._updateLastActivity();
    } catch (error) {
      // 日誌記錄失敗時的緊急處理
      console.error(`❌ ${this.managerType} 日誌記錄失敗:`, error);
      console.log(`[EMERGENCY] ${message}`);
    }
  }

  /**
   * 記錄錯誤日誌
   * 專門用於錯誤記錄的便捷方法
   * @param {string} message - 錯誤訊息
   * @param {Error|string} [error] - 錯誤物件或詳細訊息
   * @returns {void}
   */
  logError(message, error = null) {
    let fullMessage = message;

    if (error) {
      const errorDetails =
        error instanceof Error ? error.message : String(error);
      fullMessage = `${message}: ${errorDetails}`;
    }

    this.addLog(fullMessage, "danger", { forceConsole: true });

    // 如果有錯誤物件，也輸出堆疊追蹤
    if (error instanceof Error && this._isDebugMode()) {
      console.error(`${this.managerType} 錯誤堆疊:`, error.stack);
    }
  }

  /**
   * 記錄警告日誌
   * 專門用於警告記錄的便捷方法
   * @param {string} message - 警告訊息
   * @returns {void}
   */
  logWarning(message) {
    this.addLog(`⚠️ ${message}`, "event");
  }

  /**
   * 記錄成功日誌
   * 專門用於成功操作記錄的便捷方法
   * @param {string} message - 成功訊息
   * @returns {void}
   */
  logSuccess(message) {
    this.addLog(`✅ ${message}`, "rent");
  }

  // ==========================================
  // 基礎狀態管理
  // ==========================================

  /**
   * 統一初始化流程
   * 標準化所有管理器的初始化過程
   * @param {boolean} [configLoaded=true] - 配置是否成功載入
   * @returns {void}
   */
  markInitialized(configLoaded = true) {
    this.initialized = true;
    this.isActive = true; // 初始化成功即設為啟用
    this.configLoaded = configLoaded;
    this._lastUpdated = Date.now();

    const status = configLoaded ? "完全初始化" : "部分初始化（配置載入失敗）";
    console.log(`✅ ${this.managerType} ${status}完成`);

    // 發送初始化完成事件
    this.emitEvent("initialized", {
      configLoaded: configLoaded,
      initializationTime: this._lastUpdated - this._createdAt,
      managerType: this.managerType,
    });
  }

  /**
   * 標記管理器為啟用狀態
   * @returns {void}
   */
  activate() {
    this.isActive = true;
    this.logSuccess(`${this.managerType} 已啟用`);
    this.emitEvent("activated", { managerType: this.managerType });
  }

  /**
   * 標記管理器為停用狀態
   * @returns {void}
   */
  deactivate() {
    this.isActive = false;
    this.logWarning(`${this.managerType} 已停用`);
    this.emitEvent("deactivated", { managerType: this.managerType });
  }

  /**
   * 檢查是否已初始化
   * @returns {boolean} 是否已初始化
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * 檢查配置是否已載入
   * @returns {boolean} 配置是否已載入
   */
  isConfigLoaded() {
    return this.configLoaded;
  }

  // ==========================================
  // 前綴策略配置與管理
  // ==========================================

  /**
   * 更新事件命名規則
   * 允許子類別或外部配置動態調整前綴規則
   * @param {Partial<EventNamingRules>} newRules - 新的命名規則
   * @returns {void}
   */
  updateEventNamingRules(newRules) {
    this._eventNamingRules = {
      ...this._eventNamingRules,
      ...newRules,
    };

    this.logSuccess("事件命名規則已更新");

    if (this._isDebugMode()) {
      console.debug(
        `${this.managerType} 更新後的事件命名規則:`,
        this._eventNamingRules
      );
    }
  }

  /**
   * 取得當前事件命名規則
   * @returns {EventNamingRules} 當前的命名規則
   */
  getEventNamingRules() {
    return { ...this._eventNamingRules };
  }

  /**
   * 手動解析事件名稱（供外部使用）
   * @param {string} eventName - 原始事件名稱
   * @returns {string} 解析後的事件名稱
   */
  resolveEventName(eventName) {
    return this._resolveEventName(eventName);
  }

  // ==========================================
  // 私有輔助方法
  // ==========================================

  /**
   * 驗證必要依賴
   * @private
   * @returns {void}
   * @throws {Error} 當必要依賴缺失時
   */
  _validateDependencies() {
    if (!this.gameState) {
      throw new Error(`${this.managerType} 缺少必要依賴: gameState`);
    }

    if (!this.eventBus) {
      console.warn(`⚠️ ${this.managerType} 缺少 EventBus，部分功能將不可用`);
    }

    if (!this.managerType) {
      throw new Error("BaseManager 需要指定 managerType");
    }
  }

  /**
   * 取得基礎狀態資訊（符合 main.js 期望格式）
   * @private
   * @returns {BaseManagerStatus} 基礎狀態
   */
  _getBaseStatus() {
    return {
      initialized: false,
      configLoaded: false,
      managerType: this.managerType,
      version: "2.0.0",
      lastUpdated: this._lastUpdated,
      createdAt: this._createdAt,
      uptime: Date.now() - this._createdAt,
      hasGameState: !!this.gameState,
      hasEventBus: !!this.eventBus,
      eventNamingStrategy: "混合分層前綴策略",
    };
  }

  /**
   * 更新最後活動時間
   * @private
   * @returns {void}
   */
  _updateLastActivity() {
    this._lastUpdated = Date.now();
  }

  /**
   * 檢查是否為除錯模式
   * @private
   * @returns {boolean} 是否為除錯模式
   */
  _isDebugMode() {
    return (
      (typeof window !== "undefined" &&
        window.location?.search?.includes("debug=true")) ||
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("gameDebug") === "true")
    );
  }

  // ==========================================
  // 清理與銷毀
  // ==========================================

  /**
   * 清理管理器
   * 子類別可覆寫此方法以添加特定的清理邏輯
   * @returns {void}
   */
  cleanup() {
    this.initialized = false;
    this.configLoaded = false;

    this.logWarning(`${this.managerType} 已清理`);

    // 發送清理完成事件
    this.emitEvent("cleanup_completed", {
      managerType: this.managerType,
      cleanupTime: Date.now(),
    });
  }

  /**
   * 取得管理器資訊摘要
   * 用於除錯和狀態監控
   * @returns {Object} 管理器資訊摘要
   */
  getInfo() {
    return {
      managerType: this.managerType,
      initialized: this.initialized,
      configLoaded: this.configLoaded,
      createdAt: new Date(this._createdAt).toISOString(),
      lastUpdated: new Date(this._lastUpdated).toISOString(),
      uptime: Date.now() - this._createdAt,
      hasGameState: !!this.gameState,
      hasEventBus: !!this.eventBus,
      eventNamingRules: this._eventNamingRules,
      version: "2.0.0",
    };
  }

  /**
   * 除錯：顯示事件前綴解析示例
   * @returns {void}
   */
  debugEventNaming() {
    if (!this._isDebugMode()) return;

    console.group(`🔍 ${this.managerType} 事件前綴解析示例`);

    const testEvents = [
      "system_ready", // 系統級
      "harvest_completed", // 業務領域
      "resource_modified", // 已有模組前綴
      "threshold_warning", // 需要添加模組前綴
      "custom_event", // 需要添加模組前綴
    ];

    testEvents.forEach((event) => {
      const resolved = this._resolveEventName(event);
      const category = this._getEventCategory(resolved);
      const crossModule = this._isCrossModuleEvent(resolved);

      console.log(
        `${event} → ${resolved}`,
        `[${category}${crossModule ? " | 跨模組" : ""}]`
      );
    });

    console.groupEnd();
  }
}

export default BaseManager;

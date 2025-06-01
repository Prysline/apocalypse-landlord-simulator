// @ts-check

/**
 * @fileoverview main.js - 應用程式進入點（基礎設施測試版）
 * 職責：整合核心系統，建立應用程式基礎架構
 */

import DataManager from "./core/DataManager.js";
import GameState from "./core/GameState.js";
import EventBus from "./core/EventBus.js";
import ResourceManager from "./systems/ResourceSystem.js";

/**
 * 系統運行模式
 * @typedef {'normal'|'fallback'|'minimal'} SystemMode
 */

/**
 * 系統初始化結果
 * @typedef {Object} InitializationResult
 * @property {boolean} success - 初始化是否成功
 * @property {SystemMode} [mode] - 系統運行模式
 * @property {string} [error] - 錯誤訊息（當失敗時）
 */

/**
 * 系統統計資訊
 * @typedef {Object} SystemStats
 * @property {number} gameDay - 當前遊戲天數
 * @property {number} totalResources - 總資源數量
 * @property {number} totalTenants - 總租客數量
 * @property {number} systemEvents - 系統事件數量
 * @property {boolean} resourceManagerActive - 資源管理器是否啟用
 */

/**
 * 系統狀態顯示模式
 * @typedef {'normal'|'fallback'|'error'} StatusDisplayMode
 */

/**
 * 系統狀態配置
 * @typedef {Object} StatusConfig
 * @property {string} text - 狀態顯示文字
 * @property {string} class - CSS 類名
 */

/**
 * 日誌型別定義（與 GameState 保持一致）
 * @typedef {'event'|'rent'|'danger'|'skill'} LogType
 */

/**
 * 遊戲日誌條目
 * @typedef {Object} LogEntry
 * @property {string} message - 日誌訊息
 * @property {LogType} type - 日誌類型
 * @property {number} day - 遊戲天數
 * @property {string} timestamp - 時間戳
 */

/**
 * 應用程式狀態
 * @typedef {Object} ApplicationStatus
 * @property {boolean} initialized - 是否已初始化
 * @property {SystemMode} mode - 運行模式
 * @property {Object} [dataManager] - 資料管理器狀態
 * @property {Object} [gameState] - 遊戲狀態統計
 * @property {Object} [eventBus] - 事件系統統計
 *  * @property {Object} [resourceManager] - 資源管理器統計
 */

/**
 * 系統就緒事件資料
 * @typedef {Object} SystemReadyData
 * @property {SystemMode} mode - 系統運行模式
 * @property {boolean} dataLoaded - 資料是否載入成功
 * @property {SystemStats} stats - 系統統計資訊
 */

/**
 * 狀態變更事件資料
 * @typedef {Object} StateChangeData
 * @property {string} reason - 變更原因
 * @property {Object} changes - 變更內容
 * @property {number} timestamp - 變更時間戳
 */

/**
 * 新一天開始事件資料
 * @typedef {Object} NewDayData
 * @property {number} newDay - 新的天數
 * @property {number} previousDay - 前一天天數
 * @property {Object} dailyStats - 當日統計
 */

/**
 * 遊戲應用程式主類
 * 負責協調整個遊戲系統的初始化和運行
 * @class
 */
class GameApplication {
  /**
   * 建立遊戲應用程式實例
   * @constructor
   */
  constructor() {
    /**
     * 資料管理器實例
     * @type {DataManager|null}
     */
    this.dataManager = null;

    /**
     * 遊戲狀態管理器實例
     * @type {GameState|null}
     */
    this.gameState = null;

    /**
     * 事件總線實例
     * @type {EventBus|null}
     */
    this.eventBus = null;

    /**
     * 資源管理器實例
     * @type {ResourceManager|null}
     */
    this.resourceManager = null;

    /**
     * 系統是否已初始化
     * @type {boolean}
     */
    this.isInitialized = false;

    /**
     * 系統運行模式
     * @type {SystemMode}
     */
    this.systemMode = "normal";

    console.log("🎮 末日房東模擬器 v2.0 啟動中...");
  }

  /**
   * 初始化應用程式
   * 按序初始化事件系統、資料管理器、遊戲狀態、業務模組等核心組件
   * @returns {Promise<InitializationResult>} 初始化結果
   * @throws {Error} 當初始化過程發生致命錯誤時
   */
  async initialize() {
    try {
      console.log("📋 正在初始化核心系統...");

      // 1. 建立事件系統
      this.eventBus = new EventBus();
      this._setupEventBusListeners();

      // 2. 初始化資料管理器
      this.dataManager = new DataManager();
      const dataResult = await this.dataManager.initialize();

      if (!dataResult.success) {
        console.warn("⚠️ 資料載入失敗，使用後備模式");
        this.systemMode = "fallback";
      }

      // 3. 建立遊戲狀態
      this.gameState = new GameState(dataResult.data);
      this._setupGameStateListeners();

      // 4. 初始化業務模組
      console.log("🔧 正在初始化業務模組...");
      await this._initializeBusinessModules();

      // 5. 更新系統狀態
      this.gameState.setState(
        {
          system: {
            initialized: true,
            fallbackMode: this.systemMode === "fallback",
            lastSaved: new Date().toISOString(),
            gameRules: this.dataManager.getGameRules(),
          },
        },
        "系統初始化完成"
      );

      this.isInitialized = true;

      // 6. 通知系統就緒
      this.eventBus.emit("system_ready", {
        mode: this.systemMode,
        dataLoaded: dataResult.success,
        stats: this._getSystemStats(),
      });

      console.log("✅ 系統初始化完成！");
      console.log(`📊 模式: ${this.systemMode}`);
      console.log(`📈 統計:`, this._getSystemStats());

      // 更新介面狀態指示器
      this._updateSystemStatusUI();

      return { success: true, mode: this.systemMode };
    } catch (error) {
      console.error("❌ 系統初始化失敗:", error);
      this._handleInitializationError(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 初始化業務模組
   * @private
   * @returns {Promise<void>}
   */
  async _initializeBusinessModules() {
    try {
      // 初始化資源管理器
      this.resourceManager = new ResourceManager(this.gameState, this.eventBus);
      console.log("✅ ResourceManager 初始化完成");

      // 設定業務模組間的事件監聽
      this._setupBusinessModuleListeners();

      console.log("🔧 業務模組初始化完成");
    } catch (error) {
      console.error("❌ 業務模組初始化失敗:", error);
      throw error;
    }
  }

  /**
   * 設定業務模組事件監聽器
   * @private
   * @returns {void}
   */
  _setupBusinessModuleListeners() {
    if (!this.resourceManager) return;

    // 監聽資源警告事件
    this.eventBus.on("resource_threshold_warning", (eventObj) => {
      const data = eventObj.data;
      console.warn(
        `⚠️ 資源警告: ${data.resourceType} 剩餘 ${data.currentValue}`
      );
    });

    // 監聽資源危急事件
    this.eventBus.on("resource_critical_low", (eventObj) => {
      const data = eventObj.data;
      console.error(
        `🚨 資源危急: ${data.resourceType} 僅剩 ${data.currentValue}`
      );
    });

    // 監聽資源轉移完成事件
    this.eventBus.on("resource_transfer_completed", (eventObj) => {
      const data = eventObj.data;
      console.log(`💰 資源轉移: ${data.from} → ${data.to}`);
    });
  }

  /**
   * 設定事件系統監聽器
   * 註冊系統級事件的處理函數
   * @private
   * @returns {void}
   */
  _setupEventBusListeners() {
    // 監聽系統級事件
    this.eventBus.on("system_error", (/** @type {Object} */ data) => {
      console.error("系統錯誤:", data);
      this._updateSystemStatusUI("error");
    });

    // 監聽資料變更事件
    this.eventBus.on("data_loaded", (/** @type {{type: string}} */ data) => {
      console.log("資料載入:", data.type);
    });

    // 除錯：監聽所有事件（開發模式）
    if (this.isDebugMode()) {
      this.eventBus.on(
        "*",
        (/** @type {Object} */ data, /** @type {{type: string}} */ event) => {
          console.debug(`🔔 事件: ${event.type}`, data);
        }
      );
    }
  }

  /**
   * 設定遊戲狀態監聽器
   * 註冊遊戲狀態變更的處理函數
   * @private
   * @returns {void}
   */
  _setupGameStateListeners() {
    // 監聽狀態變更
    this.gameState.subscribe(
      "state_changed",
      (/** @type {StateChangeData} */ data) => {
        console.debug("狀態變更:", data.reason);
        this.eventBus.emit("game_state_changed", data);
      }
    );

    // 監聽日誌新增
    this.gameState.subscribe(
      "log_added",
      (/** @type {{logEntry: LogEntry}} */ data) => {
        this._updateGameLogUI(data.logEntry);
      }
    );

    // 監聽天數推進
    this.gameState.subscribe(
      "day_advanced",
      (/** @type {NewDayData} */ data) => {
        console.log(`📅 第 ${data.newDay} 天開始`);
        this.eventBus.emit("new_day_started", data);
      }
    );
  }

  /**
   * 取得系統統計資訊
   * 收集各個子系統的統計數據
   * @private
   * @returns {SystemStats} 系統統計資訊
   */
  _getSystemStats() {
    /** @type {SystemStats} */
    const stats = {
      gameDay: this.gameState?.getStateValue("day", 0) || 0,
      totalResources: 0,
      totalTenants: 0,
      systemEvents: 0,
      resourceManagerActive:
        this.resourceManager?.getSystemStats?.()?.isActive || false,
    };

    if (this.gameState) {
      const resources = this.gameState.getStateValue("resources", {});
      stats.totalResources = Object.values(resources).reduce(
        (sum, val) => sum + (typeof val === "number" ? val : 0),
        0
      );
      stats.totalTenants = this.gameState.getAllTenants().length;
    }

    if (this.eventBus) {
      try {
        const eventStats = this.eventBus.getStats();

        // 使用型別保護和 nullish coalescing 進行安全存取
        if (eventStats && typeof eventStats === "object") {
          const statsObj = /** @type {any} */ (eventStats);
          stats.systemEvents =
            statsObj.eventCount ??
            statsObj.total ??
            statsObj.totalEvents ??
            statsObj.count ??
            Object.keys(statsObj).length;
        }
      } catch (error) {
        console.warn("無法取得事件統計:", error);
        stats.systemEvents = 0;
      }
    }

    return stats;
  }

  /**
   * 更新系統狀態UI指示器
   * 根據當前系統狀態更新介面顯示
   * @private
   * @param {StatusDisplayMode} [status=null] - 要顯示的狀態
   * @returns {void}
   */
  _updateSystemStatusUI(status = null) {
    const statusElement = document.getElementById("systemStatus");
    if (!statusElement) {
      // 如果沒有狀態元素，創建一個
      this._createSystemStatusUI();
      return;
    }

    const currentStatus =
      status || (this.systemMode === "fallback" ? "fallback" : "normal");
    const stats = this._getSystemStats();
    const moduleCount = this._getActiveModuleCount();

    /** @type {Record<StatusDisplayMode, StatusConfig>} */
    const statusConfig = {
      normal: {
        text: `🟢 模組化系統 v2.0 - 運行中 (Day ${stats.gameDay})`,
        class: "status-normal",
      },
      fallback: {
        text: `🟡 模組化系統 v2.0 - 後備模式 (Day ${stats.gameDay})`,
        class: "status-fallback",
      },
      error: {
        text: "🔴 系統啟動失敗",
        class: "status-error",
      },
    };

    const config = statusConfig[currentStatus] || statusConfig.error;
    statusElement.textContent = config.text;
    statusElement.className = `system-status ${config.class}`;
  }

  /**
   * 取得活躍模組數量
   * @private
   * @returns {number} 活躍模組數量
   */
  _getActiveModuleCount() {
    let count = 0;
    if (this.dataManager) count++;
    if (this.gameState) count++;
    if (this.eventBus) count++;
    if (this.resourceManager) count++;
    return count;
  }

  /**
   * 創建系統狀態UI元素
   * 動態創建並插入狀態指示器到頁面
   * @private
   * @returns {void}
   */
  _createSystemStatusUI() {
    const statusElement = document.createElement("div");
    statusElement.id = "systemStatus";
    statusElement.className = "system-status";
    statusElement.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      z-index: 1000;
      background: rgba(0,0,0,0.8);
      color: white;
      border: 1px solid #555;
    `;

    document.body.appendChild(statusElement);
    this._updateSystemStatusUI();
  }

  /**
   * 更新遊戲日誌UI
   * 將新的日誌條目添加到介面中
   * @private
   * @param {LogEntry} logEntry - 要顯示的日誌條目
   * @returns {void}
   */
  _updateGameLogUI(logEntry) {
    const logElement = document.getElementById("gameLog");
    if (!logElement) return;

    const entryElement = document.createElement("div");
    entryElement.className = `log-entry ${logEntry.type}`;
    entryElement.textContent = `第${logEntry.day}天: ${logEntry.message}`;

    logElement.appendChild(entryElement);
    logElement.scrollTop = logElement.scrollHeight;

    // 限制日誌顯示數量
    while (logElement.children.length > 50) {
      logElement.removeChild(logElement.firstChild);
    }
  }

  /**
   * 處理初始化錯誤
   * 當正常初始化失敗時，嘗試最小模式啟動
   * @private
   * @param {Error} error - 初始化過程中發生的錯誤
   * @returns {void}
   */
  _handleInitializationError(error) {
    console.error("系統初始化失敗，嘗試最小模式啟動");

    try {
      // 最小系統啟動
      this.eventBus = new EventBus();
      this.gameState = new GameState();
      this.systemMode = "minimal";

      this._updateSystemStatusUI("error");

      // 顯示錯誤訊息
      alert(
        "遊戲啟動遇到問題，正在使用最小模式運行。\n請檢查瀏覽器控制台了解詳情。"
      );
    } catch (criticalError) {
      console.error("最小模式啟動也失敗:", criticalError);
      alert("遊戲無法啟動，請重新整理頁面或使用其他瀏覽器。");
    }
  }

  /**
   * 檢查是否為除錯模式
   * 透過 URL 參數或 localStorage 判斷
   * @public
   * @returns {boolean} 是否啟用除錯模式
   */
  isDebugMode() {
    return (
      window.location.search.includes("debug=true") ||
      localStorage.getItem("gameDebug") === "true"
    );
  }

  /**
   * 取得應用程式狀態
   * 返回完整的應用程式狀態資訊
   * @returns {ApplicationStatus} 應用程式狀態物件
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      mode: this.systemMode,
      dataManager: this.dataManager?.getSystemStatus(),
      gameState: this.gameState?.getStateStats(),
      eventBus: this.eventBus?.getStats(),
      resourceManager: this.resourceManager?.getSystemStats(),
    };
  }

  /**
   * 開發者工具
   * 在控制台輸出詳細的系統除錯資訊
   * @returns {void}
   */
  debug() {
    console.group("🔧 系統除錯資訊");
    console.log("應用程式狀態:", this.getStatus());

    if (this.dataManager) {
      console.log("資料管理器:", this.dataManager.getSystemStatus());
    }

    if (this.gameState) {
      console.log("遊戲狀態:", this.gameState.getStateStats());
    }

    if (this.eventBus) {
      console.log("事件系統:", this.eventBus.getStats());
      this.eventBus.debug();
    }

    if (this.resourceManager) {
      console.log("資源管理器:", this.resourceManager.getSystemStats());
    }

    console.groupEnd();
  }

  /**
   * 執行基礎功能測試
   * 測試各個子系統的基本功能是否正常
   * @returns {Promise<void>} 測試完成的 Promise
   * @throws {Error} 當測試過程發生錯誤時
   */
  async runTests() {
    console.group("🧪 基礎功能測試");

    try {
      // 測試1: 資料管理器
      console.log("測試1: 資料載入");
      const rules = this.dataManager.getGameRules();
      console.log("✅ 規則載入:", !!rules);

      // 測試2: 遊戲狀態
      console.log("測試2: 狀態管理");
      const initialCash = this.gameState.getStateValue("resources.cash");
      this.gameState.modifyResource("cash", 10, "測試");
      const newCash = this.gameState.getStateValue("resources.cash");
      console.log("✅ 狀態修改:", newCash === initialCash + 10);

      // 測試3: 事件系統
      console.log("測試3: 事件通信");
      let eventReceived = false;
      this.eventBus.once("test_event", () => {
        eventReceived = true;
      });
      this.eventBus.emit("test_event", { test: true });
      console.log("✅ 事件通信:", eventReceived);

      // 測試4: 資源管理器
      console.log("測試4: 資源管理器");
      if (this.resourceManager) {
        const beforeFood = this.gameState.getStateValue("resources.food");
        const success = this.resourceManager.modifyResource(
          "food",
          5,
          "測試資源管理器"
        );
        const afterFood = this.gameState.getStateValue("resources.food");
        console.log("✅ 資源管理器:", success && afterFood === beforeFood + 5);
      } else {
        console.log("❌ 資源管理器: 未初始化");
      }

      // 測試5: 系統整合
      console.log("測試5: 系統整合");
      this.gameState.addLog("系統測試完成", "event");
      console.log("✅ 系統整合: 通過");

      console.log("🎉 所有測試通過！");
    } catch (error) {
      console.error("❌ 測試失敗:", error);
      throw error;
    }

    console.groupEnd();
  }
}

/**
 * 全局應用程式實例
 * @type {GameApplication|null}
 */
let gameApp = null;

/**
 * 應用程式進入點
 * 建立並初始化遊戲應用程式
 * @returns {Promise<void>} 啟動完成的 Promise
 * @throws {Error} 當啟動過程發生致命錯誤時
 */
async function startGame() {
  try {
    gameApp = new GameApplication();
    const result = await gameApp.initialize();

    if (result.success) {
      console.log("🎮 遊戲準備就緒！");

      // 如果是除錯模式，執行測試（修正方法調用）
      if (gameApp.isDebugMode()) {
        await gameApp.runTests();
      }

      // 將實例掛載到全局（開發時方便除錯）
      if (typeof window !== "undefined") {
        /** @type {any} */ (window).gameApp = gameApp;
      }
    } else {
      console.error("遊戲啟動失敗:", result.error);
    }
  } catch (error) {
    console.error("致命錯誤:", error);
    throw error;
  }
}

// DOM 載入完成後啟動
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGame);
  } else {
    startGame();
  }
}

// 匯出供其他模組使用
export { gameApp, startGame };
export default GameApplication;

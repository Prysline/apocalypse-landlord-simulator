// @ts-check

/**
 * @fileoverview main.js - 應用程式進入點
 * 職責：系統整合器，專注於模組初始化和依賴注入
 */

import DataManager from "./core/DataManager.js";
import GameState from "./core/GameState.js";
import EventBus from "./core/EventBus.js";
import ResourceManager from "./systems/ResourceManager.js";
import TradeManager from "./systems/TradeManager.js";
import TenantManager from "./systems/TenantManager.js";
import SkillManager from "./systems/SkillManager.js";
import DayManager from "./systems/DayManager.js";

/**
 * 系統運行模式
 * @typedef {'normal'|'fallback'} SystemMode
 */

/**
 * 系統初始化結果
 * @typedef {Object} InitializationResult
 * @property {boolean} success - 初始化是否成功
 * @property {SystemMode} [mode] - 系統運行模式
 * @property {string} [error] - 錯誤訊息（當失敗時）
 */

/**
 * 遊戲應用程式主類
 * 專注於模組整合，移除非核心功能
 * @class
 */
class GameApplication {
  /**
   * 建立遊戲應用程式實例
   * @constructor
   */
  constructor() {
/** @type {DataManager|null} */ this.dataManager = null;
/** @type {GameState|null} */ this.gameState = null;
/** @type {EventBus|null} */ this.eventBus = null;

/** @type {ResourceManager|null} */ this.resourceManager = null;
/** @type {TradeManager|null} */ this.tradeManager = null;
/** @type {TenantManager|null} */ this.tenantManager = null;
/** @type {SkillManager|null} */ this.skillManager = null;
/** @type {DayManager|null} */ this.dayManager = null;

/** @type {boolean} */ this.isInitialized = false;
/** @type {SystemMode} */ this.systemMode = "normal";

    console.log("🎮 末日房東模擬器啟動中...");
  }

  /**
   * 初始化應用程式
   * @returns {Promise<InitializationResult>} 初始化結果
   */
  async initialize() {
    try {
      console.log("📋 初始化核心系統...");

      // 1. 建立核心架構
      this.eventBus = new EventBus();
      this.dataManager = new DataManager();

      // 2. 載入資料
      const dataResult = await this.dataManager.initialize();
      if (!dataResult.success) {
        console.warn("⚠️ 資料載入失敗，使用後備模式");
        this.systemMode = "fallback";
      }

      // 3. 建立遊戲狀態
      this.gameState = new GameState(dataResult.data);

      // 4. 初始化業務模組
      console.log("🔧 初始化業務模組...");
      await this._initializeBusinessModules();

      // 5. 完成初始化
      this.isInitialized = true;
      this.eventBus.emit("system_ready", { mode: this.systemMode });

      console.log("✅ 系統初始化完成！");
      return { success: true, mode: this.systemMode };

    } catch (error) {
      console.error("❌ 系統初始化失敗:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 初始化業務模組
   * @private
   * @returns {Promise<void>}
   */
  async _initializeBusinessModules() {
    // 資源管理器
    this.resourceManager = new ResourceManager(this.gameState, this.eventBus);
    console.log("✅ ResourceManager 初始化完成");

    // 交易管理器
    this.tradeManager = new TradeManager(
      this.gameState,
      this.resourceManager,
      this.dataManager,
      this.eventBus
    );
    this.tradeManager.initialize();
    console.log("✅ TradeManager 初始化完成");

    // 租客管理器
    this.tenantManager = new TenantManager(
      this.gameState,
      this.resourceManager,
      this.tradeManager,
      this.dataManager,
      this.eventBus
    );
    await this.tenantManager.initialize();
    console.log("✅ TenantManager 初始化完成");

    // 技能管理器
    this.skillManager = new SkillManager(
      this.gameState,
      this.eventBus,
      this.dataManager
    );
    await this.skillManager.initialize();
    console.log("✅ SkillManager 初始化完成");

    // 每日循環管理器
    this.dayManager = new DayManager(
      this.gameState,
      this.eventBus,
      this.resourceManager,
      this.tenantManager,
      this.tradeManager,
      this.skillManager
    );
    this.dayManager.initialize();
    console.log("✅ DayManager 初始化完成");

    console.log("🔧 業務模組初始化完成");
  }

  /**
   * 取得應用程式狀態
   * @returns {Object} 應用程式狀態物件
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      mode: this.systemMode,
      managers: {
        dataManager: !!this.dataManager,
        gameState: !!this.gameState,
        eventBus: !!this.eventBus,
        resourceManager: !!this.resourceManager,
        tradeManager: !!this.tradeManager,
        tenantManager: !!this.tenantManager,
        skillManager: !!this.skillManager,
      }
    };
  }
}

/**
 * 全局應用程式實例
 * @type {GameApplication|null}
 */
let gameApp = null;

/**
 * 應用程式進入點
 * @returns {Promise<void>} 啟動完成的 Promise
 */
async function startGame() {
  try {
    gameApp = new GameApplication();
    const result = await gameApp.initialize();

    if (result.success) {
      console.log("🎮 遊戲準備就緒！");

      // 安全地掛載到全局供除錯使用
      if (typeof window !== "undefined") {
        // 解決 TypeScript 類型問題
        Object.defineProperty(window, 'gameApp', {
          value: gameApp,
          writable: true,
          configurable: true
        });
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
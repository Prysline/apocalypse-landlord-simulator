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
import systemLogger from "./utils/SystemLogger.js";
import loadingManager from "./core/LoadingManager.js";

/**
 * @typedef {import('../js/core/LoadingManager.js').LoadingStep} LoadingStep
 * /

/**
 * 系統初始化結果
 * @typedef {Object} InitializationResult
 * @property {boolean} success - 初始化是否成功
 * @property {boolean} debugMode - 是否啟用除錯模式
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
/** @type {boolean} */ this.debugMode = this._detectDebugMode();

    // 初始化全域除錯模式
    this._initializeDebugMode();

    systemLogger.info("🎮 末日房東模擬器啟動中...");
  }

  /**
   * 檢測除錯模式
   * @private
   * @returns {boolean} 是否啟用除錯模式
   */
  _detectDebugMode() {
    if (typeof window !== 'undefined') {
      // 檢查 URL 參數
      const urlParams = new URLSearchParams(window.location.search);
      const debugFromUrl = urlParams.get('debug') === 'true';

      // 檢查 localStorage（作為持久化選項）
      const debugFromStorage = localStorage.getItem('gameDebug') === 'true';

      return debugFromUrl || debugFromStorage;
    }
    return false;
  }

  /**
   * 初始化全域除錯模式
   * @private
   * @returns {void}
   */
  _initializeDebugMode() {
    // 設定 SystemLogger 除錯模式
    systemLogger.setDebugMode(this.debugMode);

    if (this.debugMode) {
      systemLogger.debug("🔍 除錯模式已啟用");
      systemLogger.debug(`除錯來源: URL=${new URLSearchParams(window.location.search).get('debug') === 'true'}, Storage=${localStorage.getItem('gameDebug') === 'true'}`);
    }
  }

  /**
   * 初始化應用程式
   * @returns {Promise<InitializationResult>} 初始化結果
   */
  async initialize() {
    // 定義初始化步驟結構
    /** @type {Array<LoadingStep>} 初始化步驟 */
    const initializationSteps = [
      { id: 'core_infrastructure', name: '建立核心架構', completed: false },
      { id: 'data_loading', name: '載入遊戲資料', completed: false },
      { id: 'game_state', name: '建立遊戲狀態', completed: false },
      { id: 'business_modules', name: '初始化業務模組', completed: false },
      { id: 'system_finalization', name: '完成系統初始化', completed: false }
    ];

    // 載入管理器配置
    const loadingConfig = {
      showProgress: true,
      lockUI: true,
      timeout: 15000,  // 15秒超時，考慮業務模組初始化時間
      loadingText: '末日房東系統初始化中...'
    };

    try {
      // 啟動載入流程
      const loadingStarted = await loadingManager.startInitialization(initializationSteps, loadingConfig);
      if (!loadingStarted) {
        throw new Error('載入管理器啟動失敗');
      }

      systemLogger.info("📋 初始化核心系統...");

      // === 階段1: 建立核心架構 ===
      systemLogger.info("🏗️ 建立核心基礎設施");
      this.eventBus = new EventBus();
      this.dataManager = new DataManager();
      loadingManager.updateProgress('core_infrastructure');

      // === 階段2: 載入遊戲資料 ===
      systemLogger.info("📊 開始載入遊戲資料");
      let dataResult;
      try {
        dataResult = await this.dataManager.initialize();
        if (!dataResult.success) {
          throw new Error("資料載入失敗，無法繼續初始化");
        }
        loadingManager.updateProgress('data_loading');
        systemLogger.success("✅ 遊戲資料載入完成");
      } catch (error) {
        systemLogger.error("資料載入階段失敗", error);
        loadingManager.updateProgress('data_loading', false, error.message);
        throw error;  // 資料載入失敗則無法繼續
      }

      // === 階段3: 建立遊戲狀態 ===
      systemLogger.info("🎮 建立遊戲狀態管理");
      try {
        this.gameState = new GameState(dataResult.data);
        loadingManager.updateProgress('game_state');
      } catch (error) {
        systemLogger.error("遊戲狀態建立失敗", error);
        loadingManager.updateProgress('game_state', false, error.message);
        throw error;  // 遊戲狀態失敗則無法繼續
      }

      // === 階段4: 初始化業務模組 ===
      systemLogger.info("🔧 初始化業務邏輯模組");
      try {
        await this._initializeBusinessModules();
        loadingManager.updateProgress('business_modules');
      } catch (error) {
        systemLogger.error("業務模組初始化失敗", error);
        loadingManager.updateProgress('business_modules', false, error.message);
        throw error;
      }

      // === 階段5: 完成系統初始化 ===
      systemLogger.info("✨ 完成系統初始化");
      this.isInitialized = true;
      this.eventBus.emit("system_ready", {
        debugMode: this.debugMode,
        timestamp: new Date().toISOString()
      });
      loadingManager.updateProgress('system_finalization');

      // 完成載入流程
      loadingManager.finishInitialization();

      systemLogger.success(`🎉 系統初始化完成！${this.debugMode ? '（除錯模式）' : ''}`);
      return {
        success: true,
        debugMode: this.debugMode
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      systemLogger.error("❌ 系統初始化失敗", error);

      // 取消載入流程
      loadingManager.cancelInitialization(`初始化失敗: ${errorMessage}`);

      return { success: false, debugMode: this.debugMode, error: errorMessage };
    }
  }

  /**
   * 初始化業務模組
   * @private
   * @returns {Promise<void>}
   */
  async _initializeBusinessModules() {
    const moduleInitializers = [
      {
        name: 'ResourceManager',
        initializer: () => {
          this.resourceManager = new ResourceManager(this.gameState, this.eventBus);
          return Promise.resolve();
        }
      },
      {
        name: 'TenantManager',
        initializer: async () => {
          this.tenantManager = new TenantManager(
            this.gameState,
            this.resourceManager,
            this.dataManager,
            this.eventBus
          );
          await this.tenantManager.initialize();
        }
      },
      {
        name: 'TradeManager',
        initializer: async () => {
          this.tradeManager = new TradeManager(
            this.gameState,
            this.resourceManager,
            this.tenantManager,
            this.dataManager,
            this.eventBus
          );
          await this.tradeManager.initialize();
          
          // 設置探索管理器給租客管理器（啟用自主探索功能）
          if (this.tradeManager.explorationManager) {
            await this.tenantManager.setExplorationManager(this.tradeManager.explorationManager);
            systemLogger.info("✅ 自主探索功能已啟用");
          } else {
            systemLogger.warn("⚠️ 探索管理器未初始化，自主探索功能將禁用");
          }
        }
      },
      {
        name: 'SkillManager',
        initializer: async () => {
          this.skillManager = new SkillManager(
            this.gameState,
            this.eventBus,
            this.dataManager,
            this.resourceManager
          );
          await this.skillManager.initialize();
        }
      },
      {
        name: 'DayManager',
        initializer: () => {
          this.dayManager = new DayManager(
            this.gameState,
            this.eventBus,
            this.resourceManager,
            this.tenantManager,
            this.tradeManager,
            this.skillManager
          );
          this.dayManager.initialize();
          return Promise.resolve();
        }
      }
    ];

    // 逐一初始化模組，提供詳細錯誤資訊
    for (const { name, initializer } of moduleInitializers) {
      try {
        systemLogger.info(`正在初始化 ${name}...`);
        await initializer();
        systemLogger.success(`✅ ${name} 初始化完成`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        systemLogger.error(`❌ ${name} 初始化失敗: ${errorMessage}`, error);
        throw new Error(`${name} 初始化失敗: ${errorMessage}`);
      }
    }

    systemLogger.success("🔧 所有業務模組初始化完成");
  }

  /**
   * 取得應用程式狀態
   * @returns {Object} 應用程式狀態物件
   */
  getStatus() {
    const loadingStatus = loadingManager.getStatus();

    return {
      initialized: this.isInitialized,
      debugMode: this.debugMode,
      loading: {
        isLoading: loadingStatus.isLoading,
        progress: loadingStatus.progress,
        currentStep: loadingStatus.completedSteps + '/' + loadingStatus.totalSteps
      },
      managers: {
        dataManager: !!this.dataManager,
        gameState: !!this.gameState,
        eventBus: !!this.eventBus,
        resourceManager: !!this.resourceManager,
        tradeManager: !!this.tradeManager,
        tenantManager: !!this.tenantManager,
        skillManager: !!this.skillManager,
        dayManager: !!this.dayManager,
      },
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
      systemLogger.success("🎮 遊戲準備就緒！");

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
      systemLogger.error("遊戲啟動失敗:", result.error);
    }
  } catch (error) {
    systemLogger.error("致命錯誤:", error);
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
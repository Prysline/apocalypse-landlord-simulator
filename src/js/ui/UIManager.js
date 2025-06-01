/**
 * UIManager - UI系統統一協調模組
 * 職責：UI模組整合、狀態同步、事件協調、系統監控
 */

import { InteractionHandler } from "./InteractionHandler.js";
import { ModalManager } from "./ModalManager.js";
import { DisplayUpdater } from "./DisplayUpdater.js";
import { UI_CONSTANTS, EVENT_TYPES } from "../utils/constants.js";

export class UIManager extends EventTarget {
  constructor(gameInstance) {
    super();

    // 核心依賴
    this.game = gameInstance;

    // UI模組實例
    this.interactionHandler = null;
    this.modalManager = null;
    this.displayUpdater = null;

    // 整合狀態
    this.isInitialized = false;
    this.moduleStatus = {
      interactionHandler: false,
      modalManager: false,
      displayUpdater: false,
      integration: false,
    };

    // 系統監控
    this.systemMetrics = {
      initializationTime: 0,
      lastUpdateTime: 0,
      totalInteractions: 0,
      uiErrors: 0,
    };

    // 配置參數
    this.config = {
      enableEventLogging: false,
      autoCleanupInterval: 300000, // 5分鐘
      errorThreshold: 10,
      enablePerformanceMonitoring: false,
    };

    console.log("🎨 UIManager 建構完成");
  }

  /**
   * 初始化 UI 系統
   */
  async initialize() {
    const startTime = Date.now();
    
    try {
      console.log("🎨 正在初始化 UIManager...");

      // 階段 1：初始化各個 UI 模組
      await this.initializeUIModules();

      // 階段 2：建立模組間整合
      this.establishModuleIntegration();

      // 階段 3：設定系統事件監聽
      this.setupSystemEventListeners();

      // 階段 4：啟動系統監控
      this.startSystemMonitoring();

      // 完成初始化
      this.isInitialized = true;
      this.moduleStatus.integration = true;
      this.systemMetrics.initializationTime = Date.now() - startTime;

      console.log(`✅ UIManager 初始化完成 (耗時 ${this.systemMetrics.initializationTime}ms)`);
      
      // 發送初始化完成事件
      this.dispatchEvent(new CustomEvent('uiSystemReady', {
        detail: { 
          initTime: this.systemMetrics.initializationTime,
          moduleStatus: this.moduleStatus
        }
      }));

      return true;
    } catch (error) {
      console.error("❌ UIManager 初始化失敗:", error);
      this.systemMetrics.uiErrors++;
      return false;
    }
  }

  /**
   * 初始化各個 UI 模組
   */
  async initializeUIModules() {
    console.log("🔧 正在初始化 UI 模組...");

    // 初始化 DisplayUpdater
    this.displayUpdater = new DisplayUpdater(this.game);
    const displaySuccess = this.displayUpdater.initialize(this.game.gameHelpers);
    this.moduleStatus.displayUpdater = displaySuccess;

    // 初始化 InteractionHandler
    this.interactionHandler = new InteractionHandler(this.game);
    const interactionSuccess = this.interactionHandler.initialize();
    this.moduleStatus.interactionHandler = interactionSuccess;

    // 初始化 ModalManager
    this.modalManager = new ModalManager(this.game);
    const modalSuccess = this.modalManager.initialize();
    this.moduleStatus.modalManager = modalSuccess;

    // 系統狀態報告
    console.log(
      displaySuccess ? "✅ DisplayUpdater 初始化成功" : "⚠️ DisplayUpdater 初始化失敗"
    );
    console.log(
      interactionSuccess ? "✅ InteractionHandler 初始化成功" : "⚠️ InteractionHandler 初始化失敗"
    );
    console.log(
      modalSuccess ? "✅ ModalManager 初始化成功" : "⚠️ ModalManager 初始化失敗"
    );

    const successCount = [displaySuccess, interactionSuccess, modalSuccess].filter(Boolean).length;
    console.log(`📊 UI 模組初始化完成 (${successCount}/3 成功)`);
  }

  /**
   * 建立模組間整合
   */
  establishModuleIntegration() {
    console.log("🔗 正在建立模組間整合...");

    // InteractionHandler 與 ModalManager 整合
    if (this.interactionHandler && this.modalManager) {
      this.interactionHandler.setModalManager(this.modalManager);
      console.log("🤝 InteractionHandler ↔ ModalManager 整合完成");
    }

    // 設定模組間事件監聽
    this.setupInterModuleEventListeners();

    // 建立統一的 UI 函數代理
    this.setupUnifiedUIProxies();

    console.log("✅ 模組間整合建立完成");
  }

  /**
   * 設定模組間事件監聽
   */
  setupInterModuleEventListeners() {
    // DisplayUpdater 事件監聽
    if (this.displayUpdater) {
      this.displayUpdater.addEventListener('displayUpdated', (event) => {
        this.systemMetrics.lastUpdateTime = event.detail.timestamp;
        
        if (this.config.enableEventLogging) {
          console.log("📺 顯示更新完成");
        }
      });

      this.displayUpdater.addEventListener('logAdded', (event) => {
        if (this.config.enableEventLogging) {
          console.log(`📜 記錄已添加: ${event.detail.message}`);
        }
      });
    }

    // InteractionHandler 事件監聽
    if (this.interactionHandler) {
      this.interactionHandler.addEventListener('gameActionExecuted', (event) => {
        this.systemMetrics.totalInteractions++;
        
        if (this.config.enableEventLogging) {
          console.log(`🎮 遊戲動作執行: ${event.detail.method}`);
        }
      });

      this.interactionHandler.addEventListener('interactionError', (event) => {
        this.systemMetrics.uiErrors++;
        console.error("❌ 互動錯誤:", event.detail);
      });
    }

    // ModalManager 事件監聽
    if (this.modalManager) {
      this.modalManager.addEventListener('modalOpened', (event) => {
        if (this.config.enableEventLogging) {
          console.log(`🪟 模態框開啟: ${event.detail.modalId}`);
        }
      });

      this.modalManager.addEventListener('modalClosed', (event) => {
        if (this.config.enableEventLogging) {
          console.log(`🪟 模態框關閉: ${event.detail.modalId}`);
        }
      });
    }

    console.log("🎧 模組間事件監聽器已設定");
  }

  /**
   * 設定統一的 UI 函數代理
   */
  setupUnifiedUIProxies() {
    // 設定全域 UI 存取點
    window.uiManager = this;

    // 向後相容的 UI 函數
    window.updateDisplay = () => this.updateAll();
    window.addLog = (message, type) => this.addLog(message, type);
    window.closeModal = () => this.closeModal();

    // 顯示相關函數
    window.showVisitorModal = () => this.showVisitorModal();
    window.showSkillModal = () => this.showSkillModal();
    window.showScavengeModal = () => this.showScavengeModal();

    console.log("🌍 統一 UI 函數代理已設定");
  }

  /**
   * 設定系統事件監聽
   */
  setupSystemEventListeners() {
    // 監聽遊戲狀態變化
    if (this.game) {
      // 可以在這裡添加遊戲狀態變化的監聽
      console.log("🎧 系統事件監聽器已設定");
    }
  }

  /**
   * 啟動系統監控
   */
  startSystemMonitoring() {
    if (!this.config.enablePerformanceMonitoring) return;

    // 設定定期清理
    if (this.config.autoCleanupInterval > 0) {
      setInterval(() => {
        this.performMaintenanceCleanup();
      }, this.config.autoCleanupInterval);
    }

    console.log("📊 系統監控已啟動");
  }

  /**
   * 統一更新所有顯示
   */
  updateAll() {
    if (!this.displayUpdater) {
      console.warn("⚠️ DisplayUpdater 不可用");
      return false;
    }

    try {
      this.displayUpdater.updateDisplay();
      return true;
    } catch (error) {
      console.error("❌ 統一更新失敗:", error);
      this.systemMetrics.uiErrors++;
      return false;
    }
  }

  /**
   * 重新整理顯示
   */
  refreshDisplay() {
    this.updateAll();
  }

  /**
   * 添加遊戲記錄
   */
  addLog(message, type = 'event') {
    if (!this.displayUpdater) {
      console.warn("⚠️ DisplayUpdater 不可用，無法添加記錄");
      return false;
    }

    return this.displayUpdater.addLog(message, type);
  }

  /**
   * 顯示訪客模態框
   */
  showVisitorModal() {
    if (!this.modalManager) {
      console.warn("⚠️ ModalManager 不可用");
      return false;
    }

    return this.modalManager.showVisitorModal();
  }

  /**
   * 顯示技能模態框
   */
  showSkillModal() {
    if (!this.modalManager) {
      console.warn("⚠️ ModalManager 不可用");
      return false;
    }

    return this.modalManager.showSkillModal();
  }

  /**
   * 顯示搜刮模態框
   */
  showScavengeModal() {
    if (!this.modalManager) {
      console.warn("⚠️ ModalManager 不可用");
      return false;
    }

    return this.modalManager.showScavengeModal();
  }

  /**
   * 關閉模態框
   */
  closeModal(modalId = null) {
    if (!this.modalManager) {
      console.warn("⚠️ ModalManager 不可用");
      return false;
    }

    return this.modalManager.closeModal(modalId);
  }

  /**
   * 處理系統狀態變化
   */
  handleSystemStateChange(changeType, data = {}) {
    switch (changeType) {
      case 'gameState':
        this.displayUpdater?.scheduleUpdate('game-state');
        break;
      case 'resources':
        this.displayUpdater?.scheduleUpdate('resources');
        break;
      case 'rooms':
        this.displayUpdater?.scheduleUpdate('rooms');
        break;
      case 'tenants':
        this.displayUpdater?.scheduleUpdate('tenants');
        break;
      case 'systemStatus':
        this.displayUpdater?.scheduleUpdate('system-status');
        break;
      case 'fullUpdate':
        this.updateAll();
        break;
      default:
        console.warn(`⚠️ 未知的系統狀態變化類型: ${changeType}`);
    }

    // 發送狀態變化事件
    this.dispatchEvent(new CustomEvent('systemStateChanged', {
      detail: { changeType, data, timestamp: Date.now() }
    }));
  }

  /**
   * 取得 UI 系統狀態
   */
  getUISystemStatus() {
    return {
      initialized: this.isInitialized,
      moduleStatus: this.moduleStatus,
      systemMetrics: this.systemMetrics,
      config: this.config,
      modules: {
        displayUpdater: this.displayUpdater?.getStatus() || null,
        interactionHandler: this.interactionHandler?.getStatus() || null,
        modalManager: this.modalManager?.getStatus() || null,
      },
      systemHealth: this.evaluateUISystemHealth(),
    };
  }

  /**
   * 評估 UI 系統健康度
   */
  evaluateUISystemHealth() {
    const issues = [];
    const successes = [];

    // 檢查各模組狀態
    Object.entries(this.moduleStatus).forEach(([module, status]) => {
      if (status) {
        successes.push(`${module} 運行正常`);
      } else {
        issues.push(`${module} 初始化失敗`);
      }
    });

    // 檢查錯誤率
    const errorRate = this.systemMetrics.totalInteractions > 0 
      ? this.systemMetrics.uiErrors / this.systemMetrics.totalInteractions 
      : 0;

    if (errorRate > 0.1) {
      issues.push(`錯誤率過高 (${(errorRate * 100).toFixed(1)}%)`);
    } else if (errorRate > 0.05) {
      issues.push(`錯誤率偏高 (${(errorRate * 100).toFixed(1)}%)`);
    }

    return {
      healthy: issues.length === 0,
      issues: issues,
      successes: successes,
      errorRate: errorRate,
      score: successes.length / (successes.length + issues.length),
    };
  }

  /**
   * 執行維護清理
   */
  performMaintenanceCleanup() {
    try {
      // 清理模組快取
      if (this.displayUpdater) {
        // DisplayUpdater 可能有的快取清理
      }

      // 清理事件監聽器（如果需要）
      
      console.log("🧹 UI 系統維護清理完成");
    } catch (error) {
      console.error("❌ UI 系統維護清理失敗:", error);
      this.systemMetrics.uiErrors++;
    }
  }

  /**
   * 重新初始化 UI 系統
   */
  async reinitialize() {
    console.log("🔄 重新初始化 UI 系統...");

    // 清理現有資源
    this.cleanup();

    // 重新初始化
    return await this.initialize();
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // 將配置傳遞給子模組
    if (this.displayUpdater) {
      this.displayUpdater.updateConfig(newConfig);
    }
    
    if (this.modalManager) {
      this.modalManager.updateConfig(newConfig);
    }

    console.log("⚙️ UIManager 配置已更新");
  }

  /**
   * 開啟/關閉事件記錄
   */
  toggleEventLogging(enabled) {
    this.config.enableEventLogging = enabled;
    console.log(`📝 事件記錄已${enabled ? '開啟' : '關閉'}`);
  }

  /**
   * 開啟/關閉效能監控
   */
  togglePerformanceMonitoring(enabled) {
    this.config.enablePerformanceMonitoring = enabled;
    
    if (enabled) {
      this.startSystemMonitoring();
    }
    
    console.log(`📊 效能監控已${enabled ? '開啟' : '關閉'}`);
  }

  /**
   * 取得詳細統計資訊
   */
  getDetailedStats() {
    return {
      uiManager: {
        initialized: this.isInitialized,
        initTime: this.systemMetrics.initializationTime,
        totalInteractions: this.systemMetrics.totalInteractions,
        uiErrors: this.systemMetrics.uiErrors,
      },
      displayUpdater: this.displayUpdater?.getStats() || null,
      interactionHandler: this.interactionHandler?.getStats() || null,
      modalManager: this.modalManager?.getStatus() || null,
    };
  }

  /**
   * 清理資源
   */
  cleanup() {
    // 清理各個模組
    if (this.displayUpdater) {
      this.displayUpdater.cleanup();
      this.displayUpdater = null;
    }

    if (this.interactionHandler) {
      this.interactionHandler.cleanup();
      this.interactionHandler = null;
    }

    if (this.modalManager) {
      this.modalManager.cleanup();
      this.modalManager = null;
    }

    // 重置狀態
    this.isInitialized = false;
    this.moduleStatus = {
      interactionHandler: false,
      modalManager: false,
      displayUpdater: false,
      integration: false,
    };

    // 清理全域變數
    if (window.uiManager === this) {
      delete window.uiManager;
      delete window.updateDisplay;
      delete window.addLog;
      delete window.closeModal;
    }

    console.log("🧹 UIManager 資源已清理");
  }
}

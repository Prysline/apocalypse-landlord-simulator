/**
 * InteractionHandler - 使用者互動管理模組
 * 職責：事件捕獲、路由分發、快捷鍵管理、全域介面協調
 */

import { UI_CONSTANTS, EVENT_TYPES } from "../utils/constants.js";

export class InteractionHandler extends EventTarget {
  constructor(gameInstance) {
    super();

    // 核心依賴
    this.game = gameInstance;
    this.modalManager = null; // 將由 UIManager 注入

    // 事件管理狀態
    this.isInitialized = false;
    this.eventListeners = new Map();
    this.keyboardShortcuts = new Map();

    // 事件路由表
    this.buttonEventMap = new Map();
    this.roomEventHandlers = new Map();

    // 除錯資訊
    this.eventStats = {
      totalEvents: 0,
      clickEvents: 0,
      keyboardEvents: 0,
      routedEvents: 0,
    };

    console.log("📱 InteractionHandler 建構完成");
  }

  /**
   * 初始化互動處理系統
   */
  initialize() {
    try {
      console.log("📱 正在初始化 InteractionHandler...");

      // 建立事件路由映射
      this.setupEventRouting();

      // 建立鍵盤快捷鍵
      this.setupKeyboardShortcuts();

      // 註冊全域事件監聽器
      this.registerGlobalEventListeners();

      // 設定全域函數代理（向後相容）
      this.setupGlobalFunctionProxies();

      this.isInitialized = true;
      console.log("✅ InteractionHandler 初始化完成");

      return true;
    } catch (error) {
      console.error("❌ InteractionHandler 初始化失敗:", error);
      return false;
    }
  }

  /**
   * 建立事件路由映射表
   */
  setupEventRouting() {
    // 按鈕事件路由映射
    this.buttonEventMap.set("collectRentBtn", () => {
      this.routeToGame("handleCollectRent");
    });

    this.buttonEventMap.set("showVisitorsBtn", () => {
      this.routeToGame("handleShowVisitors");
    });

    this.buttonEventMap.set("showScavengeBtn", () => {
      this.routeToGame("handleShowScavenge");
    });

    this.buttonEventMap.set("harvestYardBtn", () => {
      this.routeToGame("handleHarvestYard");
    });

    this.buttonEventMap.set("showSkillBtn", () => {
      this.routeToGame("handleShowSkills");
    });

    this.buttonEventMap.set("nextDayBtn", () => {
      this.routeToGame("handleNextDay");
    });

    // 模態框關閉按鈕
    this.buttonEventMap.set("closeVisitorModal", () => {
      this.routeToModal("closeModal");
    });

    this.buttonEventMap.set("closeSkillModal", () => {
      this.routeToModal("closeModal");
    });

    console.log(`📍 已建立 ${this.buttonEventMap.size} 個按鈕事件路由`);
  }

  /**
   * 建立鍵盤快捷鍵映射
   */
  setupKeyboardShortcuts() {
    // 定義快捷鍵映射
    this.keyboardShortcuts.set("r", {
      description: "收租",
      handler: () => this.routeToGame("handleCollectRent"),
      requiresNoModifiers: true,
    });

    this.keyboardShortcuts.set("v", {
      description: "查看訪客",
      handler: () => this.routeToGame("handleShowVisitors"),
      requiresNoModifiers: true,
    });

    this.keyboardShortcuts.set("h", {
      description: "院子採集",
      handler: () => this.routeToGame("handleHarvestYard"),
      requiresNoModifiers: true,
    });

    this.keyboardShortcuts.set("s", {
      description: "技能選單",
      handler: () => this.routeToGame("handleShowSkills"),
      requiresNoModifiers: true,
    });

    this.keyboardShortcuts.set("Escape", {
      description: "關閉模態框",
      handler: () => this.routeToModal("closeModal"),
      requiresNoModifiers: false,
    });

    console.log(`⌨️ 已建立 ${this.keyboardShortcuts.size} 個鍵盤快捷鍵`);
  }

  /**
   * 註冊全域事件監聽器
   */
  registerGlobalEventListeners() {
    // 主要點擊事件處理（事件委派）
    const clickHandler = (event) => {
      this.eventStats.totalEvents++;
      this.eventStats.clickEvents++;

      this.handleGlobalClick(event);
    };

    document.addEventListener("click", clickHandler);
    this.eventListeners.set("click", clickHandler);

    // 鍵盤事件處理
    const keyboardHandler = (event) => {
      this.eventStats.totalEvents++;
      this.eventStats.keyboardEvents++;

      this.handleKeyboardEvent(event);
    };

    document.addEventListener("keydown", keyboardHandler);
    this.eventListeners.set("keydown", keyboardHandler);

    // 防止右鍵選單（可選）
    const contextMenuHandler = (event) => {
      if (event.target.closest(".game-container")) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", contextMenuHandler);
    this.eventListeners.set("contextmenu", contextMenuHandler);

    console.log("🎧 全域事件監聽器已註冊");
  }

  /**
   * 處理全域點擊事件
   */
  handleGlobalClick(event) {
    const target = event.target;

    try {
      // 1. 房間點擊處理
      if (target.classList.contains("room")) {
        this.handleRoomClick(target);
        return;
      }

      // 2. 按鈕點擊處理
      if (target.id && this.buttonEventMap.has(target.id)) {
        event.preventDefault();
        this.buttonEventMap.get(target.id)();
        this.eventStats.routedEvents++;
        return;
      }

      // 3. 模態框內部點擊處理
      if (this.handleModalInternalClick(target)) {
        return;
      }

      // 4. 其他互動元素（data-action 屬性）
      if (target.dataset.action) {
        this.handleDataActionClick(target, event);
        return;
      }
    } catch (error) {
      console.error("❌ 點擊事件處理失敗:", error);
      this.emitError("click_handler_error", error);
    }
  }

  /**
   * 處理房間點擊
   */
  handleRoomClick(roomElement) {
    const roomId = this.extractRoomId(roomElement);

    if (roomId) {
      this.routeToGame("handleRoomClick", roomId);
      this.eventStats.routedEvents++;

      // 視覺回饋
      roomElement.style.transform = "scale(0.95)";
      setTimeout(() => {
        roomElement.style.transform = "";
      }, 150);
    } else {
      console.warn("⚠️ 無法提取房間ID:", roomElement);
    }
  }

  /**
   * 提取房間ID
   */
  extractRoomId(roomElement) {
    const match = roomElement.id.match(/room(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * 提取房間ID
   */
  extractRoomId(roomElement) {
    const match = roomElement.id.match(/room(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * 處理模態框內部點擊
   */
  handleModalInternalClick(target) {
    // 檢查是否為模態框內的特殊按鈕
    const modalContainer = target.closest(".modal");
    if (!modalContainer) return false;

    // 雇用租客按鈕
    if (target.textContent.includes("雇用") && target.onclick) {
      // 讓原有的 onclick 處理
      return true;
    }

    // 派遣搜刮按鈕
    if (target.textContent.includes("派遣搜刮") && target.onclick) {
      return true;
    }

    // 技能使用按鈕
    if (target.textContent.includes("使用技能") && target.onclick) {
      return true;
    }

    return false;
  }

  /**
   * 處理 data-action 點擊
   */
  handleDataActionClick(target, event) {
    const action = target.dataset.action;
    const params = target.dataset.params
      ? JSON.parse(target.dataset.params)
      : {};

    switch (action) {
      case "hire-tenant":
        this.routeToGame("hireTenant", params.applicantId);
        break;
      case "use-skill":
        this.routeToGame("useSkillFromMenu", params.tenantName, params.skillId);
        break;
      case "send-scavenge":
        this.routeToGame("sendTenantOnScavenge", params.tenantName);
        break;
      default:
        console.warn("⚠️ 未知的 data-action:", action);
    }

    event.preventDefault();
    this.eventStats.routedEvents++;
  }

  /**
   * 處理鍵盤事件
   */
  handleKeyboardEvent(event) {
    const key = event.key;
    const shortcut = this.keyboardShortcuts.get(key);

    if (!shortcut) return;

    // 檢查修飾鍵要求
    if (
      shortcut.requiresNoModifiers &&
      (event.ctrlKey || event.altKey || event.metaKey)
    ) {
      return;
    }

    try {
      event.preventDefault();
      shortcut.handler();
      this.eventStats.routedEvents++;

      // 顯示快捷鍵提示（可選）
      if (UI_CONSTANTS.DEBUG_MODE?.SHOW_SHORTCUTS) {
        console.log(`⌨️ 快捷鍵觸發: ${key} - ${shortcut.description}`);
      }
    } catch (error) {
      console.error("❌ 鍵盤快捷鍵處理失敗:", error);
      this.emitError("keyboard_handler_error", error);
    }
  }

  /**
   * 路由到遊戲主邏輯
   */
  routeToGame(methodName, ...args) {
    if (!this.game || typeof this.game[methodName] !== "function") {
      console.error(`❌ 遊戲方法不存在: ${methodName}`);
      return false;
    }

    try {
      const result = this.game[methodName](...args);

      // 發送事件通知
      this.dispatchEvent(
        new CustomEvent("gameActionExecuted", {
          detail: { method: methodName, args: args, result: result },
        })
      );

      return result;
    } catch (error) {
      console.error(`❌ 遊戲方法執行失敗 ${methodName}:`, error);
      this.emitError("game_method_error", error);
      return false;
    }
  }

  /**
   * 路由到模態框管理器
   */
  routeToModal(methodName, ...args) {
    if (!this.modalManager) {
      // 降級處理：直接操作 DOM
      if (methodName === "closeModal") {
        this.closeModalFallback();
        return true;
      }

      console.warn("⚠️ ModalManager 未註冊，使用降級處理");
      return false;
    }

    if (typeof this.modalManager[methodName] !== "function") {
      console.error(`❌ 模態框方法不存在: ${methodName}`);
      return false;
    }

    try {
      const result = this.modalManager[methodName](...args);

      // 發送事件通知
      this.dispatchEvent(
        new CustomEvent("modalActionExecuted", {
          detail: { method: methodName, args: args, result: result },
        })
      );

      return result;
    } catch (error) {
      console.error(`❌ 模態框方法執行失敗 ${methodName}:`, error);
      this.emitError("modal_method_error", error);
      return false;
    }
  }

  /**
   * 降級模態框關閉
   */
  closeModalFallback() {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.style.display = "none";
    });
  }

  /**
   * 設定全域函數代理（向後相容）
   */
  setupGlobalFunctionProxies() {
    // 為現有模態框 onclick 事件提供支援
    window.gameApp = this.game;

    // 向後相容函數
    window.closeModal = () => this.routeToModal("closeModal");

    // 租客相關函數（可能被模態框內的 onclick 使用）
    if (this.game) {
      window.hireTenant = (applicantId) =>
        this.routeToGame("hireTenant", applicantId);
      window.sendTenantOnScavenge = (tenantName) =>
        this.routeToGame("sendTenantOnScavenge", tenantName);
    }

    console.log("🌍 全域函數代理已設定");
  }

  /**
   * 註冊模態框管理器
   */
  setModalManager(modalManager) {
    this.modalManager = modalManager;
    console.log("🔗 ModalManager 已註冊到 InteractionHandler");
  }

  /**
   * 發送錯誤事件
   */
  emitError(errorType, error) {
    this.dispatchEvent(
      new CustomEvent("interactionError", {
        detail: { type: errorType, error: error, timestamp: Date.now() },
      })
    );
  }

  /**
   * 取得統計資訊
   */
  getStats() {
    return {
      ...this.eventStats,
      isInitialized: this.isInitialized,
      registeredButtons: this.buttonEventMap.size,
      registeredShortcuts: this.keyboardShortcuts.size,
      activeListeners: this.eventListeners.size,
    };
  }

  /**
   * 取得狀態資訊
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      hasGame: !!this.game,
      hasModalManager: !!this.modalManager,
      eventRoutes: this.buttonEventMap.size,
      shortcuts: this.keyboardShortcuts.size,
      stats: this.eventStats,
    };
  }

  /**
   * 清理資源
   */
  cleanup() {
    // 移除事件監聽器
    this.eventListeners.forEach((handler, eventType) => {
      document.removeEventListener(eventType, handler);
    });

    this.eventListeners.clear();
    this.buttonEventMap.clear();
    this.keyboardShortcuts.clear();

    // 清理全域變數
    if (window.gameApp === this.game) {
      delete window.gameApp;
    }

    console.log("🧹 InteractionHandler 資源已清理");
  }

  /**
   * 添加新的按鈕事件路由
   */
  addButtonRoute(buttonId, handler) {
    if (typeof handler === "string") {
      // 字串格式：方法名稱（路由到遊戲）
      this.buttonEventMap.set(buttonId, () => this.routeToGame(handler));
    } else if (typeof handler === "function") {
      // 函數格式：直接執行
      this.buttonEventMap.set(buttonId, handler);
    } else {
      console.error("❌ 無效的按鈕處理器格式:", handler);
      return false;
    }

    console.log(`📍 新增按鈕路由: ${buttonId}`);
    return true;
  }

  /**
   * 添加新的鍵盤快捷鍵
   */
  addKeyboardShortcut(key, description, handler, requiresNoModifiers = true) {
    this.keyboardShortcuts.set(key, {
      description,
      handler,
      requiresNoModifiers,
    });

    console.log(`⌨️ 新增快捷鍵: ${key} - ${description}`);
    return true;
  }
}

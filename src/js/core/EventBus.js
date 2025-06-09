// @ts-check

/**
 * @fileoverview EventBus.js - 事件通信系統
 * 職責：提供模組間的事件驅動通信機制
 */

import { SYSTEM_LIMITS } from "../utils/constants.js";

/**
 * @see {@link ../Type.js} 完整類型定義
 * @typedef {import('../Type.js').EventListener} EventListener
 * @typedef {import('../Type.js').EventObject} EventObject
 * @typedef {import('../Type.js').ListenerOptions} ListenerOptions
 * @typedef {import('../Type.js').UnsubscribeFunction} UnsubscribeFunction
 */

/**
 * 事件發送選項
 * @typedef {Object} EmitOptions
 * @property {boolean} [async=false] - 是否為非同步事件
 * @property {number} [timeout] - 超時時間（毫秒）
 * @property {Object} [metadata] - 附加元資料
 */

/**
 * 監聽器執行結果
 * @typedef {Object} ListenerResult
 * @property {boolean} success - 是否執行成功
 * @property {any} [result] - 執行結果
 * @property {Error} [error] - 錯誤物件（如果失敗）
 */

/**
 * 事件發送結果
 * @typedef {Object} EmitResult
 * @property {boolean} success - 是否發送成功
 * @property {string} [eventId] - 事件ID
 * @property {number} [listenerCount] - 監聽器數量
 * @property {ListenerResult[]} [results] - 監聽器執行結果
 * @property {string} [error] - 錯誤訊息（如果失敗）
 */

/**
 * 事件統計資料
 * @typedef {Object} EventStats
 * @property {number} emitted - 已發送事件數量
 * @property {number} listeners - 監聽器數量
 * @property {number} errors - 錯誤數量
 * @property {string|null} lastEmitted - 最後發送時間
 */

/**
 * 事件記錄
 * @typedef {Object} EventRecord
 * @property {string} eventType - 事件類型
 * @property {string} timestamp - 時間戳記
 * @property {number} dataSize - 資料大小（字節）
 * @property {Object} options - 選項
 * @property {number} listenerCount - 監聽器數量
 */

/**
 * 事件系統統計資料
 * @typedef {Object} SystemStats
 * @property {number} totalEventTypes - 事件類型總數
 * @property {number} totalListeners - 監聽器總數
 * @property {number} eventHistory - 事件歷史記錄數
 * @property {boolean} isActive - 系統是否活躍
 * @property {Object.<string, EventStats>} stats - 各事件類型統計
 */

/**
 * 事件通信系統類
 * @class
 */
export class EventBus {
  /**
   * 建立 EventBus 實例
   * @constructor
   */
  constructor() {
    /**
     * 事件監聽器映射
     * @type {Map<string, Set<EventListener>>}
     * @private
     */
    this.listeners = new Map();

    /**
     * 事件歷史記錄
     * @type {EventRecord[]}
     * @private
     */
    this.eventHistory = [];

    /**
     * 事件統計
     * @type {Map<string, EventStats>}
     * @private
     */
    this.eventStats = new Map();

    /**
     * 系統狀態
     * @type {boolean}
     * @private
     */
    this.isActive = true;

    console.log("EventBus 初始化完成");
  }

  /**
   * 監聽事件
   * @param {string} eventType - 事件類型
   * @param {EventListener} listener - 監聽器函數
   * @param {ListenerOptions} [options={}] - 監聽器選項
   * @returns {UnsubscribeFunction|null} 取消監聽的函數，失敗時返回 null
   * @throws {TypeError} 當監聽器不是函數時
   */
  on(eventType, listener, options = {}) {
    // 型別保護：檢查參數
    if (typeof eventType !== "string" || eventType.trim() === "") {
      throw new TypeError("事件類型必須是非空字串");
    }

    if (typeof listener !== "function") {
      throw new TypeError("監聽器必須是函數");
    }

    if (!this.isActive) {
      console.warn("EventBus 已停用，無法新增監聽器");
      return null;
    }

    // 建立監聽器映射
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    // 包裝監聽器以支援選項
    const wrappedListener = this._wrapListener(listener, options);
    this.listeners.get(eventType).add(wrappedListener);

    // 更新統計
    this._updateStats(eventType, "listener_added");

    // 返回取消監聽的函數
    return () => this.off(eventType, wrappedListener);
  }

  /**
   * 監聽事件（僅一次）
   * @param {string} eventType - 事件類型
   * @param {EventListener} listener - 監聽器函數
   * @param {ListenerOptions} [options={}] - 監聽器選項
   * @returns {UnsubscribeFunction|null} 取消監聽的函數，失敗時返回 null
   * @throws {TypeError} 當參數型別不正確時
   */
  once(eventType, listener, options = {}) {
    // 型別保護
    if (typeof eventType !== "string" || eventType.trim() === "") {
      throw new TypeError("事件類型必須是非空字串");
    }

    if (typeof listener !== "function") {
      throw new TypeError("監聽器必須是函數");
    }

    if (!this.isActive) {
      console.warn("EventBus 已停用，無法新增監聽器");
      return null;
    }

    let hasExecuted = false;

    // 建立一次性監聽器
    const onceWrapper = (/** @type {EventObject} */ eventObj) => {
      if (hasExecuted) {
        console.debug(
          `[EventBus] 一次性監聽器已執行，忽略重複調用: ${eventType}`
        );
        return;
      }

      // 🎯 關鍵修復：立即設置標記，阻止後續執行
      hasExecuted = true;

      try {
        // 先移除監聽器，再執行回調（避免回調中的錯誤影響清理）
        this.off(eventType, onceWrapper);

        // 執行原始監聽器
        return listener(eventObj);
      } catch (error) {
        console.error(`[EventBus] 一次性監聽器執行錯誤 (${eventType}):`, error);
        throw error;
      }
    };

    // 添加到普通監聽器列表
    return this.on(eventType, onceWrapper, { ...options, once: true });
  }

  /**
   * 取消監聽事件
   * @param {string} eventType - 事件類型
   * @param {EventListener|null} [listener=null] - 要移除的監聽器，null 表示移除所有
   * @returns {boolean} 是否成功移除
   */
  off(eventType, listener = null) {
    // 型別保護
    if (typeof eventType !== "string") {
      console.warn("事件類型必須是字串");
      return false;
    }

    if (!this.listeners.has(eventType)) {
      return false;
    }

    const listeners = this.listeners.get(eventType);

    if (listener === null) {
      // 移除該事件類型的所有監聽器
      const count = listeners.size;
      listeners.clear();
      this._updateStats(eventType, "all_listeners_removed", count);
      return true;
    } else {
      // 移除特定監聽器
      const removed = listeners.delete(listener);
      if (removed) {
        this._updateStats(eventType, "listener_removed");
      }

      // 如果沒有監聽器了，清理映射
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }

      return removed;
    }
  }

  /**
   * 發送事件
   * @param {string} eventType - 事件類型
   * @param {any} [data=null] - 事件資料
   * @param {EmitOptions} [options={}] - 發送選項
   * @returns {EmitResult} 發送結果
   */
  emit(eventType, data = null, options = {}) {
    // 型別保護
    if (typeof eventType !== "string" || eventType.trim() === "") {
      return {
        success: false,
        error: "事件類型必須是非空字串",
      };
    }

    if (!this.isActive) {
      console.warn("EventBus 已停用，無法發送事件");
      return {
        success: false,
        error: "EventBus 已停用",
      };
    }

    try {
      // 記錄事件
      this._recordEvent(eventType, data, options);

      // 取得監聽器
      const listeners = this.listeners.get(eventType);
      if (!listeners || listeners.size === 0) {
        return { success: true }; // 沒有監聽器也是成功的
      }

      // 建立事件物件
      const eventObj = {
        type: eventType,
        data: data,
        timestamp: new Date().toISOString(),
        id: this._generateEventId(),
        ...options,
      };

      // 通知所有監聽器
      const results = [];
      for (const listener of listeners) {
        try {
          const result = listener(eventObj);
          results.push({ success: true, result });
        } catch (error) {
          console.error(`事件監聽器錯誤 (${eventType}):`, error);
          results.push({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }

      // 更新統計
      this._updateStats(eventType, "event_emitted");

      return {
        success: true,
        eventId: eventObj.id,
        listenerCount: listeners.size,
        results,
      };
    } catch (error) {
      console.error(`事件發送失敗 (${eventType}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 發送同步事件（等待所有監聽器完成）
   * @param {string} eventType - 事件類型
   * @param {any} [data=null] - 事件資料
   * @param {EmitOptions} [options={}] - 發送選項
   * @returns {Promise<EmitResult>} 發送結果的 Promise
   */
  async emitAsync(eventType, data = null, options = {}) {
    // 型別保護
    if (typeof eventType !== "string" || eventType.trim() === "") {
      return {
        success: false,
        error: "事件類型必須是非空字串",
      };
    }

    if (!this.isActive) {
      console.warn("EventBus 已停用，無法發送事件");
      return {
        success: false,
        error: "EventBus 已停用",
      };
    }

    const listeners = this.listeners.get(eventType);
    if (!listeners || listeners.size === 0) {
      return { success: true, results: [] };
    }

    // 建立事件物件
    const eventObj = {
      type: eventType,
      data: data,
      timestamp: new Date().toISOString(),
      id: this._generateEventId(),
      ...options,
    };

    try {
      // 等待所有監聽器完成
      const promises = Array.from(listeners).map(async (listener) => {
        try {
          const result = await listener(eventObj);
          return { success: true, result };
        } catch (error) {
          console.error(`非同步事件監聽器錯誤 (${eventType}):`, error);
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      });

      const results = await Promise.allSettled(promises);

      // 記錄事件
      this._recordEvent(eventType, data, { ...options, async: true });
      this._updateStats(eventType, "async_event_emitted");

      return {
        success: true,
        eventId: eventObj.id,
        listenerCount: listeners.size,
        results: results.map((r) =>
          r.status === "fulfilled"
            ? r.value
            : {
                success: false,
                error: r.reason,
              }
        ),
      };
    } catch (error) {
      console.error(`非同步事件發送失敗 (${eventType}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 包裝監聽器以支援選項
   * @param {EventListener} listener - 原始監聽器
   * @param {ListenerOptions} options - 監聽器選項
   * @returns {EventListener} 包裝後的監聽器
   * @private
   */
  _wrapListener(listener, options) {
    const { priority = 0, filter = null, throttle = 0, once = false } = options;

    let lastCalled = 0;

    return (/** @type {EventObject} */ eventObj) => {
      // 節流控制
      if (throttle > 0) {
        const now = Date.now();
        if (now - lastCalled < throttle) {
          return; // 跳過此次呼叫
        }
        lastCalled = now;
      }

      // 過濾器檢查
      if (filter && typeof filter === "function") {
        if (!filter(eventObj)) {
          return; // 不符合過濾條件
        }
      }

      // 執行監聽器
      return listener(eventObj);
    };
  }

  /**
   * 記錄事件歷史
   * @param {string} eventType - 事件類型
   * @param {any} data - 事件資料
   * @param {EmitOptions} options - 發送選項
   * @returns {void}
   * @private
   */
  _recordEvent(eventType, data, options) {
    const record = {
      eventType,
      timestamp: new Date().toISOString(),
      dataSize: this._getDataSize(data),
      options: { ...options },
      listenerCount: this.listeners.get(eventType)?.size || 0,
    };

    this.eventHistory.push(record);

    // 限制歷史記錄數量
    if (
      this.eventHistory.length > SYSTEM_LIMITS.HISTORY.MAX_EXECUTION_HISTORY
    ) {
      this.eventHistory.shift();
    }
  }

  /**
   * 更新事件統計
   * @param {string} eventType - 事件類型
   * @param {'event_emitted'|'async_event_emitted'|'listener_added'|'listener_removed'|'all_listeners_removed'} action - 動作類型
   * @param {number} [count=1] - 計數
   * @returns {void}
   * @private
   */
  _updateStats(eventType, action, count = 1) {
    if (!this.eventStats.has(eventType)) {
      this.eventStats.set(eventType, {
        emitted: 0,
        listeners: 0,
        errors: 0,
        lastEmitted: null,
      });
    }

    const stats = this.eventStats.get(eventType);

    switch (action) {
      case "event_emitted":
      case "async_event_emitted":
        stats.emitted += count;
        stats.lastEmitted = new Date().toISOString();
        break;
      case "listener_added":
        stats.listeners += count;
        break;
      case "listener_removed":
        stats.listeners -= count;
        break;
      case "all_listeners_removed":
        stats.listeners = 0;
        break;
    }
  }

  /**
   * 產生事件ID
   * @returns {string} 唯一的事件識別碼
   * @private
   */
  _generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 取得資料大小（估算）
   * @param {any} data - 要估算的資料
   * @returns {number} 資料大小（字節）
   * @private
   */
  _getDataSize(data) {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  /**
   * 取得事件統計
   * @param {string|null} [eventType=null] - 特定事件類型，null 表示取得全部統計
   * @returns {EventStats|SystemStats|null} 事件統計資料
   */
  getStats(eventType = null) {
    if (eventType) {
      return this.eventStats.get(eventType) || null;
    }

    return {
      totalEventTypes: this.eventStats.size,
      totalListeners: Array.from(this.listeners.values()).reduce(
        (sum, listeners) => sum + listeners.size,
        0
      ),
      eventHistory: this.eventHistory.length,
      isActive: this.isActive,
      stats: Object.fromEntries(this.eventStats),
    };
  }

  /**
   * 取得所有監聽的事件類型
   * @returns {string[]} 事件類型陣列
   */
  getListenedEvents() {
    return Array.from(this.listeners.keys());
  }

  /**
   * 取得事件歷史
   * @param {number} [limit=10] - 返回記錄數量限制
   * @returns {EventRecord[]} 事件歷史記錄
   */
  getEventHistory(limit = 10) {
    if (typeof limit !== "number" || limit < 1) {
      limit = 10;
    }
    return this.eventHistory.slice(-limit);
  }

  /**
   * 清理過期的事件歷史
   * @param {number} [maxAge=300000] - 最大保留時間（毫秒），預設5分鐘
   * @returns {number} 清理的記錄數量
   */
  cleanupHistory(maxAge = 5 * 60 * 1000) {
    if (typeof maxAge !== "number" || maxAge < 0) {
      maxAge = 5 * 60 * 1000;
    }

    const cutoff = new Date(Date.now() - maxAge);
    const initialLength = this.eventHistory.length;

    this.eventHistory = this.eventHistory.filter(
      (record) => new Date(record.timestamp) > cutoff
    );

    const cleaned = initialLength - this.eventHistory.length;
    if (cleaned > 0) {
      console.log(`清理了 ${cleaned} 條過期事件記錄`);
    }

    return cleaned;
  }

  /**
   * 暫停事件系統
   * @returns {void}
   */
  pause() {
    this.isActive = false;
    console.log("EventBus 已暫停");
  }

  /**
   * 恢復事件系統
   * @returns {void}
   */
  resume() {
    this.isActive = true;
    console.log("EventBus 已恢復");
  }

  /**
   * 銷毀事件系統
   * @returns {void}
   */
  destroy() {
    this.isActive = false;
    this.listeners.clear();
    this.eventHistory = [];
    this.eventStats.clear();
    console.log("EventBus 已銷毀");
  }

  /**
   * 除錯工具：列出所有事件和監聽器
   * @returns {void}
   */
  debug() {
    console.group("EventBus 除錯資訊");
    console.log("狀態:", this.isActive ? "活躍" : "停用");
    console.log("事件類型數量:", this.listeners.size);
    console.log(
      "總監聽器數量:",
      Array.from(this.listeners.values()).reduce(
        (sum, listeners) => sum + listeners.size,
        0
      )
    );

    console.group("事件類型詳情:");
    for (const [eventType, listeners] of this.listeners) {
      console.log(`${eventType}: ${listeners.size} 個監聽器`);
    }
    console.groupEnd();

    console.log("事件歷史記錄:", this.eventHistory.length);
    console.log("最近事件:", this.getEventHistory(5));
    console.groupEnd();
  }
}

export default EventBus;

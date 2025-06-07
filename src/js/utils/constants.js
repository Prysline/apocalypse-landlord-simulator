// @ts-check

/**
 * @fileoverview constants.js - 核心系統常數管理模組 v2.0
 * 職責：管理實際使用的技術實作相關常數
 * 設計原則：只保留有實際使用的常數，移除過度設計部分
 */

/**
 * 事件類型字串
 * @typedef {string} EventTypeString
 */

/**
 * 錯誤代碼字串
 * @typedef {string} ErrorCodeString
 */

/**
 * 訊息模板函數
 * @typedef {function(string): string} MessageTemplateFunction
 */

/**
 * 訊息模板函數（雙參數）
 * @typedef {function(string, string): string} MessageTemplateBinaryFunction
 */

// ==================== 事件系統常數 ====================

/**
 * 系統事件類型標識符
 * 用於 EventBus 的事件註冊和發送
 * @type {Readonly<{
 *   SYSTEM: Readonly<{
 *     INITIALIZATION: EventTypeString,
 *     SHUTDOWN: EventTypeString,
 *     ERROR_OCCURRED: EventTypeString,
 *     HEALTH_CHECK: EventTypeString,
 *     CONFIG_LOADED: EventTypeString
 *   }>,
 *   DATA: Readonly<{
 *     LOADED: EventTypeString,
 *     VALIDATED: EventTypeString,
 *     CACHED: EventTypeString,
 *     EXPIRED: EventTypeString,
 *     ERROR: EventTypeString
 *   }>,
 *   RULE: Readonly<{
 *     EXECUTED: EventTypeString,
 *     FAILED: EventTypeString,
 *     REGISTERED: EventTypeString,
 *     CONDITION_MET: EventTypeString
 *   }>,
 *   GAME: Readonly<{
 *     STATE_CHANGED: EventTypeString,
 *     DAY_ADVANCED: EventTypeString,
 *     RESOURCE_UPDATED: EventTypeString
 *   }>
 * }>}
 */
export const EVENT_TYPES = Object.freeze({
  // 系統生命週期事件
  SYSTEM: {
    INITIALIZATION: "system:initialization",
    SHUTDOWN: "system:shutdown",
    ERROR_OCCURRED: "system:error",
    HEALTH_CHECK: "system:health_check",
    CONFIG_LOADED: "system:config_loaded",
  },

  // 資料管理事件
  DATA: {
    LOADED: "data:loaded",
    VALIDATED: "data:validated",
    CACHED: "data:cached",
    EXPIRED: "data:expired",
    ERROR: "data:error",
  },

  // 規則引擎事件
  RULE: {
    EXECUTED: "rule:executed",
    FAILED: "rule:failed",
    REGISTERED: "rule:registered",
    CONDITION_MET: "rule:condition_met",
  },

  // 業務邏輯事件
  GAME: {
    STATE_CHANGED: "game:state_changed",
    DAY_ADVANCED: "game:day_advanced",
    RESOURCE_UPDATED: "game:resource_updated",
  },
});

// ==================== 系統限制常數 ====================

/**
 * 系統技術限制（硬編碼邊界）
 * 用於 EventBus 等系統模組的容量控制
 * @type {Readonly<{
 *   HISTORY: Readonly<{
 *     MAX_LOG_ENTRIES: number,
 *     MAX_EXECUTION_HISTORY: number,
 *     MAX_ERROR_LOG: number
 *   }>,
 *   DATA_STRUCTURE: Readonly<{
 *     MAX_ARRAY_SIZE: number,
 *     MAX_OBJECT_DEPTH: number,
 *     MAX_STRING_LENGTH: number,
 *     MAX_NUMBER_VALUE: number
 *   }>,
 *   EVENTS: Readonly<{
 *     MAX_CHOICES_PER_EVENT: number,
 *     MAX_CONDITIONS_PER_CHOICE: number,
 *     MAX_EFFECTS_PER_CHOICE: number,
 *     MAX_NESTED_CONDITIONS: number
 *   }>,
 *   MODULES: Readonly<{
 *     MAX_VALIDATION_ERRORS: number,
 *     MAX_RETRY_ATTEMPTS: number,
 *     TIMEOUT_MS: number
 *   }>
 * }>}
 */
export const SYSTEM_LIMITS = Object.freeze({
  // 容器大小限制（防止記憶體溢出）
  HISTORY: {
    MAX_LOG_ENTRIES: 100,
    MAX_EXECUTION_HISTORY: 100,
    MAX_ERROR_LOG: 50,
  },

  // 資料結構限制（防止系統崩潰）
  DATA_STRUCTURE: {
    MAX_ARRAY_SIZE: 1000,
    MAX_OBJECT_DEPTH: 10,
    MAX_STRING_LENGTH: 10000,
    MAX_NUMBER_VALUE: Number.MAX_SAFE_INTEGER,
  },

  // 事件系統限制（防止配置錯誤）
  EVENTS: {
    MAX_CHOICES_PER_EVENT: 20,
    MAX_CONDITIONS_PER_CHOICE: 10,
    MAX_EFFECTS_PER_CHOICE: 15,
    MAX_NESTED_CONDITIONS: 5,
  },

  // 模組系統限制
  MODULES: {
    MAX_VALIDATION_ERRORS: 100,
    MAX_RETRY_ATTEMPTS: 3,
    TIMEOUT_MS: 30000,
  },
});

// ==================== 錯誤代碼常數 ====================

/**
 * 系統錯誤代碼
 * 用於 DataManager 等模組的錯誤處理
 * @type {Readonly<{
 *   SYSTEM_INIT_FAILED: ErrorCodeString,
 *   MODULE_LOAD_FAILED: ErrorCodeString,
 *   SERVICE_UNAVAILABLE: ErrorCodeString,
 *   DATA_NOT_FOUND: ErrorCodeString,
 *   DATA_VALIDATION_FAILED: ErrorCodeString,
 *   DATA_LOAD_FAILED: ErrorCodeString,
 *   DATA_CACHE_ERROR: ErrorCodeString,
 *   INVALID_OPERATION: ErrorCodeString,
 *   PRECONDITION_NOT_MET: ErrorCodeString,
 *   RESOURCE_INSUFFICIENT: ErrorCodeString,
 *   UI_ELEMENT_NOT_FOUND: ErrorCodeString,
 *   EVENT_HANDLER_ERROR: ErrorCodeString,
 *   RENDER_ERROR: ErrorCodeString
 * }>}
 */
export const ERROR_CODES = Object.freeze({
  // 系統初始化錯誤
  SYSTEM_INIT_FAILED: "SYSTEM_INIT_FAILED",
  MODULE_LOAD_FAILED: "MODULE_LOAD_FAILED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",

  // 資料相關錯誤
  DATA_NOT_FOUND: "DATA_NOT_FOUND",
  DATA_VALIDATION_FAILED: "DATA_VALIDATION_FAILED",
  DATA_LOAD_FAILED: "DATA_LOAD_FAILED",
  DATA_CACHE_ERROR: "DATA_CACHE_ERROR",

  // 遊戲邏輯錯誤
  INVALID_OPERATION: "INVALID_OPERATION",
  PRECONDITION_NOT_MET: "PRECONDITION_NOT_MET",
  RESOURCE_INSUFFICIENT: "RESOURCE_INSUFFICIENT",

  // 使用者介面錯誤
  UI_ELEMENT_NOT_FOUND: "UI_ELEMENT_NOT_FOUND",
  EVENT_HANDLER_ERROR: "EVENT_HANDLER_ERROR",
  RENDER_ERROR: "RENDER_ERROR",
});

// ==================== 訊息模板常數 ====================

/**
 * 系統訊息模板
 * 用於 DataManager 等模組的統一訊息格式化
 * @type {Readonly<{
 *   SYSTEM: Readonly<{
 *     INITIALIZING: string,
 *     READY: string,
 *     ERROR: MessageTemplateFunction,
 *     SHUTDOWN: string
 *   }>,
 *   DATA: Readonly<{
 *     LOADING: MessageTemplateFunction,
 *     LOADED: MessageTemplateFunction,
 *     ERROR: MessageTemplateBinaryFunction,
 *     VALIDATED: MessageTemplateFunction
 *   }>,
 *   GAME: Readonly<{
 *     ACTION_SUCCESS: MessageTemplateFunction,
 *     ACTION_FAILED: MessageTemplateBinaryFunction,
 *     STATE_CHANGED: MessageTemplateFunction,
 *     RESOURCE_GAINED: function(number, string): string,
 *     RESOURCE_LOST: function(number, string): string
 *   }>,
 *   ERROR: Readonly<{
 *     GENERIC: string,
 *     INSUFFICIENT_DATA: string,
 *     INVALID_INPUT: string,
 *     OPERATION_DENIED: string,
 *     TIMEOUT: string
 *   }>
 * }>}
 */
export const MESSAGE_TEMPLATES = Object.freeze({
  // 系統狀態訊息
  SYSTEM: {
    INITIALIZING: "系統初始化中...",
    READY: "系統就緒",
    ERROR: (/** @type {string} */ error) => `系統錯誤: ${error}`,
    SHUTDOWN: "系統正在關閉...",
  },

  // 資料操作訊息
  DATA: {
    LOADING: (/** @type {string} */ type) => `正在載入 ${type} 資料...`,
    LOADED: (/** @type {string} */ type) => `${type} 資料載入完成`,
    ERROR: (/** @type {string} */ type, /** @type {string} */ error) =>
      `${type} 資料載入失敗: ${error}`,
    VALIDATED: (/** @type {string} */ type) => `${type} 資料驗證通過`,
  },

  // 遊戲操作回饋
  GAME: {
    ACTION_SUCCESS: (/** @type {string} */ action) => `${action} 執行成功`,
    ACTION_FAILED: (
      /** @type {string} */ action,
      /** @type {string} */ reason
    ) => `${action} 執行失敗: ${reason}`,
    STATE_CHANGED: (/** @type {string} */ what) => `${what} 狀態已更新`,
    RESOURCE_GAINED: (
      /** @type {number} */ amount,
      /** @type {string} */ type
    ) => `獲得 ${amount} ${type}`,
    RESOURCE_LOST: (/** @type {number} */ amount, /** @type {string} */ type) =>
      `失去 ${amount} ${type}`,
  },

  // 錯誤處理訊息
  ERROR: {
    GENERIC: "發生未知錯誤",
    INSUFFICIENT_DATA: "資料不足",
    INVALID_INPUT: "輸入無效",
    OPERATION_DENIED: "操作被拒絕",
    TIMEOUT: "操作超時",
  },
});

// ==================== 預設匯出 ====================

/**
 * 預設匯出：核心系統常數集合
 * @type {Readonly<{
 *   EVENT_TYPES: typeof EVENT_TYPES,
 *   SYSTEM_LIMITS: typeof SYSTEM_LIMITS,
 *   ERROR_CODES: typeof ERROR_CODES,
 *   MESSAGE_TEMPLATES: typeof MESSAGE_TEMPLATES
 * }>}
 */
export default Object.freeze({
  EVENT_TYPES,
  SYSTEM_LIMITS,
  ERROR_CODES,
  MESSAGE_TEMPLATES,
});

// @ts-check

/**
 * @fileoverview SystemLogger.js - 系統級訊息管理器
 * 職責：統一處理系統級訊息輸出（Console專用）
 * 設計目標：提供AI編碼習慣友善的API，避免與遊戲日誌混淆
 */

import { MESSAGE_TEMPLATES } from './constants.js';

/**
 * 系統日誌級別
 * @typedef {'debug'|'info'|'warn'|'error'|'success'} SystemLogLevel
 */

/**
 * 系統日誌選項
 * @typedef {Object} SystemLogOptions
 * @property {boolean} [skipTimestamp=false] - 跳過時間戳記
 * @property {string} [prefix] - 自訂前綴
 * @property {boolean} [forceOutput=false] - 強制輸出（忽略debug模式）
 */

/**
 * 系統訊息管理器
 * 專門處理系統級訊息，與遊戲日誌完全分離
 * @class
 */
class SystemLogger {
  constructor() {
    /** @type {boolean} 是否啟用除錯模式 */
    this.debugEnabled = true;

    /** @type {string} 預設前綴 */
    this.defaultPrefix = 'SYSTEM';

    /** @type {Map<SystemLogLevel, string>} 日誌級別對應的Console方法 */
    this.levelMethods = new Map([
      ['debug', 'debug'],
      ['info', 'log'],
      ['warn', 'warn'],
      ['error', 'error'],
      ['success', 'log']
    ]);

    /** @type {Map<SystemLogLevel, string>} 日誌級別對應的emoji */
    this.levelIcons = new Map([
      ['debug', '🔍'],
      ['info', 'ℹ️'],
      ['warn', '⚠️'],
      ['error', '❌'],
      ['success', '✅']
    ]);
  }

  // ==========================================
  // 核心日誌方法（AI編碼習慣友善）
  // ==========================================

  /**
   * 輸出資訊日誌
   * AI習慣方法：避免logInfo不存在的問題
   * @param {string} message - 日誌訊息
   * @param {SystemLogOptions} [options] - 日誌選項
   * @returns {void}
   */
  info(message, options = {}) {
    this._log('info', message, options);
  }

  /**
   * 輸出警告日誌
   * AI習慣方法：對應BaseManager.logWarning但用於系統級
   * @param {string} message - 警告訊息
   * @param {SystemLogOptions} [options] - 日誌選項
   * @returns {void}
   */
  warn(message, options = {}) {
    this._log('warn', message, options);
  }

  /**
   * 輸出錯誤日誌
   * AI習慣方法：對應BaseManager.logError但用於系統級
   * @param {string} message - 錯誤訊息
   * @param {Error|string} [error] - 錯誤物件或詳細資訊
   * @param {SystemLogOptions} [options] - 日誌選項
   * @returns {void}
   */
  error(message, error = null, options = {}) {
    let fullMessage = message;

    if (error) {
      const errorDetails = error instanceof Error ? error.message : String(error);
      fullMessage = `${message}: ${errorDetails}`;
    }

    this._log('error', fullMessage, options);

    // 除錯模式下輸出錯誤堆疊
    if (error instanceof Error && this.debugEnabled) {
      console.error('錯誤堆疊:', error.stack);
    }
  }

  /**
   * 輸出成功日誌
   * AI習慣方法：對應BaseManager.logSuccess但用於系統級
   * @param {string} message - 成功訊息
   * @param {SystemLogOptions} [options] - 日誌選項
   * @returns {void}
   */
  success(message, options = {}) {
    this._log('success', message, options);
  }

  /**
   * 輸出除錯日誌
   * 只在除錯模式下顯示
   * @param {string} message - 除錯訊息
   * @param {string|Object} [extra] - 額外資訊（字串或物件）
   * @param {Object} [data] - 結構化資料物件
   * @param {SystemLogOptions} [options] - 日誌選項
   * @returns {void}
   */
  debug(message, extra = null, data = null, options = {}) {
    if (this.debugEnabled || options.forceOutput) {
      this._logWithData('debug', message, extra, data, options);
    }
  }

  // ==========================================
  // MESSAGE_TEMPLATES 便捷方法
  // ==========================================

  /**
   * 輸出系統初始化訊息
   * @returns {void}
   */
  initializing() {
    this.info(MESSAGE_TEMPLATES.SYSTEM.INITIALIZING);
  }

  /**
   * 輸出系統就緒訊息
   * @returns {void}
   */
  ready() {
    this.success(MESSAGE_TEMPLATES.SYSTEM.READY);
  }

  /**
   * 輸出系統錯誤訊息
   * @param {string} errorMessage - 錯誤描述
   * @returns {void}
   */
  systemError(errorMessage) {
    this.error(MESSAGE_TEMPLATES.SYSTEM.ERROR(errorMessage));
  }

  /**
   * 輸出資料載入訊息
   * @param {string} dataType - 資料類型
   * @returns {void}
   */
  dataLoading(dataType) {
    this.info(MESSAGE_TEMPLATES.DATA.LOADING(dataType));
  }

  /**
   * 輸出資料載入完成訊息
   * @param {string} dataType - 資料類型
   * @returns {void}
   */
  dataLoaded(dataType) {
    this.success(MESSAGE_TEMPLATES.DATA.LOADED(dataType));
  }

  /**
   * 輸出資料載入錯誤訊息
   * @param {string} dataType - 資料類型
   * @param {string} errorMessage - 錯誤描述
   * @returns {void}
   */
  dataError(dataType, errorMessage) {
    this.error(MESSAGE_TEMPLATES.DATA.ERROR(dataType, errorMessage));
  }

  // ==========================================
  // 分組功能支援
  // ==========================================

  /**
   * 開始日誌分組
   * @param {string} label - 分組標籤
   * @param {SystemLogOptions} [options] - 日誌選項
   * @returns {void}
   */
  group(label, options = {}) {
    try {
      const fullLabel = this._buildGroupLabel(label, options);
      console.group(fullLabel);
    } catch (error) {
      console.error('SystemLogger group 失敗:', error);
      console.log(`[GROUP] ${label}`);
    }
  }

  /**
   * 開始收合的日誌分組
   * @param {string} label - 分組標籤
   * @param {SystemLogOptions} [options] - 日誌選項
   * @returns {void}
   */
  groupCollapsed(label, options = {}) {
    try {
      const fullLabel = this._buildGroupLabel(label, options);
      console.groupCollapsed(fullLabel);
    } catch (error) {
      console.error('SystemLogger groupCollapsed 失敗:', error);
      console.log(`[GROUP-COLLAPSED] ${label}`);
    }
  }

  /**
   * 結束當前日誌分組
   * @returns {void}
   */
  groupEnd() {
    try {
      console.groupEnd();
    } catch (error) {
      console.error('SystemLogger groupEnd 失敗:', error);
    }
  }

  /**
   * 帶自動結束的分組執行器
   * @param {string} label - 分組標籤
   * @param {Function} executor - 要在分組中執行的函數
   * @param {boolean} [collapsed=false] - 是否預設收合
   * @param {SystemLogOptions} [options] - 日誌選項
   * @returns {Promise<any>} 執行器的返回值
   */
  async withGroup(label, executor, collapsed = false, options = {}) {
    try {
      // 開始分組
      if (collapsed) {
        this.groupCollapsed(label, options);
      } else {
        this.group(label, options);
      }

      // 執行函數
      const result = await executor();

      return result;
    } catch (error) {
      this.error(`分組執行失敗: ${label}`, error);
      throw error;
    } finally {
      // 確保分組結束
      this.groupEnd();
    }
  }

  // ==========================================
  // 配置管理
  // ==========================================

  /**
   * 設定除錯模式
   * @param {boolean} enabled - 是否啟用除錯模式
   * @returns {void}
   */
  setDebugMode(enabled) {
    this.debugEnabled = enabled;
    this.info(`除錯模式已${enabled ? '啟用' : '停用'}`);
  }

  /**
   * 設定預設前綴
   * @param {string} prefix - 新的預設前綴
   * @returns {void}
   */
  setDefaultPrefix(prefix) {
    this.defaultPrefix = prefix;
  }


  /**
   * 建構分組標籤
   * @param {string} label - 原始標籤
   * @param {SystemLogOptions} options - 日誌選項
   * @returns {string} 完整標籤
   * @private
   */
  _buildGroupLabel(label, options) {
    const timestamp = options.skipTimestamp ? '' : `[${new Date().toLocaleTimeString()}] `;
    const prefix = options.prefix || this.defaultPrefix;
    return `${timestamp}🗂️ ${prefix}: ${label}`;
  }


  // ==========================================
  // 內部實作
  // ==========================================

  /**
   * 核心日誌輸出方法（支援額外資料）
   * @param {SystemLogLevel} level - 日誌級別
   * @param {string} message - 主要訊息
   * @param {string|Object} extra - 額外資訊
   * @param {Object} data - 結構化資料
   * @param {SystemLogOptions} options - 日誌選項
   * @returns {void}
   * @private
   */
  _logWithData(level, message, extra, data, options) {
    try {
      // 建構基本訊息
      const timestamp = options.skipTimestamp ? '' : `[${new Date().toLocaleTimeString()}] `;
      const prefix = options.prefix || this.defaultPrefix;
      const icon = this.levelIcons.get(level) || '';

      // 處理額外資訊
      let fullMessage = `${timestamp}${icon} ${prefix}: ${message}`;
      if (extra !== null) {
        if (typeof extra === 'string') {
          fullMessage += ` ${extra}`;
        }
      }

      // 選擇對應的Console方法
      const consoleMethod = this.levelMethods.get(level) || 'log';

      // 根據參數情況選擇輸出方式
      if (data !== null && extra !== null && typeof extra === 'object') {
        // 三參數情況：訊息 + 額外物件 + 資料物件
        console[consoleMethod](fullMessage, extra, data);
      } else if (data !== null) {
        // 兩參數情況：訊息 + 資料物件
        console[consoleMethod](fullMessage, data);
      } else if (extra !== null && typeof extra === 'object') {
        // 兩參數情況：訊息 + 額外物件
        console[consoleMethod](fullMessage, extra);
      } else {
        // 單參數情況：僅訊息
        console[consoleMethod](fullMessage);
      }

    } catch (error) {
      // 緊急後備：直接輸出原始訊息
      console.error('SystemLogger _logWithData 輸出失敗:', error);
      console.log(`[EMERGENCY] ${message}`, extra, data);
    }
  }

  /**
   * 核心日誌輸出方法
   * @param {SystemLogLevel} level - 日誌級別
   * @param {string} message - 日誌訊息
   * @param {SystemLogOptions} options - 日誌選項
   * @returns {void}
   * @private
   */
  _log(level, message, options) {
    try {
      // 建構完整訊息
      const timestamp = options.skipTimestamp ? '' : `[${new Date().toLocaleTimeString()}] `;
      const prefix = options.prefix || this.defaultPrefix;
      const icon = this.levelIcons.get(level) || '';
      const fullMessage = `${timestamp}${icon}[${prefix}]: ${message}`;

      // 選擇對應的Console方法
      const consoleMethod = this.levelMethods.get(level) || 'log';

      // 輸出到Console
      console[consoleMethod](fullMessage);

    } catch (error) {
      // 緊急後備：直接輸出原始訊息
      console.error('SystemLogger 輸出失敗:', error);
      console.log(`[EMERGENCY] ${message}`);
    }
  }

  // ==========================================
  // 狀態查詢
  // ==========================================

  /**
   * 取得當前配置狀態
   * @returns {Object} 配置狀態
   */
  getStatus() {
    return {
      debugEnabled: this.debugEnabled,
      defaultPrefix: this.defaultPrefix,
      supportedLevels: Array.from(this.levelMethods.keys())
    };
  }
}

// ==========================================
// 全域單例實例
// ==========================================

/** @type {SystemLogger} 全域系統日誌器實例 */
const systemLogger = new SystemLogger();

export default systemLogger;
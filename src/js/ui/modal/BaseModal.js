// @ts-check
/**
 * BaseModal.js - Modal 基礎類別
 * 職責：提供所有 Modal 的共同功能和標準化介面
 * 避免代碼重複，確保一致性
 */

import systemLogger from '../../utils/SystemLogger.js';

export default class BaseModal {
  /**
   * 建立基礎 Modal 實例
   * @param {Object} gameApp - 遊戲應用程式實例
   * @param {Object} uiCore - UICore 實例
   */
  constructor(gameApp, uiCore) {
    this.gameApp = gameApp;
    this.uiCore = uiCore;
    this.isInitialized = false;
    this.modalName = this.constructor.name;

    // 初始化時一次性驗證，避免運行時重複檢查
    this._isDependencyValid = this._validateDependencies();
  }

  // =================== 標準生命週期方法 ===================

  /**
   * 初始化 Modal（子類別可覆寫）
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this._isDependencyValid) {
      throw new Error(`${this.modalName}: 依賴驗證失敗，無法初始化`);
    }

    // 子類別可在此之前執行自定義初始化
    await this._performCustomInitialization();

    this.isInitialized = true;
    systemLogger.success(`✅ ${this.modalName} 初始化完成`);
  }

  /**
   * 自定義初始化邏輯（子類別可覆寫）
   * @protected
   * @returns {Promise<void>}
   */
  async _performCustomInitialization() {
    // 預設為空實作，子類別可選擇性覆寫
  }

  // =================== 標準化 Modal 操作 ===================

  /**
   * 顯示 Modal（使用 UICore 的模態框系統）
   * @protected
   * @param {string} modalId - Modal ID
   * @returns {boolean} 是否成功顯示
   */
  _showModal(modalId) {
    if (this.uiCore?.modal?.show) {
      return this.uiCore.modal.show(modalId);
    } else {
      // 後備方案：直接操作 DOM
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'flex';
        return true;
      } else {
        systemLogger.error(`${this.modalName}: 找不到 Modal ${modalId}`);
        return false;
      }
    }
  }

  /**
   * 關閉 Modal（委託給 UICore）
   * @protected
   * @param {string} [modalId] - Modal ID（可選）
   * @returns {boolean} 是否成功關閉
   */
  _closeModal(modalId = null) {
    if (this.uiCore?.closeModal) {
      this.uiCore.closeModal(modalId);
      return true;
    } else {
      systemLogger.error(`${this.modalName}: UICore.closeModal 不可用`);
      return false;
    }
  }

  // =================== 工具方法 ===================

  /**
   * 安全地更新 DOM 元素內容
   * @protected
   * @param {string} elementId - 元素 ID
   * @param {string} content - HTML 內容
   * @returns {boolean} 是否成功更新
   */
  _updateElement(elementId, content) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = content;
      return true;
    } else {
      systemLogger.warn(`${this.modalName}: 找不到元素 ${elementId}`);
      return false;
    }
  }

  /**
   * 安全地設置元素文字內容
   * @protected
   * @param {string} elementId - 元素 ID
   * @param {string} text - 文字內容
   * @returns {boolean} 是否成功設置
   */
  _setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
      return true;
    } else {
      systemLogger.warn(`${this.modalName}: 找不到元素 ${elementId}`);
      return false;
    }
  }

  // =================== 直接GameState存取（消除過度封裝） ===================

  /**
   * 直接存取遊戲狀態（無封裝開銷）
   * @protected
   * @returns {Object} GameState實例
   */
  get gameState() {
    return this.gameApp.gameState;
  }

  /**
   * 添加遊戲日誌（直接方法）
   * @protected
   * @param {string} message - 日誌訊息
   * @param {string} type - 日誌類型
   */
  _addGameLog(message, type = 'info') {
    this.gameState?.addLog(message, type);
  }

  // =================== UICore便捷方法（直接委託） ===================

  /**
   * 獲取圖示（透過 UICore）
   * @protected
   * @param {string} type - 類型
   * @param {string} category - 分類
   * @returns {string} 圖示字串
   */
  _getIcon(type, category) {
    return this.uiCore?.getIcon(type, category) || '';
  }

  /**
   * 獲取資源名稱（透過 UICore）
   * @protected
   * @param {string} resourceType - 資源類型
   * @returns {string} 資源名稱
   */
  _getResourceName(resourceType) {
    return this.uiCore?.getResourceName(resourceType) || resourceType;
  }

  // =================== 驗證和錯誤處理 ===================

  /**
   * 驗證必要依賴是否可用
   * @protected
   * @returns {boolean} 依賴是否完整
   */
  _validateDependencies() {
    const issues = [];

    if (!this.gameApp) issues.push('gameApp');
    if (!this.uiCore) issues.push('uiCore');
    if (!this.gameApp?.gameState) issues.push('gameState');

    if (issues.length > 0) {
      systemLogger.error(`${this.modalName}: 缺少必要依賴: ${issues.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * 快速執行操作（移除不必要的依賴檢查）
   * @protected
   * @param {Function} operation - 要執行的操作
   * @param {string} operationName - 操作名稱（用於錯誤報告）
   * @returns {Promise<boolean>} 是否成功執行
   */
  async _quickExecute(operation, operationName) {
    try {
      await operation();
      return true;
    } catch (error) {
      systemLogger.error(`${this.modalName}.${operationName} 失敗:`, error);
      this._addGameLog(`${operationName}失敗`, 'danger');
      return false;
    }
  }

  /**
   * 安全執行操作（保留關鍵錯誤處理）
   * 僅在需要完整錯誤隔離時使用
   * @protected
   * @param {Function} operation - 要執行的操作
   * @param {string} operationName - 操作名稱
   * @returns {Promise<boolean>} 是否成功執行
   */
  async _safeExecute(operation, operationName) {
    // 快速依賴檢查（不重複完整驗證）
    if (!this._isDependencyValid || !this.isInitialized) {
      systemLogger.error(`${this.modalName}: 系統未正確初始化`);
      return false;
    }

    return this._quickExecute(operation, operationName);
  }

  // =================== 標準介面方法 ===================

  /**
   * 獲取 Modal 狀態
   * @returns {Object} 狀態物件
   */
  getStatus() {
    return {
      modalName: this.modalName,
      initialized: this.isInitialized,
      dependenciesValid: this._isDependencyValid,
      gameApp: !!this.gameApp,
      uiCore: !!this.uiCore,
      gameState: !!this.gameApp?.gameState
    };
  }

  /**
   * 除錯資訊輸出
   */
  debug() {
    systemLogger.debug(`${this.modalName} 狀態:`, this.getStatus());
  }

  /**
   * 檢查 Modal 是否準備就緒
   * @returns {boolean} 是否準備就緒
   */
  isReady() {
    return this.isInitialized && this._isDependencyValid;
  }

  // =================== 抽象方法提醒 ===================

  /**
   * 顯示 Modal 的主要方法（子類別應該實作）
   * @abstract
   * @param {...any} args - 參數
   * @throws {Error} 子類別必須實作此方法
   */
  show(...args) {
    throw new Error(`${this.modalName} 必須實作 show() 方法`);
  }
}
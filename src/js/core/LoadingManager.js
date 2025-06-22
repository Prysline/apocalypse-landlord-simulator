// @ts-check

/**
 * @fileoverview LoadingManager.js - 初始化流程管理器
 * 職責：統一管理系統初始化、載入進度顯示、UI狀態控制
 * 位置：core層 - 核心初始化協調服務
 */

import systemLogger from '../utils/SystemLogger.js';

/**
 * 載入步驟資訊
 * @typedef {Object} LoadingStep
 * @property {string} id - 步驟唯一識別碼
 * @property {string} name - 步驟顯示名稱
 * @property {boolean} completed - 是否已完成
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 載入配置
 * @typedef {Object} LoadingConfig
 * @property {boolean} [showProgress=true] - 是否顯示進度條
 * @property {boolean} [lockUI=true] - 是否鎖定UI
 * @property {number} [timeout=10000] - 載入超時時間（毫秒）
 * @property {string} [loadingText='系統初始化中...'] - 載入提示文字
 */

/**
 * 初始化流程管理器
 * 統一管理所有系統初始化相關邏輯
 * @class
 */
class LoadingManager {
  constructor() {
    /** @type {Map<string, LoadingStep>} 載入步驟追蹤 */
    this.steps = new Map();

    /** @type {boolean} 是否正在載入中 */
    this.isLoading = false;

    /** @type {boolean} 是否已初始化完成 */
    this.isInitialized = false;

    /** @type {number|null} 載入超時計時器 */
    this.timeoutTimer = null;

    /** @type {number} 載入開始時間 */
    this.startTime = 0;

    /** @type {LoadingConfig} 預設載入配置 */
    this.defaultConfig = {
      showProgress: true,
      lockUI: true,
      timeout: 10000,
      loadingText: '系統初始化中...'
    };
  }

  // ==========================================
  // 初始化流程控制
  // ==========================================

  /**
   * 開始初始化流程
   * @param {Array<LoadingStep>} steps - 初始化步驟列表
   * @param {LoadingConfig} [config] - 載入配置
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async startInitialization(steps, config = {}) {
    if (this.isLoading) {
      systemLogger.warn('初始化已在進行中，忽略重複請求');
      return false;
    }

    const finalConfig = { ...this.defaultConfig, ...config };

    try {
      this.isLoading = true;
      this.startTime = Date.now();
      this._setupSteps(steps);

      systemLogger.info('開始系統初始化流程');

      // 顯示載入畫面
      if (finalConfig.showProgress) {
        this._showLoadingScreen(finalConfig.loadingText);
      }

      // 鎖定UI
      if (finalConfig.lockUI) {
        this._lockUI();
      }

      // 設定超時處理
      this._setupTimeout(finalConfig.timeout);

      return true;

    } catch (error) {
      systemLogger.error('初始化流程啟動失敗', error);
      this._cleanup();
      return false;
    }
  }

  /**
   * 更新步驟進度
   * @param {string} stepId - 步驟ID
   * @param {boolean} [completed=true] - 是否完成
   * @param {string} [error] - 錯誤訊息
   * @returns {void}
   */
  updateProgress(stepId, completed = true, error = null) {
    const step = this.steps.get(stepId);
    if (!step) {
      systemLogger.warn(`未知的載入步驟: ${stepId}`);
      return;
    }

    step.completed = completed;
    if (error) {
      step.error = error;
      systemLogger.error(`載入步驟失敗: ${step.name}`, error);
    } else {
      systemLogger.success(`載入步驟完成: ${step.name}`);
    }

    // 更新進度顯示
    this._updateProgressDisplay();

    // 檢查是否所有步驟都完成
    if (this._allStepsCompleted()) {
      this.finishInitialization();
    }
  }

  /**
   * 完成初始化流程
   * @returns {void}
   */
  finishInitialization() {
    if (!this.isLoading) {
      return;
    }

    try {
      const duration = Date.now() - this.startTime;
      const hasErrors = Array.from(this.steps.values()).some(step => step.error);

      if (hasErrors) {
        systemLogger.warn(`初始化完成但有錯誤，耗時: ${duration}ms`);
      } else {
        systemLogger.success(`初始化成功完成，耗時: ${duration}ms`);
      }

      // 隱藏載入畫面
      this._hideLoadingScreen();

      // 解鎖UI
      this._unlockUI();

      // 清理資源
      this._cleanup();

      this.isInitialized = true;
      this.isLoading = false;

    } catch (error) {
      systemLogger.error('完成初始化時發生錯誤', error);
    }
  }

  /**
   * 取消初始化流程
   * @param {string} [reason='使用者取消'] - 取消原因
   * @returns {void}
   */
  cancelInitialization(reason = '使用者取消') {
    if (!this.isLoading) {
      return;
    }

    systemLogger.warn(`初始化被取消: ${reason}`);
    this._cleanup();
    this._hideLoadingScreen();
    this._unlockUI();

    this.isLoading = false;
  }

  // ==========================================
  // UI控制方法
  // ==========================================

  /**
   * 鎖定UI（禁用所有遊戲按鈕）
   * @returns {void}
   * @private
   */
  _lockUI() {
    try {
      // 禁用所有遊戲操作按鈕
      /** @type {NodeListOf<HTMLButtonElement>} */
      const gameButtons = document.querySelectorAll('.game-button, .action-button, button[data-game-action]');
      gameButtons.forEach(button => {
        button.disabled = true;
        button.dataset.wasDisabled = button.hasAttribute('disabled') ? 'true' : 'false';
      });

      // 添加載入中的樣式
      document.body.classList.add('loading');

      systemLogger.debug('UI已鎖定');
    } catch (error) {
      systemLogger.error('鎖定UI失敗', error);
    }
  }

  /**
   * 解鎖UI（恢復所有按鈕狀態）
   * @returns {void}
   * @private
   */
  _unlockUI() {
    try {
      // 恢復按鈕狀態
      /** @type {NodeListOf<HTMLButtonElement>} */
      const gameButtons = document.querySelectorAll('.game-button, .action-button, button[data-game-action]');
      gameButtons.forEach(button => {
        if (button.dataset.wasDisabled !== 'true') {
          button.disabled = false;
        }
        delete button.dataset.wasDisabled;
      });

      // 移除載入樣式
      document.body.classList.remove('loading');

      systemLogger.debug('UI已解鎖');
    } catch (error) {
      systemLogger.error('解鎖UI失敗', error);
    }
  }

  /**
   * 顯示載入畫面（內嵌CSS版本）
   * @param {string} text - 載入提示文字
   * @returns {void}
   * @private
   */
  _showLoadingScreen(text) {
    try {
      // 檢查是否已存在載入畫面
      let loadingScreen = document.getElementById('systemLoadingScreen');

      if (!loadingScreen) {
        // 注入CSS樣式（確保樣式可用）
        this._injectLoadingCSS();

        // 創建載入畫面
        loadingScreen = document.createElement('div');
        loadingScreen.id = 'systemLoadingScreen';
        loadingScreen.className = 'loading-screen';
        loadingScreen.innerHTML = `
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <div class="loading-text">${text}</div>
          <div class="loading-progress">
            <div class="progress-bar">
              <div class="progress-fill" id="loadingProgressFill"></div>
            </div>
            <div class="progress-text" id="loadingProgressText">準備中...</div>
          </div>
        </div>
      `;

        document.body.appendChild(loadingScreen);
        systemLogger.debug('載入畫面DOM已創建');
      }

      // 強制顯示載入畫面
      loadingScreen.style.display = 'flex';
      loadingScreen.style.opacity = '1';

      systemLogger.debug('載入畫面已顯示');

    } catch (error) {
      systemLogger.error('顯示載入畫面失敗', error);
    }
  }

  /**
   * 注入載入畫面CSS樣式
   * @returns {void}
   * @private
   */
  _injectLoadingCSS() {
    // 檢查是否已經注入過CSS
    if (document.getElementById('loadingScreenCSS')) {
      return;
    }

    const css = `
    .loading-screen {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.9) !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      z-index: 9999 !important;
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
    }

    .loading-content {
      text-align: center;
      color: #ffffff;
      padding: 40px;
      background: rgba(30, 30, 30, 0.95);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      min-width: 320px;
      max-width: 480px;
    }

    .loading-spinner {
      width: 60px;
      height: 60px;
      margin: 0 auto 20px;
      border: 4px solid rgba(255, 255, 255, 0.2);
      border-top: 4px solid #4a9eff;
      border-radius: 50%;
      animation: loading-spin 1s linear infinite;
    }

    @keyframes loading-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-text {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 25px;
      color: #e0e0e0;
      letter-spacing: 0.5px;
    }

    .loading-progress {
      width: 100%;
      margin-top: 15px;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 12px;
      position: relative;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4a9eff, #00d4ff);
      border-radius: 4px;
      width: 0%;
      transition: width 0.3s ease-out;
      position: relative;
    }

    .progress-text {
      font-size: 14px;
      color: #b0b0b0;
      margin-top: 8px;
    }

    body.loading {
      overflow: hidden !important;
      pointer-events: none !important;
    }

    body.loading .loading-screen {
      pointer-events: auto !important;
    }

    @media (max-width: 480px) {
      .loading-content {
        margin: 20px;
        padding: 30px 25px;
        min-width: auto;
      }

      .loading-spinner {
        width: 50px;
        height: 50px;
      }

      .loading-text {
        font-size: 16px;
      }
    }
  `;

    const style = document.createElement('style');
    style.id = 'loadingScreenCSS';
    style.textContent = css;
    document.head.appendChild(style);

    systemLogger.debug('載入畫面CSS已注入');
  }

  /**
   * 隱藏載入畫面
   * @returns {void}
   * @private
   */
  _hideLoadingScreen() {
    try {
      const loadingScreen = document.getElementById('systemLoadingScreen');
      if (loadingScreen) {
        loadingScreen.remove();
      }
    } catch (error) {
      systemLogger.error('隱藏載入畫面失敗', error);
    }
  }

  /**
   * 更新進度顯示
   * @returns {void}
   * @private
   */
  _updateProgressDisplay() {
    try {
      const completedSteps = Array.from(this.steps.values()).filter(step => step.completed).length;
      const totalSteps = this.steps.size;
      const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

      // 更新進度條
      const progressFill = document.getElementById('loadingProgressFill');
      if (progressFill) {
        progressFill.style.width = `${progress}%`;
      }

      // 更新進度文字
      const progressText = document.getElementById('loadingProgressText');
      if (progressText) {
        progressText.textContent = `${completedSteps}/${totalSteps} 載入完成`;
      }

    } catch (error) {
      systemLogger.error('更新進度顯示失敗', error);
    }
  }

  // ==========================================
  // 內部輔助方法
  // ==========================================

  /**
   * 設定載入步驟
   * @param {Array<LoadingStep>} steps - 步驟列表
   * @returns {void}
   * @private
   */
  _setupSteps(steps) {
    this.steps.clear();
    steps.forEach(step => {
      this.steps.set(step.id, { ...step, completed: false });
    });
  }

  /**
   * 檢查所有步驟是否完成
   * @returns {boolean} 是否所有步驟都完成
   * @private
   */
  _allStepsCompleted() {
    return Array.from(this.steps.values()).every(step => step.completed);
  }

  /**
   * 設定超時處理
   * @param {number} timeout - 超時時間（毫秒）
   * @returns {void}
   * @private
   */
  _setupTimeout(timeout) {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
    }

    this.timeoutTimer = setTimeout(() => {
      systemLogger.error(`初始化超時 (${timeout}ms)`);
      this.cancelInitialization('初始化超時');
    }, timeout);
  }

  /**
   * 清理資源
   * @returns {void}
   * @private
   */
  _cleanup() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  // ==========================================
  // 狀態查詢
  // ==========================================

  /**
   * 取得當前載入狀態
   * @returns {Object} 載入狀態資訊
   */
  getStatus() {
    const completedSteps = Array.from(this.steps.values()).filter(step => step.completed).length;
    const errorSteps = Array.from(this.steps.values()).filter(step => step.error).length;

    return {
      isLoading: this.isLoading,
      isInitialized: this.isInitialized,
      totalSteps: this.steps.size,
      completedSteps,
      errorSteps,
      progress: this.steps.size > 0 ? (completedSteps / this.steps.size) * 100 : 0,
      duration: this.startTime > 0 ? Date.now() - this.startTime : 0
    };
  }
}

// ==========================================
// 全域單例實例
// ==========================================

/** @type {LoadingManager} 全域載入管理器實例 */
const loadingManager = new LoadingManager();

export default loadingManager;
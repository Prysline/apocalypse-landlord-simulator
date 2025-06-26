/**
 * DayManager - 遊戲循環管理器
 *
 * 職責：協調每日循環的核心業務邏輯
 */

import EventBus from '../core/EventBus.js';
import GameState from '../core/GameState.js';
import BaseManager from '../systems/BaseManager.js';
import ResourceManager from '../systems/ResourceManager.js';
import SkillManager from '../systems/SkillManager.js';
import TenantManager from '../systems/TenantManager.js';
import TradeManager from '../systems/TradeManager.js';
import systemLogger from '../utils/SystemLogger.js';

/**
 * 每日循環執行結果
 * @typedef {Object} DayResult
 * @property {boolean} success - 是否成功
 * @property {number} newDay - 新的天數
 * @property {string} [error] - 錯誤訊息（失敗時）
 * @property {number} [duration] - 執行時間（毫秒）
 */

/**
 * 管理器可用性報告
 * @typedef {Object} ManagerAvailability
 * @property {boolean} resourceManager - 資源管理器是否可用
 * @property {boolean} tenantManager - 租客管理器是否可用
 * @property {boolean} tradeManager - 交易管理器是否可用
 * @property {boolean} skillManager - 技能管理器是否可用
 * @property {boolean} eventManager - 事件管理器是否可用
 * @property {boolean} allRequiredAvailable - 所有必要管理器是否都可用
 */

/**
 * DayManager
 * 專注核心循環邏輯，完全繼承 BaseManager 架構
 */
class DayManager extends BaseManager {
  /**
   * 建立 DayManager 實例
   * @param {GameState} gameState - 遊戲狀態管理器
   * @param {EventBus} eventBus - 事件總線
   * @param {ResourceManager} resourceManager - 資源管理器
   * @param {TenantManager} tenantManager - 租客管理器
   * @param {TradeManager} tradeManager - 交易管理器
   * @param {SkillManager} [skillManager] - 技能管理器（可選）
   * @param {Object} [eventManager] - 事件管理器（可選）
   */
  constructor(gameState, eventBus, resourceManager, tenantManager, tradeManager, skillManager = null, eventManager = null) {
    // 調用 BaseManager 建構函式
    super(gameState, eventBus, 'DayManager');

    // 業務管理器依賴注入
    this.resourceManager = resourceManager;
    this.tenantManager = tenantManager;
    this.tradeManager = tradeManager;
    this.skillManager = skillManager;
    this.eventManager = eventManager;

    // 執行統計（簡化版）
    this.totalDaysProcessed = 0;
    this.lastExecutionTime = 0;

    // Constructor 只做基本設置，實際初始化由 initialize() 方法處理
    systemLogger.info('DayManager 已建立，等待初始化');
  }

  // ==========================================
  // 初始化邏輯
  // ==========================================

  /**
   * 初始化 DayManager
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      systemLogger.info('開始初始化 DayManager...');

      // 1. 驗證必要依賴
      this._validateRequiredDependencies();

      // 2. 設置事件監聽器
      this.setupEventListeners();

      // 3. 驗證管理器狀態
      const availability = this.getManagerAvailability();
      if (!availability.allRequiredAvailable) {
        this.logError('必要管理器不可用', new Error('依賴檢查失敗'));
        this.markInitialized(false);
        return false;
      }

      // 4. 標記初始化完成
      this.markInitialized(true);

      systemLogger.success('DayManager 初始化完成');
      systemLogger.debug(`管理器狀態: ${JSON.stringify(availability)}`);

      return true;

    } catch (error) {
      this.logError('DayManager 初始化失敗', error);
      this.markInitialized(false);
      return false;
    }
  }

  // ==========================================
  // BaseManager 抽象方法實作
  // ==========================================

  /**
   * 取得模組前綴（BaseManager 要求實作）
   * @returns {string} 模組前綴
   */
  getModulePrefix() {
    return 'day';
  }

  /**
   * 設置事件監聽器（BaseManager 要求實作）
   * @returns {void}
   */
  setupEventListeners() {
    // 監聽系統級事件（無前綴）
    this.onEvent('system_error', (eventObj) => {
      this.logError('檢測到系統錯誤', eventObj.data);
    });

    // 監聽遊戲狀態變更（系統級事件）
    this.onEvent('game_state_changed', (eventObj) => {
      systemLogger.debug('遊戲狀態已更新');
    });
  }

  /**
   * 取得擴展狀態資訊（BaseManager 要求實作）
   * @returns {Object} 擴展的狀態資訊
   */
  getExtendedStatus() {
    return {
      totalDaysProcessed: this.totalDaysProcessed,
      lastExecutionTime: this.lastExecutionTime,
      averageExecutionTime: this.totalDaysProcessed > 0
        ? Math.round(this.lastExecutionTime)
        : 0,
      availableManagers: this.getManagerAvailability(),
      allRequiredAvailable: this.areRequiredManagersAvailable()
    };
  }

  // ==========================================
  // 依賴驗證與管理器檢查
  // ==========================================

  /**
   * 驗證必要依賴
   * @private
   * @throws {Error} 當必要依賴缺失時
   */
  _validateRequiredDependencies() {
    const required = [
      { name: 'resourceManager', instance: this.resourceManager },
      { name: 'tenantManager', instance: this.tenantManager },
      { name: 'tradeManager', instance: this.tradeManager }
    ];

    const missing = required.filter(dep => !dep.instance);

    if (missing.length > 0) {
      const missingNames = missing.map(dep => dep.name).join(', ');
      throw new Error(`DayManager 缺失必要依賴: ${missingNames}`);
    }

    systemLogger.debug('必要依賴驗證通過');
  }

  /**
   * 檢查所有必要管理器是否可用
   * @returns {boolean} 是否所有必要管理器都可用
   */
  areRequiredManagersAvailable() {
    return !!(this.resourceManager && this.tenantManager && this.tradeManager);
  }

  /**
   * 取得管理器可用性報告
   * @returns {ManagerAvailability} 可用性報告
   */
  getManagerAvailability() {
    return {
      resourceManager: !!this.resourceManager,
      tenantManager: !!this.tenantManager,
      tradeManager: !!this.tradeManager,
      skillManager: !!this.skillManager,
      eventManager: !!this.eventManager,
      allRequiredAvailable: this.areRequiredManagersAvailable()
    };
  }

  // ==========================================
  // 核心執行邏輯
  // ==========================================

  /**
   * 執行下一天的循環
   * @returns {Promise<DayResult>} 執行結果
   */
  async executeNextDay() {
    const startTime = Date.now();
    const currentDay = this.gameState.getStateValue('day', 0);
    const newDay = currentDay + 1;

    try {
      // 檢查必要管理器可用性
      if (!this.areRequiredManagersAvailable()) {
        throw new Error('必要管理器不可用，無法執行每日循環');
      }

      // 換日前處理：檢查自主探索觸發
      await this._executeManagerOperation(
        this.tenantManager,
        'checkAutonomousExploration',
        '自主探索檢查'
      );

      // 推進天數
      const advanceSuccess = this.gameState.advanceDay();
      if (!advanceSuccess) {
        throw new Error('GameState.advanceDay() 失敗');
      }

      // 技術日誌：只在 terminal 顯示
      systemLogger.debug(`🌅 DayManager: 開始第 ${newDay} 天的處理流程`);
      // 遊戲日誌：玩家可見的內容（在天數推進後記錄，確保日誌前綴正確）
      this.addLog(`🌅 第 ${newDay} 天開始`);

      // 發送每日開始事件（系統級事件，使用 BaseManager 統一介面）
      this.addLog(`🔄 發送 day_start 事件 (第 ${newDay} 天)`);
      this.emitEvent('day_start', { day: newDay });

      // 執行每日業務邏輯
      await this.processDailyOperations();

      // 更新統計
      this.totalDaysProcessed++;
      this.lastExecutionTime = Date.now() - startTime;

      // 發送每日完成事件（系統級事件）
      this.emitEvent('day_complete', {
        day: newDay,
        duration: this.lastExecutionTime
      });

      // 技術日誌：顯示執行時間等技術資訊
      systemLogger.debug(`✅ DayManager: 第 ${newDay} 天處理完成 (${this.lastExecutionTime}ms)`);

      return {
        success: true,
        newDay: newDay,
        duration: this.lastExecutionTime
      };

    } catch (error) {
      this.logError('每日循環執行失敗', error);

      // 發送每日失敗事件（系統級事件）
      this.emitEvent('day_failed', {
        day: newDay,
        error: error.message
      });

      return {
        success: false,
        newDay: currentDay, // 保持原天數
        error: error.message
      };
    }
  }

  /**
   * 處理每日業務操作
   * 按序執行各管理器的每日邏輯
   * @private
   * @returns {Promise<void>}
   */
  async processDailyOperations() {
    // 1. 處理每日資源消費
    await this._executeManagerOperation(
      this.resourceManager,
      'processDailyConsumption',
      '資源消費處理'
    );

    // 2. 處理被動技能（如果可用）
    if (this.skillManager) {
      await this._executeManagerOperation(
        this.skillManager,
        'processPassiveSkills',
        '被動技能處理'
      );
    }

    // 3. 處理租客互助交易
    await this._executeManagerOperation(
      this.tradeManager,
      'processMutualAid',
      '互助交易處理'
    );

    // 5. 處理每日事件（如果可用）
    if (this.eventManager) {
      await this._executeManagerOperation(
        this.eventManager,
        'triggerDailyEvents',
        '每日事件處理'
      );
    }

    // 6. 檢查資源閾值
    this._executeManagerOperation(
      this.resourceManager,
      'checkAllResourceThresholds',
      '資源閾值檢查',
      false // 同步操作
    );

    // 7. 重置並生成新申請者
    this._executeManagerOperation(
      this.tenantManager,
      'clearApplicants',
      '清空申請者',
      false
    );

    this._executeManagerOperation(
      this.tenantManager,
      'generateApplicants',
      '新申請者生成',
      false // 同步操作
    );
  }

  /**
   * 安全執行管理器操作
   * @private
   * @param {Object} manager - 管理器實例
   * @param {string} methodName - 方法名稱
   * @param {string} operationName - 操作描述
   * @param {boolean} [isAsync=true] - 是否為非同步操作
   * @returns {Promise<any>} 操作結果
   */
  async _executeManagerOperation(manager, methodName, operationName, isAsync = true) {
    if (!manager || typeof manager[methodName] !== 'function') {
      this.logWarning(`${operationName}: 管理器方法 ${methodName} 不可用`);
      return null;
    }

    try {
      const result = isAsync
        ? await manager[methodName]()
        : manager[methodName]();

      // 技術日誌：只在 terminal 顯示
      systemLogger.success(`✅ DayManager: ${operationName}完成`);

      // Debug 模式下才在遊戲日誌中顯示技術訊息
      if (this.isDebugMode && typeof this.isDebugMode === 'function' && this.isDebugMode()) {
        systemLogger.debug(`${operationName}完成`);
      }

      return result;
    } catch (error) {
      systemLogger.error(`❌ DayManager: ${operationName}失敗 -`, error);
      // 錯誤訊息需要在遊戲日誌中顯示，但使用更友善的用語
      this.addLog(`⚠️ 系統處理異常`, 'danger');
      return null;
    }
  }

  // ==========================================
  // 統計與狀態查詢
  // ==========================================

  /**
   * 取得執行統計
   * @returns {Object} 統計資料
   */
  getExecutionStats() {
    return {
      totalDaysProcessed: this.totalDaysProcessed,
      lastExecutionTime: this.lastExecutionTime,
      averageExecutionTime: this.totalDaysProcessed > 0
        ? Math.round(this.lastExecutionTime)
        : 0,
      managerAvailability: this.getManagerAvailability()
    };
  }

  /**
   * 取得詳細狀態報告
   * @returns {Object} 詳細狀態報告
   */
  getDetailedStatus() {
    const baseStatus = this.getStatus();
    const extendedStatus = this.getExtendedStatus();
    const executionStats = this.getExecutionStats();

    return {
      ...baseStatus,
      ...extendedStatus,
      execution: executionStats,
      dependencies: {
        required: ['resourceManager', 'tenantManager', 'tradeManager'],
        optional: ['skillManager', 'eventManager'],
        availability: this.getManagerAvailability()
      }
    };
  }
}

export default DayManager;
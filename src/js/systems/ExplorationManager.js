// @ts-check

/**
 * @fileoverview ExplorationManager.js - 探索系統管理器
 * 職責：提供探索執行的統一管理，包含執行、統計、事件協調
 */

import BaseManager from "./BaseManager.js";

/**
 * 探索參與者
 * @typedef {Object} ExplorationParticipant
 * @property {string} id - 參與者ID
 * @property {string} name - 參與者姓名
 * @property {string} type - 參與者類型
 * @property {Object} personalResources - 個人資源
 */

/**
 * 探索請求
 * @typedef {Object} ExplorationRequest
 * @property {string} type - 探索類型 ('commission'|'autonomous')
 * @property {string} requestId - 請求ID
 * @property {string} resourceType - 目標資源類型
 * @property {number} targetAmount - 目標數量
 * @property {Array<ExplorationParticipant>} participants - 參與者
 * @property {string} priority - 優先級 ('low'|'medium'|'high'|'critical')
 * @property {Object} [basePayment] - 基礎報酬（委託探索用）
 * @property {Object} [commission] - 佣金（委託探索用）
 */

/**
 * 探索結果
 * @typedef {Object} ExplorationResult
 * @property {boolean} success - 探索是否成功
 * @property {string} completedAt - 完成時間戳記
 * @property {Object} resourcesObtained - 總獲得資源
 * @property {number} contractFulfillment - 合約履行數量
 * @property {number} surplus - 超額數量
 * @property {Array} participants - 參與者狀況
 * @property {Array} relationshipChanges - 關係影響
 * @property {string} type - 探索類型
 * @property {string} requestId - 請求ID
 */

/**
 * 探索系統管理器
 * 提供探索執行的統一管理
 * @class
 * @extends BaseManager
 */
export class ExplorationManager extends BaseManager {
  /**
   * 建構探索管理器
   * @param {Object} gameState - 遊戲狀態管理器
   * @param {Object} resourceManager - 資源管理器實例
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} dataManager - 資料管理器實例
   */
  constructor(gameState, resourceManager, eventBus, dataManager) {
    super(gameState, eventBus, "ExplorationManager");

    /** @type {Object} 資源管理器 */
    this.resourceManager = resourceManager;

    /** @type {Object} 資料管理器 */
    this.dataManager = dataManager;

    /** @type {Object|null} 探索系統配置 */
    this.config = null;

    /** @type {Array<ExplorationResult>} 探索歷史記錄（限制最近100筆） */
    this.explorationHistory = [];

    /** @type {Object} 探索統計 */
    this.stats = {
      totalExplorations: 0,
      successfulExplorations: 0,
      commissionExplorations: 0,
      autonomousExplorations: 0,
      totalResourcesObtained: {},
      totalParticipants: 0,
      injuryCount: 0
    };

    this.logSuccess('ExplorationManager 已建立');
  }

  // ==========================================
  // BaseManager 抽象方法實作
  // ==========================================

  /**
   * 取得模組事件前綴
   * @returns {string} 事件前綴
   */
  getModulePrefix() {
    return "exploration";
  }

  /**
   * 設置事件監聽器
   * @returns {void}
   */
  setupEventListeners() {
    // 監聽新一天開始，清理系統資源
    this.onEvent("day_advanced", () => {
      this.cleanup();
    }, { skipPrefix: true });

    // 監聽資源不足警告，可能觸發探索建議
    this.onEvent("resource_threshold_warning", (eventObj) => {
      const { resourceType, level } = eventObj.data;
      if (level === 'critical') {
        this.addLog(`資源警告：${resourceType} 嚴重不足，建議安排探索`);
      }
    }, { skipPrefix: true });
  }

  /**
   * 取得擴展狀態資訊
   * @returns {Object} 擴展狀態物件
   */
  getExtendedStatus() {
    const successRate = this.stats.totalExplorations > 0 ?
      this.stats.successfulExplorations / this.stats.totalExplorations : 0;

    const injuryRate = this.stats.totalParticipants > 0 ?
      this.stats.injuryCount / this.stats.totalParticipants : 0;

    return {
      configLoaded: !!this.config,
      totalExplorations: this.stats.totalExplorations,
      successRate: Math.round(successRate * 100) / 100,
      injuryRate: Math.round(injuryRate * 100) / 100,
      historySize: this.explorationHistory.length,
      averageParticipants: this.stats.totalExplorations > 0 ?
        Math.round(this.stats.totalParticipants / this.stats.totalExplorations * 100) / 100 : 0,
      recentSuccessRate: this._calculateRecentSuccessRate()
    };
  }

  // ==========================================
  // 系統初始化
  // ==========================================

  /**
   * 初始化探索管理器
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      this.addLog('開始初始化探索管理器...');

      // 載入探索系統配置
      await this._loadExplorationConfig();

      // 設置事件監聽器
      this.setupEventListeners();

      // 標記初始化完成
      this.markInitialized(true);

      this.logSuccess('ExplorationManager 初始化完成');
      return true;

    } catch (error) {
      this.logError('探索管理器初始化失敗', error);
      this.markInitialized(false);
      return false;
    }
  }

  /**
   * 載入探索系統配置
   * @returns {Promise<void>}
   * @private
   */
  async _loadExplorationConfig() {
    try {
      this.config = this.dataManager.getRuleValue('gameBalance.explorationSystem');

      if (!this.config) {
        throw new Error('explorationSystem 配置未找到');
      }

      this.addLog('探索系統配置載入完成');

    } catch (error) {
      this.logError('探索配置載入失敗', error);

      // 使用預設配置
      this.config = {
        exploration: { baseSuccessRate: 0.6, injuryProbability: 0.1 },
        rewards: {
          resourceRanges: {
            food: { min: 3, max: 12 },
            materials: { min: 1, max: 5 },
            medical: { min: 1, max: 3 },
            fuel: { min: 2, max: 6 }
          },
          bonusChance: 0.2,
          teamBonusMultiplier: 1.3
        },
        teamwork: { skillSynergyBonus: 0.15 }
      };

      this.logWarning('使用預設探索配置');
    }
  }

  // ==========================================
  // 主要探索執行介面
  // ==========================================

  /**
   * 執行探索（統一入口點）
   * @param {ExplorationRequest} request - 探索請求
   * @returns {Promise<ExplorationResult>} 探索結果
   */
  async executeExploration(request) {
    if (!this.isInitialized()) {
      throw new Error('ExplorationManager 未初始化');
    }

    try {
      this.addLog(`開始執行 ${request.type} 探索: ${request.requestId}`);

      // 發送探索開始事件（使用模組前綴）
      this.emitEvent("started", {
        type: request.type,
        requestId: request.requestId,
        participants: request.participants.map(p => p.id),
        resourceType: request.resourceType,
        targetAmount: request.targetAmount
      });

      // 計算成功率
      const successRate = this._calculateExplorationSuccessRate(request);
      const success = Math.random() < successRate;

      this.addLog(`探索成功率: ${Math.round(successRate * 100)}%, 結果: ${success ? '成功' : '失敗'}`);

      // 生成探索結果
      const result = this._generateExplorationResult(request, success);

      // 處理資源分配
      if (success) {
        await this._distributeExplorationRewards(request, result);
      }

      // 處理參與者狀態變更
      this._updateParticipantStatus(result);

      // 更新統計
      this._updateExplorationStats(result);

      // 記錄歷史
      this._recordExplorationHistory(result);

      // 發送探索完成事件（使用模組前綴）
      this.emitEvent("completed", {
        type: request.type,
        requestId: request.requestId,
        result: result
      });

      this.logSuccess(`探索執行完成: ${request.requestId} (${success ? '成功' : '失敗'})`);

      return result;

    } catch (error) {
      this.logError(`探索執行失敗: ${request.requestId}`, error);

      // 發送探索失敗事件（使用模組前綴）
      this.emitEvent("failed", {
        type: request.type,
        requestId: request.requestId,
        error: error.message
      });

      throw error;
    }
  }

  // ==========================================
  // 探索邏輯核心方法
  // ==========================================

  /**
   * 計算探索成功率
   * @param {ExplorationRequest} request - 探索請求
   * @returns {number} 成功率 (0-1)
   * @private
   */
  _calculateExplorationSuccessRate(request) {
    let successRate = this.config.exploration.baseSuccessRate || 0.6;

    // 職業基礎加成
    request.participants.forEach(participant => {
      const typeBonus = {
        soldier: 0.15,
        worker: 0.1,
        farmer: 0.05,
        doctor: 0.0,
        elder: -0.1
      };
      successRate += typeBonus[participant.type] || 0;
    });

    // 組隊加成
    if (request.participants.length > 1) {
      successRate += this.config.teamwork?.skillSynergyBonus || 0.15;
    }

    // 優先級影響（自主探索）
    if (request.type === 'autonomous') {
      switch (request.priority) {
        case 'critical':
          successRate += 0.1; // 絕望時的求生本能
          break;
        case 'high':
          successRate += 0.05;
          break;
        case 'medium':
          successRate += 0.02;
          break;
      }
    }

    // 經驗加成（基於歷史成功率）
    const recentSuccessRate = this._calculateRecentSuccessRate();
    if (recentSuccessRate > 0.7) {
      successRate += 0.05; // 連續成功提升信心
    } else if (recentSuccessRate < 0.3) {
      successRate -= 0.05; // 連續失敗降低士氣
    }

    return Math.max(0.1, Math.min(0.9, successRate));
  }

  /**
   * 生成探索結果
   * @param {ExplorationRequest} request - 探索請求
   * @param {boolean} success - 是否成功
   * @returns {ExplorationResult} 探索結果
   * @private
   */
  _generateExplorationResult(request, success) {
    const result = {
      success,
      completedAt: new Date().toISOString(),
      resourcesObtained: {},
      contractFulfillment: 0,
      surplus: 0,
      participants: [],
      relationshipChanges: [],
      type: request.type,
      requestId: request.requestId
    };

    if (success) {
      // 計算獲得資源
      const resourceRange = this.config.rewards?.resourceRanges?.[request.resourceType];
      if (resourceRange) {
        const baseAmount = Math.floor(Math.random() * (resourceRange.max - resourceRange.min + 1)) + resourceRange.min;

        // 組隊加成
        const teamMultiplier = request.participants.length > 1 ?
          (this.config.rewards?.teamBonusMultiplier || 1.3) : 1;
        const finalAmount = Math.floor(baseAmount * teamMultiplier);

        result.resourcesObtained[request.resourceType] = finalAmount;
        result.contractFulfillment = Math.min(finalAmount, request.targetAmount);
        result.surplus = Math.max(0, finalAmount - request.targetAmount);

        // 額外獎勵機率
        if (Math.random() < (this.config.rewards?.bonusChance || 0.2)) {
          const bonusTypes = ['food', 'materials', 'medical', 'fuel'].filter(type => type !== request.resourceType);
          const bonusType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
          const bonusRange = this.config.rewards?.resourceRanges?.[bonusType];

          if (bonusRange) {
            const bonusAmount = Math.floor(Math.random() * (bonusRange.max - bonusRange.min + 1)) + bonusRange.min;
            result.resourcesObtained[bonusType] = bonusAmount;
          }
        }
      }
    }

    // 處理參與者狀況
    request.participants.forEach(participant => {
      const injured = Math.random() < (this.config.exploration?.injuryProbability || 0.1);
      result.participants.push({
        tenantId: participant.id,
        healthy: !injured
      });

      // 關係變化
      let relationshipChange;
      if (success) {
        relationshipChange = Math.floor(Math.random() * 5) + 3; // 成功: +3 to +7
      } else {
        relationshipChange = Math.floor(Math.random() * 3) - 1; // 失敗: -1 to +1
      }

      // 受傷額外影響
      if (injured) {
        relationshipChange -= 2; // 受傷降低滿意度
      }

      result.relationshipChanges.push({
        tenantId: participant.id,
        change: relationshipChange
      });
    });

    return result;
  }

  /**
   * 分配探索獎勵
   * @param {ExplorationRequest} request - 探索請求
   * @param {ExplorationResult} result - 探索結果
   * @returns {Promise<void>}
   * @private
   */
  async _distributeExplorationRewards(request, result) {
    try {
      // 房東獲得合約履行的資源
      if (result.contractFulfillment > 0) {
        this.resourceManager.modifyResource(
          request.resourceType,
          result.contractFulfillment,
          `探索收穫 (${request.type})`
        );

        this.addLog(`房東獲得 ${request.resourceType} x${result.contractFulfillment}`);
      }

      // 參與者平分超額資源
      if (result.surplus > 0) {
        const perPersonSurplus = Math.floor(result.surplus / request.participants.length);
        if (perPersonSurplus > 0) {
          // 通過事件通知其他管理器分配個人資源
          this.emitEvent("surplus_distribution", {
            participants: request.participants.map(p => p.id),
            resourceType: request.resourceType,
            amountPerPerson: perPersonSurplus,
            reason: `探索超額獎勵 (${request.type})`
          });
        }
      }

      // 額外獎勵資源給參與者
      for (const [resourceType, amount] of Object.entries(result.resourcesObtained)) {
        if (resourceType !== request.resourceType && amount > 0) {
          const perPersonBonus = Math.floor(amount / request.participants.length);
          if (perPersonBonus > 0) {
            this.emitEvent("bonus_distribution", {
              participants: request.participants.map(p => p.id),
              resourceType: resourceType,
              amountPerPerson: perPersonBonus,
              reason: `探索額外獎勵 (${request.type})`
            });
          }
        }
      }

      // 處理委託報酬（僅委託探索）
      if (request.type === 'commission') {
        await this._processCommissionPayments(request, result);
      }

    } catch (error) {
      this.logError('探索獎勵分配失敗', error);
      throw error;
    }
  }

  /**
   * 處理委託報酬支付
   * @param {ExplorationRequest} request - 探索請求
   * @param {ExplorationResult} result - 探索結果
   * @returns {Promise<void>}
   * @private
   */
  async _processCommissionPayments(request, result) {
    // 支付基礎報酬
    if (request.basePayment) {
      for (const [resourceType, amount] of Object.entries(request.basePayment)) {
        this.resourceManager.modifyResource(resourceType, -amount, '支付基礎報酬');
      }

      this.addLog('基礎報酬已支付');
    }

    // 支付佣金給參與者
    if (request.commission) {
      const perPersonCommission = {};

      for (const [resourceType, totalAmount] of Object.entries(request.commission)) {
        perPersonCommission[resourceType] = Math.floor(totalAmount / request.participants.length);
      }

      // 通過事件通知佣金分配
      this.emitEvent("commission_payment", {
        participants: request.participants.map(p => p.id),
        payments: perPersonCommission,
        reason: '委託佣金'
      });

      this.addLog('委託佣金已分配');
    }
  }

  /**
   * 更新參與者狀態
   * @param {ExplorationResult} result - 探索結果
   * @private
   */
  _updateParticipantStatus(result) {
    // 處理受傷狀態（通過事件通知）
    result.participants.forEach(participantResult => {
      if (!participantResult.healthy) {
        this.stats.injuryCount++;

        this.emitEvent("injury_occurred", {
          tenantId: participantResult.tenantId,
          explorationType: result.type,
          timestamp: result.completedAt
        });

        this.addLog(`租客 ${participantResult.tenantId} 在探索中受傷`);
      }
    });

    // 更新關係度（通過事件通知）
    result.relationshipChanges.forEach(change => {
      this.emitEvent("relationship_change", {
        tenantId: change.tenantId,
        change: change.change,
        reason: `探索結果影響 (${result.type})`,
        explorationType: result.type
      });
    });
  }

  // ==========================================
  // 統計和歷史管理
  // ==========================================

  /**
   * 更新探索統計
   * @param {ExplorationResult} result - 探索結果
   * @private
   */
  _updateExplorationStats(result) {
    this.stats.totalExplorations++;
    this.stats.totalParticipants += result.participants.length;

    if (result.success) {
      this.stats.successfulExplorations++;
    }

    if (result.type === 'commission') {
      this.stats.commissionExplorations++;
    } else if (result.type === 'autonomous') {
      this.stats.autonomousExplorations++;
    }

    // 累計獲得資源
    for (const [resourceType, amount] of Object.entries(result.resourcesObtained)) {
      if (!this.stats.totalResourcesObtained[resourceType]) {
        this.stats.totalResourcesObtained[resourceType] = 0;
      }
      this.stats.totalResourcesObtained[resourceType] += amount;
    }
  }

  /**
   * 記錄探索歷史
   * @param {ExplorationResult} result - 探索結果
   * @private
   */
  _recordExplorationHistory(result) {
    this.explorationHistory.push(result);

    // 限制歷史記錄長度
    if (this.explorationHistory.length > 100) {
      this.explorationHistory.shift();
    }
  }

  /**
   * 計算最近成功率
   * @returns {number} 最近成功率
   * @private
   */
  _calculateRecentSuccessRate() {
    const recentHistory = this.explorationHistory.slice(-10); // 最近10次
    if (recentHistory.length === 0) return 0.5; // 預設值

    const successCount = recentHistory.filter(h => h.success).length;
    return successCount / recentHistory.length;
  }

  // ==========================================
  // 公開查詢 API
  // ==========================================

  /**
   * 取得探索統計
   * @returns {Object} 探索統計資料
   */
  getExplorationStats() {
    const successRate = this.stats.totalExplorations > 0 ?
      this.stats.successfulExplorations / this.stats.totalExplorations : 0;

    const injuryRate = this.stats.totalParticipants > 0 ?
      this.stats.injuryCount / this.stats.totalParticipants : 0;

    return {
      ...this.stats,
      successRate: Math.round(successRate * 100) / 100,
      injuryRate: Math.round(injuryRate * 100) / 100,
      averageParticipants: this.stats.totalExplorations > 0 ?
        this.stats.totalParticipants / this.stats.totalExplorations : 0,
      recentSuccessRate: this._calculateRecentSuccessRate()
    };
  }

  /**
   * 取得探索歷史
   * @param {number} [limit=20] - 限制數量
   * @returns {Array<ExplorationResult>} 探索歷史記錄
   */
  getExplorationHistory(limit = 20) {
    return this.explorationHistory.slice(-limit);
  }

  /**
   * 取得成功率趨勢
   * @param {number} [windowSize=10] - 視窗大小
   * @returns {Array<number>} 成功率趨勢
   */
  getSuccessRateTrend(windowSize = 10) {
    const trend = [];

    for (let i = windowSize; i <= this.explorationHistory.length; i++) {
      const window = this.explorationHistory.slice(i - windowSize, i);
      const successCount = window.filter(h => h.success).length;
      trend.push(successCount / windowSize);
    }

    return trend;
  }

  /**
   * 按類型統計探索
   * @returns {Object} 按類型的統計
   */
  getExplorationStatsByType() {
    const byType = {};

    this.explorationHistory.forEach(exploration => {
      const type = exploration.type;
      if (!byType[type]) {
        byType[type] = {
          total: 0,
          successful: 0,
          resourcesObtained: {},
          participants: 0,
          injuries: 0
        };
      }

      byType[type].total++;
      byType[type].participants += exploration.participants.length;

      if (exploration.success) {
        byType[type].successful++;

        for (const [resource, amount] of Object.entries(exploration.resourcesObtained)) {
          if (!byType[type].resourcesObtained[resource]) {
            byType[type].resourcesObtained[resource] = 0;
          }
          byType[type].resourcesObtained[resource] += amount;
        }
      }

      byType[type].injuries += exploration.participants.filter(p => !p.healthy).length;
    });

    // 計算成功率
    for (const stats of Object.values(byType)) {
      stats.successRate = stats.total > 0 ? stats.successful / stats.total : 0;
      stats.injuryRate = stats.participants > 0 ? stats.injuries / stats.participants : 0;
    }

    return byType;
  }

  // ==========================================
  // 系統維護（BaseManager 標準）
  // ==========================================

  /**
   * 清理系統資源
   */
  cleanup() {
    // 清理過舊的歷史記錄
    if (this.explorationHistory.length > 100) {
      this.explorationHistory = this.explorationHistory.slice(-50);
    }

    this.addLog('探索管理器資源清理完成');
  }

  /**
   * 重置統計資料
   */
  resetStats() {
    this.stats = {
      totalExplorations: 0,
      successfulExplorations: 0,
      commissionExplorations: 0,
      autonomousExplorations: 0,
      totalResourcesObtained: {},
      totalParticipants: 0,
      injuryCount: 0
    };

    this.explorationHistory = [];

    this.logSuccess('探索統計已重置');
  }

  /**
   * 除錯資訊輸出
   * @returns {void}
   */
  debugInfo() {
    if (!this.isDebugMode()) return;

    console.group('🔍 ExplorationManager 除錯資訊');
    console.log('📊 探索統計:', this.getExplorationStats());
    console.log('📈 成功率趨勢:', this.getSuccessRateTrend(5));
    console.log('📋 按類型統計:', this.getExplorationStatsByType());
    console.log('⚙️ 系統狀態:', this.getExtendedStatus());
    console.groupEnd();
  }
}

export default ExplorationManager;
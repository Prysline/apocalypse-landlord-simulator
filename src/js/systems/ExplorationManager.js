// @ts-check

/**
 * @fileoverview ExplorationManager.js - 探索系統管理器
 * 職責：提供探索執行的統一管理，包含執行、統計、事件協調
 */

import systemLogger from "../utils/SystemLogger.js";
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
 * @property {Object} [refundedPayment] - 未完成委託時的退還資源 (key為資源類型,value為退還數量)
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

    /** @type {Map<string, Object>} 進行中的探索 */
    this.ongoingExplorations = new Map();

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

    // 監聽每日開始事件，檢查探索完成
    this.onEvent('day_start', async (eventObj) => {
      try {
        this.addLog(`📡 ExplorationManager 收到 day_start 事件 (第 ${eventObj.data?.day || '?'} 天)`);
        const completedExplorations = await this.checkAndCompleteExplorations();
        if (completedExplorations.length > 0) {
          this.addLog(`日間檢查：完成了 ${completedExplorations.length} 個探索任務`);
        }
      } catch (error) {
        this.logError('日間探索檢查失敗', error);
      }
    });
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
      systemLogger.info('開始初始化探索管理器...');

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

      systemLogger.success('探索系統配置載入完成');

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
  // 探索天數計算
  // ==========================================

  /**
   * 計算探索所需天數
   * @param {ExplorationRequest} request - 探索請求
   * @returns {number} 所需天數
   */
  calculateExplorationDays(request) {
    const baseTargetAmount = request.targetAmount || 1;

    // 基礎天數計算：根據目標數量
    let baseDays = 1; // 最少1天（隔天返回）

    // 根據資源類型和數量計算天數
    const resourceMultipliers = {
      food: 0.2,     // 食物相對容易找到
      materials: 0.4, // 建材需要更多時間
      medical: 0.6,  // 醫療用品稀少
      fuel: 0.3      // 燃料中等難度
    };

    const multiplier = resourceMultipliers[request.resourceType] || 0.3;
    baseDays += Math.floor(baseTargetAmount * multiplier);

    // 考慮參與者數量（更多人可以稍微減少時間）
    const participantCount = request.participants?.length || 1;
    if (participantCount > 1) {
      baseDays = Math.max(1, Math.floor(baseDays * 0.8)); // 組隊減少20%時間
    }

    // 最大限制
    const maxDays = 7; // 最多7天
    return Math.min(baseDays, maxDays);
  }

  // ==========================================
  // 主要探索執行介面
  // ==========================================

  /**
   * 執行探索（統一入口點）
   * @param {ExplorationRequest} request - 探索請求
   * @returns {Promise<Object>} 探索啟動結果（非最終結果）
   */
  async executeExploration(request) {
    if (!this.isInitialized()) {
      throw new Error('ExplorationManager 未初始化');
    }

    try {
      // 計算探索所需天數
      const explorationDays = this.calculateExplorationDays(request);
      const currentDay = this.gameState.getStateValue('day', 1);
      // 修改：當天出發，explorationDays天後完成
      const completionDay = currentDay + explorationDays - 1;

      this.addLog(`開始執行 ${request.type} 探索: ${request.requestId}，預計 ${explorationDays} 天後完成`);

      // 預先計算成功率和結果（但不立即執行）
      const successRate = this._calculateExplorationSuccessRate(request);
      const success = Math.random() < successRate;

      // 保存進行中的探索
      const ongoingExploration = {
        request: { ...request },
        startDay: currentDay,
        completionDay: completionDay,
        explorationDays: explorationDays,
        successRate: successRate,
        predeterminedSuccess: success,
        status: 'ongoing',
        dailyResults: [], // 每日探索結果
        accumulatedRewards: {}, // 累積獎勵
        totalInjuries: 0, // 總受傷次數
        earlyReturn: false, // 是否提早返回
        currentDay: 0, // 目前探索進行的天數
        participantStatus: request.participants.map(p => ({
          id: p.id,
          name: p.name,
          healthy: true,
          totalInjuries: 0
        }))
      };

      this.ongoingExplorations.set(request.requestId, ongoingExploration);

      // 發送探索開始事件（使用模組前綴）
      this.emitEvent("started", {
        type: request.type,
        requestId: request.requestId,
        participants: request.participants.map(p => p.id),
        resourceType: request.resourceType,
        targetAmount: request.targetAmount,
        explorationDays: explorationDays,
        expectedCompletionDay: completionDay
      });

      this.logSuccess(`探索已啟動: ${request.requestId}，第 ${completionDay} 天完成`);

      // 返回啟動結果，而非最終探索結果
      return {
        success: true,
        requestId: request.requestId,
        explorationDays: explorationDays,
        expectedCompletionDay: completionDay,
        message: `探索隊伍已出發，預計 ${explorationDays} 天後返回`
      };

    } catch (error) {
      this.logError(`探索啟動失敗: ${request.requestId}`, error);

      // 發送探索失敗事件（使用模組前綴）
      this.emitEvent("failed", {
        type: request.type,
        requestId: request.requestId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * 檢查並完成到期的探索（每日調用）
   * @returns {Promise<Array>} 完成的探索結果列表
   */
  async checkAndCompleteExplorations() {
    const currentDay = this.gameState.getStateValue('day', 1);
    const completedExplorations = [];

    // Debug: 記錄檢查狀態
    if (this.ongoingExplorations.size > 0) {
      this.addLog(`🔍 第 ${currentDay} 天探索檢查: 有 ${this.ongoingExplorations.size} 個進行中的探索`);
    }

    for (const [requestId, ongoingExploration] of this.ongoingExplorations.entries()) {
      try {
        // Debug: 記錄每個探索的狀態
        systemLogger.debug(`探索 ${requestId}: 完成日=${ongoingExploration.completionDay}, 當前日=${currentDay}`);

        // 執行每日探索檢查
        await this._performDailyExplorationCheck(ongoingExploration, currentDay);

        // 檢查是否應該完成探索（到期或提早返回）
        if (currentDay >= ongoingExploration.completionDay || ongoingExploration.earlyReturn) {
          this.addLog(`✅ 完成探索 ${requestId}: 預期第 ${ongoingExploration.completionDay} 天，實際第 ${currentDay} 天`);

          // 完成這個探索
          const result = await this._completeExploration(ongoingExploration);
          completedExplorations.push(result);

          // 從進行中列表移除
          this.ongoingExplorations.delete(requestId);
        } else {
          systemLogger.debug(`探索 ${requestId} 尚未到期，還需 ${ongoingExploration.completionDay - currentDay} 天`);
        }

      } catch (error) {
        this.logError(`探索檢查失敗: ${requestId}`, error);
        this.ongoingExplorations.delete(requestId); // 移除錯誤的探索
      }
    }

    if (completedExplorations.length > 0) {
      this.addLog(`🎉 第 ${currentDay} 天完成了 ${completedExplorations.length} 個探索任務`);
    }

    return completedExplorations;
  }

  /**
   * 執行每日探索檢查
   * @param {Object} ongoingExploration - 進行中的探索物件
   * @param {number} currentDay - 當前遊戲天數
   * @returns {Promise<void>}
   * @private
   */
  async _performDailyExplorationCheck(ongoingExploration, currentDay) {
    // 計算目前探索進行的天數
    const daysElapsed = currentDay - ongoingExploration.startDay;

    // 如果還沒開始或已經檢查過今天，跳過
    if (daysElapsed <= 0 || daysElapsed <= ongoingExploration.currentDay) {
      return;
    }

    // 更新當前天數
    ongoingExploration.currentDay = daysElapsed;

    // 只有在預定成功的探索才進行每日檢查
    if (!ongoingExploration.predeterminedSuccess) {
      return;
    }

    // 改為除錯日誌，不顯示在遊戲日誌中
    systemLogger.debug(`執行每日探索檢查: ${ongoingExploration.request.requestId} (第 ${daysElapsed} 天)`);

    // 執行每日獎勵檢查
    const dailyReward = this._calculateDailyReward(ongoingExploration, daysElapsed);
    if (dailyReward && Object.keys(dailyReward).length > 0) {
      // 累積到總獎勵中
      for (const [resourceType, amount] of Object.entries(dailyReward)) {
        if (!ongoingExploration.accumulatedRewards[resourceType]) {
          ongoingExploration.accumulatedRewards[resourceType] = 0;
        }
        ongoingExploration.accumulatedRewards[resourceType] += amount;
      }

      // 記錄每日結果（包含日誌訊息）
      const rewardText = Object.entries(dailyReward)
        .map(([type, amount]) => `${type} x${amount}`)
        .join(', ');
      
      ongoingExploration.dailyResults.push({
        day: daysElapsed,
        rewards: { ...dailyReward },
        date: new Date().toISOString(),
        logMessage: `第 ${daysElapsed} 天發現: ${rewardText}` // 暫存日誌訊息
      });

      // 不再直接顯示每日發現日誌，改為暫存
      systemLogger.debug(`探索 ${ongoingExploration.request.requestId} 第 ${daysElapsed} 天發現: ${rewardText}`);
    }

    // 執行每日受傷檢查
    const injuryCheck = this._performDailyInjuryCheck(ongoingExploration);
    if (injuryCheck.hasInjury) {
      ongoingExploration.totalInjuries++;

      // 檢查是否嚴重到需要提早返回
      if (injuryCheck.severeInjury || ongoingExploration.totalInjuries >= 2) {
        ongoingExploration.earlyReturn = true;
        ongoingExploration.status = 'early_return';
        this.addLog(`探索隊伍因受傷提早返回: ${ongoingExploration.request.requestId}`);
      }
    }
  }

  /**
   * 計算每日獎勵
   * @param {Object} ongoingExploration - 進行中的探索物件
   * @param {number} dayNumber - 探索天數
   * @returns {Object} 每日獎勵
   * @private
   */
  _calculateDailyReward(ongoingExploration, dayNumber) {
    const request = ongoingExploration.request;
    const dailyReward = {};

    // 每日有機會找到目標資源
    const targetResourceChance = 0.3 + (dayNumber - 1) * 0.1; // 隨天數增加機率
    if (Math.random() < targetResourceChance) {
      const resourceRange = this.config.rewards?.resourceRanges?.[request.resourceType];
      if (resourceRange) {
        // 每日獲得量比較少
        const dailyAmount = Math.floor(Math.random() * Math.ceil(resourceRange.max / 3)) + 1;
        dailyReward[request.resourceType] = dailyAmount;
      }
    }

    // 每日有機會找到隨機獎勵（包含金錢）
    const bonusChance = 0.15 + (dayNumber - 1) * 0.05; // 隨天數增加機率
    if (Math.random() < bonusChance) {
      const bonusTypes = ['food', 'materials', 'medical', 'fuel', 'cash'];
      const availableTypes = bonusTypes.filter(type => type !== request.resourceType);
      const bonusType = availableTypes[Math.floor(Math.random() * availableTypes.length)];

      let bonusAmount;
      if (bonusType === 'cash') {
        // 金錢獎勵：基於天數的少量金錢
        bonusAmount = Math.floor(Math.random() * (dayNumber * 4)) + dayNumber;
      } else {
        const bonusRange = this.config.rewards?.resourceRanges?.[bonusType];
        if (bonusRange) {
          bonusAmount = Math.floor(Math.random() * Math.ceil(bonusRange.max / 4)) + 1;
        }
      }

      if (bonusAmount && bonusAmount > 0) {
        dailyReward[bonusType] = bonusAmount;
      }
    }

    return dailyReward;
  }

  /**
   * 執行每日受傷檢查
   * @param {Object} ongoingExploration - 進行中的探索物件
   * @returns {Object} 受傷檢查結果
   * @private
   */
  _performDailyInjuryCheck(ongoingExploration) {
    const baseInjuryRate = this.config.exploration?.injuryProbability || 0.1;
    // 每日受傷率較低，因為會累積
    const dailyInjuryRate = baseInjuryRate / ongoingExploration.explorationDays;

    let hasInjury = false;
    let severeInjury = false;

    // 檢查每個參與者
    ongoingExploration.participantStatus.forEach(participant => {
      if (participant.healthy && Math.random() < dailyInjuryRate) {
        hasInjury = true;
        participant.healthy = false;
        participant.totalInjuries++;

        // 檢查是否為嚴重受傷（需要立即返回）
        if (Math.random() < 0.3) { // 30% 機率為嚴重受傷
          severeInjury = true;
        }

        // 發送受傷事件
        this.emitEvent('participant_injured', {
          tenantId: participant.id,
          tenantName: participant.name || '未知',
          explorationType: ongoingExploration.request.type,
          day: ongoingExploration.currentDay,
          severity: severeInjury ? 'severe' : 'minor'
        });

        this.addLog(`${participant.name || participant.id} 在探索第 ${ongoingExploration.currentDay} 天受傷`);
      }
    });

    return { hasInjury, severeInjury };
  }

  /**
   * 完成單個探索
   * @param {Object} ongoingExploration - 進行中的探索
   * @returns {Promise<ExplorationResult>} 探索結果
   * @private
   */
  async _completeExploration(ongoingExploration) {
    const { request, predeterminedSuccess } = ongoingExploration;

    // 生成探索結果（使用累積的結果）
    const actualDays = ongoingExploration.currentDay || ongoingExploration.explorationDays;
    const earlyReturnText = ongoingExploration.earlyReturn ? ' (提早返回)' : '';
    
    // 收集所有每日日誌訊息
    const dailyLogs = ongoingExploration.dailyResults?.map(result => result.logMessage).filter(Boolean) || [];
    
    // 顯示探索完成總結（包含每日記錄）
    this.addLog(`完成探索: ${request.requestId} (${predeterminedSuccess ? '成功' : '失敗'})`);
    this.addLog(`探索詳情: 實際天數 ${actualDays}/${ongoingExploration.explorationDays}${earlyReturnText}`);
    
    // 如果有每日記錄，顯示總結
    if (dailyLogs.length > 0) {
      this.addLog(`探索過程收穫:`);
      dailyLogs.forEach(log => this.addLog(`  ${log}`));
    }

    const result = this._generateExplorationResult(request, predeterminedSuccess, ongoingExploration);

    // 處理資源分配
    if (predeterminedSuccess) {
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

    // 觸發結算模態框顯示
    this.emitEvent("show_result_modal", {
      commission: request,  // 原始委託資訊
      explorationResult: result  // 探索結果
    });

    this.logSuccess(`探索完成: ${request.requestId} (${predeterminedSuccess ? '成功' : '失敗'})`);

    return result;
  }

  /**
   * 獲取進行中的探索列表
   * @returns {Array} 進行中的探索
   */
  getOngoingExplorations() {
    return Array.from(this.ongoingExplorations.values());
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
   * @param {Object} ongoingExploration - 進行中的探索物件（包含累積結果）
   * @returns {ExplorationResult} 探索結果
   * @private
   */
  _generateExplorationResult(request, success, ongoingExploration) {
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
      // 使用累積的每日獎勵作為最終結果
      result.resourcesObtained = { ...ongoingExploration.accumulatedRewards };

      // 計算合約履行度
      const targetResourceAmount = result.resourcesObtained[request.resourceType] || 0;
      result.contractFulfillment = Math.min(targetResourceAmount, request.targetAmount);
      result.surplus = Math.max(0, targetResourceAmount - request.targetAmount);

      // 如果累積獎勵不足目標數量，補充一些基礎獎勵
      if (result.contractFulfillment < request.targetAmount) {
        const shortage = request.targetAmount - result.contractFulfillment;
        const resourceRange = this.config.rewards?.resourceRanges?.[request.resourceType];

        if (resourceRange) {
          // 補充不足的部分（但不會100%補足，保持一些隨機性）
          const additionalAmount = Math.floor(shortage * (0.5 + Math.random() * 0.4)); // 50-90%補足
          if (additionalAmount > 0) {
            if (!result.resourcesObtained[request.resourceType]) {
              result.resourcesObtained[request.resourceType] = 0;
            }
            result.resourcesObtained[request.resourceType] += additionalAmount;
            result.contractFulfillment = Math.min(result.resourcesObtained[request.resourceType], request.targetAmount);
            result.surplus = Math.max(0, result.resourcesObtained[request.resourceType] - request.targetAmount);
          }
        }
      }
    }

    // 處理參與者狀況（使用累積的狀況）
    ongoingExploration.participantStatus.forEach(participantStatus => {
      const isInjured = !participantStatus.healthy || participantStatus.totalInjuries > 0;
      result.participants.push({
        tenantId: participantStatus.id,
        healthy: participantStatus.healthy,
        injured: isInjured
      });

      // 如果受傷，確保設置人物的受傷狀態（可能在每日檢查中已設置）
      if (isInjured) {
        this.emitEvent('participant_injured', {
          tenantId: participantStatus.id,
          tenantName: participantStatus.name || '未知',
          explorationType: request.type,
          totalInjuries: participantStatus.totalInjuries
        });
      }

      // 關係變化
      let relationshipChange;
      if (success) {
        relationshipChange = Math.floor(Math.random() * 5) + 3; // 成功: +3 to +7
      } else {
        relationshipChange = Math.floor(Math.random() * 3) - 1; // 失敗: -1 to +1
      }

      // 受傷額外影響
      if (isInjured) {
        relationshipChange -= participantStatus.totalInjuries; // 受傷次數影響關係
      }

      // 提早返回額外影響
      if (ongoingExploration.earlyReturn) {
        relationshipChange -= 1; // 提早返回略微降低滿意度
      }

      result.relationshipChanges.push({
        tenantId: participantStatus.id,
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
      // 分配主要資源（根據探索類型不同處理）
      if (result.contractFulfillment > 0) {
        if (request.type === 'commission') {
          // 委託探索：房東獲得主要資源
          this.resourceManager.modifyResource(
            request.resourceType,
            result.contractFulfillment,
            `委託探索收穫`
          );
          this.addLog(`房東獲得 ${request.resourceType} x${result.contractFulfillment}`);
        } else if (request.type === 'autonomous') {
          // 自主探索：參與者平分主要資源
          const perPersonMain = Math.floor(result.contractFulfillment / request.participants.length);
          if (perPersonMain > 0) {
            this.emitEvent("autonomous_main_distribution", {
              participants: request.participants.map(p => p.id),
              resourceType: request.resourceType,
              amountPerPerson: perPersonMain,
              reason: '自主探索主要收穫'
            });
            this.addLog(`參與者各自獲得 ${request.resourceType} x${perPersonMain}`);
          }
        }
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
    // 計算完成度和退還比例
    const fulfillmentRate = result.contractFulfillment / Math.max(request.targetAmount, 1);
    const refundRate = Math.max(0, 1 - fulfillmentRate); // 未完成部分比例

    // 支付基礎報酬（按完成度計算）
    if (request.basePayment) {
      let refundedResources = {};
      const perPersonBasePayment = {};

      for (const [resourceType, fullAmount] of Object.entries(request.basePayment)) {
        if (fullAmount > 0) {
          // 按完成度計算應支付金額
          const payableAmount = Math.floor(fullAmount * fulfillmentRate);
          const refundAmount = fullAmount - payableAmount;

          // 從房東資源中扣除應付金額
          if (payableAmount > 0) {
            this.resourceManager.modifyResource(resourceType, -payableAmount, '支付委託基礎報酬');

            // 計算每人分配的基礎報酬
            perPersonBasePayment[resourceType] = Math.floor(payableAmount / request.participants.length);
          }

          // 記錄退還金額
          if (refundAmount > 0) {
            refundedResources[resourceType] = refundAmount;
          }
        }
      }

      // 分配基礎報酬給參與者
      if (Object.keys(perPersonBasePayment).length > 0) {
        this.emitEvent("base_payment_distribution", {
          participants: request.participants.map(p => p.id),
          payments: perPersonBasePayment,
          reason: '委託基礎報酬'
        });
      }

      // 記錄支付和退還資訊
      if (fulfillmentRate < 1) {
        const refundText = Object.entries(refundedResources)
          .filter(([_, amount]) => amount > 0)
          .map(([resource, amount]) => `${resource} x${amount}`)
          .join(', ');

        this.addLog(`基礎報酬已按完成度(${Math.round(fulfillmentRate * 100)}%)支付並分配給參與者，退還: ${refundText}`);

        // 將退還資訊加入結果中
        result.refundedPayment = refundedResources;
      } else {
        this.addLog('基礎報酬已全額支付並分配給參與者');
      }
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
      }, { skipPrefix: true });
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

    systemLogger.info('探索管理器資源清理完成');
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
   * Debug: 檢查探索系統狀態和事件監聽
   * @returns {Object} 系統狀態報告
   */
  debugExplorationSystem() {
    const currentDay = this.gameState.getStateValue('day', 1);
    const report = {
      initialized: this.isInitialized(),
      currentDay: currentDay,
      ongoingExplorationsCount: this.ongoingExplorations.size,
      eventListenersActive: !!this.eventBus,
      ongoingExplorations: []
    };

    // 詳細列出進行中的探索
    for (const [requestId, exploration] of this.ongoingExplorations.entries()) {
      report.ongoingExplorations.push({
        requestId: requestId,
        type: exploration.type,
        startDay: exploration.startDay,
        completionDay: exploration.completionDay,
        daysRemaining: exploration.completionDay - currentDay,
        shouldComplete: currentDay >= exploration.completionDay,
        participants: exploration.participants?.map(p => p.name || p.id) || []
      });
    }

    systemLogger.debug(`探索系統狀態報告: ${JSON.stringify(report, null, 2)}`);
    return report;
  }

  /**
   * 手動觸發探索完成檢查（用於除錯）
   * @returns {Promise<Array>} 完成的探索列表
   */
  async manualCheckExplorations() {
    systemLogger.debug('手動觸發探索完成檢查');
    const completed = await this.checkAndCompleteExplorations();
    systemLogger.debug(`手動檢查結果: 完成了 ${completed.length} 個探索`);
    return completed;
  }

  /**
   * 除錯資訊輸出
   * @returns {void}
   */
  debugInfo() {
    if (!this.isDebugMode()) return;

    systemLogger.withGroup('🔍 ExplorationManager 除錯資訊', () => {
      systemLogger.debug('📊 探索統計:', this.getExplorationStats());
      systemLogger.debug('📈 成功率趨勢:', this.getSuccessRateTrend(5));
      systemLogger.debug('📋 按類型統計:', this.getExplorationStatsByType());
      systemLogger.debug('⚙️ 系統狀態:', this.getExtendedStatus());
    });
  }
}

export default ExplorationManager;
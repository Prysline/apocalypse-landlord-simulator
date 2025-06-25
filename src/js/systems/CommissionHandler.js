// @ts-check

/**
 * @fileoverview CommissionHandler.js - 委託探索處理器
 * 職責：處理委託邀約、接受機率計算，探索執行委託給 ExplorationEngine
 * 架構：TradeManager 內部組件，配置驅動設計
 */

import systemLogger from "../utils/SystemLogger.js";
import ExplorationManager from "./ExplorationManager.js";

/**
 * 委託邀約物件
 * @typedef {Object} CommissionOffer
 * @property {string} id - 邀約唯一ID
 * @property {string} tenantId - 目標租客ID
 * @property {string} resourceType - 需要的資源類型
 * @property {number} targetAmount - 目標獲取數量
 * @property {Object} basePayment - 基礎報酬
 * @property {Object} commission - 佣金
 * @property {string|null} partnerId - 組隊夥伴ID
 * @property {string} status - 委託狀態
 * @property {string} [decidedAt] - 決策時間
 * @property {number} [explorationDays] - 探索所需天數
 * @property {number} [expectedCompletionDay] - 預計完成日期
 */

/**
 * 委託接受評估結果
 * @typedef {Object} AcceptanceEvaluation
 * @property {number} probability - 接受機率
 * @property {string} refusalReason - 拒絕原因
 * @property {Object} marketEvaluation - 市場價格評估結果
 * @property {number} marketEvaluation.factor - 市場價格影響因子
 * @property {string} marketEvaluation.evaluation - 價格評估等級 (generous/fair_plus/fair/underpaid/exploitative)
 * @property {number} marketEvaluation.fairnessRatio - 價格合理性比率
 * @property {number} marketEvaluation.targetValue - 目標資源市場價值
 * @property {number} marketEvaluation.rewardValue - 總報酬價值
 */

/**
 * 委託處理器 - TradeManager 內部組件
 * @class
 */
export class CommissionHandler {
  /**
   * 建構委託處理器
   * @param {Object} tenantManager - 租客管理器實例
   * @param {Object} eventBus - 事件總線實例
   * @param {Object} config - 探索系統配置
   * @param {ExplorationManager} explorationManager - 探索系統管理器
   */
  constructor(tenantManager, eventBus, config, explorationManager) {
    /** @type {Object} 租客管理器（僅查詢用） */
    this.tenantManager = tenantManager;

    /** @type {Object} 事件總線 */
    this.eventBus = eventBus;

    /** @type {Object} 探索系統配置 */
    this.config = config;

    /** @type {ExplorationManager} 探索系統管理器 */
    this.explorationManager = explorationManager;

    /** @type {Map<string, CommissionOffer>} 活躍委託記錄 */
    this.activeCommissions = new Map();

    /** @type {Array<Object>} 委託歷史記錄（限制最近50筆） */
    this.commissionHistory = [];

    /** @type {number} 委託ID計數器 */
    this.nextCommissionId = 1;

    // 監聽探索完成事件來更新委託狀態
    this._setupExplorationEventListeners();
  }

  // ==========================================
  // 主要委託處理流程
  // ==========================================

  /**
   * 處理委託邀約（主要入口點）
   * @param {Object} request - 委託請求
   * @param {string} request.tenantId - 目標租客ID
   * @param {string} request.resourceType - 需要資源類型
   * @param {number} request.targetAmount - 目標數量
   * @param {Object} request.basePayment - 基礎報酬
   * @param {Object} request.commission - 佣金
   * @returns {Promise<Object>} 處理結果
   */
  async processCommissionOffer(request) {
    try {
      // 1. 建立委託邀約
      const offer = this._createCommissionOffer(request);

      // 2. 檢查租客可用性
      const availability = this._checkTenantAvailability(offer.tenantId);
      if (!availability.available) {
        return { success: false, reason: availability.reason };
      }

      // 3. 評估組隊可能性
      const partner = this._evaluateTeamFormation(offer.tenantId);
      if (partner) {
        offer.partnerId = partner.id;
      }

      // 4. 計算接受機率
      const acceptance = this._calculateAcceptanceProbability(offer);

      // 5. 執行一次性決策
      const decision = Math.random() < acceptance.probability;

      if (decision) {
        offer.status = 'accepted';
        offer.decidedAt = new Date().toISOString();

        // 記錄活躍委託
        this.activeCommissions.set(offer.id, offer);

        // 6. 委託探索執行給 ExplorationEngine（現在是啟動而非完成）
        const explorationResult = await this._delegateExplorationToEngine(offer);

        // 更新委託狀態為進行中
        offer.status = 'ongoing';
        offer.explorationDays = explorationResult.explorationDays;
        offer.expectedCompletionDay = explorationResult.expectedCompletionDay;

        return { 
          success: true, 
          offer, 
          explorationDays: explorationResult.explorationDays,
          expectedCompletionDay: explorationResult.expectedCompletionDay,
          message: explorationResult.message
        };
      } else {
        offer.status = 'rejected';
        offer.decidedAt = new Date().toISOString();

        // 記錄拒絕的委託
        this._recordCommissionHistory(offer, null);

        return {
          success: false,
          reason: acceptance.refusalReason,
          offer
        };
      }
    } catch (error) {
      systemLogger.error('委託處理失敗:', error);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // 探索執行委託（新方法）
  // ==========================================

  /**
   * 委託探索執行給 ExplorationEngine
   * @param {CommissionOffer} offer - 委託邀約
   * @returns {Promise<Object>} 探索結果
   * @private
   */
  async _delegateExplorationToEngine(offer) {
    try {
      // 收集參與者資訊
      const participants = this._gatherParticipants(offer);

      // 構建探索請求
      const explorationRequest = {
        type: 'commission',
        requestId: offer.id,
        resourceType: offer.resourceType,
        targetAmount: offer.targetAmount,
        participants: participants,
        priority: 'medium', // 委託探索預設為中等優先級
        basePayment: offer.basePayment,
        commission: offer.commission
      };

      // 委託給探索管理器執行
      const result = await this.explorationManager.executeExploration(explorationRequest);

      return result;

    } catch (error) {
      systemLogger.error('委託探索執行失敗:', error);
      throw error;
    }
  }

  /**
   * 設置探索事件監聽器
   * @private
   */
  _setupExplorationEventListeners() {
    // 監聽探索完成事件，更新委託狀態
    this.eventBus.on('exploration_completed', (eventObj) => {
      const { type, requestId, result } = eventObj.data;

      if (type === 'commission' && this.activeCommissions.has(requestId)) {
        const offer = this.activeCommissions.get(requestId);
        offer.status = 'completed';

        // 移除活躍委託
        this.activeCommissions.delete(requestId);

        // 記錄歷史
        this._recordCommissionHistory(offer, result);
      }
    }, { skipPrefix: true });

    // 監聽探索失敗事件
    this.eventBus.on('exploration_failed', (eventObj) => {
      const { type, requestId, error } = eventObj.data;

      if (type === 'commission' && this.activeCommissions.has(requestId)) {
        const offer = this.activeCommissions.get(requestId);
        offer.status = 'failed';

        // 移除活躍委託
        this.activeCommissions.delete(requestId);

        // 記錄歷史
        this._recordCommissionHistory(offer, null);
      }
    }, { skipPrefix: true });
  }

  // ==========================================
  // 核心邏輯方法（保持不變）
  // ==========================================

  /**
   * 計算委託接受機率
   * @param {CommissionOffer} offer - 委託邀約
   * @returns {AcceptanceEvaluation} 接受評估結果
   * @private
   */
  _calculateAcceptanceProbability(offer) {
    const tenant = this.tenantManager.getTenant(offer.tenantId);
    const config = this.config.acceptance;

    // 基礎接受率
    let probability = config.baseRate;

    // 資源急迫性影響
    const resourceUrgency = this._assessResourceUrgency(tenant);
    probability += resourceUrgency * config.resourceUrgencyWeight;

    // 佣金吸引力影響
    const commissionValue = this._calculateCommissionValue(offer.commission);
    const commissionFactor = Math.min(commissionValue / 20, 1); // 20為基準值
    probability += commissionFactor * config.commissionWeight;

    // **新增：價格行情評估影響**
    const marketEvaluation = this._evaluateMarketFairness(offer);
    let marketWeight = config.marketFairnessWeight || 0.25;
    
    // 極端情況下增強影響
    if (marketEvaluation.evaluation === 'generous') {
      marketWeight *= 2.0; // 報酬豐厚時大幅提升接受率
    } else if (marketEvaluation.evaluation === 'exploitative') {
      marketWeight *= 2.5; // 報酬過低時大幅降低接受率
    } else if (marketEvaluation.evaluation === 'insulting') {
      marketWeight *= 3.0; // 侮辱性報酬時極大降低接受率
    }
    
    probability += marketEvaluation.factor * marketWeight;

    // 關係度影響
    const relationship = this.tenantManager.getTenantSatisfaction(tenant.name) / 100;
    probability += relationship * config.relationshipWeight;

    // 職業風險容忍度調整
    const riskTolerance = this.config.riskTolerance[tenant.type] || 0.5;
    probability *= riskTolerance;

    // 組隊加成
    if (offer.partnerId) {
      probability += this.config.teamwork.teamworkBonus;
    }

    // 限制在合理範圍內，但對極度不合理的委託設置更嚴格的下限
    let minProbability = 0.05;
    if (marketEvaluation.evaluation === 'insulting') {
      minProbability = 0.01; // 侮辱性報酬時最多只有1%接受率
    } else if (marketEvaluation.evaluation === 'exploitative') {
      minProbability = 0.02; // 剝削性報酬時最多只有2%接受率
    }
    
    probability = Math.max(minProbability, Math.min(0.95, probability));

    return {
      probability,
      refusalReason: this._generateRefusalReason(probability, resourceUrgency, relationship, marketEvaluation),
      marketEvaluation
    };
  }

  /**
   * 評估組隊可能性
   * @param {string} primaryTenantId - 主要租客ID
   * @returns {Object|null} 組隊夥伴或null
   * @private
   */
  _evaluateTeamFormation(primaryTenantId) {
    const availableTenants = this.tenantManager.getAvailableTenants()
      .filter(t => t.id !== primaryTenantId);

    const primaryTenant = this.tenantManager.getTenant(primaryTenantId);
    const relationshipThreshold = this.config.teamwork.relationshipThreshold;

    // 尋找關係度符合條件的夥伴
    for (const candidate of availableTenants) {
      const relationship = this.tenantManager.getRelationshipValue(
        primaryTenant.name,
        candidate.name
      );

      if (relationship >= relationshipThreshold) {
        return candidate;
      }
    }

    return null; // 無合適夥伴
  }

  // ==========================================
  // 輔助計算方法（保持不變）
  // ==========================================

  /**
   * 評估租客資源急迫性
   * @param {Object} tenant - 租客物件
   * @returns {number} 急迫性指數 (0-1)
   * @private
   */
  _assessResourceUrgency(tenant) {
    const resources = tenant.personalResources || {};
    let urgency = 0;

    // 食物急迫性
    if (resources.food <= 2) urgency += 0.4;
    else if (resources.food <= 5) urgency += 0.2;

    // 現金急迫性
    if (resources.cash <= 10) urgency += 0.3;
    else if (resources.cash <= 20) urgency += 0.1;

    // 其他資源急迫性
    if ((resources.medical || 0) <= 1) urgency += 0.2;
    if ((resources.fuel || 0) <= 2) urgency += 0.1;

    return Math.min(urgency, 1);
  }

  /**
   * 計算佣金價值
   * @param {Object} commission - 佣金物件
   * @returns {number} 總價值
   * @private
   */
  _calculateCommissionValue(commission) {
    let totalValue = 0;
    const resourceValues = { food: 1.5, materials: 3, medical: 4, fuel: 3, cash: 1 };

    for (const [resource, amount] of Object.entries(commission)) {
      totalValue += amount * (resourceValues[resource] || 1);
    }

    return totalValue;
  }

  /**
   * 評估委託的市場價格合理性
   * @param {CommissionOffer} offer - 委託邀約
   * @returns {Object} 市場評估結果
   * @private
   */
  _evaluateMarketFairness(offer) {
    // 獲取市場基準價格
    const baseResourceValues = this.config.economy?.resourceTrade?.baseResourceValues || {
      food: 2, materials: 2, medical: 5, fuel: 3, cash: 1
    };

    // 計算目標資源的市場價值
    const targetResourceValue = offer.targetAmount * (baseResourceValues[offer.resourceType] || 1);

    // 計算基礎報酬價值（不包含佣金）
    let baseRewardValue = 0;

    // 基礎報酬價值
    for (const [resource, amount] of Object.entries(offer.basePayment)) {
      baseRewardValue += amount * (baseResourceValues[resource] || 1);
    }

    // 計算佣金價值（用於接受機率計算，但不用於市場評估）
    let commissionValue = 0;
    for (const [resource, amount] of Object.entries(offer.commission)) {
      commissionValue += amount * (baseResourceValues[resource] || 1);
    }

    // 市場評估只看基礎報酬，但總報酬價值包含佣金（用於返回資訊）
    const totalRewardValue = baseRewardValue + commissionValue;

    // 計算價格合理性比率（基於基礎報酬）
    const fairnessRatio = baseRewardValue / Math.max(targetResourceValue, 1);

    let factor = 0;
    let evaluation = '';

    // 新增：最低合理性門檻檢查
    const minFairnessThreshold = 0.3; // 報酬至少要達到目標資源價值的30%
    if (fairnessRatio < minFairnessThreshold) {
      factor = -0.8; // 極度不合理，幾乎必定拒絕
      evaluation = 'insulting';
    } else if (fairnessRatio >= 1.5) {
      factor = 0.3;  // 報酬豐厚，大幅提升接受率
      evaluation = 'generous';
    } else if (fairnessRatio >= 1.2) {
      factor = 0.15; // 報酬合理偏高，提升接受率
      evaluation = 'fair_plus';
    } else if (fairnessRatio >= 0.8) {
      factor = 0;    // 報酬合理，不影響接受率
      evaluation = 'fair';
    } else if (fairnessRatio >= 0.5) {
      factor = -0.2; // 報酬偏低，明顯降低接受率
      evaluation = 'underpaid';
    } else {
      factor = -0.4; // 報酬過低，大幅降低接受率
      evaluation = 'exploitative';
    }

    return {
      factor,
      evaluation,
      fairnessRatio,
      targetValue: targetResourceValue,
      rewardValue: baseRewardValue,  // 只返回基礎報酬價值
      commissionValue: commissionValue,  // 額外提供佣金價值資訊
      totalRewardValue: totalRewardValue  // 總報酬價值（供其他用途）
    };
  }

  // ==========================================
  // 私有輔助方法
  // ==========================================

  /**
   * 建立委託邀約
   * @param {Object} request - 委託請求
   * @returns {CommissionOffer} 委託邀約物件
   * @private
   */
  _createCommissionOffer(request) {
    return {
      id: `commission_${this.nextCommissionId++}`,
      tenantId: request.tenantId,
      resourceType: request.resourceType,
      targetAmount: request.targetAmount,
      basePayment: { ...request.basePayment },
      commission: { ...request.commission },
      partnerId: null,
      status: 'offered'
    };
  }

  /**
   * 檢查租客可用性
   * @param {string} tenantId - 租客ID
   * @returns {Object} 可用性檢查結果
   * @private
   */
  _checkTenantAvailability(tenantId) {
    const tenant = this.tenantManager.getTenant(tenantId);
    if (!tenant) {
      return { available: false, reason: '租客不存在' };
    }

    // 檢查是否受傷
    if (tenant.injured) {
      return { available: false, reason: '租客受傷中，無法執行探索任務' };
    }

    // 檢查是否已有活躍委託
    for (const commission of this.activeCommissions.values()) {
      if (commission.tenantId === tenantId || commission.partnerId === tenantId) {
        return { available: false, reason: '租客正在執行其他委託' };
      }
    }

    return { available: true };
  }

  /**
   * 收集參與者
   * @param {CommissionOffer} offer - 委託邀約
   * @returns {Array} 參與者列表
   * @private
   */
  _gatherParticipants(offer) {
    const participants = [];

    const primaryTenant = this.tenantManager.getTenant(offer.tenantId);
    if (primaryTenant) {
      participants.push({
        id: primaryTenant.id,
        name: primaryTenant.name,
        type: primaryTenant.type,
        personalResources: primaryTenant.personalResources || {}
      });
    }

    if (offer.partnerId) {
      const partner = this.tenantManager.getTenant(offer.partnerId);
      if (partner) {
        participants.push({
          id: partner.id,
          name: partner.name,
          type: partner.type,
          personalResources: partner.personalResources || {}
        });
      }
    }

    return participants;
  }

  /**
   * 生成接受/拒絕考量因素描述
   * @param {number} probability - 接受機率
   * @param {number} resourceUrgency - 資源急迫性
   * @param {number} relationship - 關係度
   * @param {Object} marketEvaluation - 市場評估結果
   * @returns {string} 考量因素描述
   * @private
   */
  _generateRefusalReason(probability, resourceUrgency, relationship, marketEvaluation) {
    // 高接受機率時提供積極反饋
    if (probability >= 0.8) {
      if (marketEvaluation && marketEvaluation.evaluation === 'generous') {
        return '報酬豐厚，非常樂意接受！';
      } else if (resourceUrgency > 0.6) {
        return '急需資源，很願意出探索';
      } else if (relationship > 0.7) {
        return '信任房東，樂意協助';
      } else {
        return '條件合理，願意接受委託';
      }
    }
    
    // 中等接受機率時分析主要因素
    if (probability >= 0.6) {
      if (marketEvaluation && marketEvaluation.evaluation === 'fair_plus') {
        return '報酬不錯，考慮接受';
      } else if (resourceUrgency > 0.4) {
        return '有些資源需求，可以考慮';
      } else {
        return '條件還可以，會認真考慮';
      }
    }
    
    // 低接受機率時說明拒絕原因 - 優先考慮市場評估
    if (marketEvaluation && marketEvaluation.evaluation === 'exploitative') {
      return '這個報酬太低了，根本不符合市場行情';
    } else if (marketEvaluation && marketEvaluation.evaluation === 'underpaid') {
      return '報酬有點低，不太划算';
    } else if (marketEvaluation && marketEvaluation.evaluation === 'generous') {
      // 如果報酬豐厚但機率仍低，說明其他因素影響較大
      if (relationship < 0.3) {
        return '雖然報酬豐厚，但對房東信任不足';
      } else if (probability < 0.2) {
        return '報酬雖好，但風險太高不敢參與';
      } else {
        return '報酬很好，但現在不太想出門';
      }
    } else if (probability < 0.2) {
      return '風險太高，不願參與';
    } else if (probability < 0.4) {
      return '報酬不夠吸引人';
    } else if (relationship < 0.3) {
      return '對房東信任不足';
    } else {
      return '暫時沒有探索的心情';
    }
  }

  /**
   * 記錄委託歷史
   * @param {CommissionOffer} offer - 委託邀約
   * @param {Object|null} result - 探索結果
   * @private
   */
  _recordCommissionHistory(offer, result) {
    this.commissionHistory.push({
      offer: { ...offer },
      result: result,
      recordedAt: new Date().toISOString()
    });

    // 限制歷史記錄長度
    if (this.commissionHistory.length > 50) {
      this.commissionHistory.shift();
    }
  }

  // ==========================================
  // 公開查詢方法
  // ==========================================

  /**
   * 取得活躍委託列表
   * @returns {Array<CommissionOffer>} 活躍委託
   */
  getActiveCommissions() {
    return Array.from(this.activeCommissions.values());
  }

  /**
   * 取得委託歷史
   * @returns {Array<Object>} 委託歷史記錄
   */
  getCommissionHistory() {
    return [...this.commissionHistory];
  }

  /**
   * 取得統計資訊
   * @returns {Object} 統計資料
   */
  getStats() {
    const total = this.commissionHistory.length;
    const successful = this.commissionHistory.filter(h =>
      h.result && h.result.success
    ).length;

    return {
      activeCommissions: this.activeCommissions.size,
      totalCommissions: total,
      successfulCommissions: successful,
      successRate: total > 0 ? successful / total : 0,
      rejectedCommissions: this.commissionHistory.filter(h =>
        h.offer.status === 'rejected'
      ).length
    };
  }

  /**
   * 清理系統資源
   */
  cleanup() {
    // 清理過舊的歷史記錄
    if (this.commissionHistory.length > 50) {
      this.commissionHistory = this.commissionHistory.slice(-30);
    }
  }
}

export default CommissionHandler;
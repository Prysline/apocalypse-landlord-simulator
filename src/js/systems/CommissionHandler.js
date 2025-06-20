// @ts-check

/**
 * @fileoverview CommissionHandler.js - 委託探索處理器
 * 職責：處理委託邀約、接受機率計算，探索執行委託給 ExplorationEngine
 * 架構：TradeManager 內部組件，配置驅動設計
 */

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
 */

/**
 * 委託接受評估結果
 * @typedef {Object} AcceptanceEvaluation
 * @property {number} probability - 接受機率
 * @property {string} refusalReason - 拒絕原因
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

        // 6. 委託探索執行給 ExplorationEngine
        const result = await this._delegateExplorationToEngine(offer);

        return { success: true, offer, result };
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
      console.error('委託處理失敗:', error);
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
      console.error('委託探索執行失敗:', error);
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

    // 限制在合理範圍內
    probability = Math.max(0.05, Math.min(0.95, probability));

    return {
      probability,
      refusalReason: this._generateRefusalReason(probability, resourceUrgency, relationship)
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
   * 生成拒絕原因
   * @param {number} probability - 接受機率
   * @param {number} resourceUrgency - 資源急迫性
   * @param {number} relationship - 關係度
   * @returns {string} 拒絕原因
   * @private
   */
  _generateRefusalReason(probability, resourceUrgency, relationship) {
    if (probability < 0.2) {
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
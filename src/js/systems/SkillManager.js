/**
 * 簡化版技能管理系統
 * 基於確認的15個技能配置和12種標準效果類型
 * 重構原則：高內聚，單一職責，保持與現有架構的相容性
 */

import BaseManager from './BaseManager.js';

/**
 * 技能類型枚舉
 * @typedef {'active'|'passive'|'special'} SkillType
 */

/**
 * 資源類型枚舉
 * @typedef {'food'|'materials'|'medical'|'fuel'|'cash'} ResourceType
 */

/**
 * 租客類型枚舉
 * @typedef {'doctor'|'worker'|'farmer'|'soldier'|'elder'} TenantType
 */

/**
 * 技能效果配置
 * @typedef {Object} SkillEffect
 * @property {'heal_tenant'|'reveal_visitor_infection'|'modify_resource'|'repair_room'|'reinforce_room'|'modify_building_defense'|'schedule_harvest'|'temporary_defense_boost'|'modify_success_rate'|'improve_relationships'|'improve_satisfaction'|'collect_thanks_fee'|'collect_tips'|'modify_conflict_chance'|'log_message'} type - 效果類型
 * @property {ResourceType} [resource] - 資源類型
 * @property {number|string} [amount] - 數量（可以是固定值或範圍字串如"2-4"）
 * @property {boolean} [random] - 是否為隨機數量
 * @property {string} [target] - 目標對象
 * @property {number} [delay] - 延遲天數
 * @property {number} [duration] - 持續時間
 * @property {string} [message] - 日誌訊息
 * @property {'event'|'rent'|'danger'|'skill'} [logType] - 日誌類型
 * @property {number} [baseAmount] - 基礎金額
 * @property {number} [maxAmount] - 最大金額
 * @property {number} [chance] - 機率值(0-1)
 */

/**
 * 技能成本配置
 * @typedef {Object} SkillCost
 * @property {number} [food] - 食物成本
 * @property {number} [materials] - 建材成本
 * @property {number} [medical] - 醫療用品成本
 * @property {number} [fuel] - 燃料成本
 * @property {number} [cash] - 現金成本
 */

/**
 * 技能需求條件
 * @typedef {Object} SkillRequirements
 * @property {Array} [conditions] - 條件列表
 */

/**
 * 技能配置物件
 * @typedef {Object} SkillConfig
 * @property {string} id - 技能ID
 * @property {string} name - 技能名稱
 * @property {SkillType} type - 技能類型
 * @property {string} description - 技能描述
 * @property {SkillCost} [cost] - 技能成本
 * @property {SkillEffect[]} [effects] - 技能效果
 * @property {number} [cooldown] - 冷卻天數
 * @property {number} [maxUses] - 最大使用次數
 * @property {SkillRequirements} [requirements] - 使用需求
 * @property {string} [trigger] - 被動技能觸發條件
 */

/**
 * 技能執行上下文
 * @typedef {Object} SkillExecutionContext
 * @property {Object} tenant - 執行技能的租客
 * @property {SkillConfig} skill - 技能配置
 * @property {Object} gameState - 遊戲狀態物件
 * @property {Object} [options] - 執行選項
 * @property {string} [trigger] - 觸發條件
 * @property {boolean} [passive] - 是否為被動技能
 * @property {number} timestamp - 時間戳記
 * @property {string} executionId - 執行ID
 */

/**
 * 技能執行結果
 * @typedef {Object} SkillExecutionResult
 * @property {boolean} success - 是否執行成功
 * @property {string} [skillId] - 技能ID
 * @property {Array} [effects] - 執行的效果
 * @property {string} [error] - 錯誤訊息
 * @property {number} [cooldownSet] - 設置的冷卻時間
 * @property {boolean} [passive] - 是否為被動技能
 */

/**
 * 簡化版技能管理器
 * 採用高內聚設計，所有技能相關邏輯集中在單一類別中
 * @class
 * @extends {BaseManager}
 */
export default class SkillManager extends BaseManager {
  /**
   * 建立 SkillManager 實例
   * @param {Object} gameState - 遊戲狀態管理器
   * @param {Object} eventBus - 事件總線
   * @param {Object} dataManager - 資料管理器實例
   */
  constructor(gameState, eventBus, dataManager) {
    super(gameState, eventBus, "SkillManager");

    /** @type {Object} 資料管理器實例 */
    this.dataManager = dataManager;

    /** @type {Map<TenantType, SkillConfig[]>} 技能註冊表 (tenantType -> skills) */
    this.skillRegistry = new Map();

    /** @type {Map<string, number>} 冷卻時間映射表 (tenantId_skillId -> expireDay) */
    this.cooldowns = new Map();

    /** @type {Array} 執行歷史記錄 */
    this.executionHistory = [];

    /** @type {Object} 統計資訊 */
    this.stats = {
      totalExecuted: 0,
      successful: 0,
      failed: 0,
      passiveTriggered: 0
    };

    /** @type {boolean} 初始化狀態 */
    this.initialized = false;

    this.addLog('簡化版 SkillManager 已建立');
  }

  // ==========================================
  // BaseManager 抽象方法實作
  // ==========================================

  /**
   * 取得模組事件前綴
   * @returns {string} 事件前綴
   */
  getModulePrefix() {
    return "skill";
  }

  /**
   * 設置事件監聽器
   * @returns {void}
   */
  setupEventListeners() {
    // 監聽每日推進事件
    this.onEvent('day_advanced', () => {
      this.processPassiveSkills('daily_cycle');
      this._advanceCooldowns();
    }, { skipPrefix: true });

    // 監聽採集完成事件
    this.onEvent('harvest_completed', (eventObj) => {
      this.processPassiveSkills('harvest', eventObj.data);
    }, { skipPrefix: true });

    // 監聽租客相關事件
    this.onEvent('tenant_tenantHired', (eventObj) => {
      this.processPassiveSkills('tenantHired', eventObj.data);
    });

    this.logSuccess('事件監聽器設置完成');
  }

  /**
   * 取得擴展狀態資訊
   * @returns {Object} 擴展狀態物件
   */
  getExtendedStatus() {
    return {
      initialized: this.initialized,
      skillRegistrySize: this.skillRegistry.size,
      activeCooldowns: this.cooldowns.size,
      stats: { ...this.stats },
      executionHistorySize: this.executionHistory.length
    };
  }

  // ==========================================
  // 公開API方法
  // ==========================================

  /**
   * 初始化技能系統
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      this.addLog('開始初始化技能系統...');

      // 載入技能配置
      await this._loadSkillConfigurations();

      // 設置事件監聽器
      this.setupEventListeners();

      // 標記為已初始化
      this.initialized = true;
      this.markInitialized(true);

      this.logSuccess('技能系統初始化完成');
      return true;
    } catch (error) {
      this.logError('技能系統初始化失敗', error);
      this.markInitialized(false);
      return false;
    }
  }

  /**
   * 執行技能（主要入口點）
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @param {Object} [options={}] - 執行選項
   * @returns {Promise<SkillExecutionResult>} 執行結果
   */
  async executeSkill(tenantId, skillId, options = {}) {
    const startTime = Date.now();

    try {
      // 1. 準備執行上下文
      const context = this._prepareContext(tenantId, skillId, options);
      if (!context) {
        return { success: false, error: '準備執行上下文失敗' };
      }

      // 2. 驗證執行條件
      const validation = this._validateExecution(context);
      if (!validation.valid) {
        return { success: false, error: validation.message };
      }

      // 3. 執行技能內部邏輯
      const result = await this._executeSkillInternal(context);

      // 4. 後處理
      this._postProcess(context, result);

      this.stats.totalExecuted++;
      if (result.success) {
        this.stats.successful++;
      } else {
        this.stats.failed++;
      }

      return result;

    } catch (error) {
      this.logError(`技能執行異常: ${skillId}`, error);
      this.stats.failed++;
      return {
        success: false,
        error: `執行異常: ${error.message}`
      };
    }
  }

  /**
   * 獲取租客可用技能
   * @param {number} tenantId - 租客ID
   * @returns {Array<SkillConfig>} 可用技能列表
   */
  getAvailableSkillsForTenant(tenantId) {
    const tenant = this._findTenantById(tenantId);
    if (!tenant) return [];

    const tenantSkills = this.skillRegistry.get(tenant.type) || [];
    const currentDay = this.gameState.getStateValue('day', 1);

    return tenantSkills
      .filter(skill => {
        // 排除被動技能
        if (skill.type === 'passive') return false;

        // 排除不滿足 requirements 的技能（結構性條件）
        const meetsRequirements = this._checkRequirements(skill, tenant, {
          tenant,
          skill,
          gameState: this.gameState,
          timestamp: Date.now(), // 提供一個時間戳記
          executionId: `check-${Date.now()}` // 提供一個執行ID
        });
        if (!meetsRequirements) return false;

        // 排除已達使用上限的技能
        const maxUsesReached = skill.maxUses && this._getSkillUsageCount(tenantId, skill.id) >= skill.maxUses;
        if (maxUsesReached) return false;

        return true;
      })
      .map(skill => {
        const cooldownRemaining = this._getCooldownRemaining(tenantId, skill.id, currentDay);
        const canAfford = this._canAffordCost(skill.cost || {});

        // 計算技能整體可用性
        const isAvailable = cooldownRemaining === 0 && canAfford;

        return {
          ...skill,
          cooldownRemaining,
          canAfford,
          isAvailable,
          // 添加狀態描述，方便 UI 顯示
          statusDescription: this._getSkillStatusDescription({
            cooldownRemaining,
            canAfford,
            maxUses: skill.maxUses,
            currentUsage: this._getSkillUsageCount(tenantId, skill.id)
          })
        };
      });
  }

  /**
   * 獲取所有租客的可用技能（UI系統使用）
   * @returns {Array<SkillConfig>} 所有可用技能列表，包含租客資訊
   */
  getAvailableSkills() {
    const tenants = this.gameState.getAllTenants();
    const allSkills = [];

    for (const tenant of tenants) {
      if (tenant.infected) continue; // 跳過感染的租客

      const tenantSkills = this.getAvailableSkillsForTenant(tenant.id);

      // 為每個技能添加租客資訊
      tenantSkills.forEach(skill => {
        allSkills.push({
          ...skill,
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantType: tenant.type,
          tenantTypeName: tenant.typeName || tenant.type
        });
      });
    }

    return allSkills;
  }

  /**
 * 取得技能狀態描述
 * @private
 * @param {Object} status - 狀態物件
 * @returns {string} 狀態描述
 */
  _getSkillStatusDescription(status) {
    const { cooldownRemaining, canAfford, meetsRequirements, maxUses, currentUsage } = status;

    if (cooldownRemaining > 0) {
      return `冷卻中 (${cooldownRemaining} 天)`;
    }

    if (!canAfford) {
      return '資源不足';
    }

    return '可使用';
  }

  /**
   * 取得技能使用次數
   * @private
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @returns {number} 使用次數
   */
  _getSkillUsageCount(tenantId, skillId) {
    const usageKey = `${tenantId}_${skillId}_used`;
    return this.gameState.getStateValue(usageKey, 0);
  }

  /**
   * 處理被動技能
   * @param {string} trigger - 觸發條件
   * @param {Object} [context={}] - 觸發上下文
   * @returns {Promise<Array>} 觸發的被動技能結果
   */
  async processPassiveSkills(trigger, context = {}) {
    const results = [];
    const tenants = this.gameState.getAllTenants();

    for (const tenant of tenants) {
      if (tenant.infected) continue; // 跳過感染的租客

      const tenantSkills = this.skillRegistry.get(tenant.type) || [];

      for (const skill of tenantSkills) {
        if (skill.type === 'passive' && this._isPassiveTriggered(skill, trigger, context)) {
          try {
            const result = await this.executeSkill(tenant.id, skill.id, {
              passive: true,
              trigger,
              context
            });

            if (result.success) {
              results.push({
                tenantId: tenant.id,
                skillId: skill.id,
                result
              });
              this.stats.passiveTriggered++;
            }
          } catch (error) {
            this.logError(`被動技能執行錯誤: ${skill.id}`, error);
          }
        }
      }
    }

    return results;
  }

  /**
   * 取得統計資訊
   * @returns {Object} 統計資訊
   */
  getStats() {
    const successRate = this.stats.totalExecuted > 0
      ? (this.stats.successful / this.stats.totalExecuted * 100).toFixed(1) + '%'
      : '0%';

    return {
      ...this.stats,
      successRate
    };
  }

  // ==========================================
  // 內部執行方法
  // ==========================================

  /**
   * 準備執行上下文
   * @private
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @param {Object} options - 執行選項
   * @returns {SkillExecutionContext|null} 執行上下文
   */
  _prepareContext(tenantId, skillId, options) {
    const tenant = this._findTenantById(tenantId);
    if (!tenant) {
      this.logWarning(`找不到租客: ${tenantId}`);
      return null;
    }

    const skill = this._getSkillConfig(tenant.type, skillId);
    if (!skill) {
      this.logWarning(`找不到技能配置: ${skillId}`);
      return null;
    }

    return {
      tenant,
      skill,
      gameState: this.gameState,
      options,
      timestamp: Date.now(),
      executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  /**
   * 驗證執行條件
   * @private
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {Object} 驗證結果
   */
  _validateExecution(context) {
    const { tenant, skill, options } = context;
    const currentDay = this.gameState.getStateValue('day', 1);

    // 檢查租客狀態
    if (tenant.infected && skill.type !== 'passive') {
      return { valid: false, message: '感染的租客無法使用主動技能' };
    }

    // 檢查技能冷卻
    if (!options.passive && this._isOnCooldown(tenant.id, skill.id, currentDay)) {
      const remaining = this._getCooldownRemaining(tenant.id, skill.id, currentDay);
      return { valid: false, message: `技能冷卻中，還需 ${remaining} 天` };
    }

    // 檢查成本
    if (skill.cost && !this._canAffordCost(skill.cost)) {
      return { valid: false, message: '資源不足，無法使用技能' };
    }

    // 檢查需求條件
    if (skill.requirements && !this._checkRequirements(skill, tenant, context)) {
      return { valid: false, message: '技能使用條件不滿足' };
    }

    return { valid: true };
  }

  /**
   * 執行技能內部邏輯
   * @private
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {Promise<SkillExecutionResult>} 執行結果
   */
  async _executeSkillInternal(context) {
    const { tenant, skill, options } = context;
    const currentDay = this.gameState.getStateValue('day', 1);

    try {
      // 支付成本
      if (skill.cost && !options.passive) {
        this._payCost(skill.cost, tenant);
      }

      // 執行效果
      const effects = await this._executeEffects(skill.effects || [], context);

      // 設置冷卻時間
      let cooldownSet = 0;
      if (skill.cooldown && skill.cooldown > 0 && !options.passive) {
        this._setCooldown(tenant.id, skill.id, skill.cooldown, currentDay);
        cooldownSet = skill.cooldown;
      }

      // 發送事件
      const eventType = options.passive ? 'passiveSkillTriggered' : 'skillExecuted';
      this.emitEvent(eventType, {
        tenant,
        skill,
        effects,
        options
      });

      return {
        success: true,
        skillId: skill.id,
        effects,
        cooldownSet,
        passive: !!options.passive
      };

    } catch (error) {
      this.logError(`技能執行失敗: ${skill.id}`, error);
      return {
        success: false,
        skillId: skill.id,
        error: error.message
      };
    }
  }

  /**
   * 執行技能效果
   * @private
   * @param {Array<SkillEffect>} effects - 效果列表
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {Promise<Array>} 效果執行結果
   */
  async _executeEffects(effects, context) {
    const results = [];

    for (const effect of effects) {
      try {
        const result = await this._handleEffect(effect, context);
        results.push(result);
      } catch (error) {
        this.logError(`效果執行錯誤: ${effect.type}`, error);
        results.push({
          type: effect.type,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  // ==========================================
  // 12種標準效果處理器
  // ==========================================

  /**
   * 處理單個效果
   * @private
   * @param {SkillEffect} effect - 效果配置
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {Promise<Object>} 效果執行結果
   */
  async _handleEffect(effect, context) {
    switch (effect.type) {
      case 'modify_resource':
        return this._handleResourceModification(effect, context);

      case 'heal_tenant':
        return this._handleTenantHealing(effect, context);

      case 'reveal_visitor_infection':
        return this._handleInfectionReveal(effect, context);

      case 'repair_room':
        return this._handleRoomRepair(effect, context);

      case 'reinforce_room':
        return this._handleRoomReinforcement(effect, context);

      case 'modify_building_defense':
        return this._handleBuildingDefenseModification(effect, context);

      case 'schedule_harvest':
        return this._handleHarvestScheduling(effect, context);

      case 'temporary_defense_boost':
        return this._handleTemporaryDefenseBoost(effect, context);

      case 'improve_relationships':
        return this._handleRelationshipImprovement(effect, context);

      case 'improve_satisfaction':
        return this._handleSatisfactionImprovement(effect, context);

      case 'collect_thanks_fee':
        return this._handleThanksFeCollection(effect, context);

      case 'collect_tips':
        return this._handleTipsCollection(effect, context);

      case 'modify_conflict_chance':
        return this._handleConflictChanceModification(effect, context);

      case 'log_message':
        return this._handleLogMessage(effect, context);

      default:
        this.logWarning(`未知效果類型: ${effect.type}`);
        return { type: effect.type, success: false, error: '未知效果類型' };
    }
  }

  /**
   * 處理資源修改效果
   * @private
   */
  _handleResourceModification(effect, context) {
    const { resource, amount, random } = effect;
    let finalAmount = amount;

    // 處理隨機數量
    if (random && typeof amount === 'string' && amount.includes('-')) {
      const [min, max] = amount.split('-').map(Number);
      finalAmount = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    const oldValue = this.gameState.getStateValue(`resources.${resource}`, 0);
    const success = this.gameState.modifyResource(resource, finalAmount, `技能效果: ${context.skill.name}`);
    const newValue = this.gameState.getStateValue(`resources.${resource}`, 0);

    return {
      type: 'modify_resource',
      success,
      resource,
      amount: finalAmount,
      oldValue,
      newValue
    };
  }

  /**
   * 處理租客治療效果
   * @private
   */
  _handleTenantHealing(effect, context) {
    const tenants = this.gameState.getAllTenants();
    const infectedTenants = tenants.filter(t => t.infected);

    if (infectedTenants.length === 0) {
      return {
        type: 'heal_tenant',
        success: false,
        message: '沒有感染的租客需要治療'
      };
    }

    // 隨機選擇一個感染的租客進行治療
    const targetTenant = infectedTenants[Math.floor(Math.random() * infectedTenants.length)];
    targetTenant.infected = false;

    // 更新遊戲狀態
    this.gameState.setState('tenants', tenants);

    return {
      type: 'heal_tenant',
      success: true,
      healedTenant: targetTenant.name,
      tenantId: targetTenant.id
    };
  }

  /**
   * 處理感染揭露效果
   * @private
   */
  _handleInfectionReveal(effect, context) {
    const visitors = this.gameState.getStateValue('visitors', []);
    let revealedCount = 0;

    visitors.forEach(visitor => {
      if (visitor.infected && visitor.hiddenInfection) {
        visitor.hiddenInfection = false;
        revealedCount++;
      }
    });

    this.gameState.setState('visitors', visitors);

    const message = revealedCount > 0
      ? `發現 ${revealedCount} 名感染的訪客`
      : '所有訪客健康狀況良好';

    return {
      type: 'reveal_visitor_infection',
      success: true,
      revealedCount,
      message
    };
  }

  /**
   * 處理房間維修效果
   * @private
   */
  _handleRoomRepair(effect, context) {
    const rooms = this.gameState.getStateValue('rooms', []);
    const damagedRoom = rooms.find(room => room.needsRepair);

    if (!damagedRoom) {
      return {
        type: 'repair_room',
        success: false,
        message: '沒有需要維修的房間'
      };
    }

    damagedRoom.needsRepair = false;
    this.gameState.setState('rooms', rooms);

    return {
      type: 'repair_room',
      success: true,
      roomId: damagedRoom.id,
      message: `房間 ${damagedRoom.id} 維修完成`
    };
  }

  /**
   * 處理房間加固效果
   * @private
   */
  _handleRoomReinforcement(effect, context) {
    const rooms = this.gameState.getStateValue('rooms', []);
    let targetRoom = null;
    const targetRoomId = Number(context.options.roomId)

    // 檢查是否指定了房間ID
    if (context.options && targetRoomId) {
      targetRoom = rooms.find(room => room.id === targetRoomId);
      if (!targetRoom) {
        return {
          type: 'reinforce_room',
          success: false,
          message: `找不到指定房間: ${targetRoomId}`
        };
      }
    } else {
      // 否則，加固租客自己的房間
      targetRoom = rooms.find(room => room.tenantId === context.tenant.id);
      if (!targetRoom) {
        return {
          type: 'reinforce_room',
          success: false,
          message: '找不到租客房間'
        };
      }
    }

    if (targetRoom.reinforced) {
      return {
        type: 'reinforce_room',
        success: false,
        message: `房間 ${targetRoom.id} 已經加固過了`
      };
    }

    targetRoom.reinforced = true;
    targetRoom.rent = Math.floor(targetRoom.rent * 1.2); // 提升租金20%
    this.gameState.setState('rooms', rooms);

    return {
      type: 'reinforce_room',
      success: true,
      roomId: targetRoom.id,
      newRent: targetRoom.rent,
      message: `房間 ${targetRoom.id} 加固完成，租金提升至 $${targetRoom.rent}`
    };
  }

  /**
   * 處理建築防禦修改效果
   * @private
   */
  _handleBuildingDefenseModification(effect, context) {
    const currentDefense = this.gameState.getStateValue('buildingDefense', 0);
    const newDefense = currentDefense + effect.amount;

    this.gameState.setState('buildingDefense', Math.max(0, newDefense));

    return {
      type: 'modify_building_defense',
      success: true,
      amount: effect.amount,
      oldDefense: currentDefense,
      newDefense: Math.max(0, newDefense)
    };
  }

  /**
   * 處理收穫排程效果
   * @private
   */
  _handleHarvestScheduling(effect, context) {
    const currentDay = this.gameState.getStateValue('day', 1);
    const harvestDay = currentDay + effect.delay;

    const scheduledHarvests = this.gameState.getStateValue('scheduledHarvests', []);
    scheduledHarvests.push({
      day: harvestDay,
      amount: effect.amount,
      source: 'farmer_skill'
    });

    this.gameState.setState('scheduledHarvests', scheduledHarvests);

    return {
      type: 'schedule_harvest',
      success: true,
      harvestDay,
      amount: effect.amount,
      message: `排程在第 ${harvestDay} 天收穫 ${effect.amount} 食物`
    };
  }

  /**
   * 處理臨時防禦提升效果
   * @private
   */
  _handleTemporaryDefenseBoost(effect, context) {
    const currentDay = this.gameState.getStateValue('day', 1);
    const expireDay = currentDay + effect.duration;

    const tempBoosts = this.gameState.getStateValue('temporaryDefenseBoosts', []);
    tempBoosts.push({
      amount: effect.amount,
      expireDay,
      source: context.skill.id
    });

    this.gameState.setState('temporaryDefenseBoosts', tempBoosts);

    return {
      type: 'temporary_defense_boost',
      success: true,
      amount: effect.amount,
      duration: effect.duration,
      expireDay,
      message: `臨時防禦提升 ${effect.amount}，持續到第 ${expireDay} 天`
    };
  }

  /**
   * 處理關係改善效果
   * @private
   */
  _handleRelationshipImprovement(effect, context) {
    const relationships = this.gameState.getStateValue('tenantRelationships', []);
    const improvementCount = Math.min(effect.amount || 15, relationships.length);

    // 隨機改善一些租客關係
    for (let i = 0; i < improvementCount && i < relationships.length; i++) {
      const randomIndex = Math.floor(Math.random() * relationships.length);
      if (relationships[randomIndex]) {
        relationships[randomIndex].value = Math.min(100,
          (relationships[randomIndex].value || 50) + 15);
      }
    }

    this.gameState.setState('tenantRelationships', relationships);

    return {
      type: 'improve_relationships',
      success: true,
      improvementCount,
      amount: effect.amount || 15
    };
  }

  /**
   * 處理滿意度提升效果
   * @private
   */
  _handleSatisfactionImprovement(effect, context) {
    const tenants = this.gameState.getAllTenants();
    const improvementAmount = effect.amount || 15;
    let improvedCount = 0;

    if (effect.target === 'all_tenants') {
      // 提升所有租客滿意度
      tenants.forEach(tenant => {
        if (!tenant.infected) {
          tenant.satisfaction = Math.min(100, (tenant.satisfaction || 50) + improvementAmount);
          improvedCount++;
        }
      });
    } else {
      // 提升特定租客滿意度
      const targetTenant = tenants.find(t => t.id === context.tenant.id);
      if (targetTenant && !targetTenant.infected) {
        targetTenant.satisfaction = Math.min(100, (targetTenant.satisfaction || 50) + improvementAmount);
        improvedCount = 1;
      }
    }

    this.gameState.setState('tenants', tenants);

    return {
      type: 'improve_satisfaction',
      success: true,
      improvedCount,
      amount: improvementAmount,
      target: effect.target || 'single'
    };
  }

  /**
   * 處理感謝費收取效果
   * @private
   */
  _handleThanksFeCollection(effect, context) {
    const baseAmount = effect.baseAmount || 4;
    const maxAmount = effect.maxAmount || 8;
    const amount = Math.floor(Math.random() * (maxAmount - baseAmount + 1)) + baseAmount;

    const success = this.gameState.modifyResource('cash', amount, `感謝費: ${context.skill.name}`);

    return {
      type: 'collect_thanks_fee',
      success,
      amount,
      baseAmount,
      maxAmount
    };
  }

  /**
   * 處理小費收取效果
   * @private
   */
  _handleTipsCollection(effect, context) {
    const chance = effect.chance || 0.6;
    const shouldCollect = Math.random() < chance;

    if (!shouldCollect) {
      return {
        type: 'collect_tips',
        success: false,
        message: '這次沒有收到小費'
      };
    }

    const amount = Math.floor(Math.random() * 5) + 2; // 2-6 現金
    const success = this.gameState.modifyResource('cash', amount, `小費: ${context.skill.name}`);

    return {
      type: 'collect_tips',
      success,
      amount,
      chance
    };
  }

  /**
   * 處理衝突機率修改效果
   * @private
   */
  _handleConflictChanceModification(effect, context) {
    const currentChance = this.gameState.getStateValue('conflictChance', 0.2);
    const newChance = Math.max(0, Math.min(1, currentChance + effect.amount));

    this.gameState.setState('conflictChance', newChance);

    return {
      type: 'modify_conflict_chance',
      success: true,
      amount: effect.amount,
      oldChance: currentChance,
      newChance
    };
  }

  /**
   * 處理日誌訊息效果
   * @private
   */
  _handleLogMessage(effect, context) {
    const message = effect.message || `${context.skill.name} 效果觸發`;
    const logType = effect.logType || 'skill';

    // 根據日誌類型添加到相應的日誌系統
    this.gameState.addLog(message, logType);

    return {
      type: 'skill',
      success: true,
      message,
      logType
    };
  }

  // ==========================================
  // 輔助工具方法
  // ==========================================

  /**
   * 載入技能配置
   * @private
   * @returns {Promise<void>}
   */
  async _loadSkillConfigurations() {
    try {
      const skillsData = await this.dataManager.loadGameData('skills');

      if (!skillsData) {
        // 使用後備配置
        this._initializeFallbackSystem();
        this.logWarning('使用後備技能配置');
        return;
      }

      // 載入技能配置到註冊表
      for (const [tenantType, skills] of Object.entries(skillsData)) {
        /** @type {TenantType} */
        const typedTenantType = /** @type {TenantType} */ (tenantType);
        this.skillRegistry.set(typedTenantType, skills);
      }

      this.logSuccess(`成功載入 ${this.skillRegistry.size} 種租客的技能配置`);
    } catch (error) {
      this.logError('載入技能配置失敗', error);
      this._initializeFallbackSystem();
    }
  }

  /**
   * 初始化後備系統
   * @private
   */
  _initializeFallbackSystem() {
    // 基本的後備技能配置
    /** @type {Object.<TenantType, SkillConfig[]>} */
    const fallbackSkills = {
      doctor: [{
        id: 'heal_infection',
        name: '治療感染',
        /** @type {SkillType} */
        type: 'active',
        description: '治療一個感染的租客',
        cost: { medical: 3, cash: 12 },
        cooldown: 0,
        effects: [
          { type: 'heal_tenant', target: 'infected_random' },
          { type: 'log_message', message: '醫生成功治療了感染租客', logType: 'skill' }
        ]
      }],
      worker: [{
        id: 'efficient_repair',
        name: '專業維修',
        /** @type {SkillType} */
        type: 'active',
        description: '以更少建材維修房間',
        cost: { materials: 1, cash: 10 },
        cooldown: 0,
        effects: [
          { type: 'repair_room', target: 'damaged_random' },
          { type: 'log_message', message: '工人專業維修了房間', logType: 'skill' }
        ]
      }],
      farmer: [{
        id: 'wild_foraging',
        name: '野外採集',
        /** @type {SkillType} */
        type: 'active',
        description: '到野外尋找食物',
        cost: { cash: 6 },
        cooldown: 2,
        effects: [
          { type: 'modify_resource', resource: 'food', amount: '2-4', random: true },
          { type: 'log_message', message: '農夫野外採集獲得了食物', logType: 'skill' }
        ]
      }]
    };

    for (const [tenantType, skills] of Object.entries(fallbackSkills)) {
      /** @type {TenantType} */
      const typedTenantType = /** @type {TenantType} */ (tenantType);
      this.skillRegistry.set(typedTenantType, skills);
    }

    this.logWarning('後備技能系統已啟用');
  }

  /**
   * 根據ID尋找租客
   * @private
   * @param {number} tenantId - 租客ID
   * @returns {Object|null} 租客物件
   */
  _findTenantById(tenantId) {
    const tenants = this.gameState.getAllTenants();
    return tenants.find(tenant => tenant.id === tenantId) || null;
  }

  /**
   * 獲取技能配置
   * @private
   * @param {TenantType} tenantType - 租客類型
   * @param {string} skillId - 技能ID
   * @returns {SkillConfig|null} 技能配置
   */
  _getSkillConfig(tenantType, skillId) {
    const skills = this.skillRegistry.get(tenantType) || [];
    return skills.find(skill => skill.id === skillId) || null;
  }

  /**
   * 檢查是否負擔得起成本
   * @private
   * @param {SkillCost} cost - 技能成本
   * @returns {boolean} 是否負擔得起
   */
  _canAffordCost(cost) {
    return Object.keys(cost).every(resource => {
      return this.gameState.hasEnoughResource(resource, cost[resource]);
    });
  }

  /**
   * 支付成本
   * @private
   * @param {SkillCost} cost - 技能成本
   * @param {Object} tenant - 租客物件
   */
  _payCost(cost, tenant) {
    Object.keys(cost).forEach(resource => {
      const amount = cost[resource];
      this.gameState.modifyResource(resource, -amount, `技能支付: ${tenant.name}`);
    });
  }

  /**
   * 檢查需求條件
   * @private
   * @param {SkillConfig} skill - 技能配置
   * @param {Object} tenant - 租客物件
   * @param {SkillExecutionContext} context - 執行上下文
   * @returns {boolean} 是否滿足需求
   */
  _checkRequirements(skill, tenant, context) {
    if (!skill.requirements || !skill.requirements.conditions) {
      return true;
    }

    return skill.requirements.conditions.every(condition => {
      switch (condition.type) {
        case 'has_damaged_rooms':
          const rooms = this.gameState.getStateValue('rooms', []);
          return rooms.some(room => room.needsRepair);

        case 'has_unreinforced_rooms':
          const allRooms = this.gameState.getStateValue('rooms', []);
          return allRooms.some(room => !room.reinforced);

        case 'min_tenants':
          const tenants = this.gameState.getAllTenants();
          return tenants.length >= condition.count;

        default:
          this.logWarning(`未知需求條件類型: ${condition.type}`);
          return true;
      }
    });
  }

  /**
   * 檢查技能是否可用
   * @private
   * @param {SkillConfig} skill - 技能配置
   * @param {Object} tenant - 租客物件
   * @param {number} currentDay - 當前天數
   * @returns {boolean} 是否可用
   */
  _isSkillAvailable(skill, tenant, currentDay) {
    // 檢查冷卻時間
    if (this._isOnCooldown(tenant.id, skill.id, currentDay)) {
      return false;
    }

    // 檢查使用次數限制
    if (skill.maxUses) {
      const usageKey = `${tenant.id}_${skill.id}_used`;
      const currentUsage = this.gameState.getStateValue(usageKey, 0);
      if (currentUsage >= skill.maxUses) {
        return false;
      }
    }

    return true;
  }

  /**
   * 檢查技能是否在冷卻中
   * @private
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @param {number} currentDay - 當前天數
   * @returns {boolean} 是否在冷卻中
   */
  _isOnCooldown(tenantId, skillId, currentDay) {
    const key = `${tenantId}_${skillId}`;
    const expireDay = this.cooldowns.get(key);

    if (!expireDay) return false;

    if (currentDay >= expireDay) {
      this.cooldowns.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 獲取冷卻剩餘時間
   * @private
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @param {number} currentDay - 當前天數
   * @returns {number} 剩餘天數
   */
  _getCooldownRemaining(tenantId, skillId, currentDay) {
    const key = `${tenantId}_${skillId}`;
    const expireDay = this.cooldowns.get(key);

    if (!expireDay) return 0;
    return Math.max(0, expireDay - currentDay);
  }

  /**
   * 設置技能冷卻時間
   * @private
   * @param {number} tenantId - 租客ID
   * @param {string} skillId - 技能ID
   * @param {number} cooldownDays - 冷卻天數
   * @param {number} currentDay - 當前天數
   */
  _setCooldown(tenantId, skillId, cooldownDays, currentDay) {
    if (cooldownDays > 0) {
      const key = `${tenantId}_${skillId}`;
      const expireDay = currentDay + cooldownDays;
      this.cooldowns.set(key, expireDay);
    }
  }

  /**
   * 推進冷卻時間
   * @private
   */
  _advanceCooldowns() {
    const currentDay = this.gameState.getStateValue('day', 1);

    for (const [key, expireDay] of this.cooldowns.entries()) {
      if (currentDay >= expireDay) {
        this.cooldowns.delete(key);
      }
    }
  }

  /**
   * 檢查被動技能是否被觸發
   * @private
   * @param {SkillConfig} skill - 技能配置
   * @param {string} trigger - 觸發條件
   * @param {Object} context - 觸發上下文
   * @returns {boolean} 是否被觸發
   */
  _isPassiveTriggered(skill, trigger, context) {
    if (!skill.trigger) return false;

    switch (skill.trigger) {
      case 'daily':
        return trigger === 'daily_cycle';

      case 'harvest':
        return trigger === 'harvest';

      case 'tenantHired':
        return trigger === 'tenantHired';

      case 'combat_event':
        return trigger === 'combat_event';

      default:
        return skill.trigger === trigger;
    }
  }

  /**
   * 後處理
   * @private
   * @param {SkillExecutionContext} context - 執行上下文
   * @param {SkillExecutionResult} result - 執行結果
   */
  _postProcess(context, result) {
    // 記錄執行歷史
    this.executionHistory.push({
      executionId: context.executionId,
      tenantId: context.tenant.id,
      skillId: context.skill.id,
      timestamp: context.timestamp,
      day: this.gameState.getStateValue('day', 1),
      success: result.success,
      passive: !!context.options.passive,
      effects: result.effects || []
    });

    // 保持歷史記錄在合理範圍內
    if (this.executionHistory.length > 50) {
      this.executionHistory = this.executionHistory.slice(-50);
    }

    // 記錄日誌
    if (result.success) {
      this.addLog(`技能執行成功: ${context.skill.name} (${context.tenant.name})`);
    } else {
      this.addLog(`技能執行失敗: ${context.skill.name} (${context.tenant.name}) - ${result.error}`);
    }
  }
}
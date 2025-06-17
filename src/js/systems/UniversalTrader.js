// @ts-check

/**
 * @fileoverview UniversalTrader.js - 重組後的輕量交易系統
 * 職責：租客資源交易、自動互助系統、緊急交易處理
 * 架構改進：純函數設計、輕量快取、簡化狀態管理
 */

import BaseManager from "./BaseManager.js";

// ==========================================
// 類型定義
// ==========================================

/**
 * 交易選項（租客主動提供給房東的選項）
 * @typedef {Object} TradeOption
 * @property {string} id - 交易選項ID
 * @property {Object} character - 角色物件
 * @property {'buy'|'sell'|'emergency'} type - 交易類型
 * @property {string} item - 交易物品
 * @property {number} quantity - 數量
 * @property {number} price - 價格
 * @property {number} originalPrice - 原始價格
 * @property {number} relationship - 關係度
 * @property {'low'|'medium'|'high'|'critical'} urgency - 緊急程度
 * @property {string} description - 描述
 * @property {boolean} canAfford - 房東是否負擔得起
 */

/**
 * 交易結果（純數據版本）
 * @typedef {Object} TradeResult
 * @property {boolean} success - 是否成功
 * @property {Object} [transaction] - 交易詳情（成功時提供）
 * @property {'buy'|'sell'|'emergency'} [transaction.type] - 交易類型
 * @property {string} [transaction.item] - 交易物品
 * @property {number} [transaction.quantity] - 數量
 * @property {number} [transaction.price] - 價格
 * @property {string} [transaction.characterName] - 對方角色名稱
 * @property {string} [transaction.characterId] - 對方角色ID
 * @property {'low'|'medium'|'high'|'critical'} [transaction.urgency] - 緊急程度（僅緊急交易）
 * @property {number} [satisfaction] - 滿意度影響
 * @property {string} [error] - 錯誤訊息（失敗時提供）
 */

/**
 * 自動互助事件（背景觸發，不需房東選擇）
 * @typedef {Object} AutoMutualAidEvent
 * @property {'auto_mutual_aid'} type - 事件類型
 * @property {'food_aid'|'cash_loan'|'medical_aid'} subtype - 子類型
 * @property {string} helperId - 幫助者ID
 * @property {string} recipientId - 受助者ID
 * @property {string} item - 物品類型
 * @property {number} amount - 數量
 * @property {string} description - 描述
 * @property {Object} relationshipImpact - 關係影響
 */

// ==========================================
// 核心工具函數（純函數設計）
// ==========================================

/**
 * 計算角色交易選項（核心邏輯提取）
 * @param {Object} character - 角色物件
 * @param {number} relationship - 與房東關係度
 * @param {Object} config - 交易配置
 * @returns {Array} 交易選項陣列
 */
function calculateTradeOptions(character, relationship, config) {
  const options = [];
  const resources = character.personalResources || {};

  // 購買選項分析
  addBuyingOptions(options, resources, character, config);

  // 出售選項分析
  addSellingOptions(options, resources, character, config);

  // 緊急交易分析
  addEmergencyOptions(options, resources, character, relationship, config);

  return options;
}

/**
 * 添加購買選項
 */
function addBuyingOptions(options, resources, character, config) {
  // 食物短缺時願意購買
  if (resources.food < 2) {
    options.push({
      type: 'buy',
      item: 'food',
      quantity: 3,
      basePrice: config.baseResourceValues.food * 3,
      urgency: resources.food === 0 ? 'high' : 'medium',
      description: `${character.name} 想要購買食物`
    });
  }

  // 建材需求
  if (resources.materials < 1) {
    options.push({
      type: 'buy',
      item: 'materials',
      quantity: 2,
      basePrice: config.baseResourceValues.materials * 2,
      urgency: 'medium',
      description: `${character.name} 需要建材`
    });
  }

  // 醫療用品需求（特別是醫生和老人）
  if ((character.type === 'doctor' || character.type === 'elder') && resources.medical < 2) {
    options.push({
      type: 'buy',
      item: 'medical',
      quantity: 2,
      basePrice: config.baseResourceValues.medical * 2,
      urgency: 'medium',
      description: `${character.name} 需要醫療用品`
    });
  }

  // 燃料需求
  if (resources.fuel < 1) {
    options.push({
      type: 'buy',
      item: 'fuel',
      quantity: 2,
      basePrice: config.baseResourceValues.fuel * 2,
      urgency: 'low',
      description: `${character.name} 想要購買燃料`
    });
  }
}

/**
 * 添加出售選項
 */
function addSellingOptions(options, resources, character, config) {
  Object.entries(resources).forEach(([resource, amount]) => {
    if (resource === 'cash') return; // 現金不出售

    const comfortLevel = config.resourceComfortLevels[resource];
    if (comfortLevel && amount > comfortLevel) {
      const surplus = amount - comfortLevel;
      options.push({
        type: 'sell',
        item: resource,
        quantity: surplus,
        basePrice: config.baseResourceValues[resource] * surplus,
        urgency: 'low',
        description: `${character.name} 有多餘的${config.resourceNames[resource]}`
      });
    }
  });
}

/**
 * 添加緊急交易選項
 */
function addEmergencyOptions(options, resources, character, relationship, config) {
  // 只有關係度足夠的租客才會提出緊急交易
  if (relationship < config.emergencyTradeThresholds.minimumRelationship) return;

  // 極度缺乏食物時的緊急求購
  if (resources.food === 0 && resources.cash >= 8) {
    options.push({
      type: 'emergency',
      item: 'food',
      quantity: 3,
      basePrice: 8,
      urgency: 'critical',
      description: `${character.name} 沒有食物了，願意用高價購買！`
    });
  }

  // 極度缺乏現金時的緊急出售
  if (resources.cash === 0 && hasTradeableResources(resources)) {
    const bestResource = getBestTradeableResource(resources);
    options.push({
      type: 'emergency',
      item: bestResource,
      quantity: 2,
      basePrice: 5, // 低價出售
      urgency: 'high',
      description: `${character.name} 急需現金，願意低價出售資源`
    });
  }
}

/**
 * 關係度影響價格調整（純函數）
 */
function adjustPriceByRelationship(basePrice, tradeType, relationship, config) {
  const relationshipFactor = relationship / 100;
  const priceConfig = config.relationshipPriceEffect;

  switch (tradeType) {
    case 'buy': // 房東購買，關係好時價格降低
      return Math.floor(
        basePrice * (priceConfig.buyPriceBase - relationshipFactor * priceConfig.buyPriceReduction)
      );
    case 'sell': // 房東出售，關係好時價格提高
      return Math.floor(
        basePrice * (priceConfig.sellPriceBase + relationshipFactor * priceConfig.sellPriceIncrease)
      );
    default:
      return basePrice;
  }
}

/**
 * 工具函數：檢查是否有可交易資源
 */
function hasTradeableResources(resources) {
  return resources.materials >= 2 || resources.medical >= 1 || resources.fuel >= 2;
}

/**
 * 工具函數：取得最佳可交易資源
 */
function getBestTradeableResource(resources) {
  if (resources.medical >= 1) return 'medical';
  if (resources.materials >= 2) return 'materials';
  if (resources.fuel >= 2) return 'fuel';
  return 'materials';
}

// ==========================================
// 主要交易管理類別
// ==========================================

/**
 * 通用交易器（重組架構）
 * @class
 * @extends BaseManager
 */
export class UniversalTrader extends BaseManager {
  /**
   * 建立 UniversalTrader 實例
   * @param {Object} gameStateRef - 遊戲狀態參考
   * @param {Object} resourceManager - 資源管理器實例
   * @param {Object} dataManager - 資料管理器實例
   * @param {Object} eventBus - 事件總線實例
   */
  constructor(gameStateRef, resourceManager, dataManager, eventBus) {
    super(gameStateRef, eventBus, "UniversalTrader");

    /** @type {Object} 資源管理器實例 */
    this.resourceManager = resourceManager;

    /** @type {Object} 資料管理器實例 */
    this.dataManager = dataManager;

    /** @type {Map<string, TradeOption[]>} 輕量每日快取 */
    this.dailyTradeCache = new Map();

    // 配置參數（快速失敗模式）
    /** @type {number} 互助發生機率 */
    this.mutualAidProbability = null;
    /** @type {number} 互助最低關係度 */
    this.mutualAidMinRelationship = null;
    /** @type {number} 幫助他人最低關係度 */
    this.mutualAidHelpRelationship = null;
    /** @type {Object} 資源舒適度閾值 */
    this.resourceComfortLevels = null;
    /** @type {Object} 基礎資源價值 */
    this.baseResourceValues = null;
    /** @type {Object} 關係度價格影響 */
    this.relationshipPriceEffect = null;
    /** @type {Object} 緊急交易閾值 */
    this.emergencyTradeThresholds = null;
    /** @type {Object} 互助關係影響 */
    this.mutualAidRelationshipEffects = null;
    /** @type {Object} 資源名稱對照表 */
    this.resourceNames = null;

    this.addLog('UniversalTrader 已建立（重組架構）');
  }

  // ==========================================
  // BaseManager 抽象方法實作
  // ==========================================

  getModulePrefix() {
    return "trade";
  }

  setupEventListeners() {
    // 監聽新一天開始，處理自動互助和重置狀態
    this.onEvent("day_advanced", () => {
      this.processAutoMutualAid();
      this.resetDailyTradeStatus();
    }, { skipPrefix: true });
  }

  getExtendedStatus() {
    return {
      cacheSize: this.dailyTradeCache.size,
      configLoaded: this.isConfigurationLoaded(),
      mutualAidProbability: this.mutualAidProbability
    };
  }

  /**
   * 初始化方法
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    try {
      this.addLog("開始載入交易配置", "event");

      // 載入配置（快速失敗模式）
      await this.loadTradeConfigurations();

      // 設置事件監聽器
      this.setupEventListeners();

      // 標記初始化完成
      this.markInitialized(true);

      this.logSuccess("UniversalTrader 初始化完成");
      return true;
    } catch (error) {
      this.logError("UniversalTrader 初始化失敗", error);
      this.markInitialized(false);
      return false;
    }
  }

  // ==========================================
  // 配置載入
  // ==========================================

  /**
   * 載入交易配置（快速失敗模式）
   * @returns {Promise<void>}
   */
  async loadTradeConfigurations() {
    const gameRules = this.dataManager.getGameRules();

    // 直接載入所有配置，無預設值
    this.mutualAidProbability = gameRules.gameBalance?.economy?.mutualAid?.baseProbability;
    this.mutualAidMinRelationship = gameRules.gameBalance?.economy?.mutualAid?.minimumRelationshipForAid;
    this.mutualAidHelpRelationship = gameRules.gameBalance?.economy?.mutualAid?.minimumRelationshipForHelp;
    this.resourceComfortLevels = gameRules.gameBalance?.economy?.resourceTrade?.comfortLevels;
    this.baseResourceValues = gameRules.gameBalance?.economy?.resourceTrade?.baseResourceValues;
    this.relationshipPriceEffect = gameRules.gameBalance?.economy?.resourceTrade?.relationshipPriceEffect;
    this.emergencyTradeThresholds = gameRules.gameBalance?.economy?.resourceTrade?.emergencyTradeThresholds;
    this.mutualAidRelationshipEffects = gameRules.gameBalance?.economy?.mutualAid?.relationshipEffects;
    this.resourceNames = gameRules.gameBalance?.personalWealth?.resourceNames;

    // 配置完整性檢查
    const requiredConfigs = [
      'mutualAidProbability', 'mutualAidMinRelationship', 'resourceComfortLevels',
      'baseResourceValues', 'relationshipPriceEffect', 'emergencyTradeThresholds',
      'mutualAidRelationshipEffects', 'resourceNames'
    ];

    for (const config of requiredConfigs) {
      if (this[config] === undefined || this[config] === null) {
        throw new Error(`Critical trade configuration missing: ${config}. Check rules.json gameBalance.economy section`);
      }
    }

    this.logSuccess("交易配置載入完成");
  }

  /**
   * 檢查配置是否已載入
   * @returns {boolean} 配置是否完整載入
   */
  isConfigurationLoaded() {
    return !!(this.mutualAidProbability && this.resourceNames && this.baseResourceValues);
  }

  // ==========================================
  // 交易查詢與快取管理
  // ==========================================

  /**
   * 獲取角色交易選項（主要入口點）
   * @param {string} characterId - 角色ID
   * @returns {TradeOption[]} 該角色的交易選項
   */
  getCharacterTradeOptions(characterId) {
    try {
      if (!this.isConfigurationLoaded()) {
        throw new Error("交易配置未載入，無法生成交易選項");
      }

      // 檢查快取
      const cacheKey = `${characterId}_day${this.gameState.getStateValue('day', 1)}`;
      if (this.dailyTradeCache.has(cacheKey)) {
        return this.dailyTradeCache.get(cacheKey);
      }

      // 計算交易選項
      const character = this.findCharacterById(characterId);
      if (!character) {
        this.logWarning(`找不到角色 ID: ${characterId}`);
        return [];
      }

      const relationship = this.getTenantSatisfaction(character.name) || 50;
      const config = this.getTradeConfig();

      // 使用純函數計算選項
      const rawOptions = calculateTradeOptions(character, relationship, config);

      // 轉換為最終格式
      const finalOptions = rawOptions.map((option, index) => {
        const adjustedPrice = adjustPriceByRelationship(
          option.basePrice,
          option.type,
          relationship,
          config
        );

        return {
          id: `${characterId}_${option.type}_${option.item}_${index}`,
          character: character,
          type: option.type,
          item: option.item,
          quantity: option.quantity || 1,
          price: adjustedPrice,
          originalPrice: option.basePrice,
          relationship: relationship,
          urgency: option.urgency,
          description: option.description,
          canAfford: this.checkAffordability(option.type, adjustedPrice, option.item, option.quantity)
        };
      });

      // 儲存快取
      this.dailyTradeCache.set(cacheKey, finalOptions);

      this.logSuccess(`生成 ${finalOptions.length} 個交易選項給角色 ${character.name}`);
      return finalOptions;

    } catch (error) {
      this.logError("生成角色交易選項失敗", error);
      return [];
    }
  }

  /**
   * 取得交易配置物件
   * @returns {Object} 交易配置
   */
  getTradeConfig() {
    return {
      resourceComfortLevels: this.resourceComfortLevels,
      baseResourceValues: this.baseResourceValues,
      relationshipPriceEffect: this.relationshipPriceEffect,
      emergencyTradeThresholds: this.emergencyTradeThresholds,
      resourceNames: this.resourceNames
    };
  }

  // ==========================================
  // 交易執行邏輯
  // ==========================================

  /**
   * 執行交易
   * @param {TradeOption} tradeOption - 交易選項
   * @returns {Promise<TradeResult>} 交易結果
   */
  async executeTrade(tradeOption) {
    const { character, type, item, quantity, price } = tradeOption;

    try {
      let result = { success: false };

      switch (type) {
        case 'buy': // 房東購買資源
          result = this.executeBuy(character, item, quantity, price);
          break;

        case 'sell': // 房東出售資源
          result = this.executeSell(character, item, quantity, price);
          break;

        case 'emergency': // 緊急交易
          result = this.executeEmergencyTrade(tradeOption);
          break;

        default:
          return { success: false, error: `未知的交易類型: ${type}` };
      }

      if (result.success) {
        // 更新關係度
        this.updateRelationshipAfterTrade(character, type, result.satisfaction || 0);

        // 清除相關快取
        this.clearCharacterCache(character.id);

        // 發送交易完成事件
        this.emitEvent('tradeCompleted', { character, type, result });
      }

      return result;

    } catch (error) {
      this.logError("交易執行失敗", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 執行購買交易
   */
  executeBuy(character, item, quantity, price) {
    // 檢查房東現金
    if (!this.resourceManager.hasEnoughResources({ cash: price })) {
      return { success: false, error: '現金不足' };
    }

    // 檢查角色資源
    if (!character.personalResources[item] || character.personalResources[item] < quantity) {
      return { success: false, error: '對方資源不足' };
    }

    // 執行交易
    this.resourceManager.modifyResource('cash', -price, 'trade_purchase');
    this.resourceManager.modifyResource(item, quantity, 'trade_purchase');
    character.personalResources[item] -= quantity;
    character.personalResources.cash = (character.personalResources.cash || 0) + price;

    // 記錄交易日誌
    const resourceName = this.resourceNames[item] || item;
    this.addLog(`從 ${character.name} 購買 ${quantity} ${resourceName}，花費 $${price}`, "rent");

    return {
      success: true,
      transaction: {
        type: 'buy',
        item: item,
        quantity: quantity,
        price: price,
        characterName: character.name,
        characterId: character.id
      },
      satisfaction: 1
    };
  }

  /**
   * 執行出售交易
   */
  executeSell(character, item, quantity, price) {
    // 檢查房東資源
    if (!this.resourceManager.hasEnoughResources({ [item]: quantity })) {
      return { success: false, error: '資源不足' };
    }

    // 檢查角色現金
    if (!character.personalResources.cash || character.personalResources.cash < price) {
      return { success: false, error: '對方現金不足' };
    }

    // 執行交易
    this.resourceManager.modifyResource(item, -quantity, 'trade_sale');
    this.resourceManager.modifyResource('cash', price, 'trade_sale');
    character.personalResources[item] = (character.personalResources[item] || 0) + quantity;
    character.personalResources.cash -= price;

    // 記錄交易日誌
    const resourceName = this.resourceNames[item] || item;
    this.addLog(`向 ${character.name} 出售 ${quantity} ${resourceName}，獲得 $${price}`, "rent");

    return {
      success: true,
      transaction: {
        type: 'sell',
        item: item,
        quantity: quantity,
        price: price,
        characterName: character.name,
        characterId: character.id
      },
      satisfaction: 1
    };
  }

  /**
   * 執行緊急交易
   */
  executeEmergencyTrade(tradeOption) {
    let result;

    if (tradeOption.description.includes('購買')) {
      result = this.executeBuy(tradeOption.character, tradeOption.item, tradeOption.quantity, tradeOption.price);
    } else {
      result = this.executeSell(tradeOption.character, tradeOption.item, tradeOption.quantity, tradeOption.price);
    }

    // 如果成功，將交易類型標記為緊急
    if (result.success && result.transaction) {
      result.transaction.type = 'emergency';
      result.transaction.urgency = tradeOption.urgency;
    }

    return result;
  }

  // ==========================================
  // 自動互助系統
  // ==========================================

  /**
   * 處理自動互助（每日背景執行）
   * @returns {AutoMutualAidEvent[]} 發生的互助事件
   */
  processAutoMutualAid() {
    if (!this.isConfigurationLoaded()) {
      this.logWarning("配置未載入，跳過互助檢查");
      return [];
    }

    // 使用配置化的機率
    if (Math.random() > this.mutualAidProbability) {
      return [];
    }

    const allTenants = this.gameState.getAllTenants();
    if (allTenants.length < 2) {
      return [];
    }

    // 尋找需要幫助的租客
    const needyTenant = allTenants.find(tenant =>
      this.hasUrgentNeeds(tenant.personalResources)
    );

    // 尋找能提供幫助的租客
    const helpfulTenant = allTenants.find(tenant =>
      tenant.id !== needyTenant?.id &&
      this.getTenantSatisfaction(tenant.name) >= this.mutualAidHelpRelationship &&
      this.hasAbundantResources(tenant.personalResources)
    );

    if (needyTenant && helpfulTenant) {
      const aidEvent = this.createMutualAidEvent(needyTenant, helpfulTenant);
      if (aidEvent && this.executeAutoMutualAid(aidEvent)) {
        return [aidEvent];
      }
    }

    return [];
  }

  /**
   * 創建互助事件
   * @param {Object} needyTenant - 需要幫助的租客
   * @param {Object} helpfulTenant - 提供幫助的租客
   * @returns {AutoMutualAidEvent|null} 互助事件
   */
  createMutualAidEvent(needyTenant, helpfulTenant) {
    const needyResources = needyTenant.personalResources;
    const helpfulResources = helpfulTenant.personalResources;

    // 食物互助
    if (needyResources.food <= 1 && helpfulResources.food >= 4) {
      /** @type {AutoMutualAidEvent} */
      const foodAidEvent = {
        type: 'auto_mutual_aid',
        subtype: 'food_aid',
        helperId: helpfulTenant.id,
        recipientId: needyTenant.id,
        item: 'food',
        amount: 2,
        description: `${helpfulTenant.name} 主動分享食物給 ${needyTenant.name}`,
        relationshipImpact: this.mutualAidRelationshipEffects.foodAid
      };
      return foodAidEvent;
    }

    // 現金互助
    if (needyResources.cash <= 5 && helpfulResources.cash >= 15) {
      /** @type {AutoMutualAidEvent} */
      const cashLoanEvent = {
        type: 'auto_mutual_aid',
        subtype: 'cash_loan',
        helperId: helpfulTenant.id,
        recipientId: needyTenant.id,
        item: 'cash',
        amount: 5,
        description: `${helpfulTenant.name} 借錢給 ${needyTenant.name}`,
        relationshipImpact: this.mutualAidRelationshipEffects.cashLoan
      };
      return cashLoanEvent;
    }

    // 醫療互助（針對老人）
    if (needyTenant.type === 'elder' && needyResources.medical <= 1 && helpfulResources.medical >= 2) {
      /** @type {AutoMutualAidEvent} */
      const medicalAidEvent = {
        type: 'auto_mutual_aid',
        subtype: 'medical_aid',
        helperId: helpfulTenant.id,
        recipientId: needyTenant.id,
        item: 'medical',
        amount: 1,
        description: `${helpfulTenant.name} 給了醫療用品給老人 ${needyTenant.name}`,
        relationshipImpact: this.mutualAidRelationshipEffects.medicalAid
      };
      return medicalAidEvent;
    }

    return null;
  }

  /**
   * 執行自動互助
   */
  executeAutoMutualAid(aidEvent) {
    const { helperId, recipientId, item, amount, relationshipImpact } = aidEvent;

    const helperChar = this.findCharacterById(helperId);
    const recipientChar = this.findCharacterById(recipientId);

    if (!helperChar || !recipientChar) {
      this.logError('執行互助失敗：找不到對應角色');
      return false;
    }

    // 執行資源轉移
    helperChar.personalResources[item] -= amount;
    recipientChar.personalResources[item] = (recipientChar.personalResources[item] || 0) + amount;

    // 更新關係度
    this.updateTenantSatisfaction(helperChar.name, relationshipImpact.helper);
    this.updateTenantSatisfaction(recipientChar.name, relationshipImpact.recipient);

    // 記錄日誌
    this.addLog(aidEvent.description, "rent");

    // 發送互助事件
    this.emitEvent('autoMutualAidExecuted', {
      type: 'auto_mutual_aid',
      subtype: aidEvent.subtype,
      helper: helperChar.name,
      recipient: recipientChar.name,
      item: item,
      amount: amount
    });

    return true;
  }

  // ==========================================
  // 工具與狀態管理
  // ==========================================

  /**
   * 檢查房東負擔能力
   */
  checkAffordability(tradeType, price, item, quantity) {
    if (tradeType === 'buy' || tradeType === 'emergency') {
      return this.resourceManager.hasEnoughResources({ cash: price });
    } else if (tradeType === 'sell') {
      return this.resourceManager.hasEnoughResources({ [item]: quantity });
    }
    return true;
  }

  /**
   * 檢查是否有緊急需求
   */
  hasUrgentNeeds(resources) {
    return resources.food <= 1 || resources.cash <= 3;
  }

  /**
   * 檢查是否有充足資源
   */
  hasAbundantResources(resources) {
    return resources.food >= 5 || resources.cash >= 15 || resources.medical >= 3;
  }

  /**
   * 根據ID尋找角色
   */
  findCharacterById(characterId) {
    const allTenants = this.gameState.getAllTenants();
    const tenant = allTenants.find(t => t.id === characterId);
    if (tenant) return tenant;

    const allVisitors = this.gameState.getStateValue('visitors', []);
    const visitor = allVisitors.find(v => v.id === characterId);
    if (visitor) return visitor;

    return null;
  }

  /**
   * 獲取租客滿意度
   */
  getTenantSatisfaction(tenantName) {
    const satisfaction = this.gameState.getStateValue(`tenantSatisfaction.${tenantName}`);
    return satisfaction !== undefined ? satisfaction : 50;
  }

  /**
   * 更新租客滿意度
   */
  updateTenantSatisfaction(tenantName, change) {
    const current = this.getTenantSatisfaction(tenantName);
    const newValue = Math.max(0, Math.min(100, current + change));
    this.gameState.setStateValue(`tenantSatisfaction.${tenantName}`, newValue);
  }

  /**
   * 更新交易後關係度
   */
  updateRelationshipAfterTrade(character, tradeType, satisfaction) {
    if (satisfaction > 0) {
      this.updateTenantSatisfaction(character.name, 1);
    }
  }

  /**
   * 清除角色快取
   */
  clearCharacterCache(characterId) {
    const currentDay = this.gameState.getStateValue('day', 1);
    const cacheKey = `${characterId}_day${currentDay}`;
    this.dailyTradeCache.delete(cacheKey);
  }

  /**
   * 重置每日交易狀態
   */
  resetDailyTradeStatus() {
    this.dailyTradeCache.clear();
    this.addLog("每日交易狀態已重置", "event");
  }
}

export default UniversalTrader;
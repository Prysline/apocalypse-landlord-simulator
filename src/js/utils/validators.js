/**
 * Validators - 統一資料驗證模組
 *
 * 模組職責：
 * 1. 提供統一的資料驗證介面和標準化驗證結果
 * 2. 支援配置檔案結構驗證與運行時物件實例驗證
 * 3. 實現可擴展的驗證器註冊和管理機制
 * 4. 提供詳細的錯誤追蹤和診斷資訊
 *
 * 架構特點：
 * - 職責分離：配置驗證 vs 實例驗證
 * - 可擴展性：支援自定義驗證規則
 * - 統一介面：ValidationResult 標準化
 * - 錯誤追蹤：詳細的錯誤資訊和位置
 */

/**
 * 驗證結果標準化類型
 */
export class ValidationResult {
  constructor(isValid, errors = [], warnings = []) {
    this.isValid = isValid;
    this.errors = errors;
    this.warnings = warnings;
    this.timestamp = Date.now();
    this.context = null; // 驗證上下文
  }

  addError(message, field = null, code = null, context = null) {
    this.errors.push({
      message,
      field,
      code,
      context,
      timestamp: Date.now(),
    });
    this.isValid = false;
    return this;
  }

  addWarning(message, field = null, code = null, context = null) {
    this.warnings.push({
      message,
      field,
      code,
      context,
      timestamp: Date.now(),
    });
    return this;
  }

  merge(otherResult) {
    if (otherResult instanceof ValidationResult) {
      this.errors.push(...otherResult.errors);
      this.warnings.push(...otherResult.warnings);
      this.isValid = this.isValid && otherResult.isValid;
    }
    return this;
  }

  getFirstError() {
    return this.errors.length > 0 ? this.errors[0] : null;
  }

  hasField(fieldName) {
    return (
      this.errors.some((error) => error.field === fieldName) ||
      this.warnings.some((warning) => warning.field === fieldName)
    );
  }

  getErrorsByField(fieldName) {
    return this.errors.filter((error) => error.field === fieldName);
  }

  getWarningsByField(fieldName) {
    return this.warnings.filter((warning) => warning.field === fieldName);
  }

  setContext(context) {
    this.context = context;
    return this;
  }
}

/**
 * 基礎驗證器抽象類
 */
export class BaseValidator {
  constructor(name, type = "base") {
    this.name = name;
    this.type = type; // 'config' | 'instance' | 'base'
    this.rules = [];
    this.customRules = new Map();
  }

  /**
   * 添加驗證規則
   */
  addRule(predicate, errorMessage, field = null, code = null) {
    this.rules.push({ predicate, errorMessage, field, code });
    return this;
  }

  /**
   * 添加自定義驗證規則
   */
  addCustomRule(name, rule) {
    this.customRules.set(name, rule);
    return this;
  }

  /**
   * 執行驗證
   */
  validate(data, context = null) {
    const result = new ValidationResult(true);
    if (context) result.setContext(context);

    this.rules.forEach((rule) => {
      try {
        if (!rule.predicate(data)) {
          result.addError(rule.errorMessage, rule.field, rule.code, context);
        }
      } catch (error) {
        result.addError(
          `驗證規則執行失敗: ${error.message}`,
          rule.field,
          "RULE_EXECUTION_ERROR",
          context
        );
      }
    });

    return result;
  }

  /**
   * 重設驗證規則
   */
  clearRules() {
    this.rules = [];
    this.customRules.clear();
    return this;
  }

  /**
   * 取得驗證器資訊
   */
  getInfo() {
    return {
      name: this.name,
      type: this.type,
      rulesCount: this.rules.length,
      customRulesCount: this.customRules.size,
    };
  }
}

// ==================== 配置驗證器（Config Validators） ====================

/**
 * 配置驗證器基類
 * 專門用於驗證 JSON 配置檔案的結構和內容
 */
export class ConfigValidator extends BaseValidator {
  constructor(name) {
    super(name, "config");
  }

  /**
   * 驗證配置檔案基本結構
   */
  validateConfigStructure(config, requiredFields = []) {
    const result = new ValidationResult(true);

    if (!config || typeof config !== "object") {
      return result.addError(
        `${this.name} 配置必須是有效的物件`,
        null,
        "INVALID_CONFIG_TYPE"
      );
    }

    // 檢查必要欄位
    requiredFields.forEach((field) => {
      if (!(field in config)) {
        result.addError(
          `${this.name} 配置缺少必要欄位: ${field}`,
          field,
          "MISSING_REQUIRED_FIELD"
        );
      }
    });

    return result;
  }
}

/**
 * 租客配置驗證器
 * 驗證 tenants.json 配置檔案
 */
export class TenantConfigValidator extends ConfigValidator {
  constructor() {
    super("TenantConfigValidator");
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    // 基本結構驗證
    this.addRule(
      (data) => Array.isArray(data),
      "租客配置必須是陣列格式",
      null,
      "INVALID_DATA_TYPE"
    );

    return this;
  }

  /**
   * 驗證租客配置陣列
   */
  validateTenantConfig(tenantConfigs) {
    const result = this.validate(tenantConfigs);
    if (!result.isValid) return result;

    // 驗證每個租客配置
    tenantConfigs.forEach((config, index) => {
      const configResult = this.validateSingleTenantConfig(config, index);
      result.merge(configResult);
    });

    // 檢查ID唯一性
    this.validateUniqueIds(tenantConfigs, result);

    return result;
  }

  /**
   * 驗證單一租客配置
   */
  validateSingleTenantConfig(config, index) {
    const result = new ValidationResult(true);
    const context = `租客配置 ${index}`;

    // 必要欄位檢查
    const requiredFields = [
      "typeId",
      "typeName",
      "category",
      "rent",
      "skill",
      "infectionRisk",
      "description",
    ];

    requiredFields.forEach((field) => {
      if (!(field in config)) {
        result.addError(
          `${context}: 缺少必要欄位 ${field}`,
          field,
          "MISSING_REQUIRED_FIELD",
          context
        );
      }
    });

    // 資料類型驗證
    this.validateTenantConfigTypes(config, result, context);

    // 個人資源結構驗證
    if (config.personalResources) {
      const resourceResult = this.validatePersonalResourcesConfig(
        config.personalResources,
        context
      );
      result.merge(resourceResult);
    }

    // 技能ID驗證
    if (config.skillIds && !Array.isArray(config.skillIds)) {
      result.addError(
        `${context}: skillIds 必須是陣列`,
        "skillIds",
        "INVALID_SKILL_IDS",
        context
      );
    }

    // 解鎖條件驗證
    if (config.unlockConditions) {
      const unlockResult = this.validateUnlockConditions(
        config.unlockConditions,
        context
      );
      result.merge(unlockResult);
    }

    return result;
  }

  /**
   * 驗證租客配置的資料類型
   */
  validateTenantConfigTypes(config, result, context) {
    // 房租驗證
    if (typeof config.rent !== "number" || config.rent <= 0) {
      result.addError(
        `${context}: 房租必須是正數`,
        "rent",
        "INVALID_RENT_VALUE",
        context
      );
    }

    // 感染風險驗證
    if (
      typeof config.infectionRisk !== "number" ||
      config.infectionRisk < 0 ||
      config.infectionRisk > 1
    ) {
      result.addError(
        `${context}: 感染風險必須是 0-1 之間的數值`,
        "infectionRisk",
        "INVALID_INFECTION_RISK",
        context
      );
    }

    // 稀有度驗證
    if (config.rarity) {
      const validRarities = ["common", "uncommon", "rare", "epic", "legendary"];
      if (!validRarities.includes(config.rarity)) {
        result.addWarning(
          `${context}: 稀有度 '${config.rarity}' 不在標準列表中`,
          "rarity",
          "INVALID_RARITY",
          context
        );
      }
    }

    // 類別驗證
    if (config.category) {
      const validCategories = [
        "doctor",
        "worker",
        "farmer",
        "soldier",
        "elder",
      ];
      if (!validCategories.includes(config.category)) {
        result.addWarning(
          `${context}: 類別 '${config.category}' 不在標準列表中`,
          "category",
          "INVALID_CATEGORY",
          context
        );
      }
    }
  }

  /**
   * 驗證個人資源配置
   */
  validatePersonalResourcesConfig(resources, context) {
    const result = new ValidationResult(true);
    const resourceKeys = ["food", "materials", "medical", "fuel", "cash"];

    if (typeof resources !== "object" || resources === null) {
      return result.addError(
        `${context}: personalResources 必須是物件`,
        "personalResources",
        "INVALID_RESOURCE_TYPE",
        context
      );
    }

    resourceKeys.forEach((key) => {
      if (resources[key] !== undefined) {
        if (typeof resources[key] !== "number") {
          result.addError(
            `${context}: personalResources.${key} 必須是數值`,
            `personalResources.${key}`,
            "INVALID_RESOURCE_TYPE",
            context
          );
        } else if (resources[key] < 0) {
          result.addWarning(
            `${context}: personalResources.${key} 為負值`,
            `personalResources.${key}`,
            "NEGATIVE_RESOURCE_VALUE",
            context
          );
        }
      }
    });

    return result;
  }

  /**
   * 驗證解鎖條件
   */
  validateUnlockConditions(conditions, context) {
    const result = new ValidationResult(true);

    if (typeof conditions !== "object" || conditions === null) {
      return result.addError(
        `${context}: unlockConditions 必須是物件`,
        "unlockConditions",
        "INVALID_UNLOCK_CONDITIONS",
        context
      );
    }

    // 驗證日期條件
    if (
      conditions.day !== undefined &&
      (typeof conditions.day !== "number" || conditions.day < 1)
    ) {
      result.addError(
        `${context}: unlockConditions.day 必須是正整數`,
        "unlockConditions.day",
        "INVALID_UNLOCK_DAY",
        context
      );
    }

    // 驗證建築防禦條件
    if (
      conditions.buildingDefense !== undefined &&
      (typeof conditions.buildingDefense !== "number" ||
        conditions.buildingDefense < 0)
    ) {
      result.addError(
        `${context}: unlockConditions.buildingDefense 必須是非負數`,
        "unlockConditions.buildingDefense",
        "INVALID_UNLOCK_DEFENSE",
        context
      );
    }

    // 驗證總租客數條件
    if (
      conditions.totalTenants !== undefined &&
      (typeof conditions.totalTenants !== "number" ||
        conditions.totalTenants < 0)
    ) {
      result.addError(
        `${context}: unlockConditions.totalTenants 必須是非負整數`,
        "unlockConditions.totalTenants",
        "INVALID_UNLOCK_TENANTS",
        context
      );
    }

    return result;
  }

  /**
   * 檢查ID唯一性
   */
  validateUniqueIds(configs, result) {
    const idMap = new Map();

    configs.forEach((config, index) => {
      if (config.typeId) {
        if (idMap.has(config.typeId)) {
          result.addError(
            `重複的 typeId: ${config.typeId} (出現在索引 ${idMap.get(
              config.typeId
            )} 和 ${index})`,
            "typeId",
            "DUPLICATE_TYPE_ID",
            `租客配置唯一性檢查`
          );
        } else {
          idMap.set(config.typeId, index);
        }
      }
    });
  }
}

/**
 * 技能配置驗證器
 */
export class SkillConfigValidator extends ConfigValidator {
  constructor() {
    super("SkillConfigValidator");
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    this.addRule(
      (data) => typeof data === "object" && data !== null,
      "技能配置必須是物件格式",
      null,
      "INVALID_DATA_TYPE"
    );

    return this;
  }

  /**
   * 驗證技能配置
   */
  validateSkillConfig(skillData) {
    const result = this.validate(skillData);
    if (!result.isValid) return result;

    // 驗證每個租客類型的技能
    Object.entries(skillData).forEach(([tenantType, skills]) => {
      const typeResult = this.validateTenantTypeSkills(tenantType, skills);
      result.merge(typeResult);
    });

    return result;
  }

  /**
   * 驗證特定租客類型的技能
   */
  validateTenantTypeSkills(tenantType, skills) {
    const result = new ValidationResult(true);
    const context = `租客類型 ${tenantType}`;

    if (!Array.isArray(skills)) {
      return result.addError(
        `${context} 的技能資料必須是陣列`,
        tenantType,
        "INVALID_SKILLS_TYPE",
        context
      );
    }

    skills.forEach((skill, index) => {
      const skillResult = this.validateSingleSkillConfig(
        skill,
        tenantType,
        index
      );
      result.merge(skillResult);
    });

    // 檢查技能ID唯一性
    this.validateSkillIdUniqueness(skills, tenantType, result);

    return result;
  }

  /**
   * 驗證單一技能配置
   */
  validateSingleSkillConfig(skill, tenantType, index) {
    const result = new ValidationResult(true);
    const context = `${tenantType} 技能 ${index}`;

    // 必要欄位檢查
    const requiredFields = ["id", "name", "type", "description"];
    requiredFields.forEach((field) => {
      if (!(field in skill)) {
        result.addError(
          `${context}: 缺少必要欄位 ${field}`,
          field,
          "MISSING_REQUIRED_FIELD",
          context
        );
      }
    });

    // 技能類型驗證
    const validTypes = ["active", "passive", "special"];
    if (skill.type && !validTypes.includes(skill.type)) {
      result.addError(
        `${context}: 技能類型必須是 ${validTypes.join(", ")} 之一`,
        "type",
        "INVALID_SKILL_TYPE",
        context
      );
    }

    // 成本結構驗證
    if (skill.cost) {
      const costResult = this.validateSkillCost(skill.cost, context);
      result.merge(costResult);
    }

    // 冷卻時間驗證
    if (
      skill.cooldown !== undefined &&
      (typeof skill.cooldown !== "number" || skill.cooldown < -1)
    ) {
      result.addError(
        `${context}: 冷卻時間必須是 >= -1 的數值 (-1 表示永久性技能)`,
        "cooldown",
        "INVALID_COOLDOWN",
        context
      );
    }

    // 效果驗證
    if (skill.effects && !Array.isArray(skill.effects)) {
      result.addError(
        `${context}: effects 必須是陣列`,
        "effects",
        "INVALID_EFFECTS_TYPE",
        context
      );
    }

    // 使用次數限制驗證
    if (
      skill.maxUses !== undefined &&
      (typeof skill.maxUses !== "number" || skill.maxUses < 1)
    ) {
      result.addError(
        `${context}: maxUses 必須是正整數`,
        "maxUses",
        "INVALID_MAX_USES",
        context
      );
    }

    return result;
  }

  /**
   * 驗證技能成本
   */
  validateSkillCost(cost, context) {
    const result = new ValidationResult(true);

    if (typeof cost !== "object" || cost === null) {
      return result.addError(
        `${context}: cost 必須是物件`,
        "cost",
        "INVALID_COST_TYPE",
        context
      );
    }

    const validResources = ["food", "materials", "medical", "fuel", "cash"];

    Object.entries(cost).forEach(([resource, amount]) => {
      if (!validResources.includes(resource)) {
        result.addWarning(
          `${context}: 成本資源 '${resource}' 不在標準資源列表中`,
          `cost.${resource}`,
          "UNKNOWN_RESOURCE_TYPE",
          context
        );
      }

      if (typeof amount !== "number" || amount < 0) {
        result.addError(
          `${context}: 成本 ${resource} 必須是非負數`,
          `cost.${resource}`,
          "INVALID_COST_VALUE",
          context
        );
      }
    });

    return result;
  }

  /**
   * 檢查技能ID唯一性
   */
  validateSkillIdUniqueness(skills, tenantType, result) {
    const idMap = new Map();

    skills.forEach((skill, index) => {
      if (skill.id) {
        if (idMap.has(skill.id)) {
          result.addError(
            `${tenantType}: 重複的技能ID '${skill.id}' (出現在索引 ${idMap.get(
              skill.id
            )} 和 ${index})`,
            "id",
            "DUPLICATE_SKILL_ID",
            `${tenantType} 技能唯一性檢查`
          );
        } else {
          idMap.set(skill.id, index);
        }
      }
    });
  }
}

/**
 * 事件配置驗證器
 */
export class EventConfigValidator extends ConfigValidator {
  constructor() {
    super("EventConfigValidator");
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    this.addRule(
      (data) => typeof data === "object" && data !== null,
      "事件配置必須是物件格式",
      null,
      "INVALID_DATA_TYPE"
    );

    return this;
  }

  /**
   * 驗證事件配置
   */
  validateEventConfig(eventData) {
    const result = this.validate(eventData);
    if (!result.isValid) return result;

    // 驗證必要分類
    const requiredCategories = [
      "random_events",
      "conflict_events",
      "special_events",
    ];

    requiredCategories.forEach((category) => {
      if (!eventData[category] || !Array.isArray(eventData[category])) {
        result.addError(
          `事件配置缺少 ${category} 分類或格式錯誤`,
          category,
          "MISSING_EVENT_CATEGORY",
          "事件配置結構檢查"
        );
      }
    });

    // 驗證每個分類的事件
    Object.entries(eventData).forEach(([category, events]) => {
      if (Array.isArray(events)) {
        const categoryResult = this.validateEventCategory(category, events);
        result.merge(categoryResult);
      }
    });

    return result;
  }

  /**
   * 驗證事件分類
   */
  validateEventCategory(category, events) {
    const result = new ValidationResult(true);
    const context = `事件分類 ${category}`;

    events.forEach((event, index) => {
      const eventResult = this.validateSingleEventConfig(
        event,
        category,
        index
      );
      result.merge(eventResult);
    });

    // 檢查事件ID唯一性
    this.validateEventIdUniqueness(events, category, result);

    return result;
  }

  /**
   * 驗證單一事件配置
   */
  validateSingleEventConfig(event, category, index) {
    const result = new ValidationResult(true);
    const context = `${category} 事件 ${index}`;

    // 基本欄位檢查
    ["id", "title", "description"].forEach((field) => {
      if (!(field in event)) {
        result.addError(
          `${context}: 缺少必要欄位 ${field}`,
          field,
          "MISSING_REQUIRED_FIELD",
          context
        );
      }
    });

    // 必須有 choices 或 dynamicChoices
    const hasChoices = "choices" in event;
    const hasDynamic = "dynamicChoices" in event;

    if (!hasChoices && !hasDynamic) {
      result.addError(
        `${context}: 必須包含 choices 或 dynamicChoices 其中之一`,
        "choices",
        "MISSING_CHOICES",
        context
      );
    }

    // 驗證 choices 格式
    if (hasChoices && !Array.isArray(event.choices)) {
      result.addError(
        `${context}: choices 必須是陣列`,
        "choices",
        "INVALID_CHOICES_TYPE",
        context
      );
    }

    // 驗證 dynamicChoices 格式
    if (hasDynamic) {
      const dynamicResult = this.validateDynamicChoicesConfig(
        event.dynamicChoices,
        context
      );
      result.merge(dynamicResult);
    }

    // 驗證優先級
    if (
      event.priority !== undefined &&
      (typeof event.priority !== "number" || event.priority < 0)
    ) {
      result.addError(
        `${context}: priority 必須是非負數`,
        "priority",
        "INVALID_PRIORITY",
        context
      );
    }

    return result;
  }

  /**
   * 驗證動態選擇配置
   */
  validateDynamicChoicesConfig(dynamicChoices, context) {
    const result = new ValidationResult(true);

    if (!dynamicChoices || typeof dynamicChoices !== "object") {
      return result.addError(
        `${context}: dynamicChoices 必須是物件`,
        "dynamicChoices",
        "INVALID_DYNAMIC_CHOICES_TYPE",
        context
      );
    }

    // base 是必要的
    if (!Array.isArray(dynamicChoices.base)) {
      result.addError(
        `${context}: dynamicChoices.base 必須是陣列`,
        "dynamicChoices.base",
        "INVALID_BASE_CHOICES",
        context
      );
    }

    // conditional 是可選的，但如果存在必須是陣列
    if (
      "conditional" in dynamicChoices &&
      !Array.isArray(dynamicChoices.conditional)
    ) {
      result.addError(
        `${context}: dynamicChoices.conditional 必須是陣列`,
        "dynamicChoices.conditional",
        "INVALID_CONDITIONAL_CHOICES",
        context
      );
    }

    return result;
  }

  /**
   * 檢查事件ID唯一性
   */
  validateEventIdUniqueness(events, category, result) {
    const idMap = new Map();

    events.forEach((event, index) => {
      if (event.id) {
        if (idMap.has(event.id)) {
          result.addError(
            `${category}: 重複的事件ID '${event.id}' (出現在索引 ${idMap.get(
              event.id
            )} 和 ${index})`,
            "id",
            "DUPLICATE_EVENT_ID",
            `${category} 事件唯一性檢查`
          );
        } else {
          idMap.set(event.id, index);
        }
      }
    });
  }
}

/**
 * 規則配置驗證器
 */
export class RuleConfigValidator extends ConfigValidator {
  constructor() {
    super("RuleConfigValidator");
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    this.addRule(
      (data) => typeof data === "object" && data !== null,
      "規則配置必須是物件格式",
      null,
      "INVALID_DATA_TYPE"
    );

    return this;
  }

  /**
   * 驗證規則配置
   */
  validateRuleConfig(ruleData) {
    const result = this.validate(ruleData);
    if (!result.isValid) return result;

    // 驗證主要區塊
    const recommendedSections = [
      "gameDefaults",
      "gameBalance",
      "mechanics",
      "ui",
    ];

    recommendedSections.forEach((section) => {
      if (!(section in ruleData)) {
        result.addWarning(
          `規則配置缺少推薦區塊: ${section}`,
          section,
          "MISSING_RECOMMENDED_SECTION",
          "規則配置結構檢查"
        );
      }
    });

    // 驗證 gameBalance 結構
    if (ruleData.gameBalance) {
      const balanceResult = this.validateGameBalanceConfig(
        ruleData.gameBalance
      );
      result.merge(balanceResult);
    }

    // 驗證 mechanics 結構
    if (ruleData.mechanics) {
      const mechanicsResult = this.validateMechanicsConfig(ruleData.mechanics);
      result.merge(mechanicsResult);
    }

    return result;
  }

  /**
   * 驗證遊戲平衡配置
   */
  validateGameBalanceConfig(gameBalance) {
    const result = new ValidationResult(true);
    const context = "遊戲平衡配置";

    // 驗證房東配置
    if (gameBalance.landlord) {
      const landlordResult = this.validateLandlordConfig(
        gameBalance.landlord,
        context
      );
      result.merge(landlordResult);
    }

    // 驗證租客配置
    if (gameBalance.tenants) {
      const tenantResult = this.validateTenantBalanceConfig(
        gameBalance.tenants,
        context
      );
      result.merge(tenantResult);
    }

    return result;
  }

  /**
   * 驗證房東配置
   */
  validateLandlordConfig(landlord, context) {
    const result = new ValidationResult(true);

    if (landlord.hungerSystem) {
      const hungerSystem = landlord.hungerSystem;

      if (!hungerSystem.levels || !Array.isArray(hungerSystem.levels)) {
        result.addError(
          `${context}: landlord.hungerSystem.levels 必須是陣列`,
          "landlord.hungerSystem.levels",
          "INVALID_HUNGER_LEVELS",
          context
        );
      } else {
        // 驗證飢餓等級結構
        hungerSystem.levels.forEach((level, index) => {
          if (typeof level.threshold !== "number") {
            result.addError(
              `${context}: hungerSystem.levels[${index}].threshold 必須是數值`,
              `landlord.hungerSystem.levels[${index}].threshold`,
              "INVALID_THRESHOLD",
              context
            );
          }
        });
      }
    }

    return result;
  }

  /**
   * 驗證租客平衡配置
   */
  validateTenantBalanceConfig(tenants, context) {
    const result = new ValidationResult(true);

    if (tenants.satisfactionSystem) {
      const satisfactionSystem = tenants.satisfactionSystem;

      if (typeof satisfactionSystem.baseValue !== "number") {
        result.addError(
          `${context}: tenants.satisfactionSystem.baseValue 必須是數值`,
          "tenants.satisfactionSystem.baseValue",
          "INVALID_BASE_VALUE",
          context
        );
      }

      if (satisfactionSystem.range) {
        const range = satisfactionSystem.range;
        if (typeof range.min !== "number" || typeof range.max !== "number") {
          result.addError(
            `${context}: satisfactionSystem.range.min 和 max 必須是數值`,
            "tenants.satisfactionSystem.range",
            "INVALID_RANGE",
            context
          );
        } else if (range.min >= range.max) {
          result.addError(
            `${context}: satisfactionSystem.range.min 必須小於 max`,
            "tenants.satisfactionSystem.range",
            "INVALID_RANGE_ORDER",
            context
          );
        }
      }
    }

    return result;
  }

  /**
   * 驗證機制配置
   */
  validateMechanicsConfig(mechanics) {
    const result = new ValidationResult(true);
    const context = "遊戲機制配置";

    // 驗證採集機制
    if (mechanics.harvest) {
      const harvest = mechanics.harvest;

      if (typeof harvest.baseAmount !== "number" || harvest.baseAmount < 0) {
        result.addError(
          `${context}: harvest.baseAmount 必須是非負數`,
          "mechanics.harvest.baseAmount",
          "INVALID_HARVEST_AMOUNT",
          context
        );
      }
    }

    // 驗證搜刮機制
    if (mechanics.scavenging && mechanics.scavenging.baseSuccessRates) {
      const rates = mechanics.scavenging.baseSuccessRates;

      Object.entries(rates).forEach(([type, rate]) => {
        if (typeof rate !== "number" || rate < 0 || rate > 100) {
          result.addError(
            `${context}: scavenging.baseSuccessRates.${type} 必須是 0-100 的數值`,
            `mechanics.scavenging.baseSuccessRates.${type}`,
            "INVALID_SUCCESS_RATE",
            context
          );
        }
      });
    }

    return result;
  }
}

// ==================== 實例驗證器（Instance Validators） ====================

/**
 * 實例驗證器基類
 * 專門用於驗證運行時物件實例的有效性
 */
export class InstanceValidator extends BaseValidator {
  constructor(name) {
    super(name, "instance");
  }

  /**
   * 驗證物件基本結構
   */
  validateObjectStructure(obj, requiredFields = []) {
    const result = new ValidationResult(true);

    if (!obj || typeof obj !== "object") {
      return result.addError(
        `${this.name} 實例必須是有效的物件`,
        null,
        "INVALID_INSTANCE_TYPE"
      );
    }

    // 檢查必要欄位
    requiredFields.forEach((field) => {
      if (!(field in obj)) {
        result.addError(
          `${this.name} 實例缺少必要欄位: ${field}`,
          field,
          "MISSING_REQUIRED_FIELD"
        );
      }
    });

    return result;
  }
}

/**
 * 租客實例驗證器
 * 驗證運行時的租客物件（申請者、入住租客等）
 */
export class TenantInstanceValidator extends InstanceValidator {
  constructor() {
    super("TenantInstanceValidator");
  }

  /**
   * 驗證申請者實例
   */
  validateApplicant(applicant) {
    const result = new ValidationResult(true);
    const context = `申請者 ${applicant?.name || "未命名"}`;

    // 必要欄位檢查
    const requiredFields = ["id", "name", "type", "rent", "infected"];
    const structureResult = this.validateObjectStructure(
      applicant,
      requiredFields
    );
    result.merge(structureResult);

    if (!result.isValid) return result;

    // ID 格式驗證
    if (typeof applicant.id !== "string" || applicant.id.length === 0) {
      result.addError(
        `${context}: ID 必須是非空字串`,
        "id",
        "INVALID_ID_FORMAT",
        context
      );
    }

    // 姓名驗證
    if (
      typeof applicant.name !== "string" ||
      applicant.name.trim().length === 0
    ) {
      result.addError(
        `${context}: 姓名必須是非空字串`,
        "name",
        "INVALID_NAME",
        context
      );
    }

    // 房租驗證
    if (typeof applicant.rent !== "number" || applicant.rent <= 0) {
      result.addError(
        `${context}: 房租必須是正數`,
        "rent",
        "INVALID_RENT_VALUE",
        context
      );
    }

    // 感染狀態驗證
    if (typeof applicant.infected !== "boolean") {
      result.addError(
        `${context}: 感染狀態必須是布林值`,
        "infected",
        "INVALID_INFECTION_STATUS",
        context
      );
    }

    // 個人資源驗證
    if (applicant.personalResources) {
      const resourceResult = this.validatePersonalResourcesInstance(
        applicant.personalResources,
        context
      );
      result.merge(resourceResult);
    }

    return result;
  }

  /**
   * 驗證入住租客實例
   */
  validateTenant(tenant) {
    const result = this.validateApplicant(tenant);
    const context = `租客 ${tenant?.name || "未命名"}`;

    if (!result.isValid) return result;

    // 額外的租客特定欄位
    const tenantFields = ["moveInDate"];
    tenantFields.forEach((field) => {
      if (tenant[field] === undefined) {
        result.addWarning(
          `${context}: 缺少租客欄位 ${field}`,
          field,
          "MISSING_TENANT_FIELD",
          context
        );
      }
    });

    // 入住日期驗證
    if (
      tenant.moveInDate !== undefined &&
      (typeof tenant.moveInDate !== "number" || tenant.moveInDate < 1)
    ) {
      result.addError(
        `${context}: moveInDate 必須是正整數`,
        "moveInDate",
        "INVALID_MOVE_IN_DATE",
        context
      );
    }

    return result;
  }

  /**
   * 驗證個人資源實例
   */
  validatePersonalResourcesInstance(resources, context) {
    const result = new ValidationResult(true);

    if (typeof resources !== "object" || resources === null) {
      return result.addError(
        `${context}: personalResources 必須是物件`,
        "personalResources",
        "INVALID_RESOURCE_TYPE",
        context
      );
    }

    const resourceKeys = ["food", "materials", "medical", "fuel", "cash"];

    resourceKeys.forEach((key) => {
      if (resources[key] !== undefined) {
        if (typeof resources[key] !== "number") {
          result.addError(
            `${context}: personalResources.${key} 必須是數值`,
            `personalResources.${key}`,
            "INVALID_RESOURCE_TYPE",
            context
          );
        } else if (resources[key] < 0) {
          result.addWarning(
            `${context}: personalResources.${key} 為負值`,
            `personalResources.${key}`,
            "NEGATIVE_RESOURCE_VALUE",
            context
          );
        }
      }
    });

    return result;
  }
}

/**
 * 資源實例驗證器
 * 專門用於驗證運行時的資源物件（主資源池、個人資源、資源操作等）
 */
export class ResourceInstanceValidator extends InstanceValidator {
  constructor() {
    super("ResourceInstanceValidator");
  }

  /**
   * 驗證主資源池物件
   */
  validateResources(resources) {
    const result = new ValidationResult(true);
    const context = "主資源池";

    // 基本結構檢查
    if (!resources || typeof resources !== "object") {
      return result.addError(
        `${context} 必須是有效的物件`,
        "resources",
        "INVALID_RESOURCES_TYPE",
        context
      );
    }

    // 標準資源類型
    const standardResourceTypes = ["food", "materials", "medical", "fuel", "cash"];

    // 檢查每個標準資源
    standardResourceTypes.forEach((type) => {
      if (resources[type] !== undefined) {
        const typeResult = this.validateSingleResource(resources[type], type, context);
        result.merge(typeResult);
      }
    });

    // 檢查是否有未知的資源類型
    Object.keys(resources).forEach((type) => {
      if (!standardResourceTypes.includes(type)) {
        result.addWarning(
          `${context}: 發現未知資源類型 '${type}'`,
          `resources.${type}`,
          "UNKNOWN_RESOURCE_TYPE",
          context
        );
      }
    });

    // 檢查資源平衡性
    const balanceResult = this.validateResourceBalance(resources, context);
    result.merge(balanceResult);

    return result;
  }

  /**
   * 驗證單一資源數值
   */
  validateSingleResource(value, type, context) {
    const result = new ValidationResult(true);

    // 數值類型檢查
    if (typeof value !== "number") {
      return result.addError(
        `${context}: ${type} 必須是數值類型，目前為 ${typeof value}`,
        `resources.${type}`,
        "INVALID_RESOURCE_VALUE_TYPE",
        context
      );
    }

    // NaN 檢查
    if (isNaN(value)) {
      return result.addError(
        `${context}: ${type} 為無效數值 (NaN)`,
        `resources.${type}`,
        "INVALID_RESOURCE_NAN",
        context
      );
    }

    // 無限值檢查
    if (!isFinite(value)) {
      return result.addError(
        `${context}: ${type} 為無限值`,
        `resources.${type}`,
        "INVALID_RESOURCE_INFINITE",
        context
      );
    }

    // 負值檢查
    if (value < 0) {
      result.addWarning(
        `${context}: ${type} 為負值 (${value})，可能影響遊戲邏輯`,
        `resources.${type}`,
        "NEGATIVE_RESOURCE_VALUE",
        context
      );
    }

    // 極端值檢查
    if (value > 999999) {
      result.addWarning(
        `${context}: ${type} 數值過大 (${value})，可能影響效能`,
        `resources.${type}`,
        "EXTREME_RESOURCE_VALUE",
        context
      );
    }

    // 小數檢查（資源通常應為整數）
    if (value % 1 !== 0) {
      result.addWarning(
        `${context}: ${type} 包含小數部分 (${value})`,
        `resources.${type}`,
        "DECIMAL_RESOURCE_VALUE",
        context
      );
    }

    return result;
  }

  /**
   * 驗證資源平衡性
   */
  validateResourceBalance(resources, context) {
    const result = new ValidationResult(true);

    // 檢查是否所有基本資源都為零（可能的遊戲結束狀態）
    const basicResources = ["food", "materials", "medical", "fuel"];
    const allBasicEmpty = basicResources.every((type) => (resources[type] || 0) === 0);

    if (allBasicEmpty && (resources.cash || 0) === 0) {
      result.addWarning(
        `${context}: 所有資源均為零，可能為遊戲結束狀態`,
        "resources",
        "ALL_RESOURCES_EMPTY",
        context
      );
    }

    // 檢查現金與其他資源的比例（防止經濟失衡）
    const totalResourceValue = basicResources.reduce((sum, type) => {
      const amount = resources[type] || 0;
      const rates = { food: 1.5, materials: 3, medical: 4, fuel: 3 };
      return sum + amount * (rates[type] || 1);
    }, 0);

    const cashAmount = resources.cash || 0;

    if (cashAmount > totalResourceValue * 10 && totalResourceValue > 0) {
      result.addWarning(
        `${context}: 現金與資源比例失衡 (現金: ${cashAmount}, 資源價值: ${totalResourceValue})`,
        "resources.cash",
        "RESOURCE_CASH_IMBALANCE",
        context
      );
    }

    return result;
  }

  /**
   * 驗證資源操作
   */
  validateResourceOperation(operation) {
    const result = new ValidationResult(true);
    const context = "資源操作";

    // 基本結構檢查
    if (!operation || typeof operation !== "object") {
      return result.addError(
        "資源操作必須是物件",
        "operation",
        "INVALID_OPERATION_TYPE",
        context
      );
    }

    const { type, amount, reason, currentValue } = operation;

    // 資源類型檢查
    if (!type || typeof type !== "string") {
      result.addError(
        "資源操作必須指定有效的資源類型",
        "type",
        "MISSING_RESOURCE_TYPE",
        context
      );
    }

    // 數量檢查
    if (typeof amount !== "number") {
      result.addError(
        "資源操作數量必須是數值",
        "amount",
        "INVALID_OPERATION_AMOUNT",
        context
      );
    } else if (isNaN(amount) || !isFinite(amount)) {
      result.addError(
        "資源操作數量必須是有效數值",
        "amount",
        "INVALID_OPERATION_AMOUNT_VALUE",
        context
      );
    }

    // 原因檢查
    if (!reason || typeof reason !== "string") {
      result.addWarning(
        "建議提供資源操作原因以便追蹤",
        "reason",
        "MISSING_OPERATION_REASON",
        context
      );
    }

    // 扣除操作檢查
    if (amount < 0 && typeof currentValue === "number") {
      const resultingValue = currentValue + amount;
      
      if (resultingValue < 0) {
        result.addError(
          `操作會導致資源不足: ${type} 當前 ${currentValue}，嘗試扣除 ${Math.abs(amount)}，結果 ${resultingValue}`,
          "amount",
          "INSUFFICIENT_RESOURCES_FOR_OPERATION",
          context
        );
      }
    }

    // 極端操作檢查
    if (Math.abs(amount) > 1000) {
      result.addWarning(
        `資源操作數量異常: ${amount}`,
        "amount",
        "EXTREME_OPERATION_AMOUNT",
        context
      );
    }

    return result;
  }

  /**
   * 驗證個人資源
   */
  validatePersonalResources(personalResources, context = "個人資源") {
    const result = new ValidationResult(true);

    // 基本結構檢查
    if (!personalResources || typeof personalResources !== "object") {
      return result.addError(
        `${context} 必須是有效的物件`,
        "personalResources",
        "INVALID_PERSONAL_RESOURCES_TYPE",
        context
      );
    }

    // 標準個人資源類型
    const standardTypes = ["food", "materials", "medical", "fuel", "cash"];

    // 檢查每個資源
    Object.keys(personalResources).forEach((type) => {
      const value = personalResources[type];
      
      // 檢查是否為標準類型
      if (!standardTypes.includes(type)) {
        result.addWarning(
          `${context}: 未知個人資源類型 '${type}'`,
          `personalResources.${type}`,
          "UNKNOWN_PERSONAL_RESOURCE_TYPE",
          context
        );
      }

      // 數值驗證
      if (value !== undefined) {
        const valueResult = this.validateSingleResource(value, type, context);
        result.merge(valueResult);
      }
    });

    // 檢查個人資源完整性
    const completenessResult = this.validatePersonalResourceCompleteness(personalResources, context);
    result.merge(completenessResult);

    return result;
  }

  /**
   * 驗證個人資源完整性
   */
  validatePersonalResourceCompleteness(personalResources, context) {
    const result = new ValidationResult(true);

    // 檢查是否有基本的生存資源
    const food = personalResources.food || 0;
    const cash = personalResources.cash || 0;

    if (food === 0 && cash === 0) {
      result.addWarning(
        `${context}: 缺乏基本生存資源（食物和現金均為零）`,
        "personalResources",
        "INSUFFICIENT_SURVIVAL_RESOURCES",
        context
      );
    }

    // 檢查資源總價值（防止過度富有的租客）
    const totalValue = Object.keys(personalResources).reduce((sum, type) => {
      const amount = personalResources[type] || 0;
      const rates = { food: 1.5, materials: 3, medical: 4, fuel: 3, cash: 1 };
      return sum + amount * (rates[type] || 1);
    }, 0);

    if (totalValue > 500) {
      result.addWarning(
        `${context}: 個人資源總價值過高 (${totalValue})`,
        "personalResources",
        "EXCESSIVE_PERSONAL_WEALTH",
        context
      );
    }

    return result;
  }

  /**
   * 驗證資源交易
   */
  validateResourceTrade(tradeData) {
    const result = new ValidationResult(true);
    const context = "資源交易";

    // 基本結構檢查
    if (!tradeData || typeof tradeData !== "object") {
      return result.addError(
        "交易資料必須是物件",
        "tradeData",
        "INVALID_TRADE_DATA_TYPE",
        context
      );
    }

    const { give, receive, type } = tradeData;

    // 交易類型檢查
    const validTradeTypes = ["resource_exchange", "rent_payment", "merchant_trade", "skill_payment"];
    if (type && !validTradeTypes.includes(type)) {
      result.addWarning(
        `未知交易類型: ${type}`,
        "type",
        "UNKNOWN_TRADE_TYPE",
        context
      );
    }

    // 付出資源檢查
    if (give && typeof give === "object") {
      const giveResult = this.validateTradeResources(give, "付出", context);
      result.merge(giveResult);
    }

    // 獲得資源檢查
    if (receive && typeof receive === "object") {
      const receiveResult = this.validateTradeResources(receive, "獲得", context);
      result.merge(receiveResult);
    }

    // 交易平衡性檢查
    if (give && receive) {
      const balanceResult = this.validateTradeBalance(give, receive, context);
      result.merge(balanceResult);
    }

    return result;
  }

  /**
   * 驗證交易中的資源
   */
  validateTradeResources(resources, direction, context) {
    const result = new ValidationResult(true);

    Object.keys(resources).forEach((type) => {
      const amount = resources[type];
      
      if (typeof amount !== "number") {
        result.addError(
          `${context}: ${direction}資源 ${type} 必須是數值`,
          `${direction}.${type}`,
          "INVALID_TRADE_RESOURCE_TYPE",
          context
        );
      } else if (amount <= 0) {
        result.addError(
          `${context}: ${direction}資源 ${type} 必須是正數`,
          `${direction}.${type}`,
          "INVALID_TRADE_RESOURCE_AMOUNT",
          context
        );
      } else if (!isFinite(amount)) {
        result.addError(
          `${context}: ${direction}資源 ${type} 必須是有限數值`,
          `${direction}.${type}`,
          "INFINITE_TRADE_RESOURCE_AMOUNT",
          context
        );
      }
    });

    return result;
  }

  /**
   * 驗證交易平衡性
   */
  validateTradeBalance(give, receive, context) {
    const result = new ValidationResult(true);

    // 計算交易價值
    const rates = { food: 1.5, materials: 3, medical: 4, fuel: 3, cash: 1 };
    
    const giveValue = Object.keys(give).reduce((sum, type) => {
      return sum + (give[type] || 0) * (rates[type] || 1);
    }, 0);

    const receiveValue = Object.keys(receive).reduce((sum, type) => {
      return sum + (receive[type] || 0) * (rates[type] || 1);
    }, 0);

    // 檢查交易比例（允許合理範圍內的不平衡）
    if (giveValue > 0 && receiveValue > 0) {
      const ratio = Math.max(giveValue, receiveValue) / Math.min(giveValue, receiveValue);
      
      if (ratio > 3) {
        result.addWarning(
          `${context}: 交易價值比例失衡 (付出價值: ${giveValue}, 獲得價值: ${receiveValue})`,
          "tradeBalance",
          "UNBALANCED_TRADE_RATIO",
          context
        );
      }
    }

    return result;
  }

  /**
   * 驗證資源閾值配置
   */
  validateResourceThresholds(thresholds) {
    const result = new ValidationResult(true);
    const context = "資源閾值配置";

    if (!thresholds || typeof thresholds !== "object") {
      return result.addError(
        "資源閾值配置必須是物件",
        "thresholds",
        "INVALID_THRESHOLDS_TYPE",
        context
      );
    }

    const requiredCategories = ["warning", "critical"];
    const optionalCategories = ["abundant"];

    // 檢查必要類別
    requiredCategories.forEach((category) => {
      if (!thresholds[category] || typeof thresholds[category] !== "object") {
        result.addError(
          `缺少 ${category} 閾值配置`,
          `thresholds.${category}`,
          "MISSING_THRESHOLD_CATEGORY",
          context
        );
      }
    });

    // 檢查所有類別的數值
    [...requiredCategories, ...optionalCategories].forEach((category) => {
      if (thresholds[category]) {
        const categoryResult = this.validateThresholdCategory(thresholds[category], category, context);
        result.merge(categoryResult);
      }
    });

    return result;
  }

  /**
   * 驗證閾值類別
   */
  validateThresholdCategory(categoryThresholds, categoryName, context) {
    const result = new ValidationResult(true);
    const resourceTypes = ["food", "materials", "medical", "fuel", "cash"];

    resourceTypes.forEach((type) => {
      if (categoryThresholds[type] !== undefined) {
        const value = categoryThresholds[type];
        
        if (typeof value !== "number") {
          result.addError(
            `${context}: ${categoryName}.${type} 必須是數值`,
            `thresholds.${categoryName}.${type}`,
            "INVALID_THRESHOLD_VALUE_TYPE",
            context
          );
        } else if (value < 0) {
          result.addError(
            `${context}: ${categoryName}.${type} 不能為負數`,
            `thresholds.${categoryName}.${type}`,
            "NEGATIVE_THRESHOLD_VALUE",
            context
          );
        }
      }
    });

    return result;
  }
}

/**
 * 遊戲狀態實例驗證器
 */
export class GameStateInstanceValidator extends InstanceValidator {
  constructor() {
    super("GameStateInstanceValidator");
  }

  /**
   * 驗證遊戲狀態實例
   */
  validateGameState(gameState) {
    const result = new ValidationResult(true);
    const context = "遊戲狀態";

    // 必要欄位檢查
    const requiredFields = ["day", "resources", "rooms"];
    const structureResult = this.validateObjectStructure(
      gameState,
      requiredFields
    );
    result.merge(structureResult);

    if (!result.isValid) return result;

    // 天數驗證
    if (typeof gameState.day !== "number" || gameState.day < 1) {
      result.addError(
        `${context}: day 必須是正整數`,
        "day",
        "INVALID_DAY",
        context
      );
    }

    // 資源驗證
    if (gameState.resources) {
      const resourceResult = this.validateResourcesInstance(
        gameState.resources,
        context
      );
      result.merge(resourceResult);
    }

    // 房間驗證
    if (gameState.rooms) {
      const roomResult = this.validateRoomsInstance(gameState.rooms, context);
      result.merge(roomResult);
    }

    return result;
  }

  /**
   * 驗證資源實例
   */
  validateResourcesInstance(resources, context) {
    const result = new ValidationResult(true);

    if (typeof resources !== "object" || resources === null) {
      return result.addError(
        `${context}: resources 必須是物件`,
        "resources",
        "INVALID_RESOURCES_TYPE",
        context
      );
    }

    const resourceKeys = ["food", "materials", "medical", "fuel", "cash"];

    resourceKeys.forEach((key) => {
      if (resources[key] !== undefined) {
        if (typeof resources[key] !== "number") {
          result.addError(
            `${context}: resources.${key} 必須是數值`,
            `resources.${key}`,
            "INVALID_RESOURCE_TYPE",
            context
          );
        } else if (resources[key] < 0) {
          result.addWarning(
            `${context}: resources.${key} 為負值，可能影響遊戲平衡`,
            `resources.${key}`,
            "NEGATIVE_RESOURCE_VALUE",
            context
          );
        }
      }
    });

    return result;
  }

  /**
   * 驗證房間實例
   */
  validateRoomsInstance(rooms, context) {
    const result = new ValidationResult(true);

    if (!Array.isArray(rooms)) {
      return result.addError(
        `${context}: rooms 必須是陣列`,
        "rooms",
        "INVALID_ROOMS_TYPE",
        context
      );
    }

    rooms.forEach((room, index) => {
      const roomResult = this.validateSingleRoomInstance(
        room,
        `${context} 房間 ${index}`
      );
      result.merge(roomResult);
    });

    return result;
  }

  /**
   * 驗證單一房間實例
   */
  validateSingleRoomInstance(room, context) {
    const result = new ValidationResult(true);

    // 必要欄位檢查
    const requiredFields = ["id"];
    const structureResult = this.validateObjectStructure(room, requiredFields);
    result.merge(structureResult);

    if (!result.isValid) return result;

    // 房間ID驗證
    if (typeof room.id !== "number" || room.id < 1) {
      result.addError(
        `${context}: 房間ID必須是正整數`,
        "id",
        "INVALID_ROOM_ID",
        context
      );
    }

    // 如果有租客，驗證租客資料
    if (room.tenant) {
      const tenantValidator = new TenantInstanceValidator();
      const tenantResult = tenantValidator.validateTenant(room.tenant);
      result.merge(tenantResult);
    }

    return result;
  }
}

// ==================== 驗證工廠（重構版） ====================

/**
 * 驗證工廠 - 統一創建和管理驗證器（重構版）
 * 支援配置驗證器和實例驗證器的分離管理
 */
export class ValidatorFactory {
  constructor() {
    this.configValidators = new Map();
    this.instanceValidators = new Map();
    this.registerDefaultValidators();
  }

  /**
   * 註冊預設驗證器
   */
  registerDefaultValidators() {
    // 配置驗證器
    this.configValidators.set("tenants", new TenantConfigValidator());
    this.configValidators.set("skills", new SkillConfigValidator());
    this.configValidators.set("events", new EventConfigValidator());
    this.configValidators.set("rules", new RuleConfigValidator());

    // 實例驗證器
    this.instanceValidators.set("tenant", new TenantInstanceValidator());
    this.instanceValidators.set("resource", new ResourceInstanceValidator());
    this.instanceValidators.set("gameState", new GameStateInstanceValidator());
  }

  /**
   * 取得配置驗證器
   */
  getConfigValidator(type) {
    return this.configValidators.get(type);
  }

  /**
   * 取得實例驗證器
   */
  getInstanceValidator(type) {
    return this.instanceValidators.get(type);
  }

  /**
   * 取得驗證器（向後相容）
   */
  getValidator(type) {
    // 優先返回配置驗證器以保持向後相容性
    return this.getConfigValidator(type) || this.getInstanceValidator(type);
  }

  /**
   * 註冊配置驗證器
   */
  registerConfigValidator(type, validator) {
    if (!(validator instanceof ConfigValidator)) {
      throw new Error("配置驗證器必須繼承 ConfigValidator 類別");
    }
    this.configValidators.set(type, validator);
  }

  /**
   * 註冊實例驗證器
   */
  registerInstanceValidator(type, validator) {
    if (!(validator instanceof InstanceValidator)) {
      throw new Error("實例驗證器必須繼承 InstanceValidator 類別");
    }
    this.instanceValidators.set(type, validator);
  }

  /**
   * 執行配置驗證
   */
  validateConfig(type, configData) {
    const validator = this.getConfigValidator(type);

    if (!validator) {
      return new ValidationResult(false).addError(
        `找不到 ${type} 類型的配置驗證器`,
        null,
        "CONFIG_VALIDATOR_NOT_FOUND"
      );
    }

    try {
      // 根據配置類型選擇適當的驗證方法
      switch (type) {
        case "tenants":
          return validator.validateTenantConfig(configData);
        case "skills":
          return validator.validateSkillConfig(configData);
        case "events":
          return validator.validateEventConfig(configData);
        case "rules":
          return validator.validateRuleConfig(configData);
        default:
          return validator.validate(configData);
      }
    } catch (error) {
      return new ValidationResult(false).addError(
        `配置驗證過程發生錯誤: ${error.message}`,
        null,
        "CONFIG_VALIDATION_ERROR"
      );
    }
  }

  /**
   * 執行實例驗證
   */
  validateInstance(type, instanceData) {
    const validator = this.getInstanceValidator(type);

    if (!validator) {
      return new ValidationResult(false).addError(
        `找不到 ${type} 類型的實例驗證器`,
        null,
        "INSTANCE_VALIDATOR_NOT_FOUND"
      );
    }

    try {
      // 根據實例類型選擇適當的驗證方法
      switch (type) {
        case "tenant":
          // 檢查是否為申請者或租客
          if (instanceData.moveInDate !== undefined) {
            return validator.validateTenant(instanceData);
          } else {
            return validator.validateApplicant(instanceData);
          }
        case "gameState":
          return validator.validateGameState(instanceData);
        default:
          return validator.validate(instanceData);
      }
    } catch (error) {
      return new ValidationResult(false).addError(
        `實例驗證過程發生錯誤: ${error.message}`,
        null,
        "INSTANCE_VALIDATION_ERROR"
      );
    }
  }

  /**
   * 執行驗證（向後相容）
   */
  validate(type, data) {
    // 優先嘗試配置驗證，然後嘗試實例驗證
    const configResult = this.validateConfig(type, data);

    if (
      configResult.isValid ||
      configResult.errors.some((e) => e.code !== "CONFIG_VALIDATOR_NOT_FOUND")
    ) {
      return configResult;
    }

    // 如果配置驗證器不存在，嘗試實例驗證器
    return this.validateInstance(type, data);
  }

  /**
   * 批次配置驗證
   */
  validateMultipleConfigs(configMap) {
    const results = {};

    Object.entries(configMap).forEach(([type, data]) => {
      results[type] = this.validateConfig(type, data);
    });

    return results;
  }

  /**
   * 批次實例驗證
   */
  validateMultipleInstances(instanceMap) {
    const results = {};

    Object.entries(instanceMap).forEach(([type, data]) => {
      results[type] = this.validateInstance(type, data);
    });

    return results;
  }

  /**
   * 批次驗證（向後相容）
   */
  validateMultiple(dataMap) {
    return this.validateMultipleConfigs(dataMap);
  }

  /**
   * 取得所有可用的驗證器類型
   */
  getAvailableTypes() {
    return {
      config: Array.from(this.configValidators.keys()),
      instance: Array.from(this.instanceValidators.keys()),
      all: Array.from(
        new Set([
          ...this.configValidators.keys(),
          ...this.instanceValidators.keys(),
        ])
      ),
    };
  }

  /**
   * 取得驗證器統計資訊
   */
  getStats() {
    return {
      configValidators: this.configValidators.size,
      instanceValidators: this.instanceValidators.size,
      total: this.configValidators.size + this.instanceValidators.size,
      types: this.getAvailableTypes(),
    };
  }
}

/**
 * 驗證工具函數（保持不變）
 */
export class ValidationUtils {
  /**
   * 檢查物件是否有指定屬性
   */
  static hasProperty(obj, path) {
    return (
      path
        .split(".")
        .reduce(
          (current, key) => current && current[key] !== undefined,
          obj
        ) !== undefined
    );
  }

  /**
   * 檢查值是否在指定範圍內
   */
  static inRange(value, min, max) {
    return typeof value === "number" && value >= min && value <= max;
  }

  /**
   * 檢查陣列是否包含指定元素
   */
  static arrayContains(array, element) {
    return Array.isArray(array) && array.includes(element);
  }

  /**
   * 檢查字串是否符合正則表達式
   */
  static matchesPattern(str, pattern) {
    return typeof str === "string" && pattern.test(str);
  }

  /**
   * 深度比較兩個物件
   */
  static deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== typeof obj2) return false;
    if (typeof obj1 !== "object") return obj1 === obj2;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every(
      (key) =>
        keys2.includes(key) && ValidationUtils.deepEqual(obj1[key], obj2[key])
    );
  }

  /**
   * 格式化驗證結果為可讀字串
   */
  static formatValidationResult(result) {
    if (!(result instanceof ValidationResult)) {
      return "無效的驗證結果物件";
    }

    let output = `驗證結果: ${result.isValid ? "✅ 通過" : "❌ 失敗"}\n`;

    if (result.context) {
      output += `驗證範圍: ${result.context}\n`;
    }

    if (result.errors.length > 0) {
      output += "\n錯誤:\n";
      result.errors.forEach((error, index) => {
        output += `  ${index + 1}. ${error.message}`;
        if (error.field) output += ` (欄位: ${error.field})`;
        if (error.code) output += ` [${error.code}]`;
        if (error.context) output += ` {${error.context}}`;
        output += "\n";
      });
    }

    if (result.warnings.length > 0) {
      output += "\n警告:\n";
      result.warnings.forEach((warning, index) => {
        output += `  ${index + 1}. ${warning.message}`;
        if (warning.field) output += ` (欄位: ${warning.field})`;
        if (warning.code) output += ` [${warning.code}]`;
        if (warning.context) output += ` {${warning.context}}`;
        output += "\n";
      });
    }

    return output;
  }

  /**
   * 驗證結果摘要
   */
  static summarizeValidationResults(results) {
    const summary = {
      total: Object.keys(results).length,
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: 0,
    };

    Object.values(results).forEach((result) => {
      if (result.isValid) {
        summary.passed++;
      } else {
        summary.failed++;
      }
      summary.warnings += result.warnings.length;
      summary.errors += result.errors.length;
    });

    return summary;
  }
}

// 建立並匯出預設驗證器工廠實例
export const defaultValidatorFactory = new ValidatorFactory();

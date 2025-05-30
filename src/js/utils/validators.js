/**
 * Validators - 統一資料驗證模組
 * 職責：
 * 1. 提供可重用的資料驗證邏輯
 * 2. 統一驗證介面和錯誤處理
 * 3. 支援擴展性驗證規則
 * 4. 分離驗證邏輯與業務邏輯
 *
 * 設計模式：策略模式 + 工廠模式
 * 核心特性：類型安全、錯誤追蹤、可擴展驗證規則
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
  }

  addError(message, field = null, code = null) {
    this.errors.push({ message, field, code, timestamp: Date.now() });
    this.isValid = false;
    return this;
  }

  addWarning(message, field = null, code = null) {
    this.warnings.push({ message, field, code, timestamp: Date.now() });
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
}

/**
 * 基礎驗證器抽象類
 */
export class BaseValidator {
  constructor(name) {
    this.name = name;
    this.rules = [];
  }

  /**
   * 添加驗證規則
   */
  addRule(predicate, errorMessage, field = null, code = null) {
    this.rules.push({ predicate, errorMessage, field, code });
    return this;
  }

  /**
   * 執行驗證
   */
  validate(data) {
    const result = new ValidationResult(true);

    this.rules.forEach((rule) => {
      try {
        if (!rule.predicate(data)) {
          result.addError(rule.errorMessage, rule.field, rule.code);
        }
      } catch (error) {
        result.addError(
          `驗證規則執行失敗: ${error.message}`,
          rule.field,
          "RULE_EXECUTION_ERROR"
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
    return this;
  }
}

/**
 * 租客資料驗證器
 */
export class TenantValidator extends BaseValidator {
  constructor() {
    super("TenantValidator");
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    // 基本結構驗證
    this.addRule(
      (data) => Array.isArray(data),
      "租客資料必須是陣列格式",
      null,
      "INVALID_DATA_TYPE"
    );

    return this;
  }

  /**
   * 驗證租客陣列
   */
  validateTenantArray(tenants) {
    const result = this.validate(tenants);

    if (!result.isValid) {
      return result;
    }

    // 驗證每個租客
    tenants.forEach((tenant, index) => {
      const tenantResult = this.validateSingleTenant(tenant, index);
      result.merge(tenantResult);
    });

    return result;
  }

  /**
   * 驗證單一租客
   */
  validateSingleTenant(tenant, index = 0) {
    const result = new ValidationResult(true);

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
      if (!(field in tenant)) {
        result.addError(
          `租客 ${index}: 缺少必要欄位 ${field}`,
          field,
          "MISSING_REQUIRED_FIELD"
        );
      }
    });

    // 資料類型驗證
    if (typeof tenant.rent !== "number" || tenant.rent <= 0) {
      result.addError(
        `租客 ${index}: 房租必須是正數`,
        "rent",
        "INVALID_RENT_VALUE"
      );
    }

    if (
      typeof tenant.infectionRisk !== "number" ||
      tenant.infectionRisk < 0 ||
      tenant.infectionRisk > 1
    ) {
      result.addError(
        `租客 ${index}: 感染風險必須是 0-1 之間的數值`,
        "infectionRisk",
        "INVALID_INFECTION_RISK"
      );
    }

    // 個人資源結構驗證
    if (tenant.personalResources) {
      const resourceResult = this.validatePersonalResources(
        tenant.personalResources,
        index
      );
      result.merge(resourceResult);
    }

    // 技能ID驗證
    if (tenant.skillIds && !Array.isArray(tenant.skillIds)) {
      result.addError(
        `租客 ${index}: skillIds 必須是陣列`,
        "skillIds",
        "INVALID_SKILL_IDS"
      );
    }

    return result;
  }

  /**
   * 驗證個人資源結構
   */
  validatePersonalResources(resources, tenantIndex) {
    const result = new ValidationResult(true);
    const resourceKeys = ["food", "materials", "medical", "fuel", "cash"];

    resourceKeys.forEach((key) => {
      if (resources[key] !== undefined && typeof resources[key] !== "number") {
        result.addError(
          `租客 ${tenantIndex}: personalResources.${key} 必須是數值`,
          `personalResources.${key}`,
          "INVALID_RESOURCE_TYPE"
        );
      }

      if (resources[key] !== undefined && resources[key] < 0) {
        result.addWarning(
          `租客 ${tenantIndex}: personalResources.${key} 為負值`,
          `personalResources.${key}`,
          "NEGATIVE_RESOURCE_VALUE"
        );
      }
    });

    return result;
  }
}

/**
 * 技能資料驗證器
 */
export class SkillValidator extends BaseValidator {
  constructor() {
    super("SkillValidator");
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    this.addRule(
      (data) => typeof data === "object" && data !== null,
      "技能資料必須是物件格式",
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

    if (!result.isValid) {
      return result;
    }

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

    if (!Array.isArray(skills)) {
      result.addError(
        `租客類型 ${tenantType} 的技能資料必須是陣列`,
        tenantType,
        "INVALID_SKILLS_TYPE"
      );
      return result;
    }

    skills.forEach((skill, index) => {
      const skillResult = this.validateSingleSkill(skill, tenantType, index);
      result.merge(skillResult);
    });

    return result;
  }

  /**
   * 驗證單一技能
   */
  validateSingleSkill(skill, tenantType, index) {
    const result = new ValidationResult(true);

    // 必要欄位檢查
    const requiredFields = ["id", "name", "type", "description"];
    requiredFields.forEach((field) => {
      if (!(field in skill)) {
        result.addError(
          `${tenantType} 技能 ${index}: 缺少必要欄位 ${field}`,
          field,
          "MISSING_REQUIRED_FIELD"
        );
      }
    });

    // 技能類型驗證
    const validTypes = ["active", "passive", "special"];
    if (!validTypes.includes(skill.type)) {
      result.addError(
        `${tenantType} 技能 ${index}: 技能類型必須是 ${validTypes.join(
          ", "
        )} 之一`,
        "type",
        "INVALID_SKILL_TYPE"
      );
    }

    // 成本結構驗證
    if (skill.cost) {
      const costResult = this.validateSkillCost(skill.cost, tenantType, index);
      result.merge(costResult);
    }

    // 冷卻時間驗證
    if (
      skill.cooldown !== undefined &&
      (typeof skill.cooldown !== "number" || skill.cooldown < -1)
    ) {
      result.addError(
        `${tenantType} 技能 ${index}: 冷卻時間必須是 >= -1 的數值`,
        "cooldown",
        "INVALID_COOLDOWN"
      );
    }

    // 效果驗證
    if (skill.effects && !Array.isArray(skill.effects)) {
      result.addError(
        `${tenantType} 技能 ${index}: effects 必須是陣列`,
        "effects",
        "INVALID_EFFECTS_TYPE"
      );
    }

    return result;
  }

  /**
   * 驗證技能成本
   */
  validateSkillCost(cost, tenantType, skillIndex) {
    const result = new ValidationResult(true);

    if (typeof cost !== "object" || cost === null) {
      result.addError(
        `${tenantType} 技能 ${skillIndex}: cost 必須是物件`,
        "cost",
        "INVALID_COST_TYPE"
      );
      return result;
    }

    Object.entries(cost).forEach(([resource, amount]) => {
      if (typeof amount !== "number" || amount < 0) {
        result.addError(
          `${tenantType} 技能 ${skillIndex}: 成本 ${resource} 必須是非負數`,
          `cost.${resource}`,
          "INVALID_COST_VALUE"
        );
      }
    });

    return result;
  }
}

/**
 * 事件資料驗證器
 */
export class EventValidator extends BaseValidator {
  constructor() {
    super("EventValidator");
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    this.addRule(
      (data) => typeof data === "object" && data !== null,
      "事件資料必須是物件格式",
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

    if (!result.isValid) {
      return result;
    }

    // 驗證必要分類
    const requiredCategories = [
      "random_events",
      "conflict_events",
      "special_events",
    ];

    requiredCategories.forEach((category) => {
      if (!eventData[category] || !Array.isArray(eventData[category])) {
        result.addError(
          `事件資料缺少 ${category} 分類或格式錯誤`,
          category,
          "MISSING_EVENT_CATEGORY"
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

    events.forEach((event, index) => {
      const eventResult = this.validateSingleEvent(event, category, index);
      result.merge(eventResult);
    });

    return result;
  }

  /**
   * 驗證單一事件
   */
  validateSingleEvent(event, category, index) {
    const result = new ValidationResult(true);

    // 基本欄位檢查
    ["id", "title", "description"].forEach((field) => {
      if (!(field in event)) {
        result.addError(
          `${category} 事件 ${index}: 缺少必要欄位 ${field}`,
          field,
          "MISSING_REQUIRED_FIELD"
        );
      }
    });

    // 必須有 choices 或 dynamicChoices
    const hasChoices = "choices" in event;
    const hasDynamic = "dynamicChoices" in event;

    if (!hasChoices && !hasDynamic) {
      result.addError(
        `${category} 事件 ${index}: 必須包含 choices 或 dynamicChoices 其中之一`,
        "choices",
        "MISSING_CHOICES"
      );
    }

    // 驗證 choices 格式
    if (hasChoices && !Array.isArray(event.choices)) {
      result.addError(
        `${category} 事件 ${index}: choices 必須是陣列`,
        "choices",
        "INVALID_CHOICES_TYPE"
      );
    }

    // 驗證 dynamicChoices 格式
    if (hasDynamic) {
      const dynamicResult = this.validateDynamicChoices(
        event.dynamicChoices,
        category,
        index
      );
      result.merge(dynamicResult);
    }

    return result;
  }

  /**
   * 驗證動態選擇結構
   */
  validateDynamicChoices(dynamicChoices, category, eventIndex) {
    const result = new ValidationResult(true);

    if (!dynamicChoices || typeof dynamicChoices !== "object") {
      result.addError(
        `${category} 事件 ${eventIndex}: dynamicChoices 必須是物件`,
        "dynamicChoices",
        "INVALID_DYNAMIC_CHOICES_TYPE"
      );
      return result;
    }

    // base 是必要的
    if (!Array.isArray(dynamicChoices.base)) {
      result.addError(
        `${category} 事件 ${eventIndex}: dynamicChoices.base 必須是陣列`,
        "dynamicChoices.base",
        "INVALID_BASE_CHOICES"
      );
    }

    // conditional 是可選的，但如果存在必須是陣列
    if (
      "conditional" in dynamicChoices &&
      !Array.isArray(dynamicChoices.conditional)
    ) {
      result.addError(
        `${category} 事件 ${eventIndex}: dynamicChoices.conditional 必須是陣列`,
        "dynamicChoices.conditional",
        "INVALID_CONDITIONAL_CHOICES"
      );
    }

    return result;
  }
}

/**
 * 規則資料驗證器
 */
export class RuleValidator extends BaseValidator {
  constructor() {
    super("RuleValidator");
    this.setupDefaultRules();
  }

  setupDefaultRules() {
    this.addRule(
      (data) => typeof data === "object" && data !== null,
      "規則資料必須是物件格式",
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

    if (!result.isValid) {
      return result;
    }

    // 驗證必要區塊
    const requiredSections = ["gameBalance", "mechanics", "progression"];
    requiredSections.forEach((section) => {
      if (!(section in ruleData)) {
        result.addError(
          `規則資料缺少必要區塊: ${section}`,
          section,
          "MISSING_REQUIRED_SECTION"
        );
      }
    });

    // 驗證 gameBalance 結構
    if (ruleData.gameBalance) {
      const balanceResult = this.validateGameBalance(ruleData.gameBalance);
      result.merge(balanceResult);
    }

    return result;
  }

  /**
   * 驗證遊戲平衡配置
   */
  validateGameBalance(gameBalance) {
    const result = new ValidationResult(true);

    // 驗證房東配置
    if (gameBalance.landlord && gameBalance.landlord.hungerSystem) {
      const hungerSystem = gameBalance.landlord.hungerSystem;

      if (!hungerSystem.levels || !Array.isArray(hungerSystem.levels)) {
        result.addError(
          "規則資料: landlord.hungerSystem.levels 必須是陣列",
          "landlord.hungerSystem.levels",
          "INVALID_HUNGER_LEVELS"
        );
      }
    }

    // 驗證租客配置
    if (gameBalance.tenants && gameBalance.tenants.satisfactionSystem) {
      const satisfactionSystem = gameBalance.tenants.satisfactionSystem;

      if (typeof satisfactionSystem.baseValue !== "number") {
        result.addError(
          "規則資料: tenants.satisfactionSystem.baseValue 必須是數值",
          "tenants.satisfactionSystem.baseValue",
          "INVALID_BASE_VALUE"
        );
      }
    }

    return result;
  }
}

/**
 * 驗證工廠 - 統一創建和管理驗證器
 */
export class ValidatorFactory {
  constructor() {
    this.validators = new Map();
    this.registerDefaultValidators();
  }

  /**
   * 註冊預設驗證器
   */
  registerDefaultValidators() {
    this.validators.set("tenants", new TenantValidator());
    this.validators.set("skills", new SkillValidator());
    this.validators.set("events", new EventValidator());
    this.validators.set("rules", new RuleValidator());
  }

  /**
   * 取得驗證器
   */
  getValidator(type) {
    return this.validators.get(type);
  }

  /**
   * 註冊自定義驗證器
   */
  registerValidator(type, validator) {
    if (!(validator instanceof BaseValidator)) {
      throw new Error("驗證器必須繼承 BaseValidator 類別");
    }
    this.validators.set(type, validator);
  }

  /**
   * 執行驗證
   */
  validate(type, data) {
    const validator = this.getValidator(type);

    if (!validator) {
      return new ValidationResult(false).addError(
        `找不到 ${type} 類型的驗證器`,
        null,
        "VALIDATOR_NOT_FOUND"
      );
    }

    try {
      // 根據資料類型選擇適當的驗證方法
      switch (type) {
        case "tenants":
          return validator.validateTenantArray(data);
        case "skills":
          return validator.validateSkillConfig(data);
        case "events":
          return validator.validateEventConfig(data);
        case "rules":
          return validator.validateRuleConfig(data);
        default:
          return validator.validate(data);
      }
    } catch (error) {
      return new ValidationResult(false).addError(
        `驗證過程發生錯誤: ${error.message}`,
        null,
        "VALIDATION_ERROR"
      );
    }
  }

  /**
   * 批次驗證
   */
  validateMultiple(dataMap) {
    const results = {};

    Object.entries(dataMap).forEach(([type, data]) => {
      results[type] = this.validate(type, data);
    });

    return results;
  }

  /**
   * 取得所有可用的驗證器類型
   */
  getAvailableTypes() {
    return Array.from(this.validators.keys());
  }
}

/**
 * 驗證工具函數
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

    if (result.errors.length > 0) {
      output += "\n錯誤:\n";
      result.errors.forEach((error, index) => {
        output += `  ${index + 1}. ${error.message}`;
        if (error.field) output += ` (欄位: ${error.field})`;
        if (error.code) output += ` [${error.code}]`;
        output += "\n";
      });
    }

    if (result.warnings.length > 0) {
      output += "\n警告:\n";
      result.warnings.forEach((warning, index) => {
        output += `  ${index + 1}. ${warning.message}`;
        if (warning.field) output += ` (欄位: ${warning.field})`;
        if (warning.code) output += ` [${warning.code}]`;
        output += "\n";
      });
    }

    return output;
  }
}

// 建立並匯出預設驗證器工廠實例
export const defaultValidatorFactory = new ValidatorFactory();

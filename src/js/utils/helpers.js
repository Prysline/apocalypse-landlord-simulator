/**
 * Game Utilities - 配置驅動的遊戲輔助函數模組
 * 重構原則：所有資料來源於 rules.json，helpers.js 只負責邏輯轉換
 *
 * 設計模式：策略模式 + 工廠模式
 * 核心特性：配置驅動、格式化工具、隨機生成、狀態計算
 */

export class GameHelpers {
  constructor(rulesConfig = null) {
    this.config = rulesConfig;
    this.initialized = false;

    // 快取常用的配置區塊
    this.colorSchemes = {};
    this.contentConfig = {};
    this.balanceConfig = {};
    this.mechanicsConfig = {};

    // 如果有配置就立即初始化，否則等待注入
    if (rulesConfig) {
      this.initialize();
    }
  }

  /**
   * 初始化配置驅動的輔助函數
   */
  initialize() {
    if (!this.config) {
      console.warn("⚠️ GameHelpers: 配置未載入，使用預設實作");
      return false;
    }

    // 快取常用的配置區塊
    this.colorSchemes = this.config.ui?.colorSchemes || {};
    this.contentConfig = this.config.content || {};
    this.balanceConfig = this.config.gameBalance || {};
    this.mechanicsConfig = this.config.mechanics || {};

    this.initialized = true;
    console.log("✅ GameHelpers: 配置驅動模式已啟用");
    return true;
  }

  /**
   * 注入配置（用於 DataManager 載入完成後）
   */
  injectConfig(rulesConfig) {
    this.config = rulesConfig;
    return this.initialize();
  }

  // ==================== 狀態格式化系統 ====================

  /**
   * 通用的等級狀態格式化器
   */
  formatLevelStatus(value, levelConfig, displayFormat = "withValue") {
    if (!this.initialized || !levelConfig?.levels) {
      return this._fallbackFormat(value, "unknown");
    }

    // 找到對應的等級（從高到低檢查）
    const level =
      levelConfig.levels
        .sort((a, b) => b.threshold - a.threshold)
        .find((l) => value >= l.threshold) || levelConfig.levels[0];

    const color = this.getColorBySeverity(level.severity);

    const formats = {
      withValue: `${level.name}(${value})`,
      nameOnly: level.name,
      withEmoji: level.emoji ? `${level.emoji} ${level.name}` : level.name,
      full: `${level.emoji || ""} ${level.name}(${value})`,
    };

    return {
      text: formats[displayFormat] || formats.withValue,
      color: color,
      level: level.name,
      severity: level.severity,
      emoji: level.emoji || "",
      critical: ["critical", "fatal", "danger"].includes(level.severity),
    };
  }

  /**
   * 防禦狀態格式化
   */
  getDefenseStatus(defense) {
    const defenseConfig = this.mechanicsConfig.building?.defenseSystem;
    return this.formatLevelStatus(defense, defenseConfig, "withValue");
  }

  /**
   * 飢餓狀態格式化
   */
  getHungerStatus(hunger) {
    const hungerConfig = this.balanceConfig.landlord?.hungerSystem;
    return this.formatLevelStatus(hunger, hungerConfig, "withValue");
  }

  /**
   * 滿意度狀態格式化
   */
  getSatisfactionStatus(satisfaction) {
    const satisfactionConfig =
      this.balanceConfig.tenants?.satisfactionSystem?.display;
    return this.formatLevelStatus(
      satisfaction,
      satisfactionConfig,
      "withEmoji"
    );
  }

  /**
   * 根據嚴重程度取得顏色
   */
  getColorBySeverity(severity) {
    return this.colorSchemes[severity] || this.colorSchemes.normal || "#ffcc66";
  }

  // ==================== 名稱生成系統 ====================

  /**
   * 生成隨機姓名
   */
  generateName(type = "nickname") {
    if (!this.initialized || !this.contentConfig.nameGeneration) {
      return this._fallbackNameGeneration(type);
    }

    const { surnames, givenNames, nicknames } =
      this.contentConfig.nameGeneration;

    switch (type) {
      case "full":
        return this._randomSelect(surnames) + this._randomSelect(givenNames);
      case "formal":
        return `${this._randomSelect(surnames)}${this._randomSelect(
          givenNames
        )}先生/女士`;
      case "nickname":
      default:
        return this._randomSelect(nicknames);
    }
  }

  /**
   * 生成唯一姓名
   */
  generateUniqueName(existingNames = [], type = "nickname", maxAttempts = 50) {
    let attempts = 0;
    let name;

    do {
      name = this.generateName(type);
      attempts++;

      if (attempts >= maxAttempts) {
        name = `${this.generateName(type)}${Math.floor(Math.random() * 1000)}`;
        break;
      }
    } while (existingNames.includes(name));

    return name;
  }

  // ==================== 外觀描述系統 ====================

  /**
   * 獲取正常外觀描述
   */
  getNormalAppearance() {
    if (
      !this.initialized ||
      !this.contentConfig.appearanceDescriptions?.normal
    ) {
      return this._fallbackAppearance("normal");
    }
    return this._randomSelect(this.contentConfig.appearanceDescriptions.normal);
  }

  /**
   * 獲取感染外觀描述
   */
  getInfectedAppearance() {
    if (
      !this.initialized ||
      !this.contentConfig.appearanceDescriptions?.infected
    ) {
      return this._fallbackAppearance("infected");
    }
    return this._randomSelect(
      this.contentConfig.appearanceDescriptions.infected
    );
  }

  /**
   * 基於健康狀態獲取外觀描述
   */
  getAppearanceByHealth(isInfected, healthLevel = 100) {
    if (isInfected) {
      return this.getInfectedAppearance();
    }

    if (healthLevel < 30) {
      return "看起來身體虛弱，需要休息";
    } else if (healthLevel < 60) {
      return "精神略顯疲憊，但還算健康";
    } else {
      return this.getNormalAppearance();
    }
  }

  // ==================== 數值計算與驗證 ====================

  /**
   * 安全的數值範圍限定
   */
  clamp(value, min, max) {
    if (typeof value !== "number" || isNaN(value)) {
      console.warn(`clamp: 無效的數值 ${value}，使用最小值 ${min}`);
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }

  /**
   * 百分比計算
   */
  calculatePercentage(current, total, precision = 1) {
    if (total === 0) return 0;
    const percentage = (current / total) * 100;
    return (
      Math.round(percentage * Math.pow(10, precision)) / Math.pow(10, precision)
    );
  }

  /**
   * 範圍內隨機整數
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 加權隨機選擇
   */
  weightedRandomSelect(items, weights) {
    if (items.length !== weights.length) {
      throw new Error("物品數量與權重數量不匹配");
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }

    return items[items.length - 1];
  }

  // ==================== 遊戲時間處理 ====================

  /**
   * 格式化遊戲時間
   */
  formatGameTime(day, timeOfDay = "day") {
    const timeText = timeOfDay === "day" ? "白天" : "夜晚";
    return `第 ${day} 天 ${timeText}`;
  }

  /**
   * 計算遊戲週數
   */
  getGameWeek(day) {
    return Math.ceil(day / 7);
  }

  /**
   * 檢查是否為遊戲週末
   */
  isGameWeekend(day) {
    const dayOfWeek = ((day - 1) % 7) + 1;
    return dayOfWeek === 6 || dayOfWeek === 7; // 週六或週日
  }

  // ==================== 遊戲平衡計算 ====================

  /**
   * 計算租客滿意度
   */
  calculateTenantSatisfaction(tenant, room, gameState, globalEffects = {}) {
    if (!this.initialized || !this.balanceConfig.tenants?.satisfactionSystem) {
      return 50; // 預設值
    }

    const system = this.balanceConfig.tenants.satisfactionSystem;
    const factors = system.factors || {};

    let satisfaction = system.baseValue || 50;

    // 房間條件影響
    if (room.reinforced) satisfaction += factors.reinforcedRoom || 0;
    if (room.needsRepair) satisfaction += factors.needsRepair || 0;

    // 個人資源狀況
    if (tenant.personalResources) {
      if (tenant.personalResources.food < 2)
        satisfaction += factors.lowPersonalFood || 0;
      if (tenant.personalResources.cash > 25)
        satisfaction += factors.highPersonalCash || 0;
    }

    // 建築安全
    if (gameState.buildingDefense >= 8)
      satisfaction += factors.highBuildingDefense || 0;
    if (gameState.buildingDefense <= 2)
      satisfaction += factors.lowBuildingDefense || 0;

    // 全局效果
    Object.keys(globalEffects).forEach((effect) => {
      if (globalEffects[effect] && factors[effect]) {
        satisfaction += factors[effect];
      }
    });

    // 限制範圍
    const range = system.range || { min: 0, max: 100 };
    return this.clamp(satisfaction, range.min, range.max);
  }

  /**
   * 計算資源稀缺性
   */
  calculateResourceScarcity(resources, tenantCount = 1) {
    if (!this.initialized || !this.balanceConfig.resources) {
      return { overall: "normal", details: {} };
    }

    const scarcityLevels = {
      abundant: { min: 1.5, label: "充足", color: "#66ff66" },
      normal: { min: 1.0, label: "正常", color: "#ffcc66" },
      low: { min: 0.5, label: "不足", color: "#ff9966" },
      critical: { min: 0, label: "危急", color: "#ff6666" },
    };

    const details = {};
    let overallScore = 1.0;

    Object.keys(resources).forEach((resourceType) => {
      const current = resources[resourceType] || 0;
      const dailyConsumption = this.getDailyConsumption(
        resourceType,
        tenantCount
      );

      if (dailyConsumption > 0) {
        const daysRemaining = current / dailyConsumption;
        const ratio = daysRemaining / 7; // 以一週為基準

        let level = "critical";
        for (const [levelName, config] of Object.entries(scarcityLevels)) {
          if (ratio >= config.min) {
            level = levelName;
            break;
          }
        }

        details[resourceType] = {
          level,
          ratio,
          daysRemaining: Math.floor(daysRemaining),
          ...scarcityLevels[level],
        };

        overallScore = Math.min(overallScore, ratio);
      }
    });

    // 確定整體稀缺等級
    let overallLevel = "critical";
    for (const [levelName, config] of Object.entries(scarcityLevels)) {
      if (overallScore >= config.min) {
        overallLevel = levelName;
        break;
      }
    }

    return {
      overall: overallLevel,
      score: overallScore,
      details,
      ...scarcityLevels[overallLevel],
    };
  }

  /**
   * 取得每日消耗量
   */
  getDailyConsumption(resourceType, tenantCount = 1) {
    if (!this.initialized || !this.balanceConfig) {
      const defaults = { food: 2, fuel: 1, medical: 0.1, materials: 0.1 };
      return (defaults[resourceType] || 0) * Math.max(1, tenantCount);
    }

    const consumption = this.balanceConfig.resources?.dailyConsumption || {};
    const landlordConsumption =
      this.balanceConfig.landlord?.dailyFoodConsumption || 2;
    const tenantConsumption =
      this.balanceConfig.tenants?.dailyFoodConsumption || 2;

    switch (resourceType) {
      case "food":
        return landlordConsumption + tenantConsumption * tenantCount;
      case "fuel":
        return consumption.fuel || 1;
      case "medical":
        return (consumption.medical || 0.1) * tenantCount;
      case "materials":
        return consumption.materials || 0.1;
      default:
        return 0;
    }
  }

  // ==================== 私有輔助方法 ====================

  /**
   * 從陣列中隨機選擇
   */
  _randomSelect(array) {
    if (!Array.isArray(array) || array.length === 0) {
      return "";
    }
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 後備格式化（當配置不可用時）
   */
  _fallbackFormat(value, status) {
    return {
      text: `${status}(${value})`,
      color: "#ffcc66",
      level: status,
      severity: "normal",
      emoji: "",
      critical: false,
    };
  }

  /**
   * 後備名稱生成
   */
  _fallbackNameGeneration(type) {
    const fallbackNames = ["小明", "小華", "小李", "老王", "阿強"];
    return fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
  }

  /**
   * 後備外觀描述
   */
  _fallbackAppearance(type) {
    return type === "infected" ? "狀態可疑" : "看起來還算正常";
  }

  // ==================== 物件工具方法 ====================

  /**
   * 深度複製物件
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item));
    }

    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = this.deepClone(obj[key]);
      }
    }

    return clonedObj;
  }

  /**
   * 安全取得嵌套物件值
   */
  safeGet(obj, path, defaultValue = undefined) {
    const keys = path.split(".");
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return defaultValue;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * 合併物件（深度合併）
   */
  deepMerge(target, source) {
    const result = this.deepClone(target);

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          source[key] &&
          typeof source[key] === "object" &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  // ==================== 字串工具方法 ====================

  /**
   * 首字母大寫
   */
  capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * 格式化數字（添加千分位逗號）
   */
  formatNumber(num, precision = 0) {
    if (typeof num !== "number") return "0";

    const fixed = num.toFixed(precision);
    return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /**
   * 截斷文字
   */
  truncateText(text, maxLength, suffix = "...") {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  // ==================== 除錯與狀態檢查 ====================

  /**
   * 取得當前狀態
   */
  getStatus() {
    return {
      initialized: this.initialized,
      configLoaded: !!this.config,
      availableSections: this.config ? Object.keys(this.config) : [],
      colorSchemesCount: Object.keys(this.colorSchemes).length,
      hasContentConfig: !!this.contentConfig?.nameGeneration,
      hasBalanceConfig: !!this.balanceConfig?.landlord,
      hasMechanicsConfig: !!this.mechanicsConfig?.building,
    };
  }

  /**
   * 驗證配置完整性
   */
  validateConfig() {
    const issues = [];

    if (!this.config) {
      issues.push("配置未載入");
      return issues;
    }

    // 檢查必要區塊
    const requiredSections = ["gameBalance", "mechanics", "content", "ui"];
    requiredSections.forEach((section) => {
      if (!this.config[section]) {
        issues.push(`缺少 ${section} 配置區塊`);
      }
    });

    // 檢查色彩配置
    if (!this.colorSchemes || Object.keys(this.colorSchemes).length === 0) {
      issues.push("缺少色彩配置");
    }

    // 檢查名稱生成配置
    if (!this.contentConfig?.nameGeneration?.nicknames) {
      issues.push("缺少名稱生成配置");
    }

    // 檢查平衡配置
    if (!this.balanceConfig?.landlord?.hungerSystem) {
      issues.push("缺少房東飢餓系統配置");
    }

    return issues;
  }

  /**
   * 除錯印出
   */
  debugPrint() {
    console.group("🛠️ GameHelpers 狀態");
    console.log("狀態:", this.getStatus());

    const issues = this.validateConfig();
    if (issues.length > 0) {
      console.warn("配置問題:", issues);
    } else {
      console.log("✅ 配置驗證通過");
    }

    console.log("可用方法:", [
      "generateName",
      "getDefenseStatus",
      "getHungerStatus",
      "getSatisfactionStatus",
      "calculateTenantSatisfaction",
      "calculateResourceScarcity",
      "formatGameTime",
    ]);
    console.groupEnd();
  }
}
/**
 * Game Utilities v2.0 - 配置驅動的遊戲輔助函數模組
 * 重構原則：所有遊戲數據來源於 rules.json，提供統一存取介面
 *
 * 設計模式：策略模式 + 適配器模式 + 單例模式
 * 核心特性：配置驅動、統一存取、後備機制、格式化工具
 */

export class GameHelpers {
  constructor(rulesConfig = null) {
    this.config = rulesConfig;
    this.initialized = false;

    // 快取常用的配置區塊
    this.gameDefaults = {};
    this.gameBalance = {};
    this.mechanics = {};
    this.uiConfig = {};
    this.contentConfig = {};

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
      console.warn("⚠️ GameHelpers: 配置未載入，使用最小後備模式");
      this.initializeFallbackMode();
      return false;
    }

    // 快取常用的配置區塊
    this.gameDefaults = this.config.gameDefaults || {};
    this.gameBalance = this.config.gameBalance || {};
    this.mechanics = this.config.mechanics || {};
    this.uiConfig = this.config.ui || {};
    this.contentConfig = this.config.content || {};

    this.initialized = true;
    console.log("✅ GameHelpers: 配置驅動模式已啟用");
    return true;
  }

  /**
   * 初始化後備模式
   */
  initializeFallbackMode() {
    this.gameDefaults = this.getMinimalDefaults();
    this.gameBalance = this.getMinimalBalance();
    this.mechanics = this.getMinimalMechanics();
    this.uiConfig = this.getMinimalUI();
    this.contentConfig = this.getMinimalContent();

    this.initialized = true;
    console.log("🔄 GameHelpers: 後備模式已啟用");
  }

  /**
   * 注入配置（用於 DataManager 載入完成後）
   */
  injectConfig(rulesConfig) {
    this.config = rulesConfig;
    return this.initialize();
  }

  // ==================== 配置數據存取介面 ====================

  /**
   * 統一的配置存取介面
   */
  getConfig(path, defaultValue = undefined) {
    if (!this.initialized) {
      console.warn(`⚠️ GameHelpers 未初始化，無法存取 ${path}`);
      return defaultValue;
    }

    const value = this.safeGet(this.config, path);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * 取得遊戲預設值
   */
  getGameDefault(path, defaultValue = undefined) {
    return this.safeGet(this.gameDefaults, path) ?? defaultValue;
  }

  /**
   * 取得遊戲平衡參數
   */
  getGameBalance(path, defaultValue = undefined) {
    return this.safeGet(this.gameBalance, path) ?? defaultValue;
  }

  /**
   * 取得遊戲機制參數
   */
  getMechanics(path, defaultValue = undefined) {
    return this.safeGet(this.mechanics, path) ?? defaultValue;
  }

  /**
   * 取得UI配置
   */
  getUIConfig(path, defaultValue = undefined) {
    return this.safeGet(this.uiConfig, path) ?? defaultValue;
  }

  /**
   * 取得內容配置
   */
  getContentConfig(path, defaultValue = undefined) {
    return this.safeGet(this.contentConfig, path) ?? defaultValue;
  }

  // ==================== 遊戲初始化支援 ====================

  /**
   * 取得初始遊戲狀態
   */
  getInitialGameState() {
    return {
      day: this.getGameDefault("initialLandlord.day", 1),
      time: this.getGameDefault("initialLandlord.time", "day"),
      resources: {
        ...this.getGameDefault("initialResources", {
          food: 20,
          materials: 15,
          medical: 10,
          fuel: 8,
          cash: 50,
        }),
      },
      landlordHunger: this.getGameDefault("initialLandlord.hunger", 0),
      harvestUsed: this.getGameDefault("initialLandlord.harvestUsed", false),
      harvestCooldown: this.getGameDefault(
        "initialLandlord.harvestCooldown",
        0
      ),
      scavengeUsed: this.getGameDefault("initialLandlord.scavengeUsed", 0),
      maxScavengePerDay: this.getMechanics("scavenging.maxPerDay", 2),
      rentCollected: this.getGameDefault(
        "initialLandlord.rentCollected",
        false
      ),
      buildingDefense: this.getGameDefault(
        "initialLandlord.buildingDefense",
        0
      ),
      tenantSatisfaction: {},

      // 全域效果
      ...this.getGameDefault("initialGlobalEffects", {
        emergencyTraining: false,
        foodPreservation: false,
        patrolSystem: false,
        socialNetwork: false,
        nightWatchActive: false,
        harmoniumBonus: 0,
      }),
    };
  }

  /**
   * 取得初始房間配置
   */
  getInitialRooms() {
    const roomConfig = this.getGameDefault("initialRooms", {
      count: 2,
      defaultState: { needsRepair: false, reinforced: false, tenant: null },
    });

    const rooms = [];
    for (let i = 1; i <= roomConfig.count; i++) {
      rooms.push({
        id: i,
        ...roomConfig.defaultState,
      });
    }

    return rooms;
  }

  // ==================== 狀態格式化系統 ====================

  /**
   * 通用的等級狀態格式化器
   */
  formatLevelStatus(value, levelConfigPath, displayFormat = "withValue") {
    const levelConfig = this.getConfig(levelConfigPath);

    if (!levelConfig?.levels) {
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
    return this.formatLevelStatus(
      defense,
      "mechanics.building.defenseSystem",
      "withValue"
    );
  }

  /**
   * 飢餓狀態格式化
   */
  getHungerStatus(hunger) {
    return this.formatLevelStatus(
      hunger,
      "gameBalance.landlord.hungerSystem",
      "withValue"
    );
  }

  /**
   * 滿意度狀態格式化
   */
  getSatisfactionStatus(satisfaction) {
    return this.formatLevelStatus(
      satisfaction,
      "gameBalance.tenants.satisfactionSystem.display",
      "withEmoji"
    );
  }

  /**
   * 根據嚴重程度取得顏色
   */
  getColorBySeverity(severity) {
    return (
      this.getUIConfig(`colorSchemes.${severity}`) ||
      this.getUIConfig("colorSchemes.normal") ||
      "#ffcc66"
    );
  }

  // ==================== 遊戲參數快速存取 ====================

  /**
   * 取得消耗相關參數
   */
  getConsumption() {
    return {
      landlordDailyFood: this.getGameBalance(
        "landlord.dailyFoodConsumption",
        2
      ),
      tenantDailyFood: this.getGameBalance("tenants.dailyFoodConsumption", 2),
      elderDailyMedical: this.getGameBalance(
        "tenants.elderMedicalConsumption",
        1
      ),
      buildingDailyFuel: this.getGameBalance(
        "resources.dailyConsumption.fuel",
        1
      ),
      harvestBaseAmount: this.getMechanics("harvest.baseAmount", 2),
      farmerHarvestBonus: this.getMechanics("harvest.farmerBonus", 2),
    };
  }

  /**
   * 取得機率相關參數
   */
  getProbabilities() {
    return {
      baseInfectionRisk: this.getMechanics(
        "probability.baseInfectionRisk",
        0.2
      ),
      randomEventChance: this.getMechanics("events.randomEventChance", 0.3),
      conflictBaseChance: this.getMechanics("events.conflictBaseChance", 0.25),
      medicalEmergencyChance: this.getMechanics(
        "probability.medicalEmergencyChance",
        0.15
      ),
      mutualAidChance: this.getMechanics("probability.mutualAidChance", 0.3),
      autoRepairChance: this.getMechanics("probability.autoRepairChance", 0.3),
    };
  }

  /**
   * 取得時間相關參數
   */
  getTimeParameters() {
    return {
      harvestCooldownDays: this.getMechanics("harvest.cooldownDays", 2),
      cropGrowthDays: this.getMechanics("harvest.cropGrowthDays", 3),
      maxScavengePerDay: this.getMechanics("scavenging.maxPerDay", 2),
    };
  }

  /**
   * 取得經濟相關參數
   */
  getEconomicParameters() {
    return {
      reinforcementRentBonus: this.getGameBalance(
        "economy.rentPayment.reinforcementBonus",
        0.2
      ),
      resourceExchangeRates: this.getGameBalance(
        "economy.rentPayment.resourceExchangeRates",
        {
          food: 1.5,
          materials: 3,
          medical: 4,
          fuel: 3,
        }
      ),
      tradeMarkup: this.getGameBalance("economy.trading.trademarkup", 1.2),
    };
  }

  // ==================== 名稱生成系統 ====================

  /**
   * 生成隨機姓名
   */
  generateName(type = "nickname") {
    const nameConfig = this.getContentConfig("nameGeneration");

    if (!nameConfig) {
      return this._fallbackNameGeneration(type);
    }

    const { surnames, givenNames, nicknames } = nameConfig;

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
    const appearances = this.getContentConfig("appearanceDescriptions.normal");
    return appearances
      ? this._randomSelect(appearances)
      : this._fallbackAppearance("normal");
  }

  /**
   * 獲取感染外觀描述
   */
  getInfectedAppearance() {
    const appearances = this.getContentConfig(
      "appearanceDescriptions.infected"
    );
    return appearances
      ? this._randomSelect(appearances)
      : this._fallbackAppearance("infected");
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
   * 計算租客滿意度
   */
  calculateTenantSatisfaction(tenant, room, gameState, globalEffects = {}) {
    const system = this.getGameBalance("tenants.satisfactionSystem");
    if (!system) {
      return 50; // 後備預設值
    }

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
    const consumption = this.getConsumption();

    switch (resourceType) {
      case "food":
        return (
          consumption.landlordDailyFood +
          consumption.tenantDailyFood * tenantCount
        );
      case "fuel":
        return consumption.buildingDailyFuel;
      case "medical":
        return consumption.elderDailyMedical * 0.1 * tenantCount; // 假設10%是老人
      case "materials":
        return 0.1; // 基礎磨損
      default:
        return 0;
    }
  }

  // ==================== 工具方法 ====================

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
   * 範圍內隨機整數
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

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
   * 安全取得嵌套物件值
   */
  safeGet(obj, path, defaultValue = undefined) {
    if (!obj || !path) return defaultValue;

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

  // ==================== 後備數據提供 ====================

  /**
   * 最小預設值（緊急後備）
   */
  getMinimalDefaults() {
    return {
      initialResources: {
        food: 20,
        materials: 15,
        medical: 10,
        fuel: 8,
        cash: 50,
      },
      initialLandlord: { day: 1, time: "day", hunger: 0, buildingDefense: 0 },
      initialRooms: {
        count: 2,
        defaultState: { needsRepair: false, reinforced: false, tenant: null },
      },
      initialGlobalEffects: {
        emergencyTraining: false,
        foodPreservation: false,
        patrolSystem: false,
      },
    };
  }

  getMinimalBalance() {
    return {
      landlord: { dailyFoodConsumption: 2 },
      tenants: {
        dailyFoodConsumption: 2,
        satisfactionSystem: { baseValue: 50, range: { min: 0, max: 100 } },
      },
      economy: { rentPayment: { reinforcementBonus: 0.2 } },
    };
  }

  getMinimalMechanics() {
    return {
      harvest: { baseAmount: 2, farmerBonus: 2, cooldownDays: 2 },
      scavenging: { maxPerDay: 2 },
      probability: { baseInfectionRisk: 0.2 },
    };
  }

  getMinimalUI() {
    return {
      colorSchemes: { normal: "#ffcc66", critical: "#ff6666", good: "#66ff66" },
      display: { maxLogVisible: 50, maxApplicantsPerVisit: 3 },
    };
  }

  getMinimalContent() {
    return {
      nameGeneration: {
        nicknames: ["小明", "小華", "老王", "阿強"],
      },
      appearanceDescriptions: {
        normal: ["看起來還算正常"],
        infected: ["狀態可疑"],
      },
    };
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

  // ==================== 狀態檢查與除錯 ====================

  /**
   * 取得當前狀態
   */
  getStatus() {
    return {
      initialized: this.initialized,
      configLoaded: !!this.config,
      mode: this.config ? "config-driven" : "fallback",
      availableSections: this.config
        ? Object.keys(this.config)
        : ["minimal fallback"],
      hasGameDefaults:
        !!this.gameDefaults && Object.keys(this.gameDefaults).length > 0,
      hasGameBalance:
        !!this.gameBalance && Object.keys(this.gameBalance).length > 0,
      hasMechanics: !!this.mechanics && Object.keys(this.mechanics).length > 0,
      hasUIConfig: !!this.uiConfig && Object.keys(this.uiConfig).length > 0,
      hasContentConfig:
        !!this.contentConfig && Object.keys(this.contentConfig).length > 0,
    };
  }

  /**
   * 驗證配置完整性
   */
  validateConfig() {
    const issues = [];

    if (!this.config) {
      issues.push("配置未載入，使用後備模式");
      return issues;
    }

    // 檢查必要區塊
    const requiredSections = ["gameDefaults", "gameBalance", "mechanics", "ui"];
    requiredSections.forEach((section) => {
      if (!this.config[section]) {
        issues.push(`缺少 ${section} 配置區塊`);
      }
    });

    // 檢查關鍵配置
    if (!this.getGameDefault("initialResources")) {
      issues.push("缺少初始資源配置");
    }

    if (!this.getGameBalance("landlord.dailyFoodConsumption")) {
      issues.push("缺少房東每日消耗配置");
    }

    return issues;
  }

  /**
   * 除錯印出
   */
  debugPrint() {
    console.group("🛠️ GameHelpers v2.0 狀態");
    console.log("狀態:", this.getStatus());

    const issues = this.validateConfig();
    if (issues.length > 0) {
      console.warn("配置問題:", issues);
    } else {
      console.log("✅ 配置驗證通過");
    }

    console.log("可用方法:", [
      "getInitialGameState",
      "getInitialRooms",
      "getConsumption",
      "getProbabilities",
      "getTimeParameters",
      "getEconomicParameters",
      "generateName",
      "getDefenseStatus",
      "getHungerStatus",
      "calculateTenantSatisfaction",
      "calculateResourceScarcity",
    ]);
    console.groupEnd();
  }
}

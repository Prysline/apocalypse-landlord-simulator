/**
 * Game Utilities - 配置驅動的遊戲輔助函數模組
 * 重構原則：所有資料來源於 rules.json，helpers.js 只負責邏輯轉換
 */

class ConfigurableGameHelpers {
  constructor(rulesConfig = null) {
    this.config = rulesConfig;
    this.initialized = false;

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
    };
  }
}

// ==================== 全域實例管理 ====================

// 建立全域實例（向後相容）
window.GameHelpers = new ConfigurableGameHelpers();

// 提供配置注入介面
window.initializeGameHelpers = (rulesConfig) => {
  return window.GameHelpers.injectConfig(rulesConfig);
};

// 保持向後相容的函數介面
function generateName(type = "nickname") {
  return window.GameHelpers.generateName(type);
}

function generateUniqueName(
  existingNames = [],
  type = "nickname",
  maxAttempts = 50
) {
  return window.GameHelpers.generateUniqueName(
    existingNames,
    type,
    maxAttempts
  );
}

function getNormalAppearance() {
  return window.GameHelpers.getNormalAppearance();
}

function getInfectedAppearance() {
  return window.GameHelpers.getInfectedAppearance();
}

function getDefenseStatus(defense) {
  return window.GameHelpers.getDefenseStatus(defense);
}

function getHungerStatus(hunger) {
  return window.GameHelpers.getHungerStatus(hunger);
}

function getSatisfactionStatus(satisfaction) {
  return window.GameHelpers.getSatisfactionStatus(satisfaction);
}

// 匯出模組（如果在模組環境中）
if (typeof module !== "undefined" && module.exports) {
  module.exports = ConfigurableGameHelpers;
}

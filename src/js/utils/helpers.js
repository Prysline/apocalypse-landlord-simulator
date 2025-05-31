/**
 * Game Utilities v2.0 - 配置驅動的遊戲輔助函數模組（詳細註解版）
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
   * @returns {boolean} 初始化是否成功
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
   * @private
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
   * @param {Object} rulesConfig - 從 rules.json 載入的完整配置物件
   * @returns {boolean} 配置注入是否成功
   *
   * @example
   * // 在 DataManager 載入完成後注入配置
   * const rulesConfig = await dataManager.loadData('rules');
   * const success = gameHelpers.injectConfig(rulesConfig);
   */
  injectConfig(rulesConfig) {
    this.config = rulesConfig;
    return this.initialize();
  }

  // ==================== 配置數據存取介面 ====================

  /**
   * 統一的配置存取介面 - 可存取 rules.json 中的任何配置項目
   *
   * @param {string} path - 使用點號分隔的配置路徑，例如 "gameBalance.landlord.dailyFoodConsumption"
   * @param {any} [defaultValue=undefined] - 當路徑不存在時返回的預設值
   * @returns {any} 配置值或預設值
   *
   * @description
   * 這是最通用的配置存取方法，可以存取 rules.json 中的任何嵌套屬性。
   * 路徑格式為物件屬性的點號分隔字串，支援任意深度的嵌套存取。
   *
   * @example
   * // 存取房東每日食物消耗量
   * const dailyFood = gameHelpers.getConfig('gameBalance.landlord.dailyFoodConsumption', 2);
   *
   * // 存取UI顏色配置
   * const criticalColor = gameHelpers.getConfig('ui.colorSchemes.critical', '#ff6666');
   *
   * // 存取複雜的嵌套物件
   * const hungerLevels = gameHelpers.getConfig('gameBalance.landlord.hungerSystem.levels', []);
   *
   * @see {@link getGameBalance} 用於存取 gameBalance 區塊
   * @see {@link getMechanics} 用於存取 mechanics 區塊
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
   * 取得遊戲預設值 - 存取 rules.json 中 gameDefaults 區塊的配置
   *
   * @param {string} path - gameDefaults 物件內的路徑，例如 "initialResources.food"
   * @param {any} [defaultValue=undefined] - 路徑不存在時的預設值
   * @returns {any} 遊戲預設值或預設值
   *
   * @description
   * 用於存取遊戲初始化時的預設值，包括初始資源、初始房間狀態、
   * 初始房東狀態等配置項目。這些值在遊戲開始時用於建立初始遊戲狀態。
   *
   * @example
   * // 取得初始食物數量
   * const initialFood = gameHelpers.getGameDefault('initialResources.food', 20);
   *
   * // 取得初始房東飢餓值
   * const initialHunger = gameHelpers.getGameDefault('initialLandlord.hunger', 0);
   *
   * // 取得初始房間數量
   * const roomCount = gameHelpers.getGameDefault('initialRooms.count', 2);
   *
   * @see {@link getInitialGameState} 取得完整的初始遊戲狀態
   * @see {@link getInitialRooms} 取得初始房間配置
   */
  getGameDefault(path, defaultValue = undefined) {
    return this.safeGet(this.gameDefaults, path) ?? defaultValue;
  }

  /**
   * 取得遊戲平衡參數 - 存取 rules.json 中 gameBalance 區塊的配置
   *
   * @param {string} path - gameBalance 物件內的路徑，例如 "landlord.dailyFoodConsumption"
   * @param {any} [defaultValue=undefined] - 路徑不存在時的預設值
   * @returns {any} 遊戲平衡參數或預設值
   *
   * @description
   * 用於存取影響遊戲平衡性的核心參數，包括房東和租客的消耗量、
   * 滿意度系統、經濟參數等。這些值影響遊戲的難度和進展節奏。
   *
   * @example
   * // 取得房東每日食物消耗量
   * const landlordFood = gameHelpers.getGameBalance('landlord.dailyFoodConsumption', 2);
   *
   * // 取得租客滿意度基礎值
   * const baseSatisfaction = gameHelpers.getGameBalance('tenants.satisfactionSystem.baseValue', 50);
   *
   * // 取得經濟參數 - 加固房間的租金加成
   * const reinforcementBonus = gameHelpers.getGameBalance('economy.rentPayment.reinforcementBonus', 0.2);
   *
   * // 取得複雜的滿意度影響因子
   * const satisfactionFactors = gameHelpers.getGameBalance('tenants.satisfactionSystem.factors', {});
   *
   * @see {@link getConsumption} 取得專門的消耗參數
   * @see {@link getEconomicParameters} 取得專門的經濟參數
   */
  getGameBalance(path, defaultValue = undefined) {
    return this.safeGet(this.gameBalance, path) ?? defaultValue;
  }

  /**
   * 取得遊戲機制參數 - 存取 rules.json 中 mechanics 區塊的配置
   *
   * @param {string} path - mechanics 物件內的路徑，例如 "harvest.baseAmount"
   * @param {any} [defaultValue=undefined] - 路徑不存在時的預設值
   * @returns {any} 遊戲機制參數或預設值
   *
   * @description
   * 用於存取具體的遊戲機制參數，包括採集系統、派遣系統、建築系統、
   * 事件系統等的配置。這些參數控制各種遊戲功能的具體運作方式。
   *
   * @example
   * // 取得院子採集的基礎數量
   * const harvestAmount = gameHelpers.getMechanics('harvest.baseAmount', 2);
   *
   * // 取得每日最大派遣次數
   * const maxScavenge = gameHelpers.getMechanics('scavenging.maxPerDay', 2);
   *
   * // 取得基礎感染風險
   * const infectionRisk = gameHelpers.getMechanics('probability.baseInfectionRisk', 0.2);
   *
   * // 取得建築相關參數
   * const maxRooms = gameHelpers.getMechanics('building.maxRooms', 6);
   * const repairCost = gameHelpers.getMechanics('building.repairCosts.base', 3);
   *
   * @see {@link getTimeParameters} 取得專門的時間相關參數
   * @see {@link getProbabilities} 取得專門的機率參數
   */
  getMechanics(path, defaultValue = undefined) {
    return this.safeGet(this.mechanics, path) ?? defaultValue;
  }

  /**
   * 取得UI配置 - 存取 rules.json 中 ui 區塊的配置
   *
   * @param {string} path - ui 物件內的路徑，例如 "colorSchemes.critical"
   * @param {any} [defaultValue=undefined] - 路徑不存在時的預設值
   * @returns {any} UI配置值或預設值
   *
   * @description
   * 用於存取使用者介面相關的配置，包括顏色主題、顯示限制、
   * 字型設定等。這些配置控制遊戲的視覺呈現和使用者體驗。
   *
   * @example
   * // 取得危急狀態的顏色
   * const criticalColor = gameHelpers.getUIConfig('colorSchemes.critical', '#ff6666');
   *
   * // 取得租客類型的顏色配置
   * const doctorColor = gameHelpers.getUIConfig('colors.tenantColors.doctor', '#66cc66');
   *
   * // 取得顯示限制
   * const maxLogEntries = gameHelpers.getUIConfig('display.maxLogVisible', 50);
   * const maxApplicants = gameHelpers.getUIConfig('display.maxApplicantsPerVisit', 3);
   *
   * // 取得字型配置
   * const fontFamily = gameHelpers.getUIConfig('typography.fontFamily', '"Courier New", monospace');
   *
   * @see {@link getColorBySeverity} 根據嚴重程度取得顏色
   */
  getUIConfig(path, defaultValue = undefined) {
    return this.safeGet(this.uiConfig, path) ?? defaultValue;
  }

  /**
   * 取得內容配置 - 存取 rules.json 中 content 區塊的配置
   *
   * @param {string} path - content 物件內的路徑，例如 "nameGeneration.nicknames"
   * @param {any} [defaultValue=undefined] - 路徑不存在時的預設值
   * @returns {any} 內容配置值或預設值
   *
   * @description
   * 用於存取遊戲內容相關的配置，包括姓名生成、外觀描述等文本內容。
   * 這些配置讓遊戲內容更加豐富和多樣化。
   *
   * @example
   * // 取得暱稱清單
   * const nicknames = gameHelpers.getContentConfig('nameGeneration.nicknames', []);
   *
   * // 取得姓氏清單
   * const surnames = gameHelpers.getContentConfig('nameGeneration.surnames', []);
   *
   * // 取得正常外觀描述清單
   * const normalAppearances = gameHelpers.getContentConfig('appearanceDescriptions.normal', []);
   *
   * // 取得感染外觀描述清單
   * const infectedAppearances = gameHelpers.getContentConfig('appearanceDescriptions.infected', []);
   *
   * @see {@link generateName} 使用配置生成隨機姓名
   * @see {@link getNormalAppearance} 取得正常外觀描述
   * @see {@link getInfectedAppearance} 取得感染外觀描述
   */
  getContentConfig(path, defaultValue = undefined) {
    return this.safeGet(this.contentConfig, path) ?? defaultValue;
  }

  // ==================== 遊戲初始化支援 ====================

  /**
   * 取得初始遊戲狀態 - 根據配置生成完整的初始遊戲狀態物件
   *
   * @returns {Object} 完整的初始遊戲狀態物件
   *
   * @description
   * 根據 rules.json 中的 gameDefaults 配置，生成遊戲開始時的完整狀態物件。
   * 包括天數、時間、資源、房東狀態、全域效果等所有初始值。
   *
   * @example
   * // 在遊戲初始化時使用
   * const initialState = gameHelpers.getInitialGameState();
   * console.log(initialState.resources.food); // 20 (從配置讀取)
   * console.log(initialState.day); // 1
   * console.log(initialState.landlordHunger); // 0
   *
   * @returns {Object} 初始遊戲狀態，包含以下屬性：
   * - {number} day - 初始天數
   * - {string} time - 初始時間 ("day" 或 "night")
   * - {Object} resources - 初始資源 {food, materials, medical, fuel, cash}
   * - {number} landlordHunger - 房東初始飢餓值
   * - {boolean} harvestUsed - 院子採集是否已使用
   * - {number} harvestCooldown - 院子採集冷卻時間
   * - {number} scavengeUsed - 已使用的派遣次數
   * - {number} maxScavengePerDay - 每日最大派遣次數
   * - {boolean} rentCollected - 是否已收租
   * - {number} buildingDefense - 建築防禦值
   * - {Object} tenantSatisfaction - 租客滿意度記錄
   * - {boolean} emergencyTraining - 急救培訓狀態
   * - {boolean} foodPreservation - 食物保存技術狀態
   * - {boolean} patrolSystem - 巡邏系統狀態
   * - {boolean} socialNetwork - 社交網絡狀態
   * - {boolean} nightWatchActive - 夜間警戒狀態
   * - {number} harmoniumBonus - 和諧獎勵
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
   * 取得初始房間配置 - 根據配置生成初始房間陣列
   *
   * @returns {Array<Object>} 初始房間陣列
   *
   * @description
   * 根據 rules.json 中的 gameDefaults.initialRooms 配置，
   * 生成遊戲開始時的房間陣列。每個房間都有唯一的ID和預設狀態。
   *
   * @example
   * // 取得初始房間配置
   * const rooms = gameHelpers.getInitialRooms();
   * console.log(rooms.length); // 2 (預設房間數量)
   * console.log(rooms[0]); // {id: 1, tenant: null, needsRepair: false, reinforced: false}
   *
   * @returns {Array<Object>} 房間物件陣列，每個房間包含：
   * - {number} id - 房間唯一識別碼
   * - {Object|null} tenant - 租客物件，初始為 null
   * - {boolean} needsRepair - 是否需要維修
   * - {boolean} reinforced - 是否已加固
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
   * 通用的等級狀態格式化器 - 將數值轉換為等級描述和視覺格式
   *
   * @param {number} value - 要格式化的數值
   * @param {string} levelConfigPath - 等級配置在 rules.json 中的路徑
   * @param {string} [displayFormat="withValue"] - 顯示格式選項
   * @returns {Object} 格式化結果物件
   *
   * @description
   * 這是一個通用的狀態格式化工具，可以將任何數值根據配置的等級系統
   * 轉換為帶有描述、顏色、嚴重程度等資訊的格式化物件。
   *
   * @param {string} displayFormat 可選的顯示格式：
   * - "withValue" - 包含數值，例如 "飢餓(3)"
   * - "nameOnly" - 僅顯示名稱，例如 "飢餓"
   * - "withEmoji" - 包含表情符號，例如 "😞 飢餓"
   * - "full" - 完整格式，例如 "😞 飢餓(3)"
   *
   * @example
   * // 格式化房東飢餓狀態
   * const hungerStatus = gameHelpers.formatLevelStatus(
   *   3,
   *   "gameBalance.landlord.hungerSystem",
   *   "withValue"
   * );
   * console.log(hungerStatus.text); // "飢餓(3)"
   * console.log(hungerStatus.color); // "#ff6666"
   * console.log(hungerStatus.critical); // true
   *
   * @returns {Object} 格式化結果，包含：
   * - {string} text - 格式化後的顯示文字
   * - {string} color - 對應的顏色代碼
   * - {string} level - 等級名稱
   * - {string} severity - 嚴重程度標識
   * - {string} emoji - 對應的表情符號（如果有）
   * - {boolean} critical - 是否為危急狀態
   *
   * @see {@link getDefenseStatus} 格式化防禦狀態
   * @see {@link getHungerStatus} 格式化飢餓狀態
   * @see {@link getSatisfactionStatus} 格式化滿意度狀態
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
   * 防禦狀態格式化 - 將建築防禦值轉換為狀態描述
   *
   * @param {number} defense - 當前建築防禦值
   * @returns {Object} 格式化的防禦狀態物件
   *
   * @description
   * 根據建築防禦值和配置的防禦等級系統，返回對應的狀態描述、
   * 顏色和危急程度等資訊。用於在UI中顯示當前的建築安全狀況。
   *
   * @example
   * // 格式化防禦狀態
   * const defenseStatus = gameHelpers.getDefenseStatus(5);
   * console.log(defenseStatus.text); // "穩固(5)"
   * console.log(defenseStatus.color); // "#ffcc66"
   * console.log(defenseStatus.critical); // false
   *
   * // 低防禦值的情況
   * const lowDefense = gameHelpers.getDefenseStatus(0);
   * console.log(lowDefense.text); // "脆弱(0)"
   * console.log(lowDefense.critical); // true
   */
  getDefenseStatus(defense) {
    return this.formatLevelStatus(
      defense,
      "mechanics.building.defenseSystem",
      "withValue"
    );
  }

  /**
   * 飢餓狀態格式化 - 將房東飢餓值轉換為狀態描述
   *
   * @param {number} hunger - 當前房東飢餓值
   * @returns {Object} 格式化的飢餓狀態物件
   *
   * @description
   * 根據房東飢餓值和配置的飢餓等級系統，返回對應的狀態描述、
   * 顏色和危急程度等資訊。用於在UI中顯示房東的健康狀況。
   *
   * @example
   * // 正常飢餓狀態
   * const hungerStatus = gameHelpers.getHungerStatus(1);
   * console.log(hungerStatus.text); // "微餓(1)"
   * console.log(hungerStatus.critical); // false
   *
   * // 危急飢餓狀態
   * const criticalHunger = gameHelpers.getHungerStatus(6);
   * console.log(criticalHunger.text); // "極度飢餓(6)"
   * console.log(criticalHunger.critical); // true
   */
  getHungerStatus(hunger) {
    return this.formatLevelStatus(
      hunger,
      "gameBalance.landlord.hungerSystem",
      "withValue"
    );
  }

  /**
   * 滿意度狀態格式化 - 將租客滿意度轉換為狀態描述
   *
   * @param {number} satisfaction - 租客滿意度（0-100）
   * @returns {Object} 格式化的滿意度狀態物件
   *
   * @description
   * 根據租客滿意度值和配置的滿意度等級系統，返回對應的狀態描述、
   * 表情符號和顏色等資訊。使用 "withEmoji" 格式以提供視覺化的滿意度指示。
   *
   * @example
   * // 高滿意度
   * const goodSatisfaction = gameHelpers.getSatisfactionStatus(80);
   * console.log(goodSatisfaction.text); // "😊 非常滿意"
   * console.log(goodSatisfaction.emoji); // "😊"
   *
   * // 低滿意度
   * const poorSatisfaction = gameHelpers.getSatisfactionStatus(15);
   * console.log(poorSatisfaction.text); // "😡 極度不滿"
   * console.log(poorSatisfaction.critical); // true
   */
  getSatisfactionStatus(satisfaction) {
    return this.formatLevelStatus(
      satisfaction,
      "gameBalance.tenants.satisfactionSystem.display",
      "withEmoji"
    );
  }

  /**
   * 根據嚴重程度取得顏色 - 從UI配置中取得對應的顏色代碼
   *
   * @param {string} severity - 嚴重程度標識（如 "critical", "normal", "good"）
   * @returns {string} 對應的顏色代碼（十六進位）
   *
   * @description
   * 根據提供的嚴重程度標識，從UI配置的顏色主題中取得對應的顏色代碼。
   * 如果找不到對應的顏色，則返回預設的正常狀態顏色。
   *
   * @example
   * // 取得危急狀態顏色
   * const criticalColor = gameHelpers.getColorBySeverity('critical');
   * console.log(criticalColor); // "#ff6666"
   *
   * // 取得良好狀態顏色
   * const goodColor = gameHelpers.getColorBySeverity('good');
   * console.log(goodColor); // "#66ff66"
   *
   * // 未知嚴重程度會返回預設顏色
   * const unknownColor = gameHelpers.getColorBySeverity('unknown');
   * console.log(unknownColor); // "#ffcc66" (預設正常顏色)
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
   * 取得消耗相關參數 - 整合所有消耗類型的配置參數
   *
   * @returns {Object} 包含各種消耗參數的物件
   *
   * @description
   * 整合並返回所有與消耗相關的遊戲參數，包括房東和租客的每日消耗量、
   * 院子採集的基礎數量和加成、建築設施的燃料消耗等。
   * 這個方法提供了一個便利的介面來存取所有消耗相關的配置。
   *
   * @example
   * // 取得所有消耗參數
   * const consumption = gameHelpers.getConsumption();
   *
   * console.log(consumption.landlordDailyFood); // 2 - 房東每日食物消耗
   * console.log(consumption.tenantDailyFood); // 2 - 租客每日食物消耗
   * console.log(consumption.harvestBaseAmount); // 2 - 院子採集基礎數量
   * console.log(consumption.farmerHarvestBonus); // 2 - 農夫採集加成
   *
   * // 計算總每日食物需求
   * const tenantCount = 3;
   * const totalFoodNeeded = consumption.landlordDailyFood +
   *                        (consumption.tenantDailyFood * tenantCount);
   *
   * @returns {Object} 消耗參數物件，包含：
   * - {number} landlordDailyFood - 房東每日食物消耗量
   * - {number} tenantDailyFood - 租客每日食物消耗量
   * - {number} elderDailyMedical - 老人租客每日醫療用品消耗量
   * - {number} buildingDailyFuel - 建築設施每日燃料消耗量
   * - {number} harvestBaseAmount - 院子採集基礎數量
   * - {number} farmerHarvestBonus - 農夫的院子採集加成
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
   * 取得機率相關參數 - 整合所有隨機事件和機率計算的配置參數
   *
   * @returns {Object} 包含各種機率參數的物件
   *
   * @description
   * 整合並返回所有與機率和隨機事件相關的遊戲參數，包括感染風險、
   * 事件觸發機率、租客互動機率等。這些參數控制遊戲中的隨機性。
   *
   * @example
   * // 取得所有機率參數
   * const probabilities = gameHelpers.getProbabilities();
   *
   * console.log(probabilities.baseInfectionRisk); // 0.2 - 基礎感染風險
   * console.log(probabilities.randomEventChance); // 0.3 - 隨機事件觸發機率
   *
   * // 用於隨機判斷
   * if (Math.random() < probabilities.medicalEmergencyChance) {
   *   // 觸發醫療緊急事件
   * }
   *
   * @returns {Object} 機率參數物件，包含：
   * - {number} baseInfectionRisk - 基礎感染風險（0-1）
   * - {number} randomEventChance - 隨機事件觸發機率（0-1）
   * - {number} conflictBaseChance - 租客衝突基礎機率（0-1）
   * - {number} medicalEmergencyChance - 醫療緊急事件機率（0-1）
   * - {number} mutualAidChance - 租客互助機率（0-1）
   * - {number} autoRepairChance - 自動維修機率（0-1）
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
   * 取得時間相關參數 - 整合所有時間延遲和冷卻時間的配置參數
   *
   * @returns {Object} 包含各種時間參數的物件
   *
   * @description
   * 整合並返回所有與時間相關的遊戲參數，包括各種行動的冷卻時間、
   * 作物成長時間、派遣限制等。這些參數控制遊戲的時間節奏。
   *
   * @example
   * // 取得所有時間參數
   * const timeParams = gameHelpers.getTimeParameters();
   *
   * console.log(timeParams.harvestCooldownDays); // 2 - 院子採集冷卻天數
   * console.log(timeParams.cropGrowthDays); // 3 - 作物成長天數
   * console.log(timeParams.maxScavengePerDay); // 2 - 每日最大派遣次數
   *
   * // 檢查是否可以進行院子採集
   * if (gameState.harvestCooldown <= 0) {
   *   // 可以採集
   *   gameState.harvestCooldown = timeParams.harvestCooldownDays;
   * }
   *
   * @returns {Object} 時間參數物件，包含：
   * - {number} harvestCooldownDays - 院子採集冷卻天數
   * - {number} cropGrowthDays - 作物成長所需天數
   * - {number} maxScavengePerDay - 每日最大派遣次數
   */
  getTimeParameters() {
    return {
      harvestCooldownDays: this.getMechanics("harvest.cooldownDays", 2),
      cropGrowthDays: this.getMechanics("harvest.cropGrowthDays", 3),
      maxScavengePerDay: this.getMechanics("scavenging.maxPerDay", 2),
    };
  }

  /**
   * 取得事件系統參數
   */
  getEventParameters() {
    const mechanicsConfig = this.config?.mechanics || {};

    return {
      randomEventChance: mechanicsConfig.events?.randomEventChance || 0.3,
      conflictBaseChance: mechanicsConfig.events?.conflictBaseChance || 0.25,
      conflictModifiers: mechanicsConfig.events?.conflictModifiers || {
        tenantCountMultiplier: 0.08,
        satisfactionPenalty: 0.003,
        resourceScarcityBonus: 0.1,
        elderReduction: 0.12,
      },
    };
  }

  /**
   * 取得經濟相關參數 - 整合所有經濟和交易相關的配置參數
   *
   * @returns {Object} 包含各種經濟參數的物件
   *
   * @description
   * 整合並返回所有與經濟系統相關的遊戲參數，包括租金加成、
   * 資源兌換率、交易加價等。這些參數影響遊戲的經濟平衡。
   *
   * @example
   * // 取得所有經濟參數
   * const economicParams = gameHelpers.getEconomicParameters();
   *
   * console.log(economicParams.reinforcementRentBonus); // 0.2 - 加固房間租金加成
   * console.log(economicParams.resourceExchangeRates.food); // 1.5 - 食物兌換率
   *
   * // 計算加固房間的實際租金
   * const baseRent = 15;
   * const reinforcedRent = Math.floor(
   *   baseRent * (1 + economicParams.reinforcementRentBonus)
   * );
   *
   * // 計算資源兌換現金
   * const foodValue = 10 * economicParams.resourceExchangeRates.food; // 15現金
   *
   * @returns {Object} 經濟參數物件，包含：
   * - {number} reinforcementRentBonus - 加固房間的租金加成比例
   * - {Object} resourceExchangeRates - 資源兌換率物件
   *   - {number} food - 食物兌換現金的比率
   *   - {number} materials - 建材兌換現金的比率
   *   - {number} medical - 醫療用品兌換現金的比率
   *   - {number} fuel - 燃料兌換現金的比率
   * - {number} tradeMarkup - 交易加價比例
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

  /**
   * 取得資源警告閾值
   */
  getResourceWarningThresholds() {
    return (
      this.config?.gameBalance?.resources?.warningThresholds || {
        food: 5,
        materials: 3,
        medical: 2,
        fuel: 2,
        cash: 15,
      }
    );
  }

  // ==================== 名稱生成系統 ====================

  /**
   * 生成隨機姓名 - 根據配置的姓名庫生成隨機姓名
   *
   * @param {string} [type="nickname"] - 姓名類型
   * @returns {string} 生成的隨機姓名
   *
   * @description
   * 根據content配置中的姓名生成資料，生成不同類型的隨機姓名。
   * 支援暱稱、正式姓名等多種格式。
   *
   * @param {string} type 姓名類型選項：
   * - "nickname" - 暱稱格式（預設），例如 "小明"
   * - "full" - 完整姓名格式，例如 "陳志明"
   * - "formal" - 正式稱呼格式，例如 "陳志明先生/女士"
   *
   * @example
   * // 生成暱稱
   * const nickname = gameHelpers.generateName('nickname');
   * console.log(nickname); // "小明"
   *
   * // 生成完整姓名
   * const fullName = gameHelpers.generateName('full');
   * console.log(fullName); // "陳志明"
   *
   * // 生成正式稱呼
   * const formalName = gameHelpers.generateName('formal');
   * console.log(formalName); // "陳志明先生/女士"
   *
   * @see {@link generateUniqueName} 生成不重複的姓名
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
   * 生成唯一姓名 - 生成不與現有姓名重複的隨機姓名
   *
   * @param {Array<string>} [existingNames=[]] - 已存在的姓名清單
   * @param {string} [type="nickname"] - 姓名類型
   * @param {number} [maxAttempts=50] - 最大嘗試次數
   * @returns {string} 生成的唯一姓名
   *
   * @description
   * 生成一個不與提供的現有姓名清單重複的隨機姓名。如果在最大嘗試次數內
   * 無法生成唯一姓名，則會在姓名後添加數字後綴以確保唯一性。
   *
   * @example
   * // 生成不重複的租客姓名
   * const existingTenants = ['小明', '小華', '老王'];
   * const newName = gameHelpers.generateUniqueName(existingTenants, 'nickname');
   * console.log(newName); // "小李" (或其他不重複的名字)
   *
   * // 如果姓名庫不夠大，會自動添加數字後綴
   * const limitedNames = ['小明', '小華']; // 假設配置中只有這兩個名字
   * const uniqueName = gameHelpers.generateUniqueName(limitedNames, 'nickname', 3);
   * console.log(uniqueName); // "小明123" (添加數字確保唯一性)
   *
   * @param {number} maxAttempts 最大嘗試次數，避免無限迴圈
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
   * 獲取正常外觀描述 - 從配置中隨機選擇正常狀態的外觀描述
   *
   * @returns {string} 隨機的正常外觀描述
   *
   * @description
   * 從content配置的正常外觀描述清單中隨機選擇一個描述文本，
   * 用於描述健康租客的外觀特徵。如果配置不可用，則使用後備描述。
   *
   * @example
   * // 為健康的租客生成外觀描述
   * const appearance = gameHelpers.getNormalAppearance();
   * console.log(appearance); // "看起來精神狀態不錯" 或其他正常描述
   *
   * // 在租客生成時使用
   * const tenant = {
   *   name: gameHelpers.generateName(),
   *   appearance: infected ?
   *     gameHelpers.getInfectedAppearance() :
   *     gameHelpers.getNormalAppearance()
   * };
   */
  getNormalAppearance() {
    const appearances = this.getContentConfig("appearanceDescriptions.normal");
    return appearances
      ? this._randomSelect(appearances)
      : this._fallbackAppearance("normal");
  }

  /**
   * 獲取感染外觀描述 - 從配置中隨機選擇感染狀態的外觀描述
   *
   * @returns {string} 隨機的感染外觀描述
   *
   * @description
   * 從content配置的感染外觀描述清單中隨機選擇一個描述文本，
   * 用於描述已感染租客的外觀特徵。這些描述通常暗示異常狀況。
   *
   * @example
   * // 為感染的租客生成外觀描述
   * const infectedAppearance = gameHelpers.getInfectedAppearance();
   * console.log(infectedAppearance); // "眼神有點呆滯，反應遲鈍" 或其他感染描述
   *
   * // 在申請者篩選中使用
   * const applicant = {
   *   name: gameHelpers.generateName(),
   *   infected: Math.random() < 0.2,
   *   appearance: applicant.infected ?
   *     gameHelpers.getInfectedAppearance() :
   *     gameHelpers.getNormalAppearance()
   * };
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
   * 基於健康狀態獲取外觀描述 - 根據感染狀態和健康程度生成對應的外觀描述
   *
   * @param {boolean} isInfected - 是否已感染
   * @param {number} [healthLevel=100] - 健康程度（0-100）
   * @returns {string} 對應的外觀描述
   *
   * @description
   * 綜合考慮感染狀態和健康程度，生成最適合的外觀描述。
   * 優先考慮感染狀態，然後根據健康程度調整描述內容。
   *
   * @example
   * // 感染的租客（無論健康程度如何都會顯示感染外觀）
   * const infectedDesc = gameHelpers.getAppearanceByHealth(true, 80);
   * console.log(infectedDesc); // 感染相關的描述
   *
   * // 健康但虛弱的租客
   * const weakDesc = gameHelpers.getAppearanceByHealth(false, 25);
   * console.log(weakDesc); // "看起來身體虛弱，需要休息"
   *
   * // 健康的租客
   * const healthyDesc = gameHelpers.getAppearanceByHealth(false, 90);
   * console.log(healthyDesc); // 正常的健康描述
   *
   * @param {number} healthLevel 健康程度分級：
   * - 0-29: 身體虛弱
   * - 30-59: 略顯疲憊
   * - 60-100: 健康正常
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
   * 計算租客滿意度 - 根據多種因素計算租客的最終滿意度
   *
   * @param {Object} tenant - 租客物件
   * @param {Object} room - 房間物件
   * @param {Object} gameState - 遊戲狀態物件
   * @param {Object} [globalEffects={}] - 全域效果物件
   * @returns {number} 計算後的滿意度值（0-100）
   *
   * @description
   * 根據配置的滿意度系統和多種影響因素，計算租客的最終滿意度。
   * 考慮房間條件、個人資源、建築安全、全域效果等多個維度。
   *
   * @example
   * // 計算特定租客的滿意度
   * const satisfaction = gameHelpers.calculateTenantSatisfaction(
   *   tenant,     // 租客物件
   *   room,       // 房間物件
   *   gameState,  // 遊戲狀態
   *   {           // 全域效果
   *     emergencyTraining: true,
   *     patrolSystem: false
   *   }
   * );
   * console.log(satisfaction); // 計算結果，例如 67
   *
   * // 在滿意度更新時使用
   * gameState.tenantSatisfaction[tenant.name] =
   *   gameHelpers.calculateTenantSatisfaction(tenant, room, gameState);
   *
   * @param {Object} tenant 租客物件，需包含：
   * - {Object} personalResources - 個人資源 {food, cash, ...}
   *
   * @param {Object} room 房間物件，需包含：
   * - {boolean} reinforced - 是否已加固
   * - {boolean} needsRepair - 是否需要維修
   *
   * @param {Object} gameState 遊戲狀態，需包含：
   * - {number} buildingDefense - 建築防禦值
   *
   * @param {Object} globalEffects 全域效果，可包含：
   * - {boolean} emergencyTraining - 急救培訓
   * - {boolean} buildingQuality - 建築品質
   * - {boolean} patrolSystem - 巡邏系統
   * - {boolean} socialNetwork - 社交網絡
   *
   * @returns {number} 滿意度值，已限制在配置的最小值和最大值範圍內
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
   * 計算資源稀缺性 - 分析當前資源存量相對於消耗速度的稀缺程度
   *
   * @param {Object} resources - 當前資源物件
   * @param {number} [tenantCount=1] - 租客數量
   * @returns {Object} 資源稀缺性分析結果
   *
   * @description
   * 分析當前各種資源的稀缺性狀況，計算每種資源可維持的天數，
   * 並根據配置的稀缺等級判斷整體資源狀況。用於預警和決策支援。
   *
   * @example
   * // 分析當前資源稀缺性
   * const scarcity = gameHelpers.calculateResourceScarcity(
   *   gameState.resources,  // {food: 15, materials: 5, medical: 3, fuel: 2}
   *   3                     // 3個租客
   * );
   *
   * console.log(scarcity.overall); // "low" - 整體稀缺等級
   * console.log(scarcity.details.food.daysRemaining); // 2 - 食物可維持天數
   * console.log(scarcity.details.fuel.level); // "critical" - 燃料稀缺等級
   *
   * // 根據稀缺性調整策略
   * if (scarcity.overall === 'critical') {
   *   // 啟動緊急資源收集
   * }
   *
   * @param {Object} resources 資源物件，包含：
   * - {number} food - 食物數量
   * - {number} materials - 建材數量
   * - {number} medical - 醫療用品數量
   * - {number} fuel - 燃料數量
   *
   * @returns {Object} 稀缺性分析結果，包含：
   * - {string} overall - 整體稀缺等級 ("abundant"|"normal"|"low"|"critical")
   * - {number} score - 整體稀缺評分（0-1，越低越稀缺）
   * - {Object} details - 各資源詳細分析
   *   - {string} level - 該資源的稀缺等級
   *   - {number} ratio - 相對於一週基準的比例
   *   - {number} daysRemaining - 可維持的天數
   *   - {string} label - 稀缺等級的中文描述
   *   - {string} color - 對應的顏色代碼
   * - {string} label - 整體稀缺等級的中文描述
   * - {string} color - 整體稀缺等級的顏色代碼
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
   * 取得每日消耗量 - 計算指定資源類型的每日消耗量
   *
   * @param {string} resourceType - 資源類型（food, fuel, medical, materials）
   * @param {number} [tenantCount=1] - 租客數量
   * @returns {number} 該資源的每日消耗量
   *
   * @description
   * 根據資源類型和租客數量，計算該資源的每日總消耗量。
   * 考慮房東消耗、租客消耗、建築消耗等多個消耗來源。
   *
   * @example
   * // 計算3個租客情況下的食物每日消耗
   * const foodConsumption = gameHelpers.getDailyConsumption('food', 3);
   * console.log(foodConsumption); // 8 (房東2 + 租客3*2)
   *
   * // 計算燃料每日消耗（不受租客數量影響）
   * const fuelConsumption = gameHelpers.getDailyConsumption('fuel', 5);
   * console.log(fuelConsumption); // 1 (建築基礎消耗)
   *
   * // 計算醫療用品消耗（主要是老人租客）
   * const medicalConsumption = gameHelpers.getDailyConsumption('medical', 4);
   * console.log(medicalConsumption); // 約0.4 (假設10%是老人)
   *
   * @param {string} resourceType 支援的資源類型：
   * - "food" - 食物：房東 + 租客消耗
   * - "fuel" - 燃料：建築設施消耗
   * - "medical" - 醫療用品：主要是老人租客消耗
   * - "materials" - 建材：基礎磨損消耗
   *
   * @returns {number} 每日消耗量，如果是未知資源類型則返回0
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

  /**
   * 機率計算
   */
  calculateProbability(base, modifiers = []) {
    let probability = base;

    modifiers.forEach((modifier) => {
      if (modifier.type === "hasTenantType") {
        // 根據租客類型調整機率的邏輯
        probability += modifier.bonus || 0;
      }
    });

    return Math.max(0, Math.min(1, probability));
  }
  // ==================== 工具方法 ====================

  /**
   * 安全的數值範圍限定 - 確保數值在指定範圍內
   *
   * @param {number} value - 要限定的數值
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 限定後的數值
   *
   * @description
   * 將輸入的數值限制在指定的最小值和最大值範圍內。
   * 包含輸入驗證，對無效輸入提供安全的預設行為。
   *
   * @example
   * // 正常使用
   * const limited = gameHelpers.clamp(150, 0, 100);
   * console.log(limited); // 100
   *
   * const inRange = gameHelpers.clamp(50, 0, 100);
   * console.log(inRange); // 50
   *
   * // 處理無效輸入
   * const invalid = gameHelpers.clamp(NaN, 0, 100);
   * console.log(invalid); // 0 (使用最小值)
   */
  clamp(value, min, max) {
    if (typeof value !== "number" || isNaN(value)) {
      console.warn(`clamp: 無效的數值 ${value}，使用最小值 ${min}`);
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }

  /**
   * 範圍內隨機整數 - 生成指定範圍內的隨機整數
   *
   * @param {number} min - 最小值（包含）
   * @param {number} max - 最大值（包含）
   * @returns {number} 範圍內的隨機整數
   *
   * @description
   * 生成介於最小值和最大值之間的隨機整數，包含邊界值。
   * 常用於遊戲中的隨機數生成需求。
   *
   * @example
   * // 生成1-6的隨機數（模擬骰子）
   * const diceRoll = gameHelpers.randomInt(1, 6);
   * console.log(diceRoll); // 1, 2, 3, 4, 5, 或 6
   *
   * // 生成隨機金額
   * const randomReward = gameHelpers.randomInt(10, 50);
   * console.log(randomReward); // 10到50之間的整數
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 從陣列中隨機選擇 - 從陣列中隨機選擇一個元素
   *
   * @param {Array} array - 要選擇的陣列
   * @returns {any} 隨機選中的元素，如果陣列為空則返回空字串
   *
   * @description
   * 從提供的陣列中隨機選擇一個元素。包含陣列有效性檢查，
   * 對空陣列或無效輸入提供安全的預設行為。
   *
   * @example
   * // 從名字陣列中隨機選擇
   * const names = ['小明', '小華', '小李'];
   * const randomName = gameHelpers._randomSelect(names);
   * console.log(randomName); // "小華" (隨機結果)
   *
   * // 處理空陣列
   * const emptyResult = gameHelpers._randomSelect([]);
   * console.log(emptyResult); // "" (空字串)
   *
   * @private 這是一個內部輔助方法
   */
  _randomSelect(array) {
    if (!Array.isArray(array) || array.length === 0) {
      return "";
    }
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 安全取得嵌套物件值 - 安全地存取深層嵌套物件的屬性
   *
   * @param {Object} obj - 要存取的物件
   * @param {string} path - 以點號分隔的屬性路徑
   * @param {any} [defaultValue=undefined] - 路徑不存在時的預設值
   * @returns {any} 物件屬性值或預設值
   *
   * @description
   * 安全地存取深層嵌套物件的屬性，避免在中間層級為null或undefined時報錯。
   * 這是配置存取系統的核心工具方法。
   *
   * @example
   * // 存取嵌套物件屬性
   * const config = {
   *   gameBalance: {
   *     landlord: {
   *       dailyFoodConsumption: 2
   *     }
   *   }
   * };
   *
   * const value = gameHelpers.safeGet(config, 'gameBalance.landlord.dailyFoodConsumption');
   * console.log(value); // 2
   *
   * // 存取不存在的路徑
   * const missing = gameHelpers.safeGet(config, 'gameBalance.tenant.nonExistent', 'default');
   * console.log(missing); // "default"
   *
   * // 處理null物件
   * const nullResult = gameHelpers.safeGet(null, 'any.path', 'fallback');
   * console.log(nullResult); // "fallback"
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
   * @private
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

  /**
   * @private
   */
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

  /**
   * @private
   */
  getMinimalMechanics() {
    return {
      harvest: { baseAmount: 2, farmerBonus: 2, cooldownDays: 2 },
      scavenging: { maxPerDay: 2 },
      probability: { baseInfectionRisk: 0.2 },
    };
  }

  /**
   * @private
   */
  getMinimalUI() {
    return {
      colorSchemes: { normal: "#ffcc66", critical: "#ff6666", good: "#66ff66" },
      display: { maxLogVisible: 50, maxApplicantsPerVisit: 3 },
    };
  }

  /**
   * @private
   */
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
   * @private
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
   * @private
   */
  _fallbackNameGeneration(type) {
    const fallbackNames = ["小明", "小華", "小李", "老王", "阿強"];
    return fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
  }

  /**
   * 後備外觀描述
   * @private
   */
  _fallbackAppearance(type) {
    return type === "infected" ? "狀態可疑" : "看起來還算正常";
  }

  // ==================== 狀態檢查與除錯 ====================

  /**
   * 取得當前狀態 - 返回GameHelpers的當前運行狀態
   *
   * @returns {Object} 當前狀態資訊物件
   *
   * @description
   * 返回GameHelpers實例的詳細狀態資訊，包括初始化狀態、
   * 配置載入情況、各模組可用性等。用於除錯和狀態監控。
   *
   * @example
   * // 檢查GameHelpers狀態
   * const status = gameHelpers.getStatus();
   * console.log(status.initialized); // true/false
   * console.log(status.mode); // "config-driven" 或 "fallback"
   * console.log(status.availableSections); // ["gameDefaults", "gameBalance", ...]
   *
   * // 根據狀態調整行為
   * if (status.mode === 'fallback') {
   *   console.warn('GameHelpers 運行在後備模式');
   * }
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
   * 驗證配置完整性 - 檢查載入的配置是否包含必要的區塊和欄位
   *
   * @returns {Array<string>} 發現的配置問題列表
   *
   * @description
   * 驗證當前載入的配置是否包含所有必要的區塊和關鍵欄位。
   * 返回發現的問題列表，空陣列表示沒有問題。
   *
   * @example
   * // 驗證配置完整性
   * const issues = gameHelpers.validateConfig();
   *
   * if (issues.length > 0) {
   *   console.warn('配置問題:', issues);
   *   // ["缺少 mechanics 配置區塊", "缺少初始資源配置"]
   * } else {
   *   console.log('配置驗證通過');
   * }
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
   * 除錯印出 - 在控制台輸出詳細的除錯資訊
   *
   * @description
   * 在瀏覽器控制台輸出GameHelpers的完整狀態資訊，
   * 包括配置狀態、可用方法、發現的問題等。用於開發和除錯。
   *
   * @example
   * // 輸出詳細除錯資訊
   * gameHelpers.debugPrint();
   *
   * // 控制台會顯示：
   * // 🛠️ GameHelpers v2.0 狀態
   * // 狀態: {initialized: true, configLoaded: true, ...}
   * // ✅ 配置驗證通過
   * // 可用方法: ["getInitialGameState", "getConsumption", ...]
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
      "getEventParameters",
      "getEconomicParameters",
      "getResourceWarningThresholds",
      "generateName",
      "getDefenseStatus",
      "getHungerStatus",
      "calculateTenantSatisfaction",
      "calculateResourceScarcity",
      "calculateProbability",
    ]);
    console.groupEnd();
  }
}

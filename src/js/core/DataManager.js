// @ts-check

/**
 * @fileoverview DataManager.js - 統一資料管理核心
 * 職責：載入並管理所有遊戲資料和配置檔案
 */

import { ERROR_CODES, MESSAGE_TEMPLATES } from "../utils/constants.js";
import { getNestedValue } from "../utils/helpers.js";

/**
 * 資料載入結果
 * @typedef {Object} LoadResult
 * @property {boolean} success - 載入是否成功
 * @property {Object} [data] - 載入的資料
 * @property {boolean} [fallbackMode] - 是否使用後備模式
 * @property {Array<string>} [errors] - 錯誤訊息列表
 * @property {string} [error] - 單一錯誤訊息
 */

/**
 * 遊戲規則配置
 * @typedef {Object} GameRules
 * @property {Object} gameDefaults - 遊戲預設值
 * @property {Object} gameDefaults.initialResources - 初始資源
 * @property {number} gameDefaults.initialResources.food - 初始食物
 * @property {number} gameDefaults.initialResources.materials - 初始建材
 * @property {number} gameDefaults.initialResources.medical - 初始醫療用品
 * @property {number} gameDefaults.initialResources.fuel - 初始燃料
 * @property {number} gameDefaults.initialResources.cash - 初始現金
 * @property {Object} gameDefaults.initialRooms - 初始房間設定
 * @property {number} gameDefaults.initialRooms.count - 房間數量
 * @property {Object} gameBalance - 遊戲平衡設定
 * @property {Object} gameBalance.landlord - 房東相關設定
 * @property {number} gameBalance.landlord.dailyFoodConsumption - 每日食物消耗
 * @property {Object} gameBalance.tenants - 租客相關設定
 * @property {number} gameBalance.tenants.dailyFoodConsumption - 租客每日食物消耗
 * @property {Object} gameBalance.resources - 資源相關設定
 * @property {Object} gameBalance.resources.dailyConsumption - 每日消耗
 * @property {number} gameBalance.resources.dailyConsumption.fuel - 每日燃料消耗
 * @property {CharacterGeneration} [characterGeneration] - 角色生成配置
 */

/**
 * 角色生成配置
 * @typedef {Object} CharacterGeneration
 * @property {string[]} names - 可用姓名列表
 * @property {AppearanceConfig} appearances - 外觀描述配置
 */

/**
 * 外觀描述配置
 * @typedef {Object} AppearanceConfig
 * @property {string[]} normal - 正常外觀描述列表
 * @property {string[]} infected - 感染者外觀描述列表
 */

/**
 * 角色生成統計資訊
 * @typedef {Object} CharacterGenerationStats
 * @property {boolean} valid - 配置是否有效
 * @property {number} [nameCount] - 姓名數量
 * @property {number} [normalAppearanceCount] - 正常外觀描述數量
 * @property {number} [infectedAppearanceCount] - 感染者外觀描述數量
 * @property {number} [totalDescriptions] - 總描述數量
 * @property {string} [message] - 狀態訊息
 * @property {Error} [error] - 錯誤物件
 */

/**
 * 租客類型定義
 * @typedef {Object} TenantType
 * @property {string} typeId - 租客類型ID
 * @property {string} typeName - 租客類型名稱
 * @property {'doctor'|'worker'|'farmer'|'soldier'|'elder'} category - 租客分類
 * @property {number} rent - 房租金額
 * @property {string} skill - 技能描述
 * @property {number} infectionRisk - 感染風險 (0-1)
 * @property {'common'|'uncommon'|'rare'} [rarity] - 稀有度
 * @property {string} description - 詳細描述
 * @property {Object} personalResources - 個人資源
 * @property {number} personalResources.food - 食物
 * @property {number} personalResources.materials - 建材
 * @property {number} personalResources.medical - 醫療用品
 * @property {number} personalResources.fuel - 燃料
 * @property {number} personalResources.cash - 現金
 * @property {Array<string>} [traits] - 特質列表
 * @property {Object} [baseStats] - 基本屬性
 * @property {Array<string>} [skillIds] - 技能ID列表
 * @property {Object} [preferences] - 偏好設定
 * @property {Object} [unlockConditions] - 解鎖條件
 */

/**
 * 技能定義
 * @typedef {Object} Skill
 * @property {string} id - 技能ID
 * @property {string} name - 技能名稱
 * @property {'active'|'passive'|'special'} type - 技能類型
 * @property {string} description - 技能描述
 * @property {string} [icon] - 圖示
 * @property {Object} cost - 使用成本
 * @property {number} [cost.food] - 食物成本
 * @property {number} [cost.materials] - 建材成本
 * @property {number} [cost.medical] - 醫療用品成本
 * @property {number} [cost.fuel] - 燃料成本
 * @property {number} [cost.cash] - 現金成本
 * @property {number} cooldown - 冷卻時間
 * @property {number} [maxUses] - 最大使用次數
 * @property {Object} requirements - 使用需求
 * @property {Array<Object>} requirements.conditions - 條件列表
 * @property {Array<Object>} effects - 效果列表
 * @property {number} successRate - 成功率 (0-100)
 * @property {number} priority - 優先級
 */

/**
 * 事件定義
 * @typedef {Object} GameEvent
 * @property {string} id - 事件ID
 * @property {'combat'|'economic'|'social'|'crisis'|'tutorial'} category - 事件分類
 * @property {string} title - 事件標題
 * @property {string} description - 事件描述
 * @property {number} priority - 優先級
 * @property {Object} trigger - 觸發條件
 * @property {'random'|'conditional'|'scripted'} trigger.type - 觸發類型
 * @property {number} [trigger.probability] - 觸發機率
 * @property {Array<Object>} [trigger.conditions] - 觸發條件
 * @property {number} [trigger.day] - 指定天數觸發
 * @property {Array<Object>} choices - 選擇列表
 */

/**
 * 技能資料集合
 * @typedef {Object.<string, Array<Skill>>} SkillCollection
 */

/**
 * 事件資料集合
 * @typedef {Object} EventCollection
 * @property {Array<GameEvent>} random_events - 隨機事件
 * @property {Array<GameEvent>} [conflict_events] - 衝突事件
 * @property {Array<GameEvent>} [special_events] - 特殊事件
 * @property {Array<GameEvent>} [scripted_events] - 腳本事件
 */

/**
 * 完整遊戲資料
 * @typedef {Object} AllGameData
 * @property {GameRules} rules - 遊戲規則
 * @property {Array<TenantType>} tenants - 租客類型
 * @property {SkillCollection} skills - 技能資料
 * @property {EventCollection} events - 事件資料
 */

/**
 * 系統狀態資訊
 * @typedef {Object} SystemStatus
 * @property {boolean} initialized - 是否已初始化
 * @property {number} configsLoaded - 已載入配置檔案數量
 * @property {number} gameDataLoaded - 已載入遊戲資料檔案數量
 * @property {number} cacheSize - 快取大小
 * @property {boolean} fallbackMode - 是否處於後備模式
 */

/**
 * 統一資料管理核心類
 * @class
 */
export class DataManager {
  /**
   * 建立 DataManager 實例
   */
  constructor() {
    /** @type {Map<string, Object>} 配置檔案快取 */
    this.configs = new Map();

    /** @type {Map<string, Object>} 遊戲資料檔案快取 */
    this.gameData = new Map();

    /** @type {Map<string, Object>} 處理結果快取 */
    this.cache = new Map();

    /** @type {Map<string, Promise<Object>>} 載入Promise快取，防止重複載入 */
    this.loadingPromises = new Map();

    /** @type {boolean} 初始化狀態 */
    this.isInitialized = false;
  }

  /**
   * 初始化資料管理器 - 載入所有必要資料
   * @returns {Promise<LoadResult>} 初始化結果
   */
  async initialize() {
    if (this.isInitialized) {
      return { success: true, data: this.getAllData() };
    }

    try {
      console.log(MESSAGE_TEMPLATES.SYSTEM.INITIALIZING);

      // 並行載入所有核心資料
      const loadPromises = [
        this.loadConfig("rules"),
        this.loadGameData("tenants"),
        this.loadGameData("skills"),
        this.loadGameData("events"),
      ];

      const results = await Promise.allSettled(loadPromises);

      // 檢查載入結果
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        console.warn("部分資料載入失敗，使用後備模式");
        this.enableFallbackMode();
      }

      this.isInitialized = true;
      console.log(MESSAGE_TEMPLATES.SYSTEM.READY);

      return {
        success: true,
        data: this.getAllData(),
        fallbackMode: failures.length > 0,
        errors: failures.map((f) => f.reason?.message || String(f.reason)),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(MESSAGE_TEMPLATES.SYSTEM.ERROR(errorMessage));
      this.enableFallbackMode();

      return {
        success: false,
        error: errorMessage,
        fallbackMode: true,
        data: this.getAllData(),
      };
    }
  }

  /**
   * 載入配置檔案
   * @param {'rules'} configType - 配置類型
   * @returns {Promise<GameRules>} 載入的配置資料
   * @throws {Error} 當配置載入失敗時
   */
  async loadConfig(configType) {
    const cacheKey = `config_${configType}`;

    if (this.loadingPromises.has(cacheKey)) {
      return /** @type {Promise<GameRules>} */ (
        this.loadingPromises.get(cacheKey)
      );
    }

    const loadPromise = this._loadDataFile(`data/${configType}.json`)
      .then((data) => {
        this.configs.set(configType, data);
        console.log(MESSAGE_TEMPLATES.DATA.LOADED(`${configType} 配置`));
        return /** @type {GameRules} */ (data);
      })
      .catch((error) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(MESSAGE_TEMPLATES.DATA.ERROR(configType, errorMessage));
        throw new Error(`${ERROR_CODES.DATA_LOAD_FAILED}: ${configType}`);
      });

    this.loadingPromises.set(cacheKey, loadPromise);
    return loadPromise;
  }

  /**
   * 載入遊戲資料檔案
   * @param {'tenants'|'skills'|'events'} dataType - 資料類型
   * @returns {Promise<Array<TenantType>|SkillCollection|EventCollection>} 載入的遊戲資料
   * @throws {Error} 當資料載入失敗時
   */
  async loadGameData(dataType) {
    const cacheKey = `data_${dataType}`;

    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey);
    }

    const loadPromise = this._loadDataFile(`data/${dataType}.json`)
      .then((data) => {
        this.gameData.set(dataType, data);
        console.log(MESSAGE_TEMPLATES.DATA.LOADED(`${dataType} 資料`));
        return data;
      })
      .catch((error) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(MESSAGE_TEMPLATES.DATA.ERROR(dataType, errorMessage));
        throw new Error(`${ERROR_CODES.DATA_LOAD_FAILED}: ${dataType}`);
      });

    this.loadingPromises.set(cacheKey, loadPromise);
    return loadPromise;
  }

  /**
   * 私有方法：實際載入檔案
   * @param {string} filePath - 檔案路徑
   * @returns {Promise<Object>} 解析後的JSON資料
   * @throws {Error} 當檔案載入或解析失敗時
   * @private
   */
  async _loadDataFile(filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`JSON 解析錯誤: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * 啟用後備模式 - 使用硬編碼預設值
   * @returns {void}
   */
  enableFallbackMode() {
    console.warn("啟用後備模式，使用預設配置");

    // 設定基本遊戲規則
    if (!this.configs.has("rules")) {
      this.configs.set("rules", this._getDefaultRules());
    }

    // 設定基本租客類型
    if (!this.gameData.has("tenants")) {
      this.gameData.set("tenants", this._getDefaultTenants());
    }

    // 設定基本技能
    if (!this.gameData.has("skills")) {
      this.gameData.set("skills", this._getDefaultSkills());
    }

    // 設定基本事件
    if (!this.gameData.has("events")) {
      this.gameData.set("events", this._getDefaultEvents());
    }
  }

  /**
   * 取得遊戲規則配置
   * @returns {GameRules} 遊戲規則物件
   */
  getGameRules() {
    return /** @type {GameRules} */ (
      this.configs.get("rules") || this._getDefaultRules()
    );
  }

  /**
   * 取得租客類型資料
   * @returns {Array<TenantType>} 租客類型陣列
   */
  getTenantTypes() {
    return /** @type {Array<TenantType>} */ (
      this.gameData.get("tenants") || this._getDefaultTenants()
    );
  }

  /**
   * 取得技能資料
   * @param {'doctor'|'worker'|'farmer'|'soldier'|'elder'} [tenantType] - 租客類型
   * @returns {Array<Skill>} 指定類型的技能陣列
   */
  getSkillData(tenantType) {
    const allSkills = /** @type {SkillCollection} */ (
      this.gameData.get("skills") || this._getDefaultSkills()
    );
    return tenantType ? allSkills[tenantType] || [] : [];
  }

  /**
   * 取得完整技能集合
   * @returns {SkillCollection} 技能資料集合
   */
  getAllSkills() {
    return /** @type {SkillCollection} */ (
      this.gameData.get("skills") || this._getDefaultSkills()
    );
  }

  /**
   * 取得事件資料
   * @returns {EventCollection} 事件資料集合
   */
  getEventData() {
    return /** @type {EventCollection} */ (
      this.gameData.get("events") || this._getDefaultEvents()
    );
  }

  /**
   * 取得所有載入的資料
   * @returns {AllGameData} 包含所有遊戲資料的物件
   */
  getAllData() {
    return {
      rules: this.getGameRules(),
      tenants: this.getTenantTypes(),
      skills: this.getAllSkills(),
      events: this.getEventData(),
    };
  }

  /**
   * 配置查詢輔助方法 - 支援路徑查詢
   * @param {string} path - 配置路徑，用點分隔（如：'gameDefaults.initialResources.food'）
   * @param {*} [defaultValue=null] - 預設值
   * @returns {*} 查詢到的值或預設值
   */
  getRuleValue(path, defaultValue = null) {
    const rules = this.getGameRules();
    return getNestedValue(rules, path, defaultValue);
  }

  /**
   * 取得預設遊戲規則
   * @returns {GameRules} 預設遊戲規則物件
   * @private
   */
  _getDefaultRules() {
    return {
      gameDefaults: {
        initialResources: {
          food: 20,
          materials: 15,
          medical: 10,
          fuel: 8,
          cash: 50,
        },
        initialRooms: { count: 2 },
      },
      gameBalance: {
        landlord: { dailyFoodConsumption: 2 },
        tenants: { dailyFoodConsumption: 2 },
        resources: { dailyConsumption: { fuel: 1 } },
      },
      characterGeneration: {
        names: [
          "小明",
          "小華",
          "小李",
          "老王",
          "阿強",
          "小美",
          "阿珍",
          "大雄",
          "靜香",
          "胖虎",
          "小張",
          "阿陳",
          "小林",
          "老劉",
          "阿花",
          "小玉",
          "阿寶",
          "小鳳",
          "阿義",
          "小雲",
        ],
        appearances: {
          normal: [
            "看起來精神狀態不錯",
            "衣著整潔，談吐得體",
            "眼神清澈，反應靈敏",
            "握手時手掌溫暖有力",
            "說話條理清晰，很有條理",
          ],
          infected: [
            "眼神有點呆滯，反應遲鈍",
            "皮膚蒼白，手有輕微顫抖",
            "說話時偶爾停頓，像在想什麼",
            "衣服有些血跡，說是意外受傷",
            "體溫似乎偏低，一直在發抖",
          ],
        },
      },
    };
  }

  /**
   * 取得預設租客類型
   * @returns {Array<TenantType>} 預設租客類型陣列
   * @private
   */
  _getDefaultTenants() {
    return [
      {
        typeId: "doctor",
        typeName: "醫生",
        category: "doctor",
        rent: 15,
        skill: "醫療",
        infectionRisk: 0.1,
        description: "可以治療感染，檢測可疑租客",
        personalResources: {
          food: 3,
          materials: 0,
          medical: 5,
          fuel: 0,
          cash: 20,
        },
      },
      {
        typeId: "worker",
        typeName: "工人",
        category: "worker",
        rent: 12,
        skill: "維修",
        infectionRisk: 0.2,
        description: "擅長維修建築，房間升級",
        personalResources: {
          food: 4,
          materials: 8,
          medical: 0,
          fuel: 0,
          cash: 15,
        },
      },
    ];
  }

  /**
   * 取得預設技能資料
   * @returns {SkillCollection} 預設技能集合
   * @private
   */
  _getDefaultSkills() {
    return {
      doctor: [
        {
          id: "heal_infection",
          name: "治療感染",
          type: "active",
          description: "治療感染的租客",
          cost: { medical: 3, cash: 12 },
          cooldown: 0,
          requirements: { conditions: [] },
          effects: [],
          successRate: 95,
          priority: 1,
        },
      ],
      worker: [
        {
          id: "efficient_repair",
          name: "專業維修",
          type: "active",
          description: "以更少建材維修房間",
          cost: { materials: 1, cash: 10 },
          cooldown: 0,
          requirements: { conditions: [] },
          effects: [],
          successRate: 100,
          priority: 1,
        },
      ],
    };
  }

  /**
   * 取得預設事件資料
   * @returns {EventCollection} 預設事件集合
   * @private
   */
  _getDefaultEvents() {
    return {
      random_events: [
        {
          id: "zombie_attack",
          category: "combat",
          title: "殭屍襲擊",
          description: "一群殭屍正在靠近房屋！",
          priority: 1,
          trigger: {
            type: "random",
            probability: 0.3,
          },
          choices: [
            {
              id: "fortify_defense",
              text: "加固防禦 (-5建材)",
              cost: { materials: 5 },
            },
          ],
        },
      ],
    };
  }

  /**
   * 取得系統狀態資訊
   * @returns {SystemStatus} 系統狀態物件
   */
  getSystemStatus() {
    return {
      initialized: this.isInitialized,
      configsLoaded: this.configs.size,
      gameDataLoaded: this.gameData.size,
      cacheSize: this.cache.size,
      fallbackMode: this.configs.size === 0 || this.gameData.size === 0,
    };
  }

  /**
   * 清理所有資源和快取
   * @returns {void}
   */
  cleanup() {
    this.configs.clear();
    this.gameData.clear();
    this.cache.clear();
    this.loadingPromises.clear();
    this.isInitialized = false;
  }
}

export default DataManager;

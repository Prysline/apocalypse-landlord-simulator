// @ts-check

/**
 * GameState.js - 中央狀態管理系統
 * 職責：管理遊戲的所有狀態，提供狀態訂閱和更新機制
 * @fileoverview 完整的遊戲狀態管理系統，支援訂閱機制和型別安全
 */

import { getNestedValue, createNestedUpdate, deepClone } from '../utils/helpers.js';

/**
 * 資源類型聯合型別
 * @typedef {'food'|'materials'|'medical'|'fuel'|'cash'} ResourceType
 */

/**
 * 時間狀態聯合型別
 * @typedef {'day'|'night'} TimeState
 */

/**
 * 租客類型聯合型別
 * @typedef {'doctor'|'worker'|'farmer'|'soldier'|'elder'} TenantType
 */

/**
 * 日誌類型聯合型別
 * @typedef {'event'|'rent'|'danger'|'skill'|''} LogType
 */

/**
 * 狀態更新事件類型
 * @typedef {'state_changed'|'log_added'|'day_advanced'|'state_reset'|'state_imported'} StateEventType
 */

/**
 * 資源物件
 * @typedef {Object} Resources
 * @property {number} food - 食物數量
 * @property {number} materials - 建材數量
 * @property {number} medical - 醫療用品數量
 * @property {number} fuel - 燃料數量
 * @property {number} cash - 現金數量
 */

/**
 * 房東狀態
 * @typedef {Object} LandlordState
 * @property {number} hunger - 飢餓程度
 * @property {number} totalIncome - 總收入
 */

/**
 * 租客個人資源
 * @typedef {Object} TenantResources
 * @property {number} food - 個人食物
 * @property {number} materials - 個人建材
 * @property {number} medical - 個人醫療用品
 * @property {number} fuel - 個人燃料
 * @property {number} cash - 個人現金
 */

/**
 * 租客物件
 * @typedef {Object} Tenant
 * @property {string} name - 租客姓名
 * @property {TenantType} type - 租客類型
 * @property {string} skill - 技能描述
 * @property {number} rent - 房租金額
 * @property {boolean} [infected] - 是否感染
 * @property {boolean} [onMission] - 是否執行任務中
 * @property {TenantResources} [personalResources] - 個人資源
 * @property {string} [appearance] - 外觀描述
 * @property {number} [infectionRisk] - 感染風險
 */

/**
 * 房間物件
 * @typedef {Object} Room
 * @property {number} id - 房間ID
 * @property {Tenant|null} tenant - 入住的租客
 * @property {boolean} needsRepair - 是否需要維修
 * @property {boolean} reinforced - 是否已加固
 */

/**
 * 租客相關狀態
 * @typedef {Object} TenantsState
 * @property {Object.<string, number>} satisfaction - 租客滿意度對應表
 * @property {Array} relationships - 租客關係陣列
 * @property {Array} conflictHistory - 衝突歷史陣列
 */

/**
 * 建築狀態
 * @typedef {Object} BuildingState
 * @property {number} defense - 防禦力
 * @property {number} quality - 建築品質
 */

/**
 * 每日操作狀態
 * @typedef {Object} DailyActions
 * @property {boolean} rentCollected - 是否已收租
 * @property {boolean} harvestUsed - 是否已使用院子採集
 * @property {number} harvestCooldown - 院子採集冷卻天數
 * @property {number} scavengeUsed - 已使用搜刮次數
 * @property {number} maxScavengePerDay - 每日最大搜刮次數
 */

/**
 * 全局效果狀態
 * @typedef {Object} GlobalEffects
 * @property {boolean} emergencyTraining - 是否有急救培訓
 * @property {boolean} foodPreservation - 是否有食物保存技術
 * @property {boolean} patrolSystem - 是否有巡邏系統
 * @property {boolean} socialNetwork - 是否有社交網絡
 * @property {boolean} nightWatchActive - 是否夜間警戒啟動
 * @property {number} harmoniumBonus - 和諧氛圍加成
 */

/**
 * 系統狀態
 * @typedef {Object} SystemState
 * @property {boolean} initialized - 是否已初始化
 * @property {boolean} fallbackMode - 是否為後備模式
 * @property {string|null} lastSaved - 最後存檔時間
 * @property {Object|null} gameRules - 遊戲規則配置物件
 */

/**
 * 遊戲日誌條目
 * @typedef {Object} LogEntry
 * @property {number} day - 發生天數
 * @property {TimeState} time - 發生時間
 * @property {string} message - 日誌訊息
 * @property {LogType} type - 日誌類型
 * @property {string} timestamp - 時間戳記
 */

/**
 * 訪客/申請者物件
 * @typedef {Object} Visitor
 * @property {string} name - 姓名
 * @property {TenantType} type - 類型
 * @property {boolean} [infected] - 是否感染
 * @property {boolean} [revealedInfection] - 是否已發現感染
 * @property {boolean} [rentingInterest] - 是否有租房興趣
 * @property {boolean} [isTrader] - 是否為商人
 * @property {string} [appearance] - 外觀描述
 * @property {TenantResources} [personalResources] - 個人資源
 */

/**
 * 完整遊戲狀態
 * @typedef {Object} GameStateData
 * @property {number} day - 當前天數
 * @property {TimeState} time - 當前時間狀態
 * @property {Resources} resources - 資源狀態
 * @property {LandlordState} landlord - 房東狀態
 * @property {Room[]} rooms - 房間陣列
 * @property {TenantsState} tenants - 租客相關狀態
 * @property {BuildingState} building - 建築狀態
 * @property {DailyActions} dailyActions - 每日操作狀態
 * @property {GlobalEffects} globalEffects - 全局效果狀態
 * @property {Visitor[]} visitors - 當前訪客陣列
 * @property {Visitor[]} applicants - 當前申請者陣列
 * @property {LogEntry[]} gameLog - 遊戲日誌陣列
 * @property {SystemState} system - 系統狀態
 */

/**
 * 初始化資料
 * @typedef {Object} InitialData
 * @property {Object} [rules] - 規則配置
 * @property {Object} [rules.gameDefaults] - 遊戲預設值
 * @property {Resources} [rules.gameDefaults.initialResources] - 初始資源
 * @property {Object} [rules.gameDefaults.initialRooms] - 初始房間配置
 * @property {number} [rules.gameDefaults.initialRooms.count] - 房間數量
 * @property {Object} [rules.mechanics] - 遊戲機制配置
 * @property {Object} [rules.mechanics.scavenging] - 搜刮機制
 * @property {number} [rules.mechanics.scavenging.maxPerDay] - 每日最大搜刮次數
 */

/**
 * 狀態變更歷史記錄
 * @typedef {Object} StateChangeRecord
 * @property {string} timestamp - 變更時間戳記
 * @property {number} day - 變更發生的天數
 * @property {string} reason - 變更原因
 * @property {Object} updates - 更新內容
 */

/**
 * 狀態統計資訊
 * @typedef {Object} StateStats
 * @property {number} day - 當前天數
 * @property {number} totalTenants - 總租客數
 * @property {number} infectedTenants - 感染租客數
 * @property {number} occupiedRooms - 已出租房間數
 * @property {number} totalRooms - 總房間數
 * @property {number} totalResources - 總資源數
 * @property {number} buildingDefense - 建築防禦力
 * @property {number} landlordHunger - 房東飢餓程度
 * @property {number} logEntries - 日誌條目數
 * @property {number} changeHistory - 變更歷史記錄數
 */

/**
 * 匯出資料格式
 * @typedef {Object} ExportData
 * @property {GameStateData} state - 遊戲狀態資料
 * @property {Object} metadata - 元資料
 * @property {string} metadata.version - 版本號
 * @property {string} metadata.exportTime - 匯出時間
 * @property {StateStats} metadata.stats - 狀態統計
 */

/**
 * 狀態訂閱回調函數
 * @typedef {function(Object): void} StateSubscriptionCallback
 */

/**
 * 取消訂閱函數
 * @typedef {function(): void} UnsubscribeFunction
 */

/**
 * 中央狀態管理系統
 * 負責管理整個遊戲的狀態，提供狀態訂閱和更新機制
 * @class
 */
export class GameState {
  /**
   * 建立 GameState 實例
   * @param {InitialData|null} [initialData=null] - 初始化資料
   */
  constructor(initialData = null) {
    /** @type {GameStateData} 核心狀態資料 */
    this.state = this._createInitialState(initialData);

    /** @type {Map<StateEventType, Set<StateSubscriptionCallback>>} 狀態訂閱者 */
    this.subscribers = new Map();

    /** @type {StateChangeRecord[]} 狀態變更歷史（用於除錯） */
    this.changeHistory = [];

    /** @type {boolean} 狀態鎖定機制（防止並發修改） */
    this.isLocked = false;

    console.log("GameState 初始化完成");
  }

  /**
   * 建立初始狀態
   * @param {InitialData|null} initialData - 初始化資料
   * @returns {GameStateData} 初始狀態物件
   * @private
   */
  _createInitialState(initialData) {
    /** @type {GameStateData} */
    const defaults = {
      // 基本遊戲狀態
      day: 1,
      time: "day",

      // 資源狀態
      resources: {
        food: 20,
        materials: 15,
        medical: 10,
        fuel: 8,
        cash: 50,
      },

      // 房東狀態
      landlord: {
        hunger: 0,
        totalIncome: 0,
      },

      // 房間狀態
      rooms: [
        { id: 1, tenant: null, needsRepair: false, reinforced: false },
        { id: 2, tenant: null, needsRepair: false, reinforced: false },
      ],

      // 租客相關狀態
      tenants: {
        satisfaction: {},
        relationships: [],
        conflictHistory: [],
      },

      // 建築狀態
      building: {
        defense: 0,
        quality: 0,
      },

      // 每日操作狀態
      dailyActions: {
        rentCollected: false,
        harvestUsed: false,
        harvestCooldown: 0,
        scavengeUsed: 0,
        maxScavengePerDay: 2,
      },

      // 全局效果狀態
      globalEffects: {
        emergencyTraining: false,
        foodPreservation: false,
        patrolSystem: false,
        socialNetwork: false,
        nightWatchActive: false,
        harmoniumBonus: 0,
      },

      // 當前訪客和申請者
      visitors: [],
      applicants: [],

      // 遊戲日誌
      gameLog: [],

      // 系統狀態
      system: {
        initialized: false,
        fallbackMode: false,
        lastSaved: null,
        gameRules: null,
      },
    };

    // 如果有初始資料，合併覆蓋預設值
    if (initialData && initialData.rules) {
      const rules = initialData.rules;

      // 從規則檔案設定初始資源
      if (rules.gameDefaults?.initialResources) {
        Object.assign(defaults.resources, rules.gameDefaults.initialResources);
      }

      // 從規則檔案設定初始房間
      if (rules.gameDefaults?.initialRooms) {
        const roomCount = rules.gameDefaults.initialRooms.count || 2;
        defaults.rooms = Array.from({ length: roomCount }, (_, i) => ({
          id: i + 1,
          tenant: null,
          needsRepair: false,
          reinforced: false,
        }));
      }

      // 設定每日操作限制
      if (rules.mechanics?.scavenging?.maxPerDay) {
        defaults.dailyActions.maxScavengePerDay =
          rules.mechanics.scavenging.maxPerDay;
      }
    }

    return defaults;
  }

  /**
   * 取得完整狀態（唯讀）
   * @returns {GameStateData} 完整的遊戲狀態深度複製
   */
  getState() {
    return deepClone(this.state);
  }

  /**
   * 取得特定路徑的狀態值
   * @param {string} path - 狀態路徑，使用點號分隔（例如：'resources.food'）
   * @param {*} [defaultValue=null] - 當路徑不存在時的預設值
   * @returns {*} 指定路徑的狀態值或預設值
   */
  getStateValue(path, defaultValue = null) {
    try {
      const value = getNestedValue(this.state, path, defaultValue);
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      console.warn(`取得狀態值失敗: ${path}`, error);
      return defaultValue;
    }
  }

  /**
   * 更新狀態
   * @param {Partial<GameStateData>} updates - 要更新的狀態部分
   * @param {string} [reason='狀態更新'] - 更新原因
   * @returns {boolean} 更新是否成功
   * @throws {Error} 當狀態被鎖定時拋出錯誤
   */
  setState(updates, reason = "狀態更新") {
    if (this.isLocked) {
      console.warn("狀態被鎖定，無法更新");
      return false;
    }

    try {
      this.isLocked = true;

      // 記錄變更前狀態
      const previousState = deepClone(this.state);

      // 應用更新
      this._applyUpdates(this.state, updates);

      // 記錄變更歷史
      this._recordChange(previousState, updates, reason);

      // 通知訂閱者
      this._notifySubscribers("state_changed", {
        updates,
        reason,
        newState: this.getState(),
      });

      return true;
    } catch (error) {
      console.error("狀態更新失敗:", error);
      return false;
    } finally {
      this.isLocked = false;
    }
  }

  /**
   * 設定特定路徑的狀態值
   * @param {string} path - 狀態路徑，使用點號分隔
   * @param {*} value - 要設定的值
   * @param {string} [reason='設定狀態值'] - 更新原因
   * @returns {boolean} 設定是否成功
   */
  setStateValue(path, value, reason = "設定狀態值") {
    const updates = createNestedUpdate(path, value);
    return this.setState(updates, reason);
  }

  /**
   * 修改資源數量
   * @param {ResourceType} resourceType - 資源類型
   * @param {number} amount - 變更數量（可為負數）
   * @param {string} [reason='資源變更'] - 變更原因
   * @returns {boolean} 修改是否成功
   */
  modifyResource(resourceType, amount, reason = "資源變更") {
    // 型別檢查
    if (!this._isValidResourceType(resourceType)) {
      console.error(`無效的資源類型: ${resourceType}`);
      return false;
    }

    if (typeof amount !== "number") {
      console.error(`無效的數量類型: ${typeof amount}`);
      return false;
    }

    const currentAmount = this.getStateValue(`resources.${resourceType}`, 0);
    const newAmount = Math.max(0, currentAmount + amount);

    return this.setStateValue(`resources.${resourceType}`, newAmount, reason);
  }

  /**
   * 檢查資源是否足夠
   * @param {ResourceType} resourceType - 資源類型
   * @param {number} amount - 需要的數量
   * @returns {boolean} 資源是否足夠
   */
  hasEnoughResource(resourceType, amount) {
    if (!this._isValidResourceType(resourceType)) {
      return false;
    }

    const currentAmount = this.getStateValue(`resources.${resourceType}`, 0);
    return currentAmount >= amount;
  }

  /**
   * 檢查多種資源是否足夠
   * @param {Partial<Resources>} requirements - 資源需求對應表
   * @returns {boolean} 所有資源是否都足夠
   */
  hasEnoughResources(requirements) {
    return Object.entries(requirements).every(([type, amount]) =>
      this.hasEnoughResource(/** @type {ResourceType} */ (type), amount)
    );
  }

  /**
   * 取得房間資訊
   * @param {number} roomId - 房間ID
   * @returns {Room|null} 房間物件或null（如果不存在）
   */
  getRoom(roomId) {
    const room = this.state.rooms.find((r) => r.id === roomId);
    return room ? deepClone(room) : null;
  }

  /**
   * 取得所有已出租房間
   * @returns {Room[]} 已出租房間陣列
   */
  getOccupiedRooms() {
    return this.state.rooms.filter((room) => room.tenant !== null);
  }

  /**
   * 取得所有空房間
   * @returns {Room[]} 空房間陣列
   */
  getEmptyRooms() {
    return this.state.rooms.filter((room) => room.tenant === null);
  }

  /**
   * 取得所有租客
   * @returns {Tenant[]} 所有租客陣列
   */
  getAllTenants() {
    return this.state.rooms
      .filter((room) => room.tenant)
      .map((room) => /** @type {Tenant} */ (room.tenant));
  }

  /**
   * 根據類型取得租客
   * @param {TenantType} tenantType - 租客類型
   * @returns {Tenant[]} 指定類型的租客陣列
   */
  getTenantsByType(tenantType) {
    if (!this._isValidTenantType(tenantType)) {
      console.warn(`無效的租客類型: ${tenantType}`);
      return [];
    }

    return this.getAllTenants().filter((tenant) => tenant.type === tenantType);
  }

  /**
   * 新增遊戲日誌
   * @param {string} message - 日誌訊息
   * @param {LogType} [type=''] - 日誌類型
   * @param {string|null} [timestamp=null] - 自訂時間戳記
   * @returns {void}
   */
  addLog(message, type = "", timestamp = null) {
    /** @type {LogEntry} */
    const logEntry = {
      day: this.state.day,
      time: this.state.time,
      message,
      type,
      timestamp: timestamp || new Date().toISOString(),
    };

    // 限制日誌數量，避免記憶體問題
    if (this.state.gameLog.length >= 100) {
      this.state.gameLog.shift(); // 移除最老的記錄
    }

    this.state.gameLog.push(logEntry);

    // 通知訂閱者新日誌
    this._notifySubscribers("log_added", { logEntry });
  }

  /**
   * 推進到下一天
   * @returns {boolean} 推進是否成功
   */
  advanceDay() {
    /** @type {Partial<GameStateData>} */
    const updates = {
      day: this.state.day + 1,
      time: "day",
      dailyActions: {
        rentCollected: false,
        harvestUsed: false,
        scavengeUsed: 0,
        harvestCooldown: Math.max(
          0,
          this.state.dailyActions.harvestCooldown - 1
        ),
        maxScavengePerDay: this.state.dailyActions.maxScavengePerDay,
      },
      visitors: [],
      applicants: [],
    };

    const success = this.setState(updates, "推進到下一天");

    if (success) {
      this._notifySubscribers("day_advanced", {
        newDay: this.state.day,
      });
    }

    return success;
  }

  /**
   * 訂閱狀態變更
   * @param {StateEventType} eventType - 事件類型
   * @param {StateSubscriptionCallback} callback - 回調函數
   * @returns {UnsubscribeFunction} 取消訂閱的函數
   */
  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    this.subscribers.get(eventType)?.add(callback);

    // 返回取消訂閱的函數
    return () => {
      const subscribers = this.subscribers.get(eventType);
      if (subscribers) {
        subscribers.delete(callback);
      }
    };
  }

  /**
   * 通知訂閱者
   * @param {StateEventType} eventType - 事件類型
   * @param {Object} data - 事件資料
   * @returns {void}
   * @private
   */
  _notifySubscribers(eventType, data) {
    const subscribers = this.subscribers.get(eventType);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`訂閱者回調錯誤 (${eventType}):`, error);
        }
      });
    }
  }

  /**
   * 應用狀態更新
   * @param {Object} target - 目標物件
   * @param {Object} updates - 更新內容
   * @returns {void}
   * @private
   */
  _applyUpdates(target, updates) {
    Object.entries(updates).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        // 遞歸處理嵌套物件
        if (!target[key] || typeof target[key] !== "object") {
          target[key] = {};
        }
        this._applyUpdates(target[key], value);
      } else {
        // 直接賦值
        target[key] = value;
      }
    });
  }

  /**
   * 記錄狀態變更歷史
   * @param {GameStateData} previousState - 變更前狀態
   * @param {Object} updates - 更新內容
   * @param {string} reason - 變更原因
   * @returns {void}
   * @private
   */
  _recordChange(previousState, updates, reason) {
    /** @type {StateChangeRecord} */
    const change = {
      timestamp: new Date().toISOString(),
      day: this.state.day,
      reason,
      updates: deepClone(updates),
    };

    this.changeHistory.push(change);

    // 限制歷史記錄數量
    if (this.changeHistory.length > 50) {
      this.changeHistory.shift();
    }
  }

  /**
   * 驗證資源類型是否有效
   * @param {string} resourceType - 要驗證的資源類型
   * @returns {resourceType is ResourceType} 是否為有效的資源類型
   * @private
   */
  _isValidResourceType(resourceType) {
    return ["food", "materials", "medical", "fuel", "cash"].includes(
      resourceType
    );
  }

  /**
   * 驗證租客類型是否有效
   * @param {string} tenantType - 要驗證的租客類型
   * @returns {tenantType is TenantType} 是否為有效的租客類型
   * @private
   */
  _isValidTenantType(tenantType) {
    return ["doctor", "worker", "farmer", "soldier", "elder"].includes(
      tenantType
    );
  }

  /**
   * 取得狀態統計資訊
   * @returns {StateStats} 狀態統計資訊
   */
  getStateStats() {
    const tenants = this.getAllTenants();
    const infectedTenants = tenants.filter((t) => t.infected);
    const occupiedRooms = this.getOccupiedRooms();

    return {
      day: this.state.day,
      totalTenants: tenants.length,
      infectedTenants: infectedTenants.length,
      occupiedRooms: occupiedRooms.length,
      totalRooms: this.state.rooms.length,
      totalResources: Object.values(this.state.resources).reduce(
        (sum, val) => sum + val,
        0
      ),
      buildingDefense: this.state.building.defense,
      landlordHunger: this.state.landlord.hunger,
      logEntries: this.state.gameLog.length,
      changeHistory: this.changeHistory.length,
    };
  }

  /**
   * 重設遊戲狀態
   * @param {InitialData|null} [initialData=null] - 重設時使用的初始資料
   * @returns {void}
   */
  reset(initialData = null) {
    this.state = this._createInitialState(initialData);
    this.changeHistory = [];
    this._notifySubscribers("state_reset", { newState: this.getState() });
    console.log("遊戲狀態已重設");
  }

  /**
   * 匯出狀態（用於存檔）
   * @returns {ExportData} 匯出的狀態資料
   */
  export() {
    return {
      state: this.getState(),
      metadata: {
        version: "2.0",
        exportTime: new Date().toISOString(),
        stats: this.getStateStats(),
      },
    };
  }

  /**
   * 匯入狀態（用於讀檔）
   * @param {ExportData} exportedData - 要匯入的狀態資料
   * @returns {void}
   * @throws {Error} 當匯入資料無效時拋出錯誤
   */
  import(exportedData) {
    if (!exportedData.state) {
      throw new Error("無效的存檔資料");
    }

    this.state = deepClone(exportedData.state);
    this.changeHistory = [];
    this._notifySubscribers("state_imported", {
      importedState: this.getState(),
      metadata: exportedData.metadata,
    });

    console.log("狀態匯入完成");
  }
}

export default GameState;

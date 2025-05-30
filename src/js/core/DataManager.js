/**
 * DataManager - 統一資料載入與管理機制（更新版）
 * 職責：
 * 1. 從 JSON 配置檔案載入遊戲資料
 * 2. 整合統一的資料驗證系統
 * 3. 管理資料快取與更新
 * 4. 支援熱重載（開發階段）
 *
 * 設計模式：單例模式 + 工廠模式
 * 核心特性：非同步載入、錯誤處理、快取機制、模組化驗證
 */

import {
  defaultValidatorFactory,
  ValidationResult,
} from "../utils/validators.js";
import { SYSTEM_LIMITS, ERROR_CODES } from "../utils/constants.js";

export class DataManager {
  constructor() {
    // 資料快取系統
    this.cache = new Map();
    this.loadPromises = new Map();

    // 載入狀態追蹤
    this.loadingStatus = {
      tenants: false,
      skills: false,
      events: false,
      rules: false,
    };

    // 錯誤記錄
    this.errorLog = [];
    this.maxErrorLogSize = SYSTEM_LIMITS.HISTORY.MAX_ERROR_LOG;

    // 驗證器工廠實例
    this.validatorFactory = defaultValidatorFactory;

    console.log("📦 DataManager 初始化完成，整合驗證模組");
  }

  /**
   * 載入指定類型的資料
   * @param {string} dataType - 資料類型 (tenants, skills, events, rules)
   * @param {boolean} forceReload - 是否強制重新載入
   * @returns {Promise<any>} 載入的資料
   */
  async loadData(dataType, forceReload = false) {
    // 快取檢查
    if (!forceReload && this.cache.has(dataType)) {
      console.log(`📦 從快取載入 ${dataType} 資料`);
      return this.cache.get(dataType);
    }

    // 防止重複載入
    if (this.loadPromises.has(dataType)) {
      console.log(`⏳ ${dataType} 資料載入中，等待完成...`);
      return this.loadPromises.get(dataType);
    }

    // 建立載入 Promise
    const loadPromise = this._loadFromFile(dataType);
    this.loadPromises.set(dataType, loadPromise);

    try {
      console.log(`🔄 開始載入 ${dataType} 資料...`);
      const data = await loadPromise;

      // 使用新的驗證系統
      const validationResult = this.validateData(dataType, data);

      if (!validationResult.isValid) {
        const firstError = validationResult.getFirstError();
        throw new Error(`資料驗證失敗: ${firstError?.message || "未知錯誤"}`);
      }

      // 記錄驗證警告
      if (validationResult.warnings.length > 0) {
        console.warn(`⚠️ ${dataType} 資料驗證警告:`, validationResult.warnings);
      }

      // 快取資料
      this.cache.set(dataType, data);
      this.loadingStatus[dataType] = true;

      console.log(`✅ 成功載入並驗證 ${dataType} 資料`);

      // 特殊處理：rules 載入完成後初始化 GameHelpers
      if (dataType === "rules" && data && window.gameApp) {
        try {
          if (
            window.gameApp.gameHelpers &&
            typeof window.gameApp.gameHelpers.injectConfig === "function"
          ) {
            const success = window.gameApp.gameHelpers.injectConfig(data);
            console.log(
              success
                ? "✅ GameHelpers 配置注入成功"
                : "⚠️ GameHelpers 配置注入失敗"
            );
          }
        } catch (error) {
          console.warn("⚠️ GameHelpers 初始化失敗:", error.message);
        }
      }

      return data;
    } catch (error) {
      const errorMessage = `載入 ${dataType} 資料失敗: ${error.message}`;
      console.error(`❌ ${errorMessage}`);

      // 記錄錯誤
      this.recordError(dataType, error);

      // 嘗試使用預設資料
      console.warn(`🔄 嘗試使用 ${dataType} 預設資料...`);
      const defaultData = this.getDefaultData(dataType);

      if (defaultData) {
        // 驗證預設資料
        const defaultValidation = this.validateData(dataType, defaultData);
        if (defaultValidation.isValid) {
          this.cache.set(dataType, defaultData);
          this.loadingStatus[dataType] = true;
          console.log(`✅ ${dataType} 預設資料載入成功`);
          return defaultData;
        } else {
          console.error(`❌ 預設資料也驗證失敗:`, defaultValidation.errors);
        }
      }

      throw new Error(errorMessage);
    } finally {
      // 清除載入 Promise
      this.loadPromises.delete(dataType);
    }
  }

  /**
   * 從檔案載入資料
   * @private
   */
  async _loadFromFile(dataType) {
    const filename = `data/${dataType}.json`;

    try {
      const response = await fetch(filename);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error.name === "SyntaxError") {
        throw new Error(`JSON 檔案格式錯誤: ${error.message}`);
      }

      if (error.message.includes("404")) {
        throw new Error(`找不到配置檔案: ${filename}`);
      }

      throw error;
    }
  }

  /**
   * 資料驗證（使用新的驗證系統）
   * @param {string} dataType - 資料類型
   * @param {any} data - 待驗證的資料
   * @returns {ValidationResult} 驗證結果
   */
  validateData(dataType, data) {
    try {
      const validationResult = this.validatorFactory.validate(dataType, data);

      if (validationResult.isValid) {
        console.log(`✅ ${dataType} 資料驗證通過`);
      } else {
        console.warn(`⚠️ ${dataType} 資料驗證失敗:`, validationResult.errors);
      }

      return validationResult;
    } catch (error) {
      console.error(`❌ 驗證器執行錯誤:`, error);
      return new ValidationResult(false).addError(
        `驗證過程發生錯誤: ${error.message}`,
        null,
        ERROR_CODES.DATA_VALIDATION_FAILED
      );
    }
  }

  /**
   * 記錄錯誤
   * @private
   */
  recordError(dataType, error) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      dataType,
      error: error.message,
      stack: error.stack,
      code: ERROR_CODES.DATA_LOAD_FAILED,
    };

    this.errorLog.unshift(errorRecord);

    // 限制錯誤記錄大小
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxErrorLogSize);
    }
  }

  /**
   * 取得預設資料（當 JSON 檔案不存在時的後備方案）
   * @param {string} dataType - 資料類型
   * @returns {any} 預設資料
   */
  getDefaultData(dataType) {
    const defaults = {
      tenants: [
        {
          typeId: "doctor",
          typeName: "醫生",
          category: "doctor",
          rent: 15,
          skill: "醫療",
          infectionRisk: 0.1,
          description: "可以治療感染，檢測可疑租客，提供醫療服務",
          personalResources: {
            food: 3,
            materials: 0,
            medical: 5,
            fuel: 0,
            cash: 20,
          },
          skillIds: [
            "heal_infection",
            "health_check",
            "medical_production",
            "emergency_training",
          ],
        },
        {
          typeId: "worker",
          typeName: "工人",
          category: "worker",
          rent: 12,
          skill: "維修",
          infectionRisk: 0.2,
          description: "擅長維修建築，房間升級，建築改良",
          personalResources: {
            food: 4,
            materials: 8,
            medical: 0,
            fuel: 0,
            cash: 15,
          },
          skillIds: [
            "efficient_repair",
            "reinforce_room",
            "daily_maintenance",
            "building_upgrade",
          ],
        },
        {
          typeId: "farmer",
          typeName: "農夫",
          category: "farmer",
          rent: 10,
          skill: "種植",
          infectionRisk: 0.15,
          description: "提升院子採集效率，種植作物，野外採集",
          personalResources: {
            food: 8,
            materials: 2,
            medical: 0,
            fuel: 0,
            cash: 12,
          },
          skillIds: [
            "harvest_bonus",
            "plant_crops",
            "wild_foraging",
            "food_preservation",
          ],
        },
      ],

      skills: {
        doctor: [
          {
            id: "heal_infection",
            name: "治療感染",
            type: "active",
            description: "治療感染的租客（消耗：3醫療用品 + $12酬勞）",
            cost: { medical: 3, cash: 12 },
            cooldown: 0,
            effects: [{ type: "healTenant", target: "infected" }],
          },
        ],
        worker: [
          {
            id: "efficient_repair",
            name: "專業維修",
            type: "active",
            description: "以更少建材維修房間（只需1建材 + $10工資）",
            cost: { materials: 1, cash: 10 },
            cooldown: 0,
            effects: [{ type: "repairRoom", target: "needsRepair" }],
          },
        ],
      },

      events: {
        random_events: [
          {
            id: "zombie_attack",
            title: "殭屍襲擊",
            description: "一群殭屍正在靠近房屋！",
            priority: 1,
            choices: [
              {
                id: "fortify_defense",
                text: "加固防禦 (-5建材)",
                conditions: [
                  { type: "hasResource", resource: "materials", amount: 5 },
                ],
                effects: [
                  { type: "modifyResource", resource: "materials", amount: -5 },
                  {
                    type: "modifyState",
                    path: "buildingDefense",
                    value: 2,
                    operation: "add",
                  },
                ],
              },
            ],
          },
        ],
        conflict_events: [],
        special_events: [],
      },

      rules: {
        gameBalance: {
          landlord: {
            dailyFoodConsumption: 2,
            hungerSystem: {
              levels: [
                { threshold: 0, name: "飽足", severity: "good" },
                { threshold: 1, name: "微餓", severity: "normal" },
                { threshold: 3, name: "飢餓", severity: "danger" },
                { threshold: 5, name: "極度飢餓", severity: "critical" },
              ],
            },
          },
          tenants: {
            dailyFoodConsumption: 2,
            satisfactionSystem: {
              baseValue: 50,
              range: { min: 0, max: 100 },
            },
          },
          resources: {
            starting: {
              food: 20,
              materials: 15,
              medical: 10,
              fuel: 8,
              cash: 50,
            },
          },
        },
        mechanics: {
          harvest: { baseAmount: 2, cooldownDays: 2 },
          scavenging: { maxPerDay: 2 },
          building: { maxRooms: 6 },
        },
        progression: {
          tenantUnlocks: {},
        },
      },
    };

    return defaults[dataType] || {};
  }

  /**
   * 取得快取的資料
   * @param {string} dataType - 資料類型
   * @returns {any} 快取的資料，如果不存在則返回 null
   */
  getCachedData(dataType) {
    return this.cache.get(dataType) || null;
  }

  /**
   * 檢查資料是否已載入
   * @param {string} dataType - 資料類型
   * @returns {boolean} 是否已載入
   */
  isDataLoaded(dataType) {
    return this.cache.has(dataType) && this.loadingStatus[dataType];
  }

  /**
   * 清除快取
   * @param {string|null} dataType - 資料類型，如果為 null 則清除全部
   */
  clearCache(dataType = null) {
    if (dataType) {
      this.cache.delete(dataType);
      this.loadingStatus[dataType] = false;
      console.log(`🗑️ 清除 ${dataType} 快取`);
    } else {
      this.cache.clear();
      Object.keys(this.loadingStatus).forEach((key) => {
        this.loadingStatus[key] = false;
      });
      console.log("🗑️ 清除所有資料快取");
    }
  }

  /**
   * 取得所有已載入的資料類型
   * @returns {string[]} 已載入的資料類型陣列
   */
  getLoadedDataTypes() {
    return Array.from(this.cache.keys()).filter(
      (type) => this.loadingStatus[type]
    );
  }

  /**
   * 批次載入多種資料
   * @param {string[]} dataTypes - 資料類型陣列
   * @param {boolean} forceReload - 是否強制重新載入
   * @returns {Promise<Object>} 載入結果，包含成功和失敗的資料
   */
  async loadMultiple(dataTypes, forceReload = false) {
    console.log(`📦 批次載入資料: ${dataTypes.join(", ")}`);

    const promises = dataTypes.map(async (type) => {
      try {
        const data = await this.loadData(type, forceReload);
        return { type, status: "fulfilled", data };
      } catch (error) {
        return { type, status: "rejected", error: error.message };
      }
    });

    const results = await Promise.all(promises);

    const loaded = {};
    const errors = {};

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        loaded[result.type] = result.data;
      } else {
        errors[result.type] = result.error;
      }
    });

    const successCount = Object.keys(loaded).length;
    const errorCount = Object.keys(errors).length;

    console.log(`📊 批次載入完成: ${successCount} 成功, ${errorCount} 失敗`);

    if (errorCount > 0) {
      console.warn("⚠️ 載入失敗的資料類型:", Object.keys(errors));
    }

    return { loaded, errors };
  }

  /**
   * 取得資料載入狀態統計
   * @returns {Object} 載入狀態統計資訊
   */
  getLoadingStatus() {
    const total = Object.keys(this.loadingStatus).length;
    const loaded = Object.values(this.loadingStatus).filter(Boolean).length;
    const progress = total > 0 ? (loaded / total) * 100 : 0;

    return {
      total,
      loaded,
      progress: Math.round(progress),
      details: { ...this.loadingStatus },
      errors: this.errorLog.length,
      cacheSize: this.cache.size,
    };
  }

  /**
   * 取得錯誤記錄
   * @param {number} limit - 返回的錯誤記錄數量限制
   * @returns {Array} 錯誤記錄陣列
   */
  getErrorLog(limit = 10) {
    return this.errorLog.slice(0, limit);
  }

  /**
   * 清除錯誤記錄
   */
  clearErrorLog() {
    this.errorLog = [];
    console.log("🗑️ 已清除錯誤記錄");
  }

  /**
   * 驗證指定資料類型
   * @param {string} dataType - 資料類型
   * @param {any} data - 資料內容
   * @returns {ValidationResult} 驗證結果
   */
  validateSpecificData(dataType, data) {
    return this.validateData(dataType, data);
  }

  /**
   * 取得驗證器工廠
   * @returns {ValidatorFactory} 驗證器工廠實例
   */
  getValidatorFactory() {
    return this.validatorFactory;
  }

  /**
   * 匯出偵錯資訊
   * @returns {Object} 完整的偵錯資訊
   */
  getDebugInfo() {
    return {
      loadingStatus: this.getLoadingStatus(),
      cachedDataTypes: this.getLoadedDataTypes(),
      errorLog: this.getErrorLog(),
      validatorTypes: this.validatorFactory.getAvailableTypes(),
      cacheInfo: {
        size: this.cache.size,
        keys: Array.from(this.cache.keys()),
      },
      activePromises: Array.from(this.loadPromises.keys()),
      systemLimits: {
        maxErrorLogSize: this.maxErrorLogSize,
      },
    };
  }
}

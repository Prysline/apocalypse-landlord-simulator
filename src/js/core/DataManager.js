/**
 * DataManager - 統一資料載入與管理機制
 * 職責：
 * 1. 從 JSON 配置檔案載入遊戲資料
 * 2. 整合 ConfigValidators 驗證系統
 * 3. 管理資料快取與更新
 * 4. 支援熱重載（開發階段）
 *
 * 設計模式：單例模式 + 工廠模式
 * 核心特性：非同步載入、錯誤處理、快取機制、配置驅動驗證
 */

import {
  defaultValidatorFactory,
  ValidationResult,
  ValidationUtils,
} from "../utils/validators.js";
import {
  SYSTEM_LIMITS,
  ERROR_CODES,
  MESSAGE_TEMPLATES,
} from "../utils/constants.js";

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

    // 驗證結果記錄（新增）
    this.validationResults = new Map();

    // 錯誤記錄
    this.errorLog = [];
    this.maxErrorLogSize = SYSTEM_LIMITS.HISTORY.MAX_ERROR_LOG;

    // 驗證器工廠實例
    this.validatorFactory = defaultValidatorFactory;

    console.log("📦 DataManager 初始化完成，整合 ConfigValidators 系統");
    console.log(
      "🔍 可用驗證器類型:",
      this.validatorFactory.getAvailableTypes()
    );
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

      // 使用 ConfigValidators 驗證系統
      const validationResult = this.validateConfigData(dataType, data);

      if (!validationResult.isValid) {
        const firstError = validationResult.getFirstError();
        const errorMessage = firstError?.message || "未知驗證錯誤";

        // 記錄詳細驗證失敗資訊
        console.error(`❌ ${dataType} 配置驗證失敗:`, {
          errorCount: validationResult.errors.length,
          warningCount: validationResult.warnings.length,
          firstError: firstError,
          summary: this._getValidationSummary(validationResult),
        });

        throw new Error(`配置驗證失敗: ${errorMessage}`);
      }

      // 處理驗證警告
      if (validationResult.warnings.length > 0) {
        console.warn(
          `⚠️ ${dataType} 配置驗證警告 (${validationResult.warnings.length}個):`
        );
        validationResult.warnings.forEach((warning, index) => {
          console.warn(
            `  ${index + 1}. ${warning.message}${
              warning.field ? ` (欄位: ${warning.field})` : ""
            }`
          );
        });
      }

      // 快取資料和驗證結果
      this.cache.set(dataType, data);
      this.validationResults.set(dataType, validationResult);
      this.loadingStatus[dataType] = true;

      console.log(`✅ 成功載入並驗證 ${dataType} 資料`, {
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
        isValid: validationResult.isValid,
      });

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
        const defaultValidation = this.validateConfigData(
          dataType,
          defaultData
        );
        if (defaultValidation.isValid) {
          this.cache.set(dataType, defaultData);
          this.validationResults.set(dataType, defaultValidation);
          this.loadingStatus[dataType] = true;
          console.log(`✅ ${dataType} 預設資料載入並驗證成功`);
          return defaultData;
        } else {
          console.error(`❌ 預設資料也驗證失敗:`, defaultValidation.errors);
          this.recordValidationFailure(dataType, defaultValidation);
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
   * 配置資料驗證（使用 ConfigValidators）
   * @param {string} dataType - 資料類型
   * @param {any} data - 待驗證的配置資料
   * @returns {ValidationResult} 驗證結果
   */
  validateConfigData(dataType, data) {
    try {
      console.log(`🔍 開始驗證 ${dataType} 配置資料...`);

      // 使用 ConfigValidators 系統
      const validationResult = this.validatorFactory.validateConfig(
        dataType,
        data
      );

      // 記錄驗證統計
      const summary = this._getValidationSummary(validationResult);
      console.log(`📊 ${dataType} 驗證統計:`, summary);

      if (validationResult.isValid) {
        console.log(`✅ ${dataType} 配置驗證通過`);
      } else {
        console.warn(`⚠️ ${dataType} 配置驗證失敗`);
      }

      return validationResult;
    } catch (error) {
      console.error(`❌ ConfigValidator 執行錯誤:`, error);

      const errorResult = new ValidationResult(false).addError(
        `配置驗證過程發生錯誤: ${error.message}`,
        null,
        ERROR_CODES.DATA_VALIDATION_FAILED,
        `${dataType} 配置驗證`
      );

      this.recordValidationFailure(dataType, errorResult);
      return errorResult;
    }
  }

  /**
   * 取得驗證結果摘要
   * @private
   */
  _getValidationSummary(validationResult) {
    return {
      isValid: validationResult.isValid,
      errorCount: validationResult.errors.length,
      warningCount: validationResult.warnings.length,
      timestamp: validationResult.timestamp,
      hasContext: !!validationResult.context,
    };
  }

  /**
   * 記錄驗證失敗
   * @private
   */
  recordValidationFailure(dataType, validationResult) {
    const failureRecord = {
      timestamp: new Date().toISOString(),
      dataType,
      errorCount: validationResult.errors.length,
      warningCount: validationResult.warnings.length,
      errors: validationResult.errors.slice(0, 5), // 只記錄前5個錯誤
      code: ERROR_CODES.DATA_VALIDATION_FAILED,
    };

    this.errorLog.unshift(failureRecord);

    // 限制錯誤記錄大小
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxErrorLogSize);
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
          rarity: "uncommon",
          traits: ["professional", "cautious", "valuable"],
          baseStats: {
            health: 90,
            workEfficiency: 85,
            socialability: 70,
            survivability: 75,
          },
          preferences: {
            roomType: "clean",
            neighbors: ["worker", "elder"],
            conflicts: ["soldier"],
          },
          unlockConditions: {
            day: 3,
          },
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
          rarity: "common",
          traits: ["practical", "hardworking", "reliable"],
          baseStats: {
            health: 95,
            workEfficiency: 90,
            socialability: 60,
            survivability: 80,
          },
          preferences: {
            roomType: "workshop",
            neighbors: ["farmer", "doctor"],
            conflicts: [],
          },
          unlockConditions: {
            day: 1,
          },
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
          rarity: "common",
          traits: ["natural", "patient", "resourceful"],
          baseStats: {
            health: 85,
            workEfficiency: 75,
            socialability: 80,
            survivability: 85,
          },
          preferences: {
            roomType: "garden_view",
            neighbors: ["elder", "worker"],
            conflicts: ["soldier"],
          },
          unlockConditions: {
            day: 1,
          },
        },
      ],

      skills: {
        doctor: [
          {
            id: "heal_infection",
            name: "治療感染",
            type: "active",
            description: "治療感染的租客（消耗：3醫療用品 + $12酬勞）",
            icon: "🏥",
            cost: { medical: 3, cash: 12 },
            cooldown: 0,
            requirements: {
              conditions: [
                {
                  type: "hasTenantType",
                  value: "infected",
                  count: 1,
                },
              ],
            },
            effects: [
              {
                type: "modifyState",
                target: "infected_tenant",
                path: "infected",
                value: false,
              },
              {
                type: "logMessage",
                message: "醫生成功治癒了感染租客",
                logType: "skill",
              },
            ],
            successRate: 95,
            priority: 1,
          },
        ],
        worker: [
          {
            id: "efficient_repair",
            name: "專業維修",
            type: "active",
            description: "以更少建材維修房間（只需1建材 + $10工資）",
            icon: "🔧",
            cost: { materials: 1, cash: 10 },
            cooldown: 0,
            requirements: {
              conditions: [
                {
                  type: "gameStateCheck",
                  path: "rooms",
                  operator: "hasNeedsRepair",
                  value: true,
                },
              ],
            },
            effects: [
              {
                type: "repairRoom",
                target: "needsRepair",
              },
              {
                type: "logMessage",
                message: "工人專業維修了房間",
                logType: "skill",
              },
            ],
            successRate: 100,
            priority: 1,
          },
        ],
      },

      events: {
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
              conditions: [
                {
                  type: "dayRange",
                  min: 3,
                },
              ],
            },
            choices: [
              {
                id: "fortify_defense",
                text: "加固防禦 (-5建材)",
                icon: "🛡️",
                conditions: [
                  {
                    type: "hasResource",
                    resource: "materials",
                    amount: 5,
                  },
                ],
                effects: [
                  {
                    type: "modifyResource",
                    resource: "materials",
                    amount: -5,
                  },
                  {
                    type: "modifyState",
                    path: "buildingDefense",
                    value: 2,
                    operation: "add",
                  },
                  {
                    type: "logMessage",
                    message: "成功抵禦襲擊",
                    logType: "event",
                  },
                ],
              },
            ],
          },
        ],
        conflict_events: [],
        special_events: [],
        scripted_events: [],
      },

      rules: {
        gameDefaults: {
          initialResources: {
            food: 20,
            materials: 15,
            medical: 10,
            fuel: 8,
            cash: 50,
          },
          initialRooms: {
            count: 2,
            defaultState: {
              needsRepair: false,
              reinforced: false,
              tenant: null,
            },
          },
        },
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
              factors: {
                reinforcedRoom: 3,
                needsRepair: -8,
                lowPersonalFood: -10,
                highPersonalCash: 5,
              },
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
            dailyConsumption: {
              fuel: 1,
            },
            warningThresholds: {
              food: 5,
              materials: 3,
              medical: 2,
              fuel: 2,
              cash: 15,
            },
          },
        },
        mechanics: {
          harvest: {
            baseAmount: 2,
            farmerBonus: 2,
            cooldownDays: 2,
          },
          scavenging: {
            maxPerDay: 2,
            baseSuccessRates: {
              soldier: 85,
              worker: 75,
              farmer: 65,
              doctor: 50,
              elder: 40,
            },
          },
          building: {
            maxRooms: 6,
            repairCosts: {
              base: 3,
              withWorker: 2,
            },
          },
          events: {
            randomEventChance: 0.3,
            conflictBaseChance: 0.25,
          },
        },
        progression: {
          tenantUnlocks: {
            doctor: {
              minDay: 3,
              conditions: ["medical_emergency_survived"],
            },
            soldier: {
              minDay: 7,
              conditions: ["buildingDefense >= 3"],
            },
            elder: {
              minDay: 5,
              conditions: ["totalTenants >= 2"],
            },
          },
        },
        ui: {
          colorSchemes: {
            critical: "#ff6666",
            danger: "#ff3333",
            warning: "#ffaa66",
            normal: "#ffcc66",
            good: "#66ccff",
            excellent: "#66ff66",
          },
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
   * 取得驗證結果
   * @param {string} dataType - 資料類型
   * @returns {ValidationResult|null} 驗證結果，如果不存在則返回 null
   */
  getValidationResult(dataType) {
    return this.validationResults.get(dataType) || null;
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
   * 檢查資料是否驗證通過
   * @param {string} dataType - 資料類型
   * @returns {boolean} 是否驗證通過
   */
  isDataValid(dataType) {
    const result = this.getValidationResult(dataType);
    return result ? result.isValid : false;
  }

  /**
   * 清除快取
   * @param {string|null} dataType - 資料類型，如果為 null 則清除全部
   */
  clearCache(dataType = null) {
    if (dataType) {
      this.cache.delete(dataType);
      this.validationResults.delete(dataType);
      this.loadingStatus[dataType] = false;
      console.log(`🗑️ 清除 ${dataType} 快取和驗證結果`);
    } else {
      this.cache.clear();
      this.validationResults.clear();
      Object.keys(this.loadingStatus).forEach((key) => {
        this.loadingStatus[key] = false;
      });
      console.log("🗑️ 清除所有資料快取和驗證結果");
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
        const validation = this.getValidationResult(type);
        return {
          type,
          status: "fulfilled",
          data,
          validation: validation
            ? this._getValidationSummary(validation)
            : null,
        };
      } catch (error) {
        return { type, status: "rejected", error: error.message };
      }
    });

    const results = await Promise.all(promises);

    const loaded = {};
    const errors = {};
    const validations = {};

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        loaded[result.type] = result.data;
        if (result.validation) {
          validations[result.type] = result.validation;
        }
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

    return { loaded, errors, validations };
  }

  /**
   * 取得資料載入狀態統計
   * @returns {Object} 載入狀態統計資訊
   */
  getLoadingStatus() {
    const total = Object.keys(this.loadingStatus).length;
    const loaded = Object.values(this.loadingStatus).filter(Boolean).length;
    const progress = total > 0 ? (loaded / total) * 100 : 0;

    // 統計驗證結果
    const validationStats = {
      total: this.validationResults.size,
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: 0,
    };

    this.validationResults.forEach((result) => {
      if (result.isValid) {
        validationStats.passed++;
      } else {
        validationStats.failed++;
      }
      validationStats.warnings += result.warnings.length;
      validationStats.errors += result.errors.length;
    });

    return {
      total,
      loaded,
      progress: Math.round(progress),
      details: { ...this.loadingStatus },
      errors: this.errorLog.length,
      cacheSize: this.cache.size,
      validation: validationStats,
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
   * 驗證指定配置資料
   * @param {string} dataType - 資料類型
   * @param {any} data - 資料內容
   * @returns {ValidationResult} 驗證結果
   */
  validateSpecificData(dataType, data) {
    return this.validateConfigData(dataType, data);
  }

  /**
   * 批次驗證多種配置資料
   * @param {Object} dataMap - 資料類型與資料的映射
   * @returns {Object} 驗證結果映射
   */
  validateMultipleConfigs(dataMap) {
    console.log(`🔍 批次驗證配置: ${Object.keys(dataMap).join(", ")}`);

    const results = this.validatorFactory.validateMultipleConfigs(dataMap);

    // 記錄批次驗證統計
    const summary = ValidationUtils.summarizeValidationResults(results);
    console.log(`📊 批次驗證統計:`, summary);

    return results;
  }

  /**
   * 取得驗證器工廠
   * @returns {ValidatorFactory} 驗證器工廠實例
   */
  getValidatorFactory() {
    return this.validatorFactory;
  }

  /**
   * 格式化驗證結果為可讀字串
   * @param {string} dataType - 資料類型
   * @returns {string} 格式化的驗證結果
   */
  getFormattedValidationResult(dataType) {
    const result = this.getValidationResult(dataType);
    if (!result) {
      return `${dataType}: 未找到驗證結果`;
    }

    return ValidationUtils.formatValidationResult(result);
  }

  /**
   * 匯出偵錯資訊
   * @returns {Object} 完整的偵錯資訊
   */
  getDebugInfo() {
    const loadingStatus = this.getLoadingStatus();

    return {
      loadingStatus,
      cachedDataTypes: this.getLoadedDataTypes(),
      errorLog: this.getErrorLog(),
      validatorTypes: this.validatorFactory.getAvailableTypes(),
      validatorStats: this.validatorFactory.getStats(),
      validationResults: Object.fromEntries(
        Array.from(this.validationResults.entries()).map(([type, result]) => [
          type,
          this._getValidationSummary(result),
        ])
      ),
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

  /**
   * 健康檢查
   * @returns {Object} 系統健康狀態
   */
  healthCheck() {
    const status = this.getLoadingStatus();
    const validatorStats = this.validatorFactory.getStats();

    return {
      status: status.loaded === status.total ? "healthy" : "degraded",
      dataLoading: {
        progress: status.progress,
        loaded: status.loaded,
        total: status.total,
        errors: status.errors,
      },
      validation: {
        systemReady: validatorStats.total > 0,
        configValidators: validatorStats.configValidators,
        instanceValidators: validatorStats.instanceValidators,
        resultsStored: this.validationResults.size,
      },
      cache: {
        size: this.cache.size,
        hitRate:
          this.cache.size > 0 ? (status.loaded / this.cache.size) * 100 : 0,
      },
      errors: {
        count: this.errorLog.length,
        recent: this.errorLog.slice(0, 3),
      },
    };
  }
}

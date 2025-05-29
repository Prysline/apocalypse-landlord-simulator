/**
 * DataManager - 統一資料載入與管理機制
 * 職責：
 * 1. 從 JSON 配置檔案載入遊戲資料
 * 2. 提供資料驗證與一致性檢查
 * 3. 管理資料快取與更新
 * 4. 支援熱重載（開發階段）
 */
class DataManager {
  constructor() {
    this.cache = new Map();
    this.validators = new Map();
    this.loadPromises = new Map();

    // 註冊資料驗證器
    this.registerValidators();
  }

  /**
   * 註冊各種資料類型的驗證器
   */
  registerValidators() {
    // 租客資料驗證器
    this.validators.set("tenants", (data) => {
      if (!Array.isArray(data)) throw new Error("租客資料必須是陣列");

      data.forEach((tenant, index) => {
        const required = [
          "typeId",
          "typeName",
          "category",
          "rent",
          "skill",
          "infectionRisk",
        ];
        required.forEach((field) => {
          if (!(field in tenant)) {
            throw new Error(`租客 ${index}: 缺少必要欄位 ${field}`);
          }
        });

        if (typeof tenant.rent !== "number" || tenant.rent <= 0) {
          throw new Error(`租客 ${index}: 房租必須是正數`);
        }

        if (
          typeof tenant.infectionRisk !== "number" ||
          tenant.infectionRisk < 0 ||
          tenant.infectionRisk > 1
        ) {
          throw new Error(`租客 ${index}: 感染風險必須是 0-1 之間的數值`);
        }
      });

      return true;
    });

    // 技能資料驗證器
    this.validators.set("skills", (data) => {
      if (typeof data !== "object" || data === null) {
        throw new Error("技能資料必須是物件");
      }

      Object.entries(data).forEach(([tenantType, skills]) => {
        if (!Array.isArray(skills)) {
          throw new Error(`租客類型 ${tenantType} 的技能必須是陣列`);
        }

        skills.forEach((skill, index) => {
          const required = ["id", "name", "type", "description"];
          required.forEach((field) => {
            if (!(field in skill)) {
              throw new Error(
                `${tenantType} 技能 ${index}: 缺少必要欄位 ${field}`
              );
            }
          });
        });
      });

      return true;
    });

    // 事件資料驗證器
    this.validators.set("events", (data) => {
      if (!Array.isArray(data)) throw new Error("事件資料必須是陣列");

      data.forEach((event, index) => {
        const required = ["id", "title", "description", "trigger", "choices"];
        required.forEach((field) => {
          if (!(field in event)) {
            throw new Error(`事件 ${index}: 缺少必要欄位 ${field}`);
          }
        });

        if (!Array.isArray(event.choices)) {
          throw new Error(`事件 ${index}: choices 必須是陣列`);
        }
      });

      return true;
    });

    // 規則資料驗證器
    this.validators.set("rules", (data) => {
      if (typeof data !== "object" || data === null) {
        throw new Error("規則資料必須是物件");
      }

      const requiredSections = ["gameBalance", "mechanics", "progression"];
      requiredSections.forEach((section) => {
        if (!(section in data)) {
          throw new Error(`規則資料缺少必要區塊: ${section}`);
        }
      });

      return true;
    });
  }

  /**
   * 載入指定類型的資料
   * @param {string} dataType - 資料類型 (tenants, skills, events, rules)
   * @param {boolean} forceReload - 是否強制重新載入
   * @returns {Promise<any>} 載入的資料
   */
  async loadData(dataType, forceReload = false) {
    // 檢查快取
    if (!forceReload && this.cache.has(dataType)) {
      return this.cache.get(dataType);
    }

    // 檢查是否已在載入中（避免重複載入）
    if (this.loadPromises.has(dataType)) {
      return this.loadPromises.get(dataType);
    }

    // 建立載入 Promise
    const loadPromise = this._loadFromFile(dataType);
    this.loadPromises.set(dataType, loadPromise);

    try {
      const data = await loadPromise;

      // 資料驗證
      this.validateData(dataType, data);

      // 快取資料
      this.cache.set(dataType, data);

      console.log(`✅ 成功載入 ${dataType} 資料:`, data);

      // 當 rules 載入完成後，注入到 GameHelpers
      if (dataType === "rules" && data) {
        if (
          window.GameHelpers &&
          typeof window.initializeGameHelpers === "function"
        ) {
          const success = window.initializeGameHelpers(data);
          console.log(
            success
              ? "✅ GameHelpers 配置注入成功"
              : "⚠️ GameHelpers 配置注入失敗"
          );
        }
      } 

      return data;
    } catch (error) {
      console.error(`❌ 載入 ${dataType} 資料失敗:`, error);
      throw error;
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
      // 在瀏覽器環境中使用 fetch
      const response = await fetch(filename);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // 如果檔案不存在，提供預設資料
      console.warn(`⚠️ 無法載入 ${filename}，使用預設資料`);
      return this.getDefaultData(dataType);
    }
  }

  /**
   * 資料驗證
   */
  validateData(dataType, data) {
    const validator = this.validators.get(dataType);
    if (validator) {
      return validator(data);
    }
    console.warn(`⚠️ 沒有為 ${dataType} 註冊驗證器`);
    return true;
  }

  /**
   * 取得預設資料（當 JSON 檔案不存在時）
   */
  getDefaultData(dataType) {
    const defaults = {
      tenants: [
        {
          name: "醫生",
          type: "doctor",
          rent: 15,
          skill: "醫療",
          infectionRisk: 0.1,
          description: "可以治療感染，檢測可疑租客，提供醫療服務",
          personalResources: { food: 3, medical: 5, cash: 20 },
        },
      ],
      skills: {
        doctor: [
          {
            id: "healInfection",
            name: "治療感染",
            type: "active",
            description: "治療感染的租客",
            cost: { medical: 3, cash: 12 },
            cooldown: 0,
          },
        ],
      },
      events: [
        {
          id: "zombie_attack",
          title: "殭屍襲擊",
          description: "一群殭屍正在靠近房屋！",
          trigger: { type: "random", probability: 0.3 },
          choices: [
            {
              text: "加固防禦",
              condition: { resource: "materials", amount: 5 },
              effect: { resource: { materials: -5 }, defense: 2 },
            },
          ],
        },
      ],
      rules: {
        gameBalance: {
          landlordDailyFood: 2,
          tenantDailyFood: 2,
          harvestCooldown: 2,
        },
        mechanics: {
          maxScavengePerDay: 2,
          baseHarvestAmount: 2,
        },
        progression: {
          maxTenants: 6,
          unlockThresholds: {},
        },
      },
    };

    return defaults[dataType] || {};
  }

  /**
   * 取得快取的資料
   */
  getCachedData(dataType) {
    return this.cache.get(dataType);
  }

  /**
   * 清除快取
   */
  clearCache(dataType = null) {
    if (dataType) {
      this.cache.delete(dataType);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 取得所有已載入的資料類型
   */
  getLoadedDataTypes() {
    return Array.from(this.cache.keys());
  }

  /**
   * 檢查資料是否已載入
   */
  isDataLoaded(dataType) {
    return this.cache.has(dataType);
  }

  /**
   * 批次載入多種資料
   */
  async loadMultiple(dataTypes, forceReload = false) {
    const promises = dataTypes.map((type) => this.loadData(type, forceReload));
    const results = await Promise.allSettled(promises);

    const loaded = {};
    const errors = {};

    results.forEach((result, index) => {
      const dataType = dataTypes[index];
      if (result.status === "fulfilled") {
        loaded[dataType] = result.value;
      } else {
        errors[dataType] = result.reason;
      }
    });

    return { loaded, errors };
  }
}

// 建立全域實例
window.dataManager = new DataManager();

export default DataManager;

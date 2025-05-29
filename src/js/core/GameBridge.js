/**
 * GameBridge - 新舊系統整合橋接器
 *
 * 架構設計原理：
 * 1. 適配器模式：包裝原始 gameState，提供統一介面
 * 2. 外觀模式：隱藏複雜的新舊系統交互邏輯
 * 3. 代理模式：攔截關鍵操作，選擇性啟用新功能
 * 4. 策略模式：根據配置動態選擇執行路徑
 */
class GameBridge {
  constructor(originalGameState) {
    this.originalGameState = originalGameState;
    this.newSystemEnabled = new Map();
    this.migrationStatus = new Map();

    // 系統模組對應表
    this.systemModules = {
      tenants: { enabled: false, migrated: false },
      skills: { enabled: false, migrated: false },
      events: { enabled: false, migrated: false },
      rules: { enabled: false, migrated: false },
    };

    // 初始化橋接器
    this.initializeBridge();
  }

  /**
   * 初始化橋接系統
   */
  async initializeBridge() {
    console.log("🌉 正在初始化遊戲橋接系統...");

    try {
      // 檢查新系統可用性
      await this.checkNewSystemAvailability();

      // 建立資料映射
      this.createDataMappings();

      // 建立功能代理
      this.createFunctionProxies();

      console.log("✅ 橋接系統初始化完成");
    } catch (error) {
      console.error("❌ 橋接系統初始化失敗:", error);
      console.log("🔄 回退到原始系統");
      this.fallbackToOriginalSystem();
    }
  }

  /**
   * 檢查新系統可用性
   */
  async checkNewSystemAvailability() {
    // 檢查 DataManager
    if (window.dataManager) {
      console.log("📊 DataManager 可用");

      // 嘗試載入各種資料
      const dataTypes = ["tenants", "skills", "events", "rules"];
      for (const dataType of dataTypes) {
        try {
          await window.dataManager.loadData(dataType);
          this.systemModules[dataType].enabled = true;
          console.log(`✅ ${dataType} 資料載入成功`);
        } catch (error) {
          console.warn(
            `⚠️ ${dataType} 資料載入失敗，使用原始資料:`,
            error.message
          );
        }
      }
    }

    // 檢查 RuleEngine
    if (window.ruleEngine || window.createRuleEngine) {
      console.log("⚙️ RuleEngine 可用");

      if (!window.ruleEngine) {
        window.ruleEngine = window.createRuleEngine(this.originalGameState);
      }
    }
  }

  /**
   * 建立資料映射
   */
  createDataMappings() {
    this.dataMappings = {
      // 租客資料映射
      tenants: {
        original: () => window.tenantTypes || [],
        new: () => window.dataManager?.getCachedData("tenants") || [],
        merger: (original, newData) => this.mergeTenantData(original, newData),
      },

      // 技能資料映射
      skills: {
        original: () => this.extractOriginalSkills(),
        new: () => window.dataManager?.getCachedData("skills") || {},
        merger: (original, newData) => this.mergeSkillData(original, newData),
      },

      // 事件資料映射
      events: {
        original: () => window.events || [],
        new: () => window.dataManager?.getCachedData("events") || {},
        merger: (original, newData) => this.mergeEventData(original, newData),
      },
    };
  }

  /**
   * 建立功能代理
   */
  createFunctionProxies() {
    // 代理租客生成函數
    this.proxyTenantGeneration();

    // 代理技能執行函數
    this.proxySkillExecution();

    // 代理事件系統
    this.proxyEventSystem();

    // 代理遊戲規則
    this.proxyGameRules();
  }

  /**
   * 代理租客生成函數
   */
  proxyTenantGeneration() {
    // 保存原始函數
    window.originalGenerateApplicants = window.generateApplicants;

    // 建立新的代理函數
    window.generateApplicants = () => {
      if (this.systemModules.tenants.enabled) {
        return this.generateApplicantsFromConfig();
      } else {
        return window.originalGenerateApplicants();
      }
    };
  }

  /**
   * 從配置生成申請者
   */
  generateApplicantsFromConfig() {
    const tenantConfigs = window.dataManager.getCachedData("tenants");
    if (!tenantConfigs) {
      console.warn("⚠️ 租客配置不可用，使用原始方法");
      return window.originalGenerateApplicants();
    }

    this.originalGameState.applicants = [];
    const count = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < count; i++) {
      // 根據解鎖條件過濾可用租客
      const availableTenants = this.filterAvailableTenants(tenantConfigs);
      const config =
        availableTenants[Math.floor(Math.random() * availableTenants.length)];

      const applicant = {
        ...config,
        name: this.generateName(),
        infected: Math.random() < config.infectionRisk,
        id: Date.now() + i,
        personalResources: { ...config.personalResources },
      };

      if (applicant.infected) {
        applicant.appearance = this.getInfectedAppearance();
      } else {
        applicant.appearance = this.getNormalAppearance();
      }

      this.originalGameState.applicants.push(applicant);
    }

    console.log(`📋 使用新配置生成了 ${count} 個申請者`);
  }

  /**
   * 根據解鎖條件過濾租客
   */
  filterAvailableTenants(tenantConfigs) {
    return tenantConfigs.filter((config) => {
      const unlockConditions = config.unlockConditions;
      if (!unlockConditions) return true;

      // 檢查日期條件
      if (
        unlockConditions.day &&
        this.originalGameState.day < unlockConditions.day
      ) {
        return false;
      }

      // 檢查建築防禦條件
      if (
        unlockConditions.buildingDefense &&
        this.originalGameState.buildingDefense <
          unlockConditions.buildingDefense
      ) {
        return false;
      }

      // 檢查租客總數條件
      if (unlockConditions.totalTenants) {
        const currentTenants = this.originalGameState.rooms.filter(
          (room) => room.tenant
        ).length;
        if (currentTenants < unlockConditions.totalTenants) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 代理技能執行系統
   */
  proxySkillExecution() {
    // 保存原始函數
    window.originalUseSkill = window.useSkill;

    // 建立新的代理函數
    window.useSkill = (tenantName, skillAction) => {
      if (this.systemModules.skills.enabled) {
        return this.executeSkillFromConfig(tenantName, skillAction);
      } else {
        return window.originalUseSkill(tenantName, skillAction);
      }
    };
  }

  /**
   * 從配置執行技能
   */
  executeSkillFromConfig(tenantName, skillAction) {
    const skillConfigs = window.dataManager.getCachedData("skills");
    if (!skillConfigs) {
      console.warn("⚠️ 技能配置不可用，使用原始方法");
      return window.originalUseSkill(tenantName, skillAction);
    }

    const tenant = this.findTenantByName(tenantName);
    if (!tenant) {
      console.error(`❌ 找不到租客: ${tenantName}`);
      return;
    }

    const tenantSkills = skillConfigs[tenant.type];
    const skillConfig = tenantSkills?.find((skill) => skill.id === skillAction);

    if (!skillConfig) {
      console.warn(`⚠️ 找不到技能配置: ${skillAction}，使用原始方法`);
      return window.originalUseSkill(tenantName, skillAction);
    }

    // 使用 RuleEngine 執行技能
    if (window.ruleEngine) {
      return this.executeSkillWithRuleEngine(tenant, skillConfig);
    } else {
      // 後備方案：直接執行效果
      return this.executeSkillDirectly(tenant, skillConfig);
    }
  }

  /**
   * 使用規則引擎執行技能
   */
  executeSkillWithRuleEngine(tenant, skillConfig) {
    // 建立臨時規則
    const tempRuleId = `skill_${skillConfig.id}_${Date.now()}`;

    const ruleConfig = {
      name: skillConfig.name,
      description: skillConfig.description,
      conditions: skillConfig.requirements?.conditions || [],
      effects: skillConfig.effects || [],
      priority: skillConfig.priority || 1,
    };

    // 註冊並執行規則
    window.ruleEngine.registerRule(tempRuleId, ruleConfig);
    const result = window.ruleEngine.executeRule(tempRuleId, { tenant });

    console.log(`🎯 使用規則引擎執行技能: ${skillConfig.name}`, result);
    return result;
  }

  /**
   * 直接執行技能效果
   */
  executeSkillDirectly(tenant, skillConfig) {
    console.log(`⚡ 直接執行技能: ${skillConfig.name}`);

    // 檢查成本
    const cost = skillConfig.cost || {};
    if (!this.canAffordCost(cost)) {
      console.warn("❌ 資源不足，無法執行技能");
      return { executed: false, reason: "insufficient_resources" };
    }

    // 支付成本
    this.payCost(cost, tenant);

    // 執行效果
    const results = [];
    (skillConfig.effects || []).forEach((effect) => {
      const result = this.executeEffect(effect);
      results.push(result);
    });

    // 更新顯示
    if (typeof window.updateDisplay === "function") {
      window.updateDisplay();
    }

    return { executed: true, results };
  }

  /**
   * 執行效果
   */
  executeEffect(effect) {
    switch (effect.type) {
      case "modifyResource":
        this.originalGameState.resources[effect.resource] = Math.max(
          0,
          (this.originalGameState.resources[effect.resource] || 0) +
            effect.amount
        );
        return {
          type: "resource",
          resource: effect.resource,
          amount: effect.amount,
        };

      case "modifyState":
        this.setNestedValue(this.originalGameState, effect.path, effect.value);
        return { type: "state", path: effect.path, value: effect.value };

      case "logMessage":
        if (typeof window.addLog === "function") {
          window.addLog(effect.message, effect.logType || "event");
        }
        return { type: "log", message: effect.message };

      default:
        console.warn(`⚠️ 未知的效果類型: ${effect.type}`);
        return { type: "unknown", effect };
    }
  }

  /**
   * 工具函數：設定嵌套物件值
   */
  setNestedValue(obj, path, value) {
    const keys = path.split(".");
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * 檢查是否能負擔成本
   */
  canAffordCost(cost) {
    return Object.keys(cost).every((resource) => {
      if (resource === "cash") {
        return this.originalGameState.resources.cash >= cost[resource];
      } else {
        return (
          (this.originalGameState.resources[resource] || 0) >= cost[resource]
        );
      }
    });
  }

  /**
   * 支付成本
   */
  payCost(cost, tenant) {
    let totalPayment = 0;

    Object.keys(cost).forEach((resource) => {
      if (resource === "cash") {
        this.originalGameState.resources.cash -= cost[resource];
        totalPayment += cost[resource];
      } else {
        this.originalGameState.resources[resource] -= cost[resource];
      }
    });

    // 支付給租客
    if (totalPayment > 0 && tenant && tenant.personalResources) {
      tenant.personalResources.cash =
        (tenant.personalResources.cash || 0) + totalPayment;
      if (typeof window.addLog === "function") {
        window.addLog(`💰 支付 ${tenant.name} 工資 $${totalPayment}`, "rent");
      }
    }
  }

  /**
   * 尋找租客
   */
  findTenantByName(name) {
    return this.originalGameState.rooms
      .filter((room) => room.tenant && room.tenant.name === name)
      .map((room) => room.tenant)[0];
  }

  /**
   * 系統遷移管理
   */
  migrateSystem(systemName) {
    if (!this.systemModules[systemName]) {
      console.error(`❌ 未知的系統: ${systemName}`);
      return false;
    }

    if (this.systemModules[systemName].migrated) {
      console.log(`ℹ️ 系統 ${systemName} 已經遷移`);
      return true;
    }

    console.log(`🔄 開始遷移系統: ${systemName}`);

    try {
      switch (systemName) {
        case "tenants":
          this.migrateTenantSystem();
          break;
        case "skills":
          this.migrateSkillSystem();
          break;
        case "events":
          this.migrateEventSystem();
          break;
        case "rules":
          this.migrateRuleSystem();
          break;
      }

      this.systemModules[systemName].migrated = true;
      console.log(`✅ 系統 ${systemName} 遷移完成`);
      return true;
    } catch (error) {
      console.error(`❌ 系統 ${systemName} 遷移失敗:`, error);
      return false;
    }
  }

  /**
   * 回退到原始系統
   */
  fallbackToOriginalSystem() {
    // 恢復原始函數
    if (window.originalGenerateApplicants) {
      window.generateApplicants = window.originalGenerateApplicants;
    }

    if (window.originalUseSkill) {
      window.useSkill = window.originalUseSkill;
    }

    // 清除新系統標記
    Object.keys(this.systemModules).forEach((key) => {
      this.systemModules[key].enabled = false;
    });

    console.log("🔄 已回退到原始系統");
  }

  /**
   * 獲取系統狀態
   */
  getSystemStatus() {
    return {
      bridge: {
        initialized: true,
        version: "1.0.0",
      },
      modules: { ...this.systemModules },
      compatibility: {
        dataManager: !!window.dataManager,
        ruleEngine: !!window.ruleEngine,
        originalGameState: !!this.originalGameState,
      },
    };
  }

  /**
   * 除錯資訊
   */
  debugInfo() {
    console.group("🌉 GameBridge 除錯資訊");
    console.log("系統狀態:", this.getSystemStatus());
    console.log("原始遊戲狀態:", this.originalGameState);
    console.log("資料映射:", Object.keys(this.dataMappings));
    console.groupEnd();
  }
}

// 初始化橋接系統
window.initializeGameBridge = async (gameState) => {
  if (!window.gameBridge) {
    window.gameBridge = new GameBridge(gameState);
    await window.gameBridge.initializeBridge();

    console.log("🎮 遊戲橋接系統已就緒");
    return window.gameBridge;
  }

  return window.gameBridge;
};

export default GameBridge;

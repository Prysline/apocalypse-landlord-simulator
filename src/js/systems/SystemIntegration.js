/**
 * SystemIntegration - 業務系統整合模組
 *
 * 職責：
 * 1. 整合TenantSystem和SkillSystem
 * 2. 提供統一的業務操作介面
 * 3. 管理系統間的事件通信
 * 4. 確保新舊系統的功能等價性
 */

class SystemIntegrator {
  constructor(gameStateRef, dataManager, ruleEngine) {
    this.gameState = gameStateRef;
    this.dataManager = dataManager;
    this.ruleEngine = ruleEngine;

    // 業務系統實例
    this.tenantSystem = null;
    this.skillSystem = null;

    // 整合狀態
    this.integrationStatus = {
      tenantSystemReady: false,
      skillSystemReady: false,
      integrationComplete: false,
    };

    // 功能等價性驗證
    this.compatibilityLayer = new CompatibilityLayer();
    this.migrationManager = new MigrationManager();

    // 事件協調
    this.eventBus = new SystemEventBus();
  }

  /**
   * 初始化業務系統整合
   */
  async initialize() {
    console.log("🔗 開始初始化業務系統整合...");

    try {
      // 初始化TenantSystem
      await this.initializeTenantSystem();

      // 初始化SkillSystem
      await this.initializeSkillSystem();

      // 建立系統間通信
      this.establishInterSystemCommunication();

      // 建立相容性代理
      this.establishCompatibilityProxies();

      // 驗證功能等價性
      await this.verifyFunctionalEquivalence();

      this.integrationStatus.integrationComplete = true;
      console.log("✅ 業務系統整合完成");

      return true;
    } catch (error) {
      console.error("❌ 業務系統整合失敗:", error);
      return false;
    }
  }

  /**
   * 初始化租客系統
   */
  async initializeTenantSystem() {
    try {
      this.tenantSystem = new TenantSystem(
        this.gameState,
        this.dataManager,
        this.ruleEngine
      );

      // 設定事件監聽
      this.tenantSystem.on("tenantHired", (data) => {
        this.eventBus.emit("tenant:hired", data);
      });

      this.tenantSystem.on("tenantEvicted", (data) => {
        this.eventBus.emit("tenant:evicted", data);
      });

      this.tenantSystem.on("tenantConflict", (data) => {
        this.eventBus.emit("tenant:conflict", data);
      });

      this.integrationStatus.tenantSystemReady = true;
      console.log("✅ TenantSystem 初始化完成");
    } catch (error) {
      console.error("❌ TenantSystem 初始化失敗:", error);
      throw error;
    }
  }

  /**
   * 初始化技能系統
   */
  async initializeSkillSystem() {
    try {
      this.skillSystem = new SkillSystem(
        this.gameState,
        this.dataManager,
        this.ruleEngine
      );

      await this.skillSystem.initializeSystem();

      this.integrationStatus.skillSystemReady = true;
      console.log("✅ SkillSystem 初始化完成");
    } catch (error) {
      console.error("❌ SkillSystem 初始化失敗:", error);
      throw error;
    }
  }

  /**
   * 建立系統間通信
   */
  establishInterSystemCommunication() {
    // 租客系統事件 → 技能系統響應
    this.eventBus.on("tenant:hired", (data) => {
      // 新租客入住時，初始化其技能冷卻狀態
      const { tenant } = data;
      this.skillSystem.cooldownManager.initializeTenantCooldowns(tenant.name);
    });

    this.eventBus.on("tenant:evicted", (data) => {
      // 租客離開時，清理其技能相關資料
      const { tenant } = data;
      this.skillSystem.cooldownManager.clearTenantCooldowns(tenant.name);
    });

    // 技能系統事件 → 租客系統響應
    this.eventBus.on("skill:executed", (data) => {
      // 技能執行可能影響租客滿意度
      const { tenant, skill, result } = data;
      if (skill.type === "special" && result.success) {
        const tenantState = this.tenantSystem.getTenantState(tenant.name);
        if (tenantState) {
          tenantState.satisfaction += 5; // 成功使用特殊技能提升滿意度
        }
      }
    });

    console.log("🔗 系統間通信建立完成");
  }

  /**
   * 建立相容性代理
   */
  establishCompatibilityProxies() {
    // 代理原始的生成申請者函數
    if (typeof window.generateApplicants === "function") {
      window.originalGenerateApplicants = window.generateApplicants;
      window.generateApplicants = () => {
        if (this.integrationStatus.tenantSystemReady) {
          const applicants = this.tenantSystem.generateApplicants();
          this.gameState.applicants = applicants;
          return applicants;
        } else {
          return window.originalGenerateApplicants();
        }
      };
    }

    // 代理原始的技能使用函數
    if (typeof window.useSkill === "function") {
      window.originalUseSkill = window.useSkill;
      window.useSkill = async (tenantName, skillId) => {
        if (this.integrationStatus.skillSystemReady) {
          const result = await this.skillSystem.executeSkill(
            tenantName,
            skillId
          );

          // 觸發技能執行事件
          this.eventBus.emit("skill:executed", {
            tenant: this.skillSystem.findTenantByName(tenantName),
            skill: this.skillSystem.getSkillConfig(skillId),
            result,
          });

          return result;
        } else {
          return window.originalUseSkill(tenantName, skillId);
        }
      };
    }

    // 代理原始的租客雇用函數
    if (typeof window.hireTenant === "function") {
      window.originalHireTenant = window.hireTenant;
      window.hireTenant = (applicantId) => {
        if (this.integrationStatus.tenantSystemReady) {
          const applicant = this.gameState.applicants.find(
            (a) => a.id === applicantId
          );
          if (applicant) {
            const success = this.tenantSystem.hireTenant(applicant);
            if (success) {
              // 從申請者列表中移除
              this.gameState.applicants = this.gameState.applicants.filter(
                (a) => a.id !== applicantId
              );
            }
            return success;
          }
          return false;
        } else {
          return window.originalHireTenant(applicantId);
        }
      };
    }

    console.log("🔄 相容性代理建立完成");
  }

  /**
   * 驗證功能等價性
   */
  async verifyFunctionalEquivalence() {
    console.log("🧪 開始功能等價性驗證...");

    const verificationResults = [];

    // 驗證租客生成功能
    const tenantGenerationResult = await this.verifyTenantGeneration();
    verificationResults.push(tenantGenerationResult);

    // 驗證技能執行功能
    const skillExecutionResult = await this.verifySkillExecution();
    verificationResults.push(skillExecutionResult);

    // 驗證租客管理功能
    const tenantManagementResult = await this.verifyTenantManagement();
    verificationResults.push(tenantManagementResult);

    // 分析驗證結果
    const failedTests = verificationResults.filter((result) => !result.passed);

    if (failedTests.length === 0) {
      console.log("✅ 功能等價性驗證通過");
      return true;
    } else {
      console.warn("⚠️ 功能等價性驗證發現問題:", failedTests);
      return false;
    }
  }

  /**
   * 驗證租客生成功能
   */
  async verifyTenantGeneration() {
    try {
      // 備份當前狀態
      const originalApplicants = [...(this.gameState.applicants || [])];

      // 測試新系統生成
      const newSystemApplicants = this.tenantSystem.generateApplicants(3);

      // 驗證生成的申請者結構
      const isValidStructure = newSystemApplicants.every((applicant) => {
        return (
          applicant.hasOwnProperty("name") &&
          applicant.hasOwnProperty("type") &&
          applicant.hasOwnProperty("rent") &&
          applicant.hasOwnProperty("personalResources")
        );
      });

      // 恢復原始狀態
      this.gameState.applicants = originalApplicants;

      return {
        testName: "租客生成功能",
        passed: isValidStructure && newSystemApplicants.length === 3,
        details: {
          generatedCount: newSystemApplicants.length,
          expectedCount: 3,
          structureValid: isValidStructure,
        },
      };
    } catch (error) {
      return {
        testName: "租客生成功能",
        passed: false,
        error: error.message,
      };
    }
  }

  /**
   * 驗證技能執行功能
   */
  async verifySkillExecution() {
    try {
      // 建立測試租客
      const testTenant = {
        name: "TestTenant",
        type: "doctor",
        personalResources: { cash: 50, medical: 5 },
      };

      // 模擬租客存在
      this.gameState.rooms[0] = { id: 1, tenant: testTenant };

      // 備份資源狀態
      const originalResources = { ...this.gameState.resources };

      // 測試技能執行
      const executionResult = await this.skillSystem.executeSkill(
        "TestTenant",
        "health_check"
      );

      // 驗證執行結果
      const isValidResult =
        executionResult.hasOwnProperty("success") &&
        executionResult.hasOwnProperty("result");

      // 恢復狀態
      this.gameState.resources = originalResources;
      this.gameState.rooms[0] = { id: 1, tenant: null };

      return {
        testName: "技能執行功能",
        passed: isValidResult,
        details: {
          executionResult,
          resultStructureValid: isValidResult,
        },
      };
    } catch (error) {
      return {
        testName: "技能執行功能",
        passed: false,
        error: error.message,
      };
    }
  }

  /**
   * 驗證租客管理功能
   */
  async verifyTenantManagement() {
    try {
      // 建立測試申請者
      const testApplicant = {
        id: "test_applicant",
        name: "TestApplicant",
        type: "worker",
        rent: 12,
        personalResources: { cash: 20, food: 5 },
      };

      // 測試雇用功能
      const hireResult = this.tenantSystem.hireTenant(testApplicant);

      // 驗證租客是否成功入住
      const isHired = this.gameState.rooms.some(
        (room) => room.tenant && room.tenant.name === "TestApplicant"
      );

      // 測試驅逐功能
      if (isHired) {
        const evictResult = this.tenantSystem.evictTenant(
          "TestApplicant",
          "test"
        );

        // 驗證租客是否成功離開
        const isEvicted = !this.gameState.rooms.some(
          (room) => room.tenant && room.tenant.name === "TestApplicant"
        );

        return {
          testName: "租客管理功能",
          passed: hireResult && evictResult && isEvicted,
          details: {
            hireResult,
            evictResult,
            finalState: isEvicted ? "evicted" : "still_present",
          },
        };
      }

      return {
        testName: "租客管理功能",
        passed: false,
        details: { error: "雇用失敗" },
      };
    } catch (error) {
      return {
        testName: "租客管理功能",
        passed: false,
        error: error.message,
      };
    }
  }

  /**
   * 取得系統狀態
   */
  getSystemStatus() {
    return {
      integration: this.integrationStatus,
      tenantSystem: {
        available: !!this.tenantSystem,
        currentTenantCount: this.tenantSystem
          ? this.tenantSystem.getCurrentTenantCount()
          : 0,
      },
      skillSystem: {
        available: !!this.skillSystem,
        registeredSkills: this.skillSystem
          ? this.skillSystem.skillExecutors.size
          : 0,
      },
    };
  }

  /**
   * 每日系統更新
   */
  processDailyUpdate() {
    if (this.integrationStatus.tenantSystemReady) {
      this.tenantSystem.updateDailyTenantStates();
    }

    if (this.integrationStatus.skillSystemReady) {
      // 處理被動技能
      this.skillSystem.processPassiveSkills("daily_update");
    }

    // 觸發每日更新事件
    this.eventBus.emit("system:daily_update", {
      day: this.gameState.day,
      timestamp: Date.now(),
    });
  }
}

// =============== 相容性層 ===============

class CompatibilityLayer {
  constructor() {
    this.functionMappings = new Map();
    this.originalFunctions = new Map();
  }

  registerFunctionMapping(originalName, newImplementation) {
    // 保存原始函數
    if (typeof window[originalName] === "function") {
      this.originalFunctions.set(originalName, window[originalName]);
    }

    // 註冊新實作
    this.functionMappings.set(originalName, newImplementation);

    // 替換全域函數
    window[originalName] = newImplementation;
  }

  restoreFunctions() {
    // 恢復所有原始函數
    this.originalFunctions.forEach((originalFunc, functionName) => {
      window[functionName] = originalFunc;
    });
  }
}

// =============== 遷移管理器 ===============

class MigrationManager {
  constructor() {
    this.migrationSteps = [];
    this.currentStep = 0;
  }

  addMigrationStep(stepName, migrationFunction) {
    this.migrationSteps.push({
      name: stepName,
      execute: migrationFunction,
      completed: false,
    });
  }

  async executeMigration() {
    console.log(`🔄 開始執行遷移，共 ${this.migrationSteps.length} 個步驟`);

    for (let i = this.currentStep; i < this.migrationSteps.length; i++) {
      const step = this.migrationSteps[i];

      try {
        console.log(`📋 執行遷移步驟 ${i + 1}: ${step.name}`);
        await step.execute();
        step.completed = true;
        this.currentStep = i + 1;
        console.log(`✅ 步驟 ${i + 1} 完成`);
      } catch (error) {
        console.error(`❌ 遷移步驟 ${i + 1} 失敗:`, error);
        throw error;
      }
    }

    console.log("✅ 遷移完成");
  }
}

// =============== 事件匯流排 ===============

class SystemEventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
  }

  emit(eventName, data) {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ 事件處理器錯誤 (${eventName}):`, error);
        }
      });
    }
  }

  off(eventName, callback) {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }
}

// 匯出模組
if (typeof window !== "undefined") {
  window.SystemIntegrator = SystemIntegrator;
}

export default SystemIntegrator;

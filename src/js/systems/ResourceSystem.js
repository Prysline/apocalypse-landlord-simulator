/**
 * ResourceSystem.js - 資源管理系統
 *
 * 職責：
 * - 資源狀態管理（讀取、更新、驗證）
 * - 消費計算引擎（房東、建築、租客消費）
 * - 生產與採集機制（院子採集、搜刮任務）
 * - 交換與交易（固定匯率表交易）
 *
 * 架構特點：
 * - 完全配置驅動，所有參數來自 rules.json
 * - 整合統一驗證機制
 * - 標準化介面，與 TenantSystem 協作
 * - 事件驅動通信，支援模組解耦
 *
 * 協作邊界：
 * - TenantSystem：擁有個人資源數據
 * - ResourceSystem：提供資源操作介面
 * - 主系統：負責冷卻管理
 *
 * v2.1 特點：
 * - 簡化經濟系統（無稀缺性分析、通膨調整）
 * - 固定匯率表交易機制
 * - 統一的資源摘要記錄
 */

import {
  defaultValidatorFactory,
  ValidationResult,
  ValidationUtils,
} from "../utils/validators.js";
import {
  DATA_TYPES,
  ERROR_CODES,
  MESSAGE_TEMPLATES,
} from "../utils/constants.js";

export class ResourceSystem {
  constructor(gameStateRef, dataManager, gameHelpers) {
    this.gameState = gameStateRef;
    this.dataManager = dataManager;
    this.gameHelpers = gameHelpers;

    // 系統狀態
    this.initialized = false;
    this.configLoaded = false;

    // 資源摘要記錄
    this.resourceSummary = {
      totalGained: {},
      totalConsumed: {},
      dailyNet: {},
      tradingVolume: {},
      lastUpdateDay: 0,
    };

    // 交易系統
    this.tradeHistory = [];
    this.exchangeRates = null;

    // 搜刮系統
    this.scavengeRewards = null;
    this.scavengeRisks = null;

    // 事件監聽器
    this.eventListeners = new Map();

    // 驗證器實例
    this.resourceValidator = null;

    // 驗證統計
    this.validationStats = {
      operationsValidated: 0,
      validationErrors: 0,
      tradesValidated: 0,
      tradeErrors: 0,
    };

    console.log("💰 ResourceSystem v2.1 初始化中...");
  }

  /**
   * 系統初始化
   */
  async initialize() {
    try {
      console.log("📊 載入資源系統配置...");

      // 初始化驗證器
      this.initializeValidators();

      // 載入配置
      await this.loadResourceConfigurations();

      // 初始化資源摘要
      this.initializeResourceSummary();

      // 驗證遊戲狀態資源
      await this.validateGameStateResources();

      this.configLoaded = true;
      this.initialized = true;

      console.log("✅ ResourceSystem 初始化完成");
      console.log("📋 系統配置:", {
        exchangeRates: !!this.exchangeRates,
        scavengeRewards: !!this.scavengeRewards,
        validator: !!this.resourceValidator,
      });

      return true;
    } catch (error) {
      console.error("❌ ResourceSystem 初始化失敗:", error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * 初始化驗證器
   */
  initializeValidators() {
    this.resourceValidator =
      defaultValidatorFactory.getInstanceValidator("resource");

    if (!this.resourceValidator) {
      console.warn("⚠️ ResourceValidator 不可用，使用後備驗證");
    }

    console.log("🔍 ResourceSystem 驗證器初始化完成");
  }

  /**
   * 載入資源配置
   */
  async loadResourceConfigurations() {
    // 載入交易匯率表
    this.exchangeRates = this.gameHelpers
      ? this.gameHelpers.getGameBalance(
          "economy.rentPayment.resourceExchangeRates",
          {
            food: 1.5,
            materials: 3,
            medical: 4,
            fuel: 3,
          }
        )
      : {
          food: 1.5,
          materials: 3,
          medical: 4,
          fuel: 3,
        };

    // 載入搜刮配置
    this.scavengeRewards = this.gameHelpers
      ? this.gameHelpers.getGameBalance("mechanics.scavenging.rewardRanges", {
          food: { min: 3, max: 8 },
          materials: { min: 2, max: 6 },
          medical: { min: 1, max: 4 },
        })
      : {
          food: { min: 3, max: 8 },
          materials: { min: 2, max: 6 },
          medical: { min: 1, max: 4 },
        };

    // 載入搜刮風險配置
    this.scavengeRisks = this.gameHelpers
      ? this.gameHelpers.getGameBalance(
          "mechanics.scavenging.baseSuccessRates",
          {
            soldier: 85,
            worker: 75,
            farmer: 65,
            doctor: 50,
            elder: 40,
          }
        )
      : {
          soldier: 85,
          worker: 75,
          farmer: 65,
          doctor: 50,
          elder: 40,
        };

    console.log("📋 資源配置載入完成");
  }

  /**
   * 初始化資源摘要
   */
  initializeResourceSummary() {
    const resourceTypes = [
      DATA_TYPES.RESOURCE_TYPES.FOOD,
      DATA_TYPES.RESOURCE_TYPES.MATERIALS,
      DATA_TYPES.RESOURCE_TYPES.MEDICAL,
      DATA_TYPES.RESOURCE_TYPES.FUEL,
      DATA_TYPES.RESOURCE_TYPES.CASH,
    ];

    resourceTypes.forEach((type) => {
      this.resourceSummary.totalGained[type] = 0;
      this.resourceSummary.totalConsumed[type] = 0;
      this.resourceSummary.dailyNet[type] = 0;
      this.resourceSummary.tradingVolume[type] = 0;
    });

    this.resourceSummary.lastUpdateDay = this.gameState.day;
  }

  /**
   * 驗證遊戲狀態資源
   */
  async validateGameStateResources() {
    if (!this.resourceValidator) {
      console.warn("⚠️ 無法驗證資源狀態，跳過驗證");
      return;
    }

    console.log("🔍 驗證遊戲資源狀態...");

    const validationResult = this.validateResources(this.gameState.resources);

    if (!validationResult.isValid) {
      console.error("❌ 遊戲資源狀態驗證失敗:");
      validationResult.errors.forEach((error, index) => {
        console.error(`  ${index + 1}. ${error.message}`);
      });

      // 嘗試修復資源問題
      this.attemptResourceRepair(validationResult);
    } else {
      console.log("✅ 遊戲資源狀態驗證通過");
    }

    if (validationResult.warnings.length > 0) {
      console.warn(`⚠️ 資源狀態警告 (${validationResult.warnings.length}個):`);
      validationResult.warnings.forEach((warning, index) => {
        console.warn(`  ${index + 1}. ${warning.message}`);
      });
    }
  }

  /**
   * 驗證資源物件
   */
  validateResources(resources) {
    if (!this.resourceValidator) {
      return this.validateResourcesFallback(resources);
    }

    try {
      const result = this.resourceValidator.validateResources(resources);
      this.validationStats.operationsValidated++;
      return result;
    } catch (error) {
      console.error("❌ 資源驗證過程發生錯誤:", error);
      this.validationStats.validationErrors++;
      return new ValidationResult(false).addError(
        `資源驗證失敗: ${error.message}`,
        null,
        ERROR_CODES.DATA_VALIDATION_FAILED
      );
    }
  }

  /**
   * 後備資源驗證
   */
  validateResourcesFallback(resources) {
    const result = new ValidationResult(true);

    if (!resources || typeof resources !== "object") {
      return result.addError(
        "資源必須是物件",
        "resources",
        "INVALID_RESOURCE_TYPE"
      );
    }

    const resourceTypes = [
      DATA_TYPES.RESOURCE_TYPES.FOOD,
      DATA_TYPES.RESOURCE_TYPES.MATERIALS,
      DATA_TYPES.RESOURCE_TYPES.MEDICAL,
      DATA_TYPES.RESOURCE_TYPES.FUEL,
      DATA_TYPES.RESOURCE_TYPES.CASH,
    ];

    resourceTypes.forEach((type) => {
      if (resources[type] !== undefined) {
        if (typeof resources[type] !== "number") {
          result.addError(
            `資源 ${type} 必須是數值`,
            `resources.${type}`,
            "INVALID_RESOURCE_TYPE"
          );
        } else if (resources[type] < 0) {
          result.addWarning(
            `資源 ${type} 為負值`,
            `resources.${type}`,
            "NEGATIVE_RESOURCE_VALUE"
          );
        }
      }
    });

    return result;
  }

  /**
   * 嘗試修復資源問題
   */
  attemptResourceRepair(validationResult) {
    console.log("🔧 嘗試修復資源問題...");

    let repairCount = 0;

    validationResult.errors.forEach((error) => {
      switch (error.code) {
        case "INVALID_RESOURCE_TYPE":
          if (error.field === "resources") {
            this.gameState.resources = this.getDefaultResources();
            repairCount++;
            console.log("🔧 修復：重建資源物件");
          } else if (error.field && error.field.startsWith("resources.")) {
            const resourceType = error.field.split(".")[1];
            this.gameState.resources[resourceType] = 0;
            repairCount++;
            console.log(`🔧 修復：重設 ${resourceType} 為數值 0`);
          }
          break;

        case "NEGATIVE_RESOURCE_VALUE":
          if (error.field && error.field.startsWith("resources.")) {
            const resourceType = error.field.split(".")[1];
            this.gameState.resources[resourceType] = 0;
            repairCount++;
            console.log(`🔧 修復：重設負值 ${resourceType} 為 0`);
          }
          break;
      }
    });

    console.log(`🔧 完成資源修復，共修復 ${repairCount} 個問題`);
  }

  /**
   * 核心資源管理 API
   */

  /**
   * 更新資源 - 核心方法
   */
  updateResource(type, amount, reason = "unknown", validateOperation = true) {
    if (!this.initialized) {
      console.warn("⚠️ ResourceSystem 未初始化");
      return false;
    }

    // 驗證操作
    if (validateOperation) {
      const validation = this.validateResourceOperation({
        type,
        amount,
        reason,
        currentValue: this.gameState.resources[type],
      });

      if (!validation.isValid) {
        console.error(
          "❌ 資源操作驗證失敗:",
          validation.getFirstError()?.message
        );
        this.validationStats.validationErrors++;
        return false;
      }
    }

    // 執行更新
    const oldValue = this.gameState.resources[type] || 0;
    const newValue = Math.max(0, oldValue + amount);
    this.gameState.resources[type] = newValue;

    // 記錄到摘要
    this.updateResourceSummary(type, amount, reason);

    // 觸發事件
    this.emitEvent("resourceUpdated", {
      type,
      amount,
      oldValue,
      newValue,
      reason,
      day: this.gameState.day,
    });

    console.log(
      `💰 資源更新: ${type} ${amount > 0 ? "+" : ""}${amount} (${reason})`
    );
    return true;
  }

  /**
   * 驗證資源操作
   */
  validateResourceOperation(operation) {
    const result = new ValidationResult(true);

    // 檢查基本參數
    if (!operation.type || typeof operation.type !== "string") {
      result.addError("資源類型無效", "type", "INVALID_RESOURCE_TYPE");
    }

    if (typeof operation.amount !== "number") {
      result.addError("資源數量必須是數值", "amount", "INVALID_AMOUNT");
    }

    // 檢查資源類型是否支援
    const supportedTypes = [
      DATA_TYPES.RESOURCE_TYPES.FOOD,
      DATA_TYPES.RESOURCE_TYPES.MATERIALS,
      DATA_TYPES.RESOURCE_TYPES.MEDICAL,
      DATA_TYPES.RESOURCE_TYPES.FUEL,
      DATA_TYPES.RESOURCE_TYPES.CASH,
    ];

    if (!supportedTypes.includes(operation.type)) {
      result.addError(
        `不支援的資源類型: ${operation.type}`,
        "type",
        "UNSUPPORTED_RESOURCE_TYPE"
      );
    }

    // 檢查扣除操作是否會導致負值
    if (operation.amount < 0) {
      const currentValue = operation.currentValue || 0;
      const newValue = currentValue + operation.amount;

      if (newValue < 0) {
        result.addError(
          `資源不足: ${
            operation.type
          } 當前 ${currentValue}，嘗試扣除 ${Math.abs(operation.amount)}`,
          "amount",
          "INSUFFICIENT_RESOURCES"
        );
      }
    }

    // 檢查極端數值
    if (Math.abs(operation.amount) > 10000) {
      result.addWarning(
        `異常大的資源變化: ${operation.amount}`,
        "amount",
        "EXTREME_AMOUNT"
      );
    }

    this.validationStats.operationsValidated++;
    return result;
  }

  /**
   * 取得資源狀態
   */
  getResourceStatus(type) {
    if (!this.gameState.resources) {
      return {
        current: 0,
        status: "error",
        message: "資源物件不存在",
      };
    }

    const current = this.gameState.resources[type] || 0;
    const thresholds = this.getResourceThresholds();

    let status = "normal";
    let message = "";

    if (current <= (thresholds.critical[type] || 0)) {
      status = "critical";
      message = "資源極度短缺";
    } else if (current <= (thresholds.warning[type] || 0)) {
      status = "warning";
      message = "資源不足";
    } else if (current >= (thresholds.abundant[type] || 100)) {
      status = "abundant";
      message = "資源充足";
    }

    return {
      current,
      status,
      message,
      daily: this.resourceSummary.dailyNet[type] || 0,
      total: {
        gained: this.resourceSummary.totalGained[type] || 0,
        consumed: this.resourceSummary.totalConsumed[type] || 0,
      },
    };
  }

  /**
   * 取得所有資源狀態
   */
  getAllResourceStatus() {
    const resourceTypes = [
      DATA_TYPES.RESOURCE_TYPES.FOOD,
      DATA_TYPES.RESOURCE_TYPES.MATERIALS,
      DATA_TYPES.RESOURCE_TYPES.MEDICAL,
      DATA_TYPES.RESOURCE_TYPES.FUEL,
      DATA_TYPES.RESOURCE_TYPES.CASH,
    ];

    const status = {};
    resourceTypes.forEach((type) => {
      status[type] = this.getResourceStatus(type);
    });

    return status;
  }

  /**
   * 檢查資源是否足夠
   */
  hasEnoughResources(requirements) {
    if (!requirements || typeof requirements !== "object") {
      return false;
    }

    return Object.keys(requirements).every((type) => {
      const required = requirements[type];
      const current = this.gameState.resources[type] || 0;
      return current >= required;
    });
  }

  /**
   * 消費計算引擎
   */

  /**
   * 處理消費 - 核心方法
   */
  processConsumption(consumptionType, params = {}) {
    console.log(`🔥 處理消費: ${consumptionType}`);

    switch (consumptionType) {
      case "landlord_daily":
        return this.processLandlordDailyConsumption(params);
      case "building_daily":
        return this.processBuildingDailyConsumption(params);
      case "tenant_daily":
        return this.processTenantDailyConsumption(params);
      case "repair":
        return this.processRepairConsumption(params);
      case "upgrade":
        return this.processUpgradeConsumption(params);
      default:
        console.warn(`⚠️ 未知的消費類型: ${consumptionType}`);
        return false;
    }
  }

  /**
   * 房東日常消費
   */
  processLandlordDailyConsumption(params) {
    const consumption = this.gameHelpers
      ? this.gameHelpers.getConsumption()
      : { landlordDailyFood: 2 };

    const foodNeeded = consumption.landlordDailyFood;
    const currentFood =
      this.gameState.resources[DATA_TYPES.RESOURCE_TYPES.FOOD];

    if (currentFood >= foodNeeded) {
      this.updateResource(
        DATA_TYPES.RESOURCE_TYPES.FOOD,
        -foodNeeded,
        "landlord_daily"
      );
      this.gameState.landlordHunger = Math.max(
        0,
        this.gameState.landlordHunger - 1
      );
      this.addLog(`房東消耗了 ${foodNeeded} 食物`, "event");
      return { success: true, consumed: foodNeeded, hungerReduced: true };
    } else if (currentFood >= 1) {
      this.updateResource(
        DATA_TYPES.RESOURCE_TYPES.FOOD,
        -1,
        "landlord_partial"
      );
      this.gameState.landlordHunger += 1;
      this.addLog("食物不足，房東仍感到飢餓", "danger");
      return { success: false, consumed: 1, hungerIncreased: true };
    } else {
      this.gameState.landlordHunger += 2;
      this.addLog("沒有食物！房東非常飢餓", "danger");
      return { success: false, consumed: 0, hungerIncreased: true };
    }
  }

  /**
   * 建築日常消費
   */
  processBuildingDailyConsumption(params) {
    const consumption = this.gameHelpers
      ? this.gameHelpers.getConsumption()
      : { buildingDailyFuel: 1 };

    const fuelNeeded = consumption.buildingDailyFuel;
    const currentFuel =
      this.gameState.resources[DATA_TYPES.RESOURCE_TYPES.FUEL];

    if (currentFuel >= fuelNeeded) {
      this.updateResource(
        DATA_TYPES.RESOURCE_TYPES.FUEL,
        -fuelNeeded,
        "building_daily"
      );
      this.addLog(`房屋設施消耗了 ${fuelNeeded} 燃料`, "event");
      return { success: true, consumed: fuelNeeded };
    } else {
      this.addLog("燃料不足！房屋運作受影響", "danger");
      return { success: false, consumed: 0 };
    }
  }

  /**
   * 租客日常消費（提供標準化介面）
   */
  processTenantDailyConsumption(params) {
    // 這個方法提供給 TenantSystem 調用
    // 實際的個人資源管理由 TenantSystem 負責
    const { tenant, tenantState } = params;

    if (!tenant || !tenant.personalResources) {
      return { success: false, message: "租客資料不完整" };
    }

    const consumption = this.gameHelpers
      ? this.gameHelpers.getConsumption()
      : { tenantDailyFood: 2, elderMedicalConsumption: 1 };

    const result = {
      success: true,
      foodConsumed: 0,
      medicalConsumed: 0,
      issues: [],
    };

    // 食物消費
    const foodNeeded = consumption.tenantDailyFood;
    if (tenant.personalResources.food >= foodNeeded) {
      result.foodConsumed = foodNeeded;
    } else {
      result.success = false;
      result.issues.push("食物不足");
    }

    // 老人醫療消費
    if (tenant.type === "elder" || tenant.typeId === "elder") {
      const medicalNeeded = consumption.elderMedicalConsumption;
      if (tenant.personalResources.medical >= medicalNeeded) {
        result.medicalConsumed = medicalNeeded;
      } else {
        result.issues.push("醫療用品不足");
      }
    }

    return result;
  }

  /**
   * 維修消費
   */
  processRepairConsumption(params) {
    const { hasWorker = false, targetRoom = null } = params;
    const repairCosts = this.gameHelpers
      ? this.gameHelpers.getGameBalance("mechanics.building.repairCosts", {
          base: 3,
          withWorker: 2,
        })
      : { base: 3, withWorker: 2 };

    const materialsNeeded = hasWorker
      ? repairCosts.withWorker
      : repairCosts.base;

    if (!this.hasEnoughResources({ materials: materialsNeeded })) {
      return {
        success: false,
        reason: "materials_insufficient",
        needed: materialsNeeded,
      };
    }

    this.updateResource(
      DATA_TYPES.RESOURCE_TYPES.MATERIALS,
      -materialsNeeded,
      "repair"
    );

    if (targetRoom) {
      targetRoom.needsRepair = false;
    }

    const workerBonus = hasWorker ? " (工人效率加成)" : "";
    this.addLog(
      `維修完成，消耗 ${materialsNeeded} 建材${workerBonus}`,
      "event"
    );

    return { success: true, consumed: materialsNeeded, workerBonus: hasWorker };
  }

  /**
   * 升級消費
   */
  processUpgradeConsumption(params) {
    const { upgradeType, targetRoom = null } = params;
    const upgradeCosts = this.gameHelpers
      ? this.gameHelpers.getGameBalance(
          "mechanics.building.reinforcementCost",
          {
            materials: 4,
            cash: 18,
          }
        )
      : { materials: 4, cash: 18 };

    if (!this.hasEnoughResources(upgradeCosts)) {
      return {
        success: false,
        reason: "resources_insufficient",
        needed: upgradeCosts,
      };
    }

    // 扣除資源
    this.updateResource(
      DATA_TYPES.RESOURCE_TYPES.MATERIALS,
      -upgradeCosts.materials,
      "upgrade"
    );
    this.updateResource(
      DATA_TYPES.RESOURCE_TYPES.CASH,
      -upgradeCosts.cash,
      "upgrade"
    );

    if (targetRoom) {
      targetRoom.reinforced = true;
    }

    this.addLog(
      `房間升級完成，消耗 ${upgradeCosts.materials} 建材和 $${upgradeCosts.cash}`,
      "event"
    );

    return { success: true, consumed: upgradeCosts };
  }

  /**
   * 生產與採集機制
   */

  /**
   * 處理生產 - 核心方法
   */
  processProduction(productionType, params = {}) {
    console.log(`🌱 處理生產: ${productionType}`);

    switch (productionType) {
      case "yard_harvest":
        return this.processYardHarvest(params);
      case "scavenge_mission":
        return this.processScavengeMission(params);
      case "skill_production":
        return this.processSkillProduction(params);
      case "trade_income":
        return this.processTradeIncome(params);
      default:
        console.warn(`⚠️ 未知的生產類型: ${productionType}`);
        return false;
    }
  }

  /**
   * 院子採集
   */
  processYardHarvest(params) {
    const { farmerCount = 0 } = params;
    const harvestConfig = this.gameHelpers
      ? this.gameHelpers.getGameBalance("mechanics.harvest", {
          baseAmount: 2,
          farmerBonus: 2,
        })
      : { baseAmount: 2, farmerBonus: 2 };

    const baseAmount = harvestConfig.baseAmount;
    const totalAmount = baseAmount + farmerCount * harvestConfig.farmerBonus;

    this.updateResource(
      DATA_TYPES.RESOURCE_TYPES.FOOD,
      totalAmount,
      "yard_harvest"
    );

    const bonusText =
      farmerCount > 0
        ? ` (基礎 ${baseAmount} + 農夫加成 ${
            farmerCount * harvestConfig.farmerBonus
          })`
        : "";
    this.addLog(`院子採集獲得 ${totalAmount} 食物${bonusText}`, "rent");

    return {
      success: true,
      amount: totalAmount,
      breakdown: {
        base: baseAmount,
        farmerBonus: farmerCount * harvestConfig.farmerBonus,
      },
    };
  }

  /**
   * 搜刮任務
   */
  processScavengeMission(params) {
    const { tenant, location = "default" } = params;

    if (!tenant) {
      return { success: false, reason: "no_tenant" };
    }

    // 計算成功率
    const successRate = this.calculateScavengeSuccessRate(tenant);
    const isSuccess = Math.random() * 100 < successRate;

    if (!isSuccess) {
      // 失敗可能導致租客受傷或感染
      const injury = this.rollScavengeInjury();
      this.addLog(`${tenant.name} 搜刮失敗並${injury.description}`, "danger");
      return {
        success: false,
        reason: "mission_failed",
        injury: injury,
        successRate: successRate,
      };
    }

    // 成功獲得資源
    const rewards = this.calculateScavengeRewards(tenant, location);
    const totalValue = this.applyScavengeRewards(rewards);

    this.addLog(
      `${tenant.name} 搜刮成功，獲得價值 $${totalValue} 的資源`,
      "rent"
    );

    return {
      success: true,
      rewards: rewards,
      totalValue: totalValue,
      successRate: successRate,
    };
  }

  /**
   * 計算搜刮成功率
   */
  calculateScavengeSuccessRate(tenant) {
    const baseRates = this.scavengeRisks;
    const tenantType = tenant.type || tenant.typeId;
    const baseRate = baseRates[tenantType] || 50;

    // 技能加成
    const bonusFromSkills = this.gameHelpers
      ? this.gameHelpers.getGameBalance(
          "mechanics.scavenging.bonusFromSkills",
          15
        )
      : 15;

    // 裝備/健康狀態修正
    let modifier = 0;
    if (tenant.infected) modifier -= 20;
    if (tenant.personalResources?.medical >= 2) modifier += 5;
    if (tenant.personalResources?.food >= 5) modifier += 5;

    const finalRate = Math.max(10, Math.min(95, baseRate + modifier));
    return finalRate;
  }

  /**
   * 計算搜刮獎勵
   */
  calculateScavengeRewards(tenant, location) {
    const rewardRanges = this.scavengeRewards;
    const rewards = {};

    // 基於租客類型調整獎勵
    const tenantType = tenant.type || tenant.typeId;
    const typeModifiers = {
      doctor: { medical: 1.5, food: 0.8 },
      worker: { materials: 1.5, medical: 0.8 },
      farmer: { food: 1.5, materials: 0.8 },
      soldier: { materials: 1.2, medical: 1.2 },
      elder: { food: 0.7, materials: 0.7, medical: 0.7 },
    };

    const modifier = typeModifiers[tenantType] || {};

    // 生成獎勵
    Object.keys(rewardRanges).forEach((resourceType) => {
      const range = rewardRanges[resourceType];
      const baseAmount =
        Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const typeMultiplier = modifier[resourceType] || 1;
      const finalAmount = Math.floor(baseAmount * typeMultiplier);

      if (finalAmount > 0) {
        rewards[resourceType] = finalAmount;
      }
    });

    // 小機率獲得現金
    if (Math.random() < 0.3) {
      rewards.cash = Math.floor(Math.random() * 15) + 5;
    }

    return rewards;
  }

  /**
   * 應用搜刮獎勵
   */
  applyScavengeRewards(rewards) {
    let totalValue = 0;

    Object.keys(rewards).forEach((resourceType) => {
      const amount = rewards[resourceType];
      this.updateResource(resourceType, amount, "scavenge_reward");

      // 計算等價價值
      const rate = this.exchangeRates[resourceType] || 1;
      totalValue += amount * rate;
    });

    return Math.floor(totalValue);
  }

  /**
   * 搜刮傷害判定
   */
  rollScavengeInjury() {
    const injuries = [
      { description: "輕微受傷", effect: "health", severity: 1 },
      { description: "被殭屍抓傷", effect: "infection_risk", severity: 2 },
      { description: "迷路延遲回歸", effect: "time", severity: 1 },
      { description: "損失個人物品", effect: "resource", severity: 2 },
    ];

    return injuries[Math.floor(Math.random() * injuries.length)];
  }

  /**
   * 技能生產（提供標準化介面）
   */
  processSkillProduction(params) {
    const { skillType, amount, tenant } = params;

    // 驗證參數
    if (!skillType || !amount || amount <= 0) {
      return { success: false, reason: "invalid_parameters" };
    }

    // 確定生產的資源類型
    const resourceMap = {
      medical_production: DATA_TYPES.RESOURCE_TYPES.MEDICAL,
      material_collection: DATA_TYPES.RESOURCE_TYPES.MATERIALS,
      food_production: DATA_TYPES.RESOURCE_TYPES.FOOD,
    };

    const resourceType = resourceMap[skillType];
    if (!resourceType) {
      return { success: false, reason: "unknown_skill_type" };
    }

    this.updateResource(resourceType, amount, `skill_${skillType}`);

    const tenantName = tenant ? tenant.name : "租客";
    this.addLog(
      `${tenantName} 透過技能生產了 ${amount} ${resourceType}`,
      "skill"
    );

    return {
      success: true,
      resourceType: resourceType,
      amount: amount,
      producer: tenantName,
    };
  }

  /**
   * 交易收入
   */
  processTradeIncome(params) {
    const { amount, source = "trade" } = params;

    if (!amount || amount <= 0) {
      return { success: false, reason: "invalid_amount" };
    }

    this.updateResource(DATA_TYPES.RESOURCE_TYPES.CASH, amount, source);
    return { success: true, amount: amount };
  }

  /**
   * 交換與交易機制
   */

  /**
   * 處理交易 - 核心方法
   */
  processTrade(tradeData) {
    console.log("💱 處理交易:", tradeData);

    const validation = this.validateTradeTerms(tradeData);
    if (!validation.isValid) {
      console.error("❌ 交易驗證失敗:", validation.getFirstError()?.message);
      this.validationStats.tradeErrors++;
      return { success: false, error: validation.getFirstError()?.message };
    }

    // 執行交易
    const result = this.executeTrade(tradeData);

    // 記錄交易歷史
    if (result.success) {
      this.recordTrade(tradeData, result);
    }

    this.validationStats.tradesValidated++;
    return result;
  }

  /**
   * 驗證交易條件
   */
  validateTradeTerms(tradeData) {
    const result = new ValidationResult(true);

    // 檢查基本結構
    if (!tradeData || typeof tradeData !== "object") {
      return result.addError(
        "交易資料格式錯誤",
        "tradeData",
        "INVALID_TRADE_FORMAT"
      );
    }

    const { type, give, receive } = tradeData;

    // 檢查交易類型
    const validTypes = ["resource_exchange", "rent_payment", "merchant_trade"];
    if (!validTypes.includes(type)) {
      result.addError(`無效的交易類型: ${type}`, "type", "INVALID_TRADE_TYPE");
    }

    // 檢查交換內容
    if (!give || typeof give !== "object") {
      result.addError("交易付出內容格式錯誤", "give", "INVALID_GIVE_FORMAT");
    }

    if (!receive || typeof receive !== "object") {
      result.addError(
        "交易獲得內容格式錯誤",
        "receive",
        "INVALID_RECEIVE_FORMAT"
      );
    }

    // 檢查是否有足夠資源
    if (give && typeof give === "object") {
      Object.keys(give).forEach((resourceType) => {
        const required = give[resourceType];
        const current = this.gameState.resources[resourceType] || 0;

        if (current < required) {
          result.addError(
            `${resourceType} 不足: 需要 ${required}，目前 ${current}`,
            `give.${resourceType}`,
            "INSUFFICIENT_RESOURCES"
          );
        }
      });
    }

    return result;
  }

  /**
   * 執行交易
   */
  executeTrade(tradeData) {
    const { type, give, receive, description } = tradeData;

    try {
      // 扣除付出的資源
      Object.keys(give).forEach((resourceType) => {
        const amount = give[resourceType];
        this.updateResource(resourceType, -amount, `trade_give_${type}`, false);
      });

      // 增加獲得的資源
      Object.keys(receive).forEach((resourceType) => {
        const amount = receive[resourceType];
        this.updateResource(
          resourceType,
          amount,
          `trade_receive_${type}`,
          false
        );
      });

      // 更新交易量統計
      Object.keys(give).forEach((resourceType) => {
        this.resourceSummary.tradingVolume[resourceType] =
          (this.resourceSummary.tradingVolume[resourceType] || 0) +
          give[resourceType];
      });

      const logMessage =
        description || this.generateTradeDescription(give, receive);
      this.addLog(logMessage, "rent");

      console.log("✅ 交易執行成功");
      return {
        success: true,
        type: type,
        give: give,
        receive: receive,
        description: logMessage,
      };
    } catch (error) {
      console.error("❌ 交易執行失敗:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 計算交易價值
   */
  calculateTradeValue(resources) {
    let totalValue = 0;

    Object.keys(resources).forEach((resourceType) => {
      const amount = resources[resourceType];
      const rate = this.exchangeRates[resourceType] || 1;
      totalValue += amount * rate;
    });

    return totalValue;
  }

  /**
   * 生成交易描述
   */
  generateTradeDescription(give, receive) {
    const giveDesc = Object.keys(give)
      .map((type) => `${give[type]} ${type}`)
      .join(", ");

    const receiveDesc = Object.keys(receive)
      .map((type) => `${receive[type]} ${type}`)
      .join(", ");

    return `交易: ${giveDesc} → ${receiveDesc}`;
  }

  /**
   * 記錄交易歷史
   */
  recordTrade(tradeData, result) {
    const tradeRecord = {
      day: this.gameState.day,
      type: tradeData.type,
      give: tradeData.give,
      receive: tradeData.receive,
      value: this.calculateTradeValue(tradeData.give),
      timestamp: Date.now(),
    };

    this.tradeHistory.push(tradeRecord);

    // 保持最近50筆記錄
    if (this.tradeHistory.length > 50) {
      this.tradeHistory.shift();
    }
  }

  /**
   * 標準化的個人資源操作介面
   */

  /**
   * 驗證個人資源操作
   */
  validatePersonalResourceOperation(tenant, operation) {
    const result = new ValidationResult(true);

    if (!tenant || !tenant.personalResources) {
      return result.addError(
        "租客個人資源資料不存在",
        "tenant",
        "MISSING_PERSONAL_RESOURCES"
      );
    }

    const { type, amount } = operation;

    if (!type || typeof type !== "string") {
      result.addError("資源類型無效", "type", "INVALID_RESOURCE_TYPE");
    }

    if (typeof amount !== "number") {
      result.addError("資源數量必須是數值", "amount", "INVALID_AMOUNT");
    }

    // 檢查扣除操作
    if (amount < 0) {
      const current = tenant.personalResources[type] || 0;
      if (current + amount < 0) {
        result.addError(
          `個人資源不足: ${type} 當前 ${current}，嘗試扣除 ${Math.abs(amount)}`,
          "amount",
          "INSUFFICIENT_PERSONAL_RESOURCES"
        );
      }
    }

    return result;
  }

  /**
   * 個人資源轉移到主資源池
   */
  transferPersonalToMain(tenant, resourceType, amount) {
    const validation = this.validatePersonalResourceOperation(tenant, {
      type: resourceType,
      amount: -amount,
    });

    if (!validation.isValid) {
      return { success: false, error: validation.getFirstError()?.message };
    }

    // 從個人資源扣除
    tenant.personalResources[resourceType] -= amount;

    // 增加到主資源池
    this.updateResource(resourceType, amount, "personal_transfer");

    this.addLog(`${tenant.name} 貢獻了 ${amount} ${resourceType}`, "rent");

    return { success: true, amount: amount };
  }

  /**
   * 主資源池轉移到個人資源
   */
  transferMainToPersonal(tenant, resourceType, amount) {
    if (!this.hasEnoughResources({ [resourceType]: amount })) {
      return { success: false, error: "主資源池資源不足" };
    }

    // 從主資源池扣除
    this.updateResource(resourceType, -amount, "personal_allocation");

    // 增加到個人資源
    if (!tenant.personalResources) {
      tenant.personalResources = {};
    }
    tenant.personalResources[resourceType] =
      (tenant.personalResources[resourceType] || 0) + amount;

    this.addLog(`分配了 ${amount} ${resourceType} 給 ${tenant.name}`, "event");

    return { success: true, amount: amount };
  }

  /**
   * 工具函數與系統管理
   */

  /**
   * 更新資源摘要
   */
  updateResourceSummary(type, amount, reason) {
    // 更新日計摘要
    if (this.resourceSummary.lastUpdateDay !== this.gameState.day) {
      // 新的一天，重置日計數據
      Object.keys(this.resourceSummary.dailyNet).forEach((resourceType) => {
        this.resourceSummary.dailyNet[resourceType] = 0;
      });
      this.resourceSummary.lastUpdateDay = this.gameState.day;
    }

    // 記錄變化
    this.resourceSummary.dailyNet[type] =
      (this.resourceSummary.dailyNet[type] || 0) + amount;

    if (amount > 0) {
      this.resourceSummary.totalGained[type] =
        (this.resourceSummary.totalGained[type] || 0) + amount;
    } else {
      this.resourceSummary.totalConsumed[type] =
        (this.resourceSummary.totalConsumed[type] || 0) + Math.abs(amount);
    }
  }

  /**
   * 取得資源閾值配置
   */
  getResourceThresholds() {
    const config = this.gameHelpers
      ? this.gameHelpers.getGameBalance("resources", {})
      : {};

    return {
      warning: config.warningThresholds || {
        food: 5,
        materials: 3,
        medical: 2,
        fuel: 2,
        cash: 15,
      },
      critical: config.criticalThresholds || {
        food: 2,
        materials: 1,
        medical: 1,
        fuel: 1,
        cash: 5,
      },
      abundant: config.abundantThresholds || {
        food: 50,
        materials: 30,
        medical: 20,
        fuel: 20,
        cash: 200,
      },
    };
  }

  /**
   * 取得預設資源
   */
  getDefaultResources() {
    return this.gameHelpers
      ? this.gameHelpers.getGameBalance("resources.starting", {
          food: 20,
          materials: 15,
          medical: 10,
          fuel: 8,
          cash: 50,
        })
      : {
          food: 20,
          materials: 15,
          medical: 10,
          fuel: 8,
          cash: 50,
        };
  }

  /**
   * 事件系統介面
   */

  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
  }

  emitEvent(eventName, data) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ 資源事件處理器錯誤 (${eventName}):`, error);
        }
      });
    }
  }

  addLog(message, type = "event") {
    if (typeof window !== "undefined" && typeof window.addLog === "function") {
      window.addLog(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * 系統狀態與診斷
   */

  getStatus() {
    return {
      initialized: this.initialized,
      configLoaded: this.configLoaded,
      validationStats: { ...this.validationStats },
      resourceSummary: { ...this.resourceSummary },
      tradeHistoryCount: this.tradeHistory.length,
      exchangeRatesLoaded: !!this.exchangeRates,
      scavengeConfigLoaded: !!this.scavengeRewards,
      systemHealth: this.validateSystemHealth(),
    };
  }

  validateSystemHealth() {
    const issues = [];

    // 檢查配置完整性
    if (!this.configLoaded) {
      issues.push("配置未正確載入");
    }

    if (!this.exchangeRates) {
      issues.push("交易匯率未載入");
    }

    if (!this.scavengeRewards) {
      issues.push("搜刮配置未載入");
    }

    // 檢查驗證器
    if (!this.resourceValidator) {
      issues.push("ResourceValidator 不可用");
    }

    // 檢查驗證錯誤率
    const totalValidations =
      this.validationStats.operationsValidated +
      this.validationStats.tradesValidated;
    if (totalValidations > 0) {
      const errorRate =
        (this.validationStats.validationErrors +
          this.validationStats.tradeErrors) /
        totalValidations;
      if (errorRate > 0.1) {
        issues.push(`驗證錯誤率過高: ${(errorRate * 100).toFixed(1)}%`);
      }
    }

    // 檢查資源狀態
    const resourceStatus = this.getAllResourceStatus();
    const criticalResources = Object.keys(resourceStatus).filter(
      (type) => resourceStatus[type].status === "critical"
    );

    if (criticalResources.length > 0) {
      issues.push(`關鍵資源短缺: ${criticalResources.join(", ")}`);
    }

    return {
      healthy: issues.length === 0,
      issues: issues,
      stats: {
        errorRate:
          totalValidations > 0
            ? (this.validationStats.validationErrors +
                this.validationStats.tradeErrors) /
              totalValidations
            : 0,
        totalValidations: totalValidations,
        criticalResourceCount: criticalResources.length,
      },
    };
  }

  /**
   * 重設日計數據
   */
  resetDailyStats() {
    Object.keys(this.resourceSummary.dailyNet).forEach((type) => {
      this.resourceSummary.dailyNet[type] = 0;
    });
    this.resourceSummary.lastUpdateDay = this.gameState.day;
  }

  /**
   * 取得資源統計報告
   */
  getResourceReport() {
    const currentStatus = this.getAllResourceStatus();
    const thresholds = this.getResourceThresholds();

    return {
      currentStatus: currentStatus,
      thresholds: thresholds,
      summary: this.resourceSummary,
      recentTrades: this.tradeHistory.slice(-10),
      systemHealth: this.validateSystemHealth(),
      recommendations: this.generateResourceRecommendations(currentStatus),
    };
  }

  /**
   * 生成資源建議
   */
  generateResourceRecommendations(resourceStatus) {
    const recommendations = [];

    Object.keys(resourceStatus).forEach((type) => {
      const status = resourceStatus[type];

      if (status.status === "critical") {
        recommendations.push({
          type: "urgent",
          message: `${type} 極度短缺，建議立即補充`,
          priority: 3,
        });
      } else if (status.status === "warning") {
        recommendations.push({
          type: "warning",
          message: `${type} 偏低，建議適時補充`,
          priority: 2,
        });
      } else if (status.daily < -5) {
        recommendations.push({
          type: "trend",
          message: `${type} 日消耗量過高，注意控制`,
          priority: 1,
        });
      }
    });

    return recommendations.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * 檢查資源可用性
   */
  checkResourceAvailability(cost) {
    const missing = {};
    let allAvailable = true;

    Object.keys(cost).forEach((resource) => {
      const required = cost[resource];
      const current = this.gameState.resources[resource] || 0;

      if (current < required) {
        missing[resource] = required - current;
        allAvailable = false;
      }
    });

    return {
      available: allAvailable,
      missing: allAvailable ? {} : missing,
    };
  }
}

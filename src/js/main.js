/**
 * 末日房東模擬器 - 主程式進入點 v2.0
 * 職責：應用程式初始化、業務邏輯協調、系統狀態管理
 */

// 核心系統模組
import { DataManager } from "./core/DataManager.js";
import { RuleEngine } from "./core/RuleEngine.js";
import { GameBridge } from "./core/GameBridge.js";

// 業務系統模組
import { TenantSystem } from "./systems/TenantSystem.js";
import { ResourceSystem } from "./systems/ResourceSystem.js";
import { SkillSystem } from "./systems/SkillSystem.js";

// UI 系統模組
import { UIManager } from "./ui/UIManager.js";

// 工具函數模組
import { GameHelpers } from "./utils/helpers.js";

// 系統級常數
import {
  SYSTEM_LIMITS,
  UI_CONSTANTS,
  DATA_TYPES,
  ERROR_CODES,
  MESSAGE_TEMPLATES,
} from "./utils/constants.js";

/**
 * 應用程式主類 v2.0 - 純業務邏輯版本
 */
class Game {
  constructor() {
    // 遊戲狀態 - 初期使用最小預設值
    this.gameState = this.getMinimalInitialState();

    // 核心系統模組實例
    this.dataManager = null;
    this.ruleEngine = null;
    this.gameBridge = null;
    this.gameHelpers = null;

    // 業務系統模組實例
    this.tenantSystem = null;
    this.resourceSystem = null;
    this.skillSystem = null;

    // UI 系統模組實例
    this.uiManager = null;

    // 配置狀態
    this.configLoaded = false;
    this.rulesConfig = null;

    // 初始化狀態追蹤
    this.initializationStatus = {
      dataManager: false,
      ruleEngine: false,
      gameBridge: false,
      gameHelpers: false,
      tenantSystem: false,
      resourceSystem: false,
      skillSystem: false,
      uiManager: false,
      configApplied: false,
      complete: false,
    };

    // 錯誤處理機制
    this.errorHandler = this.createErrorHandler();
  }

  /**
   * 取得最小初始狀態（配置載入前的安全預設值）
   */
  getMinimalInitialState() {
    return {
      day: 1,
      time: "day",
      resources: { food: 20, materials: 15, medical: 10, fuel: 8, cash: 50 },
      rooms: [
        { id: 1, tenant: null, needsRepair: false, reinforced: false },
        { id: 2, tenant: null, needsRepair: false, reinforced: false },
      ],
      applicants: [],
      visitors: [],
      landlordHunger: 0,
      harvestUsed: false,
      harvestCooldown: 0,
      scavengeUsed: 0,
      maxScavengePerDay: 2,
      rentCollected: false,
      buildingDefense: 0,
      tenantSatisfaction: {},
      harmoniumBonus: 0,

      // 全域效果
      emergencyTraining: false,
      foodPreservation: false,
      patrolSystem: false,
      socialNetwork: false,
      nightWatchActive: false,
    };
  }

  /**
   * 應用程式初始化主流程 v2.0
   */
  async initialize() {
    console.log("🎮 末日房東模擬器 v2.0 啟動中...");

    try {
      // 階段 1：初始化核心系統
      await this.initializeCoreModules();

      // 階段 2：載入遊戲配置
      await this.loadGameConfiguration();

      // 階段 3：應用配置到遊戲狀態
      await this.applyConfigurationToGameState();

      // 階段 4：初始化業務系統
      await this.initializeBusinessModules();

      // 階段 5：建立系統整合
      await this.establishSystemIntegration();

      // 階段 6：初始化 UI 系統
      await this.initializeUISystem();

      // 階段 7：完成啟動
      this.completeInitialization();
    } catch (error) {
      this.errorHandler.handleInitializationError(error);
    }
  }

  /**
   * 初始化核心模組
   */
  async initializeCoreModules() {
    console.log("📦 正在初始化核心系統模組...");

    // 初始化資料管理器
    this.dataManager = new DataManager();
    this.initializationStatus.dataManager = true;

    // 初始化規則引擎
    this.ruleEngine = new RuleEngine(this.gameState);
    this.initializationStatus.ruleEngine = true;

    // 初始化遊戲橋接器
    this.gameBridge = new GameBridge(
      this.gameState,
      this.dataManager,
      this.ruleEngine
    );
    this.initializationStatus.gameBridge = true;

    // 初始化遊戲輔助工具
    this.gameHelpers = new GameHelpers();
    this.initializationStatus.gameHelpers = true;

    console.log("✅ 核心系統模組初始化完成");
  }

  /**
   * 載入遊戲配置
   */
  async loadGameConfiguration() {
    console.log("📊 正在載入遊戲配置資料...");

    try {
      // 優先載入 rules 配置
      this.rulesConfig = await this.dataManager
        .loadData("rules")
        .catch((error) => {
          console.warn("⚠️ rules.json 載入失敗，使用預設配置:", error.message);
          return this.dataManager.getDefaultData("rules");
        });

      // 載入其他配置檔案
      const otherConfigTypes = ["tenants", "skills", "events"];
      const loadPromises = otherConfigTypes.map((type) =>
        this.dataManager.loadData(type).catch((error) => {
          console.warn(`⚠️ 載入 ${type} 配置失敗，使用預設值:`, error.message);
          return this.dataManager.getDefaultData(type);
        })
      );

      await Promise.all(loadPromises);
      this.configLoaded = true;

      console.log("✅ 遊戲配置載入完成");
    } catch (error) {
      console.warn("⚠️ 配置載入過程發生錯誤，使用最小配置:", error.message);
      this.rulesConfig = this.dataManager.getDefaultData("rules");
      this.configLoaded = false;
    }
  }

  /**
   * 應用配置到遊戲狀態
   */
  async applyConfigurationToGameState() {
    console.log("🔧 正在應用配置到遊戲狀態...");

    try {
      // 注入配置到 GameHelpers
      if (this.rulesConfig && this.gameHelpers) {
        const injectionSuccess = this.gameHelpers.injectConfig(
          this.rulesConfig
        );

        if (injectionSuccess) {
          // 使用配置驅動的初始狀態
          this.gameState = {
            ...this.gameHelpers.getInitialGameState(),
            // 保留當前運行時狀態
            applicants: this.gameState.applicants,
            visitors: this.gameState.visitors,
          };

          // 更新房間配置
          this.gameState.rooms = this.gameHelpers.getInitialRooms();

          this.initializationStatus.configApplied = true;
          console.log("✅ 配置驅動的遊戲狀態已應用");
        } else {
          console.warn("⚠️ 配置注入失敗，保持最小狀態");
        }
      }
    } catch (error) {
      console.warn("⚠️ 配置應用失敗，使用預設狀態:", error.message);
    }
  }

  /**
   * 初始化業務系統模組
   */
  async initializeBusinessModules() {
    console.log("🏢 正在初始化業務系統模組...");

    try {
      // 初始化資源系統
      console.log("💰 初始化 ResourceSystem...");
      this.resourceSystem = new ResourceSystem(
        this.gameState,
        this.dataManager,
        this.gameHelpers
      );
      const resourceInitSuccess = await this.resourceSystem.initialize();
      this.initializationStatus.resourceSystem = resourceInitSuccess;

      // 初始化租客系統
      console.log("👥 初始化 TenantSystem...");
      this.tenantSystem = new TenantSystem(
        this.gameState,
        this.dataManager,
        this.gameHelpers
      );
      const tenantInitSuccess = await this.tenantSystem.initialize();
      this.initializationStatus.tenantSystem = tenantInitSuccess;

      // 初始化技能系統
      console.log("⚡ 初始化 SkillSystem...");
      this.skillSystem = new SkillSystem(
        this.gameState,
        this.dataManager,
        this.gameHelpers
      );
      const skillInitSuccess = await this.skillSystem.initialize();
      this.initializationStatus.skillSystem = skillInitSuccess;

      // 系統狀態報告
      console.log(
        resourceInitSuccess
          ? "✅ ResourceSystem 初始化成功"
          : "⚠️ ResourceSystem 初始化失敗"
      );
      console.log(
        tenantInitSuccess
          ? "✅ TenantSystem 初始化成功"
          : "⚠️ TenantSystem 初始化失敗"
      );
      console.log(
        skillInitSuccess
          ? "✅ SkillSystem 初始化成功"
          : "⚠️ SkillSystem 初始化失敗"
      );

      console.log("✅ 業務系統模組初始化完成");
    } catch (error) {
      console.error("❌ 業務系統初始化失敗:", error);
      this.initializationStatus.tenantSystem = false;
      this.initializationStatus.resourceSystem = false;
      this.initializationStatus.skillSystem = false;
    }
  }

  /**
   * 建立系統整合
   */
  async establishSystemIntegration() {
    console.log("🔗 正在建立系統整合...");

    // 建立租客系統事件監聽
    this.setupTenantSystemEvents();

    // 建立資源系統事件監聽
    this.setupResourceSystemEvents();

    // 建立技能系統事件監聽
    this.setupSkillSystemEvents();

    // 建立系統間協作機制
    this.setupSystemCollaboration();

    console.log("✅ 系統整合建立完成");
  }

  /**
   * 設定租客系統事件監聽
   */
  setupTenantSystemEvents() {
    if (!this.tenantSystem) return;

    // 監聽租客雇用事件
    this.tenantSystem.on("tenantHired", (data) => {
      console.log(`🎉 租客雇用成功: ${data.tenant.name}`);
      this.notifyUIUpdate("tenants");
    });

    // 監聽租客離開事件
    this.tenantSystem.on("tenantEvicted", (data) => {
      console.log(`👋 租客離開: ${data.tenant.name} (${data.reason})`);
      this.notifyUIUpdate("tenants");
    });

    // 監聽雇用失敗事件
    this.tenantSystem.on("tenantHireFailed", (data) => {
      console.log(`❌ 租客雇用失敗: ${data.reason}`);
      const reasonMessages = {
        applicant_not_found: "找不到指定申請者",
        no_available_room: "沒有可用房間",
      };
      const message = reasonMessages[data.reason] || data.reason;
      this.showUserMessage(message);
    });
  }

  /**
   * 設定資源系統事件監聽
   */
  setupResourceSystemEvents() {
    if (!this.resourceSystem) return;

    // 監聽資源更新事件
    this.resourceSystem.on("resourceUpdated", (data) => {
      console.log(
        `💰 資源更新: ${data.type} ${data.amount > 0 ? "+" : ""}${data.amount}`
      );
      this.notifyUIUpdate("resources");
    });

    // 監聽資源警告事件
    this.resourceSystem.on("resourceWarning", (data) => {
      console.warn(`⚠️ 資源警告: ${data.message}`);
      this.addGameLog(data.message, "danger");
    });

    // 監聽交易事件
    this.resourceSystem.on("tradeCompleted", (data) => {
      console.log(`💱 交易完成: ${data.description}`);
      this.notifyUIUpdate("resources");
    });
  }

  /**
   * 設定 SkillSystem 事件監聽
   */
  setupSkillSystemEvents() {
    if (!this.skillSystem) return;

    // 監聽技能執行事件
    this.skillSystem.addEventListener("skillExecuted", (event) => {
      const { tenantName, skillName, result } = event.detail;
      this.addGameLog(`${tenantName} 使用了技能：${skillName}`, "skill");
      this.notifyUIUpdate("fullUpdate");
    });

    // 監聽被動技能觸發
    this.skillSystem.addEventListener("passiveSkillTriggered", (event) => {
      const { tenant, skill } = event.detail;
      this.addGameLog(
        `${tenant.name} 的被動技能 ${skill.name} 被觸發`,
        "skill"
      );
    });

    // 監聽租客移除請求
    this.skillSystem.addEventListener("requestTenantRemoval", (event) => {
      const { target, reason } = event.detail;
      if (this.tenantSystem) {
        this.tenantSystem.evictTenant(target, reason);
      }
    });

    // 監聽滿意度改善請求
    this.skillSystem.addEventListener("improveTenantSatisfaction", (event) => {
      const { target, amount } = event.detail;
      if (target === "all") {
        Object.keys(this.gameState.tenantSatisfaction).forEach((name) => {
          this.gameState.tenantSatisfaction[name] = Math.min(
            100,
            (this.gameState.tenantSatisfaction[name] || 50) + amount
          );
        });
      }
    });
  }

  /**
   * 建立系統間協作機制
   */
  setupSystemCollaboration() {
    // ResourceSystem 與 TenantSystem 協作
    if (this.resourceSystem && this.tenantSystem) {
      console.log("🤝 建立 ResourceSystem ↔ TenantSystem 協作機制");
      this.resourceSystem.tenantSystemRef = this.tenantSystem;
      this.tenantSystem.resourceSystemRef = this.resourceSystem;
    }

    // SkillSystem 與其他系統協作
    if (this.skillSystem) {
      if (this.tenantSystem) {
        console.log("🤝 建立 SkillSystem ↔ TenantSystem 協作機制");
        this.skillSystem.tenantSystemRef = this.tenantSystem;
        this.tenantSystem.skillSystemRef = this.skillSystem;
      }

      if (this.resourceSystem) {
        console.log("🤝 建立 SkillSystem ↔ ResourceSystem 協作機制");
        this.skillSystem.resourceSystemRef = this.resourceSystem;
        this.resourceSystem.skillSystemRef = this.skillSystem;
      }
    }
  }

  /**
   * 初始化 UI 系統 v2.0
   */
  async initializeUISystem() {
    console.log("🎨 正在初始化 UI 系統...");

    try {
      // 初始化 UIManager
      this.uiManager = new UIManager(this);
      const uiInitSuccess = await this.uiManager.initialize();
      this.initializationStatus.uiManager = uiInitSuccess;

      if (uiInitSuccess) {
        // 初始化遊戲記錄
        this.addGameLog(MESSAGE_TEMPLATES.SYSTEM.READY, "event");
        this.addGameLog("v2.0 模組化系統已啟用", "event");

        if (this.gameHelpers && this.gameHelpers.getStatus().configLoaded) {
          this.addGameLog("✅ 遊戲配置載入成功", "event");
        } else {
          this.addGameLog("⚠️ 使用後備配置模式", "danger");
        }

        // 系統狀態報告
        if (
          this.resourceSystem &&
          this.resourceSystem.getStatus().initialized
        ) {
          this.addGameLog("✅ 資源管理系統已啟用", "event");
        }
        if (this.tenantSystem && this.tenantSystem.getStatus().initialized) {
          this.addGameLog("✅ 租客管理系統已啟用", "event");
        }
        if (this.skillSystem && this.skillSystem.getStatus().initialized) {
          this.addGameLog("✅ 技能管理系統已啟用", "event");
        }

        // 執行初始顯示更新
        this.notifyUIUpdate("fullUpdate");

        console.log("✅ UI 系統初始化完成");
      } else {
        console.warn("⚠️ UI 系統初始化失敗，將使用降級模式");
        this.attemptFallbackUI();
      }
    } catch (error) {
      console.error("❌ UI 系統初始化失敗:", error);
      this.initializationStatus.uiManager = false;
      this.attemptFallbackUI();
    }
  }

  /**
   * 降級 UI 處理
   */
  attemptFallbackUI() {
    console.log("🔄 嘗試降級 UI 模式...");

    // 設定基本的全域函數
    window.gameApp = this;

    // 基本的顯示更新函數
    window.updateDisplay = () => {
      console.log("⚠️ 使用降級顯示更新");
    };

    window.addLog = (message, type) => {
      console.log(`📜 遊戲記錄: ${message} (${type})`);
    };
  }

  /**
   * 完成初始化流程 v2.0
   */
  completeInitialization() {
    this.initializationStatus.complete = true;

    console.log("🎯 末日房東模擬器 v2.0 啟動完成！");
    console.log("📊 系統狀態:", this.getSystemStatus());
  }

  /**
   * 遊戲核心功能實作（純業務邏輯版）
   */

  // 收租功能
  handleCollectRent() {
    if (this.gameState.rentCollected) {
      this.showUserMessage("今天已經收過房租了！");
      return;
    }

    let totalRent = 0;
    this.gameState.rooms.forEach((room) => {
      if (room.tenant && !room.tenant.infected) {
        let rent = room.tenant.rent;

        // 使用配置驅動的加成計算
        if (room.reinforced && this.gameHelpers) {
          const economicParams = this.gameHelpers.getEconomicParameters();
          rent = Math.floor(rent * (1 + economicParams.reinforcementRentBonus));
        }

        totalRent += rent;
      }
    });

    // 使用 ResourceSystem 更新現金
    if (this.resourceSystem && this.resourceSystem.getStatus().initialized) {
      this.resourceSystem.updateResource(
        DATA_TYPES.RESOURCE_TYPES.CASH,
        totalRent,
        "rent_collection"
      );
    } else {
      this.gameState.resources.cash += totalRent;
    }

    this.gameState.rentCollected = true;

    if (totalRent > 0) {
      this.addGameLog(`收取房租 $${totalRent}`, "rent");
    } else {
      this.addGameLog("今日沒有房租收入", "event");
    }

    this.notifyUIUpdate("resources");
  }

  // 顯示訪客
  handleShowVisitors() {
    if (this.uiManager) {
      this.uiManager.showVisitorModal();
    } else {
      this.showUserMessage("訪客系統暫時不可用");
    }
  }

  // 生成申請者
  generateApplicants() {
    if (this.tenantSystem && this.tenantSystem.getStatus().initialized) {
      return this.tenantSystem.generateApplicants();
    } else {
      console.warn("⚠️ TenantSystem 不可用");
      return [];
    }
  }

  // 雇用租客
  hireTenant(applicantId) {
    console.log(`🤝 嘗試雇用申請者: ${applicantId}`);

    if (this.tenantSystem && this.tenantSystem.getStatus().initialized) {
      const success = this.tenantSystem.hireTenant(applicantId);
      if (success) {
        this.closeModal();
        this.notifyUIUpdate("fullUpdate");
      }
      return success;
    } else {
      console.warn("⚠️ TenantSystem 不可用");
      this.showUserMessage("租客系統暫時不可用");
      return false;
    }
  }

  // 院子採集
  handleHarvestYard() {
    if (this.gameState.harvestUsed) {
      this.showUserMessage("今天已經採集過院子了！");
      return;
    }

    if (this.gameState.harvestCooldown > 0) {
      this.showUserMessage(
        `院子需要休息 ${this.gameState.harvestCooldown} 天才能再次採集！`
      );
      return;
    }

    // 計算農夫數量
    let farmerCount = 0;
    if (this.tenantSystem && this.tenantSystem.getStatus().initialized) {
      farmerCount = this.tenantSystem.getTenantCountByType("farmer");
    }

    // 使用 ResourceSystem 處理採集
    if (this.resourceSystem && this.resourceSystem.getStatus().initialized) {
      const result = this.resourceSystem.processProduction("yard_harvest", {
        farmerCount: farmerCount,
      });

      if (result.success) {
        this.gameState.harvestUsed = true;

        // 設定冷卻時間
        const timeParams = this.gameHelpers
          ? this.gameHelpers.getTimeParameters()
          : { harvestCooldownDays: 2 };
        this.gameState.harvestCooldown = timeParams.harvestCooldownDays;

        this.notifyUIUpdate("resources");
      } else {
        this.addGameLog("院子採集失敗", "danger");
      }
    } else {
      // 後備處理
      const baseAmount = 2;
      const totalAmount = baseAmount + farmerCount * 2;
      this.gameState.resources.food += totalAmount;
      this.gameState.harvestUsed = true;
      this.gameState.harvestCooldown = 2;

      this.addGameLog(`院子採集獲得 ${totalAmount} 食物`, "rent");
      this.notifyUIUpdate("resources");
    }
  }

  // 搜刮系統
  handleShowScavenge() {
    if (this.gameState.scavengeUsed >= this.gameState.maxScavengePerDay) {
      this.showUserMessage("今天的搜刮次數已用完！");
      return;
    }

    if (this.uiManager) {
      this.uiManager.showScavengeModal();
    } else {
      this.showUserMessage("搜刮系統暫時不可用");
    }
  }

  // 取得可搜刮的租客
  getAvailableTenantsForScavenge() {
    return this.gameState.rooms
      .filter(
        (room) => room.tenant && !room.tenant.infected && !room.tenant.onMission
      )
      .map((room) => room.tenant);
  }

  // 計算搜刮成功率
  calculateScavengeSuccessRate(tenant) {
    if (this.resourceSystem && this.resourceSystem.getStatus().initialized) {
      return this.resourceSystem.calculateScavengeSuccessRate(tenant);
    }

    // 後備計算
    const baseRates = {
      soldier: 85,
      worker: 75,
      farmer: 65,
      doctor: 50,
      elder: 40,
    };

    const tenantType = tenant.type || tenant.typeId;
    const baseRate = baseRates[tenantType] || 50;

    let modifier = 0;
    if (tenant.personalResources?.medical >= 2) modifier += 5;
    if (tenant.personalResources?.food >= 5) modifier += 5;

    return Math.max(10, Math.min(95, baseRate + modifier));
  }

  // 派遣租客搜刮
  sendTenantOnScavenge(tenantName) {
    const tenant = this.gameState.rooms
      .map((room) => room.tenant)
      .find((t) => t && t.name === tenantName);

    if (!tenant) {
      this.showUserMessage("找不到指定租客！");
      return;
    }

    if (this.gameState.scavengeUsed >= this.gameState.maxScavengePerDay) {
      this.showUserMessage("今天的搜刮次數已用完！");
      return;
    }

    // 使用 ResourceSystem 處理搜刮
    if (this.resourceSystem && this.resourceSystem.getStatus().initialized) {
      const result = this.resourceSystem.processProduction("scavenge_mission", {
        tenant: tenant,
      });

      this.handleScavengeResult(tenant, result);
    } else {
      // 後備搜刮處理
      this.handleScavengeFallback(tenant);
    }

    this.gameState.scavengeUsed++;
    this.closeModal();
    this.notifyUIUpdate("fullUpdate");
  }

  // 處理搜刮結果
  handleScavengeResult(tenant, result) {
    if (result.success) {
      this.addGameLog(`${tenant.name} 搜刮成功！`, "rent");

      // 顯示獲得的資源
      const rewardDesc = Object.keys(result.rewards)
        .map((type) => `${result.rewards[type]} ${type}`)
        .join(", ");

      if (rewardDesc) {
        this.addGameLog(`獲得: ${rewardDesc}`, "rent");
      }
    } else {
      this.addGameLog(`${tenant.name} 搜刮失敗`, "danger");

      // 處理搜刮失敗後果
      if (result.injury) {
        this.handleScavengeInjury(tenant, result.injury);
      }
    }
  }

  // 處理搜刮傷害
  handleScavengeInjury(tenant, injury) {
    switch (injury.effect) {
      case "infection_risk":
        if (Math.random() < 0.3) {
          tenant.infected = true;
          this.addGameLog(`${tenant.name} 可能被感染了！`, "danger");
        }
        break;
      case "resource":
        if (tenant.personalResources && tenant.personalResources.food > 0) {
          tenant.personalResources.food = Math.max(
            0,
            tenant.personalResources.food - 2
          );
          this.addGameLog(`${tenant.name} 損失了一些個人物品`, "danger");
        }
        break;
      case "health":
        this.addGameLog(`${tenant.name} 受了輕傷`, "danger");
        break;
    }
  }

  // 後備搜刮處理
  handleScavengeFallback(tenant) {
    const successRate = this.calculateScavengeSuccessRate(tenant);
    const isSuccess = Math.random() * 100 < successRate;

    if (isSuccess) {
      const foodGain = Math.floor(Math.random() * 5) + 3;
      const materialsGain = Math.floor(Math.random() * 3) + 1;

      this.gameState.resources.food += foodGain;
      this.gameState.resources.materials += materialsGain;

      this.addGameLog(
        `${tenant.name} 搜刮成功，獲得 ${foodGain} 食物、${materialsGain} 建材`,
        "rent"
      );
    } else {
      this.addGameLog(`${tenant.name} 搜刮失敗`, "danger");

      if (Math.random() < 0.3) {
        tenant.infected = Math.random() < 0.2;
        this.addGameLog(
          `${tenant.name} ${tenant.infected ? "被感染了" : "受了輕傷"}`,
          "danger"
        );
      }
    }
  }

  // 房間點擊處理
  handleRoomClick(roomId) {
    const room = this.gameState.rooms.find((r) => r.id === roomId);

    if (!room) {
      this.showUserMessage("找不到指定房間");
      return;
    }

    if (room.tenant) {
      // 房間有租客的情況
      const tenant = room.tenant;
      const satisfaction = this.gameState.tenantSatisfaction[tenant.name] || 50;
      const statusIcon =
        satisfaction >= 70 ? "😊" : satisfaction >= 40 ? "😐" : "😞";

      let detailInfo = `房間 ${roomId} - ${tenant.name}\n`;
      detailInfo += `類型: ${tenant.typeName || tenant.type}\n`;
      detailInfo += `技能: ${tenant.skill || "未知"}\n`;
      detailInfo += `房租: ${tenant.rent}/天\n`;
      detailInfo += `滿意度: ${satisfaction}% ${statusIcon}\n`;
      detailInfo += `狀態: ${tenant.infected ? "已感染" : "健康"}`;

      // 增加詳細租客資訊
      if (this.tenantSystem && this.tenantSystem.getStatus().initialized) {
        const tenantState = this.tenantSystem.getTenantState(tenant.name);
        if (tenantState?.stats) {
          detailInfo += `\n居住天數: ${tenantState.stats.daysLived} 天`;

          if (tenantState.stats.satisfactionHistory.length > 1) {
            const trend = tenantState.stats.satisfactionHistory.slice(-2);
            const change = trend[1] - trend[0];
            const trendText =
              change > 0 ? "↗ 上升" : change < 0 ? "↘ 下降" : "→ 穩定";
            detailInfo += `\n滿意度趨勢: ${trendText}`;
          }
        }
      }

      // 個人資源資訊
      if (tenant.personalResources) {
        detailInfo += `\n\n個人資源:`;
        detailInfo += `\n💰 現金: $${tenant.personalResources.cash || 0}`;
        detailInfo += `\n🍖 食物: ${tenant.personalResources.food || 0}`;
        if (tenant.personalResources.medical > 0) {
          detailInfo += `\n💊 醫療: ${tenant.personalResources.medical}`;
        }
        if (tenant.personalResources.materials > 0) {
          detailInfo += `\n🔧 建材: ${tenant.personalResources.materials}`;
        }
      }

      // 房間狀態資訊
      if (room.reinforced) {
        detailInfo += `\n\n🛡️ 房間已加固 (+20% 租金)`;
      }
      if (room.needsRepair) {
        detailInfo += `\n⚠️ 房間需要維修`;
      }

      this.showUserMessage(detailInfo);
    } else {
      // 空房的情況
      let roomInfo = `房間 ${roomId} - 空置中\n`;
      roomInfo += `\n可容納一位租客`;

      if (room.reinforced) {
        roomInfo += `\n🛡️ 已加固 (提升安全性和租金)`;
      }
      if (room.needsRepair) {
        roomInfo += `\n⚠️ 需要維修後才能出租`;
      } else {
        roomInfo += `\n\n💡 提示: 點擊「查看訪客」來招募租客`;
      }

      this.showUserMessage(roomInfo);
    }
  }

  // 技能選單顯示
  handleShowSkills() {
    if (this.uiManager) {
      this.uiManager.showSkillModal();
    } else {
      this.showUserMessage("技能系統暫時不可用");
    }
  }

  // 技能執行處理
  async useSkillFromMenu(tenantName, skillId) {
    if (!this.skillSystem?.getStatus().initialized) {
      this.addGameLog("技能系統不可用", "danger");
      return false;
    }

    const result = await this.skillSystem.executeSkill(tenantName, skillId);

    if (result.success) {
      this.addGameLog(`技能執行成功`, "skill");
    } else {
      const messages = {
        tenant_not_found: "找不到指定租客",
        insufficient_resources: "資源不足",
        on_cooldown: result.message || "技能冷卻中",
        requirements_not_met: "技能使用條件不滿足",
      };
      this.addGameLog(messages[result.reason] || "技能執行失敗", "danger");
    }

    this.closeModal();
    this.notifyUIUpdate("fullUpdate");
    return result.success;
  }

  // 被動技能處理
  processPassiveSkills(trigger, context = {}) {
    if (this.skillSystem?.getStatus().initialized) {
      this.skillSystem.processPassiveSkills(trigger, context);
    }
  }

  // 下一天
  handleNextDay() {
    // 基礎日期推進
    this.gameState.day++;
    this.gameState.harvestUsed = false;
    this.gameState.scavengeUsed = 0;
    this.gameState.rentCollected = false;

    // 重置臨時效果
    this.gameState.nightWatchActive = false;

    // 減少院子採集冷卻
    if (this.gameState.harvestCooldown > 0) {
      this.gameState.harvestCooldown--;
    }

    // 使用 TenantSystem 處理租客日常更新
    if (this.tenantSystem && this.tenantSystem.getStatus().initialized) {
      this.tenantSystem.updateDailyTenantStates();
    }

    // 觸發每日被動技能
    this.processPassiveSkills("day_end");

    // 處理日常消費
    this.processDailyConsumption();

    this.addGameLog(`新的一天開始了 - 第${this.gameState.day}天`, "event");
    this.notifyUIUpdate("fullUpdate");
  }

  // 日常消費處理
  processDailyConsumption() {
    if (this.resourceSystem && this.resourceSystem.getStatus().initialized) {
      this.resourceSystem.processConsumption("landlord_daily");
      this.resourceSystem.processConsumption("building_daily");
    } else {
      this.processLandlordConsumptionFallback();
      this.processBuildingConsumptionFallback();
    }
  }

  // 後備房東消費
  processLandlordConsumptionFallback() {
    const dailyConsumption = 2;

    if (this.gameState.resources.food >= dailyConsumption) {
      this.gameState.resources.food -= dailyConsumption;
      this.gameState.landlordHunger = Math.max(
        0,
        this.gameState.landlordHunger - 1
      );
      this.addGameLog(`房東消耗了 ${dailyConsumption} 食物`, "event");
    } else if (this.gameState.resources.food >= 1) {
      this.gameState.resources.food -= 1;
      this.gameState.landlordHunger += 1;
      this.addGameLog("食物不足，房東仍感到飢餓", "danger");
    } else {
      this.gameState.landlordHunger += 2;
      this.addGameLog("沒有食物！房東非常飢餓", "danger");
    }
  }

  // 後備建築消費
  processBuildingConsumptionFallback() {
    const fuelConsumption = 1;

    if (this.gameState.resources.fuel >= fuelConsumption) {
      this.gameState.resources.fuel -= fuelConsumption;
      this.addGameLog(`房屋設施消耗了 ${fuelConsumption} 燃料`, "event");
    } else {
      this.addGameLog("燃料不足！房屋運作受影響", "danger");
    }
  }

  /**
   * UI 通知與輔助方法 v2.0
   */

  // 通知 UI 更新
  notifyUIUpdate(updateType = "fullUpdate") {
    if (this.uiManager) {
      this.uiManager.handleSystemStateChange(updateType);
    }
  }

  // 添加遊戲記錄
  addGameLog(message, type = "event") {
    if (this.uiManager) {
      this.uiManager.addLog(message, type);
    } else {
      // 降級處理
      console.log(`📜 遊戲記錄: ${message} (${type})`);
    }
  }

  // 顯示用戶訊息
  showUserMessage(message) {
    alert(message); // 簡單實作，未來可改為更好的通知系統
  }

  // 關閉模態框
  closeModal() {
    if (this.uiManager) {
      this.uiManager.closeModal();
    } else {
      // 降級處理
      document.querySelectorAll(".modal").forEach((modal) => {
        modal.style.display = "none";
      });
    }
  }

  /**
   * 系統狀態與管理方法 v2.0
   */

  // 取得系統狀態
  getSystemStatus() {
    return {
      version: "2.0.0",
      architecture: "ES6 Modules",
      mode: this.configLoaded ? "config-driven" : "fallback",
      initialization: this.initializationStatus,
      gameState: {
        day: this.gameState.day,
        tenants: this.gameState.rooms.filter((r) => r.tenant).length,
        resources: this.gameState.resources,
      },
      modules: {
        dataManager: !!this.dataManager,
        ruleEngine: !!this.ruleEngine,
        gameBridge: !!this.gameBridge,
        gameHelpers: !!this.gameHelpers,
        tenantSystem: this.tenantSystem ? this.tenantSystem.getStatus() : null,
        resourceSystem: this.resourceSystem
          ? this.resourceSystem.getStatus()
          : null,
        skillSystem: this.skillSystem ? this.skillSystem.getStatus() : null,
        uiManager: this.uiManager ? this.uiManager.getUISystemStatus() : null,
      },
      config: {
        loaded: this.configLoaded,
        helpersStatus: this.gameHelpers ? this.gameHelpers.getStatus() : null,
      },
      systemHealth: this.evaluateSystemHealth(),
    };
  }

  // 評估系統健康度
  evaluateSystemHealth() {
    const issues = [];
    const successes = [];

    // 檢查核心系統
    if (this.initializationStatus.dataManager) {
      successes.push("DataManager 正常");
    } else {
      issues.push("DataManager 初始化失敗");
    }

    if (this.initializationStatus.resourceSystem) {
      successes.push("ResourceSystem 正常");
    } else {
      issues.push("ResourceSystem 初始化失敗");
    }

    if (this.initializationStatus.tenantSystem) {
      successes.push("TenantSystem 正常");
    } else {
      issues.push("TenantSystem 初始化失敗");
    }

    if (this.initializationStatus.skillSystem) {
      successes.push("SkillSystem 正常");
    } else {
      issues.push("SkillSystem 初始化失敗");
    }

    if (this.initializationStatus.uiManager) {
      successes.push("UIManager 正常");
    } else {
      issues.push("UIManager 初始化失敗");
    }

    // 檢查配置狀態
    if (this.configLoaded) {
      successes.push("配置載入成功");
    } else {
      issues.push("配置載入失敗");
    }

    return {
      healthy: issues.length === 0,
      issues: issues,
      successes: successes,
      score: successes.length / (successes.length + issues.length),
    };
  }

  /**
   * 錯誤處理機制 v2.0
   */
  createErrorHandler() {
    return {
      handleInitializationError: (error) => {
        console.error("❌ 應用程式初始化失敗:", error);
        this.attemptFallbackInitialization();
      },

      handleRuntimeError: (error, context) => {
        console.error(`❌ 執行時錯誤 (${context}):`, error);
        this.addGameLog(`系統錯誤: ${context}`, "danger");
      },
    };
  }

  /**
   * 降級啟動機制 v2.0
   */
  attemptFallbackInitialization() {
    console.log("🔄 嘗試降級啟動模式...");

    try {
      this.attemptFallbackUI();
      this.addGameLog("系統啟動失敗，正在降級模式下運行", "danger");
      this.addGameLog("部分功能可能不可用", "danger");
    } catch (fallbackError) {
      console.error("❌ 降級啟動也失敗:", fallbackError);
      alert("遊戲初始化失敗，請重新整理頁面或檢查瀏覽器支援度");
    }
  }
}

/**
 * 應用程式啟動 v2.0
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎮 DOM 載入完成，開始初始化應用程式 v2.0...");

  try {
    const app = new Game();
    await app.initialize();

    // 將應用程式實例設為全域變數
    window.gameApp = app;
  } catch (error) {
    console.error("❌ 應用程式啟動失敗:", error);
    alert("遊戲啟動失敗，請檢查瀏覽器支援度或重新整理頁面");
  }
});

// 匯出主應用程式類別
export { Game };
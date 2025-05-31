/**
 * 末日房東模擬器 - 主程式進入點
 * 職責：應用程式初始化、模組載入協調、全域狀態管理
 */

// 核心系統模組
import { DataManager } from "./core/DataManager.js";
import { RuleEngine } from "./core/RuleEngine.js";
import { GameBridge } from "./core/GameBridge.js";

// 業務系統模組
import { TenantSystem } from "./systems/TenantSystem.js";
import { ResourceSystem } from "./systems/ResourceSystem.js";
import { SkillSystem } from "./systems/SkillSystem.js";

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
 * 應用程式主類
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
   * 應用程式初始化主流程
   */
  async initialize() {
    console.log("🎮 末日房東模擬器啟動中...");

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

      // 階段 6：啟動遊戲介面
      await this.initializeGameInterface();

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
    this.updateSystemStatus("dataSystem", "✅ 已載入");

    // 初始化規則引擎
    this.ruleEngine = new RuleEngine(this.gameState);
    this.initializationStatus.ruleEngine = true;
    this.updateSystemStatus("ruleEngine", "✅ 就緒");

    // 初始化遊戲橋接器
    this.gameBridge = new GameBridge(
      this.gameState,
      this.dataManager,
      this.ruleEngine
    );
    this.initializationStatus.gameBridge = true;
    this.updateSystemStatus("gameBridge", "✅ 連接");

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

    // 設定事件監聽
    this.setupEventListeners();

    // 設定全域函數代理
    this.setupGlobalFunctionProxies();

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
      this.updateDisplay();
    });

    // 監聽租客離開事件
    this.tenantSystem.on("tenantEvicted", (data) => {
      console.log(`👋 租客離開: ${data.tenant.name} (${data.reason})`);
      this.updateDisplay();
    });

    // 監聽雇用失敗事件
    this.tenantSystem.on("tenantHireFailed", (data) => {
      console.log(`❌ 租客雇用失敗: ${data.reason}`);
      const reasonMessages = {
        applicant_not_found: "找不到指定申請者",
        no_available_room: "沒有可用房間",
      };
      const message = reasonMessages[data.reason] || data.reason;
      alert(message);
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
      this.updateDisplay();
    });

    // 監聽資源警告事件
    this.resourceSystem.on("resourceWarning", (data) => {
      console.warn(`⚠️ 資源警告: ${data.message}`);
      this.addLog(data.message, "danger");
    });

    // 監聽交易事件
    this.resourceSystem.on("tradeCompleted", (data) => {
      console.log(`💱 交易完成: ${data.description}`);
      this.updateDisplay();
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
      this.addLog(`${tenantName} 使用了技能：${skillName}`, "skill");
      this.updateDisplay();
    });

    // 監聽被動技能觸發
    this.skillSystem.addEventListener("passiveSkillTriggered", (event) => {
      const { tenant, skill } = event.detail;
      this.addLog(`${tenant.name} 的被動技能 ${skill.name} 被觸發`, "skill");
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
   * 初始化遊戲介面
   */
  async initializeGameInterface() {
    console.log("🖥️ 正在初始化遊戲介面...");

    // 建立基礎介面事件監聽
    this.setupUIEventListeners();

    // 初始化遊戲記錄
    this.addLog(MESSAGE_TEMPLATES.SYSTEM.READY, "event");
    this.addLog("業務系統模組已啟用", "event");

    if (this.gameHelpers && this.gameHelpers.getStatus().configLoaded) {
      this.addLog("✅ 遊戲配置載入成功", "event");
    } else {
      this.addLog("⚠️ 使用後備配置模式", "danger");
    }

    // 系統狀態報告
    if (this.resourceSystem && this.resourceSystem.getStatus().initialized) {
      this.addLog("✅ 資源管理系統已啟用", "event");
    }
    if (this.tenantSystem && this.tenantSystem.getStatus().initialized) {
      this.addLog("✅ 租客管理系統已啟用", "event");
    }
    if (this.skillSystem && this.skillSystem.getStatus().initialized) {
      this.addLog("✅ 技能管理系統已啟用", "event");
    }

    // 更新顯示
    this.updateDisplay();

    console.log("✅ 遊戲介面初始化完成");
  }

  /**
   * 完成初始化流程
   */
  completeInitialization() {
    this.initializationStatus.complete = true;

    // 更新系統狀態顯示
    const statusEl = document.getElementById("systemStatus");
    if (statusEl) {
      const resourceOK = this.initializationStatus.resourceSystem;
      const tenantOK = this.initializationStatus.tenantSystem;
      const skillOK = this.initializationStatus.skillSystem;
      const configOK = this.configLoaded;

      if (configOK && resourceOK && tenantOK && skillOK) {
        statusEl.textContent = "🟢 完整模組化系統 - 運行中";
      } else if (configOK && (resourceOK || tenantOK || skillOK)) {
        statusEl.textContent = "🟡 部分模組化系統 - 降級模式";
      } else {
        statusEl.textContent = "🟡 基礎系統 - 後備模式";
      }
      statusEl.className = "system-status modular";
    }

    console.log("🎯 末日房東模擬器啟動完成！");
    console.log("📊 系統狀態:", this.getSystemStatus());
  }

  /**
   * 設定事件監聽器
   */
  setupEventListeners() {
    // 使用事件委派處理所有按鈕點擊
    document.addEventListener("click", (event) => {
      const target = event.target;

      // 房間點擊事件
      if (target.classList.contains("room")) {
        const roomId = parseInt(target.id.replace("room", ""));
        this.handleRoomClick(roomId);
        return;
      }

      // 按鈕點擊事件
      switch (target.id) {
        case "collectRentBtn":
          this.handleCollectRent();
          break;
        case "showVisitorsBtn":
          this.handleShowVisitors();
          break;
        case "showScavengeBtn":
          this.handleShowScavenge();
          break;
        case "harvestYardBtn":
          this.handleHarvestYard();
          break;
        case "showSkillBtn":
          this.handleShowSkills();
          break;
        case "nextDayBtn":
          this.handleNextDay();
          break;
        case "closeVisitorModal":
        case "closeSkillModal":
          this.closeModal();
          break;
      }
    });
  }

  /**
   * 設定全域函數代理
   */
  setupGlobalFunctionProxies() {
    // 設定全域遊戲功能函數
    window.gameApp = this;

    // 向後相容性函數
    window.addLog = (message, type) => this.addLog(message, type);
    window.updateDisplay = () => this.updateDisplay();
    window.closeModal = () => this.closeModal();

    // 租客相關函數
    window.hireTenant = (applicantId) => this.hireTenant(applicantId);
    window.generateApplicants = () => this.generateApplicants();

    // 搜刮相關函數
    window.sendTenantOnScavenge = (tenantName) =>
      this.sendTenantOnScavenge(tenantName);
  }

  /**
   * 設定UI事件監聽器
   */
  setupUIEventListeners() {
    // 鍵盤快捷鍵
    document.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "r":
        case "R":
          if (!event.ctrlKey && !event.altKey) {
            this.handleCollectRent();
          }
          break;
        case "v":
        case "V":
          if (!event.ctrlKey && !event.altKey) {
            this.handleShowVisitors();
          }
          break;
        case "Escape":
          this.closeModal();
          break;
      }
    });
  }

  /**
   * 遊戲核心功能實作（三系統整合版）
   */

  // 收租功能（使用 ResourceSystem）
  handleCollectRent() {
    if (this.gameState.rentCollected) {
      alert("今天已經收過房租了！");
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
      this.addLog(`收取房租 $${totalRent}`, "rent");
    } else {
      this.addLog("今日沒有房租收入", "event");
    }

    this.updateDisplay();
  }

  // 顯示訪客（使用 TenantSystem）
  handleShowVisitors() {
    console.log("🚪 顯示訪客列表...");

    // 使用 TenantSystem 生成申請者
    const applicants = this.generateApplicants();

    const modal = document.getElementById("visitorModal");
    const list = document.getElementById("visitorList");

    if (applicants.length === 0) {
      list.innerHTML = '<div class="applicant">今日沒有訪客前來應徵</div>';
    } else {
      list.innerHTML = applicants
        .map(
          (applicant) => `
        <div class="applicant ${applicant.infected ? "infected" : ""}">
          <strong>${applicant.name}</strong> - ${
            applicant.typeName || applicant.type
          }<br>
          <small>${applicant.description || "尋找住所的倖存者"}</small><br>
          <small style="color: #aaa;">外觀: ${applicant.appearance}</small><br>
          房租: ${applicant.rent}/天<br>
          ${
            applicant.personalResources
              ? `<small>個人資源: 食物${applicant.personalResources.food} 現金$${applicant.personalResources.cash}</small><br>`
              : ""
          }
          <button class="btn ${applicant.infected ? "danger" : ""}" 
                  onclick="window.gameApp.hireTenant('${applicant.id}')">
            雇用${applicant.infected ? " (危險)" : ""}
          </button>
        </div>
      `
        )
        .join("");
    }

    modal.style.display = "block";
  }

  // 生成申請者（使用 TenantSystem）
  generateApplicants() {
    if (this.tenantSystem && this.tenantSystem.getStatus().initialized) {
      return this.tenantSystem.generateApplicants();
    } else {
      console.warn("⚠️ TenantSystem 不可用");
      return [];
    }
  }

  // 雇用租客（使用 TenantSystem）
  hireTenant(applicantId) {
    console.log(`🤝 嘗試雇用申請者: ${applicantId}`);

    if (this.tenantSystem && this.tenantSystem.getStatus().initialized) {
      const success = this.tenantSystem.hireTenant(applicantId);
      if (success) {
        this.closeModal();
        this.updateDisplay();
      }
      return success;
    } else {
      console.warn("⚠️ TenantSystem 不可用");
      alert("租客系統暫時不可用");
      return false;
    }
  }

  // 院子採集（使用 ResourceSystem）
  handleHarvestYard() {
    if (this.gameState.harvestUsed) {
      alert("今天已經採集過院子了！");
      return;
    }

    if (this.gameState.harvestCooldown > 0) {
      alert(`院子需要休息 ${this.gameState.harvestCooldown} 天才能再次採集！`);
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

        this.updateDisplay();
      } else {
        this.addLog("院子採集失敗", "danger");
      }
    } else {
      // 後備處理
      const baseAmount = 2;
      const totalAmount = baseAmount + farmerCount * 2;
      this.gameState.resources.food += totalAmount;
      this.gameState.harvestUsed = true;
      this.gameState.harvestCooldown = 2;

      this.addLog(`院子採集獲得 ${totalAmount} 食物`, "rent");
      this.updateDisplay();
    }
  }

  // 搜刮系統（使用 ResourceSystem）
  handleShowScavenge() {
    if (this.gameState.scavengeUsed >= this.gameState.maxScavengePerDay) {
      alert("今天的搜刮次數已用完！");
      return;
    }

    // 檢查可用租客
    const availableTenants = this.getAvailableTenantsForScavenge();

    if (availableTenants.length === 0) {
      alert("沒有可派遣的租客！");
      return;
    }

    // 顯示搜刮選單
    this.showScavengeMenu(availableTenants);
  }

  // 取得可搜刮的租客
  getAvailableTenantsForScavenge() {
    return this.gameState.rooms
      .filter(
        (room) => room.tenant && !room.tenant.infected && !room.tenant.onMission
      )
      .map((room) => room.tenant);
  }

  // 顯示搜刮選單
  showScavengeMenu(availableTenants) {
    const modal = document.getElementById("scavengeModal");
    const list = document.getElementById("availableTenants");
    const remainingEl = document.getElementById("remainingScavenges");

    if (!modal || !list || !remainingEl) {
      console.warn("⚠️ 搜刮選單 DOM 元素缺失");
      return;
    }

    remainingEl.textContent =
      this.gameState.maxScavengePerDay - this.gameState.scavengeUsed;

    list.innerHTML = availableTenants
      .map((tenant) => {
        // 計算成功率
        const successRate = this.calculateScavengeSuccessRate(tenant);
        const riskLevel =
          successRate >= 80 ? "低" : successRate >= 60 ? "中" : "高";
        const riskColor =
          successRate >= 80
            ? "#66ff66"
            : successRate >= 60
            ? "#ffcc66"
            : "#ff6666";

        return `
        <div class="applicant">
          <strong>${tenant.name}</strong> - ${
          tenant.typeName || tenant.type
        }<br>
          <small>成功率: ${successRate}% (風險: <span style="color: ${riskColor}">${riskLevel}</span>)</small><br>
          <small>個人狀況: 食物${tenant.personalResources?.food || 0} 醫療${
          tenant.personalResources?.medical || 0
        }</small><br>
          <button class="btn" onclick="window.gameApp.sendTenantOnScavenge('${
            tenant.name
          }')">
            派遣搜刮
          </button>
        </div>
      `;
      })
      .join("");

    modal.style.display = "block";
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
      alert("找不到指定租客！");
      return;
    }

    if (this.gameState.scavengeUsed >= this.gameState.maxScavengePerDay) {
      alert("今天的搜刮次數已用完！");
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
    this.updateDisplay();
  }

  // 處理搜刮結果
  handleScavengeResult(tenant, result) {
    if (result.success) {
      this.addLog(`${tenant.name} 搜刮成功！`, "rent");

      // 顯示獲得的資源
      const rewardDesc = Object.keys(result.rewards)
        .map((type) => `${result.rewards[type]} ${type}`)
        .join(", ");

      if (rewardDesc) {
        this.addLog(`獲得: ${rewardDesc}`, "rent");
      }
    } else {
      this.addLog(`${tenant.name} 搜刮失敗`, "danger");

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
          this.addLog(`${tenant.name} 可能被感染了！`, "danger");
        }
        break;
      case "resource":
        if (tenant.personalResources && tenant.personalResources.food > 0) {
          tenant.personalResources.food = Math.max(
            0,
            tenant.personalResources.food - 2
          );
          this.addLog(`${tenant.name} 損失了一些個人物品`, "danger");
        }
        break;
      case "health":
        // 健康狀態影響，可在後續版本實作
        this.addLog(`${tenant.name} 受了輕傷`, "danger");
        break;
    }
  }

  // 後備搜刮處理
  handleScavengeFallback(tenant) {
    const successRate = this.calculateScavengeSuccessRate(tenant);
    const isSuccess = Math.random() * 100 < successRate;

    if (isSuccess) {
      // 簡單的資源獎勵
      const foodGain = Math.floor(Math.random() * 5) + 3;
      const materialsGain = Math.floor(Math.random() * 3) + 1;

      this.gameState.resources.food += foodGain;
      this.gameState.resources.materials += materialsGain;

      this.addLog(
        `${tenant.name} 搜刮成功，獲得 ${foodGain} 食物、${materialsGain} 建材`,
        "rent"
      );
    } else {
      this.addLog(`${tenant.name} 搜刮失敗`, "danger");

      // 失敗可能導致受傷
      if (Math.random() < 0.3) {
        tenant.infected = Math.random() < 0.2;
        this.addLog(
          `${tenant.name} ${tenant.infected ? "被感染了" : "受了輕傷"}`,
          "danger"
        );
      }
    }
  }

  // 房間點擊處理
  handleRoomClick(roomId) {
    const room = this.gameState.rooms.find((r) => r.id === roomId);

    if (room.tenant) {
      const tenant = room.tenant;
      const satisfaction = this.gameState.tenantSatisfaction[tenant.name] || 50;

      // 使用 TenantSystem 獲取詳細資訊
      let detailInfo = "";
      if (this.tenantSystem && this.tenantSystem.getStatus().initialized) {
        const tenantState = this.tenantSystem.getTenantState(tenant.name);
        if (tenantState) {
          detailInfo = `\n住了 ${tenantState.stats.daysLived} 天`;
          if (tenantState.stats.satisfactionHistory.length > 1) {
            const trend = tenantState.stats.satisfactionHistory.slice(-2);
            const change = trend[1] - trend[0];
            detailInfo +=
              change > 0
                ? " (滿意度上升)"
                : change < 0
                ? " (滿意度下降)"
                : " (滿意度穩定)";
          }
        }
      }

      alert(
        `房間 ${roomId} - ${tenant.name}\n類型: ${
          tenant.typeName || tenant.type
        }\n房租: ${tenant.rent}/天\n滿意度: ${satisfaction}%\n狀態: ${
          tenant.infected ? "已感染" : "健康"
        }${detailInfo}`
      );
    } else {
      alert(`房間 ${roomId} - 空房\n點擊「查看訪客」來招募租客`);
    }
  }

  /**
   * 技能選單顯示（使用 SkillSystem）
   */
  handleShowSkills() {
    if (!this.skillSystem?.getStatus().initialized) {
      alert("技能系統載入中，請稍候...");
      return;
    }

    const modal = document.getElementById("skillModal");
    const skillList = document.getElementById("skillList");

    const skillsByTenant = [];

    this.gameState.rooms.forEach((room) => {
      if (room.tenant && !room.tenant.infected) {
        const tenant = room.tenant;
        const tenantSkills = this.skillSystem.getAvailableSkills(tenant.name);

        if (tenantSkills.length > 0) {
          skillsByTenant.push({ tenant, skills: tenantSkills });
        }
      }
    });

    if (skillsByTenant.length === 0) {
      skillList.innerHTML = "<p>目前沒有可用的技能</p>";
    } else {
      skillList.innerHTML = skillsByTenant
        .map((tenantData) => {
          const { tenant, skills } = tenantData;
          const roomId =
            this.gameState.rooms.find((r) => r.tenant === tenant)?.id || "?";

          return `
        <div class="tenant-skill-group">
          <h4 style="color: #66ccff; margin: 15px 0 10px 0;">
            ${tenant.name} (${tenant.typeName || tenant.type}) - 房間${roomId}
          </h4>
          <div style="font-size: 11px; color: #aaa; margin-bottom: 10px;">
            個人現金: $${tenant.personalResources?.cash || 0}
          </div>
          ${skills
            .map(
              (skill) => `
            <div class="skill-actions">
              <h5 style="margin: 5px 0; color: #ffcc66;">${skill.name}</h5>
              <p style="margin: 5px 0; font-size: 12px;">${
                skill.description
              }</p>
              ${
                skill.cooldownRemaining > 0
                  ? `<p style="color: #ff9966;">冷卻中：${skill.cooldownRemaining} 天</p>`
                  : ""
              }
              ${
                !skill.canAfford
                  ? `<p style="color: #ff6666;">資源不足</p>`
                  : ""
              }
              <button class="btn ${
                skill.canAfford && skill.cooldownRemaining === 0
                  ? "success"
                  : ""
              }" 
                      onclick="window.gameApp.useSkillFromMenu('${
                        tenant.name
                      }', '${skill.id}')"
                      ${
                        !skill.canAfford || skill.cooldownRemaining > 0
                          ? "disabled"
                          : ""
                      }>
                使用技能
              </button>
            </div>
          `
            )
            .join("")}
        </div>
      `;
        })
        .join("");
    }

    modal.style.display = "block";
  }

  /**
   * 技能選單執行處理
   */
  async useSkillFromMenu(tenantName, skillId) {
    if (!this.skillSystem?.getStatus().initialized) {
      this.addLog("技能系統不可用", "danger");
      return false;
    }

    const result = await this.skillSystem.executeSkill(tenantName, skillId);

    if (result.success) {
      this.addLog(`技能執行成功`, "skill");
    } else {
      const messages = {
        tenant_not_found: "找不到指定租客",
        insufficient_resources: "資源不足",
        on_cooldown: result.message || "技能冷卻中",
        requirements_not_met: "技能使用條件不滿足",
      };
      this.addLog(messages[result.reason] || "技能執行失敗", "danger");
    }

    this.closeModal();
    this.updateDisplay();
    return result.success;
  }

  /**
   * 被動技能處理
   */
  processPassiveSkills(trigger, context = {}) {
    if (this.skillSystem?.getStatus().initialized) {
      this.skillSystem.processPassiveSkills(trigger, context);
    }
  }

  // 下一天（三系統整合版）
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

    // 使用 ResourceSystem 處理消費
    this.processDailyConsumption();

    this.addLog(`新的一天開始了 - 第${this.gameState.day}天`, "event");
    this.updateDisplay();
  }

  // 日常消費處理（使用 ResourceSystem）
  processDailyConsumption() {
    if (this.resourceSystem && this.resourceSystem.getStatus().initialized) {
      // 房東日常消費
      this.resourceSystem.processConsumption("landlord_daily");

      // 建築日常消費
      this.resourceSystem.processConsumption("building_daily");
    } else {
      // 後備消費處理
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
      this.addLog(`房東消耗了 ${dailyConsumption} 食物`, "event");
    } else if (this.gameState.resources.food >= 1) {
      this.gameState.resources.food -= 1;
      this.gameState.landlordHunger += 1;
      this.addLog("食物不足，房東仍感到飢餓", "danger");
    } else {
      this.gameState.landlordHunger += 2;
      this.addLog("沒有食物！房東非常飢餓", "danger");
    }
  }

  // 後備建築消費
  processBuildingConsumptionFallback() {
    const fuelConsumption = 1;

    if (this.gameState.resources.fuel >= fuelConsumption) {
      this.gameState.resources.fuel -= fuelConsumption;
      this.addLog(`房屋設施消耗了 ${fuelConsumption} 燃料`, "event");
    } else {
      this.addLog("燃料不足！房屋運作受影響", "danger");
    }
  }

  /**
   * 工具函數
   */

  // 添加遊戲記錄
  addLog(message, type = "event") {
    const log = document.getElementById("gameLog");
    if (!log) return;

    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = `第${this.gameState.day}天: ${message}`;
    log.appendChild(entry);

    // 限制日誌條目數量
    const maxEntries = UI_CONSTANTS.LAYOUT?.MAX_LOG_VISIBLE || 50;
    const entries = log.children;
    if (entries.length > maxEntries) {
      log.removeChild(entries[0]);
    }

    log.scrollTop = log.scrollHeight;
  }

  // 更新顯示
  updateDisplay() {
    // 更新基本狀態
    this.updateElement("day", this.gameState.day);
    this.updateElement("time", this.gameState.time === "day" ? "白天" : "夜晚");
    this.updateElement("cash", this.gameState.resources.cash);

    // 更新狀態文字
    if (this.gameHelpers) {
      const defenseStatus = this.gameHelpers.getDefenseStatus(
        this.gameState.buildingDefense
      );
      const hungerStatus = this.gameHelpers.getHungerStatus(
        this.gameState.landlordHunger
      );

      this.updateElement("buildingDefenseText", defenseStatus.text);
      this.updateElement("landlordHungerText", hungerStatus.text);

      // 設定狀態顏色
      const defenseEl = document.getElementById("buildingDefenseText");
      const hungerEl = document.getElementById("landlordHungerText");

      if (defenseEl) {
        defenseEl.style.color = defenseStatus.color;
        if (defenseStatus.critical) defenseEl.classList.add("danger-status");
      }

      if (hungerEl) {
        hungerEl.style.color = hungerStatus.color;
        if (hungerStatus.critical) hungerEl.classList.add("danger-status");
      }
    } else {
      // 後備狀態顯示
      this.updateElement(
        "buildingDefenseText",
        `防禦(${this.gameState.buildingDefense})`
      );
      this.updateElement(
        "landlordHungerText",
        `飢餓(${this.gameState.landlordHunger})`
      );
    }

    this.updateElement("scavengeCount", this.gameState.scavengeUsed);

    // 更新資源顯示
    [
      DATA_TYPES.RESOURCE_TYPES.FOOD,
      DATA_TYPES.RESOURCE_TYPES.MATERIALS,
      DATA_TYPES.RESOURCE_TYPES.MEDICAL,
      DATA_TYPES.RESOURCE_TYPES.FUEL,
    ].forEach((resource) => {
      this.updateElement(resource, this.gameState.resources[resource]);
    });

    // 更新房間顯示
    this.updateRoomDisplay();

    // 更新租客列表
    this.updateTenantList();
  }

  // 安全的元素更新
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  // 更新房間顯示
  updateRoomDisplay() {
    this.gameState.rooms.forEach((room) => {
      const roomElement = document.getElementById(`room${room.id}`);
      const infoElement = document.getElementById(`room${room.id}-info`);

      if (!roomElement || !infoElement) return;

      roomElement.className = "room";

      if (room.tenant) {
        roomElement.classList.add("occupied");
        if (room.tenant.infected) {
          roomElement.classList.add("infected");
        }

        const satisfaction =
          this.gameState.tenantSatisfaction[room.tenant.name] || 50;
        const satisfactionText =
          satisfaction >= 70 ? "😊" : satisfaction >= 40 ? "😐" : "😞";

        infoElement.innerHTML = `${room.tenant.name}<br><small>${
          room.tenant.typeName || room.tenant.type
        }</small><br><small>滿意度: ${satisfaction} ${satisfactionText}</small>`;
      } else {
        infoElement.textContent = "空房";
      }

      if (room.needsRepair) {
        roomElement.classList.add("needs-repair");
        infoElement.innerHTML +=
          '<br><small style="color:#ff6666">需要維修</small>';
      }

      if (room.reinforced) {
        roomElement.classList.add("reinforced");
        infoElement.innerHTML +=
          '<br><small style="color:#66ccff">已加固</small>';
      }
    });
  }

  // 更新租客列表
  updateTenantList() {
    const tenantList = document.getElementById("tenantList");
    if (!tenantList) return;

    const tenants = this.gameState.rooms
      .filter((room) => room.tenant)
      .map((room) => room.tenant);

    if (tenants.length === 0) {
      tenantList.innerHTML = '<div class="tenant-item">暫無租客</div>';
    } else {
      tenantList.innerHTML = tenants
        .map((tenant) => {
          const satisfaction =
            this.gameState.tenantSatisfaction[tenant.name] || 50;
          const statusText = tenant.infected
            ? '<br><small style="color:#ff6666">已感染！</small>'
            : tenant.onMission
            ? '<br><small style="color:#ffaa66">執行任務中</small>'
            : "";

          // 額外資訊
          let extraInfo = "";
          if (this.tenantSystem && this.tenantSystem.getStatus().initialized) {
            const tenantState = this.tenantSystem.getTenantState(tenant.name);
            if (tenantState && tenantState.stats) {
              extraInfo = `<br><small style="color:#aaa;">住了 ${tenantState.stats.daysLived} 天</small>`;
            }
          }

          // 個人資源顯示
          let resourceInfo = "";
          if (tenant.personalResources) {
            resourceInfo = `<br><small style="color:#cccccc;">個人: $${
              tenant.personalResources.cash || 0
            } 食物${tenant.personalResources.food || 0}</small>`;
          }

          return `<div class="tenant-item ${
            tenant.infected ? "infected" : ""
          } ${tenant.type || tenant.typeId}">
          ${tenant.name} (${tenant.typeName || tenant.type})<br>
          <small>房租: ${tenant.rent}/天</small>
          ${resourceInfo}
          <small>滿意度: ${satisfaction}%</small>
          ${extraInfo}
          ${statusText}
        </div>`;
        })
        .join("");
    }
  }

  // 關閉模態框
  closeModal() {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.style.display = "none";
    });
  }

  // 更新系統狀態顯示
  updateSystemStatus(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
    }
  }

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
   * 錯誤處理機制
   */
  createErrorHandler() {
    return {
      handleInitializationError: (error) => {
        console.error("❌ 應用程式初始化失敗:", error);

        const statusEl = document.getElementById("systemStatus");
        if (statusEl) {
          statusEl.textContent = "🔴 系統啟動失敗";
          statusEl.className = "system-status error";
        }

        this.attemptFallbackInitialization();
      },

      handleRuntimeError: (error, context) => {
        console.error(`❌ 執行時錯誤 (${context}):`, error);
        this.addLog(`系統錯誤: ${context}`, "danger");
      },
    };
  }

  /**
   * 降級啟動機制
   */
  attemptFallbackInitialization() {
    console.log("🔄 嘗試降級啟動模式...");

    try {
      this.setupUIEventListeners();
      this.addLog("系統啟動失敗，正在降級模式下運行", "danger");
      this.addLog("部分功能可能不可用", "danger");
      this.updateDisplay();
    } catch (fallbackError) {
      console.error("❌ 降級啟動也失敗:", fallbackError);
      alert("遊戲初始化失敗，請重新整理頁面或檢查瀏覽器支援度");
    }
  }
}

/**
 * 應用程式啟動
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎮 DOM 載入完成，開始初始化應用程式...");

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

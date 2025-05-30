/**
 * 末日房東模擬器 v2.0 - 主程式進入點
 * 職責：應用程式初始化、模組載入協調、全域狀態管理
 */

// 核心系統模組
import { DataManager } from "./core/DataManager.js";
import { RuleEngine } from "./core/RuleEngine.js";
import { GameBridge } from "./core/GameBridge.js";

// 工具函數模組
import { GameHelpers } from "./utils/helpers.js";

/**
 * 應用程式主類
 * 負責整個遊戲的啟動、模組協調、生命週期管理
 */
class Game {
  constructor() {
    // 遊戲狀態 - 從配置檔案初始化
    this.gameState = {
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

      // 新增：全域效果追蹤
      emergencyTraining: false,
      foodPreservation: false,
      patrolSystem: false,
      socialNetwork: false,
      nightWatchActive: false,
    };

    // 系統模組實例
    this.dataManager = null;
    this.ruleEngine = null;
    this.gameBridge = null;
    this.gameHelpers = null;

    // 初始化狀態追蹤
    this.initializationStatus = {
      dataManager: false,
      ruleEngine: false,
      gameBridge: false,
      gameHelpers: false,
      complete: false,
    };

    // 錯誤處理機制
    this.errorHandler = this.createErrorHandler();
  }

  /**
   * 應用程式初始化主流程
   */
  async initialize() {
    console.log("🎮 末日房東模擬器 v2.0 啟動中...");

    try {
      // 階段 1：初始化核心系統
      await this.initializeCoreModules();

      // 階段 2：載入遊戲配置
      await this.loadGameConfiguration();

      // 階段 3：建立系統整合
      await this.establishSystemIntegration();

      // 階段 4：啟動遊戲介面
      await this.initializeGameInterface();

      // 階段 5：完成啟動
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
      // 載入所有配置檔案
      const configTypes = ["tenants", "skills", "events", "rules"];
      const loadPromises = configTypes.map((type) =>
        this.dataManager.loadData(type).catch((error) => {
          console.warn(`⚠️ 載入 ${type} 配置失敗，使用預設值:`, error.message);
          return this.dataManager.getDefaultData(type);
        })
      );

      await Promise.all(loadPromises);

      // 如果規則配置載入成功，初始化 GameHelpers
      const rulesConfig = this.dataManager.getCachedData("rules");
      if (rulesConfig && this.gameHelpers) {
        this.gameHelpers.injectConfig(rulesConfig);
      }

      console.log("✅ 遊戲配置載入完成");
    } catch (error) {
      console.warn("⚠️ 部分配置載入失敗，使用預設配置:", error.message);
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

    // 建立模組間通信機制
    this.setupInterModuleCommunication();

    console.log("✅ 系統整合建立完成");
  }

  /**
   * 初始化遊戲介面
   */
  async initializeGameInterface() {
    console.log("🖥️ 正在初始化遊戲介面...");

    // 建立基礎介面事件監聽
    this.setupUIEventListeners();

    // 初始化遊戲記錄
    this.addLog("歡迎來到末日房東模擬器 v2.0！", "event");
    this.addLog("當前使用全新的ES6模組化架構", "event");
    this.addLog("所有系統模組已成功載入並就緒", "event");

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
      statusEl.textContent = "🟢 模組化系統 v2.0 - 運行中";
      statusEl.className = "system-status modular";
    }

    console.log("🎯 末日房東模擬器 v2.0 啟動完成！");
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
  }

  /**
   * 設定模組間通信
   */
  setupInterModuleCommunication() {
    // 這裡將在後續對話中實作更複雜的通信機制
    // 目前提供基礎的事件傳遞功能
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
   * 遊戲核心功能實作
   */

  // 收租功能
  handleCollectRent() {
    if (this.gameState.rentCollected) {
      alert("今天已經收過房租了！");
      return;
    }

    let totalRent = 0;
    this.gameState.rooms.forEach((room) => {
      if (room.tenant && !room.tenant.infected) {
        let rent = room.tenant.rent;
        if (room.reinforced) {
          rent = Math.floor(rent * 1.2); // 加固房間 +20% 租金
        }
        totalRent += rent;
      }
    });

    this.gameState.resources.cash += totalRent;
    this.gameState.rentCollected = true;

    if (totalRent > 0) {
      this.addLog(`收取房租 $${totalRent}`, "rent");
    } else {
      this.addLog("今日沒有房租收入", "event");
    }

    this.updateDisplay();
  }

  // 顯示訪客
  handleShowVisitors() {
    // 生成訪客（暫時使用簡化版本）
    this.generateApplicants();

    const modal = document.getElementById("visitorModal");
    const list = document.getElementById("visitorList");

    list.innerHTML = this.gameState.applicants
      .map(
        (applicant) => `
      <div class="applicant ${applicant.infected ? "infected" : ""}">
        <strong>${applicant.name}</strong> - ${
          applicant.typeName || applicant.type
        }<br>
        <small>${applicant.description || "尋找住所的倖存者"}</small><br>
        <small style="color: #aaa;">外觀: ${applicant.appearance}</small><br>
        房租: ${applicant.rent}/天<br>
        <button class="btn ${applicant.infected ? "danger" : ""}" 
                onclick="window.gameApp.hireTenant('${applicant.id}')">
          雇用${applicant.infected ? " (危險)" : ""}
        </button>
      </div>
    `
      )
      .join("");

    modal.style.display = "block";
  }

  // 雇用租客
  hireTenant(applicantId) {
    const applicant = this.gameState.applicants.find(
      (a) => a.id === applicantId
    );
    const emptyRoom = this.gameState.rooms.find((room) => !room.tenant);

    if (!emptyRoom) {
      alert("沒有空房間！");
      return false;
    }

    if (!applicant) {
      alert("找不到指定申請者！");
      return false;
    }

    // 建立租客
    emptyRoom.tenant = {
      ...applicant,
      moveInDate: this.gameState.day,
    };

    // 初始化租客滿意度
    this.gameState.tenantSatisfaction[applicant.name] = 50;

    // 從申請者列表移除
    this.gameState.applicants = this.gameState.applicants.filter(
      (a) => a.id !== applicantId
    );

    this.addLog(`新租客 ${applicant.name} 入住房間 ${emptyRoom.id}`, "rent");
    this.closeModal();
    this.updateDisplay();

    return true;
  }

  // 房間點擊處理
  handleRoomClick(roomId) {
    const room = this.gameState.rooms.find((r) => r.id === roomId);

    if (room.tenant) {
      const tenant = room.tenant;
      const satisfaction = this.gameState.tenantSatisfaction[tenant.name] || 50;

      alert(
        `房間 ${roomId} - ${tenant.name}\n類型: ${
          tenant.typeName || tenant.type
        }\n房租: ${tenant.rent}/天\n滿意度: ${satisfaction}%\n狀態: ${
          tenant.infected ? "已感染" : "健康"
        }`
      );
    } else {
      alert(`房間 ${roomId} - 空房\n點擊「查看訪客」來招募租客`);
    }
  }

  // 院子採集
  handleHarvestYard() {
    if (this.gameState.harvestUsed) {
      alert("今天已經採集過院子了！");
      return;
    }

    if (this.gameState.harvestCooldown > 0) {
      alert(`院子需要休息 ${this.gameState.harvestCooldown} 天才能再次採集！`);
      return;
    }

    const baseAmount = 2;
    // 農夫加成（後續在業務系統中實作）
    const farmerCount = this.gameState.rooms.filter(
      (room) =>
        room.tenant && room.tenant.type === "farmer" && !room.tenant.infected
    ).length;

    const totalAmount = baseAmount + farmerCount * 2;

    this.gameState.resources.food += totalAmount;
    this.gameState.harvestUsed = true;
    this.gameState.harvestCooldown = 2;

    const bonusText = farmerCount > 0 ? ` (農夫加成 +${farmerCount * 2})` : "";
    this.addLog(`院子採集獲得 ${totalAmount} 食物${bonusText}`, "rent");

    this.updateDisplay();
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

    // 房東消費食物
    this.processLandlordConsumption();

    // 燃料消費
    if (this.gameState.resources.fuel > 0) {
      this.gameState.resources.fuel -= 1;
      this.addLog("房屋設施消耗了 1 燃料", "event");
    } else {
      this.addLog("燃料不足！房屋設施無法正常運作", "danger");
    }

    this.addLog("新的一天開始了", "event");
    this.updateDisplay();
  }

  // 處理房東消費
  processLandlordConsumption() {
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
      this.addLog("房東只吃了 1 食物，仍感到飢餓", "danger");
    } else {
      this.gameState.landlordHunger += 2;
      this.addLog("房東沒有食物可吃！", "danger");
    }
  }

  // 暫時實作的功能（將在後續對話中完善）
  handleShowScavenge() {
    alert("派遣搜刮功能將在對話3B中完善實作");
  }

  handleShowSkills() {
    alert("技能系統將在對話3B中完善實作");
  }

  /**
   * 工具函數
   */

  // 生成申請者（簡化版本）
  generateApplicants() {
    if (this.gameState.applicants.length > 0) return;

    const count = Math.floor(Math.random() * 3) + 1;
    const types = [
      {
        name: "醫生",
        type: "doctor",
        typeName: "醫生",
        rent: 15,
        description: "可以治療感染，檢測可疑租客",
      },
      {
        name: "工人",
        type: "worker",
        typeName: "工人",
        rent: 12,
        description: "擅長維修建築，房間升級",
      },
      {
        name: "農夫",
        type: "farmer",
        typeName: "農夫",
        rent: 10,
        description: "提升院子採集效率，種植作物",
      },
      {
        name: "軍人",
        type: "soldier",
        typeName: "軍人",
        rent: 18,
        description: "戰鬥力強，提升房屋防禦",
      },
      {
        name: "老人",
        type: "elder",
        typeName: "老人",
        rent: 8,
        description: "經驗豐富，調解糾紛",
      },
    ];

    this.gameState.applicants = [];

    for (let i = 0; i < count; i++) {
      const typeTemplate = types[Math.floor(Math.random() * types.length)];
      const infected = Math.random() < 0.2;

      const applicant = {
        ...typeTemplate,
        id: `applicant_${Date.now()}_${i}`,
        name: this.generateRandomName(),
        infected: infected,
        appearance: infected
          ? this.getInfectedAppearance()
          : this.getNormalAppearance(),
      };

      this.gameState.applicants.push(applicant);
    }
  }

  generateRandomName() {
    const names = [
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
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  getNormalAppearance() {
    const appearances = [
      "看起來精神狀態不錯",
      "衣著整潔，談吐得體",
      "眼神清澈，反應靈敏",
      "握手時手掌溫暖有力",
    ];
    return appearances[Math.floor(Math.random() * appearances.length)];
  }

  getInfectedAppearance() {
    const appearances = [
      "眼神有點呆滯，反應遲鈍",
      "皮膚蒼白，手有輕微顫抖",
      "說話時偶爾停頓，像在想什麼",
      "有股奇怪的味道，像是腐肉",
    ];
    return appearances[Math.floor(Math.random() * appearances.length)];
  }

  // 添加遊戲記錄
  addLog(message, type = "event") {
    const log = document.getElementById("gameLog");
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = `第${this.gameState.day}天: ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  // 更新顯示
  updateDisplay() {
    // 更新基本狀態
    document.getElementById("day").textContent = this.gameState.day;
    document.getElementById("time").textContent =
      this.gameState.time === "day" ? "白天" : "夜晚";
    document.getElementById("cash").textContent = this.gameState.resources.cash;

    // 更新狀態文字
    document.getElementById("buildingDefenseText").textContent = this
      .gameHelpers
      ? this.gameHelpers.getDefenseStatus(this.gameState.buildingDefense).text
      : `防禦(${this.gameState.buildingDefense})`;

    document.getElementById("landlordHungerText").textContent = this.gameHelpers
      ? this.gameHelpers.getHungerStatus(this.gameState.landlordHunger).text
      : `飢餓(${this.gameState.landlordHunger})`;

    document.getElementById("scavengeCount").textContent =
      this.gameState.scavengeUsed;

    // 更新資源顯示
    ["food", "materials", "medical", "fuel"].forEach((resource) => {
      const element = document.getElementById(resource);
      if (element) {
        element.textContent = this.gameState.resources[resource];
      }
    });

    // 更新房間顯示
    this.updateRoomDisplay();

    // 更新租客列表
    this.updateTenantList();
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
            : "";

          return `<div class="tenant-item ${
            tenant.infected ? "infected" : ""
          } ${tenant.type}">
          ${tenant.name} (${tenant.typeName || tenant.type})<br>
          <small>房租: ${tenant.rent}/天</small><br>
          <small>滿意度: ${satisfaction}%</small>
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
      },
    };
  }

  /**
   * 錯誤處理機制
   */
  createErrorHandler() {
    return {
      handleInitializationError: (error) => {
        console.error("❌ 應用程式初始化失敗:", error);

        // 顯示錯誤訊息給使用者
        const statusEl = document.getElementById("systemStatus");
        if (statusEl) {
          statusEl.textContent = "🔴 系統啟動失敗";
          statusEl.className = "system-status error";
        }

        // 嘗試降級啟動
        this.attemptFallbackInitialization();
      },

      handleRuntimeError: (error, context) => {
        console.error(`❌ 執行時錯誤 (${context}):`, error);
        this.addLog(`系統錯誤: ${error.message}`, "danger");
      },
    };
  }

  /**
   * 降級啟動機制
   */
  attemptFallbackInitialization() {
    console.log("🔄 嘗試降級啟動模式...");

    try {
      // 使用最基本的功能初始化
      this.setupUIEventListeners();
      this.addLog("遊戲以降級模式啟動", "danger");
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

    // 將應用程式實例設為全域變數以便偵錯
    window.gameApp = app;
  } catch (error) {
    console.error("❌ 應用程式啟動失敗:", error);
    alert("遊戲啟動失敗，請檢查瀏覽器支援度或重新整理頁面");
  }
});

// 匯出主應用程式類別（供其他模組使用）
export { Game };

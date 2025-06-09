// @ts-check

/**
 * @fileoverview UIController.js - 純粹UI控制器
 * 職責：僅負責UI狀態更新、事件綁定、模態框控制
 * 依賴路徑：rules.json → DataManager → gameApp → UIController
 */

/**
 * @see {@link ../Type.js} 完整類型定義
 * @typedef {import('../Type.js').UIState} UIState
 * @typedef {import('../Type.js').LogType} LogType
 * @typedef {import('../Type.js').EventHandler} EventHandler
 * @typedef {import('../Type.js').ClickHandler} ClickHandler
 */

/**
 * 資源閾值類型定義
 * @typedef {Object} ResourceThresholds
 * @property {number} food - 食物閾值
 * @property {number} materials - 建材閾值
 * @property {number} medical - 醫療閾值
 * @property {number} fuel - 燃料閾值
 * @property {number} cash - 現金閾值
 */

/**
 * 閾值配置類型定義
 * @typedef {Object} ThresholdConfig
 * @property {Object} resources - 資源閾值
 * @property {ResourceThresholds} resources.warning - 警告閾值
 * @property {ResourceThresholds} resources.critical - 危險閾值
 * @property {Object} satisfaction - 滿意度閾值
 * @property {Array<Object>} satisfaction.levels - 滿意度等級
 * @property {Object} building - 建築防禦閾值
 * @property {Object} hunger - 飢餓狀態閾值
 */

/**
 * 純粹UI控制器類
 * 僅負責UI更新和事件處理，所有業務邏輯委託給 gameApp
 * @class
 */
export default class UIController {
  /**
   * 建立UI控制器實例
   * @param {Object} gameApp - 遊戲應用程式實例
   */
  constructor(gameApp) {
    /**
     * 遊戲應用程式引用
     * @type {Object}
     */
    this.gameApp = gameApp;

    /**
     * UI狀態
     * @type {UIState}
     */
    this.uiState = {
      debugMode: false,
      activeModal: null,
      systemReady: false,
    };

    /**
     * 更新時間間隔（毫秒）
     * @type {number}
     */
    this.updateInterval = 1000;

    /**
     * 更新計時器ID
     * @type {number|null}
     */
    this.updateTimer = null;

    /**
     * 確認回調函數
     * @type {Function|null}
     */
    this.confirmCallback = null;

    // 快取閾值配置
    /** @type {ThresholdConfig|null} */
    this.thresholdConfig = null;

    console.log("🎨 UIController 已初始化");
  }

  /**
   * 初始化UI控制器
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log("🎨 正在初始化UI控制器...");

      // 等待 gameApp 完全初始化
      await this._waitForGameApp();

      // 載入閾值配置
      this.loadThresholdConfig();

      // 綁定事件監聽器
      this.bindEventListeners();

      // 設定遊戲狀態監聽
      this.setupGameStateListeners();

      // 初始更新顯示
      this.updateAllDisplays();

      // 開始定期更新
      this.startPeriodicUpdates();

      // 設定系統就緒狀態
      this.uiState.systemReady = true;
      this.updateSystemStatus("ready", "🟢 末日房東模擬器 v2.0 - 運行中");

      console.log("✅ UI控制器初始化完成");
    } catch (error) {
      console.error("❌ UI控制器初始化失敗:", error);
      this.updateSystemStatus("error", "🔴 UI系統載入失敗");
      throw error;
    }
  }

  /**
   * 等待 gameApp 初始化完成
   * @private
   * @returns {Promise<void>}
   */
  async _waitForGameApp() {
    if (!this.gameApp.isInitialized) {
      console.log("⏳ 等待 gameApp 初始化完成...");
      let attempts = 0;

      while (!this.gameApp.isInitialized && attempts < 100) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;
      }

      if (!this.gameApp.isInitialized) {
        throw new Error("gameApp 初始化超時");
      }
    }
  }

  /**
   * 檢查系統是否可用
   * @private
   * @returns {boolean} 系統是否可用
   */
  _isSystemAvailable() {
    return this.gameApp && this.gameApp.isInitialized;
  }

  /**
   * 載入閾值配置
   * 從 gameApp 取得 rules.json 中的閾值設定
   * @returns {void}
   */
  loadThresholdConfig() {
    try {
      // 通過 gameApp 取得遊戲規則配置
      const gameRules = this.gameApp.dataManager?.getGameRules();

      if (!gameRules) {
        console.warn("⚠️ 無法取得遊戲規則配置，使用預設閾值");
        this.thresholdConfig = this.getDefaultThresholdConfig();
        return;
      }

      // 整合各種閾值配置
      this.thresholdConfig = {
        resources: {
          warning: gameRules.gameDefaults?.resources?.warningThresholds || {
            food: 5,
            materials: 3,
            medical: 2,
            fuel: 2,
            cash: 15,
          },
          critical: gameRules.gameDefaults?.resources?.criticalThresholds || {
            food: 2,
            materials: 1,
            medical: 1,
            fuel: 1,
            cash: 5,
          },
        },
        satisfaction: {
          levels: gameRules.gameBalance?.tenants?.satisfactionSystem?.display
            ?.levels || [
            {
              threshold: 80,
              name: "非常滿意",
              emoji: "😁",
              severity: "excellent",
            },
            { threshold: 60, name: "滿意", emoji: "😊", severity: "good" },
            { threshold: 40, name: "普通", emoji: "😐", severity: "normal" },
            { threshold: 20, name: "不滿", emoji: "😞", severity: "warning" },
            {
              threshold: 0,
              name: "極度不滿",
              emoji: "😡",
              severity: "critical",
            },
          ],
        },
        building: {
          defense: gameRules.gameBalance?.building?.defense || {
            levels: [
              { threshold: 0, name: "脆弱", severity: "critical" },
              { threshold: 10, name: "基礎", severity: "warning" },
              { threshold: 30, name: "加固", severity: "good" },
              { threshold: 50, name: "堅固", severity: "excellent" },
            ],
          },
        },
        hunger: {
          levels: gameRules.gameBalance?.player?.hunger || {
            levels: [
              { threshold: 0, name: "飽足", severity: "excellent" },
              { threshold: 20, name: "微餓", severity: "good" },
              { threshold: 50, name: "飢餓", severity: "warning" },
              { threshold: 80, name: "極餓", severity: "critical" },
            ],
          },
        },
      };

      console.log("📊 閾值配置載入完成:", this.thresholdConfig);
    } catch (error) {
      console.error("❌ 載入閾值配置失敗:", error);
      this.thresholdConfig = this.getDefaultThresholdConfig();
    }
  }

  /**
   * 取得預設閾值配置
   * 當無法從 rules.json 載入時的後備配置
   * @returns {ThresholdConfig}
   */
  getDefaultThresholdConfig() {
    return {
      resources: {
        warning: { food: 5, materials: 3, medical: 2, fuel: 2, cash: 15 },
        critical: { food: 2, materials: 1, medical: 1, fuel: 1, cash: 5 },
      },
      satisfaction: {
        levels: [
          {
            threshold: 80,
            name: "非常滿意",
            emoji: "😁",
            severity: "excellent",
          },
          { threshold: 60, name: "滿意", emoji: "😊", severity: "good" },
          { threshold: 40, name: "普通", emoji: "😐", severity: "normal" },
          { threshold: 20, name: "不滿", emoji: "😞", severity: "warning" },
          { threshold: 0, name: "極度不滿", emoji: "😡", severity: "critical" },
        ],
      },
      building: {
        defense: {
          levels: [
            { threshold: 0, name: "脆弱", severity: "critical" },
            { threshold: 10, name: "基礎", severity: "warning" },
            { threshold: 30, name: "加固", severity: "good" },
            { threshold: 50, name: "堅固", severity: "excellent" },
          ],
        },
      },
      hunger: {
        levels: [
          { threshold: 0, name: "飽足", severity: "excellent" },
          { threshold: 20, name: "微餓", severity: "good" },
          { threshold: 50, name: "飢餓", severity: "warning" },
          { threshold: 80, name: "極餓", severity: "critical" },
        ],
      },
    };
  }

  /**
   * 根據數值取得資源狀態
   * @param {string} resourceType - 資源類型
   * @param {number} value - 當前數值
   * @returns {Object} 狀態資訊
   */
  getResourceStatus(resourceType, value) {
    if (!this.thresholdConfig) {
      return { severity: "normal", message: "狀態未知" };
    }

    const { warning, critical } = this.thresholdConfig.resources;

    if (value <= (critical[resourceType] || 0)) {
      return { severity: "critical", message: "緊急" };
    } else if (value <= (warning[resourceType] || 0)) {
      return { severity: "warning", message: "警告" };
    } else {
      return { severity: "good", message: "充足" };
    }
  }

  /**
   * 根據數值取得滿意度狀態
   * @param {number} satisfaction - 滿意度數值 (0-100)
   * @returns {Object} 滿意度狀態
   */
  getSatisfactionStatus(satisfaction) {
    if (!this.thresholdConfig) {
      return { name: "未知", emoji: "❓", severity: "normal" };
    }

    const levels = this.thresholdConfig.satisfaction.levels;

    for (const level of levels) {
      if (satisfaction >= level.threshold) {
        return {
          name: level.name,
          emoji: level.emoji,
          severity: level.severity,
        };
      }
    }

    // 預設回傳最低等級
    return levels[levels.length - 1];
  }

  /**
   * 根據數值取得建築防禦狀態
   * @param {number} defense - 防禦數值
   * @returns {Object} 防禦狀態
   */
  getBuildingDefenseStatus(defense) {
    if (!this.thresholdConfig) {
      return { name: "未知", severity: "normal" };
    }

    const levels = this.thresholdConfig.building.defense.levels;

    for (let i = levels.length - 1; i >= 0; i--) {
      if (defense >= levels[i].threshold) {
        return {
          name: levels[i].name,
          severity: levels[i].severity,
        };
      }
    }

    return levels[0];
  }

  /**
   * 根據數值取得飢餓狀態
   * @param {number} hunger - 飢餓數值
   * @returns {Object} 飢餓狀態
   */
  getHungerStatus(hunger) {
    if (!this.thresholdConfig) {
      return { name: "未知", severity: "normal" };
    }

    const levels = this.thresholdConfig.hunger.levels;

    for (const level of levels) {
      if (hunger >= level.threshold) {
        return {
          name: level.name,
          severity: level.severity,
        };
      }
    }

    return levels[levels.length - 1];
  }

  /**
   * 更新狀態列顯示
   * 使用新的閾值配置來顯示狀態
   */
  updateStatusBar() {
    try {
      // 基本遊戲資訊
      const gameState = this.gameApp.gameState;
      const day = gameState.getStateValue("day") || 1;
      const timeOfDay = gameState.getStateValue("timeOfDay") || "白天";

      // 更新基本資訊
      this.updateElement("day", day);
      this.updateElement("time", timeOfDay);

      // 使用閾值配置更新資源顯示
      const resources = gameState.getStateValue("resources") || {};
      this.updateElement("cash", resources.cash || 0);

      // 使用新方法更新建築防禦狀態
      const buildingDefense = gameState.getStateValue("building.defense") || 0;
      const defenseStatus = this.getBuildingDefenseStatus(buildingDefense);
      this.updateElement(
        "buildingDefenseText",
        `${defenseStatus.name}(${buildingDefense})`
      );

      // 使用新方法更新飢餓狀態
      const landlordHunger = gameState.getStateValue("landlord.hunger") || 0;
      const hungerStatus = this.getHungerStatus(landlordHunger);
      this.updateElement(
        "landlordHungerText",
        `${hungerStatus.name}(${landlordHunger})`
      );
    } catch (error) {
      console.error("❌ 更新狀態列失敗:", error);
    }
  }

  /**
   * 更新資源顯示
   * 使用新的閾值配置來顯示資源狀態
   */
  updateResources() {
    try {
      const resources = this.gameApp.gameState.getStateValue("resources") || {};

      // 為每個資源添加狀態指示
      ["food", "materials", "medical", "fuel"].forEach((resourceType) => {
        const value = resources[resourceType] || 0;
        const status = this.getResourceStatus(resourceType, value);

        // 更新數值
        this.updateElement(resourceType, value);

        // 添加狀態顏色類別（可選）
        const element = document.getElementById(resourceType);
        if (element && element.parentElement) {
          const parent = element.parentElement;
          // 移除舊的狀態類別
          parent.classList.remove(
            "status-critical",
            "status-warning",
            "status-good"
          );
          // 添加新的狀態類別
          parent.classList.add(`status-${status.severity}`);
        }
      });
    } catch (error) {
      console.error("❌ 更新資源顯示失敗:", error);
    }
  }

  /**
   * 重新載入閾值配置
   * 當遊戲規則更新時可以調用此方法
   * @returns {void}
   */
  reloadThresholdConfig() {
    console.log("🔄 重新載入閾值配置");
    this.loadThresholdConfig();
    this.updateAllDisplays(); // 重新更新所有顯示
  }

  /**
   * 取得閾值配置狀態
   * 用於除錯和驗證
   * @returns {Object} 閾值配置狀態
   */
  getThresholdConfigStatus() {
    return {
      loaded: !!this.thresholdConfig,
      config: this.thresholdConfig,
      source: this.thresholdConfig ? "rules.json" : "default",
    };
  }

  /**
   * 更新DOM元素內容
   * @param {string} id - 元素ID
   * @param {string|number} value - 新數值
   */
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(value);
    }
  }

  /**
   * 綁定事件監聽器
   * @returns {void}
   */
  bindEventListeners() {
    // 標題雙擊啟用除錯面板
    const titleElement = document.getElementById("gameTitle");
    if (titleElement) {
      titleElement.addEventListener("dblclick", () => {
        this.toggleDebugPanel();
      });
    }

    // 遊戲控制按鈕
    this.bindButton("collectRentBtn", () => this.handleCollectRent());
    this.bindButton("showVisitorsBtn", () => this.handleShowVisitors());
    this.bindButton("scavengeBtn", () => this.handleShowScavenge());
    this.bindButton("harvestBtn", () => this.handleHarvestYard());
    this.bindButton("nextDayBtn", () => this.handleNextDay());
    this.bindButton("skillBtn", () => this.showSkillModal());

    // 房間點擊事件 - 修正類型問題
    document.querySelectorAll(".room").forEach((room) => {
      room.addEventListener("click", (/** @type {MouseEvent} */ e) => {
        // 明確類型轉換：EventTarget -> HTMLElement
        const currentTarget = /** @type {HTMLElement} */ (e.currentTarget);
        if (currentTarget && currentTarget.dataset) {
          const roomId = parseInt(currentTarget.dataset.roomId || "0");
          this.handleRoomClick(roomId);
        }
      });
    });

    // 模態框關閉事件
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (/** @type {MouseEvent} */ e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    });

    // 確認對話框
    this.bindButton("confirmYes", () => this.handleConfirmYes());
    this.bindButton("confirmNo", () => this.closeModal());

    console.log("🔗 事件監聽器綁定完成");
  }

  /**
   * 綁定按鈕事件 - 修正函數類型問題
   * @param {string} buttonId - 按鈕ID
   * @param {ClickHandler} handler - 點擊事件處理函數
   * @returns {void}
   */
  bindButton(buttonId, handler) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.addEventListener("click", handler);
    }
  }

  /**
   * 設定遊戲狀態監聽器
   * @returns {void}
   */
  setupGameStateListeners() {
    if (!this._isSystemAvailable()) {
      console.warn("⚠️ 系統不可用，跳過事件監聽設定");
      return;
    }

    const gameState = this.gameApp.gameState;
    const eventBus = this.gameApp.eventBus;

    if (!gameState || !eventBus) {
      console.warn("⚠️ GameState 或 EventBus 不可用");
      return;
    }

    // 監聽狀態變更
    gameState.subscribe("state_changed", () => {
      this.updateAllDisplays();
    });

    // 監聽日誌新增
    gameState.subscribe("log_added", (data) => {
      this.updateGameLog(data.logEntry);
    });

    // 監聽天數推進
    gameState.subscribe("day_advanced", () => {
      this.updateAllDisplays();
      this.updateButtonStates();
    });

    // 監聽業務系統事件
    eventBus.on("tenant_tenantHired", () => {
      this.updateTenantList();
      this.updateRoomDisplays();
    });

    eventBus.on("tenant_tenantEvicted", () => {
      this.updateTenantList();
      this.updateRoomDisplays();
    });

    eventBus.on("resource_threshold_warning", (eventObj) => {
      this.showResourceWarning(eventObj.data);
    });

    console.log("📡 遊戲狀態監聽器設定完成");
  }

  /**
   * 更新所有顯示
   * @returns {void}
   */
  updateAllDisplays() {
    if (!this._isSystemAvailable()) return;

    this.updateGameStatus();
    this.updateResourceDisplay();
    this.updateRoomDisplays();
    this.updateTenantList();
    this.updateButtonStates();
    this.updateDebugInfo();
  }

  /**
   * 更新遊戲狀態顯示
   * @returns {void}
   */
  updateGameStatus() {
    const gameState = this.gameApp.gameState;
    if (!gameState) return;

    // 更新基本狀態
    this.setElementText("gameDay", gameState.getStateValue("day", 1));
    this.setElementText(
      "gameTime",
      gameState.getStateValue("time", "day") === "day" ? "白天" : "夜晚"
    );

    // 更新防禦狀態
    const defense = gameState.getStateValue("buildingDefense", 0);
    this.setElementText("buildingDefense", this.getDefenseStatusText(defense));

    // 更新飢餓狀態
    const hunger = gameState.getStateValue("landlord.hunger", 0);
    this.setElementText("landlordHunger", this.getHungerStatusText(hunger));

    // 更新搜刮計數
    const scavengeUsed = gameState.getStateValue(
      "dailyActions.scavengeUsed",
      0
    );
    this.setElementText("scavengeCount", scavengeUsed);
  }

  /**
   * 更新資源顯示
   * @returns {void}
   */
  updateResourceDisplay() {
    const gameState = this.gameApp.gameState;
    if (!gameState) return;

    const resources = gameState.getStateValue("resources", {});

    this.setElementText("gameCash", `$${resources.cash || 0}`);
    this.setElementText("resourceFood", resources.food || 0);
    this.setElementText("resourceMaterials", resources.materials || 0);
    this.setElementText("resourceMedical", resources.medical || 0);
    this.setElementText("resourceFuel", resources.fuel || 0);

    // 資源狀態顏色
    this.updateResourceColors(resources);
  }

  /**
   * 更新資源顏色狀態
   * @param {Object} resources - 資源物件
   * @returns {void}
   */
  updateResourceColors(resources) {
    const thresholds = {
      food: { warning: 5, critical: 2 },
      materials: { warning: 3, critical: 1 },
      medical: { warning: 2, critical: 1 },
      fuel: { warning: 2, critical: 1 },
      cash: { warning: 15, critical: 5 },
    };

    Object.entries(resources).forEach(([type, amount]) => {
      const elementId =
        type === "cash"
          ? "gameCash"
          : `resource${type.charAt(0).toUpperCase() + type.slice(1)}`;
      const element = document.getElementById(elementId);

      if (element && thresholds[type]) {
        const threshold = thresholds[type];
        element.className = "status-value";

        if (amount <= threshold.critical) {
          element.classList.add("resource-critical");
        } else if (amount <= threshold.warning) {
          element.classList.add("resource-warning");
        } else {
          element.classList.add("resource-good");
        }
      }
    });
  }

  /**
   * 更新房間顯示
   * @returns {void}
   */
  updateRoomDisplays() {
    const gameState = this.gameApp.gameState;
    if (!gameState) return;

    const rooms = gameState.getStateValue("rooms", []);

    rooms.forEach((room) => {
      const roomElement = document.getElementById(`room${room.id}`);
      const infoElement = document.getElementById(`room${room.id}-info`);

      if (!roomElement || !infoElement) return;

      // 重設CSS類
      roomElement.className = "room";

      if (room.tenant) {
        roomElement.classList.add("occupied");

        if (room.tenant.infected) {
          roomElement.classList.add("infected");
        }

        if (room.reinforced) {
          roomElement.classList.add("reinforced");
        }

        // 顯示租客資訊
        const satisfaction = gameState.getStateValue(
          `tenantSatisfaction.${room.tenant.name}`,
          50
        );
        // 表情符號表示滿意度等級
        const satisfactionEmoji =
          satisfaction >= 80
            ? "😁"
            : satisfaction >= 60
            ? "😊"
            : satisfaction >= 40
            ? "😐"
            : satisfaction >= 20
            ? "😞"
            : "😡";

        infoElement.innerHTML = `
                  ${room.tenant.name}<br>
                  <small>${room.tenant.skill}</small><br>
                  <small>滿意度: ${satisfaction} ${satisfactionEmoji}</small>
              `;
      } else {
        infoElement.textContent = "空房";
      }

      if (room.needsRepair) {
        roomElement.classList.add("needs-repair");
        infoElement.innerHTML +=
          '<br><small style="color:#ff6666">需要維修</small>';
      }

      if (room.reinforced) {
        infoElement.innerHTML +=
          '<br><small style="color:#66ccff">已加固</small>';
      }
    });
  }

  /**
   * 更新租客列表
   * @returns {void}
   */
  updateTenantList() {
    const gameState = this.gameApp.gameState;
    if (!gameState) return;

    // 使用 GameState 提供的方法獲取租客
    const tenants = gameState.getAllTenants
      ? gameState.getAllTenants()
      : this._getTenantsFromRooms();
    const listElement = document.getElementById("tenantList");

    if (!listElement) return;

    if (tenants.length === 0) {
      listElement.innerHTML = '<div class="tenant-item">暫無租客</div>';
      return;
    }

    listElement.innerHTML = tenants
      .map((tenant) => {
        let statusText = "";
        if (tenant.infected) {
          statusText = '<br><small style="color:#ff6666">已感染！</small>';
        } else if (tenant.onMission) {
          statusText = '<br><small style="color:#ffaa66">執行任務中</small>';
        }

        const resourceStatus = tenant.personalResources
          ? `<br><small style="color:#cccccc">個人: ${
              tenant.personalResources.cash || 0
            } 食物${tenant.personalResources.food || 0}</small>`
          : "";

        const satisfaction = gameState.getStateValue(
          `tenantSatisfaction.${tenant.name}`,
          50
        );
        // 表情符號表示滿意度等級
        const satisfactionEmoji =
          satisfaction >= 80
            ? "😁"
            : satisfaction >= 60
            ? "😊"
            : satisfaction >= 40
            ? "😐"
            : satisfaction >= 20
            ? "😞"
            : "😡";

        return `
              <div class="tenant-item ${tenant.infected ? "infected" : ""} ${
          tenant.typeName
        }">
                  ${tenant.name} (${tenant.typeName})<br>
                  <small>房租: ${tenant.rent} | ${tenant.skill}</small>
                  ${resourceStatus}
                  <small>滿意度: ${satisfaction}% ${satisfactionEmoji}</small>
                  ${statusText}
              </div>
          `;
      })
      .join("");
  }

  /**
   * 從房間獲取租客列表（後備方法）
   * @private
   * @returns {Array} 租客陣列
   */
  _getTenantsFromRooms() {
    const gameState = this.gameApp.gameState;
    if (!gameState) return [];

    const rooms = gameState.getStateValue("rooms", []);
    return rooms.filter((room) => room.tenant).map((room) => room.tenant);
  }

  /**
   * 更新按鈕狀態
   * @returns {void}
   */
  updateButtonStates() {
    const gameState = this.gameApp.gameState;
    if (!gameState) return;

    const dailyActions = gameState.getStateValue("dailyActions", {
      rentCollected: false,
      harvestUsed: false,
      harvestCooldown: 0,
      scavengeUsed: 0,
      maxScavengePerDay: 2,
    });

    // 收租按鈕
    this.updateButtonState(
      "collectRentBtn",
      !dailyActions.rentCollected,
      dailyActions.rentCollected ? "💰 收租 (已收取)" : "💰 收租"
    );

    // 採集按鈕
    const harvestDisabled =
      dailyActions.harvestUsed || (dailyActions.harvestCooldown || 0) > 0;
    let harvestText = "🌱 院子採集";
    if (dailyActions.harvestUsed) {
      harvestText += " (已使用)";
    } else if ((dailyActions.harvestCooldown || 0) > 0) {
      harvestText += ` (冷卻${dailyActions.harvestCooldown}天)`;
    }
    this.updateButtonState("harvestBtn", !harvestDisabled, harvestText);

    // 搜刮按鈕
    const scavengeUsed = dailyActions.scavengeUsed || 0;
    const maxScavenge = dailyActions.maxScavengePerDay || 2;
    const scavengeDisabled = scavengeUsed >= maxScavenge;
    this.updateButtonState("scavengeBtn", !scavengeDisabled);

    // 更新搜刮計數顯示
    this.setElementText("scavengeCount", scavengeUsed);
  }

  /**
   * 更新按鈕狀態 - 修正disabled屬性類型問題
   * @param {string} buttonId - 按鈕ID
   * @param {boolean} enabled - 是否啟用
   * @param {string} [text] - 按鈕文字
   * @returns {void}
   */
  updateButtonState(buttonId, enabled, text = null) {
    const button = /** @type {HTMLButtonElement|null} */ (
      document.getElementById(buttonId)
    );
    if (button) {
      button.disabled = !enabled;
      if (text) {
        button.innerHTML = text;
      }
    }
  }

  /**
   * 更新遊戲日誌
   * @param {Object} logEntry - 日誌條目
   * @returns {void}
   */
  updateGameLog(logEntry) {
    const logElement = document.getElementById("gameLog");
    if (!logElement) return;

    const entryElement = document.createElement("div");
    entryElement.className = `log-entry ${logEntry.type}`;
    entryElement.textContent = `第${logEntry.day}天: ${logEntry.message}`;

    logElement.appendChild(entryElement);
    logElement.scrollTop = logElement.scrollHeight;

    // 限制日誌數量
    while (logElement.children.length > 50) {
      logElement.removeChild(logElement.firstChild);
    }
  }

  // ===========================================
  // 遊戲操作處理函數（純委託）
  // ===========================================

  /**
   * 處理收租操作
   * @returns {Promise<void>}
   */
  async handleCollectRent() {
    if (!this._isSystemAvailable() || !this.gameApp.tradeManager) {
      console.warn("⚠️ TradeManager 不可用");
      return;
    }

    try {
      const result = await this.gameApp.tradeManager.processRentCollection();
      if (result.success) {
        this.gameApp.gameState.setStateValue(
          "dailyActions.rentCollected",
          true,
          "今日已收租"
        );
      }
    } catch (error) {
      console.error("收租失敗:", error);
    } finally {
      this.updateAllDisplays();
    }
  }

  /**
   * 處理顯示訪客
   * @returns {void}
   */
  handleShowVisitors() {
    if (!this._isSystemAvailable() || !this.gameApp.tenantManager) {
      console.warn("⚠️ TenantManager 不可用");
      return;
    }

    let visitors = this.gameApp.tenantManager.currentApplicants;

    // 委託給 TenantManager 處理
    if (!visitors || visitors.length <= 0) {
      const quantity = Math.ceil(Math.random() * 5);
      visitors = this.gameApp.tenantManager.generateApplicants(quantity);
      this.gameApp.gameState.setStateValue("visitors", visitors, "生成訪客");
    }

    this.showVisitorModal(visitors);
  }

  /**
   * 處理院子採集
   * @returns {Promise<void>}
   */
  async handleHarvestYard() {
    if (!this._isSystemAvailable()) {
      console.warn("⚠️ 系統不可用");
      return;
    }

    // 委託給系統處理採集邏輯
    try {
      // 這裡應該調用專門的採集方法
      if (
        this.gameApp.resourceManager &&
        typeof this.gameApp.resourceManager.harvestYard === "function"
      ) {
        this.gameApp.resourceManager.harvestYard();
      }
    } catch (error) {
      console.error("院子採集失敗:", error);
    } finally {
      this.updateAllDisplays();
    }
  }

  /**
   * 處理顯示搜刮選單（已調整為開發中狀態）
   * @returns {void}
   */
  handleShowScavenge() {
    // 顯示開發中訊息，而非執行實際功能
    if (this._isSystemAvailable() && this.gameApp.gameState) {
      this.gameApp.gameState.addLog(
        "🔧 搜刮系統正在重構中，敬請期待！",
        "event"
      );
    }

    // 可選：顯示確認對話框提示使用者
    this.showConfirmModal(
      "功能重構中",
      "搜刮派遣系統正在進行重構，目前暫時不可使用。\n\n預計完成時間：下一個版本更新",
      () => {
        // 確認後不執行任何操作，僅關閉對話框
        this.closeModal();
      }
    );
  }

  /**
   * 處理下一天
   * @returns {void}
   */
  handleNextDay() {
    this.showConfirmModal(
      "確認推進",
      "確定要推進到下一天嗎？",
      this.executeNextDay.bind(this)
    );
  }

  /**
   * 執行下一天
   * @returns {Promise<void>}
   */
  async executeNextDay() {
    if (!this._isSystemAvailable()) return;

    try {
      // 委託給 GameState 處理天數推進邏輯
      if (
        this.gameApp.gameState &&
        typeof this.gameApp.gameState.advanceDay === "function"
      ) {
        await this.gameApp.gameState.advanceDay();
      }
    } catch (error) {
      console.error("推進天數失敗:", error);
      if (
        this.gameApp.gameState &&
        typeof this.gameApp.gameState.addLog === "function"
      ) {
        this.gameApp.gameState.addLog("推進天數時發生錯誤", "danger");
      }
    }
  }

  /**
   * 處理房間點擊
   * @param {number} roomId - 房間ID
   * @returns {void}
   */
  handleRoomClick(roomId) {
    const gameState = this.gameApp.gameState;
    if (!gameState) return;

    // 委託給 GameState 獲取房間資訊
    const room = gameState.getRoom
      ? gameState.getRoom(roomId)
      : this._getRoomById(roomId);
    if (!room) return;

    if (room.needsRepair) {
      this.showRepairModal(room);
    } else if (room.tenant) {
      this.showTenantModal(room);
    } else {
      this.showEmptyRoomModal(room);
    }
  }

  /**
   * 根據ID獲取房間（後備方法）
   * @private
   * @param {number} roomId - 房間ID
   * @returns {Object|null} 房間物件
   */
  _getRoomById(roomId) {
    const gameState = this.gameApp.gameState;
    if (!gameState) return null;

    const rooms = gameState.getStateValue("rooms", []);
    return rooms.find((r) => r.id === roomId) || null;
  }

  // ===========================================
  // 模態框處理函數
  // ===========================================

  /**
   * 顯示訪客模態框
   * @param {Array} visitors - 訪客陣列
   * @returns {void}
   */
  showVisitorModal(visitors) {
    const modal = document.getElementById("visitorModal");
    const list = document.getElementById("visitorList");

    if (!modal || !list) return;

    list.innerHTML = visitors
      .map((visitor) => {
        const infectionStatus = visitor.revealedInfection
          ? '<br><span style="color:#ff6666; font-weight:bold;">⚠ 已檢測出感染！</span>'
          : "";

        return `
              <div class="applicant ${
                visitor.revealedInfection ? "infected" : ""
              }">
                  <strong>${visitor.name}</strong> - ${visitor.type}<br>
                  <small>${visitor.description}</small><br>
                  <small style="color: #aaa;">外觀: ${
                    visitor.appearance
                  }</small><br>
                  房租: ${visitor.rent}/天${infectionStatus}<br>
                  <button class="btn ${
                    visitor.revealedInfection ? "btn-danger" : "btn-primary"
                  }"
                          onclick="uiController.hireTenant(${visitor.id})"
                          ${
                            visitor.revealedInfection
                              ? 'title="雇用感染者風險很高！"'
                              : ""
                          }>
                      雇用${visitor.revealedInfection ? " (危險)" : ""}
                  </button>
              </div>
          `;
      })
      .join("");

    this.showModal("visitorModal");
  }

  /**
   * 顯示搜刮模態框
   * @param {Array} tenants - 可用租客陣列
   * @returns {void}
   */
  showScavengeModal(tenants) {
    const modal = document.getElementById("scavengeModal");
    const list = document.getElementById("availableTenants");
    const remaining = document.getElementById("remainingScavenges");

    if (!modal || !list || !remaining) return;

    const gameState = this.gameApp.gameState;
    if (!gameState) return;

    const scavengeUsed = gameState.getStateValue(
      "dailyActions.scavengeUsed",
      0
    );
    const maxScavenge = gameState.getStateValue(
      "dailyActions.maxScavengePerDay",
      2
    );

    // 修正textContent類型問題
    remaining.textContent = String(maxScavenge - scavengeUsed);

    list.innerHTML = tenants
      .map((tenant) => {
        // 委託給系統獲取成功率
        const successRate = this._getTenantScavengeRate(tenant);
        return `
              <div class="applicant">
                  <strong>${tenant.name}</strong> - ${tenant.typeName}<br>
                  <small>技能: ${tenant.skill}</small><br>
                  <small>成功率: ${successRate}%</small><br>
                  <button class="btn btn-primary" onclick="uiController.sendTenantScavenge('${tenant.name}')">
                      派遣
                  </button>
              </div>
          `;
      })
      .join("");

    this.showModal("scavengeModal");
  }

  /**
   * 顯示租客詳情模態框
   * @param {Object} room - 房間物件
   * @returns {void}
   */
  showTenantModal(room) {
    const modal = document.getElementById("tenantModal");
    const title = document.getElementById("tenantModalTitle");
    const content = document.getElementById("tenantModalContent");
    const actions = document.getElementById("tenantModalActions");

    if (!modal || !title || !content || !actions) return;

    const tenant = room.tenant;
    const gameState = this.gameApp.gameState;
    const satisfaction = gameState
      ? gameState.getStateValue(`tenantSatisfaction.${tenant.name}`, 50)
      : 50;

    title.textContent = `房間 ${room.id} - ${tenant.name}`;

    content.innerHTML = `
          <p><strong>姓名：</strong>${tenant.name}</p>
          <p><strong>類型：</strong>${tenant.typeName}</p>
          <p><strong>技能：</strong>${tenant.skill}</p>
          <p><strong>房租：</strong>${tenant.rent} / 天</p>
          <p><strong>滿意度：</strong>${satisfaction}% ${
      satisfaction >= 70 ? "😊" : satisfaction >= 40 ? "😐" : "😞"
    }</p>
          <p><strong>狀態：</strong>${
            tenant.onMission
              ? "執行任務中"
              : tenant.infected
              ? "已感染"
              : "健康"
          }</p>
          ${
            tenant.personalResources
              ? `
              <p><strong>個人資源：</strong></p>
              <small>💰 現金: ${tenant.personalResources.cash || 0}</small><br>
              <small>🍖 食物: ${tenant.personalResources.food || 0}</small><br>
              <small>🔧 建材: ${
                tenant.personalResources.materials || 0
              }</small><br>
              <small>💊 醫療: ${
                tenant.personalResources.medical || 0
              }</small><br>
              <small>⛽ 燃料: ${tenant.personalResources.fuel || 0}</small>
          `
              : ""
          }
          ${
            room.reinforced
              ? '<p style="color:#66ccff;"><strong>房間已加固 (+20%房租)</strong></p>'
              : ""
          }
          ${
            tenant.infected
              ? '<p style="color:#ff6666;"><strong>⚠ 已感染</strong></p>'
              : ""
          }
      `;

    actions.innerHTML = `
          <button class="btn" onclick="uiController.closeModal()">關閉</button>
          <button class="btn btn-danger" onclick="uiController.evictTenant(${
            tenant.id
          }, ${tenant.infected})">
              ${tenant.infected ? "驅逐（感染）" : "要求退租"}
          </button>
      `;

    this.showModal("tenantModal");
  }

  /**
   * 顯示確認對話框
   * @param {string} title - 標題
   * @param {string} message - 訊息
   * @param {Function} callback - 確認回調
   * @returns {void}
   */
  showConfirmModal(title, message, callback) {
    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const messageEl = document.getElementById("confirmMessage");

    if (!modal || !titleEl || !messageEl) return;

    titleEl.textContent = title;
    messageEl.textContent = message;

    this.confirmCallback = callback;
    this.showModal("confirmModal");
  }

  /**
   * 顯示空房間模態框
   * @param {Object} room - 房間物件
   * @returns {void}
   */
  showEmptyRoomModal(room) {
    const modal = document.getElementById("tenantModal");
    const title = document.getElementById("tenantModalTitle");
    const content = document.getElementById("tenantModalContent");
    const actions = document.getElementById("tenantModalActions");

    if (!modal || !title || !content || !actions) return;

    title.textContent = `房間 ${room.id} - 空置中`;

    content.innerHTML = `
          <p>此房間目前沒有租客。</p>
          <p>你可以前往查看申請者，選擇合適的租客入住。</p>
          ${
            room.reinforced
              ? '<p style="color:#66ccff;">此房間已加固，防禦力較高</p>'
              : ""
          }
      `;

    actions.innerHTML = `
          <button class="btn" onclick="uiController.closeModal()">關閉</button>
          <button class="btn btn-primary" onclick="uiController.closeModal(); uiController.handleShowVisitors()">查看訪客</button>
      `;

    this.showModal("tenantModal");
  }

  /**
   * 顯示維修模態框
   * @param {Object} room - 房間物件
   * @returns {void}
   */
  showRepairModal(room) {
    const tenants = this._getTenantsFromRooms();
    const workers = tenants.filter((t) => t.type === "worker");
    const repairCost = workers.length > 0 ? 2 : 3;
    const gameState = this.gameApp.gameState;

    if (
      !gameState ||
      gameState.getStateValue("resources.materials", 0) < repairCost
    ) {
      if (gameState && typeof gameState.addLog === "function") {
        gameState.addLog("建材不足，無法維修！", "danger");
      }
      return;
    }

    this.showConfirmModal(
      `房間 ${room.id} - 需要維修`,
      `此房間需要維修，花費 ${repairCost} 單位建材。${
        workers.length > 0 ? " 有工人租客可以降低維修成本！" : ""
      }`,
      () => this.repairRoom(room.id, repairCost)
    );
  }

  /**
   * 顯示模態框
   * @param {string} modalId - 模態框ID
   * @returns {void}
   */
  showModal(modalId) {
    this.closeModal(); // 先關閉其他模態框

    const modal = /** @type {HTMLElement|null} */ (
      document.getElementById(modalId)
    );
    if (modal) {
      modal.style.display = "block";
      this.uiState.activeModal = modalId;
    }
  }

  /**
   * 關閉模態框 - 修正style屬性類型問題
   * @returns {void}
   */
  closeModal() {
    document.querySelectorAll(".modal").forEach((modal) => {
      const htmlModal = /** @type {HTMLElement} */ (modal);
      htmlModal.style.display = "none";
    });
    this.uiState.activeModal = null;
  }

  /**
   * 處理確認對話框的確認
   * @returns {void}
   */
  handleConfirmYes() {
    if (this.confirmCallback) {
      this.confirmCallback();
      this.confirmCallback = null;
    }
    this.closeModal();
  }

  // ===========================================
  // 業務操作委託函數
  // ===========================================

  /**
   * 雇用租客（委託給 TenantManager）
   * @param {number} applicantId - 申請者ID
   * @returns {Promise<void>}
   */
  async hireTenant(applicantId) {
    if (!this._isSystemAvailable() || !this.gameApp.tenantManager) {
      console.warn("⚠️ TenantManager 不可用");
      return;
    }

    try {
      const visitors = this.gameApp.gameState.getStateValue("visitors", []);
      const applicant = visitors.find((v) => v.id === applicantId);

      if (!applicant) {
        if (
          this.gameApp.gameState &&
          typeof this.gameApp.gameState.addLog === "function"
        ) {
          this.gameApp.gameState.addLog("找不到指定的申請者", "danger");
        }
        return;
      }

      const result = await this.gameApp.tenantManager.hireTenant(applicant);

      if (result.success) {
        this.closeModal();
      } else if (!result.success) {
      }
    } catch (error) {
      console.error("雇用租客失敗:", error);
    }
  }

  /**
   * 派遣租客搜刮（暫時禁用，保留原有程式碼結構）
   * @param {number} tenantId - 租客ID
   * @returns {Promise<void>}
   */
  async sendTenantScavenge(tenantId) {
    // 暫時禁用功能，顯示開發中訊息
    if (this._isSystemAvailable() && this.gameApp.gameState) {
      this.gameApp.gameState.addLog("🚧 搜刮功能暫時禁用中", "danger");
    }

    console.warn("⚠️ 搜刮功能已禁用 - 系統重構中");

    // 關閉可能開啟的搜刮模態框
    this.closeModal();

    /*
     * 原有搜刮邏輯已註解，保留結構以便後續重構：
     *
     * if (!this._isSystemAvailable()) return;
     *
     * try {
     *   if (this.gameApp.gameState && typeof this.gameApp.gameState.processScavenge === "function") {
     *     await this.gameApp.gameState.processScavenge(tenantId);
     *   } else {
     *     // 暫時的簡化處理...
     *   }
     *   this.closeModal();
     * } catch (error) {
     *   console.error("派遣搜刮失敗:", error);
     * }
     */
  }

  /**
   * 驅逐租客（委託給 TenantManager）
   * @param {number} tenantId - 租客ID
   * @param {boolean} isInfected - 是否因感染驅逐
   * @returns {Promise<void>}
   */
  async evictTenant(tenantId, isInfected) {
    if (!this._isSystemAvailable() || !this.gameApp.tenantManager) {
      console.warn("⚠️ TenantManager 不可用");
      return;
    }
    const tenant = this.gameApp.tenantManager.findTenantAndRoom(tenantId).tenant

    this.showConfirmModal(
      isInfected ? "驅逐感染租客" : "租客退租確認",
      `確定要${isInfected ? "驅逐感染的" : "讓"}租客 ${tenant.name} ${
        isInfected ? "" : "退租"
      }嗎？`,
      async () => {
        try {
          await this.gameApp.tenantManager.evictTenant(
            tenantId,
            isInfected,
            "房東決定"
          );
        } catch (error) {
          console.error("驅逐租客失敗:", error);
        }
      }
    );
  }

  /**
   * 維修房間（委託給對應系統）
   * @param {number} roomId - 房間ID
   * @param {number} cost - 維修成本
   * @returns {Promise<void>}
   */
  async repairRoom(roomId, cost) {
    if (!this._isSystemAvailable() || !this.gameApp.resourceManager) {
      return;
    }

    const success = this.gameApp.resourceManager.modifyResource(
      "materials",
      -cost,
      "房間維修"
    );

    if (success) {
      const rooms = this.gameApp.gameState.getStateValue("rooms", []);
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
        room.needsRepair = false;
        this.gameApp.gameState.setState({ rooms }, "房間維修完成");
      }
    }
  }

  // ===========================================
  // 工具函數（僅限顯示邏輯）
  // ===========================================

  /**
   * 取得租客搜刮成功率（委託給系統）
   * @private
   * @param {Object} tenant - 租客物件
   * @returns {number} 成功率百分比
   */
  _getTenantScavengeRate(tenant) {
    // 委託給 TenantManager 或使用簡化邏輯
    if (
      this.gameApp.tenantManager &&
      typeof this.gameApp.tenantManager.getScavengeRate === "function"
    ) {
      return this.gameApp.tenantManager.getScavengeRate(tenant);
    }

    // 後備：簡化的成功率計算
    const baseRates = {
      soldier: 85,
      worker: 75,
      farmer: 65,
      doctor: 50,
      elder: 40,
    };
    return Math.min(95, baseRates[tenant.type] || 60);
  }

  /**
   * 取得防禦狀態文字
   * @param {number} defense - 防禦值
   * @returns {string} 防禦狀態
   */
  getDefenseStatusText(defense) {
    if (defense <= 0) return `脆弱(${defense})`;
    if (defense <= 2) return `基本(${defense})`;
    if (defense <= 5) return `穩固(${defense})`;
    if (defense <= 8) return `堅固(${defense})`;
    if (defense <= 12) return `要塞(${defense})`;
    return `銅牆鐵壁(${defense})`;
  }

  /**
   * 取得飢餓狀態文字
   * @param {number} hunger - 飢餓值
   * @returns {string} 飢餓狀態
   */
  getHungerStatusText(hunger) {
    if (hunger <= 0) return `飽足(${hunger})`;
    if (hunger <= 1) return `微餓(${hunger})`;
    if (hunger <= 2) return `有點餓(${hunger})`;
    if (hunger <= 3) return `飢餓(${hunger})`;
    if (hunger <= 4) return `很餓(${hunger})`;
    if (hunger <= 6) return `極度飢餓(${hunger})`;
    return `瀕臨餓死(${hunger})`;
  }

  /**
   * 設定元素文字內容 - 修正textContent類型問題
   * @param {string} elementId - 元素ID
   * @param {string|number} text - 文字內容
   * @returns {void}
   */
  setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = String(text);
    }
  }

  /**
   * 顯示資源警告
   * @param {Object} data - 警告資料
   * @returns {void}
   */
  showResourceWarning(data) {
    if (
      this.gameApp.gameState &&
      typeof this.gameApp.gameState.addLog === "function"
    ) {
      this.gameApp.gameState.addLog(
        `⚠️ 資源警告: ${data.resourceType} 剩餘 ${data.currentValue}`,
        "danger"
      );
    }
  }

  // ===========================================
  // 除錯功能
  // ===========================================

  /**
   * 切換除錯面板
   * @returns {void}
   */
  toggleDebugPanel() {
    const panel = /** @type {HTMLElement|null} */ (
      document.getElementById("debugPanel")
    );
    if (!panel) return;

    this.uiState.debugMode = !this.uiState.debugMode;
    panel.style.display = this.uiState.debugMode ? "block" : "none";

    if (this.uiState.debugMode) {
      this.updateDebugInfo();
      console.log("🔧 除錯面板已啟用");
    }
  }

  /**
   * 更新除錯資訊
   * @returns {void}
   */
  updateDebugInfo() {
    if (!this.uiState.debugMode || !this._isSystemAvailable()) return;

    const systemInfo = document.getElementById("debugSystemInfo");
    const moduleInfo = document.getElementById("debugModuleInfo");

    if (systemInfo) {
      const gameState = this.gameApp.gameState;
      systemInfo.innerHTML = `
              模式: ${this.gameApp.systemMode}<br>
              天數: ${gameState ? gameState.getStateValue("day", 0) : 0}<br>
              系統就緒: ${this.uiState.systemReady ? "✅" : "❌"}
          `;
    }

    if (moduleInfo) {
      moduleInfo.innerHTML = `
              DataManager: ${this.gameApp.dataManager ? "✅" : "❌"}<br>
              GameState: ${this.gameApp.gameState ? "✅" : "❌"}<br>
              EventBus: ${this.gameApp.eventBus ? "✅" : "❌"}<br>
              ResourceManager: ${this.gameApp.resourceManager ? "✅" : "❌"}<br>
              TradeManager: ${this.gameApp.tradeManager ? "✅" : "❌"}<br>
              TenantManager: ${this.gameApp.tenantManager ? "✅" : "❌"}
          `;
    }
  }

  /**
   * 增加測試資源（委託給 ResourceManager）
   * @returns {void}
   */
  addTestResources() {
    if (!this._isSystemAvailable() || !this.gameApp.resourceManager) return;

    this.gameApp.resourceManager.modifyResource("food", 10, "除錯增加");
    this.gameApp.resourceManager.modifyResource("materials", 5, "除錯增加");
    this.gameApp.resourceManager.modifyResource("medical", 3, "除錯增加");
    this.gameApp.resourceManager.modifyResource("cash", 50, "除錯增加");
  }

  /**
   * 更新系統狀態顯示
   * @param {string} status - 狀態類型
   * @param {string} message - 狀態訊息
   * @returns {void}
   */
  updateSystemStatus(status, message) {
    const statusElement = document.getElementById("systemStatus");
    if (!statusElement) return;

    statusElement.className = `system-status status-${status}`;
    statusElement.textContent = message;
  }

  /**
   * 開始定期更新
   * @returns {void}
   */
  startPeriodicUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(() => {
      if (this.uiState.systemReady) {
        this.updateDebugInfo();
      }
    }, this.updateInterval);
  }

  /**
   * 停止定期更新
   * @returns {void}
   */
  stopPeriodicUpdates() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * 銷毀控制器
   * @returns {void}
   */
  destroy() {
    this.stopPeriodicUpdates();
    this.uiState.systemReady = false;
    console.log("🎨 UIController 已銷毀");
  }




  // ...

  /**
   * 顯示技能模態框
   * @returns {void}
   */
  showSkillModal() {
    if (!this._isSystemAvailable()) {
      console.warn("⚠️ 系統不可用");
      return;
    }

    const modal = document.getElementById("skillModal");
    const list = document.getElementById("skillListContainer");

    if (!modal || !list) {
      console.error("找不到技能模態框或技能列表元素");
      return;
    }

    // 從 skillManager 獲取可用技能
    const skillManager = this.gameApp.skillManager;
    if (!skillManager) {
      list.innerHTML = '<div class="skill-item">技能系統未載入</div>';
      this.showModal("skillModal");
      return;
    }

    // 獲取可用技能列表
    const skills = skillManager.getAvailableSkills ? skillManager.getAvailableSkills() : [];
    if (skills.length === 0) {
      list.innerHTML = '<div class="skill-item">暫無可用技能</div>';
      this.showModal("skillModal");
      return;
    }

    // 按租客分組技能
    const skillsByTenant = {};
    skills.forEach(skill => {
      if (!skill.tenantId || !skill.tenantName) return;

      if (!skillsByTenant[skill.tenantId]) {
        skillsByTenant[skill.tenantId] = {
          id: skill.tenantId,
          name: skill.tenantName,
          skills: []
        };
      }

      skillsByTenant[skill.tenantId].skills.push(skill);
    });

    // 生成技能列表，按租客分組
    let htmlContent = '';

    Object.values(skillsByTenant).forEach(tenantGroup => {
      const {tenant, room} = this.gameApp.tenantManager.findTenantAndRoom(tenantGroup.id)
      htmlContent += `
        <div class="tenant-skill-group">
          <h4 class="tenant-name">${tenant.name} (${tenant.typeName}) - 房間${room.id}</h4>
          <div class="tenant-skills">
      `;

      tenantGroup.skills.forEach(skill => {
        const costText = Object.entries(skill.cost || {})
          .map(([resource, amount]) => `${resource}: ${amount}`)
          .join(', ');

        htmlContent += `
          <div class="skill-item">
            <div>
              <strong>${skill.name}</strong>
              <small>${skill.description}</small>
              <small>消耗: ${costText || '無'}</small>
            </div>
            <button class="btn btn-primary"
                    onclick="uiController.useSkill('${skill.id}')"
                    ${skill.canUse === false ? 'disabled' : ''}>
              使用${skill.cooldownRemaining > 0 ? ` (冷卻中: ${skill.cooldownRemaining})` : ''}
            </button>
          </div>
        `;
      });

      htmlContent += `
          </div>
        </div>
      `;
    });

    // 如果沒有按租客分組的技能（舊版本兼容），則使用原來的方式顯示
    if (htmlContent === '') {
      htmlContent = skills.map(skill => {
        const costText = Object.entries(skill.cost || {})
          .map(([resource, amount]) => `${resource}: ${amount}`)
          .join(', ');

        return `
          <div class="skill-item">
            <div>
              <strong>${skill.name}</strong>
              <small>${skill.description}</small>
              <small>消耗: ${costText || '無'}</small>
            </div>
            <button class="btn btn-primary"
                    onclick="uiController.useSkill('${skill.id}')"
                    ${skill.canUse === false ? 'disabled' : ''}>
              使用${skill.cooldown > 0 ? ` (冷卻中: ${skill.cooldown})` : ''}
            </button>
          </div>
        `;
      }).join('');
    }

    list.innerHTML = htmlContent;
    this.showModal("skillModal");
  }

  /**
   * 使用技能
   * @param {string} skillId - 技能ID
   * @returns {void}
   */
  useSkill(skillId) {
    if (!this._isSystemAvailable()) {
      console.warn("⚠️ 系統不可用");
      return;
    }

    const skillManager = this.gameApp.skillManager;
    if (!skillManager || typeof skillManager.executeSkill !== 'function') {
      console.error("技能系統未載入或無法執行技能");
      if (this.gameApp.gameState) {
        this.gameApp.gameState.addLog("技能系統未載入", "danger");
      }
      return;
    }

    try {
      // 從 skillManager 獲取技能和租客ID
      const allSkills = skillManager.getAvailableSkills();
      const skillWithTenant = allSkills.find(s => s.id === skillId);

      if (!skillWithTenant || !skillWithTenant.tenantId) {
        console.error(`無法確定技能的租客: ${skillId}`);
        if (this.gameApp.gameState) {
          this.gameApp.gameState.addLog(`無法確定技能的租客`, "danger");
        }
        return;
      }

      // 執行技能
      const result = skillManager.executeSkill(skillWithTenant.tenantId, skillId);

      // 關閉模態框
      this.closeModal();

      // 更新顯示
      this.updateAllDisplays();

      // 添加日誌
      if (this.gameApp.gameState) {
        if (result.success) {
          this.gameApp.gameState.addLog(`成功使用技能: ${result.skillName || skillId}`, "skill");
        } else {
          this.gameApp.gameState.addLog(`無法使用技能: ${result.message || '未知錯誤'}`, "danger");
        }
      }
    } catch (error) {
      console.error("執行技能失敗:", error);
      if (this.gameApp.gameState) {
        this.gameApp.gameState.addLog("執行技能失敗", "danger");
      }
    }
  }
}
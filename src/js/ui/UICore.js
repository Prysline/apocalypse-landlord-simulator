/**
 * UICore.js - UI系統核心協調器
 * 職責：統一對外介面、業務邏輯協調、委託子模組
 * 所有 HTML onclick 都調用 UICore 的方法
 */

import UIDisplay from './UIDisplay.js';
import UIModal from './UIModal.js';

export default class UICore {
  constructor(gameApp) {
    this.gameApp = gameApp;
    this.display = null;
    this.modal = null;
    this.isReady = false;
    this.confirmCallback = null;

    this.uiState = {
      debugMode: false,
      systemReady: false
    };

    this.thresholds = {
      resources: {
        critical: { food: 2, materials: 1, medical: 1, fuel: 1, cash: 5 },
        warning: { food: 5, materials: 3, medical: 2, fuel: 2, cash: 15 }
      }
    };

    this.updateTimer = null;
    console.log("🎨 UICore 已初始化");
  }

  // =================== 核心初始化 ===================

  async initialize() {
    console.log('🎨 UICore 初始化開始');

    try {
      await this._waitForGameApp();
      this._loadThresholds();

      this.display = new UIDisplay(this.gameApp, this);
      this.modal = new UIModal(this.gameApp, this);

      await this.display.initialize();
      await this.modal.initialize();

      this.bindEvents();
      this.bindDebugEvents();
      this._setupGameStateListeners();
      this.startUpdateLoop();

      const applicants = this.gameApp.tenantManager?.generateApplicants();
      this.gameApp.gameState.setStateValue('applicants', applicants);

      this.isReady = true;
      this.uiState.systemReady = true;

      console.log('✅ UICore 初始化完成');
    } catch (error) {
      console.error("❌ UICore 初始化失敗:", error);
      throw error;
    }
  }

  // =================== 統一對外介面 - 模態框控制 ===================

  /**
   * 顯示訪客模態框 (對外介面)
   */
  showVisitors() {
    this.closeModal()
    const visitors = this.gameApp.gameState?.getStateValue('applicants', []) || [];
    this.modal.setVisitorContent(visitors);
    this.modal.show('visitorModal');
  }

  /**
   * 顯示搜刮模態框 (對外介面)
   */
  showScavenge() {
    const scavengeUsed = this.gameApp.gameState?.getStateValue('scavengeUsed', 0) || 0;
    const remaining = 2 - scavengeUsed;

    const rooms = this.gameApp.gameState?.getStateValue('rooms', []) || [];
    const availableTenants = rooms
      .filter(room => room.tenant && !room.tenant.onMission && !room.tenant.infected)
      .map(room => room.tenant);

    this.modal.setScavengeContent(availableTenants, remaining);
    this.modal.show('scavengeModal');
  }

  /**
   * 顯示技能模態框 (對外介面)
   */
  showSkills() {
    const skillManager = this.gameApp.skillManager;
    const skills = skillManager?.getAvailableSkills ? skillManager.getAvailableSkills() : [];

    this.modal.setSkillContent(skills);
    this.modal.show('skillModal');
  }

  /**
   * 顯示房間模態框 (對外介面)
   */
  showRoomModal(room) {
    if (room.tenant) {
      const satisfaction = this.gameApp.gameState?.getStateValue(`tenantSatisfaction.${room.tenant.name}`, 50) || 50;
      this.modal.setTenantContent(room, satisfaction);
    } else {
      this.modal.setEmptyRoomContent(room);
    }
    this.modal.show('tenantModal');
  }

  /**
   * 關閉模態框 (對外介面)
   */
  closeModal(modalId = null) {
    if (modalId) {
      this.modal.close(modalId);
    } else {
      this.modal.close();
    }
  }

  /**
   * 關閉所有模態框 (對外介面)
   */
  closeAllModals() {
    this.modal.closeAll();
  }

  // =================== 統一對外介面 - 業務操作 ===================

  /**
   * 雇用租客 (對外介面)
   */
  async hireTenant(applicantId) {
    if (this.gameApp.tenantManager?.hireTenant) {
      const result = await this.gameApp.tenantManager.hireTenant(applicantId);
      if (result.success) {
        this.closeAllModals();
        this.updateAll();
      }
    }
  }

  /**
   * 驅逐租客 (對外介面)
   */
  evictTenant(tenantId, isInfected = false) {
    const tenantInfo = this.gameApp.tenantManager.findTenantAndRoom(tenantId);
    if (!tenantInfo) {
      console.error('找不到租客');
      return;
    }

    const { tenant } = tenantInfo;

    // UICore 處理確認邏輯
    this.showConfirmModal(
      isInfected ? "驅逐感染租客" : "租客退租確認",
      `確定要${isInfected ? "驅逐感染的" : "讓"}租客 ${tenant.name} ${isInfected ? "" : "退租"}嗎？`,
      async () => {
        try {
          await this.gameApp.tenantManager.evictTenant(tenantId, isInfected, "房東決定");
          this.closeAllModals();
          this.updateAll();
        } catch (error) {
          console.error("驅逐租客失敗:", error);
          this.gameApp.gameState?.addLog("驅逐租客失敗", "danger");
        }
      }
    );
  }

  /**
   * 派遣租客搜刮 (對外介面)
   */
  sendTenantOnScavenge(tenantId) {
    if (this.gameApp.resourceManager?.sendTenantOnScavenge) {
      const result = this.gameApp.resourceManager.sendTenantOnScavenge(tenantId);
      if (result.success) {
        this.closeAllModals();
        this.updateAll();
      }
    }
  }

  /**
     * 使用技能（明確指定租客ID） - 新增方法
     * @param {string} skillId - 技能ID
     * @param {number} tenantId - 租客ID
     */
  async useSkillWithTenant(skillId, tenantId) {
    if (!this.gameApp?.skillManager?.executeSkill) {
      console.error("技能系統未載入或無法執行技能");
      this.gameApp.gameState?.addLog("技能系統未載入", "danger");
      return;
    }

    try {
      console.log(`執行技能: ${skillId}, 租客ID: ${tenantId}`);

      // 直接執行技能，不需要查找租客ID
      const result = await this.gameApp.skillManager.executeSkill(tenantId, skillId);

      // 關閉模態框並更新顯示
      this.closeAllModals();
      this.updateAll();

      // 添加日誌
      if (this.gameApp.gameState) {
        console.log(result)
        if (result.success) {
          this.gameApp.gameState.addLog(`成功使用技能: ${result.result.skillName || skillId}`, "skill");
        } else {
          this.gameApp.gameState.addLog(`無法使用技能: ${result.message || '未知錯誤'}`, "danger");
        }
      }
    } catch (error) {
      console.error("執行技能失敗:", error);
      this.gameApp.gameState?.addLog("執行技能失敗", "danger");
    }
  }

  /**
   * 收租 (對外介面)
   */
  collectRent() {
    if (this.gameApp.tradeManager?.processRentCollection) {
      const result = this.gameApp.tradeManager.processRentCollection();
    }
    this.updateAll();
  }

  /**
   * 院子採集 (對外介面)
   */
  harvestYard() {
    if (this.gameApp.resourceManager?.harvestYard) {
      const result = this.gameApp.resourceManager.harvestYard();
      if (result.success) {
        this.gameApp.gameState?.addLog(`採集: ${result.description}`, 'success');
      }
    }
    this.updateAll();
  }

  /**
   * 下一天 (對外介面)
   */
  nextDay() {
    this.showConfirmModal(
      '確認進入下一天',
      '確定要進入下一天嗎？',
      async () => {
        await this.gameApp.dayManager.executeNextDay()
        this.updateAll();
      }
    );
  }

  // =================== 確認對話框處理 (業務邏輯) ===================

  /**
   * 顯示確認對話框
   */
  showConfirmModal(title, message, callback) {
    this.modal.setConfirmContent(title, message);
    this.confirmCallback = callback;
    this.modal.show('confirmModal');
  }

  /**
   * 確認對話框 - 確認 (對外介面)
   */
  handleConfirmYes() {
    if (this.confirmCallback) {
      this.confirmCallback();
      this.confirmCallback = null;
    }
    this.closeModal('confirmModal');
  }

  /**
   * 確認對話框 - 取消 (對外介面)
   */
  handleConfirmNo() {
    this.confirmCallback = null;
    this.closeModal('confirmModal');
  }

  // =================== 房間處理 ===================

  handleRoomClick(roomId) {
    const rooms = this.gameApp.gameState?.getStateValue('rooms', []) || [];
    const room = rooms.find(r => r.id === roomId);
    if (room) {
      this.showRoomModal(room);
    }
  }

  getRoomId(element) {
    const match = element.id?.match(/room(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  // =================== 其他必要方法 (簡化版本) ===================

  async _waitForGameApp() {
    if (!this.gameApp.isInitialized) {
      let attempts = 0;
      while (!this.gameApp.isInitialized && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 50));
        attempts++;
      }
      if (!this.gameApp.isInitialized) {
        throw new Error("gameApp 初始化超時");
      }
    }
  }

  _loadThresholds() {
    try {
      const gameRules = this.gameApp.dataManager?.getGameRules();
      if (gameRules?.gameDefaults?.resources) {
        this.thresholds.resources.warning = {
          ...this.thresholds.resources.warning,
          ...gameRules.gameDefaults.resources.warningThresholds
        };
        this.thresholds.resources.critical = {
          ...this.thresholds.resources.critical,
          ...gameRules.gameDefaults.resources.criticalThresholds
        };
      }
      console.log("📊 閾值配置載入完成");
    } catch (error) {
      console.warn("⚠️ 使用預設閾值配置");
    }
  }

  // =================== 共用邏輯中心 ===================

  /**
   * 統一的資源狀態判斷
   */
  getResourceStatus(resourceType, value) {
    const { warning, critical } = this.thresholds.resources;

    if (value <= (critical[resourceType] || 0)) {
      return { severity: "critical", message: "緊急" };
    } else if (value <= (warning[resourceType] || 0)) {
      return { severity: "warning", message: "不足" };
    } else {
      return { severity: "good", message: "充足" };
    }
  }

  /**
   * 統一的圖示映射
   */
  getIcon(type, category = 'tenant') {
    const iconMaps = {
      tenant: {
        soldier: '🛡️', doctor: '⚕️', worker: '🔧',
        farmer: '🌾', trader: '💼', elder: '👴'
      },
      resource: {
        cash: '💰', food: '🍖', materials: '🔧',
        medical: '💊', fuel: '⛽'
      },
      log: {
        rent: '🚪',
        success: '✅', danger: '❌', warning: '⚠️',
        info: 'ℹ️', event: '📅'
      }
    };
    return iconMaps[category]?.[type] || '❓';
  }

  getSatisfactionEmoji(satisfaction) {
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
    return satisfactionEmoji;
  }

  /**
   * 統一的狀態文字生成
   */
  getStatusText(value, type) {
    const statusMaps = {
      defense: [
        [0, "脆弱"], [2, "基本"], [5, "穩固"], [8, "堅固"], [12, "要塞"]
      ],
      hunger: [
        [0, "飽足"], [1, "微餓"], [2, "有點餓"], [3, "飢餓"], [4, "很餓"], [6, "極度飢餓"]
      ]
    };

    const levels = statusMaps[type];
    if (!levels) return `未知(${value})`;

    for (let i = levels.length - 1; i >= 0; i--) {
      if (value >= levels[i][0]) {
        return `${levels[i][1]}(${value})`;
      }
    }
    return `${levels[0][1]}(${value})`;
  }

  // =================== 事件監聽 ===================

  _setupGameStateListeners() {
    if (!this.gameApp?.gameState || !this.gameApp?.eventBus) return;

    this.gameApp.gameState.subscribe("state_changed", () => this.updateAll());
    this.gameApp.gameState.subscribe("log_added", (data) => {
      this.display?.updateGameLog(data.logEntry);
    });

    this.gameApp.eventBus.on("tenant_tenantHired", () => this.updateAll());
    this.gameApp.eventBus.on("tenant_tenantEvicted", () => this.updateAll());
  }

  bindEvents() {
    this.bindButton('collectRentBtn', () => this.collectRent());
    this.bindButton('showVisitorsBtn', () => this.showVisitors());
    this.bindButton('showScavengeBtn', () => this.showScavenge());
    this.bindButton('harvestYardBtn', () => this.harvestYard());
    this.bindButton('showSkillBtn', () => this.showSkills());
    this.bindButton('nextDayBtn', () => this.nextDay());

    // 房間點擊事件
    document.addEventListener('click', (e) => {
      if (e.target instanceof Element) {
        const roomElement = e.target.closest('.room');
        if (roomElement) {
          const roomId = this.getRoomId(roomElement);
          if (roomId) this.handleRoomClick(roomId);
        }
      }
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

  bindButton(id, handler) {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', handler);
    }
  }

  // =================== 更新機制 ===================

  updateAll() {
    this.display?.updateAll();
    this._updateButtonStates();
  }

  _updateButtonStates() {
    const gameState = this.gameApp.gameState;
    if (!gameState) return;

    const dailyActions = gameState.getStateValue("dailyActions", {});

    this._updateButton("collectRentBtn", !dailyActions.rentCollected,
      dailyActions.rentCollected ? "💰 收租 (已收取)" : "💰 收租");

    const harvestDisabled = dailyActions.harvestUsed || (dailyActions.harvestCooldown || 0) > 0;
    let harvestText = "🌱 院子採集";
    if (dailyActions.harvestUsed) {
      harvestText += " (已使用)";
    } else if ((dailyActions.harvestCooldown || 0) > 0) {
      harvestText += ` (冷卻${dailyActions.harvestCooldown}天)`;
    }
    this._updateButton("harvestYardBtn", !harvestDisabled, harvestText);
  }

  _updateButton(buttonId, enabled, text = null) {
    const button = document.getElementById(buttonId);
    if (button instanceof HTMLButtonElement) {
      button.disabled = !enabled;
      if (text) button.innerHTML = text;
    }
  }

  startUpdateLoop() {
    this.updateTimer = setInterval(() => {
      if (this.isReady) {
        this.updateAll();
        if (this.uiState.debugMode) this.updateDebugInfo();
      }
    }, 1000);
  }

  // =================== 除錯功能 ===================

  bindDebugEvents() {
    const gameTitle = document.getElementById('gameTitle');
    if (gameTitle) {
      gameTitle.addEventListener('dblclick', () => this.toggleDebugPanel());
    }
  }

  toggleDebugPanel() {
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
      this.uiState.debugMode = !this.uiState.debugMode;
      debugPanel.style.display = this.uiState.debugMode ? 'block' : 'none';
      if (this.uiState.debugMode) this.updateDebugInfo();
    }
  }

  updateDebugInfo() {
    const systemInfo = document.getElementById('debugSystemInfo');
    const moduleInfo = document.getElementById('debugModuleInfo');

    if (systemInfo) {
      systemInfo.innerHTML = `
        系統: ${this.isReady ? '就緒' : '未就緒'}<br>
        天數: ${this.gameApp?.gameState?.getStateValue('day', '未知') || '未知'}
      `;
    }

    if (moduleInfo) {
      const managers = ['dataManager', 'gameState', 'eventBus', 'resourceManager', 'tenantManager', 'skillManager'];
      moduleInfo.innerHTML = managers
        .map(manager => `${manager}: ${this.gameApp[manager] ? '✓' : '✗'}`)
        .join('<br>');
    }
  }

  addTestResources() {
    if (this.gameApp?.resourceManager?.modifyResource) {
      this.gameApp.resourceManager.modifyResource('cash', 1000, '除錯測試');
      this.gameApp.resourceManager.modifyResource('food', 50, '除錯測試');
      this.gameApp.gameState?.addLog('除錯：增加測試資源', 'success');
      this.updateAll();
    }
  }

  regenerateVisitors() {
    if (this.gameApp?.tenantManager?.generateApplicants) {
      const applicants = this.gameApp.tenantManager.generateApplicants();
      this.gameApp.gameState.setStateValue('applicants', applicants)
      this.gameApp.gameState?.addLog('除錯：重新生成訪客','success');
      this.updateAll();
    }
  }

  // =================== 公開介面 ===================

  getStatus() {
    return {
      ready: this.isReady,
      display: !!this.display,
      modal: !!this.modal,
      gameApp: !!this.gameApp
    };
  }

  debug() {
    console.log('🔧 UICore 狀態:', this.getStatus());
    console.log('📊 閾值配置:', this.thresholds);
  }

  destroy() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this.isReady = false;
    this.uiState.systemReady = false;
  }
}
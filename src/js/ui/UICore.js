/**
 * UICore.js - UI系統核心協調器
 * 職責：統一對外介面、業務邏輯協調、委託子模組
 * 所有 HTML onclick 都調用 UICore 的方法
 */

import systemLogger from '../utils/SystemLogger.js';
import CommissionModal from './modal/CommissionModal.js';
import SkillModal from './modal/SkillModal.js';
import TenantModal from './modal/TenantModal.js';
import TradeModal from './modal/TradeModal.js';
import VisitorModal from './modal/VisitorModal.js';
import { TradeDescriptionFormatter } from './TradeDescriptionFormatter.js';
import UIDisplay from './UIDisplay.js';
import UIModal from './UIModal.js';

export default class UICore {
  constructor(gameApp) {
    this.gameApp = gameApp;
    this.display = null;
    this.modal = null;

    this.tenantModal = null;
    this.tradeModal = null;
    this.visitorModal = null;
    this.skillModal = null;
    this.commissionModal = null;

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
    systemLogger.success("🎨 UICore 已初始化");
  }

  // =================== 核心初始化 ===================

  async initialize() {
    systemLogger.info('🎨 UICore 初始化開始');

    try {
      await this._waitForGameApp();
      this._loadThresholds();

      this.display = new UIDisplay(this.gameApp, this);
      this.modal = new UIModal(this.gameApp, this);

      this.tenantModal = new TenantModal(this.gameApp, this);
      this.tradeModal = new TradeModal(this.gameApp, this);
      this.visitorModal = new VisitorModal(this.gameApp, this);
      this.skillModal = new SkillModal(this.gameApp, this);
      this.commissionModal = new CommissionModal(this.gameApp, this);

      await this.display.initialize();
      await this.modal.initialize();
      await this.tenantModal.initialize();
      await this.tradeModal.initialize();
      await this.visitorModal.initialize();
      await this.skillModal.initialize();
      await this.commissionModal.initialize();

      // 等待所有關鍵子系統完全就緒
      await this._waitForCriticalSubsystems();

      this.bindEvents();
      this.bindDebugEvents();
      this._setupGameStateListeners();
      this.startUpdateLoop();

      const applicants = this.gameApp.tenantManager?.generateApplicants();
      this.gameApp.gameState.setStateValue('applicants', applicants);

      this.isReady = true;
      this.uiState.systemReady = true;

      systemLogger.success('✅ UICore 初始化完成');
    } catch (error) {
      systemLogger.error("❌ UICore 初始化失敗:", error);
      throw error;
    }
  }

  /**
   * 等待關鍵子系統完全初始化
   * @private
   */
  async _waitForCriticalSubsystems() {
    systemLogger.info('⏳ 等待關鍵子系統初始化...');

    const criticalSystems = [
      {
        name: 'TradeManager',
        checker: () => this.gameApp.tradeManager?.isInitialized(),
        subChecker: () => this.gameApp.tradeManager?.universalTrader?.isConfigurationLoaded()
      },
      {
        name: 'TenantManager',
        checker: () => this.gameApp.tenantManager?.isInitialized()
      },
      {
        name: 'ResourceManager',
        checker: () => this.gameApp.resourceManager?.isInitialized()
      },
      {
        name: 'SkillManager',
        checker: () => this.gameApp.skillManager?.isInitialized()
      }
    ];

    const maxAttempts = 50; // 最多等待5秒
    let attempts = 0;

    while (attempts < maxAttempts) {
      const notReady = criticalSystems.filter(system => {
        const mainReady = system.checker();
        const subReady = system.subChecker ? system.subChecker() : true;
        return !mainReady || !subReady;
      });

      if (notReady.length === 0) {
        systemLogger.success('✅ 所有關鍵子系統已就緒');
        return;
      }

      systemLogger.info(`⏳ 等待系統: ${notReady.map(s => s.name).join(', ')}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    // 如果等待超時，拋出錯誤
    const stillNotReady = criticalSystems.filter(system => {
      const mainReady = system.checker();
      const subReady = system.subChecker ? system.subChecker() : true;
      return !mainReady || !subReady;
    });

    throw new Error(`關鍵子系統初始化超時: ${stillNotReady.map(s => s.name).join(', ')}`);
  }

  // =================== 統一對外介面 - 模態框控制 ===================

  /**
   * 顯示訪客模態框 (對外介面)
   */
  showVisitors() {
    if (this.visitorModal) {
      this.visitorModal.showVisitors();
    } else {
      systemLogger.error('VisitorModal 未初始化');
      this.gameApp.gameState?.addLog('訪客系統未載入', 'danger');
    }
  }

  /**
   * 顯示技能模態框 (對外介面)
   */
  showSkills() {
    if (this.skillModal) {
      this.skillModal.showSkills();
    } else {
      systemLogger.error('SkillModal 未初始化');
      this.gameApp.gameState?.addLog('技能系統未載入', 'danger');
    }
  }

  /**
   * 顯示房間模態框 (對外介面)
   */
  showRoomModal(room) {
    if (this.tenantModal) {
      this.tenantModal.showRoom(room);
    } else {
      systemLogger.error('TenantModal 未初始化');
    }
  }

  /**
   * 顯示交易模態框 (對外介面)
   * @param {string} characterId - 角色ID
   */
  showTradeModal(characterId) {
    if (this.tradeModal) {
      this.tradeModal.showTradeModal(characterId);
    } else {
      systemLogger.error('TradeModal 未初始化');
      this.gameApp.gameState?.addLog('交易系統未載入', 'danger');
    }
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
    if (this.tenantModal) {
      const result = await this.tenantModal.hireTenant(applicantId);
      if (result) {
        this.closeAllModals();
        this.updateAll();
      }
    } else {
      systemLogger.error('TenantModal 未初始化');
      this.gameApp.gameState?.addLog('租客系統未載入', 'danger');
      return false;
    }
  }

  /**
   * 驅逐租客 (對外介面)
   */
  evictTenant(tenantId, isInfected = false) {
    if (this.tenantModal) {
      this.tenantModal.evictTenant(tenantId, isInfected);
    } else {
      systemLogger.error('TenantModal 未初始化');
      this.gameApp.gameState?.addLog('租客系統未載入', 'danger');
    }
  }

  /**
     * 使用技能（明確指定租客ID） - 新增方法
     * @param {string} skillId - 技能ID
     * @param {number} tenantId - 租客ID
     */
  async useSkillWithTenant(skillId, tenantId, options = {}) {
    if (this.skillModal) {
      await this.skillModal.useSkillWithTenant(skillId, tenantId, options);
    } else {
      systemLogger.error('SkillModal 未初始化');
      this.gameApp.gameState?.addLog('技能系統未載入', 'danger');
    }
  }

  /**
   * 執行交易 (對外介面)
   * @param {string} tradeOptionId - 交易選項ID
   */
  async executeTrade(tradeOptionId) {
    try {
      if (!this.gameApp.tradeManager) {
        this.gameApp.gameState?.addLog("交易系統未載入", "danger");
        return;
      }

      systemLogger.info(`執行交易: ${tradeOptionId}`);

      // 執行交易
      const result = await this.gameApp.tradeManager.executeResourceTrade(tradeOptionId);

      if (result.success) {
        // 交易成功
        const description = TradeDescriptionFormatter.formatTradeExecutionDescription(result.transaction);
        this.gameApp.gameState?.addLog(description, 'rent');

        // 關閉交易模態框並更新顯示
        this.closeModal('tradeModal');
        this.updateAll();

        systemLogger.success(`交易執行成功: ${description}`);
      } else {
        // 交易失敗
        this.gameApp.gameState?.addLog(`交易失敗: ${result.error}`, "danger");
        systemLogger.error(`交易失敗: ${result.error}`);
      }

    } catch (error) {
      systemLogger.error("執行交易失敗:", error);
      this.gameApp.gameState?.addLog("交易系統錯誤", "danger");
    }
  }

  /**
   * 收租 (對外介面)
   */
  async collectRent() {
    try {
      if (this.gameApp.tradeManager?.collectRent) {
        const result = await this.gameApp.tradeManager.collectRent(); // 正確方法名 + await
        if (result.success) {
          systemLogger.info(result.summary);
        } else {
          this.gameApp.gameState?.addLog(result.error || '收租失敗', 'danger');
        }
      } else {
        this.gameApp.gameState?.addLog('交易系統未載入', 'danger');
      }
    } catch (error) {
      systemLogger.error('收租失敗:', error);
      this.gameApp.gameState?.addLog('收租系統錯誤', 'danger');
    }
    this.updateAll(); // 確保UI更新
  }

  /**
   * 院子採集 (對外介面)
   */
  harvestYard() {
    try {
      if (this.gameApp.resourceManager?.harvestYard) {
        const result = this.gameApp.resourceManager.harvestYard();
        if (result.success) {
          this.gameApp.gameState?.addLog(`採集: ${result.description}`, 'success');
        } else {
          this.gameApp.gameState?.addLog(result.error || '採集失敗', 'danger');
        }
      } else {
        this.gameApp.gameState?.addLog('資源系統未載入', 'danger');
      }
    } catch (error) {
      systemLogger.error('院子採集失敗:', error);
      this.gameApp.gameState?.addLog('採集系統錯誤', 'danger');
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
        try {
          if (this.gameApp.dayManager?.executeNextDay) {
            await this.gameApp.dayManager.executeNextDay();
            this.updateAll();
          } else {
            this.gameApp.gameState?.addLog('日期系統未載入', 'danger');
          }
        } catch (error) {
          systemLogger.error('進入下一天失敗:', error);
          this.gameApp.gameState?.addLog('日期系統錯誤', 'danger');
        }
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

  // =================== 個人資源處理方法 ===================

  /**
   * 計算個人資源總價值
   * @param {Object} personalResources - 個人資源物件
   * @returns {number} 總價值
   */
  getPersonalResourcesValue(personalResources) {
    if (!personalResources) return 0;

    const resourceValues = this._getPersonalWealthConfig()?.resourceValues || {
      food: 1.5, materials: 3.0, medical: 4.0, fuel: 3.0, cash: 1.0
    };

    return Object.entries(personalResources)
      .reduce((total, [type, amount]) => {
        const value = resourceValues[type] || 1.0;
        return total + (amount * value);
      }, 0);
  }

  /**
   * 安全取得個人資源
   * @param {Object} tenant - 租客物件
   * @returns {Object} 個人資源物件（含預設值）
   */
  safeGetPersonalResources(tenant) {
    const defaultResources = {
      food: 0, materials: 0, medical: 0, fuel: 0, cash: 0
    };

    if (!tenant || !tenant.personalResources) {
      return defaultResources;
    }

    return { ...defaultResources, ...tenant.personalResources };
  }

  /**
   * 取得個人財富配置
   * @private
   * @returns {Object} 個人財富配置
   */
  _getPersonalWealthConfig() {
    try {
      const gameRules = this.gameApp.dataManager?.getGameRules();
      return gameRules?.gameBalance?.personalWealth || {};
    } catch (error) {
      return {};
    }
  }

  // =================== 交易輔助方法 ===================


  /**
   * 格式化交易選項供顯示使用 (UI層職責)
   * 技術要點：使用 TradeDescriptionFormatter 進行描述生成
   * @param {Array} rawOptions - 原始交易選項
   * @returns {Array} 格式化後的交易選項
   */
  formatTradeOptionsForDisplay(rawOptions) {
    return rawOptions.map(option => ({
      ...option,
      // 使用描述格式化器生成描述
      description: TradeDescriptionFormatter.formatTradeOption(option),
      // 額外的UI顯示資訊
      urgencyText: TradeDescriptionFormatter.getUrgencyDisplayText(option.urgency),
      typeText: TradeDescriptionFormatter.getTradeTypeDisplayText(option.type),
      // 價格顯示格式化
      priceText: this.formatPriceDisplay(option.price, option.originalPrice)
    }));
  }

  /**
 * 格式化價格顯示
 * @param {number} currentPrice - 當前價格
 * @param {number} originalPrice - 原始價格
 * @returns {string} 格式化的價格文字
 */
  formatPriceDisplay(currentPrice, originalPrice) {
    if (currentPrice !== originalPrice) {
      return `$${currentPrice} (原價 $${originalPrice})`;
    }
    return `$${currentPrice}`;
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
      systemLogger.success("📊 閾值配置載入完成");
    } catch (error) {
      systemLogger.warn("⚠️ 使用預設閾值配置");
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
      tenantHuman: {
        soldier: '👮‍♂️', doctor: '👨‍⚕️', worker: '👩‍🔧',
        farmer: '🧑‍🌾', trader: '👨‍💼', elder: '👴'
      },
      resource: {
        cash: '💰', food: '🍖', materials: '🔧',
        medical: '💊', fuel: '⛽'
      },
      log: {
        rent: '🚪',
        success: '✅', danger: '❌', warning: '⚠️',
        info: 'ℹ️', event: '📅', skill: '⭐'
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
   * @param {number} value - 數值
   * @param {string} type - 類型
   * @param {boolean} returnDetails - 是否返回詳細資訊
   * @returns {string|Object} 狀態文字或詳細資訊物件
   */
  getStatusText(value, type, returnDetails = false) {
    let result = { text: '', value: value, severity: 'normal', displayText: '' };

    switch (type) {
      case 'defense':
        result = this._getDefenseStatus(value);
        break;
      case 'hunger':
        result = this._getHungerStatus(value);
        break;
      case 'personalWealth':
        result = this._getPersonalWealthStatus(value);
        break;
      default:
        result = { text: `未知(${value})`, value, severity: 'normal', displayText: `未知(${value})` };
    }

    return returnDetails ? result : result.displayText;
  }

  /**
   * 取得個人財富狀態
   * @private
   * @param {number} totalValue - 總價值
   * @returns {Object} 狀態資訊
   */
  _getPersonalWealthStatus(totalValue) {
    const config = this._getPersonalWealthConfig();
    const levels = config.display?.levels || [
      { threshold: 80, name: "富裕", severity: "good" },
      { threshold: 50, name: "充足", severity: "good" },
      { threshold: 20, name: "普通", severity: "good" },
      { threshold: 5, name: "匱乏", severity: "warning" },
      { threshold: 0, name: "身無分文", severity: "critical" }
    ];

    // 找到符合的等級（從高到低）
    const level = levels.find(l => totalValue >= l.threshold) || levels[levels.length - 1];

    return {
      text: level.name,
      value: totalValue,
      severity: level.severity,
      displayText: `${level.name}(${totalValue.toFixed(1)})`
    };
  }

  /**
   * 取得防禦狀態（重構現有邏輯）
   * @private
   * @param {number} value - 防禦值
   * @returns {Object} 狀態資訊
   */
  _getDefenseStatus(value) {
    const levels = [
      [0, "脆弱", "critical"], [2, "基本", "warning"], [5, "穩固", "normal"],
      [8, "堅固", "good"], [12, "要塞", "good"]
    ];

    for (let i = levels.length - 1; i >= 0; i--) {
      const threshold = Number(levels[i][0]); // 確保轉換為數字類型
      if (value >= threshold) {
        return {
          text: levels[i][1],
          value: value,
          severity: levels[i][2],
          displayText: `${levels[i][1]}(${value})`
        };
      }
    }

    return { text: "脆弱", value, severity: "critical", displayText: `脆弱(${value})` };
  }

  /**
   * 取得飢餓狀態（重構現有邏輯）
   * @private
   * @param {number} value - 飢餓值
   * @returns {Object} 狀態資訊
   */
  _getHungerStatus(value) {
    const levels = [
      [0, "飽足", "good"], [1, "微餓", "normal"], [2, "有點餓", "warning"],
      [3, "飢餓", "warning"], [4, "很餓", "critical"], [6, "極度飢餓", "critical"]
    ];

    for (let i = levels.length - 1; i >= 0; i--) {
      const threshold = Number(levels[i][0]); // 確保轉換為數字類型
      if (value >= threshold) {
        return {
          text: levels[i][1],
          value: value,
          severity: levels[i][2],
          displayText: `${levels[i][1]}(${value})`
        };
      }
    }

    return { text: "飽足", value, severity: "good", displayText: `飽足(${value})` };
  }

  /**
   * 取得資源中文名稱
   * @param {string} resourceType - 資源類型
   * @returns {string} 中文名稱
   */
  getResourceName(resourceType) {
    const config = this._getPersonalWealthConfig();
    const resourceNames = config.resourceNames || {
      food: '食物', materials: '建材', medical: '醫療用品',
      fuel: '燃料', cash: '現金'
    };

    return resourceNames[resourceType] || resourceType;
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
    this.bindButton('harvestYardBtn', () => this.harvestYard());
    this.bindButton('showSkillBtn', () => this.showSkills());
    this.bindButton('nextDayBtn', () => this.nextDay());
    this.bindButton('showCommissionBtn', () => this.showCommissionModal());

    this.bindCommissionEvents()

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
        // 排除 commissionModal，防止背景點擊意外關閉
        if (e.target === modal && modal.id !== 'commissionModal') {
          this.closeModal();
        }
      });
    });

    // 確認對話框
    this.bindButton("confirmYes", () => this.handleConfirmYes());
    this.bindButton("confirmNo", () => this.closeModal());

    systemLogger.success("🔗 事件監聽器綁定完成");
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


  addLog(message, type = "default") {
    this.gameApp.gameState.addLog(message, type)
  }

  // =================== 委託探索系統對外介面 ===================

  /**
   * 顯示委託探索模態框
   */
  showCommissionModal() {
    if (this.commissionModal) {
      this.commissionModal.showCommissionModal();
    } else {
      systemLogger.error('CommissionModal 未初始化');
      this.gameApp.gameState?.addLog('委託系統未載入', 'danger');
    }
  }

  /**
   * 處理租客選擇
   * @param {string} tenantId - 租客ID
   */
  handleTenantSelection(tenantId) {
    if (this.commissionModal) {
      this.commissionModal.handleTenantSelection(tenantId);
    } else {
      systemLogger.error('CommissionModal 未初始化');
    }
  }

  /**
   * 處理資源輸入變更
   * @param {Event} event - 輸入事件
   */
  handleResourceInputChange(event) {
    if (this.commissionModal) {
      this.commissionModal.handleResourceInputChange(event);
    } else {
      systemLogger.error('CommissionModal 未初始化');
    }
  }

  /**
   * 切換委託頁籤
   * @param {string} tabName - 頁籤名稱
   */
  switchCommissionTab(tabName) {
    if (this.commissionModal) {
      this.commissionModal.switchCommissionTab(tabName);
    } else {
      systemLogger.error('CommissionModal 未初始化');
    }
  }

  // =================== 初始化綁定 ===================

  /**
   * 綁定委託相關事件（在 bindEvents 方法中調用）
   */
  bindCommissionEvents() {
    // 頁籤切換
    document.querySelectorAll('.commission-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = /** @type {HTMLElement} */(e.target).getAttribute('data-tab');
        if (tab) {
          this.switchCommissionTab(tab);
        };
      });
    });

    // 表單提交委託給 CommissionModal
    const form = document.getElementById('commissionForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (this.commissionModal) {
          this.commissionModal.handleCommissionFormSubmit(e);
        }
      });
    }

    // 提交按鈕點擊事件（因為按鈕不是type="submit"）
    const submitBtn = document.getElementById('submitCommission');
    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.commissionModal) {
          this.commissionModal.handleCommissionFormSubmit(e);
        }
      });
    }

    // 綁定所有資源輸入的變更事件
    const resourceInputSelectors = [
      '#targetResource', '#targetAmount',
      '#basePaymentCash', '#basePaymentFood', '#basePaymentMaterials', '#basePaymentMedical', '#basePaymentFuel',
      '#commissionCash', '#commissionFood', '#commissionMaterials', '#commissionMedical', '#commissionFuel'
    ];

    resourceInputSelectors.forEach(selector => {
      const input = document.querySelector(selector);
      if (input) {
        input.addEventListener('input', (e) => this.handleResourceInputChange(e));
        input.addEventListener('change', (e) => this.handleResourceInputChange(e));
      }
    });

    systemLogger.success('🔗 委託事件監聽器綁定完成');
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
      this.gameApp.gameState?.addLog('除錯：重新生成訪客', 'success');
      this.updateAll();
    }
  }

  // =================== 新增便捷存取方法 ===================

  /**
   * 取得 TenantModal 實例
   * @returns {TenantModal|null}
   */
  getTenantModal() {
    return this.tenantModal;
  }

  /**
   * 取得 TradeModal 實例
   * @returns {TradeModal|null}
   */
  getTradeModal() {
    return this.tradeModal;
  }

  /**
   * 取得 VisitorModal 實例
   * @returns {VisitorModal|null}
   */
  getVisitorModal() {
    return this.visitorModal;
  }

  /**
   * 取得 SkillModal 實例
   * @returns {SkillModal|null}
   */
  getSkillModal() {
    return this.skillModal;
  }

  /**
   * 取得 CommissionModal 實例
   * @returns {CommissionModal|null}
   */
  getCommissionModal() {
    return this.commissionModal;
  }

  // =================== 公開介面 ===================

  getStatus() {
    return {
      ready: this.isReady,
      display: !!this.display,
      modal: !!this.modal,
      tenantModal: !!this.tenantModal,
      tradeModal: !!this.tradeModal,
      visitorModal: !!this.visitorModal,
      skillModal: !!this.skillModal,
      commissionModal: !!this.commissionModal,
      gameApp: !!this.gameApp
    };
  }

  debug() {
    systemLogger.debug('🔧 UICore 狀態:', this.getStatus());
    systemLogger.debug('📊 閾值配置:', this.thresholds);
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
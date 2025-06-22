/**
 * UICore.js - UI系統核心協調器
 * 職責：統一對外介面、業務邏輯協調、委託子模組
 * 所有 HTML onclick 都調用 UICore 的方法
 */

import systemLogger from '../utils/SystemLogger.js';
import { TradeDescriptionFormatter } from './TradeDescriptionFormatter.js';
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

      await this.display.initialize();
      await this.modal.initialize();

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
    this.closeModal()
    const visitors = this.gameApp.gameState?.getStateValue('applicants', []) || [];

    // 預檢查所有訪客的交易狀態
    if (!this.gameApp.tradeManager) return;

    visitors.forEach(visitor => {
      // 檢查每個訪客的交易選項
      const tradeOptions = this.gameApp.tradeManager.getCharacterTradeOptions(visitor.id);
      visitor._hasTradeOptions = tradeOptions && tradeOptions.length > 0;
    });

    this.modal.setVisitorContent(visitors);
    this.modal.show('visitorModal');
  }

  /**
   * 顯示搜刮模態框 (對外介面)
   */
  showScavenge() {
    const scavengeUsed = this.gameApp.gameState?.getStateValue('scavengeUsed', 0) || 0;
    const remaining = 2 - scavengeUsed;

    const allTenants = this.gameApp.gameState?.getAllTenants() || [];
    const availableTenants = allTenants.filter(tenant =>
      !tenant.onMission && !tenant.infected
    );

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
    const tenant = this.gameApp.gameState?.getRoomTenant(room.id);

    if (tenant) {
      const satisfaction = this.gameApp.gameState?.getStateValue(`tenantSatisfaction.${tenant.name}`, 50) || 50;
      this.modal.setTenantContent(room, satisfaction);
    } else {
      this.modal.setEmptyRoomContent(room);
    }
    this.modal.show('tenantModal');
  }

  /**
   * 顯示交易模態框 (對外介面)
   * @param {string} characterId - 角色ID
   */
  showTradeModal(characterId) {
    try {
      if (!this.gameApp.tradeManager) {
        this.gameApp.gameState?.addLog("交易系統未載入", "danger");
        return;
      }

      // 獲取角色交易選項
      const rawTradeOptions = this.gameApp.tradeManager.getCharacterTradeOptions(characterId);

      // 在UI層添加描述格式化
      const formattedOptions = this.formatTradeOptionsForDisplay(rawTradeOptions);

      // 找到角色資訊
      const character = this._findCharacterById(characterId);
      if (!character) {
        this.gameApp.gameState?.addLog("找不到指定角色", "danger");
        return;
      }

      // 設置交易模態框內容
      this.modal.setTradeContent(character, formattedOptions);
      this.modal.show('tradeModal');

      // 立即更新所有相關按鈕狀態
      this._updateAllTradeButtonStates(character.id, formattedOptions.length > 0);

      systemLogger.info(`顯示 ${character.name} 的交易選項，共 ${formattedOptions.length} 個`);
    } catch (error) {
      systemLogger.error("顯示交易模態框失敗:", error);
      this.gameApp.gameState?.addLog("無法顯示交易選項", "danger");
    }
  }

  /**
   * 更新所有相關交易按鈕狀態
   * @param {string} characterId - 角色ID
   * @param {boolean} hasTradeOptions - 是否有交易選項
   * @private
   */
  _updateAllTradeButtonStates(characterId, hasTradeOptions) {
    // 更新租客詳情模態框中的交易按鈕
    this.display.updateTenantModalTradeButton(characterId, hasTradeOptions);

    // 更新訪客列表中的交易按鈕
    this._updateVisitorTradeButton(characterId, hasTradeOptions);
  }

  /**
   * 更新訪客列表中的交易按鈕狀態
   * @param {string} characterId - 角色ID
   * @param {boolean} hasTradeOptions - 是否有交易選項
   * @private
   */
  _updateVisitorTradeButton(characterId, hasTradeOptions) {
    // 尋找訪客列表中的交易按鈕
    const visitorModal = document.getElementById('visitorModal');
    if (!visitorModal) return;

    const tradeButton = visitorModal.querySelector(`button[onclick*="showTradeModal(${characterId})"]`);
    if (!tradeButton) return;

    // 更新按鈕狀態
    /** @type {HTMLButtonElement} */(tradeButton).disabled = !hasTradeOptions;
    /** @type {HTMLButtonElement} */(tradeButton).title = hasTradeOptions ? '與訪客進行資源交易' : '暫無可用交易';

    // 更新按鈕文字
    const buttonText = hasTradeOptions ? '💱 交易' : '💱 暫無交易';
    tradeButton.innerHTML = buttonText;

    // 更新按鈕樣式
    if (hasTradeOptions) {
      tradeButton.classList.remove('btn-disabled');
      tradeButton.classList.add('btn-info');
    } else {
      tradeButton.classList.remove('btn-info');
      tradeButton.classList.add('btn-disabled');
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
      systemLogger.error('找不到租客');
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
          systemLogger.error("驅逐租客失敗:", error);
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
  async useSkillWithTenant(skillId, tenantId, options = {}) {
    systemLogger.debug(`使用技能: ${skillId}, 租客ID: ${tenantId}`);
    if (!this.gameApp?.skillManager?.executeSkill) {
      systemLogger.error("技能系統未載入或無法執行技能");
      this.gameApp.gameState?.addLog("技能系統未載入", "danger");
      return;
    }

    try {
      systemLogger.info(`執行技能: ${skillId}, 租客ID: ${tenantId}`);

      // 直接執行技能，不需要查找租客ID
      const result = await this.gameApp.skillManager.executeSkill(tenantId, skillId, options);

      // 關閉模態框並更新顯示
      this.closeAllModals();
      this.updateAll();

      // 添加日誌
      if (this.gameApp.gameState) {
        if (result.success) {
          this.addLog(`成功使用技能: ${result.skillId || skillId}`, "skill");
        } else {
          this.addLog(`無法使用技能: ${result.error || '未知錯誤'}`, "danger");
        }
      }
    } catch (error) {
      systemLogger.error("執行技能失敗:", error);
      this.gameApp.gameState?.addLog("執行技能失敗", "danger");
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
          this.gameApp.gameState?.addLog(result.summary, 'rent');
        } else {
          this.gameApp.gameState?.addLog(result.error || '收租失敗', 'danger');
        }
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
   * 根據ID尋找角色
   * @private
   * @param {string} personId - 角色ID
   * @returns {Object|null} 角色物件
   */
  _findCharacterById(personId) {
    return this.gameApp.gameState?.findPersonById(Number(personId)) || null;
  }

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
    this.bindButton('showScavengeBtn', () => this.showScavenge());
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
        if (e.target === modal) {
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
    this.closeModal();
    this.modal.setCommissionModalContent();
    this.modal.show('commissionModal');
    // 預設顯示發起委託頁籤
    this.switchCommissionTab('newCommission');
  }

  /**
   * 處理租客選擇
   * @param {string} tenantId - 租客ID
   */
  handleTenantSelection(tenantId) {
    // 更新選擇狀態
    const tenantGrid = document.getElementById('tenantSelection');
    if (!tenantGrid) return;

    tenantGrid.querySelectorAll('.tenant-card').forEach(card => {
      const isSelected = card.getAttribute('data-tenant-id') === tenantId;
      card.classList.toggle('selected', isSelected);
    });

    // 更新預覽
    this.updateCommissionPreview();
  }

  /**
   * 處理資源輸入變更
   * @param {Event} event - 輸入事件
   */
  handleResourceInputChange(event) {
    // 防抖處理
    clearTimeout(this.commissionPreviewTimer);
    this.commissionPreviewTimer = setTimeout(() => {
      this.updateCommissionPreview();
    }, 300);
  }

  // =================== 資料格式化 ===================

  /**
   * 格式化委託資料為API格式
   * @param {Object} formData - 表單資料
   * @returns {Object} API請求格式
   */
  formatCommissionDataForAPI(formData) {
    return {
      tenantId: formData.selectedTenant,
      resourceType: formData.targetResource,
      targetAmount: parseInt(formData.targetAmount),
      basePayment: {
        cash: parseInt(formData.commission.cash) || 0,
        food: parseInt(formData.basePayment.food) || 0,
        materials: parseInt(formData.basePayment.materials) || 0,
        medical: parseInt(formData.basePayment.medical) || 0,
        fuel: parseInt(formData.basePayment.fuel) || 0
      },
      commission: {
        cash: parseInt(formData.commission.cash) || 0,
        food: parseInt(formData.basePayment.food) || 0,
        materials: parseInt(formData.basePayment.materials) || 0,
        medical: parseInt(formData.basePayment.medical) || 0,
        fuel: parseInt(formData.basePayment.fuel) || 0
      }
    };
  }

  /**
   * 格式化委託資料供顯示
   * @param {Object} commission - 委託物件
   * @returns {Object} 顯示格式
   */
  formatCommissionForDisplay(commission) {
    const tenant = this.gameApp.gameState.findPersonById(commission.tenantId);
    const status = this.getCommissionStatusText(commission.status);

    return {
      id: commission.id,
      tenantName: tenant?.name || '未知租客',
      resourceType: this.getResourceName(commission.resourceType),
      targetAmount: commission.targetAmount,
      statusText: status.text,
      statusClass: status.class,
      basePaymentText: this.formatRewardText(commission.basePayment),
      commissionText: this.formatRewardText(commission.commission),
      decidedAt: commission.decidedAt ? new Date(commission.decidedAt).toLocaleString() : null
    };
  }

  /**
   * 格式化報酬文字
   * @param {Object} reward - 報酬物件
   * @returns {string} 格式化文字
   */
  formatRewardText(reward) {
    const items = [];

    for (const [resource, amount] of Object.entries(reward)) {
      if (amount > 0) {
        const icon = this.getIcon(resource, 'resource');
        const name = this.getResourceName(resource);
        items.push(`${icon} ${name} x${amount}`);
      }
    }

    return items.length > 0 ? items.join(', ') : '無';
  }

  /**
   * 獲取委託狀態文字
   * @param {string} status - 狀態代碼
   * @returns {Object} 狀態資訊
   */
  getCommissionStatusText(status) {
    const statusMap = {
      offered: { text: '邀約中', class: 'status-pending' },
      accepted: { text: '已接受', class: 'status-active' },
      rejected: { text: '已拒絕', class: 'status-rejected' },
      exploring: { text: '探索中', class: 'status-exploring' },
      completed: { text: '已完成', class: 'status-success' },
      failed: { text: '失敗', class: 'status-failed' }
    };

    return statusMap[status] || { text: '未知', class: 'status-unknown' };
  }

  // =================== 內部輔助方法 ===================

  /**
   * 更新委託預覽
   * @private
   */
  updateCommissionPreview() {
    const formData = this.modal?.getCommissionFormData();
    if (!formData || !formData.selectedTenant) {
      // 隱藏預覽並委託 UIDisplay 更新
      if (this.display) {
        this.display.updateCommissionPreview(null);
      }
      return;
    }

    // 計算預覽資料
    const previewData = this.calculateCommissionPreview(formData);

    // 委託 UIDisplay 處理 DOM 更新
    if (this.display && previewData) {
      this.display.updateCommissionPreview(previewData);
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

    // 表單提交
    const form = document.getElementById('commissionForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCommissionFormSubmit(e));
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

  // =================== 委託模態框訊息顯示（架構一致性重構） ===================

  /**
   * 顯示委託成功訊息（統一介面）
   * @param {string} message - 成功訊息
   */
  showCommissionSuccess(message) {
    this.addCommissionMessage(message, 'success');
  }

  /**
   * 顯示委託錯誤訊息（統一介面）
   * @param {string} message - 錯誤訊息
   */
  showCommissionError(message) {
    this.addCommissionMessage(message, 'error');
  }

  /**
   * 新增委託訊息（模仿 gameState.addLog 的設計模式）
   * @param {string} message - 訊息內容
   * @param {string} type - 訊息類型 ('success' | 'error' | 'warning' | 'info')
   */
  addCommissionMessage(message, type = 'info') {
    if (!this.display) return;

    // 創建訊息物件（與日誌格式保持一致）
    const messageData = {
      message: message,
      type: type,
      timestamp: Date.now(),
      id: `commission_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // 委託給 UIDisplay 處理DOM操作
    this.display.updateCommissionMessage(messageData);
  }

  /**
   * 重置委託表單（委託人提供的介面）
   */
  resetCommissionForm() {
    if (this.modal) {
      this.modal.resetCommissionForm();
    }
  }

  // =================== 委託表單驗證與預覽更新 ===================

  /**
   * 驗證委託表單並更新按鈕狀態
   * @returns {boolean} 表單是否有效
   */
  validateAndUpdateCommissionForm() {
    const formData = this.modal?.getCommissionFormData();
    const validation = this.modal?.validateCommissionFormData(formData);

    const isValid = validation?.valid && formData?.selectedTenant;

    // 委託 UIDisplay 處理 DOM 更新
    if (this.display) {
      this.display.updateCommissionFormState({
        isValid,
        formData,
        validation
      });
    }

    // 如果表單有效，計算預覽資料並委託顯示
    if (isValid) {
      this.updateCommissionPreview();
    }

    return isValid;
  }

  /**
   * 計算委託預覽資料
   * @param {Object} formData - 表單資料
   * @returns {Object|null} 預覽資料
   */
  calculateCommissionPreview(formData) {
    if (!formData?.selectedTenant) return null;

    // 取得租客資訊
    const tenant = this.gameApp.gameState?.findPersonById(formData.selectedTenant);
    if (!tenant) return null;

    // 委託 TradeManager 進行業務計算
    const businessResults = this._delegateToTradeManager(formData, tenant);
    if (!businessResults) return null;

    // 返回格式化的預覽資料（UI 層職責）
    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        type: tenant.type,
        typeName: tenant.typeName || tenant.type
      },
      targetResource: formData.targetResource,
      targetAmount: formData.targetAmount,
      acceptanceProbability: Math.round(businessResults.acceptanceProbability * 100),
      possiblePartner: businessResults.possiblePartner ? {
        id: businessResults.possiblePartner.id,
        name: businessResults.possiblePartner.name,
        type: businessResults.possiblePartner.type,
        typeName: businessResults.possiblePartner.typeName || businessResults.possiblePartner.type
      } : null,
      resourceIcon: this.getIcon(formData.targetResource, 'resource'),
      resourceName: this.getResourceName(formData.targetResource),
      tenantIcon: this.getIcon(tenant.type, 'tenantHuman'),
      partnerIcon: businessResults.possiblePartner ? this.getIcon(businessResults.possiblePartner.type, 'tenantHuman') : null,
      probabilityClass: this._getProbabilityClass(Math.round(businessResults.acceptanceProbability * 100))
    };
  }

  /**
   * 委託 TradeManager 進行業務邏輯計算
   * @param {Object} formData - 表單資料
   * @param {Object} tenant - 租客物件
   * @returns {Object|null} 業務計算結果
   * @private
   */
  _delegateToTradeManager(formData, tenant) {
    // 檢查 TradeManager 可用性
    const tradeManager = this.gameApp.tradeManager;
    if (!tradeManager?.commissionHandler) {
      systemLogger.error('TradeManager.commissionHandler 不可用');
      return null;
    }

    const commissionHandler = tradeManager.commissionHandler;

    try {
      // 1. 檢查租客可用性（使用業務系統邏輯）
      const availability = commissionHandler._checkTenantAvailability(tenant.id);
      if (!availability?.available) {
        systemLogger.warn(`租客不可用: ${availability?.reason || '未知原因'}`);
        return { acceptanceProbability: 0, possiblePartner: null };
      }

      // 2. 評估組隊可能性（使用業務系統邏輯）
      const possiblePartner = commissionHandler._evaluateTeamFormation(tenant.id);

      // 3. 構建臨時委託邀約供計算使用
      const temporaryOffer = {
        tenantId: tenant.id,
        resourceType: formData.targetResource,
        targetAmount: parseInt(formData.targetAmount),
        basePayment: this._normalizePayment(formData.basePayment),
        commission: this._normalizePayment(formData.commission),
        partnerId: possiblePartner?.id || null
      };

      // 4. 計算接受機率（使用業務系統邏輯）
      const acceptance = commissionHandler._calculateAcceptanceProbability(temporaryOffer);

      if (!acceptance || typeof acceptance.probability !== 'number') {
        systemLogger.error('業務系統返回無效的接受機率');
        return null;
      }

      return {
        acceptanceProbability: acceptance.probability,
        possiblePartner
      };

    } catch (error) {
      systemLogger.error('委託業務系統計算失敗:', error);
      return null;
    }
  }

  /**
   * 發送委託邀約請求（使用 TradeManager API）
   * @param {Object} request - 委託請求
   */
  async requestCommissionOffer(request) {
    if (!this.gameApp?.tradeManager) {
      this.showCommissionError('交易系統未初始化');
      return;
    }

    try {
      const submitBtn = document.getElementById('submitCommission');
      if (submitBtn) /** @type {HTMLButtonElement} */(submitBtn).disabled = true;

      // 使用 TradeManager 的公開 API
      const result = await this.gameApp.tradeManager.offerCommission(request);

      if (result.success) {
        this.showCommissionSuccess('委託邀約已發送！租客已接受任務。');
        this.resetCommissionForm();

        // 切換到活躍委託頁籤
        setTimeout(() => {
          this.switchCommissionTab('activeCommissions');
        }, 1500);
      } else {
        const reason = result.reason || '委託被拒絕';
        this.showCommissionError(`委託失敗：${reason}`);
      }
    } catch (error) {
      systemLogger.error('委託邀約失敗:', error);
      this.showCommissionError('發送委託時發生錯誤');
    } finally {
      const submitBtn = document.getElementById('submitCommission');
      if (submitBtn) /** @type {HTMLButtonElement} */(submitBtn).disabled = false;
    }
  }

  /**
   * 取得委託統計資料（使用 TradeManager API）
   * @returns {Promise<Object>} 統計資料
   */
  async fetchCommissionStats() {
    if (!this.gameApp?.tradeManager) {
      systemLogger.warn('TradeManager 不可用，無法取得委託統計');
      return {
        activeCommissions: 0,
        totalCommissions: 0,
        successfulCommissions: 0,
        successRate: 0
      };
    }

    try {
      return this.gameApp.tradeManager.getCommissionStats();
    } catch (error) {
      systemLogger.error('取得委託統計失敗:', error);
      return {
        activeCommissions: 0,
        totalCommissions: 0,
        successfulCommissions: 0,
        successRate: 0
      };
    }
  }

  // =================== 重構處理委託表單提交以使用 TradeManager API ===================

  /**
   * 處理委託表單提交（使用 TradeManager API）
   * @param {Event} event - 表單事件
   */
  async handleCommissionFormSubmit(event) {
    event.preventDefault();

    const formData = this.modal.getCommissionFormData();
    if (!formData) {
      this.showCommissionError('請填寫所有必要欄位');
      return;
    }

    const validation = this.modal.validateCommissionFormData(formData);
    if (!validation.valid) {
      if (this.display) {
        this.display.highlightCommissionErrors(validation.errors.map(error => error.message));
      }
      return;
    }

    // 格式化為 TradeManager 的 API 格式
    const request = this.formatCommissionDataForAPI(formData);

    // 使用 TradeManager API 發送委託邀約
    await this.requestCommissionOffer(request);
  }

  // =================== 委託分頁切換時使用 TradeManager API ===================

  /**
   * 切換委託頁籤
   * @param {string} tabName - 頁籤名稱
   */
  switchCommissionTab(tabName) {
    const validTabs = ['newCommission', 'activeCommissions', 'commissionHistory', 'commissionStats'];
    if (!validTabs.includes(tabName)) return;

    // 更新頁籤按鈕狀態
    document.querySelectorAll('.commission-tabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // 切換頁籤內容
    document.querySelectorAll('#commissionModal .tab-content').forEach(content => {
      const isTarget = content.id === `${tabName}Tab`;
      content.classList.toggle('active', isTarget);
    });

    document.querySelectorAll('#commissionModal .tab-actions').forEach(action => {
      const isNewCommissionForm = tabName === 'newCommission';
      const isNewCommissionAction = action.id === 'newCommissionAction'
      action.classList.toggle('active', isNewCommissionForm === isNewCommissionAction);
    })

    if (!this.gameApp?.tradeManager) return;

    // 根據頁籤載入對應資料（使用 TradeManager API）
    if (tabName === 'activeCommissions') {
      const commissions = this.gameApp.tradeManager.getActiveCommissions();
      this.modal._populateActiveCommissionsTab(commissions);
    } else if (tabName === 'commissionHistory') {
      const history = this.gameApp.tradeManager.getCommissionHistory();
      this.modal._populateCommissionHistoryTab(history);
    } else if (tabName === 'commissionStats') {
      const stats = this.gameApp.tradeManager.getCommissionStats();
      this.modal._populateCommissionStatsTab(stats);
    }
  }

  /**
   * 計算報酬總價值
   * @param {Object} basePayment - 基礎報酬
   * @param {Object} commission - 佣金
   * @returns {number} 總價值
   * @private
   */
  _calculatePaymentValue(basePayment, commission) {
    const resourceValues = { food: 2, materials: 3, medical: 4, fuel: 3, cash: 1 };

    let totalValue = 0;

    // 計算基礎報酬價值
    for (const [resource, amount] of Object.entries(basePayment)) {
      totalValue += parseInt(amount || 0) * (resourceValues[resource] || 1);
    }

    // 計算佣金價值
    for (const [resource, amount] of Object.entries(commission)) {
      totalValue += parseInt(amount || 0) * (resourceValues[resource] || 1);
    }

    return totalValue;
  }

  /**
   * 尋找可能的組隊夥伴
   * @param {Object} primaryTenant - 主要租客
   * @param {string} targetResource - 目標資源
   * @returns {Object|null} 組隊夥伴或null
   * @private
   */
  _findPossiblePartner(primaryTenant, targetResource) {
    const allTenants = this.gameApp.gameState?.getAllTenants() || [];

    // 技能互補對照表
    const complementarySkills = {
      food: ['farmer', 'worker'],
      materials: ['worker', 'soldier'],
      medical: ['doctor'],
      fuel: ['worker', 'trader']
    };

    const beneficialTypes = complementarySkills[targetResource] || [];

    // 尋找不同類型的可用租客
    const availablePartners = allTenants.filter(tenant => {
      return tenant.id !== primaryTenant.id &&
        !tenant.infected &&
        !tenant.onMission &&
        beneficialTypes.includes(tenant.type);
    });

    // 返回滿意度最高的夥伴
    if (availablePartners.length > 0) {
      return availablePartners.reduce((best, current) => {
        const currentSatisfaction = this.gameApp.gameState?.getStateValue(`tenantSatisfaction.${current.name}`, 50) || 50;
        const bestSatisfaction = this.gameApp.gameState?.getStateValue(`tenantSatisfaction.${best.name}`, 50) || 50;
        return currentSatisfaction > bestSatisfaction ? current : best;
      });
    }

    return null;
  }

  /**
   * 正規化支付物件（確保所有字段為數字）
   * @param {Object} payment - 支付物件
   * @returns {Object} 正規化後的支付物件
   * @private
   */
  _normalizePayment(payment) {
    const normalized = {};
    for (const [key, value] of Object.entries(payment || {})) {
      normalized[key] = parseInt(value) || 0;
    }
    return normalized;
  }

  /**
   * 取得機率CSS類別
   * @param {number} probability - 機率百分比
   * @returns {string} CSS類別名稱
   * @private
   */
  _getProbabilityClass(probability) {
    if (probability >= 70) return 'prob-high';
    if (probability >= 50) return 'prob-medium';
    if (probability >= 30) return 'prob-low';
    return 'prob-very-low';
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
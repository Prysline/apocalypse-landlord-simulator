// @ts-check
/**
 * CommissionModal.js - 委託探索功能專用模組
 * 職責：委託探索相關 Modal 管理和複雜業務邏輯處理
 * 繼承 BaseModal 獲得標準化功能
 */

import BaseModal from './BaseModal.js';
import systemLogger from '../../utils/SystemLogger.js';

export default class CommissionModal extends BaseModal {
  constructor(gameApp, uiCore) {
    super(gameApp, uiCore);

    // 委託模態框狀態管理
    this.commissionPreviewTimer = null;
    this.currentTab = 'newCommission';
    this.formValidationCache = new Map();
  }

  // =================== 對外主要介面 ===================

  /**
   * 顯示 Modal 的主要方法（實作基類抽象方法）
   * @param {...any} args - 參數（不使用，保持介面一致性）
   */
  show(...args) {
    this.showCommissionModal();
  }

  /**
   * 顯示委託探索模態框
   */
  showCommissionModal() {
    return this._safeExecute(async () => {
      // 確保關閉其他模態框
      this.uiCore?.closeModal();

      // 設置委託模態框內容
      this._setCommissionModalContent();
      this._showModal('commissionModal');

      // 預設顯示發起委託頁籤
      this.switchCommissionTab('newCommission');

      systemLogger.info('顯示委託探索模態框');
    }, 'showCommissionModal');
  }

  /**
   * 顯示探索結算結果模態框
   * @param {Object} commission - 委託資訊
   * @param {Object} explorationResult - 探索結果物件
   */
  showExplorationResult(commission, explorationResult) {
    systemLogger.debug('modal|showExplorationResult - commission:', commission, 'explorationResult:', explorationResult)
    return this._safeExecute(async () => {
      // 確保關閉其他模態框
      this.uiCore?.closeModal();

      // 創建結算模態框內容
      this._setExplorationResultModalContent(commission, explorationResult);
      this._showModal('explorationResultModal');

      systemLogger.info('顯示探索結算模態框');
    }, 'showExplorationResult');
  }

  /**
   * 處理租客選擇
   * @param {string} tenantId - 租客ID
   */
  handleTenantSelection(tenantId) {
    return this._safeExecute(async () => {
      // 更新選擇狀態
      const tenantGrid = document.getElementById('tenantSelection');
      if (!tenantGrid) return;

      tenantGrid.querySelectorAll('.tenant-card').forEach(card => {
        const isSelected = card.getAttribute('data-tenant-id') === tenantId;
        card.classList.toggle('selected', isSelected);
      });

      // 更新預覽
      this._updateCommissionPreview();
    }, 'handleTenantSelection');
  }

  /**
   * 處理資源輸入變更
   * @param {Event} event - 輸入事件
   */
  handleResourceInputChange(event) {
    // 防抖處理
    clearTimeout(this.commissionPreviewTimer);
    this.commissionPreviewTimer = setTimeout(() => {
      this._updateCommissionPreview();
    }, 300);
  }

  /**
   * 處理委託表單提交
   * @param {Event} event - 表單事件
   */
  async handleCommissionFormSubmit(event) {
    event.preventDefault();

    return await this._safeExecute(async () => {
      // 先檢查是否選擇了租客
      const selectedTenant = document.querySelector('.tenant-card.selected');
      if (!selectedTenant) {
        this._showCommissionError('請先選擇要委託的租客');
        return;
      }

      const formData = this._getCommissionFormData();
      if (!formData) {
        this._showCommissionError('請填寫所有必要欄位');
        return;
      }

      const validation = this._validateCommissionFormData(formData);
      if (!validation.valid) {
        this._highlightCommissionErrors(validation.errors.map(error => error.message));
        return;
      }

      // 格式化為 TradeManager 的 API 格式
      const request = this._formatCommissionDataForAPI(formData);

      // 使用 TradeManager API 發送委託邀約
      await this._requestCommissionOffer(request);
    }, 'handleCommissionFormSubmit');
  }

  /**
   * 切換委託頁籤
   * @param {string} tabName - 頁籤名稱
   */
  switchCommissionTab(tabName) {
    return this._safeExecute(async () => {
      const validTabs = ['newCommission', 'activeCommissions', 'commissionHistory', 'commissionStats'];
      if (!validTabs.includes(tabName)) return;

      this.currentTab = tabName;

      // 更新頁籤按鈕狀態
      document.querySelectorAll('.commission-tabs .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
      });

      // 切換頁籤內容
      document.querySelectorAll('#commissionModal .tab-content').forEach(content => {
        const isTarget = content.id === `${tabName}Tab`;
        content.classList.toggle('active', isTarget);
      });

      // 切換操作區域
      document.querySelectorAll('#commissionModal .tab-actions').forEach(action => {
        const isNewCommissionForm = tabName === 'newCommission';
        const isNewCommissionAction = action.id === 'newCommissionAction';
        action.classList.toggle('active', isNewCommissionForm === isNewCommissionAction);
      });

      // 載入對應頁籤資料
      await this._loadTabContent(tabName);
    }, 'switchCommissionTab');
  }

  // =================== 私有 Modal 內容生成方法 ===================

  /**
   * 設定委託模態框內容
   * @private
   */
  _setCommissionModalContent() {
    // 初始化表單
    this._resetCommissionForm();

    // 清空並隱藏訊息容器
    const messagesContainer = document.getElementById('formMessages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
      messagesContainer.style.display = 'none';
    }

    // 生成租客選擇區域
    const tenantGrid = this._generateTenantSelectionGrid();
    this._updateElement('tenantSelection', tenantGrid);

    // 初始化其他頁籤為載入狀態
    const loadingHTML = '<div class="loading">載入中...</div>';
    this._updateElement('activeCommissionsList', loadingHTML);
    this._updateElement('commissionHistoryList', loadingHTML);
    this._updateElement('commissionStatsGrid', loadingHTML);
  }

  /**
   * 刷新租客選擇區域
   * @private
   */
  _refreshTenantSelectionGrid() {
    const tenantGrid = this._generateTenantSelectionGrid();
    this._updateElement('tenantSelection', tenantGrid);

    // 由於使用內聯 onclick 事件，HTML 重新生成時事件會自動重新綁定
  }

  /**
   * 生成租客選擇區域HTML
   * @returns {string} HTML字串
   * @private
   */
  _generateTenantSelectionGrid() {
    const allTenants = this.gameState.getAllTenants() || []

    if (allTenants.length === 0) {
      return '<div class="no-tenants">沒有可用的租客</div>';
    }

    const getSatisfactionEmoji = (satisfaction) => {
      if (satisfaction >= 80) return '😊';
      if (satisfaction >= 60) return '🙂';
      if (satisfaction >= 40) return '😐';
      if (satisfaction >= 20) return '☹️';
      return '😡';
    }

    const getTenantRiskTolerance = (tenantType) => {
      const toleranceMap = {
        'soldier': '高',
        'worker': '中',
        'farmer': '中',
        'doctor': '低',
        'elder': '低'
      };

      return toleranceMap[tenantType] || '未知';
    }

    return allTenants.map(tenant => {
      const satisfaction = tenant.satisfaction || 50;
      const typeIcon = this._getIcon(tenant.type, 'tenantHuman');
      const satisfactionEmoji = getSatisfactionEmoji(satisfaction)
      const riskTolerance = getTenantRiskTolerance(tenant.type);
      const isInjured = tenant.injured || false;
      const isOnMission = tenant.onMission || false;
      const isDisabled = isInjured || isOnMission;

      // 狀態指示器
      let statusIndicator = '';
      if (isInjured) {
        statusIndicator = '<span class="status-indicator injured">🩹 受傷</span>';
      } else if (isOnMission) {
        const missionType = tenant.missionType === 'commission' ? '委託' : '探索';
        statusIndicator = `<span class="status-indicator on-mission">🚩 ${missionType}中</span>`;
      }

      return `
        <div class="tenant-card ${isDisabled ? 'disabled' : ''}" data-tenant-id="${tenant.id}"
        ${isDisabled ? '' : `onclick="uiCore.handleTenantSelection('${tenant.id}')"`}>
          <div class="tenant-header">
            <span class="tenant-name">${typeIcon}${tenant.name}</span>
            ${statusIndicator}
          </div>
          <div class="tenant-info">
            <div class="tenant-satisfaction">滿意度：${satisfactionEmoji}${satisfaction}</div>
            <div class="tenant-type">${tenant.typeName || tenant.type} • 風險容忍：${riskTolerance}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 載入頁籤內容
   * @param {string} tabName - 頁籤名稱
   * @private
   */
  async _loadTabContent(tabName) {
    if (!this.gameApp?.tradeManager) return;

    try {
      switch (tabName) {
        case 'activeCommissions':
          const commissions = this.gameApp.tradeManager.getActiveCommissions();
          this._populateActiveCommissionsTab(commissions);
          break;
        case 'commissionHistory':
          const history = this.gameApp.tradeManager.getCommissionHistory();
          this._populateCommissionHistoryTab(history);
          break;
        case 'commissionStats':
          const stats = this.gameApp.tradeManager.getCommissionStats();
          this._populateCommissionStatsTab(stats);
          break;
      }
    } catch (error) {
      systemLogger.error(`載入 ${tabName} 頁籤內容失敗:`, error);
    }
  }

  /**
   * 填充活躍委託頁籤
   * @param {Array} commissions - 活躍委託列表
   * @private
   */
  _populateActiveCommissionsTab(commissions) {
    const activeCommissionsCount = commissions ? commissions.length : 0;

    if (!commissions || commissions.length === 0) {
      this._updateElement('activeCommissionsList', '<div class="empty-state">目前沒有活躍的委託任務</div>');
      this._updateTabCount('activeCommissions', 0);
      return;
    }

    const commissionsHTML = commissions.map(commission =>
      this._generateCommissionCard(commission, 'active')
    ).join('');

    this._updateElement('activeCommissionsList', commissionsHTML);
    this._updateTabCount('activeCommissions', activeCommissionsCount);
  }

  /**
   * 填充歷史記錄頁籤
   * @param {Array} history - 委託歷史
   * @private
   */
  _populateCommissionHistoryTab(history) {
    const commissionHistoryCount = history ? history.length : 0;

    if (!history || history.length === 0) {
      this._updateElement('commissionHistoryList', '<div class="empty-state">暫無委託歷史記錄</div>');
      this._updateTabCount('commissionHistory', 0);
      return;
    }

    // 只顯示最近20筆
    const recentHistory = history.slice(-20).reverse();

    const historyHTML = recentHistory.map(record => {
      const commission = record.offer;
      const result = record.result;
      return this._generateCommissionCard(commission, 'history', result);
    }).join('');

    this._updateElement('commissionHistoryList', historyHTML);
    this._updateTabCount('commissionHistory', commissionHistoryCount);
  }

  /**
   * 填充統計資訊頁籤
   * @param {Object} stats - 統計資料
   * @private
   */
  _populateCommissionStatsTab(stats) {
    const successRate = stats.totalCommissions > 0
      ? Math.round((stats.successfulCommissions / stats.totalCommissions) * 100)
      : 0;

    const rejectionRate = stats.totalCommissions > 0
      ? Math.round((stats.rejectedCommissions / stats.totalCommissions) * 100)
      : 0;

    const statsHTML = `
      <div class="stats-dashboard">
        <div class="stats-group core-stats">
          <div class="group-header">
            <div class="group-icon">📊</div>
            <div class="group-title">核心統計</div>
          </div>
          <div class="stats-list">
            <div class="stat-item">
              <span class="stat-label">活躍委託:</span>
              <span class="stat-value">${stats.activeCommissions || 0}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">總委託數:</span>
              <span class="stat-value">${stats.totalCommissions || 0}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">成功委託:</span>
              <span class="stat-value">${stats.successfulCommissions || 0}</span>
            </div>
          </div>
        </div>

        <div class="stats-group performance-stats">
          <div class="group-header">
            <div class="group-icon">📈</div>
            <div class="group-title">表現分析</div>
          </div>
          <div class="stats-list">
            <div class="stat-item">
              <span class="stat-label">成功率:</span>
              <span class="stat-value ${successRate >= 70 ? 'success' : successRate >= 50 ? 'warning' : 'danger'}">${successRate}%</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">拒絕率:</span>
              <span class="stat-value ${rejectionRate <= 30 ? 'success' : rejectionRate <= 50 ? 'warning' : 'danger'}">${rejectionRate}%</span>
            </div>
            <div class="stat-item overall-performance">
              <span class="stat-label">整體表現:</span>
              <span class="stat-value performance-badge ${this._getPerformanceClass(successRate, rejectionRate)}">
                ${this._getPerformanceText(successRate, rejectionRate)}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;

    this._updateElement('commissionStatsGrid', statsHTML);
  }

  /**
   * 生成委託卡片HTML
   * @param {Object} commission - 委託物件
   * @param {string} type - 卡片類型
   * @param {Object} result - 結果物件（可選）
   * @returns {string} HTML字串
   * @private
   */
  _generateCommissionCard(commission, type, result = null) {
    const tenant = this.gameApp.gameState?.findPersonById(commission.tenantId);
    const status = this._getCommissionStatusText(commission.status);
    const resourceIcon = this._getIcon(commission.resourceType, 'resource');
    const resourceName = this._getResourceName(commission.resourceType);

    // 計算天數資訊
    let dayInfoHTML = '';
    if (type === 'active' && commission.explorationDays && commission.expectedCompletionDay) {
      const currentDay = this.gameApp.gameState?.getStateValue('day', 1) || 1;
      const startDay = commission.expectedCompletionDay - commission.explorationDays + 1;
      const daysRemaining = commission.expectedCompletionDay - currentDay;

      dayInfoHTML = `
        <div class="day-info">
          <span class="day-info-item">🗓️ 第 ${startDay} 天出發</span>
          <span class="day-info-item">⏰ 預計第 ${commission.expectedCompletionDay} 天回來</span>
          ${daysRemaining > 0 ? `<span class="day-info-item remaining">剩餘 ${daysRemaining} 天</span>` :
            daysRemaining === 0 ? `<span class="day-info-item completed">今日完成</span>` :
            `<span class="day-info-item overdue">已逾期 ${Math.abs(daysRemaining)} 天</span>`}
        </div>
      `;
    } else if (type === 'history' && result?.recordedAt) {
      const recordedDate = new Date(result.recordedAt);
      const recordedDay = Math.floor((recordedDate.getTime() - new Date('2023-01-01').getTime()) / (1000 * 60 * 60 * 24)) + 1;
      dayInfoHTML = `
        <div class="day-info">
          <span class="day-info-item">📅 第 ${recordedDay} 天記錄</span>
        </div>
      `;
    }

    let resultHTML = '';
    if (result && type === 'history') {
      if (result.success) {
        // 顯示成功結果和實際獲得的資源
        const obtainedResources = this._formatObtainedResources(result.resourcesObtained);
        const targetFulfillment = result.contractFulfillment || 0;
        const targetResource = commission.resourceType;
        const targetAmount = commission.targetAmount;
        const fulfillmentRate = Math.round((targetFulfillment / targetAmount) * 100);

        // 檢查是否有退還的報酬
        const refundHTML = result.refundedPayment ?
          `<div class="refunded-payment">退還: ${this._formatRefundedPayment(result.refundedPayment)}</div>` : '';

        resultHTML = `
          <div class="commission-result success">
            <div class="result-header">
              <span class="result-label">✅ 探索成功</span>
              <span class="fulfillment-rate">${fulfillmentRate}% 完成度</span>
            </div>
            <div class="result-details">
              <div class="target-completion">
                目標: ${this._getIcon(targetResource, 'resource')} ${targetFulfillment}/${targetAmount} ${this._getResourceName(targetResource)}
              </div>
              ${obtainedResources ? `<div class="obtained-resources">獲得: ${obtainedResources}</div>` : ''}
              ${refundHTML}
            </div>
          </div>
        `;
      } else {
        resultHTML = `
          <div class="commission-result failure">
            <span class="result-label">❌ 探索失敗</span>
            <span class="result-details">未能獲得任何資源</span>
          </div>
        `;
      }
    }

    // 生成每日收穫歷史（僅限歷史記錄且有每日結果）
    let dailyHistoryHTML = '';
    if (type === 'history' && result?.dailyResults && result.dailyResults.length > 0) {
      const dailyResults = result.dailyResults;
      const cardId = `commission-${commission.requestId || commission.id || Date.now()}`;

      dailyHistoryHTML = `
        <div class="daily-history-section">
          <button class="daily-history-toggle" onclick="this.parentElement.classList.toggle('expanded')">
            <span class="toggle-text">📅 每日收穫詳情</span>
            <span class="toggle-icon">▼</span>
          </button>
          <div class="daily-history-content">
            ${dailyResults.map(dayResult => `
              <div class="daily-history-item">
                <div class="daily-header">
                  <span class="day-number">第 ${dayResult.day} 天</span>
                  <span class="daily-date">${new Date(dayResult.date).toLocaleDateString()}</span>
                </div>
                <div class="daily-rewards">
                  ${Object.entries(dayResult.rewards || {})
                    .map(([type, amount]) =>
                      `<span class="daily-reward-item">${this.uiCore.getIcon(type, 'resource')} +${amount}</span>`
                    ).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="commission-card ${status.class}">
        <div class="commission-header">
          <div class="commission-title">
            ${tenant?.name || '未知租客'} - ${resourceIcon} ${resourceName} x${commission.targetAmount}
          </div>
          <div class="commission-status ${status.class}">${status.text}</div>
        </div>
        <div class="commission-details">
          ${dayInfoHTML}
          <div class="commission-rewards">
            <div class="reward-item">
              <span class="reward-label">基礎報酬:</span>
              <span class="reward-value">${this._formatRewardText(commission.basePayment)}</span>
            </div>
            <div class="reward-item">
              <span class="reward-label">佣金:</span>
              <span class="reward-value">${this._formatRewardText(commission.commission)}</span>
            </div>
          </div>
          ${resultHTML}
          ${dailyHistoryHTML}
        </div>
      </div>
    `;
  }

  // =================== 表單處理方法 ===================

  /**
   * 重置委託表單
   * @private
   */
  _resetCommissionForm() {
    const form = document.getElementById('commissionForm');
    if (!form) return;

    // 重置表單值
    /** @type {HTMLFormElement} */(form).reset();

    // 重置租客選擇
    document.querySelectorAll('.tenant-card').forEach(card => {
      card.classList.remove('selected');
    });

    // 隱藏預覽
    const preview = document.getElementById('commissionPreview');
    const formMessages = document.getElementById('formMessages');
    if (preview) preview.style.display = 'none';
    if (formMessages) formMessages.style.display = 'none';

    // 清空訊息
    this._updateElement('formMessages', '');

    // 清除驗證快取
    this.formValidationCache.clear();
  }

  /**
   * 獲取委託表單資料
   * @returns {Object|null} 表單資料
   * @private
   */
  _getCommissionFormData() {
    const selectedTenant = document.querySelector('.tenant-card.selected')?.getAttribute('data-tenant-id');
    const targetResource = /** @type {HTMLSelectElement} */(document.getElementById('targetResource'))?.value;
    const targetAmount = /** @type {HTMLInputElement} */(document.getElementById('targetAmount'))?.value;

    if (!selectedTenant || !targetResource || !targetAmount) {
      return null;
    }

    return {
      selectedTenant: parseInt(selectedTenant),
      targetResource,
      targetAmount: parseInt(targetAmount),
      basePayment: {
        cash: parseInt(/** @type {HTMLInputElement} */(document.getElementById('basePaymentCash'))?.value || '0'),
        food: parseInt(/** @type {HTMLInputElement} */(document.getElementById('basePaymentFood'))?.value || '0'),
        materials: parseInt(/** @type {HTMLInputElement} */(document.getElementById('basePaymentMaterials'))?.value || '0'),
        medical: parseInt(/** @type {HTMLInputElement} */(document.getElementById('basePaymentMedical'))?.value || '0'),
        fuel: parseInt(/** @type {HTMLInputElement} */(document.getElementById('basePaymentFuel'))?.value || '0')
      },
      commission: {
        cash: parseInt(/** @type {HTMLInputElement} */(document.getElementById('commissionCash'))?.value || '0'),
        food: parseInt(/** @type {HTMLInputElement} */(document.getElementById('commissionFood'))?.value || '0'),
        materials: parseInt(/** @type {HTMLInputElement} */(document.getElementById('commissionMaterials'))?.value || '0'),
        medical: parseInt(/** @type {HTMLInputElement} */(document.getElementById('commissionMedical'))?.value || '0'),
        fuel: parseInt(/** @type {HTMLInputElement} */(document.getElementById('commissionFuel'))?.value || '0')
      }
    };
  }

  /**
   * 驗證委託表單資料
   * @param {Object} formData - 表單資料
   * @returns {Object} 驗證結果
   * @private
   */
  _validateCommissionFormData(formData) {
    const errors = [];

    if (!formData) {
      errors.push({ field: 'general', message: '請填寫所有必要欄位' });
      return { valid: false, errors };
    }

    if (!formData.selectedTenant) {
      errors.push({ field: 'tenant', message: '請先選擇要委託的租客' });
    }

    if (!formData.targetResource) {
      errors.push({ field: 'resource', message: '請選擇目標資源' });
    }

    if (!formData.targetAmount || formData.targetAmount <= 0) {
      errors.push({ field: 'amount', message: '請輸入有效的目標數量' });
    }

    // 檢查是否至少有一項報酬
    const hasBasePayment = Object.values(formData.basePayment || {}).some(val => val > 0);
    const hasCommission = Object.values(formData.commission || {}).some(val => val > 0);

    if (!hasBasePayment && !hasCommission) {
      errors.push({ field: 'payment', message: '請設定基礎報酬或佣金' });
    }

    return { valid: errors.length === 0, errors };
  }

  // =================== 業務邏輯委託方法 ===================

  /**
   * 更新委託預覽
   * @private
   */
  _updateCommissionPreview() {
    const formData = this._getCommissionFormData();

    // 總是更新市場評估，無論是否選擇了租客
    this._updateMarketEvaluation(formData);

    if (!formData || !formData.selectedTenant) {
      // 隱藏預覽
      const preview = document.getElementById('commissionPreview');
      if (preview) preview.style.display = 'none';
      return;
    }

    // 計算預覽資料
    const previewData = this._calculateCommissionPreview(formData);

    // 更新預覽顯示
    if (previewData) {
      this._displayCommissionPreview(previewData);
    }
  }

  /**
   * 計算委託預覽資料
   * @param {Object} formData - 表單資料
   * @returns {Object|null} 預覽資料
   * @private
   */
  _calculateCommissionPreview(formData) {
    if (!formData?.selectedTenant) return null;

    // 取得租客資訊
    const tenant = this.gameApp.gameState?.findPersonById(formData.selectedTenant);
    if (!tenant) return null;

    // 委託 TradeManager 進行業務計算
    const businessResults = this._delegateToTradeManager(formData, tenant);
    if (!businessResults) return null;

    // 計算探索天數（調用 ExplorationManager 的方法）
    const explorationDays = this._calculateExplorationDays(formData, businessResults.possiblePartner);
    const currentDay = this.gameApp.gameState?.getStateValue('day') || 1;
    const expectedCompletionDay = currentDay + explorationDays;

    // 返回格式化的預覽資料
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
      refusalReason: businessResults.refusalReason,
      possiblePartner: businessResults.possiblePartner ? {
        id: businessResults.possiblePartner.id,
        name: businessResults.possiblePartner.name,
        type: businessResults.possiblePartner.type,
        typeName: businessResults.possiblePartner.typeName || businessResults.possiblePartner.type
      } : null,
      explorationDays: explorationDays,
      expectedCompletionDay: expectedCompletionDay,
      resourceIcon: this._getIcon(formData.targetResource, 'resource'),
      resourceName: this._getResourceName(formData.targetResource),
      tenantIcon: this._getIcon(tenant.type, 'tenantHuman'),
      partnerIcon: businessResults.possiblePartner ? this._getIcon(businessResults.possiblePartner.type, 'tenantHuman') : null,
      probabilityClass: this._getProbabilityClass(Math.round(businessResults.acceptanceProbability * 100))
    };
  }

  /**
   * 計算探索天數（調用 ExplorationManager）
   * @param {Object} formData - 表單資料
   * @param {Object|null} possiblePartner - 可能的組隊夥伴
   * @returns {number} 探索天數
   * @private
   */
  _calculateExplorationDays(formData, possiblePartner) {
    const explorationManager = this.gameApp.tradeManager?.explorationManager;
    if (!explorationManager) {
      // 如果 ExplorationManager 不可用，使用預設值
      return 1;
    }

    // 構建探索請求物件
    const participants = [{ id: 'temp' }]; // 臨時參與者
    if (possiblePartner) {
      participants.push({ id: 'temp_partner' });
    }

    const explorationRequest = {
      resourceType: formData.targetResource,
      targetAmount: formData.targetAmount,
      participants: participants
    };

    try {
      return explorationManager.calculateExplorationDays(explorationRequest);
    } catch (error) {
      systemLogger.error('計算探索天數失敗:', error);
      return 1; // 預設值
    }
  }

  /**
   * 委託 TradeManager 進行業務邏輯計算
   * @param {Object} formData - 表單資料
   * @param {Object} tenant - 租客物件
   * @returns {Object|null} 業務計算結果
   * @private
   */
  _delegateToTradeManager(formData, tenant) {
    const tradeManager = this.gameApp.tradeManager;
    if (!tradeManager?.commissionHandler) {
      systemLogger.error('TradeManager.commissionHandler 不可用');
      return null;
    }

    const commissionHandler = tradeManager.commissionHandler;

    try {
      // 檢查租客可用性
      const availability = commissionHandler._checkTenantAvailability(tenant.id);
      if (!availability?.available) {
        systemLogger.warn(`租客不可用: ${availability?.reason || '未知原因'}`);
        return { acceptanceProbability: 0, possiblePartner: null };
      }

      // 評估組隊可能性
      const possiblePartner = commissionHandler._evaluateTeamFormation(tenant.id);

      // 構建臨時委託邀約
      const temporaryOffer = {
        tenantId: tenant.id,
        resourceType: formData.targetResource,
        targetAmount: parseInt(formData.targetAmount),
        basePayment: this._normalizePayment(formData.basePayment),
        commission: this._normalizePayment(formData.commission),
        partnerId: possiblePartner?.id || null
      };

      // 計算接受機率
      const acceptance = commissionHandler._calculateAcceptanceProbability(temporaryOffer);

      if (!acceptance || typeof acceptance.probability !== 'number') {
        systemLogger.error('業務系統返回無效的接受機率');
        return null;
      }

      return {
        acceptanceProbability: acceptance.probability,
        marketEvaluation: acceptance.marketEvaluation,
        refusalReason: acceptance.refusalReason,
        possiblePartner
      };

    } catch (error) {
      systemLogger.error('委託業務系統計算失敗:', error);
      return null;
    }
  }

  /**
   * 發送委託邀約請求
   * @param {Object} request - 委託請求
   * @private
   */
  async _requestCommissionOffer(request) {
    if (!this.gameApp?.tradeManager) {
      this._showCommissionError('交易系統未初始化');
      return;
    }

    try {
      const submitBtn = document.getElementById('submitCommission');
      if (submitBtn) /** @type {HTMLButtonElement} */(submitBtn).disabled = true;

      const result = await this.gameApp.tradeManager.offerCommission(request);

      if (result.success) {
        // 處理新的探索啟動結果
        if (result.explorationDays && result.expectedCompletionDay) {
          this._showCommissionSuccess(
            `委託邀約已發送！租客已接受任務並出發探索，預計 ${result.explorationDays} 天後返回（第 ${result.expectedCompletionDay} 天）。`
          );
        } else {
          this._showCommissionSuccess('委託邀約已發送！租客已接受任務。');
        }

        // 立即刷新租客選擇區域以反映租客狀態變化
        this._refreshTenantSelectionGrid();

        this._resetCommissionForm();

        // 切換到活躍委託頁籤
        setTimeout(() => {
          this.switchCommissionTab('activeCommissions');
        }, 1500);
      } else {
        const reason = result.reason || '委託被拒絕';
        this._showCommissionError(`委託失敗：${reason}`);
      }
    } catch (error) {
      systemLogger.error('委託邀約失敗:', error);
      this._showCommissionError('發送委託時發生錯誤');
    } finally {
      const submitBtn = document.getElementById('submitCommission');
      if (submitBtn) /** @type {HTMLButtonElement} */(submitBtn).disabled = false;
    }
  }

  /**
   * 更新市場價格評估顯示
   * @param {Object|null} formData - 表單資料
   * @private
   */
  _updateMarketEvaluation(formData) {
    const evaluationDiv = document.getElementById('marketEvaluation');
    if (!evaluationDiv) return;

    // 取得基本的表單資料來判斷是否顯示評估
    const targetResource = /** @type {HTMLInputElement}*/(document.getElementById('targetResource'))?.value;
    const targetAmount = /** @type {HTMLInputElement}*/(document.getElementById('targetAmount'))?.value;

    // 如果沒有基本的目標資訊，隱藏評估
    if (!targetResource || !targetAmount || parseInt(targetAmount) <= 0) {
      evaluationDiv.style.display = 'none';
      return;
    }

    // 顯示評估區域
    evaluationDiv.style.display = 'block';

    // 構建評估用的資料（不需要選擇租客）
    const evaluationData = {
      targetResource,
      targetAmount: parseInt(targetAmount),
      basePayment: this._getFormPayment('basePayment'),
      commission: this._getFormPayment('commission')
    };

    // 計算市場評估
    const marketEval = this._calculateMarketEvaluation(evaluationData);

    // 更新顯示內容
    this._displayMarketEvaluation(marketEval);
  }

  /**
   * 計算市場評估資料
   * @param {Object} formData - 表單資料
   * @returns {Object} 市場評估結果
   * @private
   */
  _calculateMarketEvaluation(formData) {
    // 直接調用 CommissionHandler 的市場評估邏輯
    const tradeManager = this.gameApp.tradeManager;
    if (!tradeManager?.commissionHandler) {
      return this._getDefaultMarketEvaluation();
    }

    try {
      // 構建臨時委託邀約用於評估
      const temporaryOffer = {
        resourceType: formData.targetResource,
        targetAmount: parseInt(formData.targetAmount),
        basePayment: this._normalizePayment(formData.basePayment),
        commission: this._normalizePayment(formData.commission)
      };

      // 調用 CommissionHandler 的市場評估方法
      const marketEval = tradeManager.commissionHandler._evaluateMarketFairness(temporaryOffer);

      return {
        ...marketEval,
        resourceName: this._getResourceName(formData.targetResource)
      };

    } catch (error) {
      systemLogger.error('市場評估計算失敗:', error);
      return this._getDefaultMarketEvaluation();
    }
  }

  /**
   * 顯示市場評估結果
   * @param {Object} marketEval - 市場評估資料
   * @private
   */
  _displayMarketEvaluation(marketEval) {
    // 更新數值顯示
    this._updateElement('targetValue', `${marketEval.targetValue.toFixed(1)} 💰`);
    this._updateElement('rewardValue', `${marketEval.rewardValue.toFixed(1)} 💰`);

    // 更新價格比例
    const ratioElement = document.getElementById('fairnessRatio');
    if (ratioElement) {
      ratioElement.textContent = `${marketEval.fairnessRatio.toFixed(2)}x`;
      ratioElement.className = `eval-ratio ${marketEval.evaluation}`;
    }

    // 更新評估狀態文字
    const statusElement = document.getElementById('evaluationText');
    if (statusElement) {
      const statusText = this._getEvaluationStatusText(marketEval.evaluation);
      statusElement.textContent = statusText;
      statusElement.className = `status-text ${marketEval.evaluation}`;
    }
  }

  /**
   * 獲取預設市場評估
   * @returns {Object} 預設評估結果
   * @private
   */
  _getDefaultMarketEvaluation() {
    return {
      factor: 0,
      evaluation: 'neutral',
      fairnessRatio: 0,
      targetValue: 0,
      rewardValue: 0,
      resourceName: '未知'
    };
  }

  /**
   * 獲取評估狀態文字
   * @param {string} evaluation - 評估等級
   * @returns {string} 狀態文字
   * @private
   */
  _getEvaluationStatusText(evaluation) {
    const statusTexts = {
      insulting: '💢 侮辱性報酬！',
      generous: '💰 報酬豐厚！',
      fair_plus: '✅ 報酬合理偏高',
      fair: '⚖️ 報酬公平合理',
      underpaid: '⚠️ 報酬偏低',
      exploitative: '❌ 報酬過低！',
      neutral: '請設定委託條件'
    };

    return statusTexts[evaluation] || '未知狀態';
  }

  /**
   * 從表單獲取支付資料
   * @param {string} paymentType - 支付類型 ('basePayment' 或 'commission')
   * @returns {Object} 支付物件
   * @private
   */
  _getFormPayment(paymentType) {
    const payment = {};
    const resources = ['cash', 'food', 'materials', 'medical', 'fuel'];

    resources.forEach(resource => {
      const elementId = `${paymentType}${resource.charAt(0).toUpperCase() + resource.slice(1)}`;
      const element = document.getElementById(elementId);
      payment[resource] = parseInt(/** @type {HTMLInputElement}*/(element)?.value || '0') || 0;
    });

    return payment;
  }

  // =================== 輔助方法 ===================

  /**
   * 更新頁籤計數顯示
   * @param {string} tabName - 頁籤名稱
   * @param {number} count - 計數
   * @private
   */
  _updateTabCount(tabName, count) {
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (!tabButton) return;

    // 移除現有的計數標記
    const existingBadge = tabButton.querySelector('.tab-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    // 只在計數大於0時顯示標記
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'tab-badge';
      badge.textContent = `(${count.toString()})`;
      tabButton.appendChild(badge);
    }
  }

  /**
   * 獲取整體表現等級的 CSS 類別
   * @param {number} successRate - 成功率
   * @param {number} rejectionRate - 拒絕率
   * @returns {string} CSS 類別名稱
   * @private
   */
  _getPerformanceClass(successRate, rejectionRate) {
    if (successRate >= 80 && rejectionRate <= 20) return 'excellent';
    if (successRate >= 60 && rejectionRate <= 40) return 'good';
    if (successRate >= 40 && rejectionRate <= 60) return 'average';
    return 'poor';
  }

  /**
   * 獲取整體表現文字描述
   * @param {number} successRate - 成功率
   * @param {number} rejectionRate - 拒絕率
   * @returns {string} 表現描述
   * @private
   */
  _getPerformanceText(successRate, rejectionRate) {
    if (successRate >= 80 && rejectionRate <= 20) return '優秀 🌟';
    if (successRate >= 60 && rejectionRate <= 40) return '良好 👍';
    if (successRate >= 40 && rejectionRate <= 60) return '普通 😐';
    return '需要改進 📉';
  }

  /**
   * 顯示委託預覽
   * @param {Object} previewData - 預覽資料
   * @private
   */
  _displayCommissionPreview(previewData) {
    const preview = document.getElementById('commissionPreview');
    if (!preview) return;

    // 總是顯示拒絕原因（如果有的話），讓玩家了解潛在問題
    const showRefusalReason = previewData.refusalReason && previewData.refusalReason.trim() !== '';

    const previewHTML = `
      <div class="preview-item">
        <strong>目標：</strong> ${previewData.resourceIcon}獲取 ${previewData.targetAmount} 單位${previewData.resourceName}
      </div>
      <div class="preview-item">
        <strong>委託對象：</strong> ${previewData.tenantIcon}${previewData.tenant.name} (${previewData.tenant.typeName})
      </div>
      <div class="preview-item">
        <strong>探索天數：</strong> ${previewData.explorationDays} 天 (第 ${previewData.expectedCompletionDay} 天完成)
      </div>
      <div class="preview-item">
        <strong>預估接受機率：</strong>
        <span class="probability ${previewData.probabilityClass}">
          ${previewData.acceptanceProbability}%
        </span>
      </div>
      ${showRefusalReason ? `
        <div class="preview-item ${previewData.acceptanceProbability < 60 ? 'warning' : 'info'}">
          <strong>${previewData.acceptanceProbability < 60 ? '⚠️ 可能拒絕原因' : 'ℹ️ 接受考量因素'}：</strong> ${previewData.refusalReason}
        </div>
      ` : ''}
      ${previewData.possiblePartner ? `
        <div class="preview-item">
          <strong>組隊夥伴：</strong> ${previewData.partnerIcon} ${previewData.possiblePartner.name} (${previewData.possiblePartner.typeName})
        </div>
      ` : ''}
    `;

    preview.innerHTML = previewHTML;
    preview.style.display = 'block';
  }

  /**
   * 格式化委託資料為API格式
   * @param {Object} formData - 表單資料
   * @returns {Object} API請求格式
   * @private
   */
  _formatCommissionDataForAPI(formData) {
    return {
      tenantId: formData.selectedTenant,
      resourceType: formData.targetResource,
      targetAmount: parseInt(formData.targetAmount),
      basePayment: this._normalizePayment(formData.basePayment),
      commission: this._normalizePayment(formData.commission)
    };
  }

  /**
   * 格式化報酬文字
   * @param {Object} reward - 報酬物件
   * @returns {string} 格式化文字
   * @private
   */
  _formatRewardText(reward) {
    const items = [];

    for (const [resource, amount] of Object.entries(reward)) {
      if (amount > 0) {
        const icon = this._getIcon(resource, 'resource');
        const name = this._getResourceName(resource);
        items.push(`${icon} ${name} x${amount}`);
      }
    }

    return items.length > 0 ? items.join(', ') : '無';
  }

  /**
   * 獲取委託狀態文字
   * @param {string} status - 狀態代碼
   * @returns {Object} 狀態資訊
   * @private
   */
  _getCommissionStatusText(status) {
    const statusMap = {
      offered: { text: '邀約中', class: 'status-pending' },
      accepted: { text: '已接受', class: 'status-active' },
      ongoing: { text: '探索中', class: 'status-exploring' },
      rejected: { text: '已拒絕', class: 'status-rejected' },
      exploring: { text: '探索中', class: 'status-exploring' },
      completed: { text: '已完成', class: 'status-success' },
      failed: { text: '失敗', class: 'status-failed' }
    };

    return statusMap[status] || { text: '未知', class: 'status-unknown' };
  }

  /**
   * 正規化支付物件
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
   * 格式化獲得的資源列表
   * @param {Object} resourcesObtained - 獲得的資源物件
   * @returns {string} 格式化的資源文字
   * @private
   */
  _formatObtainedResources(resourcesObtained) {
    if (!resourcesObtained) return '';

    const items = [];
    for (const [resource, amount] of Object.entries(resourcesObtained)) {
      if (amount > 0) {
        const icon = this._getIcon(resource, 'resource');
        const name = this._getResourceName(resource);
        items.push(`${icon} ${name} x${amount}`);
      }
    }

    return items.length > 0 ? items.join(', ') : '';
  }

  /**
   * 格式化退還的報酬列表
   * @param {Object} refundedPayment - 退還的報酬物件
   * @returns {string} 格式化的退還文字
   * @private
   */
  _formatRefundedPayment(refundedPayment) {
    if (!refundedPayment) return '';

    const items = [];
    for (const [resource, amount] of Object.entries(refundedPayment)) {
      if (amount > 0) {
        const icon = this._getIcon(resource, 'resource');
        const name = this._getResourceName(resource);
        items.push(`${icon} ${name} x${amount}`);
      }
    }

    return items.length > 0 ? items.join(', ') : '';
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

  // =================== 使用者介面回饋方法 ===================

  /**
   * 顯示委託成功訊息
   * @param {string} message - 成功訊息
   * @private
   */
  _showCommissionSuccess(message) {
    this._addCommissionMessage(message, 'success');
  }

  /**
   * 顯示委託錯誤訊息
   * @param {string} message - 錯誤訊息
   * @private
   */
  _showCommissionError(message) {
    this._addCommissionMessage(message, 'error');
  }

  /**
   * 新增委託訊息
   * @param {string} message - 訊息內容
   * @param {string} type - 訊息類型
   * @private
   */
  _addCommissionMessage(message, type = 'info') {
    const messageData = {
      message: message,
      type: type,
      timestamp: Date.now(),
      id: `commission_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const messagesContainer = document.getElementById('formMessages');
    if (messagesContainer) {
      const messageElement = document.createElement('div');
      messageElement.className = `message message-${type}`;
      messageElement.textContent = message;

      messagesContainer.appendChild(messageElement);

      // 確保訊息容器可見
      messagesContainer.style.display = 'block';

      // 自動清除訊息
      setTimeout(() => {
        if (messageElement.parentNode) {
          messageElement.parentNode.removeChild(messageElement);
          // 檢查是否還有其他訊息，如果沒有就隱藏容器
          if (messagesContainer.children.length === 0) {
            messagesContainer.style.display = 'none';
          }
        }
      }, 5000);
    }
  }

  /**
   * 高亮委託錯誤
   * @param {Array} errors - 錯誤列表
   * @private
   */
  _highlightCommissionErrors(errors) {
    errors.forEach(error => {
      this._showCommissionError(error);
    });
  }

  // =================== 狀態管理方法 ===================

  /**
   * 檢查委託模態框是否當前活動
   * @returns {boolean} 是否活動
   */
  isCommissionModalActive() {
    const modal = document.getElementById('commissionModal');
    return modal && modal.style.display === 'flex';
  }

  /**
   * 獲取當前頁籤
   * @returns {string} 當前頁籤名稱
   */
  getCurrentTab() {
    return this.currentTab;
  }

  /**
   * 設置探索結算模態框內容
   * @param {Object} commission - 委託資訊
   * @param {Object} explorationResult - 探索結果物件
   * @private
   */
  _setExplorationResultModalContent(commission, explorationResult) {
    // 獲取已存在的模態框內容區域
    const contentElement = document.getElementById('explorationResultContent');
    if (!contentElement) {
      systemLogger.error('找不到探索結算模態框內容元素');
      return;
    }

    // 只設置內容，而不是整個模態框結構
    contentElement.innerHTML = this._generateExplorationResultContent(commission, explorationResult);
  }

  /**
   * 生成探索結算內容
   * @param {Object} commission - 委託資訊
   * @param {Object} explorationResult - 探索結果
   * @private
   * @returns {string} HTML 內容
   */
  _generateExplorationResultContent(commission, explorationResult) {
    const resourceIcon = this._getIcon(commission.resourceType, 'resource');
    const resourceName = this._getResourceName(commission.resourceType);
    const isCommission = explorationResult.type === 'commission';

    return `
      <!-- 探索任務概覽 -->
      <div class="commission-overview">
        <h3>📋 ${isCommission ? '委託任務' : '自主探索'}</h3>
        <div class="commission-details">
          <div class="commission-title">
            ${resourceIcon} 目標：${commission.targetAmount} ${resourceName}
          </div>
          ${isCommission ? `
          <div class="commission-rewards">
            <div class="reward-item">
              <span class="reward-label">基礎報酬:</span>
              <span class="reward-value">${this._formatRewardText(commission.basePayment || {})}</span>
            </div>
            <div class="reward-item">
              <span class="reward-label">佣金:</span>
              <span class="reward-value">${this._formatRewardText(commission.commission || {})}</span>
            </div>
          </div>
          ` : `
          <div class="commission-rewards">
            <div class="reward-item">
              <span class="reward-label">探索動機:</span>
              <span class="reward-value">資源短缺，自發性探索</span>
            </div>
          </div>
          `}
        </div>
      </div>

      <!-- 基本資訊 -->
      <div class="exploration-summary">
        <h3>📋 探索結果</h3>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="label">探索ID:</span>
            <span class="value">${explorationResult.requestId || 'N/A'}</span>
          </div>
          <div class="summary-item">
            <span class="label">結果:</span>
            <span class="value ${explorationResult.success ? 'success' : 'failure'}">
              ${explorationResult.success ? '✅ 成功' : '❌ 失敗'}
            </span>
          </div>
          <div class="summary-item">
            <span class="label">目標達成度:</span>
            <span class="value">${explorationResult.contractFulfillment || 0} / ${commission.targetAmount}</span>
          </div>
        </div>
      </div>

      <!-- 每日收穫詳情 -->
      ${this._generateDailyResultsSection(explorationResult)}

      <!-- 總收穫統計 -->
      ${this._generateTotalRewardsSection(commission, explorationResult)}

      <!-- 委託結算（僅委託探索顯示） -->
      ${isCommission && explorationResult.refundedPayment ? `
        <div class="commission-settlement">
          <h3>💰 委託結算</h3>
          <div class="settlement-details">
            <div class="refunded-payment">
              <span class="label">退還報酬:</span>
              <span class="value">${this._formatRewardText(explorationResult.refundedPayment)}</span>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- 參與者狀況 -->
      ${this._generateParticipantsSection(explorationResult)}
    `;
  }

  /**
   * 生成每日收穫詳情區塊（重用現有 API）
   * @param {Object} explorationResult - 探索結果
   * @private
   * @returns {string} HTML 內容
   */
  _generateDailyResultsSection(explorationResult) {
    const dailyResults = explorationResult.dailyResults || [];
    if (dailyResults.length === 0) {
      return ''; // 無每日記錄時直接隱藏整個區塊
    }

    const dailyHTML = dailyResults.map(dayResult => `
      <div class="daily-item">
        <div class="daily-header">
          <span class="day-number">第 ${dayResult.day} 天</span>
        </div>
        <div class="daily-rewards">
          ${Object.entries(dayResult.rewards || {})
            .map(([type, amount]) =>
              `<span class="reward-item">${this.uiCore.getIcon(type, 'resource')} ${amount}</span>`
            ).join('')}
        </div>
      </div>
    `).join('');

    return `
      <div class="daily-results">
        <h3>📅 每日探索過程</h3>
        <div class="daily-list">
          ${dailyHTML}
        </div>
      </div>
    `;
  }

  /**
   * 生成總收穫統計區塊（重用現有格式化方法）
   * @param {Object} commission - 委託資訊
   * @param {Object} explorationResult - 探索結果
   * @private
   * @returns {string} HTML 內容
   */
  _generateTotalRewardsSection(commission, explorationResult) {
    const totalRewards = explorationResult.resourcesObtained || {};
    const isCommission = explorationResult.type === 'commission';
    
    if (Object.keys(totalRewards).length === 0) {
      return `
        <div class="total-rewards">
          <h3>💰 ${isCommission ? '委託收穫統計' : '探索收穫統計'}</h3>
          <p class="no-data">此次${isCommission ? '委託' : '探索'}無資源收穫</p>
        </div>
      `;
    }

    // 重用現有的資源格式化方法
    const obtainedResources = this._formatObtainedResources(totalRewards);

    return `
      <div class="total-rewards">
        <h3>💰 ${isCommission ? '委託收穫統計' : '探索收穫統計'}</h3>
        <div class="rewards-display">
          ${obtainedResources}
        </div>
        ${explorationResult.contractFulfillment && isCommission ? `
          <div class="contract-info">
            <p><strong>目標達成度:</strong> ${explorationResult.contractFulfillment} / ${commission.targetAmount || 'N/A'}</p>
            ${explorationResult.surplus ? `<p><strong>超額收穫:</strong> +${explorationResult.surplus}</p>` : ''}
          </div>
        ` : ''}
        ${!isCommission && explorationResult.surplus ? `
          <div class="exploration-info">
            <p><strong>探索成果:</strong> 成功獲得 ${explorationResult.surplus || Object.values(totalRewards).reduce((sum, val) => sum + val, 0)} 單位資源</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 生成參與者狀況區塊
   * @param {Object} explorationResult - 探索結果
   * @private
   * @returns {string} HTML 內容
   */
  _generateParticipantsSection(explorationResult) {
    const participants = explorationResult.participants || [];
    if (participants.length === 0) {
      return `
        <div class="participants">
          <h3>👥 參與者狀況</h3>
          <p class="no-data">無參與者資訊</p>
        </div>
      `;
    }

    const participantsHTML = participants.map(participant => `
      <div class="participant-item">
        <div class="participant-header">
          <span class="participant-name">${participant.name || participant.id}</span>
          <span class="participant-status ${participant.injured ? 'injured' : 'healthy'}">
            ${participant.injured ? '🤕 受傷' : '😊 健康'}
          </span>
        </div>
        ${participant.personalRewards && Object.keys(participant.personalRewards).length > 0 ? `
          <div class="participant-rewards">
            <strong>個人收穫:</strong>
            ${Object.entries(participant.personalRewards)
              .map(([type, amount]) => `${this.uiCore.getIcon(type, 'resource')} ${amount}`)
              .join(', ')}
          </div>
        ` : ''}
      </div>
    `).join('');

    return `
      <div class="participants">
        <h3>👥 參與者狀況</h3>
        <div class="participants-list">
          ${participantsHTML}
        </div>
      </div>
    `;
  }

  /**
   * 清理資源
   */
  cleanup() {
    if (this.commissionPreviewTimer) {
      clearTimeout(this.commissionPreviewTimer);
      this.commissionPreviewTimer = null;
    }
    this.formValidationCache.clear();
  }

  /**
   * 銷毀時的清理工作
   */
  destroy() {
    this.cleanup();
  }
}
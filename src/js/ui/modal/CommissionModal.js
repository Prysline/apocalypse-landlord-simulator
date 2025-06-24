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

      return `
        <div class="tenant-card" data-tenant-id="${tenant.id}"
        onclick="uiCore.handleTenantSelection('${tenant.id}')">
          <div class="tenant-header">
            <span class="tenant-name">${typeIcon}${tenant.name}</span>
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
    if (!commissions || commissions.length === 0) {
      this._updateElement('activeCommissionsList', '目前沒有活躍的委託任務');
      return;
    }

    const commissionsHTML = commissions.map(commission =>
      this._generateCommissionCard(commission, 'active')
    ).join('');

    this._updateElement('activeCommissionsList', commissionsHTML);
  }

  /**
   * 填充歷史記錄頁籤
   * @param {Array} history - 委託歷史
   * @private
   */
  _populateCommissionHistoryTab(history) {
    if (!history || history.length === 0) {
      this._updateElement('commissionHistoryList', '<div class="empty-state">暫無委託歷史記錄</div>');
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

    const statsHTML = `
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${stats.activeCommissions || 0}</div>
          <div class="stat-label">活躍委託</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.totalCommissions || 0}</div>
          <div class="stat-label">總委託數</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.successfulCommissions || 0}</div>
          <div class="stat-label">成功委託</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${successRate}%</div>
          <div class="stat-label">成功率</div>
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

    let resultHTML = '';
    if (result && type === 'history') {
      resultHTML = `
        <div class="commission-result">
          <span class="result-label">結果:</span>
          <span class="result-value ${result.success ? 'success' : 'failure'}">
            ${result.success ? '成功' : '失敗'}
          </span>
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
    document.querySelectorAll('.tenant-select-card').forEach(card => {
      card.classList.remove('selected');
    });

    // 隱藏預覽
    const preview = document.getElementById('commissionPreview');
    if (preview) preview.style.display = 'none';

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
      errors.push({ field: 'tenant', message: '請選擇租客' });
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
      possiblePartner: businessResults.possiblePartner ? {
        id: businessResults.possiblePartner.id,
        name: businessResults.possiblePartner.name,
        type: businessResults.possiblePartner.type,
        typeName: businessResults.possiblePartner.typeName || businessResults.possiblePartner.type
      } : null,
      resourceIcon: this._getIcon(formData.targetResource, 'resource'),
      resourceName: this._getResourceName(formData.targetResource),
      tenantIcon: this._getIcon(tenant.type, 'tenantHuman'),
      partnerIcon: businessResults.possiblePartner ? this._getIcon(businessResults.possiblePartner.type, 'tenantHuman') : null,
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
        this._showCommissionSuccess('委託邀約已發送！租客已接受任務。');
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

  // =================== 輔助方法 ===================

  /**
   * 顯示委託預覽
   * @param {Object} previewData - 預覽資料
   * @private
   */
  _displayCommissionPreview(previewData) {
    const preview = document.getElementById('commissionPreview');
    if (!preview) return;

    const previewHTML = `
      <div class="preview-item">
        <strong>目標：</strong> ${previewData.resourceIcon}獲取 ${previewData.targetAmount} 單位${previewData.resourceName}
      </div>
      <div class="preview-item">
        <strong>委託對象：</strong> ${previewData.tenantIcon}${previewData.tenant.name} (${previewData.tenant.typeName})
      </div>
      <div class="preview-item">
        <strong>預估接受機率：</strong>
        <span class="probability ${previewData.probabilityClass}">
          ${previewData.acceptanceProbability}%
        </span>
      ${previewData.possiblePartner ? `
        <div class="mission-partner">
          組隊夥伴：${previewData.partnerIcon} ${previewData.possiblePartner.name} (${previewData.possiblePartner.typeName})
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

      // 自動清除訊息
      setTimeout(() => {
        if (messageElement.parentNode) {
          messageElement.parentNode.removeChild(messageElement);
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
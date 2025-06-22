/**
 * UIDisplay.js - UI顯示控制器
 * 職責：遊戲狀態映射、DOM更新
 */

export default class UIDisplay {
  constructor(gameApp, uiCore = null) {
    this.gameApp = gameApp;
    this.uiCore = uiCore;
    this.elements = new Map();
  }

  async initialize() {
    this.cacheElements();
    console.log('✅ UIDisplay 初始化完成');
  }

  cacheElements() {
    const elementIds = [
      'day', 'time', 'cash', 'food', 'materials', 'medical', 'fuel',
      'buildingDefenseText', 'landlordHungerText', 'scavengeCount',
      'tenantList', 'gameLog'
    ];

    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.elements.set(id, element);
      }
    });
  }

  // =================== 核心更新方法 ===================

  updateAll() {
    if (!this.gameApp?.gameState) return;

    const state = this.gameApp.gameState;

    this.updateGameStatus(state);
    this.updateResources(state);
    this.updateStatusInfo(state);
    this.updateRoomDisplays(state);
    this.updateTenantList(state);
  }

  /**
   * 更新遊戲狀態
   */
  updateGameStatus(state) {
    const day = state.getStateValue('day', 1);
    const timeOfDay = state.getStateValue('time', 'day');

    this.updateElement('day', `${day}`);
    this.updateElement('time', timeOfDay === 'day' ? '☀️白天' : '🌙夜晚');
  }

  /**
   * 更新資源顯示
   */
  updateResources(state) {
    const resources = state.getStateValue('resources', {});

    this.updateElement('cash', `${resources.cash || 0}`);
    this.updateElement('food', `${resources.food || 0}`);
    this.updateElement('materials', `${resources.materials || 0}`);
    this.updateElement('medical', `${resources.medical || 0}`);
    this.updateElement('fuel', `${resources.fuel || 0}`);

    this.updateResourceStatus(resources);
  }

  /**
   * 更新資源狀態
   */
  updateResourceStatus(resources) {
    if (!this.uiCore) return;

    const resourceTypes = ['food', 'materials', 'medical', 'fuel', 'cash'];

    resourceTypes.forEach(resourceType => {
      const value = resources[resourceType] || 0;
      const status = this.uiCore.getResourceStatus(resourceType, value);

      const elementId = resourceType === 'cash' ? 'cash' : resourceType;
      const element = this.elements.get(elementId);

      if (element) {
        element.classList.remove('resource-critical', 'resource-warning', 'resource-good');
        element.classList.add(`resource-${status.severity}`);
      }
    });
  }

  /**
   * 更新狀態資訊
   */
  updateStatusInfo(state) {
    if (!this.uiCore) return;

    const buildingDefense = state.getStateValue('buildingDefense', 0);
    const defenseText = this.uiCore.getStatusText(buildingDefense, 'defense');
    this.updateElement('buildingDefenseText', defenseText);

    const landlordHunger = state.getStateValue('landlordHunger', 0);
    const hungerText = this.uiCore.getStatusText(landlordHunger, 'hunger');
    this.updateElement('landlordHungerText', hungerText);

    const scavengeUsed = state.getStateValue('scavengeUsed', 0);
    this.updateElement('scavengeCount', `${scavengeUsed}/2`);
  }

  _getRoomsData(state) {
    const rooms = state.getStateValue('rooms', []);

    return rooms.map(room => {
      // 統一預處理共用邏輯
      const tenant = state.getRoomTenant(room.id);
      if (tenant) {
        room.tenantSatisfaction = state.getStateValue(`tenantSatisfaction.${tenant.name}`, 50);
        room.satisfactionEmoji = this.uiCore.getSatisfactionEmoji(room.tenantSatisfaction);
      }
      return room;
    });
  }

  /**
   * 更新房間顯示
   * @returns {void}
   */
  updateRoomDisplays(state) {
    const rooms = this._getRoomsData(state);

    rooms.forEach((room) => {
      const roomElement = document.getElementById(`room${room.id}`);
      const infoElement = document.getElementById(`room${room.id}-info`);

      if (!roomElement || !infoElement) return;

      // 重設CSS類
      roomElement.className = "room";

      const tenant = state.getRoomTenant(room.id);
      if (tenant) {
        roomElement.classList.add("occupied");

        if (tenant.infected) {
          roomElement.classList.add("infected");
        }

        if (room.reinforced) {
          roomElement.classList.add("reinforced");
        }

        // 顯示租客資訊
        const satisfaction = room.tenantSatisfaction || 50;
        // 表情符號表示滿意度等級
        const satisfactionEmoji = room.satisfactionEmoji || '😐';

        infoElement.innerHTML = `
                  ${tenant.name}<br>
                  <small>${tenant.skill}</small><br>
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
   */
  updateTenantList(state) {
    const tenantListElement = this.elements.get('tenantList');
    if (!tenantListElement) return;

    const occupiedRooms = this.gameApp.gameState.getOccupiedRooms();
    const tenants = occupiedRooms.map(room => {
      const tenant = this.gameApp.gameState.getRoomTenant(room.id);
      if (tenant) {
        return {
          ...tenant,
          roomId: room.id,
          roomReinforced: room.reinforced,
          satisfaction: room.tenantSatisfaction,
          satisfactionEmoji: room.satisfactionEmoji
        };
      }
      return null;
    }).filter(tenant => tenant !== null);

    if (tenants.length === 0) {
      tenantListElement.innerHTML = '<div class="tenant-item">暫無租客</div>';
      return;
    }

    const tenantHTML = tenants.map(tenant => {
      // 顯示租客資訊
      const satisfaction = tenant.tenantSatisfaction || 50;
      // 表情符號表示滿意度等級
      const satisfactionEmoji = tenant.satisfactionEmoji || '😐';

      let statusIndicators = [];
      if (tenant.infected) statusIndicators.push('🦠已感染！');
      if (tenant.onMission) statusIndicators.push('🚶執行任務中');
      if (tenant.roomReinforced) statusIndicators.push('🛡️已加固');

      // === 個人資源概況 ===
      const personalResources = this.uiCore.safeGetPersonalResources(tenant);
      const totalValue = this.uiCore.getPersonalResourcesValue(personalResources);
      const statusInfo = this.uiCore.getStatusText(totalValue, 'personalWealth', true);

      // 生成資源圖示字串
      const resourceIcons = Object.entries(personalResources)
        .filter(([type, amount]) => amount > 0)
        .map(([type, amount]) => `${this.uiCore.getIcon(type, 'resource')}${amount}`)
        .join(' ');

      if (resourceIcons) {
        statusIndicators.push(`${resourceIcons} (${statusInfo.text})`);
      }

      return `
    <div class="tenant-item ${tenant.infected ? 'infected' : ''} ${tenant.type}" data-tenant-id="${tenant.id}">
      <strong>${tenant.name}</strong> (${tenant.typeName})<br>
      <small>房間 ${tenant.roomId} | 房租 ${tenant.rent}/天</small><br>
      <small>${satisfactionEmoji} 滿意度 ${satisfaction}%</small>
      ${statusIndicators.length > 0 ? `<br><small>${statusIndicators.join(' ')}</small>` : ''}
    </div>
  `;
    }).join('');

    tenantListElement.innerHTML = tenantHTML;
  }

  /**
   * 更新租客模態框中的交易按鈕狀態
   * @param {number|string} characterId - 角色ID
   * @param {boolean} hasTradeOptions - 是否有交易選項
   */
  updateTenantModalTradeButton(characterId, hasTradeOptions) {
    // 尋找租客模態框中的交易按鈕
    const tenantModal = document.getElementById('tenantModal');
    if (!tenantModal) return;

    const tradeButton = tenantModal.querySelector(`button[onclick*="showTradeModal('${characterId}')"]`);
    if (!tradeButton) return;

    // 更新按鈕狀態
    tradeButton.disabled = !hasTradeOptions;
    tradeButton.title = hasTradeOptions ? '與租客進行資源交易' : '暫無可用交易';

    // 更新按鈕文字
    const buttonText = hasTradeOptions ? '💱 查看交易' : '💱 暫無交易';
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

  // =================== 委託探索系統擴展 ===================

  /**
   * 更新委託狀態面板
   * @param {Object} stats - 委託統計資料
   * @returns {void}
   */
  updateCommissionStatusPanel(stats) {
    // 更新委託指標數值
    const activeCountEl = document.getElementById('activeCount');
    const completedTodayEl = document.getElementById('completedToday');
    const successRateEl = document.getElementById('successRate');

    if (activeCountEl) {
      activeCountEl.textContent = stats.activeCommissions || 0;
    }

    if (completedTodayEl) {
      completedTodayEl.textContent = stats.completedToday || 0;
    }

    if (successRateEl) {
      const rate = Math.round((stats.successRate || 0) * 100);
      successRateEl.textContent = `${rate}%`;
      // 根據成功率設定顏色
      successRateEl.className = `indicator-number ${this._getSuccessRateClass(rate)}`;
    }

    // 檢查面板是否存在，如果不存在則創建
    this._ensureCommissionPanelExists();
  }

  /**
   * 更新委託指標顯示
   * @param {Object} indicatorData - 指標資料
   * @returns {void}
   */
  updateCommissionIndicators(indicatorData) {
    const indicators = document.querySelector('.commission-indicators');
    if (!indicators) return;

    // 更新各項指標
    Object.entries(indicatorData).forEach(([key, value]) => {
      const element = indicators.querySelector(`#${key}`);
      if (element) {
        element.textContent = value;
        // 為關鍵指標添加視覺狀態
        if (key === 'activeCount' && value > 5) {
          element.classList.add('high-activity');
        } else {
          element.classList.remove('high-activity');
        }
      }
    });
  }

  // =================== 模態框內容更新 ===================

  /**
   * 更新委託分頁內容
   * @param {string} tabId - 分頁ID
   * @param {Object} data - 資料物件
   * @returns {void}
   */
  updateCommissionTabContent(tabId, data) {
    // 更新分頁徽章數字
    this._updateTabBadges(tabId, data);

    // 根據分頁類型進行特定更新
    switch (tabId) {
      case 'newCommission':
        // 直接內聯實作（少於5行且單一調用）
        const submitBtn = document.getElementById('submitCommission');
        if (submitBtn) {
          const hasAvailableTenants = data.availableTenants && data.availableTenants.length > 0;
          submitBtn.disabled = !hasAvailableTenants;
          submitBtn.title = hasAvailableTenants ? '發送委託邀約' : '目前沒有可用的租客';
        }
        break;
      case 'activeCommissions':
        // 直接內聯實作（少於5行且單一調用）
        const activeCommissions = data.activeCommissions || [];
        console.log(`活躍委託數量: ${activeCommissions.length}`);
        break;
      case 'commissionHistory':
        // 直接內聯實作（少於5行且單一調用）
        const history = data.history || [];
        console.log(`歷史記錄數量: ${history.length}`);
        break;
      case 'commissionStats':
        // 直接內聯實作（少於5行且單一調用）
        const stats = data.stats || {};
        console.log(`統計資料:`, stats);
        break;
    }
  }

  /**
   * 高亮表單錯誤欄位
   * @param {Array<string>} errorFields - 錯誤欄位列表
   * @returns {void}
   */
  highlightCommissionErrors(errorFields) {
    // 清除之前的錯誤高亮
    document.querySelectorAll('.form-error').forEach(el => {
      el.classList.remove('form-error');
    });

    // 顯示錯誤訊息
    const messagesEl = document.getElementById('formMessages');
    if (messagesEl && errorFields.length > 0) {
      const errorHtml = `
      <div class="message error">
        <ul>
          ${errorFields.map(error => `<li>${error}</li>`).join('')}
        </ul>
      </div>
    `;
      messagesEl.innerHTML = errorHtml;

      // 自動清除錯誤訊息
      setTimeout(() => {
        messagesEl.innerHTML = '';
      }, 5000);
    }

    // 高亮相關表單欄位
    this._highlightErrorFields(errorFields);
  }

  // =================== 即時狀態顯示 ===================

  /**
   * 刷新委託相關顯示
   * @returns {void}
   */
  refreshCommissionDisplay() {
    // 檢查是否有委託模態框開啟
    const commissionModal = document.getElementById('commissionModal');
    if (commissionModal && commissionModal.style.display !== 'none') {
      // 刷新當前活躍分頁的資料
      const activeTab = document.querySelector('.tab-button.active');
      if (activeTab && this.uiCore) {
        const tabName = activeTab.dataset.tab;
        this.uiCore.switchCommissionTab(tabName);
      }
    }

    // 刷新主介面的委託狀態
    if (this.uiCore) {
      this.uiCore.fetchCommissionStats().then(stats => {
        this.updateCommissionStatusPanel(stats);
      }).catch(error => {
        console.warn('刷新委託統計失敗:', error);
      });
    }
  }

  // =================== 私有輔助方法 ===================

  /**
   * 確保委託面板存在
   * @returns {void}
   * @private
   */
  _ensureCommissionPanelExists() {
    if (document.getElementById('commissionStatusPanel')) return;

    // 如果委託面板不存在，創建一個基礎面板
    const gameInterface = document.querySelector('.game-interface') || document.body;
    const panelHtml = `
    <div class="commission-status-panel" id="commissionStatusPanel">
      <h4>🔍 委託探索系統</h4>
      <div class="commission-indicators">
        <div class="indicator-item">
          <span class="indicator-number" id="activeCount">0</span>
          <span class="indicator-label">進行中</span>
        </div>
        <div class="indicator-item">
          <span class="indicator-number" id="completedToday">0</span>
          <span class="indicator-label">今日完成</span>
        </div>
        <div class="indicator-item">
          <span class="indicator-number" id="successRate">0%</span>
          <span class="indicator-label">成功率</span>
        </div>
        <div>
          <button class="btn btn-primary btn-sm" onclick="uiCore?.showCommissionModal()">發起委託</button>
          <button class="btn btn-sm" onclick="uiCore?.switchCommissionTab('activeCommissions')">管理委託</button>
        </div>
      </div>
    </div>
  `;

    gameInterface.insertAdjacentHTML('beforeend', panelHtml);
  }

  /**
   * 取得成功率CSS類別
   * @param {number} rate - 成功率百分比
   * @returns {string} CSS類別名稱
   * @private
   */
  _getSuccessRateClass(rate) {
    if (rate >= 80) return 'success-excellent';
    if (rate >= 60) return 'success-good';
    if (rate >= 40) return 'success-normal';
    if (rate >= 20) return 'success-poor';
    return 'success-critical';
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

  /**
   * 更新分頁徽章
   * @param {string} tabId - 分頁ID
   * @param {Object} data - 資料物件
   * @returns {void}
   * @private
   */
  _updateTabBadges(tabId, data) {
    const tabButton = document.querySelector(`[data-tab="${tabId}"]`);
    if (!tabButton) return;

    let count = 0;
    switch (tabId) {
      case 'activeCommissions':
        count = data.activeCommissions?.length || 0;
        break;
      case 'commissionHistory':
        count = data.history?.length || 0;
        break;
    }

    // 更新按鈕文字中的數字
    if (count > 0) {
      const buttonText = tabButton.textContent.replace(/\(\d+\)/, `(${count})`);
      if (!buttonText.includes('(')) {
        tabButton.textContent = `${buttonText} (${count})`;
      } else {
        tabButton.textContent = buttonText;
      }
    }
  }

  /**
   * 更新委託表單狀態（DOM 操作專責）
   * @param {Object} stateData - 表單狀態資料
   * @param {boolean} stateData.isValid - 表單是否有效
   * @param {Object} stateData.formData - 表單資料
   * @param {Object} stateData.validation - 驗證結果
   */
  updateCommissionFormState(stateData) {
    const { isValid, formData, validation } = stateData;

    // 更新提交按鈕狀態
    const submitBtn = document.getElementById('submitCommission');
    if (submitBtn) {
      submitBtn.disabled = !isValid;
      submitBtn.textContent = isValid ? '發送委託邀約' : '請完善表單資訊';
      submitBtn.title = isValid ? '發送委託邀約給選中的租客' : '請先選擇租客並填寫必要資訊';
    }

    // 如果表單無效，隱藏預覽
    if (!isValid) {
      const preview = document.getElementById('commissionPreview');
      if (preview) preview.style.display = 'none';
    }

    // 處理驗證錯誤顯示
    if (validation && !validation.valid && validation.errors) {
      this.highlightCommissionErrors(validation.errors.map(error => error.message));
    }
  }

  /**
   * 更新委託預覽（DOM 操作專責）
   * @param {Object|null} previewData - 預覽資料
   */
  updateCommissionPreview(previewData) {
    const preview = document.getElementById('commissionPreview');

    if (!preview) return;

    if (!previewData) {
      preview.style.display = 'none';
      return;
    }

    // 生成預覽 HTML
    let previewHtml = `
      <div class="preview-item">
        <strong>目標：</strong> ${previewData.resourceIcon} 獲取 ${previewData.targetAmount} 單位${previewData.resourceName}
      </div>
      <div class="preview-item">
        <strong>委託對象：</strong> ${previewData.tenantIcon} ${previewData.tenant.name} (${previewData.tenant.typeName})
      </div>
      <div class="preview-item">
        <strong>預估接受機率：</strong>
        <span class="probability ${previewData.probabilityClass}">
          ${previewData.acceptanceProbability}%
        </span>
      </div>
    `;

    // 添加可能的組隊夥伴資訊
    if (previewData.possiblePartner) {
      previewHtml += `
        <div class="preview-item">
          <strong>可能組隊夥伴：</strong> ${previewData.partnerIcon} ${previewData.possiblePartner.name} (技能互補加成)
        </div>
      `;
    }

    preview.innerHTML = previewHtml;
    preview.style.display = 'block';
  }

  /**
   * 更新委託訊息（模仿 updateGameLog 的設計模式）
   * @param {Object} messageData - 訊息資料物件
   */
  updateCommissionMessage(messageData) {
    const messagesEl = document.getElementById('formMessages');
    if (!messagesEl || !messageData) return;

    // 清除之前的訊息（委託訊息採用替換而非累積模式）
    messagesEl.innerHTML = '';

    // 創建訊息元素（與 updateGameLog 相似的結構）
    const messageEntry = document.createElement('div');
    messageEntry.className = `message ${messageData.type || 'info'}`;
    messageEntry.setAttribute('data-message-id', messageData.id);

    const typeIcon = this._getCommissionMessageIcon(messageData.type);

    messageEntry.innerHTML = `
      <div class="message-content">
        <span class="message-icon">${typeIcon}</span>
        <span class="message-text">${messageData.message}</span>
      </div>
    `;

    messagesEl.appendChild(messageEntry);

    // 自動清除訊息（模仿日誌的管理模式但採用定時清除）
    const timeout = messageData.type === 'success' ? 2000 : 5000;
    messageEntry.setAttribute('data-timeout-id', setTimeout(() => {
      if (messageEntry.parentNode) {
        messageEntry.remove();
      }
    }, timeout).toString());

    // 添加視覺效果（保持與日誌系統一致的用戶體驗）
    messageEntry.style.animation = 'messageSlideIn 0.3s ease-out';
  }

  /**
   * 取得委託訊息圖示（模仿 getIcon 方法的結構）
   * @param {string} type - 訊息類型
   * @returns {string} 圖示
   * @private
   */
  _getCommissionMessageIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
  }

  /**
   * 高亮錯誤欄位
   * @param {Array<string>} errorFields - 錯誤欄位列表
   * @returns {void}
   * @private
   */
  _highlightErrorFields(errorFields) {
    // 欄位映射
    const fieldMapping = {
      '請選擇目標資源': 'targetResource',
      '請輸入有效的目標數量': 'targetAmount',
      '請選擇委託對象': 'tenantSelection',
      '請設定基礎報酬或佣金': ['basePaymentFood', 'basePaymentMaterials', 'commissionCash']
    };

    errorFields.forEach(error => {
      const fieldIds = fieldMapping[error];
      if (fieldIds) {
        const ids = Array.isArray(fieldIds) ? fieldIds : [fieldIds];
        ids.forEach(id => {
          const element = document.getElementById(id);
          if (element) {
            element.classList.add('form-error');
            // 自動移除錯誤樣式
            setTimeout(() => element.classList.remove('form-error'), 5000);
          }
        });
      }
    });
  }

  // =================== 基本DOM操作 ===================

  updateElement(id, content) {
    const element = this.elements.get(id);
    if (element && element.textContent !== content) {
      element.textContent = content;
    }
  }

  /**
   * 更新遊戲日誌
   */
  updateGameLog(logData) {
    const gameLogEl = document.getElementById('gameLog');
    if (!gameLogEl || !logData) return;

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${logData.type || 'info'}`;

    const typeIcon = this.uiCore ? this.uiCore.getIcon(logData.type, 'log') : '';

    logEntry.innerHTML = `
      <span class="log-time">第${logData.day}天:</span>
      <span class="log-icon">${typeIcon}</span>
      <span class="log-message">${logData.message}</span>
    `;

    gameLogEl.appendChild(logEntry);
    gameLogEl.scrollTop = gameLogEl.scrollHeight;

    const maxLogs = 50;
    while (gameLogEl.children.length > maxLogs) {
      gameLogEl.removeChild(gameLogEl.firstChild);
    }
  }

  // =================== 除錯支援 ===================

  debug() {
    console.log('🖥️ UIDisplay 狀態:', {
      elements: this.elements.size,
      gameState: !!this.gameApp?.gameState
    });
  }

  getDisplayStatus() {
    return {
      initialized: this.elements.size > 0,
      cachedElements: Array.from(this.elements.keys())
    };
  }
}
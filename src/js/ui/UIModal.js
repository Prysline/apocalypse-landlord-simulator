/**
 * UIModal.js - UI模態框控制器
 * 職責：模態框生命週期管理、內容動態生成
 */

export default class UIModal {
  constructor(gameApp, uiCore = null) {
    this.gameApp = gameApp;
    this.uiCore = uiCore;
    this.activeModal = null;
    this.confirmCallback = null;
    this.modalStack = []; // 記錄模態框堆疊
  }

  async initialize() {
    console.log('✅ UIModal 初始化完成');
  }

  // =================== 核心模態框方法 ===================

  /**
   * 顯示模態框
   * @param {string} modalId - 模態框ID
   * @returns {boolean} 是否成功顯示
   */
  show(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      // 記錄模態框堆疊
      if (this.activeModal && this.activeModal !== modalId) {
        this.modalStack.push(this.activeModal);
      }

      modal.style.display = 'flex';
      this.activeModal = modalId;
      return true;
    }
    return false;
  }

  /**
   * 關閉指定模態框
   * @param {string|null} modalId - 模態框ID，null 表示關閉當前活動的
   * @returns {boolean} 是否成功關閉
   */
  close(modalId = null) {
    const targetModal = modalId || this.activeModal;
    if (targetModal) {
      const modal = document.getElementById(targetModal);
      if (modal) {
        modal.style.display = 'none';

        // 如果關閉的是當前活動模態框，返回上一個
        if (targetModal === this.activeModal) {
          this.activeModal = this.modalStack.pop() || null;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * 關閉所有模態框
   * @returns {boolean} 是否成功關閉
   */
  closeAll() {
    document.querySelectorAll(".modal").forEach((modal) => {
      if (modal instanceof HTMLElement) {
        modal.style.display = "none";
      }
    });
    this.activeModal = null;
    this.modalStack = [];
    return true;
  }

  // =================== 業務模態框方法 ===================

  /**
   * 設定訪客模態框內容
   * @param {Array} visitors - 訪客陣列
   */
  setVisitorContent(visitors) {
    const content = visitors.length === 0
      ? '<p>目前沒有訪客。</p>'
      : visitors.map(visitor => this._generateVisitorCard(visitor)).join('');

    const visitorList = document.getElementById('visitorList');
    if (visitorList) {
      visitorList.innerHTML = content;
    }
  }

  /**
   * 設定搜刮模態框內容
   * @param {Array} tenants - 可用租客陣列
   * @param {number} remaining - 剩餘搜刮次數
   */
  setScavengeContent(tenants, remaining) {
    const remainingEl = document.getElementById('remainingScavenges');
    if (remainingEl) {
      remainingEl.textContent = String(remaining);
    }

    const content = tenants.length === 0
      ? '<p>沒有可派遣的租客。</p>'
      : tenants.map(tenant => this._generateScavengeTenantCard(tenant)).join('');

    const availableTenantsEl = document.getElementById('availableTenants');
    if (availableTenantsEl) {
      availableTenantsEl.innerHTML = content;
    }
  }

  /**
   * 設定技能模態框內容
   * @param {Array} skills - 技能陣列
   */
  setSkillContent(skills) {
    if (skills.length === 0) {
      const skillContainer = document.getElementById('skillListContainer');
      if (skillContainer) {
        skillContainer.innerHTML = '<div class="skill-item">暫無可用技能</div>';
      }
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

    // 生成按租客分組的技能列表
    let content = '';
    const groupedSkills = Object.values(skillsByTenant);

    if (groupedSkills.length > 0) {
      groupedSkills.forEach(tenantGroup => {
        // 從 tenantManager 取得完整租客和房間資訊
        const { tenant, room } = this.gameApp.tenantManager?.findTenantAndRoom?.(tenantGroup.id) || {};
        const typeIcon = this.uiCore ? this.uiCore.getIcon(tenant?.type || 'unknown', 'tenant') : '';

        content += `
          <div class="tenant-skill-group">
            <h4 class="tenant-name">
              ${tenant?.name || tenantGroup.name} ${typeIcon}
              (${tenant?.typeName || '未知'}) - 房間${room?.id || '?'}
            </h4>
            <div class="tenant-skills">
        `;

        tenantGroup.skills.forEach(skill => {
          content += this._generateSkillCard(skill);
        });

        content += `
            </div>
          </div>
        `;
      });
    } else {
      // 如果沒有按租客分組的技能（後備兼容），使用原來的方式顯示
      content = skills.map(skill => this._generateSkillCard(skill)).join('');
    }

    const skillContainer = document.getElementById('skillListContainer');
    if (skillContainer) {
      skillContainer.innerHTML = content;
    }
  }

  /**
   * 設定租客模態框內容
   * @param {Object} room - 房間物件
   * @param {number} satisfaction - 滿意度
   */
  setTenantContent(room, satisfaction) {
    const titleEl = document.getElementById('tenantModalTitle');
    const contentEl = document.getElementById('tenantModalContent');
    const actionsEl = document.getElementById('tenantModalActions');

    if (!titleEl || !contentEl || !actionsEl) return;

    const tenant = this.gameApp.gameState.getRoomTenant(room.id);
    const typeIcon = this.uiCore ? this.uiCore.getIcon(tenant.type, 'tenant') : '';

    titleEl.textContent = `房間 ${room.id} - ${tenant.name}`;

    // === 個人資源詳細顯示 ===
    const personalResources = this.uiCore.safeGetPersonalResources(tenant);
    const totalValue = this.uiCore.getPersonalResourcesValue(personalResources);
    const statusInfo = this.uiCore.getStatusText(totalValue, 'personalWealth', true);

    const resourceHTML = Object.entries(personalResources)
      .map(([type, amount]) => {
        const icon = this.uiCore.getIcon(type, 'resource');
        const name = this.uiCore.getResourceName(type);
        return `<p>${icon} ${name}：${amount}</p>`;
      }).join('');

    contentEl.innerHTML = `
    <div class="tenant-modal-columns">
      <!-- 左欄：基本資訊 -->
      <div class="tenant-info-column">
        <h4>基本資訊</h4>
        <p><strong>姓名：</strong>${tenant.name}</p>
        <p><strong>類型：</strong>${typeIcon}${tenant.typeName}</p>
        <p><strong>技能：</strong>${tenant.skill}</p>
        <p><strong>房租：</strong>💰 ${tenant.rent} / 天</p>
        <p><strong>滿意度：</strong>${satisfaction}% ${satisfaction >= 70 ? '😊' : satisfaction >= 40 ? '😐' : '😞'}</p>
        <p><strong>狀態：</strong>${tenant.infected ? '🦠已感染' : tenant.onMission ? '🚶執行任務中' : '🏠在房間內'}</p>
        ${room.reinforced ? '<p style="color:#66ccff;">🛡️房間已加固</p>' : ''}
      </div>

      <div class="tenant-resources-column">
        <h4>個人資源</h4>
        ${resourceHTML}
        <p class="resource-${statusInfo.severity}">資源狀況：${statusInfo.text}</p>
      </div>
    </div>
    `;

    actionsEl.innerHTML = `
      <button class="btn" onclick="uiCore.closeModal()">關閉</button>
      <button class="btn btn-info" onclick="uiCore.showTradeModal('${tenant.id}')">
        💱 查看交易
      </button>
      <button class="btn btn-danger" onclick="uiCore.evictTenant(${tenant.id}, ${tenant.infected})">
        ${tenant.infected ? '🦠驅逐（感染）' : '📤要求退租'}
      </button>
    `;
  }

  /**
   * 設定空房間模態框內容
   * @param {Object} room - 房間物件
   */
  setEmptyRoomContent(room) {
    const titleEl = document.getElementById('tenantModalTitle');
    const contentEl = document.getElementById('tenantModalContent');
    const actionsEl = document.getElementById('tenantModalActions');

    if (!titleEl || !contentEl || !actionsEl) return;

    titleEl.textContent = `房間 ${room.id} - 空置中`;

    contentEl.innerHTML = `
      <p>此房間目前沒有租客。</p>
      <p>你可以前往查看申請者，選擇合適的租客入住。</p>
      ${room.reinforced ? '<p style="color:#66ccff;">🛡️ 此房間已加固</p>' : ''}
      ${room.needsRepair ? '<p style="color:#ff6666;">🔧 此房間需要維修</p>' : ''}
    `;

    actionsEl.innerHTML = `
      <button class="btn" onclick="uiCore.closeModal()">關閉</button>
      <button class="btn btn-primary" onclick="uiCore.showVisitors()">
        👥 查看訪客
      </button>
    `;
  }

  /**
   * 設定交易模態框內容
   * @param {Object} character - 角色物件
   * @param {Array} tradeOptions - 交易選項陣列
   */
  setTradeContent(character, tradeOptions) {
    const titleEl = document.getElementById('tradeModalTitle');
    const containerEl = document.getElementById('tradeOptionsContainer');

    if (!titleEl || !containerEl) {
      console.error("交易模態框元素未找到");
      return;
    }

    // 設置標題
    titleEl.textContent = `與 ${character?.name || '未知角色'} 交易`;

    const typeIcon = this.uiCore ? this.uiCore.getIcon(character.type, 'tenant') : '';
    titleEl.textContent = `與 ${character.name} 交易`;

    // 生成交易選項HTML
    if (tradeOptions.length === 0) {
      containerEl.innerHTML = `
        <div class="trade-info">
          <p class="no-trades">目前沒有可用的交易選項。</p>
          <p><small>提示：提高關係度或等待角色資源狀況變化可能產生新的交易機會。</small></p>
        </div>
      `;
    }

    // 角色資訊
    const characterInfo = `
    <div class="trade-character-info">
      <h4>${this._getCharacterIcon(character?.type)}${character?.name} (${character?.typeName || '未知類型'})</h4>
      <p>關係度: ${tradeOptions[0]?.relationship || 50}%</p>
    </div>
  `;

    let optionsHTML = null
    // 交易選項列表
    if (tradeOptions.length === 0) {
      optionsHTML = `
        <p class="no-trades">目前沒有可用的交易選項。</p>
        <small>提示：提高關係度或等待角色資源狀況變化可能產生新的交易機會。</small>
      `;
    } else {
      optionsHTML = tradeOptions.map(option =>
        this._generateTradeOptionCard(option)
      ).join('');
    }

    containerEl.innerHTML = `
    ${characterInfo}
    <div class="trade-options-list">
      ${optionsHTML}
    </div>
  `;
  }

  /**
   * 設定確認對話框內容
   * @param {string} title - 標題
   * @param {string} message - 訊息
   */
  setConfirmContent(title, message) {
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
  }

  // =================== 內容生成輔助方法 ===================

  _generateVisitorCard(visitor) {
    const infectionWarning = visitor.revealedInfection
      ? '<br><span style="color:#ff6666;">⚠ 已檢測出感染！</span>'
      : '';

    const currentCash = this.gameApp.gameState?.getStateValue('resources.cash', 0) || 0;
    const canAfford = currentCash >= visitor.rent;
    const typeIcon = this.uiCore ? this.uiCore.getIcon(visitor.type, 'tenant') : '';

    // 檢查交易狀態（如果尚未預檢查）
    let hasTradeOptions = visitor._hasTradeOptions;
    if (hasTradeOptions === undefined && this.gameApp?.tradeManager) {
      const tradeOptions = this.gameApp.tradeManager.getCharacterTradeOptions(visitor.id);
      hasTradeOptions = tradeOptions && tradeOptions.length > 0;
    }

    // 設定交易按鈕狀態
    const tradeButtonDisabled = !hasTradeOptions;
    const tradeButtonText = hasTradeOptions ? '💱 交易' : '💱 暫無交易';
    const tradeButtonClass = hasTradeOptions ? 'btn-info' : 'btn-disabled';
    const tradeButtonTitle = hasTradeOptions ? '與訪客進行資源交易' : '暫無可用交易';

    return `
      <div class="applicant ${visitor.revealedInfection ? 'infected' : ''}">
        <strong>${visitor.name}</strong> ${typeIcon} - ${visitor.typeName}<br>
        <small>${visitor.description || '普通的倖存者'}</small><br>
        <small style="color: #aaa;">外觀: ${visitor.appearance}</small><br>
        房租: ${visitor.rent}/天 ${canAfford ? '✅' : '💸'}
        ${infectionWarning}
        <br>
        <button class="btn ${visitor.revealedInfection ? 'btn-danger' : 'btn-primary'}"
                onclick="uiCore.hireTenant(${visitor.id})"
                ${!canAfford ? 'disabled' : ''}>
          ${visitor.revealedInfected ? '雇用 (危險)' : '雇用'}
          ${!canAfford ? ' (資金不足)' : ''}
        </button>
      <button class="btn ${tradeButtonClass}"
              onclick="uiCore.showTradeModal(${visitor.id})"
              title="${tradeButtonTitle}"
              ${tradeButtonDisabled ? 'disabled' : ''}>
        ${tradeButtonText}
      </button>
      </div>
    `;
  }

  _generateScavengeTenantCard(tenant) {
    const baseRates = { soldier: 85, worker: 75, farmer: 65, doctor: 50, trader: 60 };
    const successRate = baseRates[tenant.type] || 60;
    const typeIcon = this.uiCore ? this.uiCore.getIcon(tenant.type, 'tenant') : '';

    return `
      <div class="scavenge-tenant">
        <strong>${tenant.name}</strong> ${typeIcon} - ${tenant.typeName}<br>
        <small>技能: ${tenant.skill}</small><br>
        <small>成功率: ${successRate}%</small><br>
        <button class="btn btn-primary" onclick="uiCore.sendTenantOnScavenge('${tenant.id}')">
          派遣搜刮
        </button>
      </div>
    `;
  }

  _generateSkillCard(skill) {
    let costText = '';

    if (skill.cost) {
      const costItems = [];
      for (const [resource, amount] of Object.entries(skill.cost)) {
        const icon = this.uiCore ? this.uiCore.getIcon(resource, 'resource') : resource;
        costItems.push(`${icon} ${amount}`);
      }
      costText = costItems.join(', ');
    }

    const isDisabled = !skill.isAvailable;
    const statusText = skill.statusDescription || '未知狀態';

    // 根據不同狀態設定按鈕文字和樣式
    let buttonText = '使用技能';
    let buttonClass = 'btn-primary';

    if (skill.cooldownRemaining > 0) {
      buttonText = `冷卻中 (${skill.cooldownRemaining} 天)`;
      buttonClass = 'btn-disabled btn-cooldown';
    } else if (!skill.canAfford) {
      buttonText = '資源不足';
      buttonClass = 'btn-disabled btn-insufficient';
    }

    const buttonId = `useSkillBtn-${skill.tenantId}-${skill.id}`;

    // 獲取所有房間，用於房間加固技能的選擇
    const allRooms = this.gameApp.gameState.getStateValue('rooms', []);

    return `
    <div class="skill-item ${isDisabled ? 'skill-disabled' : ''} ${skill.cooldownRemaining > 0 ? 'skill-cooldown' : ''}">
      <div class="skill-info">
        <strong class="skill-name">${skill.name}</strong>
        <small class="skill-description">${skill.description}</small>

        ${skill.id === 'reinforce_room' ? `
          <div class="skill-option">
            <label for="roomSelect-${skill.tenantId}-${skill.id}">選擇房間:</label>
            <select id="roomSelect-${skill.tenantId}-${skill.id}" class="room-select" ${isDisabled ? 'disabled' : ''}>
              ${allRooms.map(room => `<option value="${room.id}">房間 ${room.id}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        <div class="skill-meta">
          <span class="skill-cost">消耗: ${costText || '無'}</span>
          ${skill.cooldown > 0 ? `<span class="skill-cooldown-info">冷卻: ${skill.cooldown} 天</span>` : ''}
          <span class="skill-status status-${skill.cooldownRemaining > 0 ? 'cooldown' : skill.canAfford ? 'ready' : 'unavailable'}">
        </div>
      </div>

      <div class="skill-actions">
        <button id="${buttonId}"
                class="btn ${buttonClass}"
                onclick="uiCore.useSkillWithTenant('${skill.id}', ${skill.tenantId}, { roomId: document.getElementById('roomSelect-${skill.tenantId}-${skill.id}')?.value })"
                ${isDisabled ? 'disabled' : ''}
                data-skill-id="${skill.id}"
                data-tenant-id="${skill.tenantId}"
                title="${statusText}">
          ${buttonText}
        </button>
      </div>
    </div>
  `;
  }

  /**
   * 生成交易選項卡片
   * @param {Object} option - 交易選項
   * @returns {string} HTML字串
   */
  _generateTradeOptionCard(option) {
    const resourceName = this._getResourceDisplayName(option.item);
    const priceText = this._formatPriceDisplay(option.price, option.originalPrice);
    const urgencyClass = this._getUrgencyClass(option.urgency);
    const disabledClass = option.canAfford ? '' : 'trade-option-disabled';

    return `
    <div class="trade-option-card ${urgencyClass} ${disabledClass}">
      <header class="trade-option-header">
        ${this._generateTypeBadge(option.type, option.urgency)}
        ${this._generateUrgencyBadge(option.urgency)}
      </header>

      <div class="trade-option-body">
        <div class="trade-option-main">
          <div class="trade-option-content">
            <div class="trade-description">${option.description}</div>
            <div class="trade-details">
              <p><strong>物品:</strong> ${resourceName} × ${option.quantity}</p>
              <p><strong>價格:</strong> ${priceText}</p>
            </div>
          </div>
        </div>

        <div class="trade-option-actions">
          <button
            class="btn ${option.canAfford ? 'btn-primary' : 'btn-disabled'}"
            onclick="uiCore?.executeTrade('${option.id}')"
            ${!option.canAfford ? 'disabled' : ''}
            title="${option.canAfford ? '執行交易' : '資源不足'}"
          >
            ${option.canAfford ? '確認交易' : '無法交易'}
          </button>
        </div>
      </div>
    </div>
  `;
  }
  /**
   * 生成交易類型徽章
   * @param {string} type - 交易類型
   * @param {string} urgency - 緊急程度
   * @returns {string} HTML字串
   * @private
   */
  _generateTypeBadge(type, urgency) {
    const typeTexts = {
      'buy': '購買需求',
      'sell': '出售提議',
      'emergency': '緊急交易'
    };

    const urgencyIcon = urgency === 'critical' ? '⚠️ ' : '';
    const badgeText = urgencyIcon + typeTexts[type];

    return `<span class="trade-type-badge type-${type}">${badgeText}</span>`;
  }

  /**
   * 生成緊急程度徽章
   * @param {string} urgency - 緊急程度
   * @returns {string} HTML字串
   * @private
   */
  _generateUrgencyBadge(urgency) {
    const urgencyTexts = {
      critical: '🚨 緊急',
      high: '⚠️ 急迫',
      medium: '📋 一般',
      low: '💭 可選'
    };

    return `<span class="trade-urgency-badge urgency-${urgency}">${urgencyTexts[urgency]}</span>`;
  }

  /**
   * 取得緊急程度的CSS類別
   * @param {string} urgency - 緊急程度
   * @returns {string} CSS類別名稱
   * @private
   */
  _getUrgencyClass(urgency) {
    return `urgency-${urgency}`;
  }

  /**
   * 格式化價格顯示
   * @param {number} currentPrice - 當前價格
   * @param {number} originalPrice - 原始價格
   * @returns {string} 格式化的價格文字
   * @private
   */
  _formatPriceDisplay(currentPrice, originalPrice) {
    if (currentPrice !== originalPrice) {
      return `$${currentPrice} <span style="color: #888; text-decoration: line-through;">($${originalPrice})</span>`;
    }
    return `$${currentPrice}`;
  }

  /**
   * 取得資源顯示名稱（使用 UICore 現有方法）
   * @param {string} resourceType - 資源類型
   * @returns {string} 顯示名稱
   * @private
   */
  _getResourceDisplayName(resourceType) {
    return this.uiCore ? this.uiCore.getResourceName(resourceType) : resourceType;
  }

  /**
   * 取得角色圖示（使用 UICore 現有方法）
   * @param {string} characterType - 角色類型
   * @returns {string} 圖示
   * @private
   */
  _getCharacterIcon(characterType) {
    return this.uiCore ? this.uiCore.getIcon(characterType, 'tenant') : '👤';
  }

  /**
   * 設定委託模態框內容
   */
  setCommissionModalContent() {
    // 初始化表單
    this.resetCommissionForm();

    // 生成租客選擇區域
    const tenantGrid = this._generateTenantSelectionGrid();
    const tenantSelection = document.getElementById('tenantSelection');
    if (tenantSelection) {
      tenantSelection.innerHTML = tenantGrid;
    }

    // 初始化其他頁籤為載入狀態
    const activeTab = document.getElementById('activeCommissionsList');
    const historyTab = document.getElementById('commissionHistoryList');
    const statsTab = document.getElementById('commissionStatsGrid');

    if (activeTab) activeTab.innerHTML = '<div class="loading">載入中...</div>';
    if (historyTab) historyTab.innerHTML = '<div class="loading">載入中...</div>';
    if (statsTab) statsTab.innerHTML = '<div class="loading">載入中...</div>';
  }

  /**
   * 重置委託表單
   */
  resetCommissionForm() {
    const form = document.getElementById('commissionForm');
    if (!form) return;

    // 重置表單值
    form.reset();

    // 重置租客選擇
    document.querySelectorAll('.tenant-select-card').forEach(card => {
      card.classList.remove('selected');
    });

    // 隱藏預覽
    const preview = document.getElementById('commissionPreview');
    if (preview) preview.style.display = 'none';

    // 清空訊息
    const messages = document.getElementById('formMessages');
    if (messages) messages.innerHTML = '';
  }

  // =================== 分頁填充 ===================
  /**
   * 填充活躍委託頁籤
   * @param {Array} commissions - 活躍委託列表
   */
  _populateActiveCommissionsTab(commissions) {
    const container = document.getElementById('activeCommissionsTab');
    if (!container) return;

    if (!commissions || commissions.length === 0) {
      container.innerHTML = '目前沒有活躍的委託任務';
      return;
    }

    const commissionsHTML = commissions.map(commission =>
      this._generateCommissionCard(commission, 'active')
    ).join('');

    container.innerHTML = commissionsHTML;
  }

  /**
   * 填充歷史記錄頁籤
   * @param {Array} history - 委託歷史
   */
  _populateCommissionHistoryTab(history) {
    const container = document.getElementById('commissionHistoryList');
    if (!container) return;

    if (!history || history.length === 0) {
      container.innerHTML = '<div class="empty-state">暫無委託歷史記錄</div>';
      return;
    }

    // 只顯示最近20筆
    const recentHistory = history.slice(-20).reverse();

    const historyHTML = recentHistory.map(record => {
      const commission = record.offer;
      const result = record.result;
      return this._generateCommissionCard(commission, 'history', result);
    }).join('');

    container.innerHTML = historyHTML;
  }

  /**
   * 填充統計資訊頁籤
   * @param {Object} stats - 統計資料
   */
  _populateCommissionStatsTab(stats) {
    const container = document.getElementById('commissionStatsGrid');
    if (!container) return;

    const successRate = stats.totalCommissions > 0
      ? Math.round(stats.successRate * 100)
      : 0;

    const failedCount = stats.totalCommissions - stats.successfulCommissions - (stats.rejectedCommissions || 0);

    container.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">📋</div>
      <div class="stat-value">${stats.activeCommissions}</div>
      <div class="stat-label">進行中</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">📊</div>
      <div class="stat-value">${stats.totalCommissions}</div>
      <div class="stat-label">總計委託</div>
    </div>
    <div class="stat-card success">
      <div class="stat-icon">✅</div>
      <div class="stat-value">${stats.successfulCommissions}</div>
      <div class="stat-label">成功完成</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">📈</div>
      <div class="stat-value">${successRate}%</div>
      <div class="stat-label">成功率</div>
    </div>
    <div class="stat-card warning">
      <div class="stat-icon">🚫</div>
      <div class="stat-value">${stats.rejectedCommissions || 0}</div>
      <div class="stat-label">被拒絕</div>
    </div>
    <div class="stat-card danger">
      <div class="stat-icon">❌</div>
      <div class="stat-value">${failedCount}</div>
      <div class="stat-label">探索失敗</div>
    </div>
  `;
  }
  // =================== HTML 生成 ===================

  /**
   * 生成租客選擇網格
   * @returns {string} HTML字串
   * @private
   */
  _generateTenantSelectionGrid() {
    const tenants = this.gameApp?.gameState?.getAllTenants() || [];

    if (tenants.length === 0) {
      return '<div class="empty-state">暫無可派遣租客</div>';
    }

    // 篩選可用租客
    const availableTenants = tenants.filter(tenant => {
      if (tenant.infected) return false;
      if (tenant.onMission) return false;

      // 檢查是否已有活躍委託
      const activeCommissions = this.gameApp.tradeManager?.getActiveCommissions() || [];
      return !activeCommissions.some(c =>
        c.tenantId === tenant.id || c.partnerId === tenant.id
      );
    });

    if (availableTenants.length === 0) {
      return '<div class="empty-state">所有租客都在忙碌中或無法派遣</div>';
    }

    return availableTenants.map(tenant => {
      const satisfaction = tenant.satisfaction || 50;
      const riskTolerance = this._getTenantRiskTolerance(tenant.type);

      return `
      <div class="tenant-card" data-tenant-id="${tenant.id}"
           onclick="window.uiCore?.handleTenantSelection('${tenant.id}')">
        <div class="tenant-header">
          <span class="tenant-name">${this.uiCore.getIcon(tenant.type, 'tenantHuman')}${tenant.name}</span>
        </div>
        <div class="tenant-info">
        <div class="tenant-satisfaction">滿意度：${this._getSatisfactionEmoji(satisfaction)}${satisfaction}</div>
        <div class="tenant-type">${tenant.typeName || tenant.type} • 風險容忍：${riskTolerance}</div>
        </div>
      </div>
    `;
    }).join('');
  }

  /**
   * 生成委託卡片
   * @param {Object} commission - 委託物件
   * @param {string} context - 顯示情境 ('active' | 'history')
   * @param {Object} [result] - 探索結果（歷史記錄用）
   * @returns {string} HTML字串
   * @private
   */
  _generateCommissionCard(commission, context, result = null) {
    const tenant = this.gameApp?.gameState?.findPersonById(commission.tenantId);
    const partner = commission.partnerId ?
      this.gameApp?.gameState?.findPersonById(commission.partnerId) : null;

    const statusInfo = this._getCommissionStatusInfo(commission.status);
    const resourceIcon = this.uiCore?.getIcon(commission.resourceType, 'resource') || '';
    const resourceName = this.uiCore?.getResourceName(commission.resourceType) || commission.resourceType;

    // 組裝參與者名單
    const participants = [tenant?.name || '未知租客'];
    if (partner) participants.push(partner.name);

    // 結果區塊
    let resultSection = '';
    if (context === 'history' && result) {
      const resultClass = result.success ? 'success' : 'failed';
      const resultText = result.success ?
        `成功獲得 ${resourceName} x${result.actualGained || 0}` :
        '探索失敗';

      resultSection = `
      <div class="commission-result ${resultClass}">
        <strong>結果：</strong> ${resultText}
        ${result.surplus > 0 ? `<br><small>超額完成 +${result.surplus}</small>` : ''}
      </div>
    `;
    }

    // 進度條（活躍委託）
    let progressBar = '';
    if (context === 'active' && commission.status === 'exploring') {
      progressBar = `
      <div class="commission-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: 60%;"></div>
        </div>
        <small>探索進行中...</small>
      </div>
    `;
    }

    return `
    <div class="commission-card ${statusInfo.class}">
      <div class="commission-header">
        <h4 class="commission-title">
          ${resourceIcon} ${resourceName}委託 #${commission.id.split('_')[1] || '???'}
        </h4>
        <span class="commission-status ${statusInfo.class}">
          ${statusInfo.icon} ${statusInfo.text}
        </span>
      </div>

      <div class="commission-body">
        <div class="commission-details">
          <div class="detail-row">
            <span class="detail-label">派遣人員：</span>
            <span class="detail-value">${participants.join(' + ')}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">目標數量：</span>
            <span class="detail-value">${commission.targetAmount} 單位</span>
          </div>
          ${commission.decidedAt ? `
            <div class="detail-row">
              <span class="detail-label">決定時間：</span>
              <span class="detail-value">${new Date(commission.decidedAt).toLocaleString()}</span>
            </div>
          ` : ''}
        </div>

        ${progressBar}

        <div class="commission-rewards">
          <div class="reward-section">
            <strong>基礎報酬：</strong> ${this._formatReward(commission.basePayment)}
          </div>
          <div class="reward-section">
            <strong>委託佣金：</strong> ${this._formatReward(commission.commission)}
          </div>
        </div>

        ${resultSection}
      </div>
    </div>
  `;
  }

  // =================== 表單管理 ===================

  /**
   * 取得委託表單資料
   * @returns {Object|null} 表單資料
   */
  getCommissionFormData() {
    const form = document.getElementById('commissionForm');
    if (!form) return null;

    // 取得選中的租客
    const selectedTenant = document.querySelector('.tenant-card.selected');
    if (!selectedTenant) return null;

    const tenantId = selectedTenant.getAttribute('data-tenant-id');

    const result =  {
      selectedTenant: tenantId,
      targetResource: document.getElementById('targetResource').value,
      targetAmount: document.getElementById('targetAmount').value,
      basePayment: {
        food: document.getElementById('basePaymentFood').value || '0',
        materials: document.getElementById('basePaymentMaterials').value || '0',
        medical: document.getElementById('basePaymentMedical').value || '0',
        fuel: document.getElementById('basePaymentFuel').value || '0'
      },
      commission: {
        cash: document.getElementById('commissionCash').value || '0',
        medical: document.getElementById('commissionMedical').value || '0'
      }
    };

    return result
  }

  /**
   * 驗證委託表單資料
   * @param {Object} formData - 表單資料
   * @returns {Object} 驗證結果
   */
  validateCommissionFormData(formData) {
    const errors = [];

    if (!formData.selectedTenant) {
      errors.push({ field: 'tenant', message: '請選擇委託對象' });
    }

    if (!formData.targetResource) {
      errors.push({ field: 'resource', message: '請選擇目標資源' });
    }

    const targetAmount = parseInt(formData.targetAmount);
    if (isNaN(targetAmount) || targetAmount < 1 || targetAmount > 50) {
      errors.push({ field: 'amount', message: '目標數量必須在 1-50 之間' });
    }

    // 檢查是否至少有一種報酬
    const hasBasePayment = Object.values(formData.basePayment).some(v => parseInt(v) > 0);
    const hasCommission = Object.values(formData.commission).some(v => parseInt(v) > 0);

    if (!hasBasePayment && !hasCommission) {
      errors.push({ field: 'payment', message: '請至少設定一種報酬' });
    }

    // 檢查資源是否足夠
    if (this.gameApp?.gameState) {
      const resources = this.gameApp.gameState.getStateValue('resources', {});

      // 檢查基礎報酬
      for (const [resource, amount] of Object.entries(formData.basePayment)) {
        const required = parseInt(amount);
        const available = resources[resource] || 0;
        if (required > available) {
          errors.push({
            field: `basePayment_${resource}`,
            message: `${this.uiCore?.getResourceName(resource) || resource} 不足（需要 ${required}，擁有 ${available}）`
          });
        }
      }

      // 檢查佣金
      const cashRequired = parseInt(formData.commission.cash);
      if (cashRequired > resources.cash) {
        errors.push({
          field: 'commission_cash',
          message: `現金不足（需要 ${cashRequired}，擁有 ${resources.cash}）`
        });
      }

      const medicalRequired = parseInt(formData.commission.medical);
      if (medicalRequired > resources.medical) {
        errors.push({
          field: 'commission_medical',
          message: `醫療用品不足（需要 ${medicalRequired}，擁有 ${resources.medical}）`
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  // =================== 輔助方法 ===================
  /**
   * 取得委託狀態資訊
   * @param {string} status - 狀態代碼
   * @returns {Object} 狀態資訊物件
   * @private
   */
  _getCommissionStatusInfo(status) {
    const statusMap = {
      offered: { text: '邀約中', class: 'status-pending', icon: '⏳' },
      accepted: { text: '已接受', class: 'status-accepted', icon: '✅' },
      rejected: { text: '已拒絕', class: 'status-rejected', icon: '❌' },
      exploring: { text: '探索中', class: 'status-exploring', icon: '🔍' },
      completed: { text: '已完成', class: 'status-completed', icon: '🎉' },
      failed: { text: '失敗', class: 'status-failed', icon: '💔' }
    };

    return statusMap[status] || { text: '未知', class: 'status-unknown', icon: '❓' };
  }

  /**
   * 取得租客風險容忍度
   * @param {string} tenantType - 租客類型
   * @returns {string} 風險容忍度描述
   * @private
   */
  _getTenantRiskTolerance(tenantType) {
    const toleranceMap = {
      'soldier': '高',
      'worker': '中',
      'farmer': '中',
      'doctor': '低',
      'elder': '低'
    };

    return toleranceMap[tenantType] || '未知';
  }

  /**
   * 取得滿意度表情符號
   * @param {number} satisfaction - 滿意度
   * @returns {string} 表情符號
   * @private
   */
  _getSatisfactionEmoji(satisfaction) {
    if (satisfaction >= 80) return '😊';
    if (satisfaction >= 60) return '🙂';
    if (satisfaction >= 40) return '😐';
    if (satisfaction >= 20) return '☹️';
    return '😡';
  }

  /**
   * 格式化報酬顯示
   * @param {Object} reward - 報酬物件
   * @returns {string} 格式化文字
   * @private
   */
  _formatReward(reward) {
    const items = [];

    for (const [resource, amount] of Object.entries(reward)) {
      if (parseInt(amount) > 0) {
        const icon = this.uiCore?.getIcon(resource, 'resource') || '';
        const name = this.uiCore?.getResourceName(resource) || resource;
        items.push(`${icon} ${name} x${amount}`);
      }
    }

    return items.length > 0 ? items.join(', ') : '無';
  }

  // =================== 狀態查詢 ===================

  getActiveModal() {
    return this.activeModal;
  }

  getModalStack() {
    return [...this.modalStack];
  }

  isModalOpen(modalId = null) {
    if (modalId) {
      return this.activeModal === modalId || this.modalStack.includes(modalId);
    }
    return !!this.activeModal;
  }

  // =================== 除錯支援 ===================

  debug() {
    console.log('💬 UIModal 狀態:', {
      activeModal: this.activeModal,
      modalStack: this.modalStack
    });
  }

  getStatus() {
    return {
      activeModal: this.activeModal,
      modalStack: [...this.modalStack]
    };
  }
}
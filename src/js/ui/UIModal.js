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

    // 交易選項列表
    const optionsHTML = tradeOptions.map(option =>
      this._generateTradeOptionCard(option)
    ).join('');

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
        <button class="btn btn-info"
                onclick="uiCore.showTradeModal(${visitor.id})"
                title="與訪客進行資源交易">
          💱 交易
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
            onclick="uiCore?.executeTradeOption('${option.id}')"
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
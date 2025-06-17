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
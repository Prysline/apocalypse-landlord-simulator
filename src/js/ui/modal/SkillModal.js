// @ts-check
/**
 * SkillModal.js - 技能功能專用模組
 * 職責：技能相關 Modal 管理和業務邏輯處理
 * 繼承 BaseModal 獲得標準化功能
 */

import BaseModal from './BaseModal.js';
import systemLogger from '../../utils/SystemLogger.js';

export default class SkillModal extends BaseModal {
  constructor(gameApp, uiCore) {
    super(gameApp, uiCore);
  }

  // =================== 對外主要介面 ===================

  /**
   * 顯示 Modal 的主要方法（實作基類抽象方法）
   * @param {...any} args - 參數（不使用，保持介面一致性）
   */
  show(...args) {
    this.showSkills();
  }

  /**
   * 顯示技能模態框
   */
  showSkills() {
    return this._safeExecute(async () => {
      const skillManager = this.gameApp.skillManager;
      const skills = skillManager?.getAvailableSkills ? skillManager.getAvailableSkills() : [];

      // 設置技能模態框內容
      this._setSkillContent(skills);
      this._showModal('skillModal');

      systemLogger.info(`顯示技能模態框，共 ${skills.length} 個可用技能`);
    }, 'showSkills');
  }

  /**
   * 執行技能（明確指定租客ID）
   * @param {string} skillId - 技能ID
   * @param {number} tenantId - 租客ID
   * @param {Object} options - 技能選項
   */
  async useSkillWithTenant(skillId, tenantId, options = {}) {
    return await this._safeExecute(async () => {
      systemLogger.debug(`使用技能: ${skillId}, 租客ID: ${tenantId}`);

      if (!this.gameApp?.skillManager?.executeSkill) {
        systemLogger.error("技能系統未載入或無法執行技能");
        this._addGameLog("技能系統未載入", "danger");
        return;
      }

      systemLogger.info(`執行技能: ${skillId}, 租客ID: ${tenantId}`);

      // 執行技能
      const result = await this.gameApp.skillManager.executeSkill(tenantId, skillId, options);

      // 關閉模態框並更新顯示
      this.uiCore?.closeAllModals();
      this.uiCore?.updateAll();

      // 添加執行結果日誌
      if (result.success) {
        this._addGameLog(`成功使用技能: ${result.skillId || skillId}`, "skill");
        systemLogger.success(`技能執行成功: ${skillId}`);
      } else {
        this._addGameLog(`無法使用技能: ${result.error || '未知錯誤'}`, "danger");
        systemLogger.error(`技能執行失敗: ${result.error}`);
      }
    }, 'useSkillWithTenant');
  }

  // =================== 私有 Modal 內容生成方法 ===================

  /**
   * 設定技能模態框內容
   * @param {Array} skills - 技能陣列
   * @private
   */
  _setSkillContent(skills) {
    if (skills.length === 0) {
      this._updateElement('skillListContainer', '<div class="skill-item">暫無可用技能</div>');
      return;
    }

    // 按租客分組技能
    const skillsByTenant = this._groupSkillsByTenant(skills);
    const groupedSkills = Object.values(skillsByTenant);

    let content = '';

    if (groupedSkills.length > 0) {
      groupedSkills.forEach(tenantGroup => {
        content += this._generateTenantSkillGroup(tenantGroup);
      });
    }

    this._updateElement('skillListContainer', content);
  }

  /**
   * 按租客分組技能
   * @param {Array} skills - 技能陣列
   * @returns {Object} 按租客分組的技能物件
   * @private
   */
  _groupSkillsByTenant(skills) {
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

    return skillsByTenant;
  }

  /**
   * 生成租客技能組HTML
   * @param {Object} tenantGroup - 租客技能組
   * @returns {string} HTML字串
   * @private
   */
  _generateTenantSkillGroup(tenantGroup) {
    // 從 tenantManager 取得完整租客和房間資訊
    const tenantInfo = this.gameApp.tenantManager?.findTenantAndRoom?.(tenantGroup.id) || {};
    const tenant = tenantInfo.tenant;
    const room = tenantInfo.room;

    const typeIcon = this._getIcon(tenant?.type || 'unknown', 'tenant');

    let content = `
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

    return content;
  }

  /**
   * 生成單一技能卡片HTML
   * @param {Object} skill - 技能物件
   * @returns {string} HTML字串
   * @private
   */
  _generateSkillCard(skill) {
    const costText = this._generateSkillCostText(skill);
    const isDisabled = !skill.isAvailable;
    const statusText = skill.statusDescription || '未知狀態';

    // 根據不同狀態設定按鈕文字和樣式
    const buttonState = this._getSkillButtonState(skill);
    const buttonId = `useSkillBtn-${skill.tenantId}-${skill.id}`;

    // 獲取所有房間，用於房間加固技能的選擇
    const roomSelectHtml = this._generateRoomSelectHtml(skill);

    return `
      <div class="skill-item ${isDisabled ? 'skill-disabled' : ''} ${skill.cooldownRemaining > 0 ? 'skill-cooldown' : ''}">
        <div class="skill-info">
          <strong class="skill-name">${skill.name}</strong>
          <small class="skill-description">${skill.description}</small>

          ${roomSelectHtml}

          <div class="skill-meta">
            <span class="skill-cost">消耗: ${costText || '無'}</span>
            ${skill.cooldown > 0 ? `<span class="skill-cooldown-info">冷卻: ${skill.cooldown} 天</span>` : ''}
            <span class="skill-status status-${skill.cooldownRemaining > 0 ? 'cooldown' : skill.canAfford ? 'ready' : 'unavailable'}">
              狀態: ${statusText}
            </span>
          </div>
        </div>

        <div class="skill-actions">
          <button
            id="${buttonId}"
            class="btn ${buttonState.class}"
            onclick="uiCore.useSkillWithTenant('${skill.id}', ${skill.tenantId}, { roomId: document.getElementById('roomSelect-${skill.tenantId}-${skill.id}')?.value })"
            ${buttonState.disabled ? 'disabled' : ''}
            data-skill-id="${skill.id}"
            data-tenant-id="${skill.tenantId}"
            title="${statusText}"
          >
            ${buttonState.text}
          </button>
        </div>
      </div>
    `;
  }

  // =================== 輔助方法 ===================

  /**
   * 生成技能消耗文字
   * @param {Object} skill - 技能物件
   * @returns {string} 消耗文字
   * @private
   */
  _generateSkillCostText(skill) {
    if (!skill.cost) return '';

    const costItems = [];
    for (const [resource, amount] of Object.entries(skill.cost)) {
      const icon = this._getIcon(resource, 'resource');
      costItems.push(`${icon} ${amount}`);
    }

    return costItems.join(', ');
  }

  /**
   * 獲取技能按鈕狀態
   * @param {Object} skill - 技能物件
   * @returns {Object} 按鈕狀態物件
   * @private
   */
  _getSkillButtonState(skill) {
    if (skill.cooldownRemaining > 0) {
      return {
        text: `冷卻中 (${skill.cooldownRemaining} 天)`,
        class: 'btn-disabled btn-cooldown',
        disabled: true
      };
    } else if (!skill.canAfford) {
      return {
        text: '資源不足',
        class: 'btn-disabled btn-insufficient',
        disabled: true
      };
    } else if (!skill.isAvailable) {
      return {
        text: '無法使用',
        class: 'btn-disabled',
        disabled: true
      };
    } else {
      return {
        text: '使用技能',
        class: 'btn-primary',
        disabled: false
      };
    }
  }

  /**
   * 生成房間選擇HTML（僅用於房間加固技能）
   * @param {Object} skill - 技能物件
   * @returns {string} HTML字串
   * @private
   */
  _generateRoomSelectHtml(skill) {
    if (skill.id !== 'reinforce_room') return '';

    const allRooms = this.gameState.getStateValue('rooms', []);
    const isDisabled = !skill.isAvailable;

    const roomOptions = allRooms.map(room =>
      `<option value="${room.id}">房間 ${room.id}</option>`
    ).join('');

    return `
      <div class="skill-option">
        <label for="roomSelect-${skill.tenantId}-${skill.id}">選擇房間:</label>
        <select id="roomSelect-${skill.tenantId}-${skill.id}" class="room-select" ${isDisabled ? 'disabled' : ''}>
          ${roomOptions}
        </select>
      </div>
    `;
  }

  /**
   * 刷新技能列表（供外部調用）
   */
  refreshSkills() {
    if (this._isSkillModalActive()) {
      this.showSkills();
    }
  }

  /**
   * 檢查技能模態框是否當前活動
   * @returns {boolean} 是否活動
   * @private
   */
  _isSkillModalActive() {
    const modal = document.getElementById('skillModal');
    return modal && modal.style.display === 'flex';
  }

  // =================== 狀態管理方法 ===================

  /**
   * 獲取可用技能數量
   * @returns {number} 可用技能數量
   */
  getAvailableSkillCount() {
    const skillManager = this.gameApp.skillManager;
    const skills = skillManager?.getAvailableSkills ? skillManager.getAvailableSkills() : [];
    return skills.filter(skill => skill.isAvailable && skill.cooldownRemaining === 0 && skill.canAfford).length;
  }

  /**
   * 獲取冷卻中技能數量
   * @returns {number} 冷卻中技能數量
   */
  getCooldownSkillCount() {
    const skillManager = this.gameApp.skillManager;
    const skills = skillManager?.getAvailableSkills ? skillManager.getAvailableSkills() : [];
    return skills.filter(skill => skill.cooldownRemaining > 0).length;
  }

  /**
   * 獲取技能統計資訊
   * @returns {Object} 統計資訊
   */
  getSkillStats() {
    const skillManager = this.gameApp.skillManager;
    const skills = skillManager?.getAvailableSkills ? skillManager.getAvailableSkills() : [];

    return {
      total: skills.length,
      available: skills.filter(skill => skill.isAvailable && skill.cooldownRemaining === 0 && skill.canAfford).length,
      cooldown: skills.filter(skill => skill.cooldownRemaining > 0).length,
      insufficientResources: skills.filter(skill => skill.isAvailable && skill.cooldownRemaining === 0 && !skill.canAfford).length,
      unavailable: skills.filter(skill => !skill.isAvailable).length
    };
  }

  /**
   * 檢查特定技能是否可用
   * @param {string} skillId - 技能ID
   * @param {number} tenantId - 租客ID
   * @returns {boolean} 是否可用
   */
  isSkillAvailable(skillId, tenantId) {
    const skillManager = this.gameApp.skillManager;
    const skills = skillManager?.getAvailableSkills ? skillManager.getAvailableSkills() : [];

    const skill = skills.find(s => s.id === skillId && s.tenantId === tenantId);
    return skill ? (skill.isAvailable && skill.cooldownRemaining === 0 && skill.canAfford) : false;
  }

  /**
   * 獲取技能冷卻剩餘時間
   * @param {string} skillId - 技能ID
   * @param {number} tenantId - 租客ID
   * @returns {number} 冷卻剩餘天數
   */
  getSkillCooldownRemaining(skillId, tenantId) {
    const skillManager = this.gameApp.skillManager;
    const skills = skillManager?.getAvailableSkills ? skillManager.getAvailableSkills() : [];

    const skill = skills.find(s => s.id === skillId && s.tenantId === tenantId);
    return skill ? skill.cooldownRemaining : 0;
  }
}
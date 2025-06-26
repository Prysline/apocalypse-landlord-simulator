// @ts-check
/**
 * TenantModal.js - 租客功能專用模組
 * 職責：租客相關 Modal 管理和業務邏輯處理
 * 繼承 BaseModal 獲得標準化功能
 */

import BaseModal from './BaseModal.js';
import systemLogger from '../../utils/SystemLogger.js';

export default class TenantModal extends BaseModal {
  constructor(gameApp, uiCore) {
    super(gameApp, uiCore);
  }

  // =================== 對外主要介面 ===================

  /**
   * 顯示 Modal 的主要方法（實作基類抽象方法）
   * @param {Object|string} roomOrId - 房間物件或房間ID
   */
  show(roomOrId) {
    const room = typeof roomOrId === 'object' ? roomOrId : this._findRoom(roomOrId);
    if (room) {
      this.showRoom(room);
    } else {
      systemLogger.error(`${this.modalName}: 找不到房間 ${roomOrId}`);
    }
  }

  /**
   * 顯示房間 Modal
   * @param {Object} room - 房間物件
   */
  showRoom(room) {
    return this._safeExecute(async () => {
      const tenant = this.gameState.getRoomTenant(room.id);

      if (tenant) {
        const satisfaction = this.gameState.getStateValue(`tenantSatisfaction.${tenant.name}`, 50);
        this._setTenantContent(room, tenant, satisfaction);
      } else {
        this._setEmptyRoomContent(room);
      }

      this._showModal('tenantModal');
    }, 'showRoom');
  }

  /**
   * 雇用租客
   * @param {string|number} applicantId - 申請者ID
   * @returns {Promise<boolean>} 是否成功
   */
  async hireTenant(applicantId) {
    return await this._safeExecute(async () => {
      if (!this.gameApp.tenantManager?.hireTenant) {
        this._addGameLog('租客管理系統未載入', 'danger');
        return false;
      }

      const result = await this.gameApp.tenantManager.hireTenant(applicantId);

      if (result.success) {
        this.uiCore.closeAllModals();
        this.uiCore.updateAll();
        systemLogger.info(`${this.modalName}: 成功雇用租客 ${result.tenant?.name}`);
        return true;
      } else {
        this._addGameLog(`雇用失敗: ${result.error}`, 'danger');
        systemLogger.error(`${this.modalName}: 雇用失敗 - ${result.error}`);
        return false;
      }
    }, 'hireTenant');
  }

  /**
   * 驅逐租客
   * @param {string|number} tenantId - 租客ID
   * @param {boolean} isInfected - 是否因感染驅逐
   */
  evictTenant(tenantId, isInfected = false) {
    const tenantInfo = this.gameApp.tenantManager?.findTenantAndRoom(tenantId);
    if (!tenantInfo) {
      systemLogger.error(`${this.modalName}: 找不到租客 ${tenantId}`);
      this._addGameLog('找不到指定租客', 'danger');
      return;
    }

    const { tenant } = tenantInfo;
    const actionText = isInfected ? '驅逐感染租客' : '租客退租確認';
    const messageText = `確定要${isInfected ? '驅逐感染的' : '讓'}租客 ${tenant.name} ${isInfected ? '' : '退租'}嗎？`;

    // 使用 UICore 的確認對話框
    this.uiCore.showConfirmModal(actionText, messageText, async () => {
      await this._safeExecute(async () => {
        const result = await this.gameApp.tenantManager.evictTenant(tenantId);
        if (result.success) {
          systemLogger.info(`${this.modalName}: 成功驅逐租客 ${tenant.name}`);
          this.uiCore.closeAllModals();
          this.uiCore.updateAll();
        } else {
          this._addGameLog(`驅逐失敗: ${result.error}`, 'danger');
        }
      }, 'evictTenant');
    });
  }

  // =================== 私有 Modal 內容生成方法 ===================

  /**
   * 設定有租客的房間模態框內容
   * @param {Object} room - 房間物件
   * @param {Object} tenant - 租客物件
   * @param {number} satisfaction - 滿意度
   * @private
   */
  _setTenantContent(room, tenant, satisfaction) {
    // 生成租客個人資源顯示
    const resourceHTML = this._generateTenantResourceHTML(tenant);
    const statusInfo = this._getTenantResourceStatus(tenant);
    const typeIcon = this._getIcon(tenant.type, 'tenant');

    // 設置標題
    this._setElementText('tenantModalTitle', `房間 ${room.id} - ${tenant.name}`);

    // 生成主要內容
    const content = `
      <div class="tenant-info-grid">
        <div class="tenant-basic-column">
          <h4>${typeIcon} ${tenant.name}</h4>
          <p><strong>類型：</strong>${tenant.typeName || '未知'}</p>
          <p><strong>房租：</strong>$${tenant.rent}/天</p>
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

    this._updateElement('tenantModalContent', content);

    // 生成動作按鈕
    const actions = `
      <button class="btn" onclick="uiCore.closeModal()">關閉</button>
      <button class="btn btn-info" onclick="uiCore.showTradeModal('${tenant.id}')">
        💱 查看交易
      </button>
      <button class="btn btn-danger" onclick="uiCore.evictTenant('${tenant.id}', ${tenant.infected})">
        ${tenant.infected ? '🦠驅逐（感染）' : '📤要求退租'}
      </button>
    `;

    this._updateElement('tenantModalActions', actions);
  }

  /**
   * 設定空房間模態框內容
   * @param {Object} room - 房間物件
   * @private
   */
  _setEmptyRoomContent(room) {
    this._setElementText('tenantModalTitle', `房間 ${room.id} - 空置中`);

    const content = `
      <p>此房間目前沒有租客。</p>
      <p>你可以前往查看申請者，選擇合適的租客入住。</p>
      ${room.reinforced ? '<p style="color:#66ccff;">🛡️ 此房間已加固</p>' : ''}
      ${room.needsRepair ? '<p style="color:#ff6666;">🔧 此房間需要維修</p>' : ''}
    `;

    this._updateElement('tenantModalContent', content);

    const actions = `
      <button class="btn" onclick="uiCore.closeModal()">關閉</button>
      <button class="btn btn-primary" onclick="uiCore.showVisitors()">
        👥 查看訪客
      </button>
    `;

    this._updateElement('tenantModalActions', actions);
  }

  // =================== 輔助方法 ===================

  /**
   * 查找房間
   * @param {string|number} roomId - 房間ID
   * @returns {Object|null} 房間物件
   * @private
   */
  _findRoom(roomId) {
    const rooms = this.gameState.getStateValue('rooms', []);
    return rooms.find(r => r.id == roomId) || null;
  }

  /**
   * 生成租客個人資源 HTML
   * @param {Object} tenant - 租客物件
   * @returns {string} 資源 HTML
   * @private
   */
  _generateTenantResourceHTML(tenant) {
    if (!tenant.personalResources) {
      return '<p>暫無個人資源資訊</p>';
    }

    const resources = ['cash', 'food', 'materials', 'medical', 'fuel'];
    const resourceHTML = resources.map(resourceType => {
      const amount = tenant.personalResources[resourceType] || 0;
      const icon = this._getIcon(resourceType, 'resource');
      const name = this._getResourceName(resourceType);

      return `<p>${icon} ${name}: ${amount}</p>`;
    }).join('');

    return resourceHTML || '<p>無個人資源</p>';
  }

  /**
   * 取得租客資源狀況
   * @param {Object} tenant - 租客物件
   * @returns {Object} 狀況物件 {severity, text}
   * @private
   */
  _getTenantResourceStatus(tenant) {
    if (!tenant.personalResources) {
      return { severity: 'unknown', text: '未知' };
    }

    const totalResources = Object.values(tenant.personalResources)
      .reduce((sum, val) => sum + (val || 0), 0);

    if (totalResources >= 20) {
      return { severity: 'good', text: '充足' };
    } else if (totalResources >= 10) {
      return { severity: 'warning', text: '普通' };
    } else {
      return { severity: 'critical', text: '缺乏' };
    }
  }
}
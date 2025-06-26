// @ts-check
/**
 * VisitorModal.js - 訪客功能專用模組
 * 職責：訪客相關 Modal 管理和業務邏輯處理
 * 繼承 BaseModal 獲得標準化功能
 */

import BaseModal from './BaseModal.js';
import systemLogger from '../../utils/SystemLogger.js';

export default class VisitorModal extends BaseModal {
  constructor(gameApp, uiCore) {
    super(gameApp, uiCore);
  }

  // =================== 對外主要介面 ===================

  /**
   * 顯示 Modal 的主要方法（實作基類抽象方法）
   * @param {...any} args - 參數（不使用，保持介面一致性）
   */
  show(...args) {
    this.showVisitors();
  }

  /**
   * 顯示訪客模態框
   */
  showVisitors() {
    return this._safeExecute(async () => {
      // 確保關閉其他模態框
      this.uiCore?.closeModal();

      const visitors = this.gameState.getStateValue('applicants', []) || [];

      // 預檢查所有訪客的交易狀態
      this._preCheckVisitorTradeStatus(visitors);

      // 設置訪客模態框內容
      this._setVisitorContent(visitors);
      this._showModal('visitorModal');

      systemLogger.info(`顯示訪客模態框，共 ${visitors.length} 位訪客`);
    }, 'showVisitors');
  }

  /**
   * 雇用訪客（委託給 TenantModal）
   * @param {string|number} applicantId - 申請者ID
   */
  async hireTenant(applicantId) {
    // 委託給 TenantModal 處理雇用邏輯
    if (this.uiCore?.tenantModal) {
      const result = await this.uiCore.tenantModal.hireTenant(applicantId);
      if (result) {
        // 雇用成功後更新訪客列表
        this.showVisitors();
      }
      return result;
    } else {
      systemLogger.error('TenantModal 未初始化，無法雇用訪客');
      this._addGameLog('租客系統未載入', 'danger');
      return false;
    }
  }

  // =================== 私有 Modal 內容生成方法 ===================

  /**
   * 設定訪客模態框內容
   * @param {Array} visitors - 訪客陣列
   * @private
   */
  _setVisitorContent(visitors) {
    const content = visitors.length === 0
      ? '<p>目前沒有訪客。</p>'
      : visitors.map(visitor => this._generateVisitorCard(visitor)).join('');

    this._updateElement('visitorList', content);
  }

  /**
   * 生成單一訪客卡片HTML
   * @param {Object} visitor - 訪客物件
   * @returns {string} HTML字串
   * @private
   */
  _generateVisitorCard(visitor) {
    const infectionWarning = visitor.revealedInfection
      ? '<br><span style="color:#ff6666;">⚠ 已檢測出感染！</span>'
      : '';

    const currentCash = this.gameState.getStateValue('resources.cash', 0);
    const canAfford = currentCash >= visitor.rent;
    const typeIcon = this._getIcon(visitor.type, 'tenant');

    // 檢查交易狀態
    const hasTradeOptions = visitor._hasTradeOptions || false;

    // 設定交易按鈕狀態
    const tradeButtonState = this._getTradeButtonState(hasTradeOptions);

    // 設定雇用按鈕狀態
    const hireButtonState = this._getHireButtonState(canAfford, visitor.revealedInfection);

    return `
      <div class="applicant ${visitor.revealedInfection ? 'infected' : ''}">
        <div class="visitor-header">
          <strong>${visitor.name}</strong> ${typeIcon} - ${visitor.typeName}
        </div>

        <div class="visitor-details">
          <small>${visitor.description || '普通的倖存者'}</small><br>
          <small style="color: #aaa;">外觀: ${visitor.appearance}</small><br>
          房租: ${visitor.rent}/天 ${canAfford ? '✅' : '💸'}
          ${infectionWarning}
        </div>

        <div class="visitor-actions">
          <button
            class="btn ${hireButtonState.class}"
            onclick="uiCore?.hireTenant(${visitor.id})"
            ${hireButtonState.disabled ? 'disabled' : ''}
            title="${hireButtonState.title}"
          >
            ${hireButtonState.text}
          </button>

          <button
            class="btn ${tradeButtonState.class}"
            onclick="uiCore?.showTradeModal('${visitor.id}')"
            ${tradeButtonState.disabled ? 'disabled' : ''}
            title="${tradeButtonState.title}"
          >
            ${tradeButtonState.text}
          </button>
        </div>
      </div>
    `;
  }

  // =================== 輔助方法 ===================

  /**
   * 預檢查所有訪客的交易狀態
   * @param {Array} visitors - 訪客陣列
   * @private
   */
  _preCheckVisitorTradeStatus(visitors) {
    if (!this.gameApp?.tradeManager) return;

    visitors.forEach(visitor => {
      try {
        const tradeOptions = this.gameApp.tradeManager.getCharacterTradeOptions(visitor.id);
        visitor._hasTradeOptions = tradeOptions && tradeOptions.length > 0;
      } catch (error) {
        systemLogger.warn(`檢查訪客 ${visitor.name} 交易狀態失敗:`, error);
        visitor._hasTradeOptions = false;
      }
    });
  }

  /**
   * 獲取交易按鈕狀態
   * @param {boolean} hasTradeOptions - 是否有交易選項
   * @returns {Object} 按鈕狀態物件
   * @private
   */
  _getTradeButtonState(hasTradeOptions) {
    if (hasTradeOptions) {
      return {
        class: 'btn-info',
        disabled: false,
        text: '💱 交易',
        title: '與訪客進行資源交易'
      };
    } else {
      return {
        class: 'btn-disabled',
        disabled: true,
        text: '💱 暫無交易',
        title: '暫無可用交易'
      };
    }
  }

  /**
   * 獲取雇用按鈕狀態
   * @param {boolean} canAfford - 是否負擔得起
   * @param {boolean} isInfected - 是否感染
   * @returns {Object} 按鈕狀態物件
   * @private
   */
  _getHireButtonState(canAfford, isInfected) {
    if (isInfected) {
      return {
        class: 'btn-danger',
        disabled: true,
        text: '🦠 已感染',
        title: '感染者無法雇用'
      };
    } else if (!canAfford) {
      return {
        class: 'btn-disabled',
        disabled: true,
        text: '💸 資金不足',
        title: '現金不足以支付房租'
      };
    } else {
      return {
        class: 'btn-primary',
        disabled: false,
        text: '✅ 雇用',
        title: '雇用此訪客為租客'
      };
    }
  }

  /**
   * 更新訪客交易按鈕狀態（供外部調用）
   * @param {string|number} characterId - 角色ID
   * @param {boolean} hasTradeOptions - 是否有交易選項
   */
  updateVisitorTradeButton(characterId, hasTradeOptions) {
    const visitorModal = document.getElementById('visitorModal');
    if (!visitorModal) return;

    const tradeButton = visitorModal.querySelector(`button[onclick*="showTradeModal(${characterId})"]`);
    if (!tradeButton) return;

    const buttonState = this._getTradeButtonState(hasTradeOptions);

    // 更新按鈕狀態
    /** @type {HTMLButtonElement} */(tradeButton).disabled = buttonState.disabled;
    /** @type {HTMLButtonElement} */(tradeButton).title = buttonState.title;
    tradeButton.innerHTML = buttonState.text;

    // 更新按鈕樣式
    tradeButton.className = `btn ${buttonState.class}`;
  }

  /**
   * 刷新訪客列表（供外部調用）
   */
  refreshVisitors() {
    if (this._isVisitorModalActive()) {
      this.showVisitors();
    }
  }

  /**
   * 檢查訪客模態框是否當前活動
   * @returns {boolean} 是否活動
   * @private
   */
  _isVisitorModalActive() {
    const modal = document.getElementById('visitorModal');
    return modal && modal.style.display === 'flex';
  }

  // =================== 狀態管理方法 ===================

  /**
   * 獲取當前訪客數量
   * @returns {number} 訪客數量
   */
  getVisitorCount() {
    const visitors = this.gameState.getStateValue('applicants', []);
    return visitors ? visitors.length : 0;
  }

  /**
   * 獲取可雇用訪客數量
   * @returns {number} 可雇用訪客數量
   */
  getHireableVisitorCount() {
    const visitors = this.gameState.getStateValue('applicants', []);
    const currentCash = this.gameState.getStateValue('resources.cash', 0);

    return visitors.filter(visitor =>
      !visitor.revealedInfection && currentCash >= visitor.rent
    ).length;
  }

  /**
   * 獲取有交易選項的訪客數量
   * @returns {number} 有交易選項的訪客數量
   */
  getTradableVisitorCount() {
    const visitors = this.gameState.getStateValue('applicants', []);
    return visitors.filter(visitor => visitor._hasTradeOptions).length;
  }

  /**
   * 生成訪客統計資訊
   * @returns {Object} 統計資訊
   */
  getVisitorStats() {
    return {
      total: this.getVisitorCount(),
      hireable: this.getHireableVisitorCount(),
      tradable: this.getTradableVisitorCount(),
      infected: this._getInfectedVisitorCount()
    };
  }

  /**
   * 獲取感染訪客數量
   * @returns {number} 感染訪客數量
   * @private
   */
  _getInfectedVisitorCount() {
    const visitors = this.gameState.getStateValue('applicants', []);
    return visitors.filter(visitor => visitor.revealedInfection).length;
  }
}
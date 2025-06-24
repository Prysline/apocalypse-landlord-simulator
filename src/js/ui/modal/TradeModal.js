// @ts-check
/**
 * TradeModal.js - 交易功能專用模組
 * 職責：交易相關 Modal 管理和業務邏輯處理
 * 繼承 BaseModal 獲得標準化功能
 */

import BaseModal from './BaseModal.js';
import { TradeDescriptionFormatter } from '../TradeDescriptionFormatter.js';
import systemLogger from '../../utils/SystemLogger.js';

export default class TradeModal extends BaseModal {
  constructor(gameApp, uiCore) {
    super(gameApp, uiCore);
  }

  // =================== 對外主要介面 ===================

  /**
   * 顯示 Modal 的主要方法（實作基類抽象方法）
   * @param {string|number} characterId - 角色ID
   */
  show(characterId) {
    this.showTradeModal(characterId);
  }

  /**
   * 顯示交易模態框
   * @param {string|number} characterId - 角色ID
   */
  showTradeModal(characterId) {
    return this._safeExecute(async () => {
      if (!this.gameApp.tradeManager) {
        this._addGameLog("交易系統未載入", "danger");
        return;
      }

      // 獲取角色交易選項
      const rawTradeOptions = this.gameApp.tradeManager.getCharacterTradeOptions(characterId);

      // 在UI層添加描述格式化
      const formattedOptions = this.formatTradeOptionsForDisplay(rawTradeOptions);

      // 找到角色資訊
      const character = this._findCharacterById(characterId);
      if (!character) {
        this._addGameLog("找不到指定角色", "danger");
        return;
      }

      // 設置交易模態框內容
      this._setTradeContent(character, formattedOptions);
      this._showModal('tradeModal');

      // 立即更新所有相關按鈕狀態
      this._updateAllTradeButtonStates(character.id, formattedOptions.length > 0);

      systemLogger.info(`顯示 ${character.name} 的交易選項，共 ${formattedOptions.length} 個`);
    }, 'showTradeModal');
  }

  /**
   * 執行交易
   * @param {string} tradeOptionId - 交易選項ID
   */
  async executeTrade(tradeOptionId) {
    return await this._safeExecute(async () => {
      if (!this.gameApp.tradeManager) {
        this._addGameLog("交易系統未載入", "danger");
        return;
      }

      systemLogger.info(`執行交易: ${tradeOptionId}`);

      // 執行交易
      const result = await this.gameApp.tradeManager.executeResourceTrade(tradeOptionId);

      if (result.success) {
        // 交易成功
        const description = TradeDescriptionFormatter.formatTradeExecutionDescription(result.transaction);
        this._addGameLog(description, 'rent');

        // 關閉交易模態框並更新顯示
        this._closeModal('tradeModal');
        this.uiCore?.updateAll();

        systemLogger.success(`交易執行成功: ${description}`);
      } else {
        // 交易失敗
        this._addGameLog(`交易失敗: ${result.error}`, "danger");
        systemLogger.error(`交易失敗: ${result.error}`);
      }
    }, 'executeTrade');
  }

  /**
   * 收租
   */
  async collectRent() {
    return await this._safeExecute(async () => {
      if (!this.gameApp.tradeManager?.collectRent) {
        this._addGameLog("收租系統未載入", "danger");
        return;
      }

      const result = await this.gameApp.tradeManager.collectRent();
      if (result.success) {
        this._addGameLog(result.summary, 'rent');
      } else {
        this._addGameLog(result.error || '收租失敗', 'danger');
      }

      // 確保UI更新
      this.uiCore?.updateAll();
    }, 'collectRent');
  }

  // =================== 私有 Modal 內容生成方法 ===================

  /**
   * 設定交易模態框內容
   * @param {Object} character - 角色物件
   * @param {Array} tradeOptions - 交易選項陣列
   * @private
   */
  _setTradeContent(character, tradeOptions) {
    const titleEl = document.getElementById('tradeModalTitle');
    const containerEl = document.getElementById('tradeOptionsContainer');

    if (!titleEl || !containerEl) {
      systemLogger.error("交易模態框元素未找到");
      return;
    }

    // 設置標題
    this._setElementText('tradeModalTitle', `與 ${character?.name || '未知角色'} 交易`);

    const typeIcon = this._getIcon(character.type, 'tenantHuman');

    // 如果沒有交易選項
    if (!tradeOptions || tradeOptions.length === 0) {
      this._updateElement('tradeOptionsContainer', `
        <div class="trade-info">
          <p class="no-trades">${typeIcon} ${character.name} 目前沒有可用的交易選項。</p>
          <p>請稍後再試，或與其他角色交易。</p>
        </div>
      `);
      return;
    }

    // 角色資訊
    const characterInfo = `
    <div class="trade-character-info">
      <h4>${typeIcon}${character?.name} (${character?.typeName || '未知類型'})</h4>
      <p>關係度: ${tradeOptions[0]?.relationship || 50}%</p>
    </div>
  `;

    // 生成交易選項HTML
    const optionsHTML = tradeOptions.map(option =>
      this._generateTradeOptionHTML(option)
    ).join('');

    const containerHTML = `
    ${characterInfo}
    <div class="trade-options-list">
      ${optionsHTML}
    </div>
    `;

    this._updateElement('tradeOptionsContainer', containerHTML);
  }

  /**
   * 生成單個交易選項的HTML
   * @param {Object} option - 交易選項
   * @returns {string} HTML字串
   * @private
   */
  _generateTradeOptionHTML(option) {
    const resourceName = this._getResourceDisplayName(option.item || option.resourceType)
    const currentCash = this.gameState.getStateValue('resources.cash', 0);
    const canAfford = currentCash >= option.price;

    // 直接內聯格式化邏輯
    const urgencyClass = `urgency-${option.urgency}`;
    const priceDisplay = option.price !== option.originalPrice
      ? `$${option.price} <span style="color: #888; text-decoration: line-through;">($${option.originalPrice})</span>`
      : `$${option.price}`;

    const disabledClass = canAfford ? '' : 'trade-option-disabled';

    // 直接內聯徽章生成
    const urgencyTexts = {
      critical: '🚨 緊急',
      high: '⚠️ 急迫',
      medium: '📋 一般',
      low: '💭 可選'
    };

    const typeTexts = {
      'buy': '購買需求',
      'sell': '出售提議',
      'emergency': '緊急交易'
    };

    const urgencyIcon = option.urgency === 'critical' ? '⚠️ ' : '';
    const typeBadgeText = urgencyIcon + typeTexts[option.type];

    return `
      <div class="trade-option-card ${urgencyClass} ${disabledClass}" data-option-id="${option.id}">
        <div class="trade-option-header">
            <span class="trade-type-badge type-${option.type}">${typeBadgeText}</span>
            <span class="trade-urgency-badge urgency-${option.urgency}">${urgencyTexts[option.urgency]}</span>
        </div>

        <div class="trade-option-body">
          <div class="trade-option-main">
              <div class="trade-description">${option.description}</div>
              <div class="trade-details">
                <p><strong>物品:</strong> ${resourceName} x${option.quantity}
                <p><strong>價格:</strong> ${priceDisplay}</p>
              </div>
          </div>

          <div class="trade-option-actions">
            <button
              class="btn ${canAfford ? 'btn-primary' : 'btn-disabled'}"
              onclick="uiCore?.executeTrade('${option.id}')"
              ${!canAfford ? 'disabled' : ''}
              title="${canAfford ? '執行交易' : '資源不足'}"
            >
              ${canAfford ? '確認交易' : '無法交易'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // =================== 輔助方法 ===================

  /**
   * 格式化交易選項供顯示使用 (UI層職責)
   * @param {Array} rawOptions - 原始交易選項
   * @returns {Array} 格式化後的交易選項
   * @private
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
      priceText: this._formatPriceDisplay(option.price, option.originalPrice)
    }));
  }

  /**
   * 根據ID尋找角色
   * @param {string|number} personId - 角色ID
   * @returns {Object|null} 角色物件
   * @private
   */
  _findCharacterById(personId) {
    return this.gameApp.gameState?.findPersonById(Number(personId)) || null;
  }

  /**
   * 更新所有相關交易按鈕狀態
   * @param {string|number} characterId - 角色ID
   * @param {boolean} hasTradeOptions - 是否有交易選項
   * @private
   */
  _updateAllTradeButtonStates(characterId, hasTradeOptions) {
    // 委託給 UIDisplay 更新租客詳情模態框中的交易按鈕
    if (this.uiCore?.display?.updateTenantModalTradeButton) {
      this.uiCore.display.updateTenantModalTradeButton(characterId, hasTradeOptions);
    }

    // 更新訪客列表中的交易按鈕
    this._updateVisitorTradeButton(characterId, hasTradeOptions);
  }

  /**
   * 更新訪客列表中的交易按鈕狀態
   * @param {string|number} characterId - 角色ID
   * @param {boolean} hasTradeOptions - 是否有交易選項
   * @private
   */
  _updateVisitorTradeButton(characterId, hasTradeOptions) {
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
}
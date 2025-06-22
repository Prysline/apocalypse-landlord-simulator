// @ts-check

/**
 * @fileoverview TradeDescriptionFormatter.js - 交易描述格式化器
 * 職責：統一管理所有交易相關的描述生成邏輯
 * 架構定位：UI層專用，與業務邏輯完全分離
 */

/**
 * 交易描述格式化器
 * 技術設計：純靜態類，無狀態，純函數式描述生成
 * @class
 */
export class TradeDescriptionFormatter {

  /**
   * 主入口：格式化交易選項描述
   * @param {Object} option - 交易選項原始數據
   * @returns {string} 格式化後的描述
   */
  static formatTradeOption(option) {
    console.log(option)
    const { type, character, item, quantity, urgency, resourceType } = option;
    const characterName = character.name;

    switch (type) {
      case 'buy':
        return this.formatBuyingDescription(characterName, item || resourceType, quantity, urgency);
      case 'sell':
        return this.formatSellingDescription(characterName, item || resourceType, quantity);
      case 'emergency':
        return this.formatEmergencyDescription(characterName, item || resourceType, quantity, urgency);
      default:
        return `${characterName} 的交易選項`;
    }
  }

  // ==========================================
  // 交易選項描述生成（從 UniversalTrader 提取）
  // ==========================================

  /**
   * 購買類描述生成
   * 原位置：addBuyingOptions 函數
   */
  static formatBuyingDescription(characterName, resourceType, quantity, urgency) {
    const resourceNames = this.getResourceNames();
    const urgencyTexts = {
      critical: '急需',
      high: '急需',
      medium: '想要購買',
      low: '考慮購買'
    };

    const urgencyText = urgencyTexts[urgency] || '想要購買';
    const resourceName = resourceNames[resourceType] || resourceType;

    return `${characterName} ${urgencyText} ${quantity} ${resourceName}`;
  }

  /**
   * 出售類描述生成
   * 原位置：addSellingOptions 函數
   */
  static formatSellingDescription(characterName, resourceType, quantity) {
    const resourceNames = this.getResourceNames();
    const resourceName = resourceNames[resourceType] || resourceType;

    return `${characterName} 有多餘的 ${quantity} ${resourceName}`;
  }

  /**
   * 緊急交易描述生成
   * 原位置：addEmergencyOptions 函數
   */
  static formatEmergencyDescription(characterName, resourceType, quantity, urgency) {
    const resourceNames = this.getResourceNames();
    const resourceName = resourceNames[resourceType] || resourceType;

    // 根據緊急類型決定描述模式
    if (resourceType === 'food' && urgency === 'critical') {
      return `${characterName} 沒有食物了，願意用高價購買！`;
    } else if (urgency === 'high' || urgency === 'critical') {
      // 緊急出售情況
      return `${characterName} 急需現金，願意低價出售${resourceName}`;
    } else {
      return `${characterName} 緊急交易 ${quantity} ${resourceName}`;
    }
  }

  // ==========================================
  // 互助系統描述生成（從 createMutualAidEvent 提取）
  // ==========================================

  /**
   * 互助事件描述生成
   * 原位置：createMutualAidEvent 函數
   */
  static formatMutualAidDescription(aidEvent) {
    const { subtype, helperName, recipientName, item, amount } = aidEvent;

    switch (subtype) {
      case 'food_aid':
        return `${helperName} 主動分享食物給 ${recipientName}`;

      case 'cash_loan':
        return `${helperName} 借錢給 ${recipientName}`;

      case 'medical_aid':
        return `${helperName} 給了醫療用品給老人 ${recipientName}`;

      default:
        const resourceNames = this.getResourceNames();
        const resourceName = resourceNames[item] || item;
        return `${helperName} 幫助 ${recipientName} (${amount} ${resourceName})`;
    }
  }

  // ==========================================
  // 交易執行描述生成（從 executeBuy/executeSell 提取）
  // ==========================================

  /**
   * 交易執行成功描述
   * 原位置：executeBuy, executeSell 方法
   */
  static formatTradeExecutionDescription(transaction) {
    const { type, characterName, item, quantity, price } = transaction;
    const resourceNames = this.getResourceNames();
    const resourceName = resourceNames[item] || item;

    switch (type) {
      case 'buy':
        return `向 ${characterName} 出售 ${quantity} ${resourceName}，獲得 $${price}`;

      case 'sell':
        return `從 ${characterName} 購買 ${quantity} ${resourceName}，花費 $${price}`;

      case 'emergency':
        if (price < quantity * 3) { // 簡單判斷是否為低價出售
          return `緊急交易：從 ${characterName} 低價收購 ${quantity} ${resourceName}，花費 $${price}`;
        } else {
          return `緊急交易：向 ${characterName} 高價出售 ${quantity} ${resourceName}，獲得 $${price}`;
        }

      default:
        return `與 ${characterName} 交易 ${quantity} ${resourceName}`;
    }
  }

  // ==========================================
  // 配置與工具方法
  // ==========================================

  /**
   * 資源名稱映射表
   * 原位置：分散在 UniversalTrader 各處
   */
  static getResourceNames() {
    return {
      food: '食物',
      materials: '建材',
      medical: '醫療用品',
      fuel: '燃料',
      cash: '現金'
    };
  }

  /**
   * 緊急程度顯示文字
   */
  static getUrgencyDisplayText(urgency) {
    const urgencyMap = {
      critical: '極緊急',
      high: '緊急',
      medium: '一般',
      low: '可選'
    };
    return urgencyMap[urgency] || '普通';
  }

  /**
   * 交易類型顯示文字
   */
  static getTradeTypeDisplayText(type) {
    const typeMap = {
      buy: '購買',
      sell: '出售',
      emergency: '緊急交易'
    };
    return typeMap[type] || '交易';
  }
}

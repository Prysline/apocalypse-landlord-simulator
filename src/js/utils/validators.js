// @ts-check

import systemLogger from "./SystemLogger.js";

/**
 * @fileoverview Validator.js - 輕量級驗證系統
 * 職責：提供關鍵操作的簡單驗證，可選啟用
 */

/**
 * 驗證器選項配置
 * @typedef {Object} ValidatorOptions
 * @property {boolean} [enabled=true] - 是否啟用驗證
 * @property {boolean} [strictMode=false] - 是否使用嚴格模式
 * @property {boolean} [logErrors=true] - 是否記錄錯誤
 */

/**
 * 驗證統計資料
 * @typedef {Object} ValidationStats
 * @property {number} total - 總驗證次數
 * @property {number} passed - 通過次數
 * @property {number} failed - 失敗次數
 * @property {number} skipped - 跳過次數
 */

/**
 * 驗證結果
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - 驗證是否通過
 * @property {string} [reason] - 通過原因
 * @property {string} [error] - 錯誤訊息
 * @property {string} [suggestion] - 修復建議
 */

/**
 * 資源操作配置
 * @typedef {Object} ResourceOperation
 * @property {'spend'|'gain'|'check'} type - 操作類型
 * @property {string} [target] - 目標對象
 * @property {'food'|'materials'|'medical'|'fuel'|'cash'} resourceType - 資源類型
 * @property {number} amount - 數量
 * @property {Object.<string, number>} [currentResources] - 當前資源狀態
 */

/**
 * 租客操作配置
 * @typedef {Object} TenantOperation
 * @property {'hire'|'evict'|'skill'} type - 操作類型
 * @property {Object} [tenant] - 租客物件
 * @property {string} [tenant.name] - 租客姓名
 * @property {number} [tenant.id] - 租客ID
 * @property {'doctor'|'worker'|'farmer'|'soldier'|'elder'} [tenant.type] - 租客類型
 * @property {boolean} [tenant.infected] - 是否感染
 * @property {Object} [room] - 房間物件
 * @property {number} [room.id] - 房間ID
 * @property {Object} [gameState] - 遊戲狀態實例
 */

/**
 * 交易操作配置
 * @typedef {Object} TradeOperation
 * @property {'rent'|'merchant'|'caravan'|'mutual_aid'|'commission'} type - 交易類型
 * @property {string} from - 來源方
 * @property {string} to - 目標方
 * @property {Array} [items] - 交易物品
 * @property {Object.<string, number>} [cost] - 交易成本
 */

/**
 * 批量驗證結果
 * @typedef {Object} BatchValidationResult
 * @property {boolean} valid - 整體是否通過
 * @property {string} [reason] - 原因
 * @property {ValidationResult[]} results - 個別驗證結果
 * @property {number} [failedCount] - 失敗數量
 */

/**
 * 狀態更新物件
 * @typedef {Object} StateUpdate
 * @property {Object.<string, number>} [resources] - 資源更新
 * @property {number} [day] - 天數更新
 * @property {Object} [system] - 系統狀態更新
 */

/**
 * 輕量級驗證系統類
 * @class
 */
export class Validator {
  /**
   * 建立驗證器實例
   * @param {ValidatorOptions} [options={}] - 驗證器配置選項
   */
  constructor(options = {}) {
    this.enabled = options.enabled !== false; // 預設啟用
    this.strictMode = options.strictMode || false; // 嚴格模式
    this.logErrors = options.logErrors !== false; // 預設記錄錯誤

    // 驗證統計
    /** @type {ValidationStats} */
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };
  }

  /**
   * 驗證資源操作
   * @param {ResourceOperation} operation - 資源操作配置
   * @returns {ValidationResult} 驗證結果
   */
  validateResourceOperation(operation) {
    if (!this.enabled) {
      this.stats.skipped++;
      return { valid: true, reason: "validator_disabled" };
    }

    this.stats.total++;

    const { type, target, resourceType, amount, currentResources } = operation;

    // 基本參數檢查
    if (!resourceType || typeof amount !== "number") {
      return this._fail("無效的資源操作參數");
    }

    // 資源類型檢查
    const validTypes = ["food", "materials", "medical", "fuel", "cash"];
    if (!validTypes.includes(resourceType)) {
      return this._fail(`無效的資源類型: ${resourceType}`);
    }

    // 負數檢查（消費操作）
    if (type === "spend" || amount < 0) {
      const currentAmount = currentResources?.[resourceType] || 0;
      const requiredAmount = Math.abs(amount);

      if (currentAmount < requiredAmount) {
        return this._fail(
          `${resourceType} 不足：需要 ${requiredAmount}，目前 ${currentAmount}`
        );
      }
    }

    // 數值範圍檢查
    if (Math.abs(amount) > 10000) {
      return this._fail(`異常的資源數量: ${amount}`);
    }

    return this._pass();
  }

  /**
   * 驗證狀態更新
   * @param {StateUpdate} update - 狀態更新物件
   * @returns {ValidationResult} 驗證結果
   */
  validateStateUpdate(update) {
    if (!this.enabled) {
      this.stats.skipped++;
      return { valid: true, reason: "validator_disabled" };
    }

    this.stats.total++;

    if (!update || typeof update !== "object") {
      return this._fail("狀態更新必須是物件");
    }

    // 檢查是否嘗試修改系統關鍵欄位
    const protectedFields = ["system.initialized"];
    for (const field of protectedFields) {
      if (this._hasNestedField(update, field)) {
        return this._fail(`不允許修改系統欄位: ${field}`);
      }
    }

    // 檢查資源值的合理性
    if (update.resources) {
      for (const [key, value] of Object.entries(update.resources)) {
        if (typeof value !== "number" || value < 0 || value > 50000) {
          return this._fail(`資源值異常: ${key}=${value}`);
        }
      }
    }

    // 檢查天數的合理性
    if (update.day && (update.day < 1 || update.day > 1000)) {
      return this._fail(`天數值異常: ${update.day}`);
    }

    return this._pass();
  }

  /**
   * 驗證租客操作
   * @param {TenantOperation} operation - 租客操作配置
   * @returns {ValidationResult} 驗證結果
   */
  validateTenantOperation(operation) {
    if (!this.enabled) {
      this.stats.skipped++;
      return { valid: true, reason: "validator_disabled" };
    }

    this.stats.total++;

    const { type, tenant, room, gameState } = operation;

    switch (type) {
      case "hire":
        if (!tenant || !tenant.name || !tenant.type) {
          return this._fail("租客資料不完整");
        }
        if (!room) {
          return this._fail("房間不可用");
        }
        break;

      case "evict":
        if (!tenant) {
          return this._fail("租客物件無效");
        }

        if (!room) {
          return this._fail("房間物件無效");
        }

        // 驗證租客是否在指定房間中
        if (gameState) {
          const currentTenant = gameState.getRoomTenant(room.id);
          if (!currentTenant) {
            return this._fail("房間內沒有租客");
          }
          if (currentTenant.id !== tenant.id) {
            return this._fail("租客不在指定房間中");
          }
        }
        break;

      case "skill":
        if (!tenant || tenant.infected) {
          return this._fail("感染租客無法使用技能");
        }
        break;

      default:
        return this._fail(`未知的租客操作: ${type}`);
    }

    return this._pass();
  }

  /**
   * 驗證交易操作
   * @param {TradeOperation} trade - 交易操作配置
   * @returns {ValidationResult} 驗證結果
   */
  validateTradeOperation(trade) {
    if (!this.enabled) {
      this.stats.skipped++;
      return { valid: true, reason: "validator_disabled" };
    }

    this.stats.total++;

    const { type, from, to, items, cost } = trade;

    // 基本結構檢查
    if (!type || !from || !to) {
      return this._fail("交易參數不完整");
    }

    // 交易類型檢查
    const validTypes = ["rent", "merchant", "caravan", "mutual_aid"];
    if (!validTypes.includes(type)) {
      return this._fail(`無效的交易類型: ${type}`);
    }

    // 成本檢查
    if (cost && typeof cost === "object") {
      for (const [resource, amount] of Object.entries(cost)) {
        if (typeof amount !== "number" || amount < 0) {
          return this._fail(`無效的成本: ${resource}=${amount}`);
        }
      }
    }

    return this._pass();
  }

  /**
   * 快速驗證（最常用）
   * @param {boolean} condition - 驗證條件
   * @param {string} [message] - 失敗時的錯誤訊息
   * @returns {ValidationResult} 驗證結果
   */
  quick(condition, message) {
    if (!this.enabled) {
      this.stats.skipped++;
      return { valid: true, reason: "validator_disabled" };
    }

    this.stats.total++;

    if (!condition) {
      return this._fail(message || "驗證失敗");
    }

    return this._pass();
  }

  /**
   * 批量驗證
   * @param {Array<() => ValidationResult>} validations - 驗證函數陣列
   * @returns {BatchValidationResult} 批量驗證結果
   */
  batch(validations) {
    if (!this.enabled) {
      return { valid: true, reason: "validator_disabled", results: [] };
    }

    const results = [];
    let allValid = true;

    for (const validation of validations) {
      const result = validation();
      results.push(result);
      if (!result.valid) {
        allValid = false;
        if (this.strictMode) {
          break; // 嚴格模式下，第一個失敗就停止
        }
      }
    }

    return {
      valid: allValid,
      results,
      failedCount: results.filter((r) => !r.valid).length,
    };
  }

  /**
   * 成功結果
   * @param {string} [reason="validation_passed"] - 通過原因
   * @returns {ValidationResult} 成功的驗證結果
   * @private
   */
  _pass(reason = "validation_passed") {
    this.stats.passed++;
    return { valid: true, reason };
  }

  /**
   * 失敗結果
   * @param {string} message - 錯誤訊息
   * @returns {ValidationResult} 失敗的驗證結果
   * @private
   */
  _fail(message) {
    this.stats.failed++;

    if (this.logErrors) {
      systemLogger.error("🚨 驗證失敗:", message);
    }

    return {
      valid: false,
      error: message,
      suggestion: this._getSuggestion(message),
    };
  }

  /**
   * 檢查嵌套欄位
   * @param {Object} obj - 要檢查的物件
   * @param {string} path - 欄位路徑（用點分隔）
   * @returns {boolean} 是否存在該欄位
   * @private
   */
  _hasNestedField(obj, path) {
    const keys = path.split(".");
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * 提供修復建議
   * @param {string} message - 錯誤訊息
   * @returns {string} 修復建議
   * @private
   */
  _getSuggestion(message) {
    if (message.includes("不足")) {
      return "檢查資源庫存或降低需求量";
    }
    if (message.includes("無效")) {
      return "確認參數格式和有效範圍";
    }
    if (message.includes("房間")) {
      return "檢查房間狀態和租客安排";
    }
    return "檢查操作條件和參數";
  }

  /**
   * 取得驗證統計
   * @returns {ValidationStats & {successRate: string, enabled: boolean}} 包含成功率的驗證統計
   */
  getStats() {
    return {
      ...this.stats,
      successRate:
        this.stats.total > 0
          ? ((this.stats.passed / this.stats.total) * 100).toFixed(1) + "%"
          : "0%",
      enabled: this.enabled,
    };
  }

  /**
   * 重設統計
   * @returns {void}
   */
  resetStats() {
    this.stats = { total: 0, passed: 0, failed: 0, skipped: 0 };
  }

  /**
   * 啟用/停用驗證器
   * @param {boolean} enabled - 是否啟用
   * @returns {void}
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    systemLogger.info(`驗證器已${enabled ? "啟用" : "停用"}`);
  }

  /**
   * 設定嚴格模式
   * @param {boolean} strict - 是否啟用嚴格模式
   * @returns {void}
   */
  setStrictMode(strict) {
    this.strictMode = strict;
    systemLogger.info(`${strict ? "啟用" : "停用"}嚴格驗證模式`);
  }
}

/**
 * 全域驗證器實例（單例模式）
 * @type {Validator|null}
 */
let globalValidator = null;

/**
 * 取得全域驗證器實例
 * @param {ValidatorOptions} [options={}] - 驗證器配置選項
 * @returns {Validator} 驗證器實例
 */
export function getValidator(options = {}) {
  if (!globalValidator) {
    globalValidator = new Validator(options);
  }
  return globalValidator;
}

/**
 * 快速驗證函數（最常用）
 * @param {boolean} condition - 驗證條件
 * @param {string} [message] - 失敗時的錯誤訊息
 * @returns {ValidationResult} 驗證結果
 */
export function validate(condition, message) {
  return getValidator().quick(condition, message);
}

/**
 * 資源驗證快捷方式
 * @param {ResourceOperation} operation - 資源操作配置
 * @returns {ValidationResult} 驗證結果
 */
export function validateResource(operation) {
  return getValidator().validateResourceOperation(operation);
}

/**
 * 狀態驗證快捷方式
 * @param {StateUpdate} update - 狀態更新物件
 * @returns {ValidationResult} 驗證結果
 */
export function validateState(update) {
  return getValidator().validateStateUpdate(update);
}

export default Validator;

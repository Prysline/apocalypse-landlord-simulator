/**
 * Constants - 純系統級常數管理模組
 * 職責：僅管理技術實作相關的不可配置常數
 * 所有遊戲數據、預設值、平衡參數已移至 rules.json
 */

/**
 * 系統技術限制（硬編碼邊界）
 */
export const SYSTEM_LIMITS = Object.freeze({
  // 容器大小限制（防止記憶體溢出）
  HISTORY: {
    MAX_LOG_ENTRIES: 100,
    MAX_EXECUTION_HISTORY: 100,
    MAX_ERROR_LOG: 50
  },

  // 資料結構限制（防止系統崩潰）
  DATA_STRUCTURE: {
    MAX_ARRAY_SIZE: 1000,
    MAX_OBJECT_DEPTH: 10,
    MAX_STRING_LENGTH: 10000,
    MAX_NUMBER_VALUE: Number.MAX_SAFE_INTEGER
  },

  // 事件系統限制（防止配置錯誤）
  EVENTS: {
    MAX_CHOICES_PER_EVENT: 20,
    MAX_CONDITIONS_PER_CHOICE: 10,
    MAX_EFFECTS_PER_CHOICE: 15,
    MAX_NESTED_CONDITIONS: 5
  },

  // 模組系統限制
  MODULES: {
    MAX_VALIDATION_ERRORS: 100,
    MAX_RETRY_ATTEMPTS: 3,
    TIMEOUT_MS: 30000
  }
});

/**
 * UI技術常數（瀏覽器相關固定值）
 */
export const UI_CONSTANTS = Object.freeze({
  // 動畫時間（與CSS同步）
  ANIMATION: {
    PULSE_DURATION: 2000,
    TRANSITION_DURATION: 300,
    HOVER_DELAY: 100,
    MODAL_FADE_DURATION: 200,
    DEBOUNCE_DELAY: 250
  },

  // 布局技術參數
  LAYOUT: {
    MAX_CONTAINER_WIDTH: 1200,
    SIDEBAR_WIDTH: 300,
    MODAL_MAX_WIDTH: 500,
    MODAL_MAX_HEIGHT_PERCENT: 80,
    ROOM_ASPECT_RATIO: 1,
    MOBILE_BREAKPOINT: 768
  },

  // 瀏覽器相容性
  BROWSER: {
    MIN_CHROME_VERSION: 61,
    MIN_FIREFOX_VERSION: 60,
    MIN_SAFARI_VERSION: 10.1,
    REQUIRED_FEATURES: ['modules', 'fetch', 'promise']
  },

  // CSS類名與ID（避免硬編碼）
  SELECTORS: {
    GAME_LOG: 'gameLog',
    SYSTEM_STATUS: 'systemStatus',
    VISITOR_MODAL: 'visitorModal',
    SKILL_MODAL: 'skillModal'
  }
});

/**
 * 系統事件類型標識符
 */
export const EVENT_TYPES = Object.freeze({
  // 系統生命週期事件
  SYSTEM: {
    INITIALIZATION: 'system:initialization',
    SHUTDOWN: 'system:shutdown',
    ERROR_OCCURRED: 'system:error',
    HEALTH_CHECK: 'system:health_check',
    CONFIG_LOADED: 'system:config_loaded'
  },

  // 資料管理事件
  DATA: {
    LOADED: 'data:loaded',
    VALIDATED: 'data:validated',
    CACHED: 'data:cached',
    EXPIRED: 'data:expired',
    ERROR: 'data:error'
  },

  // 規則引擎事件
  RULE: {
    EXECUTED: 'rule:executed',
    FAILED: 'rule:failed',
    REGISTERED: 'rule:registered',
    CONDITION_MET: 'rule:condition_met'
  },

  // 業務邏輯事件
  GAME: {
    STATE_CHANGED: 'game:state_changed',
    DAY_ADVANCED: 'game:day_advanced',
    RESOURCE_UPDATED: 'game:resource_updated'
  }
});

/**
 * 資料類型枚舉
 */
export const DATA_TYPES = Object.freeze({
  // 核心資料類型
  TENANTS: 'tenants',
  SKILLS: 'skills', 
  EVENTS: 'events',
  RULES: 'rules',

  // 遊戲實體類型
  TENANT_TYPES: {
    DOCTOR: 'doctor',
    WORKER: 'worker',
    FARMER: 'farmer',
    SOLDIER: 'soldier',
    ELDER: 'elder'
  },

  SKILL_TYPES: {
    ACTIVE: 'active',
    PASSIVE: 'passive',
    SPECIAL: 'special'
  },

  RESOURCE_TYPES: {
    FOOD: 'food',
    MATERIALS: 'materials',
    MEDICAL: 'medical',
    FUEL: 'fuel',
    CASH: 'cash'
  }
});

/**
 * 系統錯誤代碼
 */
export const ERROR_CODES = Object.freeze({
  // 系統初始化錯誤
  SYSTEM_INIT_FAILED: 'SYSTEM_INIT_FAILED',
  MODULE_LOAD_FAILED: 'MODULE_LOAD_FAILED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // 資料相關錯誤
  DATA_NOT_FOUND: 'DATA_NOT_FOUND',
  DATA_VALIDATION_FAILED: 'DATA_VALIDATION_FAILED',
  DATA_LOAD_FAILED: 'DATA_LOAD_FAILED',
  DATA_CACHE_ERROR: 'DATA_CACHE_ERROR',

  // 遊戲邏輯錯誤
  INVALID_OPERATION: 'INVALID_OPERATION',
  PRECONDITION_NOT_MET: 'PRECONDITION_NOT_MET',
  RESOURCE_INSUFFICIENT: 'RESOURCE_INSUFFICIENT',

  // 使用者介面錯誤
  UI_ELEMENT_NOT_FOUND: 'UI_ELEMENT_NOT_FOUND',
  EVENT_HANDLER_ERROR: 'EVENT_HANDLER_ERROR',
  RENDER_ERROR: 'RENDER_ERROR'
});

/**
 * 系統訊息模板
 */
export const MESSAGE_TEMPLATES = Object.freeze({
  // 系統狀態訊息
  SYSTEM: {
    INITIALIZING: '系統初始化中...',
    READY: '系統就緒',
    ERROR: (error) => `系統錯誤: ${error}`,
    SHUTDOWN: '系統正在關閉...'
  },

  // 資料操作訊息
  DATA: {
    LOADING: (type) => `正在載入 ${type} 資料...`,
    LOADED: (type) => `${type} 資料載入完成`,
    ERROR: (type, error) => `${type} 資料載入失敗: ${error}`,
    VALIDATED: (type) => `${type} 資料驗證通過`
  },

  // 遊戲操作回饋
  GAME: {
    ACTION_SUCCESS: (action) => `${action} 執行成功`,
    ACTION_FAILED: (action, reason) => `${action} 執行失敗: ${reason}`,
    STATE_CHANGED: (what) => `${what} 狀態已更新`,
    RESOURCE_GAINED: (amount, type) => `獲得 ${amount} ${type}`,
    RESOURCE_LOST: (amount, type) => `失去 ${amount} ${type}`
  },

  // 錯誤處理訊息
  ERROR: {
    GENERIC: '發生未知錯誤',
    INSUFFICIENT_DATA: '資料不足',
    INVALID_INPUT: '輸入無效',
    OPERATION_DENIED: '操作被拒絕',
    TIMEOUT: '操作超時'
  }
});

/**
 * 開發與除錯配置
 */
export const DEV_CONFIG = Object.freeze({
  // 日誌等級
  LOG_LEVELS: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
  },

  // 除錯模式
  DEBUG_MODE: {
    ENABLED: false,
    SHOW_PERFORMANCE: false,
    DETAILED_LOGGING: false,
    MOCK_DATA: false
  },

  // 效能監控
  PERFORMANCE: {
    ENABLE_METRICS: false,
    SAMPLE_RATE: 0.1,
    MAX_EXECUTION_TIME_WARNING: 100
  }
});

/**
 * 系統工具類
 */
export class SystemUtils {
  /**
   * 檢查瀏覽器支援度
   */
  static checkBrowserSupport() {
    const requiredFeatures = UI_CONSTANTS.BROWSER.REQUIRED_FEATURES;
    const unsupported = [];

    if (!window.fetch) unsupported.push('fetch');
    if (!window.Promise) unsupported.push('promise');
    if (!document.createElement('script').noModule === undefined) {
      unsupported.push('modules');
    }

    return {
      supported: unsupported.length === 0,
      missing: unsupported
    };
  }

  /**
   * 取得系統資訊
   */
  static getSystemInfo() {
    return {
      version: '2.0.0',
      architecture: 'ES6 Modules',
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform
      },
      constants: {
        systemLimits: Object.keys(SYSTEM_LIMITS).length,
        errorCodes: Object.keys(ERROR_CODES).length,
        eventTypes: Object.keys(EVENT_TYPES).length
      }
    };
  }

  /**
   * 驗證系統常數完整性
   */
  static validateConstants() {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // 檢查必要常數
    const requiredConstants = [
      'SYSTEM_LIMITS.HISTORY.MAX_LOG_ENTRIES',
      'UI_CONSTANTS.ANIMATION.PULSE_DURATION',
      'ERROR_CODES.SYSTEM_INIT_FAILED'
    ];

    requiredConstants.forEach(path => {
      if (!this.getNestedValue(path)) {
        validation.isValid = false;
        validation.errors.push(`缺少必要常數: ${path}`);
      }
    });

    return validation;
  }

  /**
   * 取得嵌套常數值
   * @private
   */
  static getNestedValue(path) {
    const parts = path.split('.');
    let current = window;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

/**
 * 預設匯出：純系統級常數集合
 */
export default {
  SYSTEM_LIMITS,
  UI_CONSTANTS,
  EVENT_TYPES,
  DATA_TYPES,
  ERROR_CODES,
  MESSAGE_TEMPLATES,
  DEV_CONFIG,
  SystemUtils
};

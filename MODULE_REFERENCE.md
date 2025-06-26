{% raw %}
# 末日房東模擬器 - 模組參考手冊

本文件提供系統中所有模組的完整API參考，包含實作狀態、依賴關係和錯誤處理模式。

## 📋 模組架構總覽

系統採用分層架構設計，嚴格實施單向依賴關係：

```
main.js (整合層)
   ↓
DayManager (協調層)
   ↓
業務管理器層: TenantManager → TradeManager → ResourceManager
   ↓                ↓              ↓
SkillManager ←──────┴──────────────┘
   ↓
BaseManager (基礎層)
   ↓
核心服務層: GameState ← EventBus ← DataManager
   ↓
工具基礎層: helpers ← validators ← constants ← Type
```

### 依賴關係分類

**直接依賴**（建構函數注入，生命週期耦合）
- DayManager → 所有業務管理器
- TenantManager → TradeManager + ResourceManager
- TradeManager → RentManager + UniversalTrader + CommissionHandler + ExplorationManager + TenantManager
- 所有業務管理器 → BaseManager + GameState + EventBus

**協作關係**（運行時調用，功能性協作）
- UICore ↔ 業務管理器（統一介面觸發業務邏輯）
- Modal子模組 ↔ UICore（委託模式，功能分離）
- 業務管理器 ↔ GameState（狀態讀寫）
- 業務管理器 ↔ EventBus（事件通信）

## 🎯 統一錯誤處理標準

所有業務方法遵循一致的回傳格式：

### 成功回傳
```javascript
{
  success: true,
  data: { /* 實際業務資料 */ },
  message?: "操作成功描述"
}
```

### 失敗回傳
```javascript
{
  success: false,
  error: "ERROR_CODE_OR_MESSAGE",
  reason?: "詳細失敗原因",
  suggestion?: "修復建議"
}
```

### 特定業務格式
```javascript
// 租客雇用結果
{ success: true, tenant: Tenant, roomId: number, reason: string }

// 技能執行結果
{ success: true, skillId: string, effects: Array, cooldownSet: number }

// 租金收取結果
{ success: true, totalCashRent: number, bonusIncome: number, summary: string }

// 交易執行結果
{
  success: true,
  transaction: { type: string, item: string, quantity: number, price: number, characterName: string },
  satisfaction?: number
}
```

## 📡 事件類型架構

系統使用三層事件命名架構，支援智慧前綴解析：

### 系統級事件（跨模組生命週期）
- `system_ready` - 系統初始化完成
- `system_error` - 系統級錯誤
- `day_advanced` - 天數推進
- `game_state_changed` - 遊戲狀態變更

### 業務領域事件（跨模組流程）
- `harvest_request` / `harvest_completed` - 採集流程
- `scavenge_request` / `scavenge_completed` - 搜刮流程

### 模組專屬事件（自動添加前綴）
- ResourceManager: `resource_modified`, `resource_transfer_completed`
- TenantManager: `tenant_hired`, `tenant_evicted`, `tenant_satisfaction_changed`
- SkillManager: `skill_executed`, `skill_passive_triggered`
- TradeManager: `collectRentCompleted`, `resourceTradeCompleted`, `mutualAidCompleted`

## 🏗️ 核心模組API參考

### DataManager
**位置**: `src/js/core/DataManager.js`
**職責**: 統一資料管理核心
**依賴**: `SystemLogger`, `utils/constants.js`, `utils/helpers.js`

#### 主要方法
```javascript
/**
 * 初始化並載入所有配置檔案
 * @returns {Promise<LoadResult>}
 */
async initialize()

/**
 * 取得遊戲規則配置
 * @returns {GameRules}
 * @throws {Error} 當配置未載入時
 */
getGameRules()

/**
 * 路徑式規則值取得
 * @param {string} path - 點記法路徑
 * @returns {any}
 */
getRuleValue(path)

/**
 * 取得租客類型配置
 * @returns {Array<TenantTypeConfig>}
 */
getTenantTypes()

/**
 * 取得完整技能配置
 * @returns {Array<SkillConfig>}
 */
getAllSkills()

/**
 * 驗證已載入資料的完整性
 * @private
 * @returns {void}
 * @throws {Error} 當資料結構不正確時
 */
_validateLoadedData()
```

#### 使用範例
```javascript
import systemLogger from '../utils/SystemLogger.js';

const dataManager = new DataManager();

const result = await dataManager.initialize();

if (result.success) {
  // 配置路徑存取
  const initialFood = dataManager.getRuleValue('gameDefaults.initialResources.food');
  const exchangeRates = dataManager.getRuleValue('gameBalance.economy.rentPayment.resourceExchangeRates');

  // 技能配置篩選
  const allSkills = dataManager.getAllSkills();
  const doctorSkills = allSkills.filter(skill => skill.tenantType === 'doctor');

  systemLogger.success('DataManager 初始化完成');
} else {
  systemLogger.error('DataManager 初始化失敗', result.error);
}
```

#### 與 main.js 整合範例
```javascript
// main.js 中負責LoadingManager協調
try {
  systemLogger.info("📊 開始載入遊戲資料");
  const dataResult = await this.dataManager.initialize();
  loadingManager.updateProgress('data_loading');
  systemLogger.success("✅ 遊戲資料載入完成");
} catch (error) {
  systemLogger.error("資料載入階段失敗", error);
  loadingManager.updateProgress('data_loading', false, error.message);
  throw error;
}
```

#### 效能特性
- **載入方式**: 並行載入四個配置檔案，任一失敗進入快速失敗模式
- **記憶體使用**: 配置資料常駐記憶體，約2-3MB
- **錯誤恢復**: 快速失敗策略，使用SystemLogger統一錯誤輸出
- **資料驗證**: 載入後自動驗證資料結構完整性

### GameState
**位置**: `src/js/core/GameState.js`
**職責**: 中央狀態管理系統
**依賴**: `utils/helpers.js`

#### 主要方法
```javascript
/**
 * 路徑式狀態取得
 * @param {string} path - 點記法路徑
 * @param {*} defaultValue - 預設值
 * @returns {*}
 */
getStateValue(path, defaultValue)

/**
 * 批量狀態更新
 * @param {Partial<GameStateData>} updates - 更新資料
 * @param {string} reason - 更新原因（必填）
 * @returns {boolean}
 */
setState(updates, reason)

/**
 * 資源修改
 * @param {ResourceType} resourceType - 'food'|'materials'|'medical'|'fuel'|'cash'
 * @param {number} amount - 變更數量
 * @param {string} reason - 修改原因
 * @returns {boolean}
 */
modifyResource(resourceType, amount, reason)

/**
 * 房間租客查詢
 * @param {number} roomId - 房間ID
 * @returns {Person|null}
 */
getRoomTenant(roomId)

/**
 * 推進遊戲天數
 * @returns {boolean}
 */
advanceDay()

/**
 * 統一人物查詢
 * @param {number} personId - 人物ID
 * @returns {Person|null}
 */
findPersonById(personId)
```

#### 使用範例
```javascript
// 狀態查詢
const currentCash = gameState.getStateValue('resources.cash', 0);
const roomTenant = gameState.getRoomTenant(1);

// 資源操作
gameState.modifyResource('food', -5, '每日消費');

// 批量更新
gameState.setState({
  dailyActions: { rentCollected: true },
  day: gameState.getStateValue('day', 1) + 1
}, '收租完成並推進天數');

// 人物查詢（類型安全）
const person = gameState.findPersonById(Number(personId));
```

#### 效能特性
- **狀態保護**: 深度複製防止意外修改
- **歷史追蹤**: 變更歷史限制100筆記錄
- **並發控制**: 狀態鎖定機制防止衝突
- **ID類型處理**: 統一的數字型ID管理，避免字串/數字混用問題

### EventBus
**位置**: `src/js/core/EventBus.js`
**職責**: 事件通信系統
**依賴**: `utils/constants.js`

#### 主要方法
```javascript
/**
 * 監聽事件
 * @param {string} eventType - 事件類型
 * @param {EventListener} listener - 監聽器函數
 * @param {ListenerOptions} options - 監聽選項
 * @returns {UnsubscribeFunction}
 */
on(eventType, listener, options = {})

/**
 * 發送同步事件
 * @param {string} eventType - 事件類型
 * @param {any} data - 事件資料
 * @param {EmitOptions} options - 發送選項
 * @returns {EmitResult}
 */
emit(eventType, data, options = {})

/**
 * 發送非同步事件
 * @param {string} eventType - 事件類型
 * @param {any} data - 事件資料
 * @param {EmitOptions} options - 發送選項
 * @returns {Promise<EmitResult>}
 */
async emitAsync(eventType, data, options = {})

/**
 * 一次性監聽
 * @param {string} eventType - 事件類型
 * @param {EventListener} listener - 監聽器函數
 * @returns {UnsubscribeFunction}
 */
once(eventType, listener)
```

#### 使用範例
```javascript
const eventBus = new EventBus();

// 事件監聽
const unsubscribe = eventBus.on('resource_modified', (eventObj) => {
  const { resourceType, changeAmount } = eventObj.data;
  console.log(`資源變更: ${resourceType} ${changeAmount}`);
});

// 事件發送
eventBus.emit('tenant_hired', { tenantId: 1, roomId: 2 });

// 非同步處理
const result = await eventBus.emitAsync('system_shutdown', { reason: 'user_request' });
```

#### 效能特性
- **監聽器限制**: 單一事件監聽器建議不超過10個
- **事件頻率**: 高頻事件建議使用節流控制
- **記憶體管理**: 事件歷史限制50筆記錄

### SystemLogger
**位置**: `src/js/utils/SystemLogger.js`
**職責**: 統一系統級訊息管理，與遊戲日誌完全分離
**依賴**: `utils/constants.js`

#### 主要方法
```javascript
/**
 * 輸出資訊日誌
 * @param {string} message - 日誌訊息
 * @param {string|Object} [extra] - 額外資訊（字串或物件）
 * @param {Object} [data] - 結構化資料物件
 * @param {SystemLogOptions} [options] - 日誌選項
 * @returns {void}
 */
info(message, extra, data, options)

/**
 * 輸出警告日誌
 * @param {string} message - 警告訊息
 * @param {string|Object} [extra] - 額外資訊（字串或物件）
 * @param {Object} [data] - 結構化資料物件
 * @param {SystemLogOptions} [options] - 日誌選項
 * @returns {void}
 */
warn(message, extra, data, options)

/**
 * 輸出錯誤日誌
 * @param {string} message - 錯誤訊息
 * @param {Error|string} [error] - 錯誤物件或詳細資訊
 * @param {Object} [data] - 額外的除錯資料
 * @param {SystemLogOptions} [options] - 日誌選項
 * @returns {void}
 */
error(message, error, data, options)

/**
 * 輸出成功日誌
 * @param {string} message - 成功訊息
 * @param {string|Object} [extra] - 額外資訊（字串或物件）
 * @param {Object} [data] - 結構化資料物件
 * @param {SystemLogOptions} [options] - 日誌選項
 * @returns {void}
 */
success(message, extra, data, options)

/**
 * 輸出除錯日誌（僅在除錯模式下顯示）
 * @param {string} message - 除錯訊息
 * @param {string|Object} [extra] - 額外資訊（字串或物件）
 * @param {Object} [data] - 結構化資料物件
 * @param {SystemLogOptions} [options] - 日誌選項
 * @returns {void}
 */
debug(message, extra, data, options)
```

#### 分組功能方法
```javascript
/**
 * 開始日誌分組
 * @param {string} label - 分組標籤
 * @param {SystemLogOptions} [options] - 日誌選項
 * @returns {void}
 */
group(label, options)

/**
 * 開始收合的日誌分組
 * @param {string} label - 分組標籤
 * @param {SystemLogOptions} [options] - 日誌選項
 * @returns {void}
 */
groupCollapsed(label, options)

/**
 * 結束當前日誌分組
 * @returns {void}
 */
groupEnd()

/**
 * 帶自動結束的分組執行器
 * @param {string} label - 分組標籤
 * @param {Function} executor - 要在分組中執行的函數
 * @param {boolean} [collapsed=false] - 是否預設收合
 * @param {SystemLogOptions} [options] - 日誌選項
 * @returns {Promise<any>|any} 執行器的返回值
 */
async withGroup(label, executor, collapsed, options)
```

#### MESSAGE_TEMPLATES 便捷方法
```javascript
/**
 * 輸出系統初始化訊息
 * @returns {void}
 */
initializing()

/**
 * 輸出系統就緒訊息
 * @returns {void}
 */
ready()

/**
 * 輸出系統錯誤訊息
 * @param {string} errorMessage - 錯誤描述
 * @returns {void}
 */
systemError(errorMessage)

/**
 * 輸出資料載入訊息
 * @param {string} dataType - 資料類型
 * @returns {void}
 */
dataLoading(dataType)

/**
 * 輸出資料載入完成訊息
 * @param {string} dataType - 資料類型
 * @returns {void}
 */
dataLoaded(dataType)

/**
 * 輸出資料載入錯誤訊息
 * @param {string} dataType - 資料類型
 * @param {string} errorMessage - 錯誤描述
 * @returns {void}
 */
dataError(dataType, errorMessage)
```

#### 配置管理方法
```javascript
/**
 * 設定除錯模式
 * @param {boolean} enabled - 是否啟用除錯模式
 * @returns {void}
 */
setDebugMode(enabled)

/**
 * 設定預設前綴
 * @param {string} prefix - 新的預設前綴
 * @returns {void}
 */
setDefaultPrefix(prefix)

/**
 * 取得當前配置狀態
 * @returns {Object} 配置狀態
 */
getStatus()
```

#### 使用範例
```javascript
import systemLogger from '../utils/SystemLogger.js';

// 基本日誌輸出
systemLogger.info('系統準備完成');
systemLogger.warn('配置檔案部分缺失');
systemLogger.error('載入失敗', new Error('檔案不存在'));
systemLogger.success('初始化成功');

// 多參數輸出（支援除錯資料）
systemLogger.debug(
  '發送事件完成',
  '[跨模組事件]',
  { eventName: 'resource_modified', data: { type: 'food', amount: 10 } }
);

// MESSAGE_TEMPLATES 便捷方法
systemLogger.initializing();
systemLogger.dataLoading('租客資料');
systemLogger.dataLoaded('租客資料');
systemLogger.ready();

// 分組功能
systemLogger.group('系統初始化流程');
systemLogger.info('載入配置檔案');
systemLogger.info('建立管理器');
systemLogger.groupEnd();

// 自動管理分組
systemLogger.withGroup('DataManager 除錯資訊', () => {
  systemLogger.info('配置檔案數量: 4');
  systemLogger.info('載入狀態: 完成');

  systemLogger.withGroup('詳細統計', () => {
    systemLogger.debug('rules.json: 載入成功');
    systemLogger.debug('tenants.json: 載入成功');
  });
});

// 配置管理
systemLogger.setDebugMode(true);
systemLogger.setDefaultPrefix('🔧 GAME');

// 狀態查詢
const status = systemLogger.getStatus();
console.log('除錯模式:', status.debugEnabled);
```

#### 技術特性
- **訊息分離**: 系統級訊息與遊戲日誌完全分離，避免混淆
- **多參數支援**: 支援 console.debug 風格的多參數輸出格式
- **智能參數檢測**: 自動識別參數類型，正確處理字串、物件和選項
- **分組管理**: 完整的分組功能，支援手動和自動管理模式
- **錯誤處理**: 內建緊急後備機制，確保日誌輸出不會失敗
- **配置驅動**: 支援動態配置前綴、除錯模式和輸出格式

#### 效能特性
- **輸出效能**: 單次日誌輸出 <1ms，分組操作 <5ms
- **記憶體使用**: 零持久狀態存儲，最小記憶體佔用
- **錯誤隔離**: 日誌系統錯誤不影響業務邏輯執行
- **除錯模式**: debug() 方法在非除錯模式下零開銷
- **格式化成本**: 訊息格式化 <1ms，支援複雜物件展示

#### AI 編碼支援特性
- **方法完整性**: 提供 info/warn/error/success 全套方法，避免 "方法不存在" 錯誤
- **參數寬鬆性**: 支援 1-4 個參數的彈性調用方式，適應不同編碼習慣
- **智能容錯**: 參數類型自動檢測和容錯處理，減少調用錯誤
- **便捷別名**: MESSAGE_TEMPLATES 便捷方法減少重複編碼

### LoadingManager
**位置**: `src/js/core/LoadingManager.js`
**職責**: 初始化流程協調管理器，統一管理系統初始化、載入進度顯示、UI狀態控制
**依賴**: `SystemLogger`

#### 核心方法
```javascript
/**
 * 開始初始化流程
 * @param {Array<LoadingStep>} steps - 初始化步驟列表
 * @param {LoadingConfig} [config] - 載入配置
 * @returns {Promise<boolean>} 初始化是否成功
 */
async startInitialization(steps, config = {})

/**
 * 更新步驟進度
 * @param {string} stepId - 步驟ID
 * @param {boolean} [completed=true] - 是否完成
 * @param {string} [error] - 錯誤訊息
 * @returns {void}
 */
updateProgress(stepId, completed = true, error = null)

/**
 * 完成初始化流程
 * @returns {void}
 */
finishInitialization()

/**
 * 取消初始化流程
 * @param {string} [reason='使用者取消'] - 取消原因
 * @returns {void}
 */
cancelInitialization(reason = '使用者取消')

/**
 * 取得當前載入狀態
 * @returns {Object} 載入狀態資訊
 */
getStatus()
```

#### 型別定義
```javascript
/**
 * 載入步驟資訊
 * @typedef {Object} LoadingStep
 * @property {string} id - 步驟唯一識別碼
 * @property {string} name - 步驟顯示名稱
 * @property {boolean} completed - 是否已完成
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 載入配置
 * @typedef {Object} LoadingConfig
 * @property {boolean} [showProgress=true] - 是否顯示進度條
 * @property {boolean} [lockUI=true] - 是否鎖定UI
 * @property {number} [timeout=10000] - 載入超時時間（毫秒）
 * @property {string} [loadingText='系統初始化中...'] - 載入提示文字
 */
```

#### 使用範例
```javascript
// 基本使用流程
const steps = [
  { id: 'rules', name: '載入遊戲規則' },
  { id: 'tenants', name: '載入租客資料' },
  { id: 'skills', name: '載入技能資料' },
  { id: 'events', name: '載入事件資料' }
];

// 啟動初始化
await loadingManager.startInitialization(steps);

// 逐步更新進度
try {
  await loadConfig("rules");
  loadingManager.updateProgress('rules');

  await loadGameData("tenants");
  loadingManager.updateProgress('tenants');

  // 其他載入步驟...

} catch (error) {
  loadingManager.updateProgress('rules', false, error.message);
}

// 自訂配置使用
const customConfig = {
  showProgress: true,
  lockUI: true,
  timeout: 15000,
  loadingText: '正在準備遊戲環境...'
};

await loadingManager.startInitialization(steps, customConfig);

// 狀態查詢
const status = loadingManager.getStatus();
console.log(`載入進度: ${status.progress}%`);
console.log(`已完成步驟: ${status.completedSteps}/${status.totalSteps}`);
```

#### 整合範例（DataManager）
```javascript
// DataManager.js 整合示例
async initialize() {
  if (this.isInitialized) {
    return { success: true, data: this.getAllData() };
  }

  const loadingSteps = [
    { id: 'init', name: '準備初始化' },
    { id: 'parallel_load', name: '載入配置檔案' },
    { id: 'validation', name: '驗證資料完整性' },
    { id: 'finalize', name: '完成初始化' }
  ];

  try {
    await loadingManager.startInitialization(loadingSteps);

    systemLogger.initializing();
    loadingManager.updateProgress('init');

    const loadPromises = [
      this.loadConfig("rules"),
      this.loadGameData("tenants"),
      this.loadGameData("skills"),
      this.loadGameData("events"),
    ];

    await Promise.all(loadPromises);
    loadingManager.updateProgress('parallel_load');

    this._validateLoadedData();
    loadingManager.updateProgress('validation');

    this.isInitialized = true;
    systemLogger.ready();
    loadingManager.updateProgress('finalize');

    return { success: true, data: this.getAllData() };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    systemLogger.systemError(errorMessage);
    loadingManager.cancelInitialization(`資料載入失敗: ${errorMessage}`);
    throw new Error(`資料載入失敗，請檢查配置檔案：${errorMessage}`);
  }
}
```

#### 效能特性
- **UI控制機制**: 載入期間自動鎖定遊戲按鈕，防止非同步操作衝突
- **進度追蹤精度**: 支援步驟級進度追蹤，提供實時載入反饋
- **超時保護**: 預設10秒超時機制，避免無限等待情況
- **錯誤隔離**: 單一步驟失敗不影響整體清理機制，確保UI狀態正確恢復
- **記憶體管理**: 載入完成後自動清理計時器和臨時狀態，避免記憶體洩漏
- **載入畫面最佳化**: DOM操作集中管理，最小化重排和重繪影響
- **狀態查詢效率**: 即時狀態計算，無額外快取開銷


## 💼 業務模組API參考

### BaseManager
**位置**: `src/js/systems/BaseManager.js`
**職責**: 業務管理器統一基礎架構
**特色**: 智慧事件前綴解析

#### 事件前綴解析規則
```javascript
// 系統級前綴（保持原名）
SYSTEM_PREFIXES: ["system_", "game_", "day_"]

// 業務領域前綴（跨模組事件）
BUSINESS_PREFIXES: ["harvest_", "scavenge_"]

// 模組專屬前綴（自動添加）
MODULE_PREFIXES: ["resource_", "tenant_", "trade_", "skill_"]
```

#### 核心方法
```javascript
/**
 * 智慧事件發送
 * @param {string} eventName - 事件名稱
 * @param {*} data - 事件資料
 * @returns {EmitResult}
 */
emitEvent(eventName, data, options = {})

/**
 * 智慧事件監聽
 * @param {string} eventName - 事件名稱
 * @param {Function} callback - 回調函數
 * @returns {UnsubscribeFunction}
 */
onEvent(eventName, callback, options = {})

/**
 * 標準化日誌記錄
 * @param {string} message - 日誌訊息
 * @param {LogType} type - 日誌類型
 */
addLog(message, type = 'event')
```

### ResourceManager
**位置**: `src/js/systems/ResourceManager.js`
**職責**: 資源流轉控制核心
**依賴**: `BaseManager`, `GameState`, `EventBus`

#### 核心方法
```javascript
/**
 * 單一資源修改
 * @param {ResourceType} resourceType - 資源類型
 * @param {number} amount - 變更數量
 * @param {string} reason - 修改原因
 * @param {string} source - 資源來源
 * @returns {boolean}
 */
modifyResource(resourceType, amount, reason, source = 'system')

/**
 * 批量資源修改
 * @param {BulkModification} modification - 批量修改參數
 * @returns {boolean}
 */
bulkModifyResources(modification)

/**
 * 資源轉移
 * @param {string} from - 來源（'landlord'或租客ID）
 * @param {string} to - 目標（'landlord'或租客ID）
 * @param {Partial<Resources>} resources - 轉移資源
 * @param {string} reason - 轉移原因
 * @returns {boolean}
 */
transferResource(from, to, resources, reason)

/**
 * 資源狀態評估
 * @param {ResourceType} resourceType - 資源類型
 * @returns {ResourceStatus} 狀態分析結果
 */
getResourceStatus(resourceType)

/**
 * 每日資源消費處理
 * @returns {Promise<boolean>}
 */
async processDailyConsumption()

/**
 * 院子採集 - 主要入口點
 * @returns {{success: boolean, error?: string, description?: string, amount?: number}} 採集結果
 */
harvestYard()

/**
 * 檢查是否可以進行院子採集
 * @returns {boolean} 是否可以採集
 */
canHarvest()

/**
 * 檢查採集冷卻狀態
 * @returns {Object} 採集狀態資訊
 */
getHarvestStatus()
```

#### 使用範例
```javascript
// 單一操作
resourceManager.modifyResource('food', -5, '每日消費', 'daily_cycle');

// 批量操作
resourceManager.bulkModifyResources({
  changes: { food: 10, materials: -2 },
  reason: '院子採集',
  source: 'harvest'
});

// 資源轉移
resourceManager.transferResource('landlord', 'tenant_1', {
  food: 5, medical: 2
}, '緊急援助');

// 狀態檢查
const foodStatus = resourceManager.getResourceStatus('food');
if (foodStatus.level === 'emergency') {
  console.warn(`食物緊急短缺！剩餘 ${foodStatus.daysRemaining} 天`);
}

// 院子採集（新的統一返回格式）
const harvestResult = resourceManager.harvestYard();
if (harvestResult.success) {
  console.log(harvestResult.description); // "院子採集獲得 2 食物"
  console.log(`獲得數量: ${harvestResult.amount}`);
} else {
  console.warn(`採集失敗: ${harvestResult.error}`);
}

// 檢查採集狀態
const harvestStatus = resourceManager.getHarvestStatus();
console.log(`可以採集: ${harvestStatus.canHarvest}`);
console.log(`冷卻剩餘: ${harvestStatus.cooldownRemaining} 天`);
```

#### 效能特性
- **批量優先**: 多資源操作使用`bulkModifyResources`減少事件發送
- **轉移驗證**: 完整前置驗證，失敗時零副作用
- **閾值監控**: 自動觸發閾值檢查和警告事件

### TenantManager
**位置**: `src/js/systems/TenantManager.js`
**職責**: 租客生命週期管理、探索狀態管理，透過內建 SatisfactionManager 專責處理滿意度邏輯
**依賴**: `BaseManager`, `GameState`, `ResourceManager`, `DataManager`, `EventBus`, `SatisfactionManager`, `RelationshipManager`

#### 架構設計
TenantManager 採用組合模式，將複雜功能委派給專責子系統處理：

```javascript
// 內部架構
class TenantManager extends BaseManager {
  constructor() {
    // 滿意度專責管理
    this.satisfactionManager = new SatisfactionManager(gameState, eventBus, config);
    // 關係專責管理
    this.relationshipManager = new RelationshipManager(gameState, eventBus, config);
  }

  // 滿意度相關方法委派給專責管理器
  updateTenantSatisfaction(tenantId) {
    return this.satisfactionManager.updateSatisfaction(tenantId);
  }

  // 關係管理方法委派給專責管理器
  getRelationshipValue(tenantId1, tenantId2) {
    return this.relationshipManager.getRelationshipValue(tenantId1, tenantId2);
  }
}
```

#### 核心方法
```javascript
/**
 * 雇用租客
 * @param {number} applicantId - 申請者ID
 * @param {number} [targetRoomId] - 指定房間ID（可選）
 * @returns {Promise<HiringResult>}
 */
async hireTenant(applicantId, targetRoomId)

/**
 * 驅逐租客
 * @param {number} tenantId - 租客ID
 * @param {boolean} isInfected - 是否因感染驅逐
 * @param {string} reason - 驅逐原因
 * @returns {Promise<EvictionResult>}
 */
async evictTenant(tenantId, isInfected = false, reason = '正常退租')

/**
 * 設置探索管理器（啟用自主探索功能）
 * @param {ExplorationManager} explorationManager - 探索管理器實例
 * @returns {Promise<boolean>} 設置是否成功
 */
async setExplorationManager(explorationManager)

/**
 * 滿意度調整（委派給 SatisfactionManager）
 * @param {number} tenantId - 租客ID
 * @param {number} change - 滿意度變更量
 * @param {string} reason - 變更原因
 * @returns {number} 新的滿意度值
 */
modifySatisfaction(tenantId, change, reason)

/**
 * 取得滿意度狀態（委派給 SatisfactionManager）
 * @param {number} satisfaction - 滿意度數值
 * @returns {SatisfactionStatus} 滿意度狀態分析
 */
getSatisfactionStatus(satisfaction)

/**
 * 尋找租客和房間
 * @param {number} tenantId - 租客ID
 * @returns {{tenant: Tenant, room: Room}|null}
 */
findTenantAndRoom(tenantId)

/**
 * 生成新申請者
 * @param {number} count - 生成數量
 * @returns {Array<Person>}
 */
generateApplicants(count = Math.floor(Math.random() * 2) + 2)

/**
 * 取得租客間關係值（委派給 RelationshipManager）
 * @param {string|number} tenantId1 - 租客1 ID
 * @param {string|number} tenantId2 - 租客2 ID
 * @returns {number} 關係值 (0-100)
 */
getRelationshipValue(tenantId1, tenantId2)

/**
 * 設置租客間關係值（委派給 RelationshipManager）
 * @param {string|number} tenantId1 - 租客1 ID
 * @param {string|number} tenantId2 - 租客2 ID
 * @param {number} value - 關係值 (0-100)
 * @param {string} [reason] - 變更原因
 * @returns {boolean} 設置是否成功
 */
setRelationshipValue(tenantId1, tenantId2, value, reason = '關係更新')

/**
 * 調整租客間關係值（委派給 RelationshipManager）
 * @param {string|number} tenantId1 - 租客1 ID
 * @param {string|number} tenantId2 - 租客2 ID
 * @param {number} change - 變更量
 * @param {string} [reason] - 變更原因
 * @returns {number} 新的關係值
 */
adjustRelationshipValue(tenantId1, tenantId2, change, reason = '關係調整')

/**
 * 取得租客的所有關係值（委派給 RelationshipManager）
 * @param {string|number} tenantId - 租客 ID
 * @returns {Object} 關係值映射
 */
getTenantRelationships(tenantId)

/**
 * 檢查自主探索觸發（DayManager 每日循環中換日前調用）
 * 評估租客資源需求和探索動機，異步觸發合格的自主探索
 * @returns {Array<AutonomousExplorationTrigger>} 觸發的自主探索列表
 */
checkAutonomousExploration()

/**
 * 取得可用租客列表
 * @returns {Array<Object>} 可用租客列表（不在任務中、健康、非冷卻狀態）
 */
getAvailableTenants()

/**
 * 修改租客個人資源
 * @param {string} tenantId - 租客ID
 * @param {string} resourceType - 資源類型
 * @param {number} amount - 變更數量（可為負數）
 * @param {string} reason - 修改原因
 * @returns {boolean} 修改是否成功
 */
modifyPersonalResource(tenantId, resourceType, amount, reason)

/**
 * 取得自主探索統計
 * @returns {Object} 統計資料
 */
getAutonomousExplorationStats()

/**
 * 生成隨機化個人資源
 * @param {Object} baseResources - 基礎資源配置
 * @param {Object} tenantType - 租客類型配置
 * @returns {Object} 隨機化後的個人資源
 */
generateRandomPersonalResources(baseResources, tenantType)

/**
 * 分析資源狀況並生成描述
 * @param {Object} personalResources - 個人資源配置
 * @param {Object} tenantType - 租客類型配置
 * @returns {Object} 資源狀況分析結果 {category, totalValue, description}
 */
analyzeResourceStatus(personalResources, tenantType)
```

#### RelationshipManager 整合
TenantManager 內建的 RelationshipManager 提供專業的租客關係管理能力：

**主要功能**：
- 基於職業類型的初始關係值計算（soldier-doctor: 65, farmer-worker: 70等）
- 統一ID系統確保關係鍵值一致性（sortedIds 機制）
- 自動清理已離開租客的關係記錄
- 與 GameState 雙向同步，支援關係值持久化

**委派方法**：
```javascript
// 關係值管理
const relationship = tenantManager.getRelationshipValue(tenantId1, tenantId2);
tenantManager.setRelationshipValue(tenantId1, tenantId2, 75, '協作成功');
const newValue = tenantManager.adjustRelationshipValue(tenantId1, tenantId2, 5, '互助行為');

// 關係網絡查詢
const allRelationships = tenantManager.getTenantRelationships(tenantId);
```

#### SatisfactionManager 整合
TenantManager 內建的 SatisfactionManager 提供專業的滿意度處理能力：

**主要功能**：
- 多因子滿意度計算（房間狀況、個人資源、建築防禦等）
- 滿意度歷史追蹤和趨勢分析
- 自動警告機制（critical/warning 等級）
- 快取優化的計算效能

**委派方法**：
```javascript
// 滿意度更新
tenantManager.updateTenantSatisfaction(tenantId);

// 滿意度查詢
const satisfaction = tenantManager.getTenantSatisfaction(tenantId);
const status = tenantManager.getSatisfactionStatus(satisfaction);

// 滿意度統計
const avgSatisfaction = tenantManager.calculateAverageSatisfaction();
const distribution = tenantManager.getSatisfactionDistribution();
```

#### 個人資源隨機化系統
TenantManager 實作配置驅動的個人資源隨機化機制，為每個生成角色提供獨特的資源配置：

**核心功能**：
- 支援百分比變化（`percentage`）和固定數值變化（`fixed`）兩種類型
- 職業資源保護機制，確保關鍵專業資源不會完全消失
- 自動資源狀況分析和描述增強
- 完全基於 `rules.json` 配置，支援靈活調整

**配置範例**：
```javascript
// rules.json 中的配置
"characterGeneration": {
  "personalResourceVariation": {
    "resourceRules": {
      "cash": {
        "type": "percentage",
        "min": 0.5,
        "max": 1.5,
        "roundTo": 5
      },
      "food": {
        "type": "fixed", 
        "min": -1,
        "max": 2
      }
    },
    "specialRules": {
      "minimumResourcePreservation": {
        "rules": {
          "doctor": { "medical": { "min": 2 } },
          "worker": { "materials": { "min": 3 } },
          "farmer": { "food": { "min": 2 } }
        }
      }
    }
  }
}
```

**使用方法**：
```javascript
// 內部角色生成時自動調用
const personalResources = tenantManager.generateRandomPersonalResources(
  tenantType.personalResources, 
  tenantType
);

// 資源狀況分析
const resourceStatus = tenantManager.analyzeResourceStatus(personalResources, tenantType);
console.log(`資源狀況：${resourceStatus.category}，總價值：${resourceStatus.totalValue}`);
```

#### 使用範例
```javascript
// 雇用流程
const hiringResult = await tenantManager.hireTenant(1, 2);
if (hiringResult.success) {
  console.log(`${hiringResult.tenant.name} 入住房間 ${hiringResult.roomId}`);
}

// 滿意度管理（內部委派給 SatisfactionManager）
const newSatisfaction = tenantManager.modifySatisfaction(1, 10, '房間維修完成');
const status = tenantManager.getSatisfactionStatus(newSatisfaction);
console.log(`滿意度：${status.value} ${status.emoji} (${status.description})`);

// 關係管理（內部委派給 RelationshipManager）
const relationship = tenantManager.getRelationshipValue('tenant_1', 'tenant_2');
tenantManager.adjustRelationshipValue('tenant_1', 'tenant_2', 10, '成功協作');
console.log(`關係值：${relationship} → ${relationship + 10}`);

// 自主探索檢查（每日循環觸發）
const triggers = tenantManager.checkAutonomousExploration();
triggers.forEach(trigger => {
  console.log(`${trigger.tenantId} 觸發自主探索，優先級：${trigger.priority}`);
});

// 個人資源管理
tenantManager.modifyPersonalResource('tenant_1', 'food', 5, '探索獲得');

// 驅逐處理
const evictionResult = await tenantManager.evictTenant(3, true, '感染風險');
```

#### 效能特性
- **組合模式架構**: 滿意度和關係管理邏輯獨立於核心租客管理，降低單一職責負載
- **專責計算優化**: SatisfactionManager 內建 5 秒快取機制，RelationshipManager 使用 Map 結構提升查詢效能
- **記憶體管理**: 滿意度歷史、關係記錄和自主探索歷史均限制在系統閾值內，防止記憶體洩漏
- **事件效率**: 專責管理器直接發送相關事件，避免多層轉發降低效能
- **自主探索優化**: 冷卻機制避免頻繁觸發，可用租客篩選機制提升執行效率

### TradeManager
**位置**: `src/js/systems/TradeManager.js`
**職責**: 統一交易系統入口，整合租金收取、租客交易和委託探索系統
**依賴**: `BaseManager`, `RentManager`, `UniversalTrader`, `CommissionHandler`, `ExplorationManager`, `ResourceManager`, `TenantManager`, `DataManager`, `EventBus`

#### 核心方法
```javascript
/**
 * 收取租金（統一入口）
 * @returns {Promise<Object>} 租金收取結果
 */
async collectRent()

/**
 * 執行資源交易（統一入口）
 * @param {string} tradeOptionId - 交易選項ID
 * @returns {Promise<Object>} 交易結果
 */
async executeResourceTrade(tradeOptionId)

/**
 * 處理互助交易（統一入口）
 * @returns {Promise<Object>} 互助處理結果
 */
async processMutualAid()

/**
 * 取得角色交易選項
 * @param {string} characterId - 角色ID
 * @returns {Array} 交易選項陣列
 */
getCharacterTradeOptions(characterId)

/**
 * 發起委託邀約（委託探索系統）
 * @param {CommissionRequest} request - 委託請求
 * @returns {Promise<Object>} 委託處理結果
 */
async offerCommission(request)

/**
 * 取得活躍委託列表
 * @returns {Array} 活躍委託列表
 */
getActiveCommissions()

/**
 * 取得委託歷史
 * @returns {Array} 完成歷史列表
 */
getCommissionHistory()

/**
 * 取得委託統計資訊
 * @returns {Object} 委託統計
 */
getCommissionStats()

/**
 * 取得探索系統統計
 * @returns {Object} 探索系統統計
 */
getExplorationStats()

/**
 * 取得交易統計
 * @returns {TradeStats} 交易統計資料
 */
getTradeStats()

/**
 * 除錯：檢查探索系統狀態（透過ExplorationManager）
 * @returns {Object} 探索系統狀態報告
 */
debugExplorationSystem()

/**
 * 除錯：手動觸發探索完成檢查（透過ExplorationManager）
 * @returns {Promise<Array>} 完成的探索列表
 */
async manualCheckExplorations()
```

#### 委託請求類型
```javascript
/**
 * 委託請求參數
 * @typedef {Object} CommissionRequest
 * @property {string} tenantId - 目標租客ID
 * @property {string} resourceType - 需要資源類型
 * @property {number} targetAmount - 目標數量
 * @property {Object} basePayment - 基礎報酬
 * @property {Object} commission - 佣金
 */

/**
 * 委託統計資料
 * @typedef {Object} CommissionStats
 * @property {number} activeCommissions - 活躍委託數量
 * @property {number} totalCommissions - 總委託數量
 * @property {number} successfulCommissions - 成功委託數量
 * @property {number} successRate - 成功率
 * @property {number} rejectedCommissions - 拒絕委託數量
 */

/**
 * 探索系統統計
 * @typedef {Object} ExplorationStats
 * @property {number} totalExplorations - 總探索次數
 * @property {number} successfulExplorations - 成功探索次數
 * @property {number} commissionExplorations - 委託探索次數
 * @property {number} autonomousExplorations - 自主探索次數
 * @property {Object} totalResourcesObtained - 總獲得資源
 * @property {number} totalParticipants - 總參與者數
 * @property {number} injuryCount - 受傷次數
 */
```

#### 交易選項類型
```javascript
/**
 * 交易選項
 * @typedef {Object} TradeOption
 * @property {string} id - 交易選項ID
 * @property {Object} character - 角色物件
 * @property {'buy'|'sell'|'emergency'} type - 交易類型
 * @property {string} item - 交易物品
 * @property {number} quantity - 數量
 * @property {number} price - 價格
 * @property {number} originalPrice - 原始價格
 * @property {number} relationship - 關係度
 * @property {'low'|'medium'|'high'|'critical'} urgency - 緊急程度
 * @property {boolean} canAfford - 房東是否負擔得起
 */
```

#### 使用範例
```javascript
// 收取租金
const rentResult = await tradeManager.collectRent();
if (rentResult.success) {
  console.log(`收取租金: $${rentResult.totalCashRent}`);
}

// 執行交易
const tradeResult = await tradeManager.executeResourceTrade('tenant_1_food_buy');
if (tradeResult.success) {
  console.log('交易成功:', tradeResult.transaction);
}

// 取得交易選項
const options = tradeManager.getCharacterTradeOptions('1');
options.forEach(option => {
  console.log(`${option.character.name}: ${option.type} ${option.item} x${option.quantity} - $${option.price}`);
});

// 處理互助
const mutualAidResult = await tradeManager.processMutualAid();
console.log(`互助事件: ${mutualAidResult.events.length} 個`);

// 委託探索系統
const commissionRequest = {
  tenantId: 'tenant_1',
  resourceType: 'food',
  targetAmount: 10,
  basePayment: { cash: 50 },
  commission: { food: 2, cash: 20 }
};

const commissionResult = await tradeManager.offerCommission(commissionRequest);
if (commissionResult.success) {
  console.log('委託被接受:', commissionResult.offer);
} else {
  console.log('委託被拒絕:', commissionResult.reason);
}

// 查詢委託狀態
const activeCommissions = tradeManager.getActiveCommissions();
const commissionStats = tradeManager.getCommissionStats();
console.log(`活躍委託: ${activeCommissions.length}, 成功率: ${Math.round(commissionStats.successRate * 100)}%`);

// 探索統計
const explorationStats = tradeManager.getExplorationStats();
console.log(`總探索次數: ${explorationStats.totalExplorations}, 委託探索: ${explorationStats.commissionExplorations}`);
```

#### 效能特性
- **四系統整合**: 統一管理 RentManager、UniversalTrader、CommissionHandler、ExplorationManager
- **委託探索系統**: 完整的委託邀約處理、接受機率計算、探索執行委託
- **事件整合**: 統一發送交易相關事件和探索系統事件
- **統計追蹤**: 完整的交易統計、委託統計和探索統計
- **配置驅動**: 探索系統使用 `gameBalance.explorationSystem` 配置
- **錯誤處理**: 統一的錯誤處理和回傳格式，支援系統健康檢查

### UniversalTrader
**位置**: `src/js/systems/UniversalTrader.js`
**職責**: 租客資源交易、自動互助系統、緊急交易處理
**依賴**: `BaseManager`, `ResourceManager`, `TenantManager`, `DataManager`, `EventBus`

#### 核心方法
```javascript
/**
 * 取得角色交易選項
 * @param {string} characterId - 角色ID
 * @returns {Array<TradeOption>} 交易選項陣列
 */
getCharacterTradeOptions(characterId)

/**
 * 執行交易
 * @param {TradeOption} tradeOption - 交易選項
 * @returns {Promise<TradeResult>} 交易結果
 */
async executeTrade(tradeOption)

/**
 * 處理自動互助系統
 * @returns {Array<AutoMutualAidEvent>} 互助事件陣列
 */
processAutoMutualAid()

/**
 * 檢查角色是否可交易
 * @param {Object} character - 角色物件
 * @returns {boolean} 是否可交易
 */
canCharacterTrade(character)
```

#### 交易類型
```javascript
// 購買選項 - 租客需要資源
{ type: 'buy', urgency: 'critical', item: 'food', quantity: 3 }

// 出售選項 - 租客提供資源
{ type: 'sell', item: 'materials', quantity: 2 }

// 緊急交易 - 特殊價格的急需交易
{ type: 'emergency', urgency: 'critical', item: 'medical', quantity: 1 }
```

#### 使用範例
```javascript
// 取得交易選項
const trader = new UniversalTrader(gameState, resourceManager, tenantManager, dataManager, eventBus);
const options = trader.getCharacterTradeOptions('1');

// 執行交易
const selectedOption = options[0];
const result = await trader.executeTrade(selectedOption);
if (result.success) {
  console.log(`交易完成: ${result.transaction.characterName} ${result.transaction.type} ${result.transaction.item}`);
}

// 自動互助
const mutualAidEvents = trader.processAutoMutualAid();
mutualAidEvents.forEach(event => {
  console.log(`${event.helperName} 幫助 ${event.recipientName}: ${event.subtype}`);
});
```

#### 效能特性
- **純函數設計**: 交易計算邏輯無副作用
- **輕量快取**: 交易選項動態生成，無持久化快取
- **簡化狀態管理**: 最小化內部狀態，依賴外部狀態管理
- **關係度計算**: 基於關係度的動態定價機制

### CommissionHandler
**位置**: `src/js/systems/CommissionHandler.js`
**職責**: 委託探索處理器，處理委託邀約、接受機率計算
**依賴**: `ExplorationManager`, `TenantManager`, `EventBus`
**架構**: TradeManager 內部組件，配置驅動設計

#### 核心方法
```javascript
/**
 * 處理委託邀約（主要入口點）
 * @param {Object} request - 委託請求
 * @param {string} request.tenantId - 目標租客ID
 * @param {string} request.resourceType - 需要資源類型
 * @param {number} request.targetAmount - 目標數量
 * @param {Object} request.basePayment - 基礎報酬
 * @param {Object} request.commission - 佣金
 * @returns {Promise<Object>} 處理結果
 */
async processCommissionOffer(request)

/**
 * 取得活躍委託列表
 * @returns {Array<CommissionOffer>} 活躍委託
 */
getActiveCommissions()

/**
 * 取得委託歷史
 * @returns {Array<Object>} 委託歷史記錄
 */
getCommissionHistory()

/**
 * 取得統計資訊
 * @returns {Object} 統計資料
 */
getStats()

/**
 * 清理系統資源
 */
cleanup()
```

#### 委託邀約類型
```javascript
/**
 * 委託邀約物件
 * @typedef {Object} CommissionOffer
 * @property {string} id - 邀約唯一ID
 * @property {string} tenantId - 目標租客ID
 * @property {string} resourceType - 需要的資源類型
 * @property {number} targetAmount - 目標獲取數量
 * @property {Object} basePayment - 基礎報酬
 * @property {Object} commission - 佣金
 * @property {string|null} partnerId - 組隊夥伴ID
 * @property {string} status - 委託狀態
 * @property {string} [decidedAt] - 決策時間
 */

/**
 * 委託接受評估結果
 * @typedef {Object} AcceptanceEvaluation
 * @property {number} probability - 接受機率
 * @property {string} refusalReason - 拒絕原因
 */
```

#### 使用範例
```javascript
// 建立委託處理器（通常由 TradeManager 管理）
const commissionHandler = new CommissionHandler(
  tenantManager,
  eventBus,
  explorationConfig,
  explorationManager
);

// 處理委託邀約
const request = {
  tenantId: 'tenant_1',
  resourceType: 'food',
  targetAmount: 10,
  basePayment: { cash: 50 },
  commission: { food: 2, cash: 20 }
};

const result = await commissionHandler.processCommissionOffer(request);
if (result.success) {
  console.log('委託被接受:', result.offer);
  console.log('探索結果:', result.result);
} else {
  console.log('委託被拒絕:', result.reason);
}

// 查詢委託狀態
const active = commissionHandler.getActiveCommissions();
const history = commissionHandler.getCommissionHistory();
const stats = commissionHandler.getStats();

console.log(`活躍委託: ${active.length}`);
console.log(`成功率: ${Math.round(stats.successRate * 100)}%`);
```

#### 效能特性
- **配置驅動**: 使用 `gameBalance.explorationSystem` 配置接受機率計算
- **事件監聽**: 自動監聽探索完成事件更新委託狀態
- **歷史管理**: 限制委託歷史最近50筆記錄防止記憶體洩漏
- **智慧組隊**: 自動評估組隊可能性提升探索成功率
- **風險評估**: 基於租客職業、關係度、資源急迫性計算接受機率

### ExplorationManager
**位置**: `src/js/systems/ExplorationManager.js`
**職責**: 探索系統管理器，提供探索執行的統一管理、每日探索進度記錄、租客 onMission 狀態專責管理
**依賴**: `BaseManager`, `ResourceManager`, `DataManager`, `EventBus`

#### 核心方法
```javascript
/**
 * 執行探索（統一入口點）
 * @param {ExplorationRequest} request - 探索請求
 * @returns {Promise<ExplorationResult>} 探索結果
 */
async executeExploration(request)

/**
 * 初始化探索管理器
 * @returns {Promise<boolean>} 初始化是否成功
 */
async initialize()

/**
 * 取得探索統計
 * @returns {Object} 探索統計資料
 */
getExplorationStats()

/**
 * 取得探索歷史
 * @param {number} [limit=50] - 限制數量
 * @returns {Array<ExplorationResult>} 探索歷史
 */
getExplorationHistory(limit = 50)

/**
 * 取得成功率趨勢
 * @param {number} [days=7] - 分析天數
 * @returns {Array<number>} 成功率趨勢
 */
getSuccessRateTrend(days = 7)

/**
 * 按類型取得探索統計
 * @returns {Object} 按類型分組的統計
 */
getExplorationStatsByType()

/**
 * 清理系統資源
 */
cleanup()

/**
 * 重置統計資料
 */
resetStats()
```

#### 探索請求類型
```javascript
/**
 * 探索參與者
 * @typedef {Object} ExplorationParticipant
 * @property {string} id - 參與者ID
 * @property {string} name - 參與者姓名
 * @property {string} type - 參與者類型
 * @property {Object} personalResources - 個人資源
 */

/**
 * 探索請求
 * @typedef {Object} ExplorationRequest
 * @property {string} type - 探索類型 ('commission'|'autonomous')
 * @property {string} requestId - 請求ID
 * @property {string} resourceType - 目標資源類型
 * @property {number} targetAmount - 目標數量
 * @property {Array<ExplorationParticipant>} participants - 參與者
 * @property {string} priority - 優先級 ('low'|'medium'|'high'|'critical')
 * @property {Object} [basePayment] - 基礎報酬（委託探索用）
 * @property {Object} [commission] - 佣金（委託探索用）
 */

/**
 * 探索結果
 * @typedef {Object} ExplorationResult
 * @property {boolean} success - 探索是否成功
 * @property {string} completedAt - 完成時間戳記
 * @property {Object} resourcesObtained - 總獲得資源
 * @property {number} contractFulfillment - 合約履行數量
 * @property {number} surplus - 超額數量
 * @property {Array} participants - 參與者狀況
 * @property {Array} relationshipChanges - 關係影響
 * @property {string} type - 探索類型
 * @property {string} requestId - 請求ID
 */
```

#### 差異化獎勵分配機制
ExplorationManager 根據探索類型實施不同的獎勵分配策略：

```javascript
// 委託探索：房東獲得主要資源
if (request.type === 'commission') {
  resourceManager.modifyResource(resourceType, contractFulfillment, '委託探索收穫');
}

// 自主探索：參與者平分主要資源
else if (request.type === 'autonomous') {
  const perPersonMain = Math.floor(contractFulfillment / participants.length);
  emitEvent("autonomous_main_distribution", {
    participants: participants.map(p => p.id),
    resourceType: resourceType,
    amountPerPerson: perPersonMain,
    reason: '自主探索主要收穫'
  });
}

// 超額資源：兩種探索類型均由參與者平分
const perPersonSurplus = Math.floor(surplus / participants.length);
```

#### 使用範例
```javascript
// 初始化探索管理器
const explorationManager = new ExplorationManager(
  gameState,
  resourceManager,
  eventBus,
  dataManager
);

await explorationManager.initialize();

// 執行委託探索
const commissionRequest = {
  type: 'commission',
  requestId: 'commission_1',
  resourceType: 'food',
  targetAmount: 10,
  participants: [
    { id: 'tenant_1', name: '農夫張三', type: 'farmer', personalResources: {} },
    { id: 'tenant_2', name: '軍人李四', type: 'soldier', personalResources: {} }
  ],
  priority: 'medium',
  basePayment: { cash: 50 },
  commission: { food: 2, cash: 20 }
};

// 執行自主探索
const autonomousRequest = {
  type: 'autonomous',
  requestId: 'autonomous_1',
  resourceType: 'food',
  targetAmount: 5,
  participants: [
    { id: 'tenant_3', name: '工人王五', type: 'worker', personalResources: {} }
  ],
  priority: 'high'
};

const result = await explorationManager.executeExploration(commissionRequest);
console.log(`探索${result.success ? '成功' : '失敗'}`);
console.log('獲得資源:', result.resourcesObtained);

// 查詢統計資料
const stats = explorationManager.getExplorationStats();
console.log(`總探索次數: ${stats.totalExplorations}`);
console.log(`成功率: ${Math.round(stats.successRate * 100)}%`);
console.log(`受傷率: ${Math.round(stats.injuryRate * 100)}%`);

// 取得歷史和趨勢
const history = explorationManager.getExplorationHistory(10);
const trend = explorationManager.getSuccessRateTrend(7);
const byType = explorationManager.getExplorationStatsByType();
```

#### 效能特性
- **配置載入**: 使用 `gameBalance.explorationSystem` 配置，支援預設配置回退
- **統計追蹤**: 完整的探索統計、成功率計算、受傷追蹤
- **歷史管理**: 限制探索歷史最近100筆記錄，支援趨勢分析
- **事件整合**: 發送探索開始、完成、失敗等事件供其他系統監聽
- **支付處理**: 自動處理基礎報酬支付和佣金分配
- **關係影響**: 處理探索結果對租客關係的影響

### SkillManager
**位置**: `src/js/systems/SkillManager.js`
**職責**: 技能執行引擎
**依賴**: `BaseManager`, `GameState`, `EventBus`, `DataManager`, `ResourceManager`

#### 核心方法
```javascript
/**
 * 執行技能
 * @param {number} tenantId - 租客ID
 * @param {string} skillId - 技能ID
 * @param {Object} options - 執行選項
 * @returns {Promise<SkillExecutionResult>}
 */
async executeSkill(tenantId, skillId, options = {})

/**
 * 取得租客可用技能
 * @param {number} tenantId - 租客ID
 * @returns {Array<SkillConfig>}
 */
getAvailableSkillsForTenant(tenantId)

/**
 * 處理被動技能
 * @param {string} trigger - 觸發條件
 * @param {Object} context - 觸發上下文
 * @returns {Promise<Array>}
 */
async processPassiveSkills(trigger, context = {})

/**
 * 檢查技能冷卻
 * @param {number} tenantId - 租客ID
 * @param {string} skillId - 技能ID
 * @returns {number} 剩餘冷卻天數
 */
getSkillCooldown(tenantId, skillId)
```

#### 技能類型
```javascript
// 主動技能 - 玩家觸發，有成本和冷卻
{ type: 'active', cost: { medical: 2 }, cooldown: 3 }

// 被動技能 - 條件自動觸發
{ type: 'passive', trigger: 'daily_cycle' }

// 特殊技能 - 限制使用次數
{ type: 'special', maxUses: 1 }
```

#### 使用範例
```javascript
// 執行技能
const healResult = await skillManager.executeSkill(1, 'doctor_treat', {
  targetTenantId: 2
});

// 查詢可用技能
const availableSkills = skillManager.getAvailableSkillsForTenant(1);
availableSkills.forEach(skill => {
  const cooldown = skillManager.getSkillCooldown(1, skill.id);
  console.log(`${skill.name}: ${cooldown > 0 ? `冷卻${cooldown}天` : '可使用'}`);
});
```

#### 效能特性
- **效果鏈**: 單一技能最多5個效果
- **冷卻管理**: 存儲在記憶體Map，重啟後重置
- **被動觸發**: 每日最多處理30個技能

### DayManager
**位置**: `src/js/systems/DayManager.js`
**職責**: 每日循環協調器
**依賴**: 所有業務管理器

#### 每日循環執行順序
```javascript
// 換日前處理
0. 檢查自主探索觸發（TenantManager.checkAutonomousExploration）

// 換日推進
gameState.advanceDay()

// 換日後處理
1. 處理每日資源消費（ResourceManager.processDailyConsumption）
2. 處理被動技能（SkillManager.processPassiveSkills）
3. 處理租客互助交易（TradeManager.processMutualAid）
4. 檢查資源閾值（ResourceManager.checkAllResourceThresholds）
5. 生成新申請者（TenantManager.generateApplicants）
```

#### 核心方法
```javascript
/**
 * 執行下一天循環
 * @returns {Promise<DayResult>}
 */
async executeNextDay()

/**
 * 檢查管理器可用性
 * @returns {ManagerAvailability}
 */
getManagerAvailability()

/**
 * 取得執行統計
 * @returns {Object} 效能統計
 */
getExecutionStats()
```

#### 使用範例
```javascript
// 執行每日循環
const result = await dayManager.executeNextDay();
if (result.success) {
  console.log(`第 ${result.newDay} 天處理完成，耗時 ${result.duration}ms`);
}

// 系統診斷
const availability = dayManager.getManagerAvailability();
if (!availability.allRequiredAvailable) {
  console.warn('部分管理器不可用');
}
```

#### 效能特性
- **執行時間**: 正常情況下<200ms，超過1秒需檢查
- **錯誤隔離**: 單一管理器錯誤不中斷整個循環
- **統計記錄**: 最近100次執行的效能資料

## 🖥️ UI模組參考

### UICore
**位置**: `src/js/ui/UICore.js`
**職責**: 統一UI操作入口，整合交易描述格式化
**依賴**: `UIDisplay`, `UIModal`, `TradeDescriptionFormatter`

#### 核心方法
```javascript
/**
 * 雇用租客
 * @param {number} applicantId - 申請者ID
 * @returns {Promise<void>}
 */
async hireTenant(applicantId)

/**
 * 驅逐租客
 * @param {number} tenantId - 租客ID
 * @param {boolean} isInfected - 是否因感染驅逐
 */
evictTenant(tenantId, isInfected = false)

/**
 * 執行租客技能
 * @param {string} skillId - 技能ID
 * @param {number} tenantId - 租客ID
 * @param {Object} options - 選項
 * @returns {Promise<void>}
 */
async useSkillWithTenant(skillId, tenantId, options = {})

/**
 * 收取租金
 * @returns {Promise<void>}
 */
async collectRent()

/**
 * 推進到下一天
 */
nextDay()

/**
 * 顯示交易模態框
 * @param {string} characterId - 角色ID
 */
showTradeModal(characterId)

/**
 * 執行交易
 * @param {string} tradeOptionId - 交易選項ID
 * @returns {Promise<void>}
 */
async executeTrade(tradeOptionId)

/**
 * 格式化交易選項供顯示使用
 * @param {Array} rawOptions - 原始交易選項
 * @returns {Array} 格式化後的交易選項
 */
formatTradeOptionsForDisplay(rawOptions)

/**
 * 格式化價格顯示
 * @param {number} currentPrice - 當前價格
 * @param {number} originalPrice - 原始價格
 * @returns {string} 格式化的價格文字
 */
formatPriceDisplay(currentPrice, originalPrice)
```

#### 使用範例
```javascript
// 交易流程
uiCore.showTradeModal('1');  // 顯示交易選項
await uiCore.executeTrade('tenant_1_food_buy');  // 執行交易

// 格式化交易選項
const rawOptions = tradeManager.getCharacterTradeOptions('1');
const displayOptions = uiCore.formatTradeOptionsForDisplay(rawOptions);
```

#### 配置驅動設計
UICore 採用嚴格的配置驅動策略，所有閾值和顯示參數完全來自 JSON 配置：

```javascript
/**
 * 載入資源閾值配置（快速失敗模式）
 * @private
 * @throws {Error} 當配置缺失時
 */
_loadThresholds() {
  const gameRules = this.gameApp.dataManager?.getGameRules();
  if (!gameRules?.gameDefaults?.resources) {
    throw new Error("無法載入資源閾值配置 - 配置文件或dataManager不可用");
  }
  this.thresholds.resources = {
    warning: gameRules.gameDefaults.resources.warningThresholds,
    critical: gameRules.gameDefaults.resources.criticalThresholds
  };
}
```

**配置特性**：
- **零硬編碼**: 完全消除硬編碼閾值，所有數值來自 `rules.json`
- **快速失敗**: 配置載入失敗時立即拋出錯誤，不使用後備預設值
- **完整性檢查**: 初始化時驗證所有必需配置項的存在性
- **明確錯誤**: 提供具體的配置路徑和修復建議

#### 效能特性
- **事件整合**: 統一處理UI事件回調
- **描述格式化**: 使用TradeDescriptionFormatter統一交易描述
- **狀態同步**: 自動更新UI顯示狀態
- **錯誤處理**: 完整的try-catch機制，系統未載入友善提示
- **調用統一**: 動態HTML統一透過UICore調用，消除間接調用
- **配置完整性**: 強制依賴檢查確保配置載入完整性

### UIDisplay
**位置**: `src/js/ui/UIDisplay.js`
**職責**: 畫面顯示邏輯
**狀態**: 功能完整，UI更新邏輯複雜度較高

### UIModal
**位置**: `src/js/ui/UIModal.js`
**職責**: 彈窗系統管理，包含交易模態框
**依賴**: `UICore`, `TradeDescriptionFormatter`

#### 核心方法
```javascript
/**
 * 顯示模態框
 * @param {string} modalId - 模態框ID
 * @returns {boolean} 是否成功顯示
 */
show(modalId)

/**
 * 關閉模態框
 * @param {string|null} modalId - 模態框ID
 * @returns {boolean} 是否成功關閉
 */
close(modalId = null)

/**
 * 設定交易模態框內容
 * @param {Object} character - 角色物件
 * @param {Array} tradeOptions - 交易選項陣列
 */
setTradeContent(character, tradeOptions)

/**
 * 設定租客模態框內容
 * @param {Object} tenant - 租客物件
 * @param {Object} room - 房間物件
 */
setTenantContent(tenant, room)

/**
 * 設定訪客模態框內容
 * @param {Array} visitors - 訪客陣列
 */
setVisitorContent(visitors)
```

#### 交易模態框特性
- **動態內容生成**: 根據交易選項動態產生HTML
- **緊急程度顯示**: 視覺化緊急程度和交易類型
- **價格格式化**: 原價/折扣價的對比顯示
- **可負擔性檢查**: 根據資源狀況啟用/禁用交易按鈕

#### 使用範例
```javascript
// 顯示交易模態框
const character = gameState.findPersonById(1);
const tradeOptions = tradeManager.getCharacterTradeOptions('1');
uiModal.setTradeContent(character, tradeOptions);
uiModal.show('tradeModal');

// 模態框堆疊管理
uiModal.show('tenantModal');  // 顯示租客詳情
uiModal.show('tradeModal');   // 顯示交易選項（推入堆疊）
uiModal.close();              // 關閉交易模態框，返回租客詳情
```

## 🔧 工具模組參考

### TradeDescriptionFormatter
**位置**: `src/js/ui/TradeDescriptionFormatter.js`
**職責**: 統一管理所有交易相關的描述生成邏輯
**架構定位**: UI層專用，與業務邏輯完全分離

#### 核心方法
```javascript
/**
 * 主入口：格式化交易選項描述
 * @param {Object} option - 交易選項原始數據
 * @returns {string} 格式化後的描述
 */
static formatTradeOption(option)

/**
 * 購買類描述生成
 * @param {string} characterName - 角色名稱
 * @param {string} resourceType - 資源類型
 * @param {number} quantity - 數量
 * @param {string} urgency - 緊急程度
 * @returns {string} 描述文字
 */
static formatBuyingDescription(characterName, resourceType, quantity, urgency)

/**
 * 出售類描述生成
 * @param {string} characterName - 角色名稱
 * @param {string} resourceType - 資源類型
 * @param {number} quantity - 數量
 * @returns {string} 描述文字
 */
static formatSellingDescription(characterName, resourceType, quantity)

/**
 * 緊急交易描述生成
 * @param {string} characterName - 角色名稱
 * @param {string} resourceType - 資源類型
 * @param {number} quantity - 數量
 * @param {string} urgency - 緊急程度
 * @returns {string} 描述文字
 */
static formatEmergencyDescription(characterName, resourceType, quantity, urgency)

/**
 * 交易執行成功描述
 * @param {Object} transaction - 交易詳情
 * @returns {string} 執行結果描述
 */
static formatTradeExecutionDescription(transaction)

/**
 * 緊急程度顯示文字
 * @param {string} urgency - 緊急程度
 * @returns {string} 顯示文字
 */
static getUrgencyDisplayText(urgency)

/**
 * 交易類型顯示文字
 * @param {string} type - 交易類型
 * @returns {string} 顯示文字
 */
static getTradeTypeDisplayText(type)
```

#### 使用範例
```javascript
// 基本描述格式化
const option = {
  type: 'buy',
  character: { name: '醫生張三' },
  resourceType: 'medical',
  quantity: 2,
  urgency: 'critical'
};

const description = TradeDescriptionFormatter.formatTradeOption(option);
// 輸出: "醫生張三 急需 2 醫療用品"

// 交易結果描述
const transaction = {
  type: 'buy',
  characterName: '醫生張三',
  item: 'medical',
  quantity: 2,
  price: 50
};

const resultDesc = TradeDescriptionFormatter.formatTradeExecutionDescription(transaction);
// 輸出: "從 醫生張三 購買 2 醫療用品，花費 $50"

// 獲取顯示文字
const urgencyText = TradeDescriptionFormatter.getUrgencyDisplayText('critical');
// 輸出: "極緊急"
```

#### 設計特性
- **純靜態類**: 無狀態，純函數式描述生成
- **業務分離**: 與交易邏輯完全分離，只負責文字格式化
- **一致性**: 統一的描述風格和格式
- **可擴展**: 易於新增新的交易類型描述

### constants.js
**位置**: `src/js/utils/constants.js`

#### 主要常數
```javascript
EVENT_TYPES: {
  SYSTEM: { INITIALIZATION, SHUTDOWN, ERROR_OCCURRED },
  DATA: { LOADED, VALIDATED, CACHED },
  GAME: { STATE_CHANGED, DAY_ADVANCED }
}

SYSTEM_LIMITS: {
  HISTORY: { MAX_EXECUTION_HISTORY: 100 },
  EVENTS: { MAX_EVENT_HISTORY: 50 }
}

ERROR_CODES: {
  CONFIG: { FILE_NOT_FOUND, INVALID_FORMAT },
  VALIDATION: { REQUIRED_FIELD_MISSING, INVALID_TYPE }
}
```

### helpers.js
**位置**: `src/js/utils/helpers.js`

#### 核心函數
```javascript
getNestedValue(obj, path, defaultValue)
createNestedUpdate(path, value)
deepClone(obj)
```

### validators.js
**位置**: `src/js/utils/validators.js`
**狀態**: 可選功能，輕量驗證機制

### Type.js
**位置**: `src/js/utils/Type.js`
**職責**: JSDoc型別定義系統，包含新的交易相關類型

## ⚡ 效能考量與最佳實踐

### 批量操作最佳化
```javascript
// ❌ 避免：頻繁單一操作
for (let tenant of tenants) {
  resourceManager.modifyResource('food', -2, '租客消費');
}

// ✅ 推薦：批量操作
resourceManager.bulkModifyResources({
  changes: { food: -tenants.length * 2 },
  reason: '租客每日消費'
});
```

### 事件發送最佳化
```javascript
// ❌ 避免：過度事件發送
eventBus.emit('resource_modified', { type: 'food', amount: -1 });
eventBus.emit('resource_modified', { type: 'food', amount: -1 });

// ✅ 推薦：合併事件
eventBus.emit('resource_bulk_modified', {
  changes: [{ type: 'food', amount: -2 }, { type: 'fuel', amount: -1 }]
});
```

### 交易系統最佳化
```javascript
// ✅ 推薦：統一API使用
const tradeOptions = tradeManager.getCharacterTradeOptions(characterId);
const result = await tradeManager.executeResourceTrade(tradeOptionId);

// ✅ 推薦：描述格式化快取
const formattedOptions = uiCore.formatTradeOptionsForDisplay(rawOptions);
```

### 效能基準指標
- **每日循環執行時間**: <200ms（正常），>1000ms（需檢查）
- **事件監聽器數量**: 單一事件<10個監聽器
- **記憶體使用**: 遊戲狀態<50MB，配置資料<5MB
- **歷史記錄限制**: 執行歷史100筆，事件歷史50筆
- **交易選項生成**: <50ms（單一角色），<200ms（全部角色）

## 🚨 故障排除與除錯

### 系統診斷命令
```javascript
// 完整系統狀態
gameApp.debug()

// 個別模組狀態
gameApp.dataManager.getSystemStatus()
gameApp.gameState.getStateStats()
gameApp.eventBus.getStats()
gameApp.dayManager.getManagerAvailability()

// 交易系統診斷
gameApp.tradeManager.getTradeStats()
gameApp.tenantManager.validateIDSystemIntegrity()
```

### 常見問題排查流程
1. **配置載入失敗**: 檢查JSON語法 → 使用`dataManager.getSystemStatus()`
2. **事件未觸發**: 驗證事件名稱前綴 → 使用`eventBus.getStats()`
3. **資源計算錯誤**: 檢查修改歷史 → 使用`resourceManager.getModificationHistory()`
4. **效能問題**: 監控執行時間 → 使用`dayManager.getExecutionStats()`
5. **交易錯誤**: 檢查交易選項 → 使用`tradeManager.getCharacterTradeOptions()`
6. **ID系統問題**: 驗證ID完整性 → 使用`tenantManager.validateIDSystemIntegrity()`

### 錯誤代碼對照
- `CONFIG_LOAD_FAILED`: 配置檔案載入失敗 → 檢查JSON格式
- `TENANT_NOT_FOUND`: 租客不存在 → 驗證租客ID
- `INSUFFICIENT_RESOURCES`: 資源不足 → 檢查資源餘額
- `SKILL_ON_COOLDOWN`: 技能冷卻中 → 檢查冷卻時間
- `TRADE_OPTION_NOT_FOUND`: 交易選項不存在 → 檢查交易選項ID
- `CHARACTER_CANNOT_TRADE`: 角色無法交易 → 檢查角色狀態

### 效能監控閾值
- **正常範圍**: 每日循環<200ms，記憶體使用<50MB，交易選項生成<50ms
- **警告範圍**: 每日循環200-1000ms，記憶體使用50-100MB，交易選項生成50-200ms
- **危險範圍**: 每日循環>1000ms，記憶體使用>100MB，交易選項生成>200ms

---

**文件維護原則**: 本文件專注於當前技術事實，避免歷史描述和版本追蹤。配合`TECHNICAL_GUIDE.md`使用，獲得完整的技術實作指導。
{% endraw %}
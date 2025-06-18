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
- TradeManager → RentManager + UniversalTrader
- 所有業務管理器 → BaseManager + GameState + EventBus

**協作關係**（運行時調用，功能性協作）
- UI模組 ↔ 業務管理器（介面觸發業務邏輯）
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
- TradeManager: `trade_collection_completed`, `trade_mutual_aid_executed`

## 🏗️ 核心模組API參考

### DataManager
**位置**: `src/js/core/DataManager.js`
**職責**: 統一資料管理核心
**依賴**: 無外部依賴

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
```

#### 使用範例
```javascript
const dataManager = new DataManager();
const result = await dataManager.initialize();

if (result.success) {
  // 配置路徑存取
  const initialFood = dataManager.getRuleValue('gameDefaults.initialResources.food');
  const exchangeRates = dataManager.getRuleValue('gameBalance.economy.rentPayment.resourceExchangeRates');

  // 技能配置篩選
  const allSkills = dataManager.getAllSkills();
  const doctorSkills = allSkills.filter(skill => skill.tenantType === 'doctor');
}
```

#### 效能特性
- **載入方式**: 並行載入四個配置檔案，任一失敗進入後備模式
- **記憶體使用**: 配置資料常駐記憶體，約2-3MB
- **錯誤恢復**: 配置載入失敗時自動進入後備模式

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
```

#### 效能特性
- **狀態保護**: 深度複製防止意外修改
- **歷史追蹤**: 變更歷史限制100筆記錄
- **並發控制**: 狀態鎖定機制防止衝突

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
```

#### 效能特性
- **批量優先**: 多資源操作使用`bulkModifyResources`減少事件發送
- **轉移驗證**: 完整前置驗證，失敗時零副作用
- **閾值監控**: 自動觸發閾值檢查和警告事件

### TenantManager
**位置**: `src/js/systems/TenantManager.js`
**職責**: 租客生命週期管理
**依賴**: `BaseManager`, `GameState`, `ResourceManager`, `TradeManager`, `DataManager`, `EventBus`

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
 * 滿意度調整
 * @param {number} tenantId - 租客ID
 * @param {number} change - 滿意度變更量
 * @param {string} reason - 變更原因
 * @returns {boolean}
 */
applySatisfactionChange(tenantId, change, reason)

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
 * 重置每日狀態
 * @returns {void}
 */
resetDailyStates()
```

#### 使用範例
```javascript
// 雇用流程
const hiringResult = await tenantManager.hireTenant(1, 2);
if (hiringResult.success) {
  console.log(`${hiringResult.tenant.name} 入住房間 ${hiringResult.roomId}`);
}

// 滿意度管理
tenantManager.applySatisfactionChange(1, 10, '房間維修完成');

// 驅逐處理
const evictionResult = await tenantManager.evictTenant(3, true, '感染風險');
```

#### 效能特性
- **面試計算**: 包含複雜風險評估，大量申請者時注意效能
- **滿意度追蹤**: 歷史記錄限制50筆
- **關係計算**: 租客關係矩陣，建議最大租客數6人

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
1. 重置租客每日狀態（TenantManager.resetDailyStates）
2. 處理每日資源消費（ResourceManager.processDailyConsumption）
3. 處理被動技能（SkillManager.processPassiveSkills）
4. 處理租客互助交易（TradeManager.processMutualAid）
5. 檢查資源閾值（ResourceManager.checkAllResourceThresholds）
6. 生成新申請者（TenantManager.generateApplicants）
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

### TradeManager
**位置**: `src/js/systems/TradeManager.js`
**職責**: 統一交易系統入口
**依賴**: `BaseManager`, `RentManager`, `UniversalTrader`, `ResourceManager`, `DataManager`, `EventBus`

#### 核心方法
```javascript
/**
 * 收取租金
 * @returns {Promise<RentCollectionResult>}
 */
async collectRent()

/**
 * 處理互助交易
 * @returns {Promise<boolean>}
 */
async processMutualAid()
```

## 🖥️ UI模組參考

### UICore
**位置**: `src/js/ui/UICore.js`
**職責**: 統一UI操作入口

#### 核心方法
```javascript
async hireTenant(applicantId)
evictTenant(tenantId, isInfected = false)
async useSkillWithTenant(skillId, tenantId, options = {})
async collectRent()
nextDay()
```

### UIDisplay
**位置**: `src/js/ui/UIDisplay.js`
**職責**: 畫面顯示邏輯
**狀態**: 功能完整，UI更新邏輯複雜度較高

### UIModal
**位置**: `src/js/ui/UIModal.js`
**職責**: 彈窗系統管理

## 🔧 工具模組參考

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
**職責**: JSDoc型別定義系統

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

### 效能基準指標
- **每日循環執行時間**: <200ms（正常），>1000ms（需檢查）
- **事件監聽器數量**: 單一事件<10個監聽器
- **記憶體使用**: 遊戲狀態<50MB，配置資料<5MB
- **歷史記錄限制**: 執行歷史100筆，事件歷史50筆

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
```

### 常見問題排查流程
1. **配置載入失敗**: 檢查JSON語法 → 使用`dataManager.getSystemStatus()`
2. **事件未觸發**: 驗證事件名稱前綴 → 使用`eventBus.getStats()`
3. **資源計算錯誤**: 檢查修改歷史 → 使用`resourceManager.getModificationHistory()`
4. **效能問題**: 監控執行時間 → 使用`dayManager.getExecutionStats()`

### 錯誤代碼對照
- `CONFIG_LOAD_FAILED`: 配置檔案載入失敗 → 檢查JSON格式
- `TENANT_NOT_FOUND`: 租客不存在 → 驗證租客ID
- `INSUFFICIENT_RESOURCES`: 資源不足 → 檢查資源餘額
- `SKILL_ON_COOLDOWN`: 技能冷卻中 → 檢查冷卻時間

### 效能監控閾值
- **正常範圍**: 每日循環<200ms，記憶體使用<50MB
- **警告範圍**: 每日循環200-1000ms，記憶體使用50-100MB
- **危險範圍**: 每日循環>1000ms，記憶體使用>100MB

---

**文件維護原則**: 本文件專注於當前技術事實，避免歷史描述和版本追蹤。配合`TECHNICAL_GUIDE.md`使用，獲得完整的技術實作指導。
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
- TradeManager → RentManager + UniversalTrader + TenantManager
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
**職責**: 租客生命週期管理與統一ID系統
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
 * 統一個人ID管理
 * @returns {number} 新的個人ID
 */
generatePersonId()

/**
 * 註冊個人到系統
 * @param {number} id - 個人ID
 * @param {Object} person - 個人物件
 * @param {string} role - 角色標識 ('tenant', 'applicant', 'visitor')
 */
registerPerson(id, person, role)

/**
 * 根據ID取得個人
 * @param {number} id - 個人ID
 * @returns {Object|null} 個人物件
 */
getPersonById(id)

/**
 * 驗證ID系統完整性
 * @returns {Object} 驗證結果
 */
validateIDSystemIntegrity()

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

// ID管理
const newId = tenantManager.generatePersonId();
tenantManager.registerPerson(newId, personData, 'applicant');

// 滿意度管理
tenantManager.applySatisfactionChange(1, 10, '房間維修完成');

// 系統診斷
const integrity = tenantManager.validateIDSystemIntegrity();
if (integrity.issues.length > 0) {
  console.warn('ID系統發現問題:', integrity.issues);
}
```

#### 效能特性
- **面試計算**: 包含複雜風險評估，大量申請者時注意效能
- **滿意度追蹤**: 歷史記錄限制50筆
- **關係計算**: 租客關係矩陣，建議最大租客數6人
- **ID管理**: 統一的數字型ID系統，支援完整性驗證

### TradeManager
**位置**: `src/js/systems/TradeManager.js`
**職責**: 統一交易系統入口，整合租金收取和租客交易
**依賴**: `BaseManager`, `RentManager`, `UniversalTrader`, `ResourceManager`, `TenantManager`, `DataManager`, `EventBus`

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
 * 取得交易統計
 * @returns {TradeStats} 交易統計資料
 */
getTradeStats()
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
```

#### 效能特性
- **子模組協調**: 統一管理 RentManager 和 UniversalTrader
- **事件整合**: 統一發送交易相關事件
- **統計追蹤**: 完整的交易統計和每日統計
- **錯誤處理**: 統一的錯誤處理和回傳格式

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

#### 效能特性
- **事件整合**: 統一處理UI事件回調
- **描述格式化**: 使用TradeDescriptionFormatter統一交易描述
- **狀態同步**: 自動更新UI顯示狀態

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
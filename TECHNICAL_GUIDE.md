# 技術架構指南

末日房東模擬器採用ES6模組化架構，使用配置驅動設計和事件通信機制。本文件說明系統的技術實作和架構組織。

## ES6模組化架構

### 分層架構設計
系統採用四層分層架構，嚴格實施單向依賴：

```
main.js (應用整合層)
   ↓
systems/ (業務邏輯層)
   ↓
core/ (核心服務層)
   ↓
utils/ (工具基礎層)
```

### 模組初始化序列
main.js按照嚴格的依賴順序進行模組初始化，確保依賴關係的正確性：

```javascript
// 1. 核心基礎設施
eventBus = new EventBus();
dataManager = new DataManager();

// 2. 狀態管理（依賴DataManager的初始化結果）
gameState = new GameState(dataResult.data);

// 3. 業務模組按依賴順序初始化
resourceManager = new ResourceManager(gameState, eventBus);
tenantManager = new TenantManager(gameState, resourceManager, dataManager, eventBus);
tradeManager = new TradeManager(gameState, resourceManager, tenantManager, dataManager, eventBus);
skillManager = new SkillManager(gameState, eventBus, dataManager, resourceManager);
dayManager = new DayManager(gameState, eventBus, resourceManager, tenantManager, tradeManager, skillManager);
```

### 依賴注入機制
每個業務模組在建構函式中明確聲明所需依賴，採用建構函式注入避免運行時查找。TradeManager協調三個內部子系統：RentManager（租金管理）、UniversalTrader（租客交易）、CommissionHandler（委託處理），並共享使用ExplorationManager（探索執行）提供委託探索功能，形成統一的交易API介面。

## 配置驅動系統

### 配置檔案結構
DataManager管理四個JSON配置檔案，支援動態配置更新：

**rules.json** - 遊戲規則和平衡參數
- `gameDefaults.initialResources` - 初始資源配置
- `gameBalance.economy` - 經濟系統參數
- `gameBalance.tenants` - 租客系統配置
- `gameBalance.explorationSystem` - 探索系統配置
- `characterGeneration` - 角色生成參數

**tenants.json** - 租客類型定義
- 5種租客類型：doctor, worker, farmer, soldier, elder
- 每種類型包含技能、租金、感染風險、個人資源

**skills.json** - 技能系統配置
- 15個技能的完整定義
- 技能類型：active, passive, special
- 技能效果和執行邏輯

**events.json** - 事件系統配置
- 4類事件：隨機、衝突、特殊、腳本
- 事件觸發條件和執行結果

### 並行載入機制
DataManager使用Promise.all實現配置檔案的並行載入：

```javascript
const loadPromises = [
  this.loadConfig("rules"),
  this.loadGameData("tenants"),
  this.loadGameData("skills"),
  this.loadGameData("events")
];
await Promise.all(loadPromises);
```

配置載入失敗時系統拋出具體錯誤，採用快速失敗策略確保問題早期發現。

### 配置存取API
DataManager提供統一的配置存取介面：

```javascript
getGameRules()      // 取得遊戲規則配置
getTenantTypes()    // 取得租客類型陣列
getAllSkills()      // 取得完整技能集合
getEventData()      // 取得事件資料集合
getRuleValue(path)  // 支援路徑查詢：'gameBalance.explorationSystem.baseSuccessRate'
```

## EventBus事件通信

### 發布訂閱實作
EventBus實現標準的發布/訂閱模式，支援模組間解耦通信。提供同步和非同步事件處理，內建事件歷史追蹤和統計功能。

### 智慧事件前綴策略
BaseManager實作三層事件前綴自動解析，實現混合分層策略：

```javascript
// 系統級前綴（跨模組生命週期事件）
SYSTEM_PREFIXES: ["system_", "game_", "day_"]

// 業務領域前綴（跨模組業務流程，無專責管理器）
BUSINESS_PREFIXES: ["harvest_"]

// 模組專屬前綴（有對應管理器的功能領域）
MODULE_PREFIXES: ["resource_", "tenant_", "trade_", "skill_", "exploration_"]
```

事件名稱解析邏輯：
1. 檢查系統級前綴 → 直接使用，無需模組前綴
2. 檢查業務領域前綴 → 跨模組事件，保持原名
3. 檢查模組前綴存在 → 避免重複添加前綴
4. 其他情況 → 自動添加當前模組前綴

### 事件通信範例
```javascript
// 發送事件（BaseManager統一介面）
this.emitEvent('cycle_start', { day: newDay })

// 監聽事件（支援前綴解析）
this.onEvent('day_advanced', callback, { skipPrefix: true })
```

## GameState狀態管理

### 中央狀態設計
GameState作為系統的單一真實來源，管理所有遊戲狀態。採用深度複製機制保護狀態不變性，防止意外的狀態污染。

### 路徑式狀態存取
支援點記法路徑快速存取嵌套狀態：

```javascript
getStateValue('resources.cash')           // 取得現金資源
getStateValue('rooms.0.needsRepair')     // 取得房間維修狀態
modifyResource('food', -5)               // 修改食物資源
hasEnoughResource('materials', 10)       // 檢查資源充足性
```

### 狀態歷史追蹤
GameState記錄狀態變更歷史，支援除錯分析和潛在回滾需求。使用循環緩衝區限制歷史記錄大小，防止記憶體無限增長。

## BaseManager統一架構

### 抽象基礎類設計
所有業務管理器繼承BaseManager，獲得統一的基礎功能：

- **事件通信**：智慧前綴解析，統一發送監聽介面
- **日誌記錄**：分類日誌管理，支援除錯追蹤
- **狀態管理**：標準化的狀態取得和擴展機制
- **初始化流程**：統一的初始化和依賴驗證流程

### 模組前綴定義
每個業務管理器實作getModulePrefix()方法：
- ResourceManager: "resource"
- TradeManager: "trade"
- TenantManager: "tenant"
- SkillManager: "skill"
- DayManager: "day"
- ExplorationManager: "exploration"

### 跨模組共享設計

#### ExplorationManager 共享依賴架構
ExplorationManager採用共享依賴模式，同時服務兩個不同的業務場景：

**TradeManager委託探索**：
- 通過CommissionHandler處理房東發起的委託邀約
- 委託接受後委託給ExplorationManager執行探索
- 處理委託報酬支付和統計追蹤

**TenantManager自主探索**：
- 透過setExplorationManager()後注入方式取得探索能力
- 評估租客自主探索需求（食物短缺、經濟壓力）
- 自動觸發探索並處理結果分配

此設計避免了探索邏輯重複實作，確保探索機制的一致性和統計數據的統一管理。

## 業務模組架構

### ResourceManager - 資源基礎設施
負責所有資源流轉控制，提供統一的資源修改介面：
- 閾值監控：警告線、危險線、緊急線三層監控
- 轉移驗證：完整的前置條件檢查和餘額驗證
- 狀態評估：實時資源狀態評估和自動警告

### TradeManager - 統一交易入口
協調四個子系統實現完整交易生態：
- **RentManager**: 租金計算、收取流程、優惠懲罰機制
- **UniversalTrader**: 租客個人交易、互助協作
- **CommissionHandler**: 委託邀約處理、接受機率計算
- **ExplorationManager**: 探索執行統一管理、統計追蹤（與TenantManager共享）
- **統一API**: collectRent(), processMutualAid(), offerCommission()等統一介面

### TenantManager - 租客生命週期
管理租客完整生命週期，採用組合模式整合專責子系統：
- 租客管理：雇用/驅逐流程、狀態變更、個人資源管理
- 申請者系統：申請者生成、面試評估、風險檢測
- 滿意度系統：組合SatisfactionManager專責處理滿意度計算、歷史追蹤
- 關係管理：組合RelationshipManager專責處理租客間關係值計算、狀態管理
- 自主探索：探索觸發評估、優先級計算、夥伴配對邏輯（與TradeManager共享ExplorationManager）

#### 專責管理器獨立化設計
系統採用獨立模組組合模式，而非內建組件模式：

**RelationshipManager** - 租客關係專責管理
- **獨立檔案架構**：`src/js/systems/RelationshipManager.js`
- **職業關係矩陣**：基於租客職業類型計算初始關係值
- **統一ID系統**：支援關係值查詢、設置和調整
- **事件響應**：監聽探索結果等事件，動態調整關係值
- **清理機制**：租客離開時自動清理相關關係記錄

**SatisfactionManager** - 滿意度專責管理
- **獨立檔案架構**：`src/js/systems/SatisfactionManager.js`
- **滿意度計算**：多因子滿意度演算法
- **歷史追蹤**：滿意度變更歷史記錄
- **狀態分析**：滿意度等級評估和風險預警

### SkillManager - 技能執行引擎
實現15個技能的執行邏輯，支援三種技能類型：
- **主動技能**: 消耗資源，主動觸發強力效果
- **被動技能**: 持續生效，提供穩定加成
- **特殊技能**: 限制次數，帶來永久性改善

### ExplorationManager - 探索系統核心
統一管理所有探索相關功能：
- **探索執行**：統一的探索請求處理和結果生成
- **統計追蹤**：成功率趨勢、收益分析、參與者統計
- **配置驅動**：基於rules.json的探索參數動態調整
- **事件協調**：探索開始、完成、失敗事件的統一發送

### DayManager - 循環協調器
作為頂層協調器，統籌各業務模組的每日循環：
1. 重置租客每日狀態（TenantManager）
2. 處理每日資源消費（ResourceManager）
3. 處理被動技能（SkillManager）
4. 處理租客互助交易（TradeManager）
5. 推進天數並觸發系統事件

## 委託探索系統架構

### 設計原理
委託探索系統採用分離關注點設計，將委託決策和探索執行分離：

- **CommissionHandler**: 專責委託邀約的評估、決策和管理
- **ExplorationManager**: 專責探索過程的執行、統計和事件協調

### 委託處理流程
1. **邀約評估**: 基於租客狀態、關係度、資源急迫性計算接受機率
2. **組隊邏輯**: 自動評估是否需要組隊，基於技能互補性匹配夥伴
3. **決策執行**: 一次性隨機決策，避免重複計算
4. **探索委託**: 接受後委託給ExplorationManager執行實際探索

### 配置驅動特性
探索系統完全依賴配置檔案驅動：

```javascript
// rules.json 配置路徑
gameBalance.explorationSystem.exploration.baseSuccessRate
gameBalance.explorationSystem.rewards.resourceRanges
gameBalance.explorationSystem.acceptance.baseRate
gameBalance.explorationSystem.teamwork.skillSynergyBonus
```

## UI系統架構

### 三層UI架構設計
UI系統採用三層分離架構，職責明確劃分：

- **UICore**: 統一對外介面和業務邏輯協調器
- **UIDisplay**: 畫面顯示邏輯和DOM更新控制
- **UIModal**: 模態框系統管理和生命週期控制

### TradeDescriptionFormatter
專用描述格式化器統一管理交易相關文本生成：
- 交易選項描述：購買、出售、緊急交易
- 互助事件描述：食物援助、現金借貸、醫療協助
- 交易執行描述：成功完成後的結果文本
- 委託邀約描述：探索目標、報酬、風險評估

## 型別安全機制

### JSDoc + TypeScript檢查
每個JavaScript檔案使用`// @ts-check`啟用TypeScript型別檢查。Type.js集中管理所有型別定義，避免重複和不一致：

```javascript
/**
 * 資源類型聯合型別
 * @typedef {'food'|'materials'|'medical'|'fuel'|'cash'} ResourceType
 */

/**
 * 租客類型聯合型別
 * @typedef {'doctor'|'worker'|'farmer'|'soldier'|'elder'} TenantType
 */

/**
 * 探索請求類型
 * @typedef {'commission'|'autonomous'} ExplorationType
 */
```

所有模組方法提供完整JSDoc註解，在開發階段獲得型別檢查和自動完成支援。

## GitHub Pages部署配置

### 零建置工具部署
系統設計完全相容GitHub Pages靜態託管，直接部署ES6模組無需Webpack或Rollup等建置工具。所有資源使用相對路徑載入，確保部署路徑正確性。

### 瀏覽器相容性要求
**最低技術要求**：
- Chrome 61+ (ES6模組原生支援)
- Firefox 60+ (ES6模組完整支援)
- Safari 10.1+ (ES6模組基礎支援)

### 配置熱更新流程
1. 修改對應JSON配置檔案
2. 推送變更到Git儲存庫
3. GitHub Pages自動重新部署
4. 瀏覽器重新載入時自動獲取新配置

DataManager在載入時進行JSON語法驗證和配置完整性檢查，配置載入失敗時提供明確錯誤提示。

## 效能與記憶體管理

### 懶載入策略
模組按需載入，配置檔案並行載入最大化初始化效率。事件歷史和狀態歷史採用循環緩衝區設計，限制最新100筆記錄防止記憶體無限增長。

### 錯誤隔離機制
單一模組錯誤不影響其他模組運作。BaseManager提供統一的錯誤處理和降級機制，配置載入失敗時提供具體修復建議。

### 內建監控功能
系統提供完整的狀態監控和統計：

```javascript
// 完整系統狀態診斷
gameApp.debug()

// 各子系統狀態檢查
gameApp.dataManager.getSystemStatus()
gameApp.gameState.getStateStats()
gameApp.eventBus.getStats()
gameApp.tradeManager.getTradeStats()
gameApp.tradeManager.getCommissionStats()
gameApp.tradeManager.getExplorationStats()
```

開發環境使用dev-test.html提供完整測試環境，URL參數`?debug=true`啟用詳細日誌模式。
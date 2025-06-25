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

### 核心模組分佈

**utils層 (工具基礎層)**
- `SystemLogger` - 統一系統級訊息管理
- `helpers` - 基礎物件操作工具
- `constants` - 系統常數和訊息模板
- `validators` - 輕量級驗證機制

**core層 (核心服務層)**
- `LoadingManager` - 初始化流程協調管理
- `DataManager` - 統一資料載入和配置管理
- `GameState` - 中央狀態管理系統
- `EventBus` - 事件驅動通信機制

**systems層 (業務邏輯層)**
- `BaseManager` - 管理器基礎類，提供統一介面
- 各種業務管理器（ResourceManager、TenantManager等）

**ui層 (使用者介面層)**
- `UICore` - UI系統統一協調器，提供對外介面
- `UIDisplay` / `UIModal` - 顯示和模態框管理
- `modal/` - 各功能專用模態框模組
- `TradeDescriptionFormatter` - 交易描述格式化

### 模組初始化序列
main.js按照明確的依賴順序初始化所有模組：

```javascript
// 1. 除錯模式配置（最優先）
_detectDebugMode() // URL參數和localStorage檢測
systemLogger.setDebugMode(debugMode) // 統一除錯狀態

// 2. 載入流程協調（應用整合層）
loadingManager.startInitialization(steps, config)

// 3. 核心基礎設施
EventBus()
DataManager() // 純資料載入職責

// 4. 狀態管理（依賴DataManager）
GameState(dataResult.data)

// 5. 業務模組依賴注入
ResourceManager(gameState, eventBus)
TenantManager(gameState, resourceManager, dataManager, eventBus)
TradeManager(gameState, resourceManager, tenantManager, dataManager, eventBus)
SkillManager(gameState, eventBus, dataManager, resourceManager)
DayManager(gameState, eventBus, resourceManager, tenantManager, tradeManager, skillManager)
```

### 依賴注入機制
每個業務模組在建構函式中明確聲明所需依賴，避免運行時查找。TradeManager依賴TenantManager並內部協調RentManager和UniversalTrader兩個子模組，提供統一的交易API介面。

### 職責分離原則實施
架構重構實現明確的職責邊界：
- **main.js（應用整合層）**：統一負責LoadingManager流程協調、除錯模式管理、延遲初始化控制
- **DataManager（核心服務層）**：專注純資料載入職責，移除UI協調邏輯，提升測試獨立性
- **LoadingManager（工具基礎層）**：恢復單例模式完整性，避免多重控制者衝突

## GameState狀態管理

### 中央化狀態設計理念
GameState實現單一資料源原則，所有遊戲狀態集中管理。此設計消除狀態分散導致的一致性問題，確保狀態變更的可追蹤性和可回溯性。

### 路徑式存取機制
實作點記法路徑存取，支援嵌套物件的統一操作介面。路徑式存取降低狀態操作的複雜度，提供類型安全的狀態查詢能力，避免深層嵌套存取的空值錯誤。

### 狀態同步策略
採用事件驅動的狀態同步機制，狀態變更自動觸發相關事件通知。此策略確保UI和業務邏輯的即時同步，同時維持模組間的低耦合特性。

### 歷史追蹤機制
內建狀態變更歷史記錄，支援操作回溯和除錯分析。歷史追蹤採用循環緩衝區設計，限制記憶體使用量同時提供充足的除錯資訊。

## BaseManager統一架構

### 繼承體系設計原理
BaseManager提供業務模組的統一基礎架構，標準化模組生命週期管理、事件通信和錯誤處理機制。此設計確保所有業務模組行為的一致性和可預測性。

### 混合分層前綴策略
實作智慧事件前綴解析，自動判斷事件的作用域和路由目標。系統級事件直接路由，業務領域事件跨模組傳播，模組專屬事件自動添加前綴，消除事件命名衝突。

### 錯誤隔離機制
每個管理器獨立處理錯誤，錯誤不向上傳播影響其他模組。BaseManager提供統一的錯誤處理模板，確保系統穩定性和故障定位的準確性。

### 生命週期標準化
定義標準的初始化、配置載入、清理和銷毀流程。生命週期標準化簡化模組管理複雜度，提供可靠的資源管理和記憶體回收機制。

## 業務模組架構

### 依賴注入策略
採用建構函式依賴注入，明確聲明模組間的依賴關係。此策略提高程式碼可測試性，簡化模組替換和升級流程，確保依賴關係的顯式化和可驗證性。

### 模組解耦設計
業務模組間透過EventBus進行通信，避免直接方法調用建立的強耦合關係。解耦設計提高系統的彈性和可維護性，支援模組的獨立開發和測試。

### 循環依賴避免機制
透過分層架構和依賴方向約束，系統性避免循環依賴的產生。高層模組可依賴低層模組，同層模組透過事件通信，確保依賴圖的有向無環特性。

### 職責邊界劃分
每個業務模組維持單一職責，職責邊界清晰且不重疊。明確的職責劃分降低模組間的耦合度，提高程式碼的可理解性和維護效率。

### 狀態約束機制
業務模組實現多重狀態約束檢查，確保遊戲邏輯的一致性：
- 受傷狀態約束：受傷租客無法參與探索委託
- 任務狀態約束：執行中租客無法接受新委託  
- 狀態優先級：受傷 > 任務中 > 可用

## 異步業務流程架構

### 探索系統異步化設計理念
ExplorationManager實現從同步執行到異步多日處理的架構轉換，支援真實時間流逝的探索機制。此設計將即時完成的探索改為跨日期的持續活動，提升遊戲沉浸感和策略性。

### 異步狀態管理機制
```javascript
// 進行中探索的狀態追蹤
ongoingExplorations: Map<requestId, explorationState>

// 關鍵狀態屬性
{
  startDay: number,           // 開始日期
  completionDay: number,      // 預計完成日期
  explorationDays: number,    // 總探索天數
  predeterminedSuccess: boolean, // 預計算結果
  currentDay: number,         // 目前探索進行天數
  participantStatus: Array    // 參與者狀態追蹤
}
```

### 探索天數計算策略
基於資源類型、目標數量和參與者規模的動態天數計算：
- 基礎天數：最少1天（當天出發，次日返回）
- 資源難度係數：food(0.2) < fuel(0.3) < materials(0.4) < medical(0.6)
- 組隊最佳化：多人探索減少20%時間
- 上限約束：最多7天探索期

### 每日檢查機制
DayManager的`day_start`事件觸發ExplorationManager的每日檢查流程：
1. 遍歷所有進行中探索
2. 檢查完成條件（當前日期 >= 完成日期）
3. 執行探索結果計算和資源分配
4. 更新參與者狀態並發送完成事件

## 智能市場評估系統

### 價格合理性評估原理
CommissionHandler實現基於市場基準價格的委託合理性評估機制，通過五級評估體系（generous/fair_plus/fair/underpaid/exploitative）量化報酬公平性。

### 評估影響因子設計
```javascript
marketFairnessWeight: 0.25  // 基礎影響權重

// 極端情況權重加強機制
if (evaluation === 'generous') {
  marketWeight *= 2.0;      // 報酬豐厚時大幅提升接受率
} else if (evaluation === 'exploitative') {
  marketWeight *= 2.5;      // 報酬過低時大幅降低接受率
}
```

### 價格比率計算機制
- 目標資源市場價值：`targetAmount × baseResourceValues[resourceType]`
- 基礎報酬價值：排除佣金的純報酬價值計算
- 合理性比率：`baseRewardValue / targetResourceValue`
- 分級閾值：≥1.5(generous), ≥1.2(fair_plus), ≥0.8(fair), ≥0.6(underpaid), <0.6(exploitative)

## UI系統架構

### 三層分離設計理念
採用UICore（協調層）、UIModal（內容層）、UIDisplay（狀態層）的三層分離架構。此設計實現關注點分離，提高UI系統的可測試性和可維護性。

### 職責分工機制
UICore負責事件協調和業務邏輯調用，UIModal專責內容生成和展示邏輯，UIDisplay處理狀態更新和DOM操作。清晰的職責分工避免功能重疊和責任混淆。

### API重用策略
優先使用現有API而非重複實作相似功能，透過統一的介面規範降低系統複雜度。API重用提高程式碼一致性，減少維護成本和錯誤機率。

### 狀態驅動更新
UI更新完全由狀態變更驅動，避免手動DOM操作的不一致性。狀態驅動設計確保UI與資料的同步性，簡化除錯和測試流程。

## 統一訊息管理系統

### 設計原理
系統實施訊息分離策略，明確區分系統級訊息與遊戲內容：

**SystemLogger (系統級訊息)**
- 職責：處理初始化、載入、錯誤等系統級事件
- 輸出：Console專用，提供結構化系統診斷
- 特性：支援分組輸出、多參數格式、智能錯誤處理

**GameLogger (遊戲日誌)**
- 職責：處理玩家行動、遊戲事件等內容
- 輸出：遊戲日誌UI，提供玩家可見的遊戲回饋
- 特性：類型化日誌、事件觸發、狀態同步

### 訊息路由機制
BaseManager實作智能訊息路由：

```javascript
// 系統級錯誤 → SystemLogger
if (error instanceof Error) {
  systemLogger.error(message, error);
}

// 遊戲邏輯事件 → GameLogger
gameLogger.addGameLog(message, type, options);
```

### API設計理念
SystemLogger遵循AI編碼習慣友善的設計原則：
- 提供完整的日誌級別方法，避免方法不存在錯誤
- 支援分組輸出機制，提供結構化除錯資訊
- 支援多參數格式，兼容現有console使用模式
- 提供自動管理的便捷方法，減少手動錯誤
- 實作統一錯誤處理和緊急後備機制

## 配置驅動系統

### 配置檔案結構
DataManager管理四個JSON配置檔案：

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

### 分層載入機制
架構重構後的載入職責分離遵循嚴格的分層原則：

**職責邊界定義**：
- **應用整合層（main.js）**：負責整體流程協調和使用者體驗控制
- **核心服務層（DataManager）**：專注資料載入邏輯和完整性保證
- **工具基礎層（LoadingManager）**：提供流程協調基礎設施

**設計原理**：
單一控制者模式確保載入流程的一致性和可預測性。應用整合層統一管理載入步驟定義和進度追蹤，核心服務層專注於資料處理邏輯，避免跨層職責混淆導致的架構複雜性。

**並行處理策略**：
DataManager採用Promise.all實現配置檔案並行載入，最大化I/O效率。並行載入策略在保持資料一致性的前提下，顯著縮短初始化時間，提升系統啟動效能。

### 架構優勢
職責分離實現的技術收益：
- **測試獨立性**：DataManager可在純Node.js環境中測試，無需DOM依賴
- **單例完整性**：LoadingManager恢復單一控制者模式，消除重複初始化警告
- **錯誤隔離**：資料載入錯誤與UI協調錯誤完全分離
- **效能最佳化**：消除跨層依賴開銷，節省啟動時間約50ms，降低記憶體佔用
- **架構清晰度**：明確的職責邊界提升程式碼可維護性和模組重用性

### 配置管理理念
DataManager實現統一配置管理機制，支援路徑式存取和熱更新。配置載入採用快速失敗策略，確保問題早期發現和明確錯誤定位。

## EventBus事件通信

### 發布訂閱實作
EventBus實現標準的發布/訂閱模式，支援模組間解耦通信。提供同步和非同步事件處理，內建事件歷史追蹤和統計功能。

### 智慧事件前綴策略
BaseManager實作三層事件前綴自動解析：

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
4. 其他情況 → 自動添加模組專屬前綴

### 系統級事件統一規範
DayManager統一使用`day_`前綴的系統級事件，取代原先的`cycle_`命名模式：
- `day_start` - 每日開始事件，觸發跨模組的日間檢查流程
- `day_complete` - 每日完成事件，標示日間處理的結束
- `day_failed` - 每日失敗事件，處理異常情況的回復機制

此統一規範確保事件命名的一致性，避免前綴解析衝突，提供清晰的事件語義。

### 事件除錯支援
BaseManager提供結構化事件除錯機制，透過SystemLogger的分組功能實現階層化的事件分析輸出，便於開發階段的問題診斷和效能最佳化。

## 型別安全機制

### JSDoc型別註解策略
採用JSDoc型別註解配合TypeScript檢查，在無外部依賴的前提下實現型別安全。此策略平衡開發效率和執行時效能，避免編譯步驟的複雜性。

### 型別檢查實作
每個JavaScript檔案開頭添加`// @ts-check`指令，啟用TypeScript編譯器的型別檢查功能。型別檢查在開發階段捕獲型別錯誤，提高程式碼品質和維護性。

### 介面定義規範
透過JSDoc定義清晰的介面契約，確保模組間資料交換的型別一致性。介面定義提供自動完成和型別驗證，降低整合錯誤的發生機率。

### 型別安全策略
結合輕量級驗證機制，在關鍵資料流轉點進行執行時型別檢查，提供開發時和執行時的雙重型別安全保障。

## GitHub Pages部署架構

### 靜態資源最佳化
零建置工具設計，所有資源可直接部署：

**配置熱更新**
1. 修改對應JSON配置檔案
2. 推送變更到Git儲存庫
3. GitHub Pages自動重新部署
4. 瀏覽器重新載入時自動獲取新配置

DataManager在載入時進行JSON語法驗證和配置完整性檢查，配置載入失敗時提供明確錯誤提示。

## 效能與記憶體管理

### 懶載入策略
模組按需載入，配置檔案並行載入最大化初始化效率。LoadingManager提供載入進度控制，確保所有非同步初始化完成後才允許用戶操作。

### 訊息系統效能
- **SystemLogger**：結構化輸出減少Console混亂，支援條件除錯減少生產環境開銷
- **分組管理**：withGroup方法確保分組正確結束，避免Console階層混亂
- **錯誤隔離**：訊息系統錯誤不影響業務邏輯執行

### 記憶體管理機制
事件歷史和狀態歷史採用循環緩衝區設計，限制最新100筆記錄防止記憶體無限增長。LoadingManager的UI鎖定機制防止重複初始化和資源洩漏。

### 錯誤隔離機制
單一模組錯誤不影響其他模組運作。BaseManager提供統一的錯誤處理和降級機制，SystemLogger提供緊急後備輸出確保關鍵錯誤不被遺漏。

### 內建監控機制
系統提供分層式狀態監控架構，每個核心模組都實作標準化的狀態查詢介面。開發環境支援完整的診斷模式，透過URL參數啟用詳細日誌輸出，便於問題追蹤和效能分析。
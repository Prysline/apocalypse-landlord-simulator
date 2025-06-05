# BaseManager v2.0 開發指南

## 📋 文檔概覽

本指南提供BaseManager v2.0的完整開發參考，包含API調用、整合範例、除錯指導和最佳實踐。適用於末日房東模擬器的單人開發場景，是所有業務管理器的統一基礎架構。

**版本**：BaseManager v2.0 (混合分層前綴策略版)  
**更新日期**：2025年  
**相容性**：需要 GameState, EventBus  
**核心創新**：智慧事件前綴解析，解決模組間事件命名衝突

---

## 🚀 快速開始

### 基本繼承模式

```javascript
// 1. 引入BaseManager
import BaseManager from '../utils/BaseManager.js';

// 2. 建立業務管理器類別
class ResourceManager extends BaseManager {
    constructor(gameState, eventBus) {
        super(gameState, eventBus, 'ResourceManager');
    }
    
    // 必須實作：定義模組前綴
    getModulePrefix() {
        return 'resource';
    }
    
    // 必須實作：設置事件監聽器
    setupEventListeners() {
        this.onEvent('game_state_changed', (eventObj) => {
            this.handleStateChange(eventObj.data);
        });
    }
    
    // 可選實作：擴展狀態資訊
    getExtendedStatus() {
        return {
            operationCount: this.operationCount,
            lastOperationTime: this.lastOperationTime
        };
    }
}

// 3. 初始化管理器
const resourceManager = new ResourceManager(gameState, eventBus);
await resourceManager.initialize();
```

### 統一初始化流程

```javascript
// 標準初始化模式（建議在子類別中實作）
async initialize() {
    try {
        // 1. 載入配置（子類別實作）
        await this.loadConfiguration();
        
        // 2. 設置事件監聽器
        this.setupEventListeners();
        
        // 3. 標記初始化完成
        this.markInitialized(true);
        
        console.log(`✅ ${this.managerType} 初始化完成`);
    } catch (error) {
        this.logError('初始化失敗', error);
        this.markInitialized(false);
    }
}
```

---

## 📚 核心API完整參考

### 事件通信類 API

#### `emitEvent(eventName, data, options)`
發送事件，使用智慧前綴解析自動處理事件命名。

**參數：**
- `eventName` (string): 事件名稱
- `data` (any, 可選): 事件資料
- `options` (Object, 可選): 事件選項
  - `skipPrefix` (boolean): 是否跳過前綴處理
  - `skipLog` (boolean): 是否跳過日誌記錄

**智慧前綴解析規則：**
```javascript
// 系統級事件（保持原名）
this.emitEvent('system_ready', data);
// → 實際發送: 'system_ready'

// 業務領域事件（保持原名）
this.emitEvent('harvest_completed', data);
// → 實際發送: 'harvest_completed'

// 模組內部事件（自動添加前綴）
this.emitEvent('threshold_warning', data);
// → 實際發送: 'resource_threshold_warning'
```

**使用範例：**
```javascript
// 發送模組專屬事件
this.emitEvent('modified', {
    resourceType: 'food',
    amount: 10,
    newValue: 30
});
// 自動解析為: 'resource_modified'

// 發送跨模組業務事件
this.emitEvent('harvest_completed', {
    amount: 8,
    bonusApplied: true
});
// 保持原名: 'harvest_completed'

// 跳過前綴處理
this.emitEvent('custom_system_event', data, { skipPrefix: true });
// 直接發送: 'custom_system_event'
```

#### `onEvent(eventName, callback, options)`
監聽事件，支援智慧前綴解析和錯誤處理。

**參數：**
- `eventName` (string): 事件名稱
- `callback` (Function): 回調函數
- `options` (Object, 可選): 監聽選項
  - `once` (boolean): 是否只監聽一次
  - `skipPrefix` (boolean): 是否跳過前綴處理

**使用範例：**
```javascript
// 監聽系統級事件
this.onEvent('system_ready', (eventObj) => {
    console.log('系統已就緒:', eventObj.data);
});

// 監聽跨模組業務事件
this.onEvent('harvest_completed', (eventObj) => {
    this.updateResourceDisplay(eventObj.data);
});

// 一次性監聽
this.onEvent('initialization_completed', (eventObj) => {
    this.performPostInitTasks();
}, { once: true });

// 監聽其他模組事件（會自動解析前綴）
this.onEvent('tenantHired', (eventObj) => {
    this.updateResourceAllocation();
});
// 實際監聽: 'tenant_tenantHired'
```

### 日誌記錄類 API

#### `addLog(message, type, options)`
記錄日誌到遊戲系統，自動添加管理器來源標識。

**參數：**
- `message` (string): 日誌訊息
- `type` (LogType, 可選): 'event' | 'rent' | 'danger' | 'skill'，預設為'event'
- `options` (Object, 可選): 日誌選項
  - `skipGameLog` (boolean): 是否跳過遊戲日誌
  - `skipEvent` (boolean): 是否跳過事件發送
  - `forceConsole` (boolean): 是否強制控制台輸出

**使用範例：**
```javascript
// 基本日誌記錄
this.addLog('資源修改完成', 'event');
// 輸出: '[ResourceManager] 資源修改完成'

// 錯誤日誌
this.addLog('操作失敗：資源不足', 'danger');

// 成功日誌
this.addLog('院子採集獲得食物', 'rent');

// 技能相關日誌
this.addLog('醫生使用治療技能', 'skill');

// 僅控制台輸出（不記錄到遊戲日誌）
this.addLog('除錯訊息', 'event', { 
    skipGameLog: true, 
    forceConsole: true 
});
```

#### `logError(message, error)`, `logWarning(message)`, `logSuccess(message)`
便捷的專用日誌記錄方法。

**使用範例：**
```javascript
// 錯誤日誌（附帶錯誤物件）
try {
    this.performRiskyOperation();
} catch (error) {
    this.logError('關鍵操作失敗', error);
}

// 警告日誌
this.logWarning('資源即將耗盡');

// 成功日誌
this.logSuccess('初始化完成');
```

### 狀態管理類 API

#### `getStatus()`
取得標準化的管理器狀態，符合main.js期望格式。

**返回物件結構：**
```javascript
{
    // main.js 標準屬性
    initialized: boolean,
    isActive: boolean,
    configLoaded: boolean,
    
    // BaseManager 基礎屬性
    managerType: string,
    version: string,
    lastUpdated: number,
    createdAt: number,
    uptime: number,
    hasGameState: boolean,
    hasEventBus: boolean,
    eventNamingStrategy: string,
    
    // 子類別擴展屬性（透過getExtendedStatus()）
    ...customProperties
}
```

**使用範例：**
```javascript
// 檢查管理器狀態
const status = this.getStatus();
console.log('初始化狀態:', status.initialized);
console.log('運行時間:', status.uptime);

// main.js 中的統一狀態檢查
const allManagers = [resourceManager, tenantManager, tradeManager];
const allInitialized = allManagers.every(m => m.getStatus().initialized);
```

#### `markInitialized(configLoaded)`, `activate()`, `deactivate()`
管理器生命週期控制方法。

**使用範例：**
```javascript
// 標記初始化完成
this.markInitialized(true);  // 配置載入成功
this.markInitialized(false); // 配置載入失敗但可運行

// 動態啟用/停用
this.activate();    // 啟用管理器
this.deactivate();  // 停用管理器

// 狀態檢查
if (this.isInitialized() && this.isConfigLoaded()) {
    this.performFullOperation();
}
```

### 前綴策略配置類 API

#### `resolveEventName(eventName)`
手動解析事件名稱，用於除錯或外部調用。

**使用範例：**
```javascript
// 手動解析事件名稱
const resolved = this.resolveEventName('threshold_warning');
console.log(resolved); // 'resource_threshold_warning'

// 檢查系統級事件
const systemEvent = this.resolveEventName('system_ready');
console.log(systemEvent); // 'system_ready'（保持原名）
```

#### `updateEventNamingRules(newRules)`
動態更新事件命名規則（高級用法）。

**使用範例：**
```javascript
// 添加新的業務領域前綴
this.updateEventNamingRules({
    BUSINESS_PREFIXES: [
        ...this.getEventNamingRules().BUSINESS_PREFIXES,
        'trade_', 'skill_'
    ]
});

// 添加新的模組前綴
this.updateEventNamingRules({
    MODULE_PREFIXES: [
        ...this.getEventNamingRules().MODULE_PREFIXES,
        'ui_', 'audio_'
    ]
});
```

---

## 🔗 典型使用場景與範例

### 場景1：建立新的業務管理器

```javascript
// SkillManager 繼承BaseManager範例
import BaseManager from '../utils/BaseManager.js';

class SkillManager extends BaseManager {
    constructor(gameState, eventBus, dataManager) {
        super(gameState, eventBus, 'SkillManager');
        this.dataManager = dataManager;
        this.skills = new Map();
        this.cooldowns = new Map();
    }
    
    // 必須實作：模組前綴
    getModulePrefix() {
        return 'skill';
    }
    
    // 必須實作：事件監聽器設置
    setupEventListeners() {
        // 監聽租客雇用事件（自動解析為tenant_tenantHired）
        this.onEvent('tenantHired', (eventObj) => {
            this.initializeTenantSkills(eventObj.data.tenant);
        });
        
        // 監聽系統事件（保持原名）
        this.onEvent('day_advanced', (eventObj) => {
            this.processDailyCooldowns();
        });
        
        // 監聽跨模組業務事件（保持原名）
        this.onEvent('harvest_completed', (eventObj) => {
            this.checkFarmerBonusSkill(eventObj.data);
        });
    }
    
    // 子類別專屬狀態
    getExtendedStatus() {
        return {
            totalSkills: this.skills.size,
            activeCooldowns: this.cooldowns.size,
            lastSkillUsed: this.lastSkillUsed
        };
    }
    
    // 技能執行（業務邏輯）
    executeSkill(skillId, tenantType) {
        try {
            // 執行前驗證
            if (!this.validateSkillExecution(skillId, tenantType)) {
                this.logWarning(`技能執行條件不符：${skillId}`);
                return false;
            }
            
            // 執行技能邏輯
            const result = this.performSkillExecution(skillId, tenantType);
            
            // 發送技能執行事件（自動解析為skill_executed）
            this.emitEvent('executed', {
                skillId: skillId,
                tenantType: tenantType,
                result: result
            });
            
            this.logSuccess(`技能 ${skillId} 執行成功`);
            return true;
            
        } catch (error) {
            this.logError(`技能執行失敗：${skillId}`, error);
            return false;
        }
    }
    
    // 標準初始化流程
    async initialize() {
        try {
            // 載入技能配置
            const skillsData = this.dataManager.getSkillsData();
            this.loadSkillConfigurations(skillsData);
            
            // 設置事件監聽
            this.setupEventListeners();
            
            // 標記完成
            this.markInitialized(true);
            
        } catch (error) {
            this.logError('SkillManager初始化失敗', error);
            this.markInitialized(false);
        }
    }
}
```

### 場景2：跨模組事件通信

```javascript
// ResourceManager 與 TenantManager 協作範例
class ResourceManager extends BaseManager {
    setupEventListeners() {
        // 監聽租客雇用事件，更新資源分配
        this.onEvent('tenantHired', (eventObj) => {
            const tenant = eventObj.data.tenant;
            this.allocatePersonalResources(tenant);
            
            // 發送資源分配完成事件
            this.emitEvent('personal_resources_allocated', {
                tenantName: tenant.name,
                allocatedResources: tenant.personalResources
            });
        });
        
        // 監聽租客驅逐事件，回收資源
        this.onEvent('tenantEvicted', (eventObj) => {
            const tenant = eventObj.data.tenant;
            this.reclaimPersonalResources(tenant);
        });
        
        // 監聽跨模組業務事件：院子採集
        this.onEvent('harvest_completed', (eventObj) => {
            const { baseAmount, farmerBonus } = eventObj.data;
            this.modifyResource('food', baseAmount + farmerBonus, '院子採集');
        });
    }
    
    // 資源修改時通知其他模組
    modifyResource(resourceType, amount, reason) {
        const success = this.performResourceModification(resourceType, amount);
        
        if (success) {
            // 發送模組專屬事件（自動解析為resource_modified）
            this.emitEvent('modified', {
                resourceType: resourceType,
                amount: amount,
                reason: reason,
                newValue: this.getCurrentValue(resourceType)
            });
            
            // 檢查閾值並發送警告事件
            this.checkResourceThresholds(resourceType);
        }
        
        return success;
    }
}

class TenantManager extends BaseManager {
    setupEventListeners() {
        // 監聽資源分配完成事件
        this.onEvent('personal_resources_allocated', (eventObj) => {
            this.updateTenantDisplay(eventObj.data.tenantName);
        });
        
        // 監聽資源警告事件（來自ResourceManager）
        this.onEvent('threshold_warning', (eventObj) => {
            const { resourceType, level } = eventObj.data;
            this.notifyRelevantTenants(resourceType, level);
        });
    }
    
    // 雇用租客時觸發多個事件
    hireTenant(tenant, room) {
        const success = this.performTenantHiring(tenant, room);
        
        if (success) {
            // 發送模組專屬事件（自動解析為tenant_tenantHired）
            this.emitEvent('tenantHired', {
                tenant: tenant,
                room: room,
                timestamp: Date.now()
            });
            
            // 發送跨模組業務事件（保持原名）
            this.emitEvent('scavenge_capacity_changed', {
                newCapacity: this.getScavengeCapacity(),
                addedTenant: tenant
            });
            
            this.logSuccess(`租客 ${tenant.name} 入住成功`);
        }
        
        return success;
    }
}
```

### 場景3：main.js統一管理器整合

```javascript
// main.js 中的標準化管理器整合
class GameApplication {
    async _initializeBusinessModules() {
        try {
            console.log('🔧 正在初始化業務模組...');
            
            // 所有管理器都遵循相同的BaseManager模式
            this.resourceManager = new ResourceManager(this.gameState, this.eventBus);
            await this.resourceManager.initialize();
            
            this.tradeManager = new TradeManager(
                this.gameState, 
                this.resourceManager, 
                this.dataManager, 
                this.eventBus
            );
            await this.tradeManager.initialize();
            
            this.tenantManager = new TenantManager(
                this.gameState,
                this.resourceManager,
                this.tradeManager,
                this.dataManager,
                this.eventBus
            );
            await this.tenantManager.initialize();
            
            this.skillManager = new SkillManager(
                this.gameState,
                this.eventBus,
                this.dataManager
            );
            await this.skillManager.initialize();
            
            // 統一狀態檢查（BaseManager標準介面）
            const managers = [
                this.resourceManager,
                this.tradeManager,
                this.tenantManager,
                this.skillManager
            ];
            
            const allInitialized = managers.every(m => m.getStatus().initialized);
            const allActive = managers.every(m => m.getStatus().isActive);
            
            if (allInitialized && allActive) {
                console.log('✅ 所有業務模組初始化完成');
                this.setupCrossModuleEventListeners();
            } else {
                this.handlePartialInitializationFailure(managers);
            }
            
        } catch (error) {
            console.error('❌ 業務模組初始化失敗:', error);
            throw error;
        }
    }
    
    // 統一的事件監聽設置
    setupCrossModuleEventListeners() {
        // 監聽所有管理器的初始化事件
        const eventPatterns = [
            'resource_initialized',
            'trade_initialized', 
            'tenant_initialized',
            'skill_initialized'
        ];
        
        eventPatterns.forEach(eventName => {
            this.eventBus.on(eventName, (eventObj) => {
                console.log(`📡 ${eventObj.data.managerType} 初始化完成`);
                this.updateSystemStatusUI();
            });
        });
        
        // 監聽錯誤事件
        this.eventBus.on('*_error', (eventObj) => {
            this.handleManagerError(eventObj);
        });
    }
    
    // 統一的狀態檢查介面
    getSystemStatus() {
        const managers = [
            'resourceManager',
            'tradeManager', 
            'tenantManager',
            'skillManager'
        ];
        
        return managers.reduce((status, managerName) => {
            const manager = this[managerName];
            if (manager && typeof manager.getStatus === 'function') {
                status[managerName] = manager.getStatus();
            }
            return status;
        }, {});
    }
}
```

### 場景4：除錯與監控

```javascript
// 除錯工具整合範例
class GameApplication {
    // 統一的系統除錯介面
    debug() {
        console.group('🔧 BaseManager 系統除錯資訊');
        
        const managers = [
            this.resourceManager,
            this.tenantManager,
            this.tradeManager,
            this.skillManager
        ];
        
        managers.forEach(manager => {
            if (manager) {
                console.group(`📊 ${manager.managerType}`);
                console.log('狀態:', manager.getStatus());
                console.log('資訊:', manager.getInfo());
                
                // 顯示事件前綴解析示例
                manager.debugEventNaming();
                
                console.groupEnd();
            }
        });
        
        console.groupEnd();
    }
    
    // 事件監控
    setupEventMonitoring() {
        // 監控所有事件（除錯模式）
        if (this.isDebugMode()) {
            this.eventBus.on('*', (eventObj, eventData) => {
                const eventName = eventData.type;
                const source = eventObj.data?.source || 'unknown';
                
                console.debug(`🔔 事件監控: ${eventName}`, {
                    source: source,
                    data: eventObj.data,
                    timestamp: new Date().toISOString()
                });
            });
        }
    }
}
```

---

## 🛠️ 錯誤處理與除錯指南

### 常見錯誤處理模式

```javascript
// 安全的BaseManager操作模式
function safeManagerOperation(manager, operation) {
    try {
        // 檢查管理器狀態
        const status = manager.getStatus();
        if (!status.initialized) {
            console.warn(`${manager.managerType} 未初始化`);
            return { success: false, error: 'Manager not initialized' };
        }
        
        if (!status.isActive) {
            console.warn(`${manager.managerType} 未啟用`);
            return { success: false, error: 'Manager not active' };
        }
        
        // 執行操作
        const result = operation();
        
        return { success: true, result };
    } catch (error) {
        manager.logError('操作執行失敗', error);
        return { success: false, error: error.message };
    }
}

// 使用範例
const result = safeManagerOperation(resourceManager, () => {
    return resourceManager.modifyResource('food', 10, '測試操作');
});

if (!result.success) {
    console.error('操作失敗:', result.error);
}
```

### 除錯工具使用

```javascript
// 1. 檢查管理器基本狀態
console.log('管理器狀態:', manager.getStatus());
console.log('管理器資訊:', manager.getInfo());

// 2. 檢查事件前綴解析
manager.debugEventNaming();

// 3. 手動測試事件發送
manager.emitEvent('test_event', { test: true });

// 4. 檢查事件命名規則
const rules = manager.getEventNamingRules();
console.log('事件命名規則:', rules);

// 5. 測試前綴解析
const testEvents = ['system_ready', 'harvest_completed', 'custom_event'];
testEvents.forEach(event => {
    const resolved = manager.resolveEventName(event);
    console.log(`${event} → ${resolved}`);
});

// 6. 檢查EventBus狀態
if (manager.eventBus) {
    console.log('EventBus統計:', manager.eventBus.getStats());
}
```

### 常見問題診斷

#### 問題1：管理器初始化失敗
**可能原因：**
- GameState依賴缺失
- EventBus依賴缺失  
- 子類別未實作必要方法
- 配置載入失敗

**診斷方法：**
```javascript
// 檢查依賴
console.log('GameState可用:', !!manager.gameState);
console.log('EventBus可用:', !!manager.eventBus);

// 檢查必要方法實作
try {
    const prefix = manager.getModulePrefix();
    console.log('模組前綴:', prefix);
} catch (error) {
    console.error('getModulePrefix未實作:', error);
}

// 檢查初始化狀態
const status = manager.getStatus();
console.log('初始化狀態:', status.initialized);
console.log('配置載入狀態:', status.configLoaded);
```

#### 問題2：事件沒有正確觸發或接收
**診斷步驟：**
```javascript
// 1. 檢查事件名稱解析
const originalEvent = 'threshold_warning';
const resolvedEvent = manager.resolveEventName(originalEvent);
console.log(`事件解析: ${originalEvent} → ${resolvedEvent}`);

// 2. 檢查EventBus狀態
console.log('EventBus統計:', manager.eventBus.getStats());
const listeners = manager.eventBus.getListenedEvents();
console.log('監聽中的事件:', listeners);

// 3. 手動測試事件
manager.emitEvent('test_event', { test: true });

// 4. 檢查事件分類
const category = manager._getEventCategory(resolvedEvent);
const crossModule = manager._isCrossModuleEvent(resolvedEvent);
console.log(`事件分類: ${category}, 跨模組: ${crossModule}`);
```

#### 問題3：日誌記錄沒有顯示
**檢查步驟：**
```javascript
// 1. 檢查GameState日誌功能
if (manager.gameState && typeof manager.gameState.addLog === 'function') {
    console.log('GameState日誌功能可用');
} else {
    console.warn('GameState日誌功能不可用');
}

// 2. 強制控制台輸出測試
manager.addLog('測試日誌', 'event', { forceConsole: true });

// 3. 檢查日誌事件發送
manager.onEvent('log_added', (eventObj) => {
    console.log('接收到日誌事件:', eventObj.data);
});

manager.addLog('測試日誌事件', 'event');
```

#### 問題4：前綴解析不正確
**診斷方法：**
```javascript
// 1. 檢查命名規則配置
const rules = manager.getEventNamingRules();
console.log('命名規則:', rules);

// 2. 測試各種事件類型
const testCases = [
    'system_ready',      // 應保持原名
    'harvest_completed', // 應保持原名
    'resource_modified', // 應保持原名（已有前綴）
    'custom_event'       // 應添加模組前綴
];

testCases.forEach(event => {
    const resolved = manager.resolveEventName(event);
    const category = manager._getEventCategory(resolved);
    console.log(`${event} → ${resolved} [${category}]`);
});

// 3. 檢查模組前綴
try {
    const prefix = manager.getModulePrefix();
    console.log('模組前綴:', prefix);
} catch (error) {
    console.error('模組前綴取得失敗:', error);
}
```

---

## ⚡ 效能最佳化建議

### 1. 事件處理最佳化

```javascript
// ❌ 避免：頻繁的事件發送
for (let i = 0; i < 100; i++) {
    this.emitEvent('frequent_event', { index: i });
}

// ✅ 推薦：批量處理或節流
const batchData = [];
for (let i = 0; i < 100; i++) {
    batchData.push({ index: i });
}
this.emitEvent('batch_event', { items: batchData });
```

### 2. 狀態檢查最佳化

```javascript
// ❌ 避免：重複狀態檢查
const status1 = manager.getStatus();
const status2 = manager.getStatus();
const status3 = manager.getStatus();

// ✅ 推薦：緩存狀態結果
const status = manager.getStatus();
const isReady = status.initialized && status.isActive;
if (isReady) {
    // 執行操作
}
```

### 3. 事件監聽器最佳化

```javascript
// ✅ 使用一次性監聽器（適用於單次處理）
this.onEvent('initialization_completed', this.handleInit, { once: true });

// ✅ 清理不需要的監聽器（如果BaseManager支援）
const unsubscribe = this.onEvent('some_event', handler);
// 在不需要時調用
if (typeof unsubscribe === 'function') {
    unsubscribe();
}
```

### 4. 記憶體使用最佳化

```javascript
// ✅ 定期清理（如果子類別需要）
cleanup() {
    // 清理子類別特定資源
    this.customCache.clear();
    this.tempData = null;
    
    // 調用父類別清理
    super.cleanup();
}

// ✅ 避免循環引用
constructor(gameState, eventBus) {
    super(gameState, eventBus, 'MyManager');
    
    // 避免在事件回調中引用this，導致記憶體洩漏
    const weakThis = new WeakRef(this);
    this.onEvent('some_event', (eventObj) => {
        const self = weakThis.deref();
        if (self) {
            self.handleEvent(eventObj);
        }
    });
}
```

### 5. 除錯模式效能優化

```javascript
// ✅ 只在除錯模式下執行昂貴操作
performExpensiveOperation() {
    const result = this.executeCore();
    
    // 只在除錯模式下記錄詳細資訊
    if (this._isDebugMode()) {
        this.debugEventNaming();
        console.log('詳細執行資訊:', this.getDetailedInfo());
    }
    
    return result;
}
```

---

## 🔧 常見問題與解決方案

### Q1: BaseManager初始化後，子類別方法無法執行
**症狀：** markInitialized()調用成功，但業務方法執行失敗  
**解決方案：**
```javascript
// 確保子類別正確覆寫getExtendedStatus
getExtendedStatus() {
    return {
        // 子類別特定狀態
        businessLogicReady: this.isBusinessLogicInitialized(),
        configurationValid: this.validateConfiguration()
    };
}

// 檢查完整初始化狀態
isFullyReady() {
    const status = this.getStatus();
    return status.initialized && 
           status.isActive && 
           status.businessLogicReady;
}
```

### Q2: 事件前綴解析不符預期
**症狀：** 事件名稱解析結果與預期不符  
**診斷：**
```javascript
// 檢查模組前綴實作
console.log('模組前綴:', this.getModulePrefix());

// 檢查命名規則
console.log('命名規則:', this.getEventNamingRules());

// 測試解析邏輯
this.debugEventNaming();

// 手動調試特定事件
const testEvent = 'problematic_event';
const resolved = this.resolveEventName(testEvent);
console.log(`解析結果: ${testEvent} → ${resolved}`);
```

### Q3: 跨模組事件通信失敗
**症狀：** 模組A發送的事件模組B收不到  
**解決方案：**
```javascript
// 確保使用正確的事件名稱
// 發送方（模組A）
this.emitEvent('harvest_completed', data); // 業務領域事件，保持原名

// 接收方（模組B）  
this.onEvent('harvest_completed', callback); // 同樣保持原名

// 檢查EventBus狀態
console.log('EventBus監聽器:', eventBus.getListenedEvents());

// 確認事件確實發送
this.emitEvent('test_cross_module', { test: true });
```

### Q4: 日誌記錄重複或缺失
**症狀：** 同一條日誌出現多次或完全不顯示  
**解決方案：**
```javascript
// 避免重複日誌
this.addLog('重要訊息', 'event', { 
    skipEvent: true // 避免觸發log_added事件
});

// 檢查日誌配置
if (!this.gameState || typeof this.gameState.addLog !== 'function') {
    console.warn('GameState日誌功能不可用');
    // 使用後備方案
    this.addLog('訊息', 'event', { forceConsole: true });
}
```

### Q5: 管理器狀態不一致
**症狀：** getStatus()返回的狀態與實際狀態不符  
**診斷：**
```javascript
// 檢查狀態更新
console.log('基礎狀態:', this._getBaseStatus());
console.log('擴展狀態:', this.getExtendedStatus());
console.log('合併狀態:', this.getStatus());

// 確保正確更新狀態
updateBusinessState() {
    // 更新業務狀態後，刷新最後更新時間
    this._updateLastActivity();
}

// 檢查狀態一致性
validateStateConsistency() {
    const status = this.getStatus();
    console.log('狀態一致性檢查:', {
        initialized: status.initialized,
        isActive: status.isActive,
        configLoaded: status.configLoaded,
        hasRequiredDependencies: status.hasGameState && status.hasEventBus
    });
}
```

### Q6: 效能問題：事件處理延遲
**症狀：** 事件處理響應緩慢  
**解決方案：**
```javascript
// 優化事件處理器
setupEventListeners() {
    // 使用防抖處理高頻事件
    this.onEvent('frequent_event', this.debounce((eventObj) => {
        this.handleFrequentEvent(eventObj);
    }, 100));
    
    // 使用節流處理連續事件
    this.onEvent('continuous_event', this.throttle((eventObj) => {
        this.handleContinuousEvent(eventObj);
    }, 200));
}

// 實作防抖和節流
debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
```

---

## 📖 參考附錄

### 必須實作的抽象方法
```javascript
// 子類別必須實作
getModulePrefix(): string           // 返回模組事件前綴
setupEventListeners(): void        // 設置事件監聽器
getExtendedStatus(): Object        // 擴展狀態資訊（可選）
```

### 事件命名規則參考
```javascript
// 系統級前綴（保持原名）
const SYSTEM_PREFIXES = ['system_', 'game_', 'day_'];

// 業務領域前綴（保持原名）  
const BUSINESS_PREFIXES = ['harvest_', 'scavenge_'];

// 模組專屬前綴（自動添加）
const MODULE_PREFIXES = ['resource_', 'tenant_', 'trade_', 'skill_'];
```

### 標準狀態屬性
```javascript
// main.js期望的標準屬性
{
    initialized: boolean,    // 是否已初始化
    isActive: boolean,      // 是否啟用
    configLoaded: boolean   // 配置是否載入
}
```

### BaseManager觸發的標準事件
```javascript
// 生命週期事件
'{module}_initialized'     // 初始化完成
'{module}_activated'       // 啟用
'{module}_deactivated'     // 停用  
'{module}_cleanup_completed' // 清理完成

// 日誌事件
'{module}_log_added'       // 日誌新增
```

### 整合檢查清單
- [ ] 子類別正確繼承BaseManager
- [ ] 實作必要的抽象方法
- [ ] 事件監聽器已設置  
- [ ] 初始化流程已實作
- [ ] 狀態管理已整合
- [ ] 錯誤處理已實作
- [ ] 除錯工具已配置

---

**開發指南版本：** v2.0  
**對應BaseManager版本：** v2.0 (混合分層前綴策略版)  
**維護者：** 末日房東模擬器開發團隊
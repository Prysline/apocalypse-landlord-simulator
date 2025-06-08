# EventBus v2.0 開發指南

## 📋 文檔概覽

本指南提供EventBus v2.0的完整開發參考，包含API調用、整合範例、除錯指導和最佳實踐。適用於末日房東模擬器的單人開發場景。

**版本**：EventBus v2.0 (事件通信核心版)  
**更新日期**：2025年  
**相容性**：純ES6實作，無外部依賴  
**核心功能**：模組間事件驅動通信、事件過濾、統計追蹤

---

## 🚀 快速開始

### 基本初始化

```javascript
// 1. 引入EventBus
import EventBus from './core/EventBus.js';

// 2. 建立實例（通常在 main.js 中）
const eventBus = new EventBus();

// 3. 檢查初始化狀態
console.log('EventBus 狀態:', eventBus.isActive);
```

### 基本事件操作

```javascript
// 監聽事件
const unsubscribe = eventBus.on('resource_modified', (eventObj) => {
    console.log('資源已修改:', eventObj.data);
});

// 發送事件
const result = eventBus.emit('resource_modified', {
    resourceType: 'food',
    amount: 10,
    reason: '院子採集'
});

if (result.success) {
    console.log('事件發送成功');
}

// 取消監聽
unsubscribe();

// 一次性監聽
eventBus.once('game_over', (eventObj) => {
    console.log('遊戲結束:', eventObj.data);
});
```

---

## 📚 核心API完整參考

### 事件監聽類 API

#### `on(eventType, listener, options)`
註冊事件監聽器，EventBus的核心方法。

**參數：**
- `eventType` (string): 事件類型名稱
- `listener` (EventListener): 監聽器函數
- `options` (ListenerOptions, 可選): 監聽器配置選項

**返回值：** `UnsubscribeFunction|null` - 取消監聽的函數，失敗時返回null

**使用範例：**
```javascript
// 基本監聽
const unsubscribe = eventBus.on('day_advanced', (eventObj) => {
    console.log('新的一天:', eventObj.data.day);
});

// 帶優先級的監聽
eventBus.on('resource_critical', handler, { priority: 10 });

// 帶過濾器的監聽
eventBus.on('tenant_action', handler, {
    filter: (eventObj) => eventObj.data.tenantType === 'doctor'
});

// 節流監聽
eventBus.on('ui_update', handler, { throttle: 100 });
```

#### `once(eventType, listener, options)`
註冊一次性事件監聽器，觸發後自動移除。

**參數：**
- `eventType` (string): 事件類型名稱
- `listener` (EventListener): 監聽器函數
- `options` (ListenerOptions, 可選): 監聽器配置選項

**返回值：** `UnsubscribeFunction|null` - 取消監聽的函數

**使用範例：**
```javascript
// 等待系統初始化完成
eventBus.once('system_ready', (eventObj) => {
    console.log('系統就緒:', eventObj.data);
    startGame();
});

// 等待特定租客入住
eventBus.once('tenant_hired', (eventObj) => {
    if (eventObj.data.tenant.type === 'doctor') {
        console.log('醫生已入住');
    }
});
```

#### `off(eventType, listener)`
移除事件監聽器。

**參數：**
- `eventType` (string): 事件類型名稱
- `listener` (EventListener, 可選): 要移除的監聽器，不提供則移除所有

**返回值：** `boolean` - 移除是否成功

**使用範例：**
```javascript
// 移除特定監聽器
const success = eventBus.off('resource_modified', myHandler);

// 移除所有監聽器
eventBus.off('resource_modified');
```

### 事件發送類 API

#### `emit(eventType, data, options)`
發送同步事件，立即執行所有監聽器。

**參數：**
- `eventType` (string): 事件類型名稱
- `data` (any, 可選): 事件資料
- `options` (EmitOptions, 可選): 發送選項

**返回值：** `EmitResult` - 發送結果

**使用範例：**
```javascript
// 基本事件發送
const result = eventBus.emit('resource_modified', {
    resourceType: 'food',
    oldValue: 10,
    newValue: 15,
    changeAmount: 5
});

// 帶元資料的事件
eventBus.emit('tenant_action', tenantData, {
    metadata: { priority: 'high', source: 'ui' }
});

// 檢查發送結果
if (result.success) {
    console.log(`事件發送成功，觸發了 ${result.listenerCount} 個監聽器`);
} else {
    console.error('事件發送失敗:', result.error);
}
```

#### `emitAsync(eventType, data, options)`
發送非同步事件，等待所有監聽器完成。

**參數：**
- `eventType` (string): 事件類型名稱
- `data` (any, 可選): 事件資料
- `options` (EmitOptions, 可選): 發送選項

**返回值：** `Promise<EmitResult>` - 發送結果的Promise

**使用範例：**
```javascript
// 非同步事件發送
const result = await eventBus.emitAsync('system_save', saveData);

// 處理非同步結果
if (result.success) {
    console.log('存檔事件完成');
    result.results.forEach((listenerResult, index) => {
        if (!listenerResult.success) {
            console.error(`監聽器 ${index} 執行失敗:`, listenerResult.error);
        }
    });
}

// 批量非同步處理
await eventBus.emitAsync('tenant_batch_update', tenantList);
```

### 事件查詢類 API

#### `hasListeners(eventType)`
檢查指定事件類型是否有監聽器。

**返回值：** `boolean` - 是否存在監聽器

**使用範例：**
```javascript
if (eventBus.hasListeners('resource_critical')) {
    console.log('資源危急事件有監聽器');
}

// 動態檢查
const eventTypes = ['day_advanced', 'rent_collected', 'game_over'];
eventTypes.forEach(type => {
    if (eventBus.hasListeners(type)) {
        console.log(`${type} 事件已註冊監聽器`);
    }
});
```

#### `getListenerCount(eventType)`
取得指定事件類型的監聽器數量。

**返回值：** `number` - 監聽器數量

**使用範例：**
```javascript
const count = eventBus.getListenerCount('resource_modified');
console.log(`資源修改事件有 ${count} 個監聽器`);

// 統計所有事件監聽器
const stats = eventBus.getEventStats();
Object.entries(stats).forEach(([eventType, stat]) => {
    console.log(`${eventType}: ${stat.listeners} 個監聽器`);
});
```

### 系統管理類 API

#### `getEventStats(eventType)`
取得事件統計資料。

**參數：**
- `eventType` (string, 可選): 指定事件類型，不提供則返回所有統計

**返回值：** `EventStats|Object` - 統計資料

**使用範例：**
```javascript
// 取得特定事件統計
const resourceStats = eventBus.getEventStats('resource_modified');
console.log('資源修改事件統計:', resourceStats);

// 取得全部統計
const allStats = eventBus.getEventStats();
console.log('事件系統統計:', allStats);
```

#### `getSystemStats()`
取得系統整體統計資料。

**返回值：** `SystemStats` - 系統統計

**使用範例：**
```javascript
const systemStats = eventBus.getSystemStats();
console.log('事件系統狀態:', {
    總事件類型: systemStats.totalEventTypes,
    總監聽器數: systemStats.totalListeners,
    歷史記錄數: systemStats.eventHistory,
    系統狀態: systemStats.isActive ? '運行中' : '已停用'
});
```

#### `getEventHistory(limit)`
取得事件歷史記錄。

**參數：**
- `limit` (number, 可選): 回傳記錄數限制，預設100

**返回值：** `EventRecord[]` - 事件記錄陣列

**使用範例：**
```javascript
// 取得最近10個事件
const recentEvents = eventBus.getEventHistory(10);
recentEvents.forEach(record => {
    console.log(`${record.timestamp}: ${record.eventType}`);
});

// 分析事件頻率
const allHistory = eventBus.getEventHistory();
const eventFreq = {};
allHistory.forEach(record => {
    eventFreq[record.eventType] = (eventFreq[record.eventType] || 0) + 1;
});
console.log('事件頻率統計:', eventFreq);
```

---

## 🎯 典型使用場景

### 場景1：資源狀態監控

```javascript
// 設置資源監控系統
class ResourceMonitor {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.setupMonitoring();
    }
    
    setupMonitoring() {
        // 監控資源修改
        this.eventBus.on('resource_modified', (eventObj) => {
            this.checkResourceLevels(eventObj.data);
        });
        
        // 監控資源警告
        this.eventBus.on('resource_threshold_warning', (eventObj) => {
            this.handleResourceWarning(eventObj.data);
        });
        
        // 監控資源危急狀況
        this.eventBus.on('resource_critical_low', (eventObj) => {
            this.handleCriticalResource(eventObj.data);
        });
    }
    
    checkResourceLevels(resourceData) {
        if (resourceData.newValue < 5) {
            this.eventBus.emit('resource_low_warning', {
                resourceType: resourceData.resourceType,
                currentValue: resourceData.newValue,
                severity: 'warning'
            });
        }
    }
}
```

### 場景2：模組間協調通信

```javascript
// 租客與資源系統協調
class TenantResourceCoordinator {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.setupCoordination();
    }
    
    setupCoordination() {
        // 租客雇用時檢查資源
        this.eventBus.on('tenant_hired', (eventObj) => {
            const tenant = eventObj.data.tenant;
            this.eventBus.emit('resource_consumption_increased', {
                tenantType: tenant.type,
                estimatedDailyConsumption: this.calculateConsumption(tenant)
            });
        });
        
        // 租客離開時更新資源預測
        this.eventBus.on('tenant_evicted', (eventObj) => {
            this.eventBus.emit('resource_consumption_decreased', {
                freedResources: eventObj.data.freedResources
            });
        });
    }
}
```

### 場景3：遊戲狀態同步

```javascript
// UI與遊戲狀態同步
class GameStateUISync {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.setupSync();
    }
    
    setupSync() {
        // 日期推進更新
        this.eventBus.on('day_advanced', (eventObj) => {
            this.updateDayDisplay(eventObj.data.day);
            this.updateTimeDisplay(eventObj.data.time);
        });
        
        // 租金收取結果
        this.eventBus.on('rent_collected', (eventObj) => {
            this.showRentCollectionResult(eventObj.data);
        });
        
        // 批量狀態更新（節流處理）
        this.eventBus.on('ui_batch_update', (eventObj) => {
            this.batchUpdateUI(eventObj.data);
        }, { throttle: 50 }); // 50ms節流
    }
}
```

---

## ⚠️ 錯誤處理與除錯

### 常見錯誤類型

#### 1. 監聽器註冊錯誤
```javascript
// ❌ 錯誤：事件類型為空
try {
    eventBus.on('', handler);
} catch (error) {
    console.error('監聽器註冊失敗:', error.message);
}

// ✅ 正確：檢查事件類型
const eventType = 'resource_modified';
if (eventType && typeof eventType === 'string') {
    eventBus.on(eventType, handler);
}

// ❌ 錯誤：監聽器不是函數
try {
    eventBus.on('resource_modified', 'not_a_function');
} catch (error) {
    console.error('監聽器必須是函數:', error.message);
}
```

#### 2. 事件發送錯誤
```javascript
// 事件發送失敗處理
const result = eventBus.emit('invalid_event', data);
if (!result.success) {
    console.error('事件發送失敗:', result.error);
    
    // 檢查是否有監聽器
    if (!eventBus.hasListeners('invalid_event')) {
        console.warn('沒有監聽器註冊此事件');
    }
}

// 監聽器執行錯誤處理
const result = eventBus.emit('complex_event', data);
if (result.success && result.results) {
    result.results.forEach((listenerResult, index) => {
        if (!listenerResult.success) {
            console.error(`監聽器 ${index} 執行失敗:`, listenerResult.error);
        }
    });
}
```

### 除錯工具和技巧

#### 事件流追蹤
```javascript
// 啟用詳細事件記錄
function enableEventDebugging(eventBus) {
    const originalEmit = eventBus.emit.bind(eventBus);
    
    eventBus.emit = function(eventType, data, options) {
        console.group(`📤 事件發送: ${eventType}`);
        console.log('資料:', data);
        console.log('選項:', options);
        
        const result = originalEmit(eventType, data, options);
        
        console.log('結果:', result);
        if (result.success) {
            console.log(`✅ 成功觸發 ${result.listenerCount} 個監聽器`);
        } else {
            console.error(`❌ 發送失敗: ${result.error}`);
        }
        console.groupEnd();
        
        return result;
    };
}
```

#### 監聽器追蹤
```javascript
// 監聽器執行追蹤
function trackEventExecution(eventBus, eventType) {
    eventBus.on(eventType, (eventObj) => {
        console.log(`🎯 事件觸發: ${eventType}`, {
            時間: eventObj.timestamp,
            事件ID: eventObj.id,
            資料大小: JSON.stringify(eventObj.data || {}).length
        });
    });
}

// 追蹤多個重要事件
['resource_modified', 'tenant_hired', 'day_advanced'].forEach(eventType => {
    trackEventExecution(eventBus, eventType);
});
```

#### 系統狀態診斷
```javascript
// 事件系統健康檢查
function diagnoseEventBus(eventBus) {
    const systemStats = eventBus.getSystemStats();
    const issues = [];
    
    console.group('🔍 EventBus 診斷報告');
    
    // 檢查系統狀態
    if (!systemStats.isActive) {
        issues.push('系統已停用');
    }
    
    // 檢查監聽器數量
    if (systemStats.totalListeners === 0) {
        issues.push('沒有註冊任何監聽器');
    }
    
    // 檢查事件分佈
    const stats = eventBus.getEventStats();
    Object.entries(stats).forEach(([eventType, stat]) => {
        if (stat.listeners === 0) {
            console.warn(`⚠️ 事件 ${eventType} 沒有監聽器`);
        }
        if (stat.errors > stat.emitted * 0.1) {
            issues.push(`事件 ${eventType} 錯誤率過高: ${stat.errors}/${stat.emitted}`);
        }
    });
    
    // 輸出診斷結果
    if (issues.length === 0) {
        console.log('✅ EventBus 運行正常');
    } else {
        console.warn('⚠️ 發現問題:', issues);
    }
    
    console.log('📊 統計資料:', systemStats);
    console.groupEnd();
    
    return { healthy: issues.length === 0, issues };
}
```

---

## 🔧 效能最佳化

### 監聽器管理最佳化

```javascript
// 使用事件過濾減少不必要的執行
eventBus.on('tenant_action', handler, {
    filter: (eventObj) => {
        // 只處理特定類型的租客行動
        return eventObj.data.actionType === 'scavenge' && 
               eventObj.data.tenant.type === 'soldier';
    }
});

// 使用節流控制高頻事件
eventBus.on('ui_resource_update', updateResourceDisplay, {
    throttle: 100 // 100ms內最多執行一次
});

// 優先級管理關鍵事件
eventBus.on('system_critical', emergencyHandler, { priority: 10 });
eventBus.on('system_critical', logHandler, { priority: 1 });
```

### 記憶體管理

```javascript
// 定期清理事件歷史
function setupEventHistoryCleanup(eventBus) {
    setInterval(() => {
        const history = eventBus.getEventHistory();
        if (history.length > 500) {
            console.log('清理事件歷史記錄');
            eventBus.clearEventHistory(200); // 保留最近200條
        }
    }, 60000); // 每分鐘檢查一次
}

// 自動取消無用監聽器
function autoCleanupListeners(eventBus) {
    const unusedEventTypes = [];
    const stats = eventBus.getEventStats();
    
    Object.entries(stats).forEach(([eventType, stat]) => {
        // 如果事件從未被發送且註冊時間超過5分鐘
        if (stat.emitted === 0 && 
            Date.now() - new Date(stat.lastEmitted || 0).getTime() > 300000) {
            unusedEventTypes.push(eventType);
        }
    });
    
    unusedEventTypes.forEach(eventType => {
        console.log(`清理未使用的事件監聽器: ${eventType}`);
        eventBus.off(eventType);
    });
}
```

### 批量事件處理

```javascript
// 批量事件發送器
class BatchEventEmitter {
    constructor(eventBus, batchSize = 10, flushInterval = 100) {
        this.eventBus = eventBus;
        this.batchSize = batchSize;
        this.flushInterval = flushInterval;
        this.eventQueue = [];
        this.flushTimer = null;
    }
    
    queueEvent(eventType, data, options) {
        this.eventQueue.push({ eventType, data, options });
        
        if (this.eventQueue.length >= this.batchSize) {
            this.flush();
        } else if (!this.flushTimer) {
            this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
        }
    }
    
    flush() {
        if (this.eventQueue.length === 0) return;
        
        // 批量發送事件
        this.eventBus.emit('batch_events', {
            events: this.eventQueue.splice(0),
            timestamp: Date.now()
        });
        
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
    }
}
```

---

## 🔧 常見問題與解決方案

### Q1: 事件沒有被觸發
**症狀：** 發送事件但監聽器沒有執行  
**診斷步驟：**
```javascript
// 1. 檢查事件名稱是否正確
const eventType = 'resource_modifed'; // 注意拼字錯誤
console.log('是否有監聽器:', eventBus.hasListeners(eventType));

// 2. 檢查監聽器是否正確註冊
const listenerCount = eventBus.getListenerCount('resource_modified');
console.log('監聽器數量:', listenerCount);

// 3. 檢查EventBus是否活躍
console.log('EventBus狀態:', eventBus.isActive);

// 4. 檢查事件發送結果
const result = eventBus.emit('resource_modified', data);
console.log('發送結果:', result);
```

### Q2: 監聽器執行錯誤
**症狀：** 監聽器執行時拋出錯誤  
**解決方案：**
```javascript
// 在監聽器中添加錯誤處理
eventBus.on('resource_modified', (eventObj) => {
    try {
        // 確保資料存在
        if (!eventObj.data) {
            console.warn('事件資料為空');
            return;
        }
        
        // 檢查必要屬性
        const { resourceType, newValue } = eventObj.data;
        if (!resourceType || newValue === undefined) {
            console.warn('事件資料不完整:', eventObj.data);
            return;
        }
        
        // 執行業務邏輯
        updateResourceDisplay(resourceType, newValue);
        
    } catch (error) {
        console.error('監聽器執行錯誤:', error);
        // 可選：發送錯誤事件
        eventBus.emit('listener_error', {
            eventType: eventObj.type,
            error: error.message,
            timestamp: Date.now()
        });
    }
});
```

### Q3: 記憶體洩漏問題
**症狀：** 長時間運行後記憶體持續增長  
**解決方案：**
```javascript
// 1. 確保取消不需要的監聽器
const unsubscribeList = [];

// 註冊時保存取消函數
const unsubscribe = eventBus.on('temp_event', handler);
unsubscribeList.push(unsubscribe);

// 適當時機清理
function cleanup() {
    unsubscribeList.forEach(unsub => unsub());
    unsubscribeList.length = 0;
}

// 2. 定期清理事件歷史
setInterval(() => {
    const history = eventBus.getEventHistory();
    if (history.length > 1000) {
        eventBus.clearEventHistory(100);
    }
}, 300000); // 每5分鐘清理一次

// 3. 移除模組時清理相關監聽器
class ModuleManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.moduleListeners = new Map();
    }
    
    registerModule(moduleName, setupFunction) {
        const listeners = [];
        const moduleEventBus = {
            on: (eventType, handler, options) => {
                const unsubscribe = this.eventBus.on(eventType, handler, options);
                listeners.push(unsubscribe);
                return unsubscribe;
            }
        };
        
        setupFunction(moduleEventBus);
        this.moduleListeners.set(moduleName, listeners);
    }
    
    unregisterModule(moduleName) {
        const listeners = this.moduleListeners.get(moduleName);
        if (listeners) {
            listeners.forEach(unsubscribe => unsubscribe());
            this.moduleListeners.delete(moduleName);
        }
    }
}
```

### Q4: 事件順序問題
**症狀：** 事件執行順序不符合預期  
**解決方案：**
```javascript
// 使用優先級控制執行順序
eventBus.on('game_state_changed', firstHandler, { priority: 10 });
eventBus.on('game_state_changed', secondHandler, { priority: 5 });
eventBus.on('game_state_changed', thirdHandler, { priority: 1 });

// 或使用鏈式事件確保順序
eventBus.on('resource_validated', (eventObj) => {
    // 第一步：驗證完成
    console.log('資源驗證完成');
    
    // 第二步：觸發更新事件
    eventBus.emit('resource_update_ready', eventObj.data);
});

eventBus.on('resource_update_ready', (eventObj) => {
    // 第三步：執行更新
    console.log('開始更新資源');
    updateResource(eventObj.data);
    
    // 第四步：觸發完成事件
    eventBus.emit('resource_update_completed', eventObj.data);
});
```

### Q5: 非同步事件超時
**症狀：** emitAsync永遠不返回或超時  
**診斷和解決：**
```javascript
// 添加超時控制
async function safeEmitAsync(eventBus, eventType, data, timeout = 5000) {
    try {
        const result = await Promise.race([
            eventBus.emitAsync(eventType, data),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('事件處理超時')), timeout)
            )
        ]);
        return result;
    } catch (error) {
        console.error('非同步事件處理失敗:', error);
        return { success: false, error: error.message };
    }
}

// 檢查監聽器是否包含非同步操作
eventBus.on('test_async', async (eventObj) => {
    try {
        // 確保非同步操作有超時控制
        const result = await Promise.race([
            someAsyncOperation(eventObj.data),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('操作超時')), 3000)
            )
        ]);
        console.log('非同步操作完成:', result);
    } catch (error) {
        console.error('非同步操作失敗:', error);
        throw error; // 重新拋出讓EventBus記錄錯誤
    }
});
```

---

## 📖 參考附錄

### EventListener函數簽名
```typescript
type EventListener = (eventObj: EventObject) => any | Promise<any>;
```

### EventObject結構
```javascript
{
    type: string,           // 事件類型
    data: any,             // 事件資料
    timestamp: string,      // ISO時間戳記
    id: string,            // 唯一識別碼
    options?: Object       // 附加選項
}
```

### ListenerOptions配置
```javascript
{
    priority?: number,              // 優先級 (預設: 0)
    filter?: (EventObject) => boolean, // 過濾器函數
    throttle?: number,              // 節流間隔毫秒
    once?: boolean                  // 是否一次性 (預設: false)
}
```

### 核心事件類型參考
```javascript
// 系統級事件
'system_ready'           // 系統初始化完成
'system_error'           // 系統錯誤
'day_advanced'           // 日期推進

// 資源相關事件  
'resource_modified'      // 資源修改
'resource_threshold_warning' // 資源警告
'resource_critical_low'  // 資源危急

// 租客相關事件
'tenant_hired'           // 租客雇用
'tenant_evicted'         // 租客驅逐
'tenant_action'          // 租客行動

// 交易相關事件
'rent_collected'         // 租金收取
'trade_completed'        // 交易完成
```

### 效能參考指標
- 監聽器執行時間：< 10ms（同步）
- 事件發送延遲：< 1ms
- 記憶體使用：< 5MB（1000個監聽器）
- 事件歷史記錄：建議 < 500條

### 整合檢查清單
- [ ] EventBus正確初始化
- [ ] 關鍵事件監聽器已註冊
- [ ] 錯誤處理機制已實作
- [ ] 記憶體清理機制已設定
- [ ] 事件命名規範已遵循
- [ ] 除錯工具已配置

---

**開發指南版本：** v2.0  
**維護者：** 末日房東模擬器開發團隊
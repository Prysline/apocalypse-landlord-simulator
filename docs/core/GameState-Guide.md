# GameState v2.0 開發指南

## 📋 文檔概覽

本指南提供GameState v2.0的完整開發參考，包含API調用、整合範例、除錯指導和最佳實踐。適用於末日房東模擬器的單人開發場景。

**版本**：GameState v2.0 (中央狀態管理版)  
**更新日期**：2025年  
**相容性**：需要 helpers.js 工具函數  
**核心功能**：狀態不變性保證、路徑存取、訂閱機制、歷史追蹤

---

## 🚀 快速開始

### 基本初始化

```javascript
// 1. 引入GameState
import GameState from './core/GameState.js';

// 2. 建立實例（通常在 main.js 中）
const gameState = new GameState();

// 3. 使用初始資料建立實例
const gameState = new GameState({
    rules: gameRules,  // 從DataManager載入的規則
    customResources: { food: 50, cash: 100 }
});

// 4. 檢查初始化狀態
console.log('GameState 狀態:', gameState.getStateStats());
```

### 基本狀態操作

```javascript
// 讀取狀態
const currentDay = gameState.getStateValue('day');
const foodAmount = gameState.getStateValue('resources.food');
const allResources = gameState.getStateValue('resources');

// 修改狀態
gameState.setState({ day: 2 }, '推進到第二天');
gameState.setStateValue('resources.food', 25, '消費食物');

// 資源快捷操作
const success = gameState.modifyResource('cash', 50, '租金收入');
if (gameState.hasEnoughResource('materials', 5)) {
    console.log('建材充足，可以維修');
}

// 訂閱狀態變化
const unsubscribe = gameState.subscribe('state_changed', (changeData) => {
    console.log('狀態已變更:', changeData);
});
```

---

## 📚 核心API完整參考

### 狀態讀取類 API

#### `getState()`
取得完整遊戲狀態的深度複製，GameState的基礎方法。

**返回值：** `GameStateData` - 完整狀態物件深度複製

**使用範例：**
```javascript
// 取得完整狀態
const fullState = gameState.getState();
console.log('當前狀態:', fullState);

// 安全的狀態檢查
const stateCopy = gameState.getState();
stateCopy.resources.food = 0; // 不會影響實際狀態
console.log('實際食物:', gameState.getStateValue('resources.food')); // 原值不變

// 狀態備份
const stateBackup = gameState.getState();
localStorage.setItem('gameBackup', JSON.stringify(stateBackup));
```

#### `getStateValue(path, defaultValue)`
取得指定路徑的狀態值，支援點記法路徑存取。

**參數：**
- `path` (string): 狀態路徑，使用點號分隔
- `defaultValue` (any, 可選): 路徑不存在時的預設值

**返回值：** `any` - 指定路徑的狀態值或預設值

**使用範例：**
```javascript
// 基本路徑存取
const day = gameState.getStateValue('day');
const food = gameState.getStateValue('resources.food');
const hunger = gameState.getStateValue('landlord.hunger');

// 深層路徑存取
const firstRoomTenant = gameState.getStateValue('rooms.0.tenant');
const doctorSatisfaction = gameState.getStateValue('tenants.satisfaction.張醫生');

// 使用預設值
const unknownValue = gameState.getStateValue('unknown.path', 0);
const config = gameState.getStateValue('system.gameRules', {});

// 檢查巢狀屬性
const tenantCount = gameState.getStateValue('rooms', []).filter(room => room.tenant).length;
```

#### `getAllTenants()`
取得所有租客的陣列，常用的便利方法。

**返回值：** `Tenant[]` - 所有租客物件陣列

**使用範例：**
```javascript
// 取得所有租客
const tenants = gameState.getAllTenants();
console.log(`目前有 ${tenants.length} 位租客`);

// 尋找特定租客
const doctor = tenants.find(tenant => tenant.type === 'doctor');
if (doctor) {
    console.log('醫生租客:', doctor.name);
}

// 計算感染租客
const infectedCount = tenants.filter(tenant => tenant.infected).length;
console.log(`感染租客數量: ${infectedCount}`);

// 取得執行任務的租客
const onMission = tenants.filter(tenant => tenant.onMission);
console.log('任務中的租客:', onMission.map(t => t.name));
```

#### `getOccupiedRooms()`
取得已入住的房間陣列。

**返回值：** `Room[]` - 有租客入住的房間陣列

**使用範例：**
```javascript
// 取得入住房間
const occupiedRooms = gameState.getOccupiedRooms();
console.log(`已入住房間數: ${occupiedRooms.length}`);

// 檢查房間狀態
occupiedRooms.forEach(room => {
    console.log(`房間 ${room.id}: ${room.tenant.name} (${room.tenant.type})`);
    if (room.needsRepair) {
        console.log(`  - 需要維修`);
    }
    if (room.reinforced) {
        console.log(`  - 已加固`);
    }
});

// 計算房租收入
const totalRent = occupiedRooms.reduce((sum, room) => sum + room.tenant.rent, 0);
console.log(`總房租收入: $${totalRent}`);
```

### 狀態修改類 API

#### `setState(updates, reason)`
批量更新狀態，支援深層物件合併。

**參數：**
- `updates` (Object): 要更新的狀態物件
- `reason` (string, 可選): 變更原因，預設為'狀態更新'

**返回值：** `boolean` - 更新是否成功

**事件觸發：** `state_changed`

**使用範例：**
```javascript
// 基本狀態更新
gameState.setState({
    day: 5,
    time: 'night'
}, '推進到第五天夜晚');

// 深層物件更新
gameState.setState({
    resources: {
        food: 30,
        cash: 150
    },
    landlord: {
        hunger: 1
    }
}, '晚餐後狀態');

// 批量房間更新
gameState.setState({
    rooms: gameState.getStateValue('rooms').map(room => ({
        ...room,
        needsRepair: false
    }))
}, '全房間維修完成');

// 複雜狀態更新
const updates = {
    day: gameState.getStateValue('day') + 1,
    dailyActions: {
        rentCollected: false,
        harvestUsed: false,
        scavengeUsed: 0
    },
    globalEffects: {
        ...gameState.getStateValue('globalEffects'),
        nightWatchActive: true
    }
};
gameState.setState(updates, '新一天開始');
```

#### `setStateValue(path, value, reason)`
設定指定路徑的狀態值。

**參數：**
- `path` (string): 狀態路徑，使用點號分隔
- `value` (any): 要設定的值
- `reason` (string, 可選): 變更原因

**返回值：** `boolean` - 設定是否成功

**使用範例：**
```javascript
// 簡單路徑設定
gameState.setStateValue('day', 10, '跳轉到第十天');
gameState.setStateValue('time', 'day', '切換到白天');

// 深層路徑設定
gameState.setStateValue('resources.food', 45, '食物補充');
gameState.setStateValue('landlord.hunger', 0, '用餐後');
gameState.setStateValue('building.defense', 15, '防禦升級');

// 陣列元素設定
gameState.setStateValue('rooms.0.reinforced', true, '第一間房加固');
gameState.setStateValue('rooms.1.tenant', newTenant, '新租客入住');

// 巢狀物件設定
gameState.setStateValue('tenants.satisfaction.張醫生', 80, '滿意度更新');
gameState.setStateValue('globalEffects.emergencyTraining', true, '啟用緊急訓練');
```

### 資源管理類 API

#### `modifyResource(resourceType, amount, reason)`
修改資源數量的便利方法，內建驗證機制。

**參數：**
- `resourceType` (ResourceType): 'food' | 'materials' | 'medical' | 'fuel' | 'cash'
- `amount` (number): 變更數量，可為負數
- `reason` (string, 可選): 變更原因

**返回值：** `boolean` - 修改是否成功

**事件觸發：** `resource_modified`

**使用範例：**
```javascript
// 增加資源
const success = gameState.modifyResource('food', 10, '院子採集');
if (success) {
    console.log('食物增加成功');
}

// 消費資源
if (gameState.modifyResource('materials', -5, '房間維修')) {
    console.log('維修完成');
} else {
    console.log('建材不足，無法維修');
}

// 租金收入
gameState.modifyResource('cash', 75, '月租收入');

// 批量資源修改
const resourceChanges = [
    { type: 'food', amount: -2, reason: '每日消費' },
    { type: 'fuel', amount: -1, reason: '發電機消費' },
    { type: 'cash', amount: 20, reason: '零工收入' }
];

resourceChanges.forEach(change => {
    gameState.modifyResource(change.type, change.amount, change.reason);
});
```

#### `hasEnoughResource(resourceType, amount)`
檢查資源是否足夠的驗證方法。

**參數：**
- `resourceType` (ResourceType): 資源類型
- `amount` (number): 需要的數量

**返回值：** `boolean` - 資源是否足夠

**使用範例：**
```javascript
// 基本資源檢查
if (gameState.hasEnoughResource('food', 5)) {
    console.log('食物充足');
    gameState.modifyResource('food', -5, '烹飪消費');
}

// 建築需求檢查
const repairCost = 3;
if (gameState.hasEnoughResource('materials', repairCost)) {
    // 執行維修
    gameState.modifyResource('materials', -repairCost, '房間維修');
    gameState.setStateValue('rooms.0.needsRepair', false, '維修完成');
} else {
    console.log('建材不足，無法維修');
}

// 交易前檢查
const tradeOffers = [
    { give: 'cash', amount: 20, get: 'food', getAmount: 5 },
    { give: 'materials', amount: 2, get: 'medical', getAmount: 3 }
];

const availableTrades = tradeOffers.filter(offer => 
    gameState.hasEnoughResource(offer.give, offer.amount)
);
console.log('可進行的交易:', availableTrades);
```

### 租客管理類 API

#### `addTenant(tenant, roomId, reason)`
新增租客到指定房間。

**參數：**
- `tenant` (Tenant): 租客物件
- `roomId` (number): 房間ID
- `reason` (string, 可選): 變更原因

**返回值：** `boolean` - 新增是否成功

**事件觸發：** `tenant_added`

**使用範例：**
```javascript
// 新增租客
const newTenant = {
    name: '李工程師',
    type: 'worker',
    skill: '建築維修',
    rent: 30,
    infected: false,
    personalResources: {
        food: 5,
        materials: 10,
        medical: 2,
        fuel: 3,
        cash: 25
    }
};

const success = gameState.addTenant(newTenant, 1, '雇用新租客');
if (success) {
    console.log('租客入住成功');
} else {
    console.log('房間已被佔用或不存在');
}

// 檢查房間可用性
const availableRooms = gameState.getStateValue('rooms')
    .filter(room => !room.tenant)
    .map(room => room.id);

if (availableRooms.length > 0) {
    gameState.addTenant(newTenant, availableRooms[0], '自動分配房間');
}
```

#### `removeTenant(tenantName, reason)`
移除指定租客。

**參數：**
- `tenantName` (string): 租客姓名
- `reason` (string, 可選): 移除原因

**返回值：** `boolean` - 移除是否成功

**事件觸發：** `tenant_removed`

**使用範例：**
```javascript
// 移除租客
const success = gameState.removeTenant('張醫生', '租約到期');
if (success) {
    console.log('租客已離開');
} else {
    console.log('找不到指定租客');
}

// 批量移除感染租客
const infectedTenants = gameState.getAllTenants()
    .filter(tenant => tenant.infected)
    .map(tenant => tenant.name);

infectedTenants.forEach(name => {
    gameState.removeTenant(name, '感染隔離');
});

// 驅逐低滿意度租客
const dissatisfiedTenants = gameState.getAllTenants()
    .filter(tenant => {
        const satisfaction = gameState.getStateValue(`tenants.satisfaction.${tenant.name}`, 50);
        return satisfaction < 20;
    });

dissatisfiedTenants.forEach(tenant => {
    gameState.removeTenant(tenant.name, '滿意度過低');
});
```

### 狀態訂閱類 API

#### `subscribe(eventType, callback)`
訂閱狀態變更事件。

**參數：**
- `eventType` (StateEventType): 事件類型
- `callback` (StateSubscriptionCallback): 回調函數

**返回值：** `UnsubscribeFunction` - 取消訂閱的函數

**使用範例：**
```javascript
// 訂閱狀態變更
const unsubscribe = gameState.subscribe('state_changed', (changeData) => {
    console.log('狀態變更:', changeData.path, changeData.newValue);
    updateUI();
});

// 訂閱日誌新增
gameState.subscribe('log_added', (logEntry) => {
    displayLogMessage(logEntry);
});

// 訂閱日期推進
gameState.subscribe('day_advanced', (dayData) => {
    console.log(`第 ${dayData.day} 天 ${dayData.time}`);
    triggerDailyEvents();
});

// 條件式訂閱
gameState.subscribe('state_changed', (changeData) => {
    // 只處理資源變更
    if (changeData.path.startsWith('resources.')) {
        updateResourceDisplay();
    }
});

// 多個訂閱管理
const subscriptions = [
    gameState.subscribe('state_changed', handleStateChange),
    gameState.subscribe('log_added', handleLogAdd),
    gameState.subscribe('day_advanced', handleDayAdvance)
];

// 統一取消訂閱
function cleanup() {
    subscriptions.forEach(unsubscribe => unsubscribe());
}
```

### 遊戲管理類 API

#### `addLog(message, type)`
新增遊戲日誌條目。

**參數：**
- `message` (string): 日誌訊息
- `type` (LogType, 可選): 日誌類型

**返回值：** `void`

**事件觸發：** `log_added`

**使用範例：**
```javascript
// 基本日誌
gameState.addLog('新租客入住', 'event');
gameState.addLog('收取房租 $150', 'rent');
gameState.addLog('發現可疑人員', 'danger');

// 技能執行日誌
gameState.addLog('張醫生使用治療技能', 'skill');

// 動態日誌
const tenant = gameState.getAllTenants()[0];
gameState.addLog(`${tenant.name} 完成搜刮任務，獲得食物 x3`, 'event');

// 批量日誌（用於總結）
const logs = [
    '第5天總結：',
    '收取房租：$200',
    '消費食物：8單位',
    '新租客入住：1位'
];
logs.forEach(log => gameState.addLog(log));
```

#### `advanceDay()`
推進遊戲日期。

**返回值：** `void`

**事件觸發：** `day_advanced`

**使用範例：**
```javascript
// 推進日期
gameState.advanceDay();

// 檢查新日期
const currentDay = gameState.getStateValue('day');
const currentTime = gameState.getStateValue('time');
console.log(`現在是第 ${currentDay} 天 ${currentTime}`);

// 自動日期推進
function autoDayAdvance() {
    gameState.advanceDay();
    
    // 重設每日操作
    gameState.setState({
        dailyActions: {
            rentCollected: false,
            harvestUsed: false,
            scavengeUsed: 0,
            maxScavengePerDay: 2
        }
    }, '每日重設');
    
    console.log('新的一天開始！');
}
```

### 系統管理類 API

#### `getStateStats()`
取得狀態統計資料。

**返回值：** `StateStats` - 系統統計資料

**使用範例：**
```javascript
// 取得統計資料
const stats = gameState.getStateStats();
console.log('遊戲統計:', {
    當前天數: stats.day,
    租客總數: stats.totalTenants,
    感染租客: stats.infectedTenants,
    入住房間: stats.occupiedRooms,
    總資源數: stats.totalResources,
    建築防禦: stats.buildingDefense,
    房東飢餓: stats.landlordHunger,
    日誌條目: stats.logEntries
});

// 定期統計報告
function generateStatusReport() {
    const stats = gameState.getStateStats();
    const report = `
=== 遊戲狀態報告 ===
第 ${stats.day} 天
租客: ${stats.totalTenants} 位 (感染: ${stats.infectedTenants})
房間: ${stats.occupiedRooms}/${stats.totalRooms} 已入住
建築防禦: ${stats.buildingDefense}
房東狀態: ${stats.landlordHunger > 0 ? '飢餓' : '正常'}
    `;
    console.log(report);
}
```

#### `export()`
匯出遊戲狀態（存檔功能）。

**返回值：** `ExportData` - 匯出資料

**使用範例：**
```javascript
// 匯出狀態
const exportData = gameState.export();
console.log('匯出完成:', exportData.metadata);

// 存檔到本地儲存
function saveGame(slotName) {
    const exportData = gameState.export();
    localStorage.setItem(`save_${slotName}`, JSON.stringify(exportData));
    console.log(`遊戲已存檔到槽位: ${slotName}`);
}

// 自動存檔
function autoSave() {
    const exportData = gameState.export();
    const saveKey = `autosave_${Date.now()}`;
    localStorage.setItem(saveKey, JSON.stringify(exportData));
    
    // 保留最新5個自動存檔
    const autoSaves = Object.keys(localStorage)
        .filter(key => key.startsWith('autosave_'))
        .sort()
        .reverse();
    
    if (autoSaves.length > 5) {
        autoSaves.slice(5).forEach(key => localStorage.removeItem(key));
    }
}
```

#### `import(exportedData)`
匯入遊戲狀態（讀檔功能）。

**參數：**
- `exportedData` (ExportData): 要匯入的狀態資料

**返回值：** `void`

**事件觸發：** `state_imported`

**使用範例：**
```javascript
// 讀檔
function loadGame(slotName) {
    try {
        const saveData = localStorage.getItem(`save_${slotName}`);
        if (saveData) {
            const exportData = JSON.parse(saveData);
            gameState.import(exportData);
            console.log('遊戲讀檔完成');
        } else {
            console.log('存檔不存在');
        }
    } catch (error) {
        console.error('讀檔失敗:', error);
    }
}

// 驗證存檔格式
function validateSaveData(exportData) {
    if (!exportData.state) {
        throw new Error('無效的存檔格式：缺少狀態資料');
    }
    
    if (!exportData.metadata) {
        console.warn('存檔缺少元資料');
    }
    
    // 檢查版本相容性
    if (exportData.metadata.version !== '2.0') {
        console.warn('存檔版本可能不相容:', exportData.metadata.version);
    }
    
    return true;
}

// 安全讀檔
function safeLoadGame(exportData) {
    try {
        validateSaveData(exportData);
        
        // 備份當前狀態
        const currentState = gameState.export();
        
        try {
            gameState.import(exportData);
            console.log('讀檔成功');
        } catch (importError) {
            // 恢復備份
            gameState.import(currentState);
            console.error('讀檔失敗，已恢復原狀態:', importError);
        }
    } catch (error) {
        console.error('存檔驗證失敗:', error);
    }
}
```

---

## 🎯 典型使用場景

### 場景1：資源管理系統整合

```javascript
// 建立資源管理包裝器
class ResourceManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.setupResourceMonitoring();
    }
    
    setupResourceMonitoring() {
        // 監控資源變更
        this.gameState.subscribe('resource_modified', (data) => {
            this.checkResourceThresholds(data);
            this.updateResourceDisplay(data);
        });
    }
    
    // 安全的資源修改
    safeModifyResource(resourceType, amount, reason) {
        if (amount < 0 && !this.gameState.hasEnoughResource(resourceType, Math.abs(amount))) {
            console.warn(`${resourceType} 不足，無法執行操作`);
            return false;
        }
        
        return this.gameState.modifyResource(resourceType, amount, reason);
    }
    
    // 資源閾值檢查
    checkResourceThresholds(data) {
        const { resourceType, newValue } = data;
        const thresholds = {
            food: { warning: 10, critical: 5 },
            materials: { warning: 8, critical: 3 },
            medical: { warning: 6, critical: 2 },
            fuel: { warning: 5, critical: 2 },
            cash: { warning: 20, critical: 10 }
        };
        
        const threshold = thresholds[resourceType];
        if (threshold) {
            if (newValue <= threshold.critical) {
                this.gameState.addLog(`${resourceType} 嚴重不足！`, 'danger');
            } else if (newValue <= threshold.warning) {
                this.gameState.addLog(`${resourceType} 存量偏低`, 'event');
            }
        }
    }
}
```

### 場景2：租客生命週期管理

```javascript
// 租客管理系統
class TenantLifecycleManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.setupTenantEvents();
    }
    
    setupTenantEvents() {
        // 監控租客變更
        this.gameState.subscribe('tenant_added', (data) => {
            this.onTenantAdded(data.tenant, data.roomId);
        });
        
        this.gameState.subscribe('tenant_removed', (data) => {
            this.onTenantRemoved(data.tenant);
        });
        
        // 監控日期推進
        this.gameState.subscribe('day_advanced', () => {
            this.processDailyTenantEvents();
        });
    }
    
    onTenantAdded(tenant, roomId) {
        // 初始化租客滿意度
        this.gameState.setStateValue(
            `tenants.satisfaction.${tenant.name}`, 
            50, 
            '新租客初始滿意度'
        );
        
        // 記錄日誌
        this.gameState.addLog(
            `${tenant.name} (${tenant.type}) 入住房間 ${roomId}`, 
            'event'
        );
        
        // 檢查技能影響
        this.applyTenantSkillEffects(tenant);
    }
    
    processDailyTenantEvents() {
        const tenants = this.gameState.getAllTenants();
        
        tenants.forEach(tenant => {
            // 更新滿意度
            this.updateTenantSatisfaction(tenant);
            
            // 檢查感染風險
            this.checkInfectionRisk(tenant);
            
            // 處理租客技能
            this.processTenantSkills(tenant);
        });
    }
    
    updateTenantSatisfaction(tenant) {
        const currentSatisfaction = this.gameState.getStateValue(
            `tenants.satisfaction.${tenant.name}`, 50
        );
        
        let change = 0;
        
        // 根據房東飢餓程度影響滿意度
        const landlordHunger = this.gameState.getStateValue('landlord.hunger', 0);
        if (landlordHunger > 0) {
            change -= landlordHunger * 2;
        }
        
        // 根據建築品質影響滿意度
        const buildingQuality = this.gameState.getStateValue('building.quality', 0);
        change += buildingQuality;
        
        // 更新滿意度
        const newSatisfaction = Math.max(0, Math.min(100, currentSatisfaction + change));
        this.gameState.setStateValue(
            `tenants.satisfaction.${tenant.name}`, 
            newSatisfaction, 
            '每日滿意度更新'
        );
        
        // 檢查是否離開
        if (newSatisfaction < 10) {
            this.gameState.removeTenant(tenant.name, '滿意度過低離開');
        }
    }
}
```

### 場景3：遊戲進度保存系統

```javascript
// 進度保存管理器
class SaveGameManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.autoSaveInterval = 5 * 60 * 1000; // 5分鐘
        this.setupAutoSave();
    }
    
    setupAutoSave() {
        // 監控重要狀態變更
        this.gameState.subscribe('day_advanced', () => {
            this.autoSave();
        });
        
        // 定期自動存檔
        setInterval(() => {
            this.autoSave();
        }, this.autoSaveInterval);
    }
    
    // 創建存檔
    createSave(slotName, description = '') {
        try {
            const exportData = this.gameState.export();
            const saveData = {
                ...exportData,
                metadata: {
                    ...exportData.metadata,
                    slotName,
                    description,
                    gameDay: this.gameState.getStateValue('day'),
                    tenantCount: this.gameState.getAllTenants().length,
                    saveTime: new Date().toISOString()
                }
            };
            
            localStorage.setItem(`save_${slotName}`, JSON.stringify(saveData));
            this.gameState.addLog(`遊戲已存檔: ${slotName}`, 'event');
            
            return { success: true, saveData };
        } catch (error) {
            console.error('存檔失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    // 載入存檔
    loadSave(slotName) {
        try {
            const saveDataString = localStorage.getItem(`save_${slotName}`);
            if (!saveDataString) {
                return { success: false, error: '存檔不存在' };
            }
            
            const saveData = JSON.parse(saveDataString);
            
            // 驗證存檔
            if (!this.validateSaveData(saveData)) {
                return { success: false, error: '存檔格式無效' };
            }
            
            // 匯入狀態
            this.gameState.import(saveData);
            this.gameState.addLog(`讀取存檔: ${slotName}`, 'event');
            
            return { success: true, metadata: saveData.metadata };
        } catch (error) {
            console.error('讀檔失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    // 自動存檔
    autoSave() {
        const autoSaveSlot = `auto_${Date.now()}`;
        const result = this.createSave(autoSaveSlot, '自動存檔');
        
        if (result.success) {
            // 清理舊的自動存檔
            this.cleanupAutoSaves();
        }
    }
    
    // 清理自動存檔
    cleanupAutoSaves() {
        const autoSaves = Object.keys(localStorage)
            .filter(key => key.startsWith('save_auto_'))
            .map(key => ({
                key,
                timestamp: parseInt(key.split('_')[2])
            }))
            .sort((a, b) => b.timestamp - a.timestamp);
        
        // 保留最新的3個自動存檔
        if (autoSaves.length > 3) {
            autoSaves.slice(3).forEach(save => {
                localStorage.removeItem(save.key);
            });
        }
    }
    
    // 驗證存檔資料
    validateSaveData(saveData) {
        return saveData.state && 
               saveData.metadata && 
               saveData.state.day !== undefined &&
               saveData.state.resources !== undefined;
    }
    
    // 取得所有存檔列表
    getSaveList() {
        const saves = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('save_')) {
                try {
                    const saveData = JSON.parse(localStorage.getItem(key));
                    saves.push({
                        slotName: saveData.metadata.slotName,
                        description: saveData.metadata.description,
                        gameDay: saveData.metadata.gameDay,
                        tenantCount: saveData.metadata.tenantCount,
                        saveTime: saveData.metadata.saveTime,
                        isAutoSave: key.includes('auto_')
                    });
                } catch (error) {
                    console.warn('無效的存檔格式:', key);
                }
            }
        }
        
        return saves.sort((a, b) => new Date(b.saveTime) - new Date(a.saveTime));
    }
}
```

---

## ⚠️ 錯誤處理與除錯

### 常見錯誤類型

#### 1. 狀態路徑錯誤
```javascript
// ❌ 錯誤：路徑不存在
const value = gameState.getStateValue('nonexistent.path');
console.log(value); // undefined

// ✅ 正確：使用預設值
const value = gameState.getStateValue('nonexistent.path', 0);

// ✅ 正確：檢查路徑存在性
function safeGetValue(path, defaultValue) {
    try {
        const value = gameState.getStateValue(path, defaultValue);
        return value !== undefined ? value : defaultValue;
    } catch (error) {
        console.warn(`路徑存取失敗: ${path}`, error);
        return defaultValue;
    }
}
```

#### 2. 狀態修改失敗
```javascript
// 資源修改失敗處理
function safeResourceModification(resourceType, amount, reason) {
    // 檢查資源類型
    const validTypes = ['food', 'materials', 'medical', 'fuel', 'cash'];
    if (!validTypes.includes(resourceType)) {
        console.error('無效的資源類型:', resourceType);
        return false;
    }
    
    // 檢查數量
    if (typeof amount !== 'number' || isNaN(amount)) {
        console.error('無效的數量:', amount);
        return false;
    }
    
    // 檢查負數時是否足夠
    if (amount < 0 && !gameState.hasEnoughResource(resourceType, Math.abs(amount))) {
        console.warn(`${resourceType} 不足，無法減少 ${Math.abs(amount)} 單位`);
        return false;
    }
    
    return gameState.modifyResource(resourceType, amount, reason);
}
```

#### 3. 租客操作錯誤
```javascript
// 租客新增失敗處理
function safeTenantAddition(tenant, roomId, reason) {
    // 驗證租客物件
    if (!tenant || !tenant.name || !tenant.type) {
        console.error('無效的租客物件:', tenant);
        return false;
    }
    
    // 檢查房間可用性
    const rooms = gameState.getStateValue('rooms', []);
    const targetRoom = rooms.find(room => room.id === roomId);
    
    if (!targetRoom) {
        console.error('房間不存在:', roomId);
        return false;
    }
    
    if (targetRoom.tenant) {
        console.warn('房間已被佔用:', roomId);
        return false;
    }
    
    // 檢查是否重名
    const existingTenants = gameState.getAllTenants();
    if (existingTenants.some(t => t.name === tenant.name)) {
        console.warn('租客姓名重複:', tenant.name);
        return false;
    }
    
    return gameState.addTenant(tenant, roomId, reason);
}
```

### 除錯工具和技巧

#### 狀態變更追蹤
```javascript
// 啟用狀態變更追蹤
function enableStateTracking(gameState) {
    gameState.subscribe('state_changed', (changeData) => {
        console.group(`🔄 狀態變更: ${changeData.path}`);
        console.log('舊值:', changeData.oldValue);
        console.log('新值:', changeData.newValue);
        console.log('原因:', changeData.reason);
        console.log('時間:', new Date().toLocaleTimeString());
        console.groupEnd();
    });
}

// 特定路徑監控
function trackResourceChanges(gameState) {
    gameState.subscribe('state_changed', (changeData) => {
        if (changeData.path.startsWith('resources.')) {
            const resourceType = changeData.path.split('.')[1];
            const change = changeData.newValue - changeData.oldValue;
            
            console.log(`💰 ${resourceType}: ${changeData.oldValue} → ${changeData.newValue} (${change > 0 ? '+' : ''}${change})`);
        }
    });
}
```

#### 狀態完整性檢查
```javascript
// 狀態健康檢查
function validateGameState(gameState) {
    const issues = [];
    const state = gameState.getState();
    
    // 檢查基本屬性
    if (typeof state.day !== 'number' || state.day < 1) {
        issues.push('無效的遊戲天數');
    }
    
    if (!['day', 'night'].includes(state.time)) {
        issues.push('無效的時間狀態');
    }
    
    // 檢查資源
    const resources = state.resources;
    Object.entries(resources).forEach(([type, amount]) => {
        if (typeof amount !== 'number' || amount < 0) {
            issues.push(`無效的資源數量: ${type} = ${amount}`);
        }
    });
    
    // 檢查房間
    const rooms = state.rooms;
    if (!Array.isArray(rooms) || rooms.length === 0) {
        issues.push('房間配置無效');
    }
    
    rooms.forEach((room, index) => {
        if (!room.id || typeof room.id !== 'number') {
            issues.push(`房間 ${index} ID 無效`);
        }
        
        if (room.tenant) {
            if (!room.tenant.name || !room.tenant.type) {
                issues.push(`房間 ${room.id} 租客資料不完整`);
            }
        }
    });
    
    // 檢查租客一致性
    const tenants = gameState.getAllTenants();
    const roomTenants = rooms.filter(room => room.tenant).map(room => room.tenant);
    
    if (tenants.length !== roomTenants.length) {
        issues.push('租客數量不一致');
    }
    
    // 輸出檢查結果
    if (issues.length === 0) {
        console.log('✅ 遊戲狀態健康');
    } else {
        console.warn('⚠️ 發現狀態問題:', issues);
    }
    
    return { healthy: issues.length === 0, issues };
}
```

#### 效能監控
```javascript
// 狀態操作效能監控
function monitorPerformance(gameState) {
    const originalSetState = gameState.setState.bind(gameState);
    const originalSetStateValue = gameState.setStateValue.bind(gameState);
    
    gameState.setState = function(updates, reason) {
        const start = performance.now();
        const result = originalSetState(updates, reason);
        const duration = performance.now() - start;
        
        if (duration > 10) { // 超過10ms警告
            console.warn(`⚠️ setState 執行時間過長: ${duration.toFixed(2)}ms`, {
                reason,
                updateSize: JSON.stringify(updates).length
            });
        }
        
        return result;
    };
    
    gameState.setStateValue = function(path, value, reason) {
        const start = performance.now();
        const result = originalSetStateValue(path, value, reason);
        const duration = performance.now() - start;
        
        if (duration > 5) { // 超過5ms警告
            console.warn(`⚠️ setStateValue 執行時間過長: ${duration.toFixed(2)}ms`, {
                path,
                reason
            });
        }
        
        return result;
    };
}
```

---

## 🔧 效能最佳化

### 狀態更新最佳化

```javascript
// 批量狀態更新
function batchStateUpdates(gameState, updates) {
    // 合併多個更新為單次操作
    const mergedUpdates = {};
    
    updates.forEach(update => {
        Object.assign(mergedUpdates, update.changes);
    });
    
    const reasons = updates.map(u => u.reason).join('; ');
    gameState.setState(mergedUpdates, reasons);
}

// 使用範例
const dailyUpdates = [
    { changes: { day: gameState.getStateValue('day') + 1 }, reason: '日期推進' },
    { changes: { 'landlord.hunger': 0 }, reason: '用餐' },
    { changes: { 'dailyActions.rentCollected': false }, reason: '重設每日操作' }
];

batchStateUpdates(gameState, dailyUpdates);
```

### 訂閱管理最佳化

```javascript
// 智慧訂閱管理器
class SubscriptionManager {
    constructor() {
        this.subscriptions = new Map();
        this.groupedSubscriptions = new Map();
    }
    
    // 分組訂閱（減少重複回調）
    groupSubscribe(gameState, eventType, groupName, callback) {
        if (!this.groupedSubscriptions.has(groupName)) {
            this.groupedSubscriptions.set(groupName, []);
            
            // 建立群組的統一監聽器
            const unsubscribe = gameState.subscribe(eventType, (data) => {
                const callbacks = this.groupedSubscriptions.get(groupName);
                callbacks.forEach(cb => {
                    try {
                        cb(data);
                    } catch (error) {
                        console.error('群組訂閱回調錯誤:', error);
                    }
                });
            });
            
            this.subscriptions.set(groupName, unsubscribe);
        }
        
        this.groupedSubscriptions.get(groupName).push(callback);
        
        // 返回移除此回調的函數
        return () => {
            const callbacks = this.groupedSubscriptions.get(groupName);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }
    
    // 清理群組
    unsubscribeGroup(groupName) {
        const unsubscribe = this.subscriptions.get(groupName);
        if (unsubscribe) {
            unsubscribe();
            this.subscriptions.delete(groupName);
            this.groupedSubscriptions.delete(groupName);
        }
    }
    
    // 清理所有訂閱
    cleanup() {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions.clear();
        this.groupedSubscriptions.clear();
    }
}
```

### 記憶體管理

```javascript
// 變更歷史限制
function setupHistoryManagement(gameState) {
    const maxHistorySize = 100;
    
    // 定期清理變更歷史
    setInterval(() => {
        if (gameState.changeHistory.length > maxHistorySize) {
            gameState.changeHistory = gameState.changeHistory.slice(-maxHistorySize);
            console.log('清理變更歷史，保留最近', maxHistorySize, '條記錄');
        }
    }, 60000); // 每分鐘檢查一次
}

// 深度複製最佳化
function optimizedDeepClone(obj) {
    // 對於小物件使用 JSON 方法（較快）
    if (JSON.stringify(obj).length < 10000) {
        return JSON.parse(JSON.stringify(obj));
    }
    
    // 對於大物件使用結構化複製（更安全但較慢）
    return structuredClone(obj);
}
```

### 路徑存取最佳化

```javascript
// 路徑快取機制
class PathCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    
    get(path, obj) {
        const cacheKey = `${path}_${this.getObjectHash(obj)}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const value = this.getNestedValue(obj, path);
        
        // 管理快取大小
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(cacheKey, value);
        return value;
    }
    
    clear() {
        this.cache.clear();
    }
    
    getObjectHash(obj) {
        // 簡單的物件雜湊（用於快取鍵）
        return JSON.stringify(obj).length.toString(36);
    }
    
    getNestedValue(obj, path, defaultValue = undefined) {
        return path.split('.').reduce((current, key) => {
            return (current && current[key] !== undefined) ? current[key] : defaultValue;
        }, obj);
    }
}

// 使用快取的 GameState 擴展
function enhanceGameStateWithCache(gameState) {
    const pathCache = new PathCache();
    const originalGetStateValue = gameState.getStateValue.bind(gameState);
    
    gameState.getStateValue = function(path, defaultValue) {
        return pathCache.get(path, this.state) || defaultValue;
    };
    
    // 狀態變更時清理快取
    gameState.subscribe('state_changed', () => {
        pathCache.clear();
    });
}
```

---

## 🔧 常見問題與解決方案

### Q1: 狀態更新沒有觸發訂閱
**症狀：** 修改狀態但訂閱回調沒有執行  
**診斷步驟：**
```javascript
// 1. 檢查訂閱是否正確註冊
console.log('訂閱者數量:', gameState.subscribers.size);

// 2. 確認事件類型正確
const eventType = 'state_changed'; // 確保拼字正確
gameState.subscribe(eventType, (data) => {
    console.log('收到事件:', data);
});

// 3. 檢查狀態修改方法
const success = gameState.setState({ test: 'value' }, '測試');
console.log('修改結果:', success);

// 4. 手動觸發測試
gameState._notifySubscribers('state_changed', { test: 'manual' });
```

### Q2: 狀態路徑存取失敗
**症狀：** getStateValue 返回 undefined  
**解決方案：**
```javascript
// 檢查路徑是否存在
function debugPath(gameState, path) {
    const state = gameState.getState();
    const pathParts = path.split('.');
    let current = state;
    
    console.group(`🔍 路徑檢查: ${path}`);
    
    for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        const currentPath = pathParts.slice(0, i + 1).join('.');
        
        if (current && current.hasOwnProperty(part)) {
            current = current[part];
            console.log(`✅ ${currentPath}:`, typeof current);
        } else {
            console.error(`❌ ${currentPath}: 不存在`);
            console.log('可用屬性:', Object.keys(current || {}));
            break;
        }
    }
    
    console.groupEnd();
    return current;
}

// 使用範例
debugPath(gameState, 'resources.food');
debugPath(gameState, 'rooms.0.tenant.name');
```

### Q3: 租客資料不一致
**症狀：** getAllTenants 和房間中的租客數量不符  
**解決方案：**
```javascript
// 租客一致性檢查
function validateTenantConsistency(gameState) {
    const allTenants = gameState.getAllTenants();
    const rooms = gameState.getStateValue('rooms', []);
    const roomTenants = rooms.filter(room => room.tenant).map(room => room.tenant);
    
    console.group('🏠 租客一致性檢查');
    console.log('getAllTenants 數量:', allTenants.length);
    console.log('房間中租客數量:', roomTenants.length);
    
    // 檢查重複租客
    const tenantNames = allTenants.map(t => t.name);
    const duplicates = tenantNames.filter((name, index) => tenantNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
        console.error('發現重複租客:', duplicates);
    }
    
    // 檢查孤立租客（在 getAllTenants 但不在房間中）
    allTenants.forEach(tenant => {
        const inRoom = roomTenants.some(rt => rt.name === tenant.name);
        if (!inRoom) {
            console.warn('孤立租客:', tenant.name);
        }
    });
    
    // 檢查房間中的非法租客
    roomTenants.forEach(roomTenant => {
        const inTenantList = allTenants.some(t => t.name === roomTenant.name);
        if (!inTenantList) {
            console.warn('房間中的非法租客:', roomTenant.name);
        }
    });
    
    console.groupEnd();
}

// 修復租客一致性
function fixTenantConsistency(gameState) {
    const rooms = gameState.getStateValue('rooms', []);
    const validTenants = [];
    
    // 以房間中的租客為準
    rooms.forEach(room => {
        if (room.tenant && room.tenant.name) {
            validTenants.push(room.tenant);
        }
    });
    
    console.log('修復租客一致性，保留', validTenants.length, '位租客');
    
    // 重建房間狀態
    const updatedRooms = rooms.map(room => ({
        ...room,
        tenant: validTenants.find(t => t === room.tenant) || null
    }));
    
    gameState.setState({ rooms: updatedRooms }, '修復租客一致性');
}
```

### Q4: 記憶體使用過高
**症狀：** 長時間運行後記憶體持續增長  
**解決方案：**
```javascript
// 記憶體使用監控
function monitorMemoryUsage(gameState) {
    const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    let lastCleanup = Date.now();
    
    setInterval(() => {
        const currentMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const memoryIncrease = currentMemory - initialMemory;
        
        console.log(`📊 記憶體使用: ${(currentMemory / 1024 / 1024).toFixed(2)} MB (+${(memoryIncrease / 1024 / 1024).toFixed(2)} MB)`);
        
        // 檢查是否需要清理
        if (Date.now() - lastCleanup > 300000) { // 5分鐘
            cleanupGameState(gameState);
            lastCleanup = Date.now();
        }
    }, 60000); // 每分鐘檢查
}

// 狀態清理
function cleanupGameState(gameState) {
    console.log('🧹 執行狀態清理');
    
    // 限制變更歷史
    if (gameState.changeHistory.length > 50) {
        gameState.changeHistory = gameState.changeHistory.slice(-50);
    }
    
    // 限制遊戲日誌
    const logs = gameState.getStateValue('gameLog', []);
    if (logs.length > 100) {
        gameState.setStateValue('gameLog', logs.slice(-100), '清理日誌');
    }
    
    // 清理空的訂閱者
    gameState.subscribers.forEach((subscribers, eventType) => {
        if (subscribers.size === 0) {
            gameState.subscribers.delete(eventType);
        }
    });
    
    console.log('✅ 狀態清理完成');
}
```

### Q5: 狀態匯入匯出錯誤
**症狀：** 存檔或讀檔時發生錯誤  
**解決方案：**
```javascript
// 強化的存檔驗證
function robustSaveLoad(gameState) {
    // 安全存檔
    function safeSave() {
        try {
            // 先驗證當前狀態
            const validation = validateGameState(gameState);
            if (!validation.healthy) {
                console.warn('狀態不健康，嘗試修復後存檔');
                // 可選：修復問題
            }
            
            const exportData = gameState.export();
            
            // 驗證匯出資料
            if (!exportData.state || !exportData.metadata) {
                throw new Error('匯出資料不完整');
            }
            
            // 測試序列化
            const serialized = JSON.stringify(exportData);
            JSON.parse(serialized); // 確保可以正確反序列化
            
            localStorage.setItem('game_save', serialized);
            console.log('✅ 存檔成功');
            
        } catch (error) {
            console.error('❌ 存檔失敗:', error);
            
            // 嘗試創建最小存檔
            try {
                const minimalSave = {
                    state: {
                        day: gameState.getStateValue('day', 1),
                        resources: gameState.getStateValue('resources', {}),
                        rooms: gameState.getStateValue('rooms', [])
                    },
                    metadata: {
                        version: '2.0',
                        exportTime: new Date().toISOString(),
                        type: 'emergency'
                    }
                };
                
                localStorage.setItem('game_save_emergency', JSON.stringify(minimalSave));
                console.log('⚠️ 已創建緊急存檔');
                
            } catch (emergencyError) {
                console.error('❌ 緊急存檔也失敗:', emergencyError);
            }
        }
    }
    
    // 安全讀檔
    function safeLoad() {
        try {
            const saveData = localStorage.getItem('game_save');
            if (!saveData) {
                console.log('沒有存檔資料');
                return false;
            }
            
            const exportData = JSON.parse(saveData);
            
            // 版本相容性檢查
            if (exportData.metadata.version !== '2.0') {
                console.warn('存檔版本不匹配，嘗試遷移');
                // 可選：版本遷移邏輯
            }
            
            // 備份當前狀態
            const currentState = gameState.export();
            
            try {
                gameState.import(exportData);
                console.log('✅ 讀檔成功');
                return true;
                
            } catch (importError) {
                console.error('❌ 讀檔失敗，恢復備份狀態');
                gameState.import(currentState);
                throw importError;
            }
            
        } catch (error) {
            console.error('❌ 讀檔失敗:', error);
            
            // 嘗試讀取緊急存檔
            try {
                const emergencySave = localStorage.getItem('game_save_emergency');
                if (emergencySave) {
                    const emergencyData = JSON.parse(emergencySave);
                    gameState.import(emergencyData);
                    console.log('⚠️ 已載入緊急存檔');
                    return true;
                }
            } catch (emergencyError) {
                console.error('❌ 緊急存檔讀取失敗:', emergencyError);
            }
            
            return false;
        }
    }
    
    return { safeSave, safeLoad };
}
```

---

## 📖 參考附錄

### ResourceType聯合型別
```typescript
type ResourceType = 'food' | 'materials' | 'medical' | 'fuel' | 'cash';
```

### GameStateData結構
```javascript
{
    day: number,                    // 遊戲天數
    time: 'day' | 'night',          // 時間狀態
    resources: Resources,           // 資源狀態
    landlord: LandlordState,        // 房東狀態
    rooms: Room[],                  // 房間陣列
    tenants: TenantState,           // 租客相關狀態
    building: BuildingState,        // 建築狀態
    dailyActions: DailyActions,     // 每日操作狀態
    globalEffects: GlobalEffects,   // 全局效果
    visitors: Visitor[],            // 當前訪客
    applicants: Applicant[],        // 申請者
    gameLog: LogEntry[],            // 遊戲日誌
    system: SystemState             // 系統狀態
}
```

### StateEventType事件類型
```javascript
'state_changed'    // 狀態變更
'log_added'        // 日誌新增
'day_advanced'     // 日期推進
'state_reset'      // 狀態重設
'state_imported'   // 狀態匯入
'resource_modified' // 資源修改
'tenant_added'     // 租客新增
'tenant_removed'   // 租客移除
```

### 路徑存取範例
```javascript
// 基本路徑
'day'                           // 遊戲天數
'time'                          // 時間狀態
'resources.food'                // 食物數量
'landlord.hunger'               // 房東飢餓程度

// 陣列路徑
'rooms.0.tenant'                // 第一個房間的租客
'rooms.1.reinforced'            // 第二個房間是否加固
'gameLog.0.message'             // 第一條日誌訊息

// 巢狀物件路徑
'tenants.satisfaction.張醫生'    // 張醫生的滿意度
'globalEffects.emergencyTraining' // 緊急訓練效果
'system.gameRules.mechanics'    // 遊戲機制配置
```

### 效能參考指標
- 狀態讀取時間：< 1ms（簡單路徑）
- 狀態修改時間：< 5ms（單次更新）
- 深度複製時間：< 10ms（完整狀態）
- 記憶體使用：< 10MB（100個租客）
- 變更歷史：建議 < 100條記錄

### 整合檢查清單
- [ ] GameState正確初始化
- [ ] 初始狀態配置正確
- [ ] 狀態訂閱機制運作正常
- [ ] 資源管理API功能完整
- [ ] 租客管理邏輯正確
- [ ] 存檔讀檔功能穩定
- [ ] 記憶體管理機制已設定
- [ ] 錯誤處理機制完善

---

**開發指南版本：** v2.0  
**維護者：** 末日房東模擬器開發團隊
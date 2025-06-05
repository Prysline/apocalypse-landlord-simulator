# ResourceManager v2.0 開發指南

## 📋 文檔概覽

本指南提供ResourceManager v2.0的完整開發參考，包含API調用、整合範例、除錯指導和最佳實踐。適用於末日房東模擬器的單人開發場景。

**版本**：ResourceManager v2.0 (BaseManager 繼承版)  
**更新日期**：2025年  
**相容性**：需要 GameState, EventBus, BaseManager  

---

## 🚀 快速開始

### 基本初始化

```javascript
// 1. 引入必要模組
import ResourceManager from './systems/ResourceManager.js';
import GameState from './core/GameState.js';
import EventBus from './core/EventBus.js';

// 2. 建立實例（通常在 main.js 中）
const gameState = new GameState();
const eventBus = new EventBus();
const resourceManager = new ResourceManager(gameState, eventBus);

// 3. 檢查初始化狀態
console.log('ResourceManager 狀態:', resourceManager.getStatus());
```

### 基本資源操作

```javascript
// 增加資源
const success = resourceManager.modifyResource('food', 10, '商人交易');
if (success) {
    console.log('食物增加成功');
}

// 檢查資源是否足夠
if (resourceManager.hasEnoughResource('cash', 20)) {
    console.log('現金足夠進行交易');
}

// 批量修改資源
resourceManager.bulkModifyResources({
    changes: { food: -2, fuel: -1, cash: 15 },
    reason: '每日消費',
    source: 'daily_cycle'
});
```

---

## 📚 核心API完整參考

### 資源修改類 API

#### `modifyResource(resourceType, amount, reason, source)`
修改單一資源數量，ResourceManager的核心方法。

**參數：**
- `resourceType` (ResourceType): 'food' | 'materials' | 'medical' | 'fuel' | 'cash'
- `amount` (number): 變更數量，可為負數
- `reason` (string, 可選): 修改原因，預設為'資源修改'
- `source` (string, 可選): 修改來源，預設為'system'

**返回值：** `boolean` - 修改是否成功

**事件觸發：** `resource_modified`

**使用範例：**
```javascript
// 增加食物
resourceManager.modifyResource('food', 5, '院子採集', 'harvest');

// 消費建材
resourceManager.modifyResource('materials', -3, '房間維修', 'repair');

// 租金收入
resourceManager.modifyResource('cash', 25, '租客A房租', 'rent_collection');
```

#### `bulkModifyResources(modification)`
批量修改多種資源，比多次調用modifyResource更高效。

**參數物件：**
```javascript
{
    changes: { [resourceType]: amount },  // 資源變更對應表
    reason: string,                       // 修改原因
    source?: string,                      // 修改來源（可選）
    allowNegative?: boolean              // 是否允許負數結果（可選）
}
```

**使用範例：**
```javascript
// 每日消費（房東用餐 + 燃料消耗）
resourceManager.bulkModifyResources({
    changes: {
        food: -2,      // 房東用餐
        fuel: -1       // 燃料消耗
    },
    reason: '每日基本消費',
    source: 'daily_cycle'
});

// 搜刮獎勵
resourceManager.bulkModifyResources({
    changes: {
        food: 6,
        materials: 3,
        medical: 1
    },
    reason: '搜刮任務獎勵',
    source: 'scavenge_mission'
});
```

### 資源檢查類 API

#### `hasEnoughResource(resourceType, amount)`
檢查單一資源是否足夠。

**使用範例：**
```javascript
// 檢查是否有足夠材料進行維修
if (resourceManager.hasEnoughResource('materials', 3)) {
    // 執行維修邏輯
    repairRoom();
} else {
    console.log('建材不足，無法維修');
}
```

#### `hasEnoughResources(requirements)`
檢查多種資源是否都足夠。

**使用範例：**
```javascript
// 檢查技能使用成本
const skillCost = { medical: 3, cash: 12 };
if (resourceManager.hasEnoughResources(skillCost)) {
    // 扣除成本並執行技能
    resourceManager.bulkModifyResources({
        changes: { medical: -3, cash: -12 },
        reason: '醫生治療感染技能',
        source: 'skill_usage'
    });
    executeHealingSkill();
}
```

### 資源轉移類 API

#### `transferResource(from, to, resources, reason)`
在房東和租客之間轉移資源。

**參數：**
- `from` (string): 來源，'landlord' 或租客名稱
- `to` (string): 目標，'landlord' 或租客名稱  
- `resources` (Partial<Resources>): 要轉移的資源對應表
- `reason` (string): 轉移原因

**事件觸發：** `resource_transfer_completed`

**使用範例：**
```javascript
// 租客用個人資源抵付房租
resourceManager.transferResource(
    '張醫生',           // 從租客
    'landlord',        // 轉移給房東
    { food: 8, medical: 2 },  // 轉移的資源
    '房租抵付'         // 轉移原因
);

// 房東提供物資給租客
resourceManager.transferResource(
    'landlord',
    '李工人',
    { materials: 5 },
    '維修任務物資提供'
);
```

### 院子採集類 API

#### `harvestYard()`
執行院子採集，獲取食物。

**返回值：** `boolean` - 採集是否成功  
**事件觸發：** `harvest_completed`, `harvest_result`

**使用範例：**
```javascript
// 執行院子採集
if (resourceManager.harvestYard()) {
    console.log('院子採集成功');
} else {
    console.log('採集失敗，可能是冷卻中或今日已使用');
}
```

#### `canHarvest()`
檢查是否可以進行院子採集。

**使用範例：**
```javascript
// 檢查採集條件
if (resourceManager.canHarvest()) {
    // 顯示採集按鈕為可用狀態
    enableHarvestButton();
} else {
    // 顯示冷卻提示
    const status = resourceManager.getHarvestStatus();
    showCooldownMessage(status.cooldownRemaining);
}
```

#### `getHarvestStatus()`
取得詳細的採集狀態資訊。

**返回物件：**
```javascript
{
    canHarvest: boolean,        // 是否可以採集
    usedToday: boolean,         // 今日是否已使用
    cooldownRemaining: number,  // 剩餘冷卻天數
    cooldownDays: number,       // 總冷卻天數
    baseAmount: number          // 基礎採集量
}
```

### 狀態查詢類 API

#### `getResourceStatus(resourceType)`
取得特定資源的詳細狀態評估。

**返回物件：**
```javascript
{
    resourceType: string,
    currentValue: number,
    level: 'abundant' | 'normal' | 'warning' | 'critical' | 'emergency',
    daysRemaining: number,
    recommendations: string[]
}
```

**使用範例：**
```javascript
// 檢查食物狀態
const foodStatus = resourceManager.getResourceStatus('food');
if (foodStatus.level === 'critical') {
    console.warn(`食物危急！剩餘 ${foodStatus.daysRemaining} 天`);
    foodStatus.recommendations.forEach(rec => console.log(rec));
}
```

#### `getResourceValue(resourceType, amount)`
計算資源的市場價值。

**使用範例：**
```javascript
// 計算交易價值
const foodValue = resourceManager.getResourceValue('food', 10);
const materialValue = resourceManager.getResourceValue('materials', 3);
console.log(`10食物價值：${foodValue}，3建材價值：${materialValue}`);
```

---

## 🔗 典型使用場景與範例

### 場景1：租金收取系統整合

```javascript
// TradeManager 中的租金收取邏輯
class TradeManager {
    collectRent(tenant, room) {
        const rentAmount = tenant.rent;
        const bonusMultiplier = room.reinforced ? 1.2 : 1.0;
        const finalRent = Math.floor(rentAmount * bonusMultiplier);
        
        // 優先使用現金支付
        if (resourceManager.hasEnoughResource('cash', finalRent)) {
            return resourceManager.modifyResource(
                'cash', 
                finalRent, 
                `${tenant.name}房租收入`,
                'rent_collection'
            );
        }
        
        // 現金不足，使用資源抵付
        return this.handleResourcePayment(tenant, finalRent);
    }
    
    handleResourcePayment(tenant, rentAmount) {
        const personalResources = tenant.personalResources || {};
        const resourceValues = {
            food: 1.5, materials: 3.0, medical: 4.0, fuel: 3.0
        };
        
        let remainingDebt = rentAmount;
        const payment = {};
        
        // 計算可抵付的資源
        for (const [type, value] of Object.entries(resourceValues)) {
            const available = personalResources[type] || 0;
            const maxCanPay = Math.floor(available * value);
            
            if (maxCanPay > 0 && remainingDebt > 0) {
                const actualPayment = Math.min(maxCanPay, remainingDebt);
                const resourceAmount = Math.floor(actualPayment / value);
                
                payment[type] = resourceAmount;
                remainingDebt -= actualPayment;
            }
        }
        
        // 執行資源轉移
        if (Object.keys(payment).length > 0) {
            return resourceManager.transferResource(
                tenant.name,
                'landlord',
                payment,
                `${tenant.name}資源抵付房租`
            );
        }
        
        return false;
    }
}
```

### 場景2：技能系統整合

```javascript
// SkillManager 中的技能執行邏輯
class SkillManager {
    executeSkill(skillId, tenantType) {
        const skill = this.getSkill(skillId, tenantType);
        if (!skill) return false;
        
        // 檢查技能成本
        if (skill.cost && !resourceManager.hasEnoughResources(skill.cost)) {
            console.warn(`技能 ${skill.name} 資源不足`);
            return false;
        }
        
        // 扣除技能成本
        if (skill.cost) {
            const costEntries = Object.entries(skill.cost);
            const changes = {};
            costEntries.forEach(([type, amount]) => {
                changes[type] = -amount;
            });
            
            resourceManager.bulkModifyResources({
                changes,
                reason: `${skill.name}技能成本`,
                source: 'skill_usage'
            });
        }
        
        // 執行技能效果
        return this.applySkillEffects(skill);
    }
    
    applySkillEffects(skill) {
        skill.effects.forEach(effect => {
            switch (effect.type) {
                case 'modifyResource':
                    resourceManager.modifyResource(
                        effect.resource,
                        effect.amount,
                        `${skill.name}技能效果`,
                        'skill_effect'
                    );
                    break;
                // 其他效果處理...
            }
        });
        
        return true;
    }
}
```

### 場景3：每日循環整合

```javascript
// main.js 中的每日循環處理
class GameApplication {
    processDailyConsumption() {
        const tenants = this.gameState.getAllTenants();
        const landlordHunger = this.gameState.getStateValue('landlord.hunger', 0);
        
        // 計算每日消費
        const dailyConsumption = {
            food: -(2 + tenants.length * 2),  // 房東2 + 租客每人2
            fuel: -1                          // 固定燃料消耗
        };
        
        // 執行每日消費
        const success = resourceManager.bulkModifyResources({
            changes: dailyConsumption,
            reason: '每日基本消費',
            source: 'daily_cycle'
        });
        
        if (!success) {
            this.handleResourceShortage();
        }
        
        // 檢查飢餓狀態
        const currentFood = this.gameState.getStateValue('resources.food', 0);
        if (currentFood < 2) {
            this.increaseLandlordHunger();
        }
    }
    
    handleResourceShortage() {
        // 檢查哪些資源不足
        const foodStatus = resourceManager.getResourceStatus('food');
        const fuelStatus = resourceManager.getResourceStatus('fuel');
        
        if (foodStatus.level === 'critical') {
            this.gameState.addLog('食物嚴重不足！', 'danger');
        }
        
        if (fuelStatus.level === 'critical') {
            this.gameState.addLog('燃料即將耗盡！', 'danger');
        }
    }
}
```

### 場景4：事件系統整合

```javascript
// 監聽ResourceManager事件
class GameApplication {
    setupResourceManagerListeners() {
        // 監聽資源警告
        this.eventBus.on('resource_threshold_warning', (eventObj) => {
            const { resourceType, currentValue, warningLevel } = eventObj.data;
            
            this.gameState.addLog(
                `⚠️ ${resourceType}${warningLevel === 'critical' ? '危急' : '不足'}：剩餘${currentValue}`,
                'danger'
            );
            
            // 更新UI警告指示器
            this.updateResourceWarningUI(resourceType, warningLevel);
        });
        
        // 監聽院子採集完成
        this.eventBus.on('harvest_completed', (eventObj) => {
            const { finalAmount } = eventObj.data;
            this.gameState.addLog(`🌱 院子採集獲得 ${finalAmount} 食物`, 'event');
        });
        
        // 監聽資源轉移
        this.eventBus.on('resource_transfer_completed', (eventObj) => {
            const { from, to, resources } = eventObj.data;
            const resourceList = Object.entries(resources)
                .map(([type, amount]) => `${amount}${type}`)
                .join(', ');
            
            this.gameState.addLog(
                `💰 資源轉移：${from} → ${to} (${resourceList})`,
                'rent'
            );
        });
    }
}
```

---

## 🛠️ 錯誤處理與除錯指南

### 常見錯誤處理模式

```javascript
// 安全的資源操作模式
function safeResourceOperation(operation) {
    try {
        // 檢查ResourceManager狀態
        if (!resourceManager.isActive) {
            console.warn('ResourceManager未啟用');
            return { success: false, error: 'ResourceManager inactive' };
        }
        
        // 執行操作
        const result = operation();
        
        return { success: true, result };
    } catch (error) {
        console.error('資源操作失敗:', error);
        return { success: false, error: error.message };
    }
}

// 使用範例
const result = safeResourceOperation(() => {
    return resourceManager.modifyResource('food', 10, '測試');
});

if (!result.success) {
    console.error('操作失敗:', result.error);
}
```

### 除錯工具使用

```javascript
// 1. 檢查ResourceManager狀態
console.log('ResourceManager狀態:', resourceManager.getStatus());

// 2. 查看資源修改歷史
const history = resourceManager.getModificationHistory(10);
console.table(history);

// 3. 查看資源轉移歷史  
const transfers = resourceManager.getTransferHistory(5);
console.table(transfers);

// 4. 檢查特定資源狀態
const foodStatus = resourceManager.getResourceStatus('food');
console.log('食物狀態:', foodStatus);

// 5. 分析資源稀缺性
const scarcity = resourceManager.analyzeResourceScarcity('materials');
console.log('建材稀缺性分析:', scarcity);

// 6. 檢查採集狀態
const harvestStatus = resourceManager.getHarvestStatus();
console.log('採集狀態:', harvestStatus);
```

### 常見問題診斷

#### 問題1：modifyResource返回false
**可能原因：**
- ResourceManager未初始化 (`!isActive`)
- 無效的資源類型
- 無效的數量值 (NaN, Infinity)
- GameState.setStateValue失敗

**診斷方法：**
```javascript
// 檢查初始化狀態
console.log('isActive:', resourceManager.isActive);

// 檢查參數有效性
console.log('資源類型有效:', ['food','materials','medical','fuel','cash'].includes(resourceType));
console.log('數量有效:', typeof amount === 'number' && !isNaN(amount));

// 檢查GameState狀態
console.log('GameState可用:', gameState && typeof gameState.setStateValue === 'function');
```

#### 問題2：院子採集無法執行
**診斷步驟：**
```javascript
// 1. 檢查採集條件
const canHarvest = resourceManager.canHarvest();
console.log('可以採集:', canHarvest);

// 2. 檢查詳細狀態
const status = resourceManager.getHarvestStatus();
console.log('採集狀態:', status);

// 3. 檢查遊戲狀態
const harvestUsed = gameState.getStateValue('dailyActions.harvestUsed', false);
const cooldown = gameState.getStateValue('dailyActions.harvestCooldown', 0);
console.log('今日已用:', harvestUsed, '冷卻剩餘:', cooldown);
```

#### 問題3：事件沒有正確觸發
**檢查事件監聽：**
```javascript
// 檢查EventBus狀態
console.log('EventBus統計:', eventBus.getStats());

// 檢查特定事件監聽器
const listeners = eventBus.getListenedEvents();
console.log('已監聽事件:', listeners);

// 手動測試事件發送
eventBus.emit('test_event', { test: true });
```

---

## ⚡ 效能最佳化建議

### 1. 批量操作優化

```javascript
// ❌ 避免：多次單一操作
resourceManager.modifyResource('food', -2, '房東用餐');
resourceManager.modifyResource('fuel', -1, '燃料消耗');
resourceManager.modifyResource('cash', 15, '租金收入');

// ✅ 推薦：使用批量操作
resourceManager.bulkModifyResources({
    changes: { food: -2, fuel: -1, cash: 15 },
    reason: '每日循環處理',
    source: 'daily_cycle'
});
```

### 2. 條件檢查最佳化

```javascript
// ❌ 避免：重複檢查
if (resourceManager.hasEnoughResource('food', 2)) {
    if (resourceManager.hasEnoughResource('materials', 3)) {
        // 執行操作
    }
}

// ✅ 推薦：批量檢查
const requirements = { food: 2, materials: 3 };
if (resourceManager.hasEnoughResources(requirements)) {
    // 執行操作
}
```

### 3. 事件監聽最佳化

```javascript
// ✅ 使用一次性監聽器（適用於單次處理）
eventBus.once('resource_transfer_completed', handleTransfer);

// ✅ 移除不需要的監聽器
const unsubscribe = eventBus.on('resource_modified', handler);
// 在不需要時調用
unsubscribe();
```

### 4. 記憶體使用最佳化

```javascript
// ResourceManager已內建記憶體保護機制
// 修改歷史和轉移歷史自動限制在100條以內
// 手動清理（如果需要）
if (resourceManager.getModificationHistory().length > 50) {
    // ResourceManager會自動清理，通常不需要手動干預
    console.log('歷史記錄自動管理中...');
}
```

---

## 🔧 常見問題與解決方案

### Q1: ResourceManager初始化失敗
**症狀：** 調用方法時返回false或拋出錯誤  
**解決方案：**
```javascript
// 確保正確的初始化順序
const gameState = new GameState(initialData);
const eventBus = new EventBus();
const resourceManager = new ResourceManager(gameState, eventBus);

// 檢查初始化狀態
const status = resourceManager.getStatus();
console.log('初始化狀態:', status.initialized);
```

### Q2: 資源修改沒有反映到UI
**症狀：** modifyResource返回true但UI沒有更新  
**解決方案：**
```javascript
// 確保監聽GameState的狀態變更事件
gameState.subscribe('state_changed', (data) => {
    if (data.updates.resources) {
        updateResourceUI(data.updates.resources);
    }
});

// 或監聽ResourceManager的專屬事件
eventBus.on('resource_modified', (eventObj) => {
    const { resourceType, newValue } = eventObj.data;
    updateSpecificResourceUI(resourceType, newValue);
});
```

### Q3: 院子採集冷卻時間不正確
**症狀：** 採集後冷卻時間沒有正確設定  
**解決方案：**
```javascript
// 檢查規則配置是否正確載入
const rules = gameState.getStateValue('system.gameRules');
const harvestConfig = rules?.mechanics?.harvest;
console.log('採集配置:', harvestConfig);

// 手動重置採集狀態（除錯用）
gameState.setStateValue('dailyActions.harvestUsed', false, 'debug_reset');
gameState.setStateValue('dailyActions.harvestCooldown', 0, 'debug_reset');
```

### Q4: 資源轉移失敗
**症狀：** transferResource返回false  
**診斷：**
```javascript
// 檢查來源資源是否足夠
const tenant = gameState.getAllTenants().find(t => t.name === '張醫生');
console.log('租客資源:', tenant?.personalResources);

// 檢查轉移參數
const isValidTransfer = (from, to, resources) => {
    console.log('轉移參數:', { from, to, resources });
    
    // 檢查參數有效性
    if (!from || !to) return false;
    if (!resources || Object.keys(resources).length === 0) return false;
    
    return true;
};
```

### Q5: 閾值警告沒有觸發
**症狀：** 資源低於閾值但沒有收到警告事件  
**檢查：**
```javascript
// 檢查閾值配置
const thresholds = resourceManager.thresholds;
console.log('閾值配置:', Object.fromEntries(thresholds));

// 手動觸發閾值檢查
resourceManager._checkAllResourceThresholds();

// 檢查事件監聽器
eventBus.debug(); // 顯示所有監聽器
```

---

## 📖 參考附錄

### ResourceType聯合型別
```typescript
type ResourceType = 'food' | 'materials' | 'medical' | 'fuel' | 'cash';
```

### 資源價值配置（預設）
```javascript
{
    food: 1.5,      // 食物
    materials: 3.0, // 建材  
    medical: 4.0,   // 醫療用品
    fuel: 3.0,      // 燃料
    cash: 1.0       // 現金（基準）
}
```

### 事件類型參考
```javascript
// ResourceManager觸發的事件
'resource_modified'           // 資源修改完成
'resource_bulk_modified'      // 批量修改完成  
'resource_threshold_warning'  // 閾值警告
'resource_critical_low'       // 資源危急
'resource_transfer_completed' // 轉移完成
'harvest_completed'          // 採集完成（業務級事件）
'harvest_result'             // 採集結果（業務級事件）
```

### 整合檢查清單
- [ ] ResourceManager正確初始化
- [ ] 事件監聽器已設定
- [ ] UI更新邏輯已綁定
- [ ] 錯誤處理已實作
- [ ] 除錯工具已配置
- [ ] 效能最佳化已應用

---

**開發指南版本：** v2.0  
**對應ResourceManager版本：** v2.0 (BaseManager繼承版)  
**維護者：** 末日房東模擬器開發團隊
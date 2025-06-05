# TenantManager v2.0 開發指南

## 📋 文檔概覽

本指南提供 TenantManager v2.0 的完整開發參考，包含 API 調用、整合範例、除錯指導和最佳實踐。適用於末日房東模擬器的單人開發場景。

**版本**：TenantManager v2.0 (BaseManager 繼承版)  
**更新日期**：2025年  
**相容性**：需要 GameState, EventBus, ResourceManager, TradeManager, BaseManager  

---

## 🚀 快速開始

### 基本初始化

```javascript
// 1. 引入必要模組
import TenantManager from './systems/TenantManager.js';
import GameState from './core/GameState.js';
import EventBus from './core/EventBus.js';
import ResourceManager from './systems/ResourceManager.js';
import TradeManager from './systems/TradeManager.js';

// 2. 建立實例（通常在 main.js 中）
const gameState = new GameState();
const eventBus = new EventBus();
const resourceManager = new ResourceManager(gameState, eventBus);
const tradeManager = new TradeManager(gameState, resourceManager, dataManager, eventBus);
const tenantManager = new TenantManager(gameState, resourceManager, tradeManager, dataManager, eventBus);

// 3. 初始化系統
await tenantManager.initialize();

// 4. 檢查初始化狀態
console.log('TenantManager 狀態:', tenantManager.getStatus());
```

### 基本租客操作

```javascript
// 生成申請者
const applicants = tenantManager.generateApplicants(3);
console.log('生成申請者:', applicants);

// 雇用租客
const hiringResult = await tenantManager.hireTenant(applicants[0]);
if (hiringResult.success) {
    console.log('雇用成功:', hiringResult.tenant.name);
}

// 更新滿意度
tenantManager.updateTenantSatisfaction();

// 派遣搜刮
const scavengeResult = await tenantManager.sendTenantScavenging('小明');
if (scavengeResult.success) {
    console.log('搜刮成功，獲得獎勵:', scavengeResult.rewards);
}
```

---

## 📚 核心API完整參考

### 租客雇用類 API

#### `hireTenant(applicant, targetRoomId)`
雇用租客的主要入口點，包含完整的驗證、面試、分配流程。

**參數：**
- `applicant` (Applicant): 申請者物件
- `targetRoomId` (number, 可選): 指定房間ID，不提供則自動分配

**返回值：** `Promise<HiringResult>` - 雇用結果

**事件觸發：** `tenant_tenantHired`

**使用範例：**
```javascript
// 自動分配房間
const result = await tenantManager.hireTenant(applicant);

// 指定房間
const result = await tenantManager.hireTenant(applicant, 2);

// 檢查結果
if (result.success) {
    console.log(`${result.tenant.name} 入住房間 ${result.roomId}`);
} else {
    console.log('雇用失敗:', result.error);
}
```

#### `validateHiring(applicant, targetRoomId)`
驗證雇用條件，檢查申請者有效性和房間可用性。

**返回值：** `ValidationResult` - 驗證結果

**使用範例：**
```javascript
const validation = tenantManager.validateHiring(applicant, roomId);
if (!validation.valid) {
    console.warn('雇用條件不符:', validation.error);
    console.log('建議:', validation.suggestion);
}
```

#### `conductInterview(applicant)`
進行面試評估，分析感染風險和適任性。

**返回值：** `InterviewResult` - 面試結果

**使用範例：**
```javascript
const interview = tenantManager.conductInterview(applicant);
console.log('面試結果:', interview.passed);
console.log('風險等級:', interview.riskLevel);
console.log('建議事項:', interview.recommendations);
```

#### `generateApplicants(count)`
生成隨機申請者列表。

**參數：**
- `count` (number, 可選): 生成數量，預設 1-3 個

**返回值：** `Applicant[]` - 申請者列表

**使用範例：**
```javascript
// 生成預設數量申請者
const applicants = tenantManager.generateApplicants();

// 生成指定數量申請者
const moreApplicants = tenantManager.generateApplicants(5);

// 檢視申請者資訊
applicants.forEach(applicant => {
    console.log(`${applicant.name} (${applicant.type}): ${applicant.appearance}`);
});
```

### 租客驅逐類 API

#### `evictTenant(tenantName, isInfected, reason)`
驅逐租客的主要入口點，處理資源清理和數據更新。

**參數：**
- `tenantName` (string): 租客姓名
- `isInfected` (boolean, 可選): 是否因感染驅逐，預設 false
- `reason` (string, 可選): 驅逐原因，預設 "正常退租"

**返回值：** `Promise<EvictionResult>` - 驅逐結果

**事件觸發：** `tenant_tenantEvicted`

**使用範例：**
```javascript
// 正常退租
const result = await tenantManager.evictTenant('小明');

// 感染驅逐
const result = await tenantManager.evictTenant('小華', true, '感染隔離');

// 檢查結果
if (result.success) {
    console.log('驅逐成功:', result.reason);
    if (result.refund > 0) {
        console.log('退還押金:', result.refund);
    }
    if (Object.keys(result.leftBehind).length > 0) {
        console.log('遺留物品:', result.leftBehind);
    }
}
```

#### `findTenantAndRoom(tenantName)`
尋找指定租客及其所在房間。

**返回值：** `{tenant: Tenant, room: Room}|null` - 租客和房間信息

**使用範例：**
```javascript
const tenantInfo = tenantManager.findTenantAndRoom('小明');
if (tenantInfo) {
    console.log(`${tenantInfo.tenant.name} 住在房間 ${tenantInfo.room.id}`);
}
```

#### `cleanupTenantData(tenantName)`
清理租客相關數據，包含滿意度、關係記錄。

**使用範例：**
```javascript
// 驅逐後自動調用，也可手動清理
tenantManager.cleanupTenantData('已離開的租客');
```

### 滿意度管理類 API

#### `updateTenantSatisfaction(tenantName)`
更新租客滿意度，重新計算所有影響因子。

**參數：**
- `tenantName` (string, 可選): 特定租客姓名，不提供則更新所有租客

**使用範例：**
```javascript
// 更新特定租客滿意度
tenantManager.updateTenantSatisfaction('小明');

// 更新所有租客滿意度
tenantManager.updateTenantSatisfaction();
```

#### `calculateSatisfaction(tenant, room)`
計算單一租客的滿意度值。

**返回值：** `number` - 滿意度值 (0-100)

**使用範例：**
```javascript
const tenantInfo = tenantManager.findTenantAndRoom('小明');
if (tenantInfo) {
    const satisfaction = tenantManager.calculateSatisfaction(
        tenantInfo.tenant, 
        tenantInfo.room
    );
    console.log(`${tenantInfo.tenant.name} 滿意度: ${satisfaction}`);
}
```

#### `getSatisfactionStatus(satisfaction)`
取得滿意度狀態詳細資訊。

**返回值：** `SatisfactionStatus` - 滿意度狀態物件

**使用範例：**
```javascript
const satisfaction = 75;
const status = tenantManager.getSatisfactionStatus(satisfaction);
console.log(`滿意度等級: ${status.level} ${status.emoji}`);
console.log(`狀態描述: ${status.description}`);
```

#### `getAllSatisfaction()`
取得所有租客的滿意度對應表。

**返回值：** `Map<string, number>` - 租客滿意度映射

**使用範例：**
```javascript
const allSatisfaction = tenantManager.getAllSatisfaction();
allSatisfaction.forEach((satisfaction, tenantName) => {
    const status = tenantManager.getSatisfactionStatus(satisfaction);
    console.log(`${tenantName}: ${satisfaction} (${status.level})`);
});
```

#### `getSatisfactionHistory(limit)`
取得滿意度變更歷史記錄。

**參數：**
- `limit` (number, 可選): 返回記錄數量限制，預設 20

**返回值：** `SatisfactionHistory[]` - 滿意度歷史記錄

**使用範例：**
```javascript
const history = tenantManager.getSatisfactionHistory(10);
history.forEach(record => {
    console.log(`第${record.day}天: ${record.tenantName} ${record.oldValue}→${record.newValue} (${record.reason})`);
});
```

### 搜刮派遣類 API

#### `sendTenantScavenging(tenantName)`
派遣租客進行搜刮任務。

**參數：**
- `tenantName` (string): 租客姓名

**返回值：** `Promise<ScavengeResult>` - 搜刮結果

**事件觸發：** `scavenge_started`, `scavenge_completed`, `scavenge_result`

**使用範例：**
```javascript
const result = await tenantManager.sendTenantScavenging('小明');
if (result.success) {
    console.log('搜刮成功!');
    console.log('獲得獎勵:', result.rewards);
} else {
    console.log('搜刮失敗:', result.error);
    if (result.remainingAttempts !== undefined) {
        console.log('剩餘次數:', result.remainingAttempts);
    }
}
```

#### `getAvailableScavengers()`
取得可執行搜刮任務的租客列表。

**返回值：** `Tenant[]` - 可派遣租客列表

**使用範例：**
```javascript
const scavengers = tenantManager.getAvailableScavengers();
if (scavengers.length > 0) {
    console.log('可派遣人員:');
    scavengers.forEach(tenant => {
        const successRate = tenantManager.calculateScavengeSuccessRate(tenant);
        console.log(`${tenant.name} (${tenant.type}): ${successRate}% 成功率`);
    });
} else {
    console.log('目前沒有可派遣的人員');
}
```

#### `canScavenge()`
檢查是否可以進行搜刮任務。

**返回值：** `ScavengeAvailability` - 搜刮可用性資訊

**使用範例：**
```javascript
const availability = tenantManager.canScavenge();
if (availability.canScavenge) {
    console.log(`可以搜刮，剩餘次數: ${availability.remaining}`);
} else {
    console.log('無法搜刮:', availability.reason);
}
```

#### `calculateScavengeSuccessRate(tenant)`
計算租客的搜刮成功率。

**返回值：** `number` - 成功率百分比 (0-100)

**使用範例：**
```javascript
const tenant = gameState.getAllTenants()[0];
const successRate = tenantManager.calculateScavengeSuccessRate(tenant);
console.log(`${tenant.name} 的搜刮成功率: ${successRate}%`);
```

#### `getScavengeStatus()`
取得搜刮系統完整狀態資訊。

**返回值：** `ScavengeStatus` - 搜刮狀態物件

**使用範例：**
```javascript
const status = tenantManager.getScavengeStatus();
console.log('搜刮狀態:', {
    可以搜刮: status.canScavenge,
    剩餘次數: status.remainingAttempts,
    可用人員: status.availableScavengers,
    人員清單: status.scavengerList
});
```

### 關係與衝突管理類 API

#### `checkConflictTriggers()`
檢查並觸發租客間衝突事件。

**事件觸發：** `tenant_conflictTriggered`

**使用範例：**
```javascript
// 每日自動調用，也可手動檢查
tenantManager.checkConflictTriggers();

// 監聽衝突事件
eventBus.on('tenant_conflictTriggered', (eventObj) => {
    const conflict = eventObj.data;
    console.log('發生衝突:', conflict.description);
    console.log('涉及租客:', conflict.involvedTenants);
});
```

#### `resolveConflict(conflictId, resolution)`
解決指定的衝突事件。

**參數：**
- `conflictId` (string): 衝突ID
- `resolution` (string): 解決方案描述

**返回值：** `boolean` - 解決是否成功

**事件觸發：** `tenant_conflictResolved`

**使用範例：**
```javascript
const success = tenantManager.resolveConflict('conflict_123', '增加共用資源');
if (success) {
    console.log('衝突已成功解決');
}
```

#### `getTenantRelationships()`
取得所有租客間的關係記錄。

**返回值：** `TenantRelationship[]` - 租客關係列表

**使用範例：**
```javascript
const relationships = tenantManager.getTenantRelationships();
relationships.forEach(rel => {
    console.log(`${rel.tenant1} ↔ ${rel.tenant2}: ${rel.relationship}/100`);
});
```

#### `getConflictHistory(limit)`
取得衝突事件歷史記錄。

**參數：**
- `limit` (number, 可選): 返回記錄數量限制，預設 10

**返回值：** `ConflictEvent[]` - 衝突事件歷史

**使用範例：**
```javascript
const conflicts = tenantManager.getConflictHistory(5);
conflicts.forEach(conflict => {
    console.log(`${conflict.type}: ${conflict.description} (${conflict.resolved ? '已解決' : '未解決'})`);
});
```

### 統計與狀態查詢類 API

#### `getTenantStats()`
取得完整的租客統計資料。

**返回值：** `TenantStats` - 租客統計物件

**使用範例：**
```javascript
const stats = tenantManager.getTenantStats();
console.log('租客統計:', {
    總租客數: stats.totalTenants,
    健康租客: stats.healthyTenants,
    感染租客: stats.infectedTenants,
    平均滿意度: stats.averageSatisfaction,
    總租金收入: stats.totalRentIncome,
    職業分布: stats.typeDistribution
});
```

#### `getStatus()`
取得 TenantManager 系統狀態（繼承自 BaseManager）。

**返回值：** `TenantManagerStatus` - 系統狀態物件

**使用範例：**
```javascript
const status = tenantManager.getStatus();
console.log('系統狀態:', {
    已初始化: status.initialized,
    配置已載入: status.configLoaded,
    活躍衝突: status.activeConflicts,
    當前申請者: status.currentApplicants,
    驗證器可用: status.validatorAvailable
});
```

---

## 🔗 典型使用場景與範例

### 場景1：完整租客雇用流程

```javascript
// GameApplication 中的租客雇用整合
class GameApplication {
    async handleTenantHiring() {
        try {
            // 1. 生成申請者
            const applicants = this.tenantManager.generateApplicants(3);
            console.log('今日申請者:', applicants.length);
            
            // 2. 顯示申請者給玩家選擇
            const selectedApplicant = await this.showApplicantSelection(applicants);
            
            // 3. 進行面試評估
            const interview = this.tenantManager.conductInterview(selectedApplicant);
            if (!interview.passed) {
                this.gameState.addLog(`${selectedApplicant.name} 面試未通過: ${interview.reason}`, 'event');
                return false;
            }
            
            // 4. 執行雇用
            const result = await this.tenantManager.hireTenant(selectedApplicant);
            
            if (result.success) {
                this.gameState.addLog(`歡迎新租客 ${result.tenant.name} 入住!`, 'rent');
                
                // 5. 更新UI顯示
                this.updateTenantListUI();
                this.updateRoomDisplayUI();
                
                return true;
            } else {
                this.gameState.addLog(`雇用失敗: ${result.error}`, 'danger');
                return false;
            }
            
        } catch (error) {
            console.error('租客雇用流程失敗:', error);
            this.gameState.addLog('租客雇用過程發生錯誤', 'danger');
            return false;
        }
    }
    
    async showApplicantSelection(applicants) {
        // UI邏輯：顯示申請者列表讓玩家選擇
        return new Promise(resolve => {
            const modal = this.createApplicantModal(applicants);
            modal.onSelection = resolve;
            modal.show();
        });
    }
}
```

### 場景2：滿意度系統整合

```javascript
// 滿意度監控和管理系統
class SatisfactionMonitor {
    constructor(tenantManager, gameState, eventBus) {
        this.tenantManager = tenantManager;
        this.gameState = gameState;
        this.eventBus = eventBus;
        
        this.setupSatisfactionListeners();
    }
    
    setupSatisfactionListeners() {
        // 監聽滿意度警告
        this.eventBus.on('tenant_satisfactionCritical', (eventObj) => {
            const { tenantName, satisfaction } = eventObj.data;
            this.handleCriticalSatisfaction(tenantName, satisfaction);
        });
        
        // 監聽每日滿意度報告
        this.eventBus.on('tenant_dailySatisfactionReport', (eventObj) => {
            const { averageSatisfaction, satisfactionDistribution } = eventObj.data;
            this.updateSatisfactionUI(averageSatisfaction, satisfactionDistribution);
        });
        
        // 監聽建築改善（影響滿意度）
        this.eventBus.on('building_upgraded', () => {
            this.tenantManager.updateTenantSatisfaction();
        });
    }
    
    handleCriticalSatisfaction(tenantName, satisfaction) {
        console.warn(`⚠️ ${tenantName} 滿意度危急 (${satisfaction})`);
        
        // 提供改善建議
        const suggestions = this.generateImprovementSuggestions(tenantName);
        this.showSatisfactionAlert(tenantName, satisfaction, suggestions);
        
        // 檢查是否需要緊急措施
        if (satisfaction < 20) {
            this.triggerEmergencyMeasures(tenantName);
        }
    }
    
    generateImprovementSuggestions(tenantName) {
        const suggestions = [];
        
        // 檢查房間狀況
        const tenantInfo = this.tenantManager.findTenantAndRoom(tenantName);
        if (tenantInfo && tenantInfo.room.needsRepair) {
            suggestions.push('維修房間可大幅提升滿意度');
        }
        
        if (tenantInfo && !tenantInfo.room.reinforced) {
            suggestions.push('加固房間可提升安全感');
        }
        
        // 檢查全局狀況
        const buildingDefense = this.gameState.getStateValue('building.defense', 0);
        if (buildingDefense < 3) {
            suggestions.push('提升建築整體防禦力');
        }
        
        // 檢查個人資源
        if (tenantInfo?.tenant.personalResources?.food < 2) {
            suggestions.push('租客個人食物不足，考慮資源援助');
        }
        
        return suggestions;
    }
    
    async triggerEmergencyMeasures(tenantName) {
        // 緊急提升滿意度的措施
        const measures = [
            {
                name: '提供額外食物',
                cost: { food: 3 },
                effect: () => this.provideFoodAssistance(tenantName)
            },
            {
                name: '減免部分房租',
                cost: { cash: -10 },
                effect: () => this.provideRentDiscount(tenantName)
            },
            {
                name: '立即維修房間',
                cost: { materials: 3 },
                effect: () => this.emergencyRoomRepair(tenantName)
            }
        ];
        
        // 選擇可行的措施
        for (const measure of measures) {
            if (this.canAffordMeasure(measure.cost)) {
                await measure.effect();
                this.gameState.addLog(`緊急措施: ${measure.name}`, 'event');
                break;
            }
        }
    }
}
```

### 場景3：搜刮派遣整合

```javascript
// SkillManager 中的搜刮技能整合
class SkillManager {
    async executeScavengeSkill(skillId, tenantName) {
        try {
            // 檢查搜刮可用性
            const availability = this.tenantManager.canScavenge();
            if (!availability.canScavenge) {
                return {
                    success: false,
                    error: availability.reason
                };
            }
            
            // 檢查租客是否可用
            const availableScavengers = this.tenantManager.getAvailableScavengers();
            const tenant = availableScavengers.find(t => t.name === tenantName);
            
            if (!tenant) {
                return {
                    success: false,
                    error: '指定租客無法執行搜刮任務'
                };
            }
            
            // 技能加成計算
            const baseSuccessRate = this.tenantManager.calculateScavengeSuccessRate(tenant);
            let enhancedSuccessRate = baseSuccessRate;
            
            // 軍人的戰術技能可提升搜刮成功率
            if (skillId === 'tactical_scavenging' && tenant.type === 'soldier') {
                enhancedSuccessRate = Math.min(95, baseSuccessRate + 20);
            }
            
            // 農夫的野外生存技能
            if (skillId === 'wilderness_survival' && tenant.type === 'farmer') {
                enhancedSuccessRate = Math.min(90, baseSuccessRate + 15);
            }
            
            // 執行搜刮
            const scavengeResult = await this.tenantManager.sendTenantScavenging(tenantName);
            
            // 技能額外獎勵
            if (scavengeResult.success && enhancedSuccessRate > baseSuccessRate) {
                this.applySkillBonus(scavengeResult, skillId);
            }
            
            return scavengeResult;
            
        } catch (error) {
            console.error('搜刮技能執行失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    applySkillBonus(scavengeResult, skillId) {
        // 技能額外獎勵
        const bonusRewards = {};
        
        switch (skillId) {
            case 'tactical_scavenging':
                // 軍人戰術搜刮：額外建材
                bonusRewards.materials = Math.floor(Math.random() * 3) + 1;
                break;
                
            case 'wilderness_survival':
                // 農夫野外生存：額外食物
                bonusRewards.food = Math.floor(Math.random() * 4) + 2;
                break;
        }
        
        // 將獎勵添加到結果中
        Object.entries(bonusRewards).forEach(([resourceType, amount]) => {
            scavengeResult.rewards[resourceType] = (scavengeResult.rewards[resourceType] || 0) + amount;
            this.resourceManager.modifyResource(resourceType, amount, `${skillId}_bonus`);
        });
        
        this.gameState.addLog('技能熟練度帶來額外收穫!', 'skill');
    }
}
```

### 場景4：事件系統整合

```javascript
// EventManager 中的租客相關事件處理
class EventManager {
    setupTenantEventListeners() {
        // 監聽租客雇用
        this.eventBus.on('tenant_tenantHired', (eventObj) => {
            const { tenant, room } = eventObj.data;
            
            // 觸發歡迎事件
            this.triggerWelcomeEvent(tenant);
            
            // 檢查是否觸發特殊事件
            this.checkNewTenantEvents(tenant, room);
        });
        
        // 監聽租客驅逐
        this.eventBus.on('tenant_tenantEvicted', (eventObj) => {
            const { tenant, reason, isInfected } = eventObj.data;
            
            if (isInfected) {
                this.triggerInfectionSpreadEvent();
            } else {
                this.triggerFarewellEvent(tenant);
            }
        });
        
        // 監聽滿意度危機
        this.eventBus.on('tenant_satisfactionCritical', (eventObj) => {
            const { tenantName, satisfaction } = eventObj.data;
            this.triggerSatisfactionCrisisEvent(tenantName, satisfaction);
        });
        
        // 監聽衝突事件
        this.eventBus.on('tenant_conflictTriggered', (eventObj) => {
            const conflict = eventObj.data;
            this.createConflictResolutionEvent(conflict);
        });
        
        // 監聽搜刮事件
        this.eventBus.on('scavenge_completed', (eventObj) => {
            const { tenant, result } = eventObj.data;
            
            if (!result.success && Math.random() < 0.1) {
                this.triggerScavengeAccidentEvent(tenant);
            }
        });
    }
    
    triggerWelcomeEvent(tenant) {
        const welcomeEvent = {
            id: 'welcome_new_tenant',
            title: '新租客入住',
            description: `${tenant.name} 正式入住，其他租客前來歡迎`,
            choices: [
                {
                    text: '舉辦歡迎會 (-3食物)',
                    condition: () => this.resourceManager.hasEnoughResource('food', 3),
                    effect: () => {
                        this.resourceManager.modifyResource('food', -3, 'welcome_party');
                        this.tenantManager.updateTenantSatisfaction(); // 全體滿意度+5
                        this.gameState.addLog('歡迎會讓大家關係更融洽', 'event');
                    }
                },
                {
                    text: '簡單介紹即可',
                    effect: () => {
                        this.gameState.addLog(`${tenant.name} 與其他租客互相認識`, 'event');
                    }
                }
            ]
        };
        
        this.showEventModal(welcomeEvent);
    }
    
    createConflictResolutionEvent(conflict) {
        const resolutionEvent = {
            id: `resolve_${conflict.id}`,
            title: '租客衝突處理',
            description: conflict.description,
            choices: []
        };
        
        // 基本解決方案
        resolutionEvent.choices.push({
            text: '調解對話 ($5)',
            condition: () => this.resourceManager.hasEnoughResource('cash', 5),
            effect: () => {
                this.resourceManager.modifyResource('cash', -5, 'mediation_fee');
                this.tenantManager.resolveConflict(conflict.id, '房東調解');
            }
        });
        
        // 長者調解（如果有長者租客）
        const elderTenants = this.gameState.getAllTenants().filter(t => t.type === 'elder');
        if (elderTenants.length > 0) {
            resolutionEvent.choices.push({
                text: `請 ${elderTenants[0].name} 調解`,
                effect: () => {
                    this.tenantManager.resolveConflict(conflict.id, '長者智慧調解');
                    // 長者滿意度+10
                    const currentSatisfaction = this.tenantManager.tenantSatisfaction.get(elderTenants[0].name) || 50;
                    this.tenantManager.tenantSatisfaction.set(elderTenants[0].name, Math.min(100, currentSatisfaction + 10));
                }
            });
        }
        
        // 資源解決方案（如果是資源衝突）
        if (conflict.type === 'resource_scarcity') {
            resolutionEvent.choices.push({
                text: '增加共用資源 (-6食物, -3燃料)',
                condition: () => this.resourceManager.hasEnoughResource('food', 6) && 
                             this.resourceManager.hasEnoughResource('fuel', 3),
                effect: () => {
                    this.resourceManager.bulkModifyResources({
                        changes: { food: -6, fuel: -3 },
                        reason: '解決資源衝突'
                    });
                    this.tenantManager.resolveConflict(conflict.id, '增加共用資源');
                }
            });
        }
        
        this.showEventModal(resolutionEvent);
    }
}
```

---

## 🛠️ 錯誤處理與除錯指南

### 常見錯誤處理模式

```javascript
// 安全的租客操作模式
function safeTenantOperation(operation) {
    try {
        // 檢查 TenantManager 狀態
        if (!tenantManager.initialized) {
            console.warn('TenantManager 未初始化');
            return { success: false, error: 'TenantManager not initialized' };
        }
        
        // 執行操作
        const result = operation();
        
        return { success: true, result };
    } catch (error) {
        console.error('租客操作失敗:', error);
        return { success: false, error: error.message };
    }
}

// 使用範例
const result = safeTenantOperation(() => {
    return tenantManager.hireTenant(applicant);
});

if (!result.success) {
    console.error('操作失敗:', result.error);
}
```

### 除錯工具使用

```javascript
// 1. 檢查 TenantManager 狀態
console.log('TenantManager 狀態:', tenantManager.getStatus());

// 2. 查看租客統計
const stats = tenantManager.getTenantStats();
console.table(stats);

// 3. 查看滿意度狀況
const satisfaction = tenantManager.getAllSatisfaction();
console.log('滿意度分布:');
satisfaction.forEach((value, name) => {
    const status = tenantManager.getSatisfactionStatus(value);
    console.log(`${name}: ${value} (${status.level} ${status.emoji})`);
});

// 4. 檢查衝突歷史
const conflicts = tenantManager.getConflictHistory(5);
console.table(conflicts);

// 5. 查看搜刮狀態
const scavengeStatus = tenantManager.getScavengeStatus();
console.log('搜刮狀態:', scavengeStatus);

// 6. 檢查租客關係
const relationships = tenantManager.getTenantRelationships();
console.log('租客關係:');
relationships.forEach(rel => {
    console.log(`${rel.tenant1} ↔ ${rel.tenant2}: ${rel.relationship}/100`);
});
```

### 常見問題診斷

#### 問題1：hireTenant 返回 false
**可能原因：**
- TenantManager 未初始化 (`!initialized`)
- 無效的申請者資料
- 沒有可用房間
- 驗證器檢查失敗

**診斷方法：**
```javascript
// 檢查初始化狀態
console.log('初始化狀態:', tenantManager.initialized);

// 檢查申請者有效性
console.log('申請者資料:', applicant);
const validation = tenantManager.validateHiring(applicant);
console.log('驗證結果:', validation);

// 檢查房間可用性
const emptyRooms = tenantManager.getEmptyRooms();
console.log('可用房間:', emptyRooms.length);
```

#### 問題2：滿意度計算異常
**診斷步驟：**
```javascript
// 1. 檢查滿意度配置
console.log('滿意度配置:', tenantManager.satisfactionConfig);

// 2. 檢查租客和房間狀態
const tenantInfo = tenantManager.findTenantAndRoom('租客姓名');
console.log('租客信息:', tenantInfo);

// 3. 手動計算滿意度
if (tenantInfo) {
    const satisfaction = tenantManager.calculateSatisfaction(
        tenantInfo.tenant, 
        tenantInfo.room
    );
    console.log('計算結果:', satisfaction);
}

// 4. 檢查影響因子
const globalEffects = gameState.getStateValue('globalEffects', {});
console.log('全局效果:', globalEffects);
```

#### 問題3：搜刮系統無法執行
**檢查搜刮條件：**
```javascript
// 檢查搜刮可用性
const availability = tenantManager.canScavenge();
console.log('搜刮可用性:', availability);

// 檢查可用人員
const scavengers = tenantManager.getAvailableScavengers();
console.log('可用搜刮者:', scavengers);

// 檢查遊戲狀態
const scavengeUsed = gameState.getStateValue('scavengeUsed', 0);
const maxPerDay = gameState.getStateValue('system.gameRules.mechanics.scavenging.maxPerDay', 2);
console.log(`搜刮使用情況: ${scavengeUsed}/${maxPerDay}`);
```

#### 問題4：事件沒有正確觸發
**檢查事件系統：**
```javascript
// 檢查 EventBus 狀態
console.log('EventBus 統計:', eventBus.getStats());

// 檢查 TenantManager 事件監聽
const listeners = eventBus.getListenedEvents();
console.log('已監聽事件:', listeners.filter(e => e.includes('tenant')));

// 手動測試事件發送
tenantManager.emitEvent('test', { test: true });
```

#### 問題5：申請者生成異常
**診斷申請者系統：**
```javascript
// 檢查租客類型配置
console.log('租客類型數據:', tenantManager.tenantTypes);

// 檢查配置載入
console.log('配置載入狀態:', tenantManager.config);

// 手動生成測試
try {
    const testApplicant = tenantManager.createRandomApplicant();
    console.log('測試申請者:', testApplicant);
} catch (error) {
    console.error('申請者生成失敗:', error);
}
```

---

## ⚡ 效能最佳化建議

### 1. 批量滿意度更新

```javascript
// ❌ 避免：頻繁單一更新
tenants.forEach(tenant => {
    tenantManager.updateTenantSatisfaction(tenant.name);
});

// ✅ 推薦：使用批量更新
tenantManager.updateTenantSatisfaction(); // 更新所有租客
```

### 2. 搜刮派遣優化

```javascript
// ❌ 避免：重複計算成功率
tenants.forEach(tenant => {
    const rate = tenantManager.calculateScavengeSuccessRate(tenant);
    console.log(`${tenant.name}: ${rate}%`);
});

// ✅ 推薦：使用內建狀態方法
const scavengeStatus = tenantManager.getScavengeStatus();
console.log('搜刮人員:', scavengeStatus.scavengerList);
```

### 3. 事件監聽最佳化

```javascript
// ✅ 使用一次性監聽器（適用於雇用完成）
eventBus.once('tenant_tenantHired', handleNewTenant);

// ✅ 移除不需要的監聽器
const unsubscribe = eventBus.on('tenant_satisfactionCritical', handler);
// 在不需要時調用
unsubscribe();
```

### 4. 數據查詢優化

```javascript
// ❌ 避免：重複查詢租客信息
const tenant1 = tenantManager.findTenantAndRoom(name);
const tenant2 = tenantManager.findTenantAndRoom(name); // 重複查詢

// ✅ 推薦：缓存查詢結果
const tenantInfo = tenantManager.findTenantAndRoom(name);
if (tenantInfo) {
    // 使用 tenantInfo.tenant 和 tenantInfo.room
}
```

### 5. 記憶體使用最佳化

```javascript
// TenantManager 已內建記憶體保護機制
// 滿意度歷史和衝突歷史自動限制在合理範圍內
// 手動清理（如果需要）
if (tenantManager.satisfactionHistory.length > 50) {
    // TenantManager 會自動清理，通常不需要手動干預
    console.log('歷史記錄自動管理中...');
}
```

---

## 🔧 常見問題與解決方案

### Q1: TenantManager 初始化失敗
**症狀：** 調用方法時返回 false 或拋出錯誤  
**解決方案：**
```javascript
// 確保正確的初始化順序
const dataManager = new DataManager();
await dataManager.initialize();

const gameState = new GameState(dataManager.getAllData());
const eventBus = new EventBus();
const resourceManager = new ResourceManager(gameState, eventBus);
const tradeManager = new TradeManager(gameState, resourceManager, dataManager, eventBus);
const tenantManager = new TenantManager(gameState, resourceManager, tradeManager, dataManager, eventBus);

// 確保異步初始化完成
await tenantManager.initialize();

// 檢查初始化狀態
const status = tenantManager.getStatus();
console.log('初始化狀態:', status.initialized);
```

### Q2: 租客雇用沒有反映到UI
**症狀：** hireTenant 返回成功但UI沒有更新  
**解決方案：**
```javascript
// 確保監聽租客雇用事件
eventBus.on('tenant_tenantHired', (eventObj) => {
    const { tenant, room } = eventObj.data;
    updateTenantListUI();
    updateRoomDisplayUI(room.id);
    showNotification(`${tenant.name} 已入住房間 ${room.id}`);
});

// 或監聽 GameState 的狀態變更事件
gameState.subscribe('state_changed', (data) => {
    if (data.updates.rooms) {
        updateAllRoomsUI();
    }
});
```

### Q3: 滿意度計算不正確
**症狀：** 滿意度值與預期不符  
**解決方案：**
```javascript
// 檢查滿意度因子配置
const config = tenantManager.satisfactionConfig;
console.log('滿意度配置:', config);

// 手動驗證計算邏輯
const tenantInfo = tenantManager.findTenantAndRoom('租客名');
if (tenantInfo) {
    console.log('房間狀態:', {
        reinforced: tenantInfo.room.reinforced,
        needsRepair: tenantInfo.room.needsRepair
    });
    
    console.log('租客資源:', tenantInfo.tenant.personalResources);
    
    const satisfaction = tenantManager.calculateSatisfaction(
        tenantInfo.tenant, 
        tenantInfo.room
    );
    console.log('計算滿意度:', satisfaction);
}
```

### Q4: 搜刮系統次數限制異常
**症狀：** 搜刮次數沒有正確重置或計算  
**診斷：**
```javascript
// 檢查每日重置機制
const currentDay = gameState.getStateValue('day', 1);
const scavengeUsed = gameState.getStateValue('scavengeUsed', 0);
console.log(`第${currentDay}天，已使用搜刮次數: ${scavengeUsed}`);

// 手動重置（除錯用）
tenantManager.resetDailyScavengeStatus();

// 檢查是否正確監聽日期推進事件
eventBus.emit('day_advanced', { newDay: currentDay + 1 });
```

### Q5: 衝突事件沒有觸發
**症狀：** 滿意度很低但沒有產生衝突  
**檢查：**
```javascript
// 檢查衝突觸發條件
const stats = tenantManager.getTenantStats();
console.log('租客統計:', stats);

if (stats.totalTenants >= 2) {
    // 手動觸發衝突檢查
    tenantManager.checkConflictTriggers();
    
    // 檢查衝突機率配置
    const conflictThreshold = tenantManager.config?.conflictThreshold || 40;
    console.log('衝突觸發閾值:', conflictThreshold);
    
    // 檢查低滿意度租客
    const lowSatisfactionTenants = [];
    tenantManager.tenantSatisfaction.forEach((satisfaction, name) => {
        if (satisfaction < conflictThreshold) {
            lowSatisfactionTenants.push(name);
        }
    });
    console.log('低滿意度租客:', lowSatisfactionTenants);
}
```

---

## 📖 參考附錄

### TenantType 聯合型別
```typescript
type TenantType = 'doctor' | 'worker' | 'farmer' | 'soldier' | 'elder';
```

### 滿意度等級配置
```javascript
const SATISFACTION_LEVELS = [
    { threshold: 80, name: "非常滿意", emoji: "😁", severity: "excellent" },
    { threshold: 60, name: "滿意", emoji: "😊", severity: "good" },
    { threshold: 40, name: "普通", emoji: "😐", severity: "normal" },
    { threshold: 20, name: "不滿", emoji: "😞", severity: "warning" },
    { threshold: 0, name: "極度不滿", emoji: "😡", severity: "critical" }
];
```

### 搜刮成功率配置（預設）
```javascript
{
    soldier: 85,    // 軍人最高
    worker: 75,     // 工人次之
    farmer: 65,     // 農夫中等
    doctor: 50,     // 醫生較低
    elder: 40       // 老人最低
}
```

### 事件類型參考
```javascript
// TenantManager 觸發的事件
'tenant_tenantHired'              // 租客雇用完成
'tenant_tenantEvicted'            // 租客驅逐完成
'tenant_satisfactionCritical'     // 滿意度危急
'tenant_satisfactionWarning'      // 滿意度警告
'tenant_conflictTriggered'        // 衝突觸發
'tenant_conflictResolved'         // 衝突解決
'tenant_dailySatisfactionReport'  // 每日滿意度報告
'tenant_tenantStatsUpdated'       // 租客統計更新

// 搜刮相關事件（業務領域事件）
'scavenge_started'                // 搜刮開始
'scavenge_completed'              // 搜刮完成
'scavenge_result'                 // 搜刮結果
```

### 滿意度影響因子
```javascript
{
    reinforcedRoom: +3,          // 加固房間加成
    needsRepair: -8,             // 房間需維修扣分
    lowPersonalFood: -10,        // 個人食物不足扣分
    highPersonalCash: +5,        // 個人現金充足加分
    highBuildingDefense: +4,     // 建築防禦高加分
    lowBuildingDefense: -6,      // 建築防禦低扣分
    emergencyTraining: +2,       // 急救培訓加分
    buildingQuality: +3,         // 建築品質加分
    patrolSystem: +4,            // 巡邏系統加分
    socialNetwork: +3,           // 社交網絡加分
    elderHarmonyBonus: +2        // 長者和諧加成（每位長者）
}
```

### 整合檢查清單
- [ ] TenantManager 正確初始化
- [ ] 事件監聽器已設定
- [ ] UI更新邏輯已綁定
- [ ] 錯誤處理已實作
- [ ] 除錯工具已配置
- [ ] 效能最佳化已應用
- [ ] 與其他模組的依賴已確認
- [ ] 搜刮系統事件整合已完成

---

**開發指南版本：** v2.0  
**對應 TenantManager 版本：** v2.0 (BaseManager 繼承版)  
**維護者：** 末日房東模擬器開發團隊
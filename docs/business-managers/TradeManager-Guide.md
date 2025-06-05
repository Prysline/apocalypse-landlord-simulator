# TradeManager v2.0 開發指南

## 📋 文檔概覽

本指南提供TradeManager v2.0的完整開發參考，包含API調用、整合範例、除錯指導和最佳實踐。適用於末日房東模擬器的單人開發場景。

**版本**：TradeManager v2.0 (BaseManager 繼承版)  
**更新日期**：2025年  
**相容性**：需要 GameState, EventBus, ResourceManager, BaseManager  

---

## 🚀 快速開始

### 基本初始化

```javascript
// 1. 引入必要模組
import TradeManager from './systems/TradeManager.js';
import GameState from './core/GameState.js';
import EventBus from './core/EventBus.js';
import ResourceManager from './systems/ResourceManager.js';
import DataManager from './core/DataManager.js';

// 2. 建立實例（通常在 main.js 中）
const gameState = new GameState();
const eventBus = new EventBus();
const resourceManager = new ResourceManager(gameState, eventBus);
const dataManager = new DataManager();
const tradeManager = new TradeManager(gameState, resourceManager, dataManager, eventBus);

// 3. 初始化並檢查狀態
await tradeManager.initialize();
console.log('TradeManager 狀態:', tradeManager.getStatus());
```

### 基本交易操作

```javascript
// 租金收取
const rentResult = await tradeManager.processRentCollection();
if (rentResult.success) {
    console.log(`收租成功：總計 $${rentResult.totalCashRent + rentResult.bonusIncome}`);
}

// 商人交易
const merchantOffer = {
    type: 'sell',
    item: 'medical',
    amount: 3,
    price: 15,
    description: '出售醫療用品'
};
const merchantResult = await tradeManager.processMerchantTrade(merchant, merchantOffer);

// 商隊交易
const caravanResult = await tradeManager.processCaravanTrade('fuel_for_food');

// 互助系統
const mutualResult = await tradeManager.processMutualAid();
```

---

## 📚 核心API完整參考

### 系統初始化類 API

#### `initialize()`
初始化交易管理器，載入配置和設定事件監聽器。

**返回值：** `Promise<boolean>` - 初始化是否成功

**使用範例：**
```javascript
const success = await tradeManager.initialize();
if (success) {
    console.log('TradeManager 初始化完成');
} else {
    console.error('TradeManager 初始化失敗');
}
```

### 租金收取類 API

#### `processRentCollection()`
處理所有租客的租金收取，支援現金支付和資源抵付。

**返回值：** `Promise<RentCollectionResult>` - 租金收取結果

**事件觸發：** `trade_rentCollectionCompleted`

**返回物件結構：**
```javascript
{
    success: boolean,
    totalCashRent: number,        // 現金租金總額
    resourcePayments: Array,      // 資源抵付記錄
    failedPayments: Array,        // 失敗支付記錄
    bonusIncome: number,         // 加固房間加成
    summary: string,             // 收取摘要
    error?: string               // 錯誤訊息
}
```

**使用範例：**
```javascript
// 執行租金收取
const result = await tradeManager.processRentCollection();

if (result.success) {
    console.log(result.summary);
    
    // 檢查資源抵付詳情
    result.resourcePayments.forEach(payment => {
        console.log(`${payment.type}: ${payment.amount} (價值$${payment.value})`);
    });
    
    // 檢查失敗支付
    result.failedPayments.forEach(failure => {
        console.warn(`${failure.tenant} 欠款 $${failure.shortage}: ${failure.reason}`);
    });
} else {
    console.error('租金收取失敗:', result.error);
}
```

#### 資源抵付匯率系統
```javascript
// 預設匯率（基於 rules.json）
const EXCHANGE_RATES = {
    food: 1.5,      // 食物：每單位價值 $1.5
    materials: 3.0,  // 建材：每單位價值 $3.0
    medical: 4.0,    // 醫療：每單位價值 $4.0
    fuel: 3.0        // 燃料：每單位價值 $3.0
};

// 加固房間租金加成：20%
// 抵付優先順序：現金 → 食物 → 建材 → 醫療 → 燃料
```

### 商人交易類 API

#### `processMerchantTrade(merchant, selectedOffer)`
處理與商人的交易，包括買賣和服務。

**參數：**
- `merchant` (Merchant): 商人物件
- `selectedOffer` (MerchantOffer): 選擇的交易選項

**返回值：** `Promise<MerchantTradeResult>` - 商人交易結果

**事件觸發：** `trade_merchantTradeCompleted`

**交易類型：**
```javascript
// 購買類型 - 玩家出售資源給商人
{
    type: 'buy',
    item: 'medical',     // 資源類型
    amount: 3,           // 數量
    price: 15,           // 商人支付價格
    description: '出售醫療用品'
}

// 出售類型 - 玩家從商人購買資源
{
    type: 'sell',
    item: 'materials',   // 資源類型
    amount: 5,           // 數量
    price: 20,           // 玩家支付價格
    description: '購買建材'
}

// 服務類型 - 玩家購買商人服務
{
    type: 'service',
    service: 'healthCheck',  // 服務類型
    price: 8,               // 服務價格
    description: '健康檢查服務'
}
```

**服務類型說明：**
```javascript
const MERCHANT_SERVICES = {
    healthCheck: {
        description: '專業健康檢查',
        effect: '檢測訪客和租客感染狀況',
        provider: 'doctor'
    },
    quickRepair: {
        description: '快速維修服務',
        effect: '修復一個需要維修的房間',
        provider: 'worker'
    },
    security: {
        description: '安全諮詢服務',
        effect: '+1 建築防禦',
        provider: 'soldier'
    },
    information: {
        description: '情報服務',
        effect: '提供有用資訊或獎勵',
        provider: 'elder'
    }
};
```

**使用範例：**
```javascript
// 定義商人物件
const doctorMerchant = {
    name: '流浪醫生',
    type: 'doctor',
    isTrader: true,
    tradeOffers: [
        {
            type: 'sell',
            item: 'medical',
            amount: 3,
            price: 15,
            description: '出售醫療用品'
        },
        {
            type: 'service',
            service: 'healthCheck',
            price: 8,
            description: '健康檢查服務'
        }
    ]
};

// 執行交易
const selectedOffer = doctorMerchant.tradeOffers[1]; // 選擇健康檢查服務
const result = await tradeManager.processMerchantTrade(doctorMerchant, selectedOffer);

if (result.success) {
    console.log(result.description);
    if (result.serviceResult) {
        console.log('服務效果:', result.serviceResult.effect);
    }
} else {
    console.error('交易失敗:', result.error);
}
```

### 商隊交易類 API

#### `processCaravanTrade(tradeType)`
處理商隊固定交易選項。

**參數：**
- `tradeType` (string): 交易類型識別碼

**返回值：** `Promise<CaravanTradeResult>` - 商隊交易結果

**事件觸發：** `trade_caravanTradeCompleted`

**主要交易選項：**
```javascript
const CARAVAN_TRADES = {
    // 食物相關
    'fuel_for_food': {
        give: { fuel: 3 },
        receive: { food: 10 },
        description: '用燃料換食物'
    },
    'cash_for_food': {
        give: { cash: 12 },
        receive: { food: 9 },
        description: '用現金購買食物'
    },
    
    // 建材相關
    'materials_for_cash': {
        give: { materials: 6 },
        receive: { cash: 20 },
        description: '出售建材換現金'
    },
    'cash_for_materials': {
        give: { cash: 18 },
        receive: { materials: 5 },
        description: '用現金購買建材'
    },
    
    // 醫療相關
    'cash_for_medical': {
        give: { cash: 15 },
        receive: { medical: 4 },
        description: '用現金買醫療用品'
    },
    
    // 特殊套餐
    'survival_bundle': {
        give: { cash: 25 },
        receive: { food: 6, medical: 2, fuel: 2 },
        description: '購買生存套餐'
    }
};
```

**使用範例：**
```javascript
// 檢查是否有足夠資源
const fuelAmount = gameState.getStateValue('resources.fuel', 0);
if (fuelAmount >= 3) {
    // 執行燃料換食物交易
    const result = await tradeManager.processCaravanTrade('fuel_for_food');
    
    if (result.success) {
        console.log(result.description);
        console.log(`交易價值: $${result.value}`);
    } else {
        console.error('商隊交易失敗:', result.error);
    }
} else {
    console.log('燃料不足，無法進行交易');
}
```

#### `generateTodaysCaravanOffers()`
生成今日可用的商隊交易選項。

**返回值：** `Object<string, CaravanOffer>` - 今日可用交易選項

**使用範例：**
```javascript
// 取得今日商隊選項
const todaysOffers = tradeManager.generateTodaysCaravanOffers();

// 顯示可用選項
Object.entries(todaysOffers).forEach(([key, offer]) => {
    console.log(`${key}: ${offer.description}`);
    console.log(`  需要: ${Object.entries(offer.give).map(([type, amount]) => `${amount} ${type}`).join(', ')}`);
    console.log(`  獲得: ${Object.entries(offer.receive).map(([type, amount]) => `${amount} ${type}`).join(', ')}`);
});
```

### 互助交易類 API

#### `processMutualAid()`
處理租客間的自動互助和房東交易。

**返回值：** `Promise<MutualAidResult>` - 互助系統結果

**事件觸發：** `trade_mutualAidCompleted`

**互助類型：**
```javascript
const MUTUAL_AID_TYPES = {
    food_aid: '食物互助',      // 富有租客分享食物給缺乏者
    cash_loan: '現金借貸',     // 現金互助
    medical_aid: '醫療援助',   // 醫療用品援助（主要針對老人）
    tenant_purchase: '租客購買', // 租客向房東購買資源
    landlord_purchase: '房東購買' // 房東向租客購買資源
};
```

**使用範例：**
```javascript
// 執行互助系統
const result = await tradeManager.processMutualAid();

if (result.success) {
    console.log(`互助事件: ${result.results.mutualAidEvents} 次`);
    console.log(`房東交易: ${result.results.landlordTrades} 次`);
    console.log(`總價值: $${result.results.totalValue}`);
    
    // 檢視詳細事件
    result.results.events.forEach(event => {
        if (event.success) {
            switch (event.type) {
                case 'food_aid':
                    console.log(`${event.helper} 分享 ${event.amount} 食物給 ${event.recipient}`);
                    break;
                case 'cash_loan':
                    console.log(`${event.helper} 借 $${event.amount} 給 ${event.recipient}`);
                    break;
                case 'tenant_purchase':
                    console.log(`${event.tenant} 向房東購買 ${event.amount} ${event.item}`);
                    break;
                case 'landlord_purchase':
                    console.log(`房東向 ${event.tenant} 購買 ${event.amount} ${event.item}`);
                    break;
            }
        }
    });
} else {
    console.error('互助系統失敗:', result.error);
}
```

### 狀態查詢類 API

#### `getStatus()`
取得交易管理器的完整狀態資訊。

**返回值：** `Object` - 狀態物件

**使用範例：**
```javascript
const status = tradeManager.getStatus();
console.log('交易管理器狀態:', {
    initialized: status.initialized,
    configLoaded: status.configLoaded,
    totalTransactions: status.tradeStats?.rentTransactions + 
                      status.tradeStats?.merchantTransactions + 
                      status.tradeStats?.caravanTransactions,
    totalValue: status.tradeStats?.totalValue,
    systemHealth: status.systemHealth
});
```

---

## 🔗 典型使用場景與範例

### 場景1：完整每日租金收取流程

```javascript
// main.js 中的每日循環處理
class GameApplication {
    async processDailyRentCollection() {
        console.log('🏠 開始每日租金收取...');
        
        try {
            // 檢查是否已收過租
            const rentCollected = this.gameState.getStateValue('dailyActions.rentCollected', false);
            if (rentCollected) {
                console.log('今日已收取租金');
                return { success: false, reason: 'already_collected' };
            }
            
            // 執行租金收取
            const result = await this.tradeManager.processRentCollection();
            
            if (result.success) {
                // 標記租金已收取
                this.gameState.setStateValue('dailyActions.rentCollected', true, 'rent_collection');
                
                // 更新UI
                this.updateResourceDisplay();
                this.updateRentCollectionButton(false);
                
                // 顯示收取結果
                this.showRentCollectionSummary(result);
                
                return result;
            } else {
                console.error('租金收取失敗:', result.error);
                return result;
            }
            
        } catch (error) {
            console.error('租金收取處理異常:', error);
            return { success: false, error: error.message };
        }
    }
    
    showRentCollectionSummary(result) {
        // 顯示收取摘要
        this.gameState.addLog(result.summary, 'rent');
        
        // 顯示詳細分析
        if (result.resourcePayments.length > 0) {
            this.gameState.addLog('📋 資源抵付明細:', 'rent');
            result.resourcePayments.forEach(payment => {
                this.gameState.addLog(
                    `   • ${payment.description}`, 
                    'rent'
                );
            });
        }
        
        if (result.failedPayments.length > 0) {
            this.gameState.addLog('⚠️ 租金欠款:', 'danger');
            result.failedPayments.forEach(failure => {
                this.gameState.addLog(
                    `   • ${failure.tenant}: 欠款 $${failure.shortage}`, 
                    'danger'
                );
            });
        }
        
        // 更新統計
        const totalIncome = result.totalCashRent + result.bonusIncome;
        this.updateDailyStats('rent_income', totalIncome);
    }
}
```

### 場景2：商人交易整合系統

```javascript
// TenantManager 中的商人訪客處理
class TenantManager {
    async handleMerchantVisitor(merchant) {
        console.log(`🛒 商人訪客: ${merchant.name} (${merchant.type})`);
        
        // 生成商人交易選項
        const offers = this.generateMerchantOffers(merchant);
        merchant.tradeOffers = offers;
        
        // 更新訪客列表
        this.addVisitorToState(merchant);
        
        // 記錄商人到訪
        this.gameState.addLog(
            `商人 ${merchant.name} 來訪，提供 ${offers.length} 種交易選項`,
            'event'
        );
        
        return merchant;
    }
    
    generateMerchantOffers(merchant) {
        const merchantTemplates = this.dataManager.getMerchantTemplates();
        const template = merchantTemplates[merchant.type];
        
        if (!template) {
            return this.getDefaultMerchantOffers(merchant.type);
        }
        
        // 根據遊戲狀態調整交易選項
        return template.offers.map(offer => ({
            ...offer,
            price: this.adjustMerchantPrice(offer, merchant.type)
        }));
    }
    
    adjustMerchantPrice(offer, merchantType) {
        let basePrice = offer.price;
        
        // 根據建築防禦調整價格
        const defense = this.gameState.getStateValue('building.defense', 0);
        if (defense >= 5) {
            basePrice *= 0.9; // 10% 折扣
        }
        
        // 根據商人類型調整
        if (merchantType === 'elder') {
            basePrice *= 0.8; // 老人商人便宜 20%
        }
        
        return Math.floor(basePrice);
    }
}

// UI 中的商人交易處理
class UIController {
    async executeMerchantTrade(merchant, offerIndex) {
        const selectedOffer = merchant.tradeOffers[offerIndex];
        
        try {
            // 執行交易
            const result = await this.gameApp.tradeManager.processMerchantTrade(
                merchant, 
                selectedOffer
            );
            
            if (result.success) {
                // 交易成功處理
                this.updateResourceDisplay();
                this.updateMerchantDisplay(merchant);
                
                // 特殊服務結果處理
                if (result.serviceResult) {
                    this.handleServiceResult(result.serviceResult);
                }
                
                this.showTradeSuccessMessage(result);
                
            } else {
                // 交易失敗處理
                this.showTradeErrorMessage(result.error);
            }
            
        } catch (error) {
            console.error('商人交易UI處理失敗:', error);
            this.showSystemErrorMessage('交易系統暫時不可用');
        }
    }
    
    handleServiceResult(serviceResult) {
        switch (serviceResult.effect) {
            case '發現感染':
                this.highlightInfectedVisitors();
                this.playWarningSound();
                break;
            case '修復房間':
                this.updateRoomDisplay();
                this.playSuccessSound();
                break;
            case '+1 建築防禦':
                this.updateDefenseDisplay();
                this.showDefenseImprovement();
                break;
            case '獲得有用情報':
                this.showInformationBonus();
                break;
        }
    }
}
```

### 場景3：商隊交易動態選擇

```javascript
// EventManager 中的商隊事件處理
class EventManager {
    async triggerCaravanEvent() {
        console.log('🚛 商隊事件觸發');
        
        // 生成今日商隊選項
        const availableOffers = this.tradeManager.generateTodaysCaravanOffers();
        
        // 檢查玩家資源狀況
        const resourceStatus = this.analyzePlayerResourcesForCaravan(availableOffers);
        
        // 建立事件資料
        const eventData = {
            type: 'caravan_arrival',
            title: '商隊過路',
            description: '一個商隊經過附近，他們願意進行物資交易',
            availableOffers: availableOffers,
            resourceAnalysis: resourceStatus,
            priority: 2
        };
        
        // 觸發商隊事件
        this.emitEvent('caravan_event_triggered', eventData);
        
        return eventData;
    }
    
    analyzePlayerResourcesForCaravan(offers) {
        const currentResources = this.gameState.getStateValue('resources', {});
        const analysis = {
            canAfford: [],
            recommended: [],
            urgent: []
        };
        
        Object.entries(offers).forEach(([key, offer]) => {
            // 檢查是否有足夠資源
            const canAfford = this.resourceManager.hasEnoughResources(offer.give);
            if (canAfford) {
                analysis.canAfford.push(key);
            }
            
            // 檢查是否為推薦交易
            if (this.isRecommendedTrade(offer, currentResources)) {
                analysis.recommended.push(key);
            }
            
            // 檢查是否為緊急需要
            if (this.isUrgentTrade(offer, currentResources)) {
                analysis.urgent.push(key);
            }
        });
        
        return analysis;
    }
    
    isRecommendedTrade(offer, currentResources) {
        // 檢查接收資源是否稀缺
        for (const [resourceType, amount] of Object.entries(offer.receive)) {
            const current = currentResources[resourceType] || 0;
            const threshold = this.resourceManager.getResourceThreshold(resourceType, 'warning');
            
            if (current <= threshold) {
                return true; // 推薦補充稀缺資源
            }
        }
        
        // 檢查給出資源是否過多
        for (const [resourceType, amount] of Object.entries(offer.give)) {
            const current = currentResources[resourceType] || 0;
            if (current >= amount * 3) {
                return true; // 推薦出售過多資源
            }
        }
        
        return false;
    }
    
    isUrgentTrade(offer, currentResources) {
        // 檢查接收資源是否危急
        for (const [resourceType, amount] of Object.entries(offer.receive)) {
            const current = currentResources[resourceType] || 0;
            const threshold = this.resourceManager.getResourceThreshold(resourceType, 'critical');
            
            if (current <= threshold) {
                return true; // 緊急需要的資源
            }
        }
        
        return false;
    }
}
```

### 場景4：互助系統與社交管理

```javascript
// TenantManager 中的互助系統整合
class TenantManager {
    async processEndOfDayMutualAid() {
        console.log('🤝 處理每日互助...');
        
        // 分析租客需求狀況
        const tenantNeeds = this.analyzeTenantNeeds();
        
        // 執行互助系統
        const mutualResult = await this.tradeManager.processMutualAid();
        
        if (mutualResult.success) {
            // 處理互助結果
            this.processMutualAidResults(mutualResult.results);
            
            // 更新租客關係
            this.updateTenantRelationships(mutualResult.results);
            
            // 更新滿意度
            this.updateSatisfactionFromMutualAid(mutualResult.results);
            
        } else {
            console.error('互助系統處理失敗:', mutualResult.error);
        }
        
        return mutualResult;
    }
    
    analyzeTenantNeeds() {
        const rooms = this.gameState.getStateValue('rooms', []);
        const needs = {
            food: [],
            cash: [],
            medical: [],
            total: 0
        };
        
        rooms.forEach(room => {
            if (room.tenant && room.tenant.personalResources) {
                const tenant = room.tenant;
                const resources = tenant.personalResources;
                
                // 食物需求分析
                if (resources.food <= 2) {
                    needs.food.push({
                        name: tenant.name,
                        severity: resources.food <= 1 ? 'critical' : 'warning',
                        shortage: 3 - resources.food
                    });
                    needs.total++;
                }
                
                // 現金需求分析
                if (resources.cash <= 5) {
                    needs.cash.push({
                        name: tenant.name,
                        severity: resources.cash <= 2 ? 'critical' : 'warning',
                        shortage: 10 - resources.cash
                    });
                    needs.total++;
                }
                
                // 醫療需求分析（特別針對老人）
                if (tenant.type === 'elder' && resources.medical <= 1) {
                    needs.medical.push({
                        name: tenant.name,
                        severity: 'high',
                        shortage: 2 - resources.medical
                    });
                    needs.total++;
                }
            }
        });
        
        console.log(`租客需求分析: ${needs.total} 項需求`);
        return needs;
    }
    
    processMutualAidResults(results) {
        // 處理互助事件
        results.events.forEach(event => {
            if (event.success) {
                this.recordMutualAidEvent(event);
                this.triggerMutualAidReward(event);
            }
        });
        
        // 記錄日誌摘要
        if (results.mutualAidEvents > 0) {
            this.gameState.addLog(
                `🤝 今日互助: ${results.mutualAidEvents} 次，房東交易: ${results.landlordTrades} 次`,
                'event'
            );
        }
    }
    
    updateTenantRelationships(results) {
        // 互助增進租客關係
        results.events.forEach(event => {
            if (event.success && event.helper && event.recipient) {
                this.improveTenantRelationship(event.helper, event.recipient, 'mutual_aid');
            }
        });
    }
    
    updateSatisfactionFromMutualAid(results) {
        // 互助提升整體滿意度
        if (results.mutualAidEvents > 0) {
            this.improveTenantSatisfaction('all', 2, 'mutual_aid_boost');
        }
        
        // 受助租客額外滿意度提升
        results.events.forEach(event => {
            if (event.success && event.recipient) {
                this.improveTenantSatisfaction(event.recipient, 5, 'received_aid');
            }
        });
    }
}
```

---

## 🛠️ 錯誤處理與除錯指南

### 常見錯誤處理模式

```javascript
// 安全的交易操作模式
async function safeTradeOperation(tradeFunction, ...args) {
    try {
        // 檢查TradeManager狀態
        if (!tradeManager.isInitialized()) {
            console.warn('TradeManager未初始化');
            return { success: false, error: 'TradeManager not initialized' };
        }
        
        // 執行操作
        const result = await tradeFunction.apply(tradeManager, args);
        
        return result;
    } catch (error) {
        console.error('交易操作失敗:', error);
        return { success: false, error: error.message };
    }
}

// 使用範例
const result = await safeTradeOperation(
    tradeManager.processRentCollection.bind(tradeManager)
);

if (!result.success) {
    console.error('收租失敗:', result.error);
}
```

### 除錯工具使用

```javascript
// 1. 檢查TradeManager狀態
console.log('TradeManager狀態:', tradeManager.getStatus());

// 2. 查看交易統計
const stats = tradeManager.getStatus().tradeStats;
console.table({
    '租金交易': stats.rentTransactions,
    '商人交易': stats.merchantTransactions,
    '商隊交易': stats.caravanTransactions,
    '互助交易': stats.mutualAidTransactions,
    '總價值': stats.totalValue
});

// 3. 檢查今日商隊選項
const todaysOffers = tradeManager.generateTodaysCaravanOffers();
console.log('今日商隊選項:', Object.keys(todaysOffers));

// 4. 分析資源狀況
const resources = gameState.getStateValue('resources', {});
console.log('當前資源:', resources);

// 5. 檢查租客個人資源
const rooms = gameState.getStateValue('rooms', []);
rooms.forEach(room => {
    if (room.tenant) {
        console.log(`${room.tenant.name} 個人資源:`, room.tenant.personalResources);
    }
});

// 6. 檢查交易配置
const exchangeRates = tradeManager.exchangeRates;
console.log('交易匯率:', exchangeRates);
```

### 常見問題診斷

#### 問題1：processRentCollection返回false
**可能原因：**
- TradeManager未初始化 (`!isInitialized()`)
- 沒有租客
- 租客個人資源不足
- ResourceManager不可用

**診斷方法：**
```javascript
// 檢查初始化狀態
console.log('已初始化:', tradeManager.isInitialized());

// 檢查租客狀況
const occupiedRooms = gameState.getStateValue('rooms', [])
    .filter(room => room.tenant && !room.tenant.infected);
console.log('可收租房間數:', occupiedRooms.length);

// 檢查租客資源
occupiedRooms.forEach(room => {
    const tenant = room.tenant;
    const totalResources = Object.values(tenant.personalResources || {})
        .reduce((sum, val) => sum + val, 0);
    console.log(`${tenant.name} 總資源:`, totalResources);
});

// 檢查ResourceManager狀態
console.log('ResourceManager可用:', resourceManager && resourceManager.isActive);
```

#### 問題2：商人交易驗證失敗
**診斷步驟：**
```javascript
// 1. 檢查商人物件
const isValidMerchant = merchant && merchant.isTrader && merchant.tradeOffers;
console.log('商人有效:', isValidMerchant);

// 2. 檢查交易選項
const offer = selectedOffer;
console.log('交易選項:', offer);

// 3. 檢查資源需求
if (offer.type === 'buy' && offer.item && offer.amount) {
    const hasResources = resourceManager.hasEnoughResources({
        [offer.item]: offer.amount
    });
    console.log(`有足夠 ${offer.item}:`, hasResources);
}

if ((offer.type === 'sell' || offer.type === 'service') && offer.price) {
    const hasCash = resourceManager.hasEnoughResources({ cash: offer.price });
    console.log('有足夠現金:', hasCash);
}

// 4. 檢查驗證器狀態
console.log('TradeValidator可用:', tradeManager.tradeValidator !== null);
```

#### 問題3：商隊交易選項為空
**檢查和修復：**
```javascript
// 1. 檢查商隊配置載入
const caravanOffers = tradeManager.caravanOffers;
console.log('商隊配置載入:', !!caravanOffers);

if (!caravanOffers) {
    console.log('使用預設商隊配置');
    const defaultOffers = tradeManager.getDefaultCaravanOffers();
    console.log('預設選項數量:', Object.keys(defaultOffers).length);
}

// 2. 手動生成今日選項
try {
    const todaysOffers = tradeManager.generateTodaysCaravanOffers();
    console.log('今日生成選項:', Object.keys(todaysOffers));
} catch (error) {
    console.error('生成商隊選項失敗:', error);
}

// 3. 檢查選擇算法
const allOffers = caravanOffers || tradeManager.getDefaultCaravanOffers();
const categorized = tradeManager.categorizeCompatibleOffers(allOffers);
console.log('分類結果:', Object.keys(categorized));
```

#### 問題4：互助系統沒有觸發
**檢查條件：**
```javascript
// 1. 檢查互助機率配置
const mutualAidProbability = tradeManager.tradeConfig?.mutualAidProbability;
console.log('互助機率:', mutualAidProbability);

// 2. 檢查租客數量
const tenants = gameState.getAllTenants();
console.log('租客數量:', tenants.length);

if (tenants.length < 2) {
    console.log('租客不足2人，無法觸發互助');
}

// 3. 檢查租客資源狀況
const needyTenants = tenants.filter(tenant => {
    const resources = tenant.personalResources;
    return resources && (
        resources.food <= 1 || 
        resources.cash <= 5 || 
        (tenant.type === 'elder' && resources.medical <= 1)
    );
});

const helpfulTenants = tenants.filter(tenant => {
    const resources = tenant.personalResources;
    return resources && (
        resources.food >= 5 || 
        resources.cash >= 15 || 
        resources.medical >= 3
    );
});

console.log('需要幫助的租客:', needyTenants.length);
console.log('可以幫助的租客:', helpfulTenants.length);
```

#### 問題5：事件沒有正確觸發
**檢查事件監聽：**
```javascript
// 檢查EventBus狀態
console.log('EventBus統計:', eventBus.getStats());

// 檢查特定事件監聽器
const listeners = eventBus.getListenedEvents();
console.log('已監聽事件:', listeners.filter(e => e.startsWith('trade_')));

// 手動測試事件發送
eventBus.emit('trade_test_event', { test: true });

// 檢查BaseManager事件前綴解析
console.log('模組前綴:', tradeManager.getModulePrefix());
const testEventName = tradeManager.resolveEventName('testEvent');
console.log('事件解析:', 'testEvent →', testEventName);
```

---

## ⚡ 效能最佳化建議

### 1. 批量交易最佳化

```javascript
// ❌ 避免：頻繁的單一交易檢查
if (tradeManager.hasEnoughResourcesForTrade('fuel_for_food')) {
    if (tradeManager.hasEnoughResourcesForTrade('cash_for_medical')) {
        // 逐一檢查
    }
}

// ✅ 推薦：批量檢查多個交易選項
const tradesToCheck = ['fuel_for_food', 'cash_for_medical', 'materials_for_cash'];
const availableTrades = tradesToCheck.filter(tradeType => {
    const offer = tradeManager.caravanOffers[tradeType];
    return tradeManager.validateCaravanTrade(offer).valid;
});
```

### 2. 商隊選擇演算法最佳化

```javascript
// ✅ 快取今日商隊選項，避免重複生成
class TradeManager {
    constructor() {
        this._todaysOffersCache = null;
        this._todaysOffersCacheDay = null;
    }
    
    generateTodaysCaravanOffers() {
        const currentDay = this.gameState.getStateValue('day', 1);
        
        // 檢查快取是否有效
        if (this._todaysOffersCache && this._todaysOffersCacheDay === currentDay) {
            return this._todaysOffersCache;
        }
        
        // 生成新的選項
        const offers = this._generateCaravanOffers();
        
        // 更新快取
        this._todaysOffersCache = offers;
        this._todaysOffersCacheDay = currentDay;
        
        return offers;
    }
    
    // 新一天時清理快取
    onDayAdvanced() {
        this._todaysOffersCache = null;
        this._todaysOffersCacheDay = null;
    }
}
```

### 3. 事件監聽最佳化

```javascript
// ✅ 使用一次性監聽器（適用於單次處理）
eventBus.once('trade_rentCollectionCompleted', handleRentCollection);

// ✅ 移除不需要的監聽器
const unsubscribe = eventBus.on('trade_merchantTradeCompleted', handler);
// 在不需要時調用
unsubscribe();

// ✅ 使用事件過濾器減少無效處理
tradeManager.onEvent('caravanTradeCompleted', handleCaravanTrade, {
    filter: (eventObj) => eventObj.data.value > 10 // 只處理價值超過10的交易
});
```

### 4. 資源驗證快取

```javascript
// ✅ 快取資源狀態驗證結果
class TradeManager {
    constructor() {
        this._resourceValidationCache = new Map();
        this._lastResourceCheckTime = 0;
    }
    
    hasEnoughResourcesForTrade(tradeType) {
        const currentTime = Date.now();
        const cacheKey = `${tradeType}_${this.gameState.getStateValue('resources.lastModified', 0)}`;
        
        // 檢查快取（1秒內有效）
        if (currentTime - this._lastResourceCheckTime < 1000) {
            if (this._resourceValidationCache.has(cacheKey)) {
                return this._resourceValidationCache.get(cacheKey);
            }
        }
        
        // 執行驗證
        const offer = this.caravanOffers[tradeType];
        const result = this.resourceManager.hasEnoughResources(offer.give);
        
        // 更新快取
        this._resourceValidationCache.set(cacheKey, result);
        this._lastResourceCheckTime = currentTime;
        
        // 限制快取大小
        if (this._resourceValidationCache.size > 20) {
            const firstKey = this._resourceValidationCache.keys().next().value;
            this._resourceValidationCache.delete(firstKey);
        }
        
        return result;
    }
}
```

### 5. 記憶體使用最佳化

```javascript
// TradeManager已內建記憶體保護機制
// 交易歷史和統計自動限制，通常不需要手動干預
if (tradeManager.tradeStats.totalTransactions > 1000) {
    // TradeManager會自動清理舊記錄
    console.log('交易記錄自動管理中...');
}

// 手動清理（如果需要）
tradeManager.resetDailyStats(); // 重置每日統計
```

### 6. 商人交易模板快取

```javascript
// ✅ 快取商人交易模板，避免重複載入
class TradeManager {
    constructor() {
        this._merchantTemplateCache = new Map();
    }
    
    getMerchantOffers(merchantType) {
        // 檢查快取
        if (this._merchantTemplateCache.has(merchantType)) {
            return this._merchantTemplateCache.get(merchantType);
        }
        
        // 載入模板
        const template = this.dataManager.getMerchantTemplate(merchantType);
        const offers = this.processMerchantTemplate(template);
        
        // 快取結果
        this._merchantTemplateCache.set(merchantType, offers);
        
        return offers;
    }
}
```

---

## 🔧 常見問題與解決方案

### Q1: TradeManager初始化失敗
**症狀：** 調用方法時返回未初始化錯誤  
**解決方案：**
```javascript
// 確保正確的初始化順序
const gameState = new GameState(initialData);
const eventBus = new EventBus();
const resourceManager = new ResourceManager(gameState, eventBus);
const dataManager = new DataManager();
await dataManager.initialize();

const tradeManager = new TradeManager(gameState, resourceManager, dataManager, eventBus);
await tradeManager.initialize();

// 檢查初始化狀態
const status = tradeManager.getStatus();
console.log('TradeManager初始化:', status.initialized);
console.log('配置載入:', status.configLoaded);
```

### Q2: 租金收取沒有反映到UI
**症狀：** processRentCollection返回成功但UI沒有更新  
**解決方案：**
```javascript
// 確保監聽租金收取完成事件
eventBus.on('trade_rentCollectionCompleted', (eventObj) => {
    const result = eventObj.data.data; // BaseManager事件格式
    
    // 更新資源顯示
    updateResourceDisplay();
    
    // 更新租客個人資源顯示
    updateTenantResourceDisplay();
    
    // 更新收租按鈕狀態
    updateRentCollectionButton(false);
    
    // 顯示收取結果
    showRentCollectionModal(result);
});

// 或直接在processRentCollection後更新
const result = await tradeManager.processRentCollection();
if (result.success) {
    updateAllUIElements();
}
```

### Q3: 商隊交易選項重複或不平衡
**症狀：** 每日商隊選項缺乏變化或價格衝突  
**解決方案：**
```javascript
// 檢查商隊選擇算法配置
const offers = tradeManager.generateTodaysCaravanOffers();
console.log('今日選項數量:', Object.keys(offers).length);

// 檢查分組策略
const allOffers = tradeManager.getDefaultCaravanOffers();
const categorized = tradeManager.categorizeCompatibleOffers(allOffers);
console.log('分組結果:', Object.keys(categorized).map(group => 
    `${group}: ${Object.keys(categorized[group]).length}個`
));

// 手動調整選擇參數
tradeManager.updateCaravanSelectionRules({
    minOffersPerDay: 3,
    maxOffersPerDay: 5,
    preferredCategories: ['food_focused', 'materials_focused']
});
```

### Q4: 互助系統觸發機率過低
**症狀：** 租客間很少發生互助  
**檢查：**
```javascript
// 檢查互助配置
const config = tradeManager.tradeConfig;
console.log('互助機率:', config?.mutualAidProbability);
console.log('房東交易機率:', config?.landlordTradeProbability);

// 檢查租客資源分布
const tenants = gameState.getAllTenants();
const resourceStats = tenants.map(tenant => ({
    name: tenant.name,
    food: tenant.personalResources?.food || 0,
    cash: tenant.personalResources?.cash || 0,
    medical: tenant.personalResources?.medical || 0
}));
console.table(resourceStats);

// 手動觸發測試
const mutualResult = await tradeManager.processMutualAid();
console.log('互助測試結果:', mutualResult);
```

### Q5: 商人服務效果沒有正確執行
**症狀：** 購買商人服務後效果沒有生效  
**診斷：**
```javascript
// 檢查服務執行流程
const merchant = { name: '測試醫生', type: 'doctor' };
const serviceOffer = {
    type: 'service',
    service: 'healthCheck',
    price: 8
};

// 執行並檢查各步驟
console.log('1. 服務驗證:', tradeManager.validateMerchantTrade(merchant, serviceOffer));

const result = await tradeManager.processMerchantTrade(merchant, serviceOffer);
console.log('2. 服務執行結果:', result);

if (result.serviceResult) {
    console.log('3. 服務效果:', result.serviceResult);
    
    // 檢查具體效果是否生效
    switch (serviceOffer.service) {
        case 'healthCheck':
            const visitors = gameState.getStateValue('visitors', []);
            const infectedRevealed = visitors.filter(v => v.revealedInfection);
            console.log('4. 發現感染訪客:', infectedRevealed.length);
            break;
            
        case 'quickRepair':
            const rooms = gameState.getStateValue('rooms', []);
            const needsRepair = rooms.filter(r => r.needsRepair);
            console.log('4. 需維修房間:', needsRepair.length);
            break;
    }
}
```

### Q6: 交易匯率計算錯誤
**症狀：** 資源抵付金額不正確  
**檢查匯率配置：**
```javascript
// 檢查匯率載入
const exchangeRates = tradeManager.exchangeRates;
console.log('交易匯率:', exchangeRates);

// 手動計算測試
const testResources = { food: 5, materials: 2, medical: 1 };
Object.entries(testResources).forEach(([type, amount]) => {
    const rate = exchangeRates[type] || 1;
    const value = amount * rate;
    console.log(`${amount} ${type} = $${value} (匯率: ${rate})`);
});

// 檢查實際計算
const calculatedValue = tradeManager.calculateTradeValue(testResources);
console.log('計算總值:', calculatedValue);
```

### Q7: BaseManager事件前綴問題
**症狀：** 事件監聽器沒有收到事件  
**檢查事件命名：**
```javascript
// 檢查事件前綴解析
console.log('模組前綴:', tradeManager.getModulePrefix());

// 測試事件名稱解析
const testEvents = [
    'rentCollectionCompleted',    // 應該 → trade_rentCollectionCompleted
    'system_ready',              // 應該 → system_ready (系統級)
    'harvest_completed',         // 應該 → harvest_completed (業務級)
    'trade_existing'             // 應該 → trade_existing (已有前綴)
];

testEvents.forEach(event => {
    const resolved = tradeManager.resolveEventName(event);
    console.log(`${event} → ${resolved}`);
});

// 除錯事件命名
tradeManager.debugEventNaming();
```

---

## 📖 參考附錄

### TradeType聯合型別
```typescript
type TradeType = 'rent' | 'merchant' | 'caravan' | 'mutual_aid';
```

### 交易配置參考
```javascript
{
    rentBonusRate: 0.2,           // 加固房間租金加成比率
    mutualAidProbability: 0.3,    // 互助發生機率
    landlordTradeProbability: 0.25 // 房東交易機率
}
```

### 事件類型參考
```javascript
// TradeManager觸發的事件
'trade_rentCollectionCompleted'    // 租金收取完成
'trade_merchantTradeCompleted'     // 商人交易完成
'trade_caravanTradeCompleted'      // 商隊交易完成
'trade_mutualAidCompleted'         // 互助系統完成
'trade_initialized'                // 初始化完成
'trade_log_added'                  // 日誌添加
```

### 商隊交易完整清單（25種）
```javascript
// 基礎雙向交易
'fuel_for_food', 'cash_for_food', 'medical_for_food', 'food_for_materials',
'materials_for_cash', 'cash_for_materials', 'fuel_for_materials', 'materials_for_medical',
'cash_for_medical', 'medical_for_cash', 'medical_for_fuel',
'cash_for_fuel', 'materials_for_fuel', 'fuel_for_cash',

// 套餐組合
'survival_bundle', 'building_bundle', 'emergency_supplies', 'luxury_trade', 'resource_exchange',

// 特殊主題商隊
'military_surplus', 'medical_convoy', 'fuel_depot', 'food_caravan', 'scrap_dealer'
```

### 整合檢查清單
- [ ] TradeManager正確初始化
- [ ] 事件監聽器已設定
- [ ] UI更新邏輯已綁定  
- [ ] 錯誤處理已實作
- [ ] 除錯工具已配置
- [ ] 效能最佳化已應用
- [ ] 商隊選擇算法正常運作
- [ ] 互助系統參數合理
- [ ] 交易匯率配置正確

---

**開發指南版本：** v2.0  
**對應TradeManager版本：** v2.0 (BaseManager繼承版)  
**維護者：** 末日房東模擬器開發團隊
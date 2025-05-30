# 末日房東模擬器 - 架構設計文件

## 1. 專案概述

### 1.1 架構重構目標
本專案旨在將單體架構的末日房東模擬器重構為模組化系統，實現以下核心目標：

- **功能穩定性維持**：確保重構過程不影響現有遊戲功能
- **程式碼可維護性提升**：透過模組化降低耦合度，提高內聚性
- **系統擴展性增強**：建立資料驅動架構，支援快速功能迭代
- **開發效率優化**：分離關注點，允許並行開發不同模組

### 1.2 重構策略調整
**重要更新**：經過對話2A階段的技術驗證，專案策略已從「雙軌並行漸進重構」調整為「**直接模組分離重構**」。

**調整原因**：
1. **技術基礎充分**：核心架構系統已驗證可行
2. **對話效率考量**：避免單一檔案的長度限制問題
3. **開發體驗提升**：直接建立現代化的模組開發環境
4. **避免技術債務**：一次到位，避免二次重構成本

## 2. 架構設計

### 2.1 整體架構概覽（更新版）

```
┌─────────────────────────────────────────────────────────┐
│                    使用者介面層                          │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │    index.html   │  │   UIManager     │               │
│  │    (簡化結構)    │  │   (狀態管理)    │               │
│  └─────────────────┘  └─────────────────┘               │
└─────────────┬───────────────────┬───────────────────────┘
              │                   │
┌─────────────┴─────────────────┐ │
│           主程式層             │ │
│  ┌─────────────────────────┐  │ │
│  │       main.js           │  │ │
│  │    (應用程式進入點)      │  │ │
│  └─────────────────────────┘  │ │
└─────────────┬─────────────────┘ │
              │                   │
┌─────────────┴─────────────────┐ ┌┴─────────────────────────────┐
│         核心系統層             │ │          業務系統層           │
│  ┌─────────────────────────┐  │ │  ┌─────────────────────────┐ │
│  │     DataManager         │  │ │  │     TenantSystem        │ │
│  │    (資料管理核心)        │  │ │  │    (租客生命週期)        │ │
│  └─────────────────────────┘  │ │  └─────────────────────────┘ │
│  ┌─────────────────────────┐  │ │  ┌─────────────────────────┐ │
│  │     RuleEngine          │  │ │  │     SkillSystem         │ │
│  │    (規則執行引擎)        │  │ │  │    (技能執行管理)        │ │
│  └─────────────────────────┘  │ │  └─────────────────────────┘ │
│  ┌─────────────────────────┐  │ │  ┌─────────────────────────┐ │
│  │     GameBridge          │  │ │  │     EventSystem         │ │
│  │    (系統整合協調)        │  │ │  │    (事件觸發處理)        │ │
│  └─────────────────────────┘  │ │  └─────────────────────────┘ │
└───────────────────────────────┘ │  ┌─────────────────────────┐ │
                                  │  │    ResourceSystem       │ │
                                  │  │    (資源流轉控制)        │ │
                                  │  └─────────────────────────┘ │
                                  └──────────────────────────────┘
              │                                   │
┌─────────────┴─────────────────┐ ┌───────────────┴───────────────┐
│         工具函數層             │ │          資料配置層            │
│  ┌─────────────────────────┐  │ │  ┌─────────────────────────┐  │
│  │      helpers.js         │  │ │  │     JSON配置檔案        │  │
│  │    (工具與輔助函數)      │  │ │  │  - tenants.json         │  │
│  └─────────────────────────┘  │ │  │  - skills.json          │  │
└───────────────────────────────┘ │  │  - events.json          │  │
                                  │  │  - rules.json           │  │
                                  │  └─────────────────────────┘  │
                                  └───────────────────────────────┘
```


### 2.2 模組系統架構

#### 2.2.1 ES6 模組載入機制

**技術實作**：
```javascript
// main.js - 應用程式進入點
import { DataManager } from './core/DataManager.js';
import { RuleEngine } from './core/RuleEngine.js'; 
import { GameBridge } from './core/GameBridge.js';

import { TenantSystem } from './systems/TenantSystem.js';
import { SkillSystem } from './systems/SkillSystem.js';
import { EventSystem } from './systems/EventSystem.js';
import { ResourceSystem } from './systems/ResourceSystem.js';

import { UIManager } from './ui/UIManager.js';
import { ModalManager } from './ui/ModalManager.js';
```

**載入策略**：
- **同步載入核心系統**：DataManager、RuleEngine 優先載入
- **非同步載入業務系統**：TenantSystem 等可延遲初始化
- **按需載入UI模組**：減少初始載入時間

#### 2.2.2 檔案組織結構

```
src/
├── index.html                     # 主要HTML檔案
├── js/
│   ├── main.js                    # 應用程式進入點
│   ├── core/                      # 核心系統模組
│   │   ├── DataManager.js         # 資料管理核心
│   │   ├── RuleEngine.js          # 規則執行引擎
│   │   └── GameBridge.js          # 系統整合協調
│   ├── systems/                   # 業務系統模組
│   │   ├── TenantSystem.js        # 租客生命週期管理
│   │   ├── SkillSystem.js         # 技能執行管理
│   │   ├── EventSystem.js         # 事件觸發處理
│   │   └── ResourceSystem.js      # 資源流轉控制
│   ├── ui/                        # 使用者介面模組
│   │   ├── UIManager.js           # 介面狀態管理
│   │   ├── ModalManager.js        # 彈窗系統管理
│   │   └── DisplayUpdater.js      # 畫面更新邏輯
│   └── utils/
│       └── helpers.js             # 工具與輔助函數
├── data/                          # 遊戲配置檔案
│   ├── tenants.json               # 租客資料配置
│   ├── skills.json                # 技能系統配置
│   ├── events.json                # 事件系統配置
│   └── rules.json                 # 遊戲規則配置
└── css/
    └── main.css                   # 樣式檔案
```

## 3. 系統整合策略

### 3.1 模組間通信機制

**事件驅動架構**：
```javascript
// GameBridge 作為事件中心
class GameBridge extends EventTarget {
    emit(eventType, data) {
        this.dispatchEvent(new CustomEvent(eventType, { detail: data }));
    }
    
    on(eventType, handler) {
        this.addEventListener(eventType, handler);
    }
}

// 模組間通信範例
tenantSystem.on('tenant-hired', (event) => {
    skillSystem.updateAvailableSkills(event.detail.tenant);
    uiManager.updateTenantList();
});
```

### 3.2 依賴注入機制

**服務容器模式**：
```javascript
class ServiceContainer {
    constructor() {
        this.services = new Map();
    }
    
    register(name, service) {
        this.services.set(name, service);
    }
    
    get(name) {
        return this.services.get(name);
    }
}

// 統一的服務管理
const container = new ServiceContainer();
container.register('dataManager', dataManager);
container.register('ruleEngine', ruleEngine);
```

## 4. 部署與相容性

### 4.1 GitHub Pages 部署策略

**ES6 模組支援確認**：
- ✅ GitHub Pages 支援 ES6 模組載入
- ✅ 現代瀏覽器 (Chrome 61+, Firefox 60+, Safari 10.1+) 原生支援
- ✅ 透過 `type="module"` 屬性載入

**部署配置**：
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>末日房東模擬器</title>
    <link rel="stylesheet" href="css/main.css">
</head>
<body>
    <!-- 遊戲介面 -->
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

### 4.2 向後相容性策略

**漸進增強策略**：
```html
<!-- 現代瀏覽器使用 ES6 模組 -->
<script type="module" src="js/main.js"></script>

<!-- 舊版瀏覽器降級處理 -->
<script nomodule>
    alert('請使用現代瀏覽器獲得最佳體驗');
</script>
```

## 5. 開發工作流程

### 5.1 模組開發流程

1. **單一模組開發**：每個對話專注1-2個模組
2. **介面優先設計**：先定義模組介面，再實作細節
3. **漸進整合測試**：每個模組完成後立即整合測試
4. **文檔同步更新**：模組完成後更新相應文檔

### 5.2 品質保證機制

**模組驗證清單**：
- [ ] 模組介面定義清晰
- [ ] 依賴關係明確宣告
- [ ] 錯誤處理機制完善
- [ ] 與既有功能等價性驗證
- [ ] 效能表現不低於原版

## 6. 風險控制與應對

### 6.1 技術風險評估

| 風險項目 | 風險等級 | 影響評估 | 應對策略 |
|---------|---------|----------|----------|
| ES6 模組相容性 | 🟡 中等 | 舊版瀏覽器無法使用 | 提供降級提示，專注現代瀏覽器 |
| 檔案載入順序 | 🟢 低 | 模組依賴錯誤 | 明確依賴聲明，錯誤處理 |
| 效能回歸 | 🟡 中等 | 載入時間增加 | 模組按需載入，快取策略 |
| 功能破壞 | 🔴 高 | 遊戲功能失效 | 完整功能驗證，回歸測試 |

### 6.2 回滾策略

**多重備份機制**：
1. **版本控制**：Git 分支管理，每個重構階段一個分支
2. **功能驗證**：每次修改後完整功能測試
3. **漸進部署**：先在開發分支驗證，再合併到主分支

## 7. 後續發展規劃

### 7.1 短期目標（1個月內）
- [x] 核心架構系統完成
- [ ] **檔案分離重構完成**（3個對話）
- [ ] 基礎功能驗證通過
- [ ] 現代化開發環境建立

### 7.2 中期目標（3個月內）
- [ ] 進階遊戲功能開發
- [ ] 建構工具整合（Vite）
- [ ] 自動化測試框架
- [ ] 效能優化與監控

### 7.3 長期目標（6個月以上）
- [ ] 商業化功能準備
- [ ] 多平台部署支援
- [ ] 社群貢獻機制
- [ ] 技術架構輸出

## 8. 結論

本架構設計反映了專案從「雙軌並行」到「直接分離」的策略調整，基於前期技術驗證的充分準備，直接建立現代化的模組系統架構。這個決策將顯著提升開發效率，避免技術債務累積，並為專案的長期發展奠定堅實基礎。

**關鍵成功因素**：
1. **明確的模組邊界**：每個模組職責清晰，介面標準化
2. **穩健的整合機制**：事件驅動通信，依賴注入管理
3. **完善的品質保證**：功能驗證、效能測試、風險控制
4. **漸進的開發節奏**：分階段實施，持續驗證調整
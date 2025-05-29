# 末日房東模擬器 - 專案結構說明

## 📁 專案架構概覽

本專案採用**漸進式重構策略**，從單一HTML檔案架構演進為模組化系統。當前處於雙軌並行階段，支援傳統部署模式與現代化開發工作流程。

## 🏗️ 完整目錄結構

```
apocalypse-landlord-simulator/
├── README.md                          # 專案說明文件
├── PROJECT_STRUCTURE.md               # 本檔案 - 專案結構詳細說明
├── LICENSE                            # 開源授權協議
├── .gitignore                         # Git版本控制忽略規則
├── package.json                       # Node.js專案配置（對話3目標）
│
├── public/                            # 🌐 靜態資源目錄（對話3目標）
│   ├── favicon.ico                    # 網站圖示
│   ├── manifest.json                  # PWA配置
│   └── robots.txt                     # 搜尋引擎爬蟲規則
│
├── src/                               # 📁 原始碼目錄
│   ├── index.html                     # 原始單一檔案版本（保留參考）
│   ├── game-refactored.html           # ✅ 重構版本（當前主要版本）
│   │
│   ├── js/                           # 🔧 JavaScript模組目錄
│   │   ├── core/                     # 核心系統模組
│   │   │   ├── DataManager.js        # ✅ 資料管理核心
│   │   │   ├── RuleEngine.js         # ✅ 規則執行引擎
│   │   │   └── GameBridge.js         # ✅ 新舊系統橋接器
│   │   │
│   │   ├── systems/                  # 🎮 遊戲系統模組
│   │   │   ├── TenantSystem.js       # 🔄 租客系統管理（對話2A目標）
│   │   │   ├── SkillSystem.js        # 🔄 技能系統執行（對話2A目標）
│   │   │   ├── EventSystem.js        # 📋 事件系統觸發（對話2B目標）
│   │   │   ├── ResourceSystem.js     # 📋 資源流轉控制（對話3目標）
│   │   │   └── BuildingSystem.js     # 📋 建築系統管理（對話3目標）
│   │   │
│   │   ├── ui/                       # 🖥️ 使用者介面模組
│   │   │   ├── UIManager.js          # 📋 介面狀態管理（對話2B目標）
│   │   │   ├── ModalManager.js       # 📋 彈窗系統管理（對話2B目標）
│   │   │   ├── DisplayUpdater.js     # 📋 畫面更新邏輯（對話2B目標）
│   │   │   └── InteractionHandler.js # 📋 使用者互動處理（對話3目標）
│   │   │
│   │   ├── utils/                    # 🛠️ 工具函數模組
│   │   │   ├── helpers.js            # ✅ 通用輔助函數
│   │   │   ├── validators.js         # 📋 資料驗證工具（對話3目標）
│   │   │   ├── constants.js          # 📋 常數定義（對話3目標）
│   │   │   └── formatters.js         # 📋 格式化工具（對話3目標）
│   │   │
│   │   └── main.js                   # 🚀 主程式進入點（對話3目標）
│   │
│   ├── data/                         # 📊 遊戲資料配置目錄
│   │   ├── tenants.json              # ✅ 租客資料配置
│   │   ├── skills.json               # ✅ 技能系統配置
│   │   ├── events.json               # ✅ 事件系統配置
│   │   ├── rules.json                # ✅ 遊戲規則配置（已重構）
│   │   └── localization/             # 🌍 本地化資料（未來擴展）
│   │       ├── zh-TW.json            # 繁體中文
│   │       └── en-US.json            # 英文
│   │
│   └── css/                          # 🎨 樣式檔案目錄（對話3目標）
│       ├── main.css                  # 主要樣式
│       ├── components.css            # 元件樣式
│       ├── themes.css                # 主題樣式
│       └── responsive.css            # 響應式設計
│
├── dist/                             # 📦 建構輸出目錄（對話3目標）
│   ├── index.html                    # 建構後的HTML
│   ├── assets/                       # 建構後的資源
│   └── ...                           # 其他建構產物
│
├── docs/                             # 📚 專案文件目錄
│   ├── architecture.md              # ✅ 架構設計文件
│   ├── api.md                        # 📋 API文件（對話2B目標）
│   ├── development.md                # 🔧 開發環境指南（對話3目標）
│   ├── deployment.md                 # 🚀 部署說明文件（對話3目標）
│   └── changelog.md                  # 📈 版本更新記錄
│
├── tests/                           # 🧪 測試檔案目錄（對話3目標）
│   ├── unit/                        # 單元測試
│   │   ├── core/                    # 核心系統測試
│   │   ├── systems/                 # 遊戲系統測試
│   │   └── utils/                   # 工具函數測試
│   ├── integration/                 # 整合測試
│   │   ├── system-bridge.test.js   # 系統橋接測試
│   │   └── data-consistency.test.js # 資料一致性測試
│   └── fixtures/                    # 測試資料夾具
│       ├── game-states/             # 遊戲狀態測試資料
│       └── config-samples/          # 配置檔案範例
│
└── tools/                           # 🔨 開發工具目錄（對話3目標）
    ├── build.js                     # 建構腳本
    ├── deploy.js                    # 部署腳本
    ├── validate-config.js           # 配置檔案驗證工具
    └── generate-docs.js             # 自動文件生成工具
```

## 📋 檔案狀態說明

### 圖例
- ✅ **已完成**：檔案已實作並經過驗證
- 🔄 對話2A目標：核心業務系統重構階段
- 📋 對話2B目標：UI架構與事件系統階段
- 📋 對話3目標：系統整合與品質保證階段
- 🌍 **未來擴展**：長期規劃功能

### 當前階段檔案分佈

**對話一已完成（✅）**：
- 核心架構系統：`DataManager.js`、`RuleEngine.js`、`GameBridge.js`
- 資料配置體系：`tenants.json`、`skills.json`、`events.json`、`rules.json`
- 整合實作：`game-refactored.html`
- 工具模組：`helpers.js`
- 架構文件：`architecture.md`
- 技術債務清理：rules.json架構統一化重構

### 當前階段（🔄）
**對話2A：核心業務系統重構**
- `TenantSystem.js`：租客生命週期管理
- `SkillSystem.js`：技能效果計算與執行
- 功能等價性驗證機制
- 新舊系統行為一致性測試

### 後續階段（📋）
**對話2B：UI架構與事件系統**
- `EventSystem.js`：事件觸發與動態內容生成
- `UIManager.js`：介面狀態統一管理
- `ModalManager.js`：彈窗系統標準化
- `DisplayUpdater.js`：畫面更新邏輯分離
- API文件：詳細的模組介面文件

**對話3：系統整合與品質保證**
- `ResourceSystem.js`：資源流轉與平衡控制
- 完整測試體系：單元測試、整合測試、回歸測試
- 建構工具整合：Vite建構系統
- 現代化開發工作流程：多檔案架構遷移

## 🏗️ 架構層次說明

### 第一層：核心基礎設施（Core Infrastructure）
**狀態**：✅ 已完成  
**職責**：負責系統最基本的資料管理、規則執行、系統橋接功能。這一層為所有上層模組提供穩定的技術基礎。

**關鍵模組**：
- `DataManager`：統一資料存取與快取管理
- `RuleEngine`：聲明式規則執行引擎
- `GameBridge`：新舊系統橋接與相容性保證

### 第二層：業務邏輯系統（Business Logic Systems）
**狀態**：🔄 對話2A進行中，📋 對話2B/3規劃中  
**職責**：實作具體的遊戲業務邏輯，每個系統負責特定的功能領域，透過標準化介面與其他系統協作。

**關鍵系統**：
- `TenantSystem`：租客生命週期與行為管理
- `SkillSystem`：技能效果計算與執行控制
- `EventSystem`：事件觸發與動態內容生成
- `ResourceSystem`：資源流轉與平衡控制

### 第三層：使用者介面層（User Interface Layer）
**狀態**：📋 對話2B/3規劃中  
**職責**：處理所有與使用者互動相關的邏輯，包括畫面更新、事件處理、狀態展示等功能。

**關鍵模組**：
- `UIManager`：統一的介面狀態管理
- `ModalManager`：彈窗系統的生命週期控制
- `DisplayUpdater`：高效能的畫面更新機制

### 第四層：工具與輔助（Utilities and Helpers）
**狀態**：✅ 部分完成，📋 持續擴展  
**職責**：提供跨模組的通用功能，包括資料驗證、格式化、輔助計算等工具函數。

**關鍵工具**：
- `helpers.js`：通用輔助函數集
- `validators.js`：資料驗證工具
- `formatters.js`：格式化與轉換工具

## 🔧 開發工作流程

### 檔案依賴關係
```
game-refactored.html
├── core/
│   ├── DataManager.js ✅
│   ├── RuleEngine.js ✅
│   └── GameBridge.js ✅
├── systems/
│   ├── TenantSystem.js 🔄 → core/, utils/
│   ├── SkillSystem.js 🔄 → core/, utils/
│   ├── EventSystem.js 📋 → core/, utils/
│   └── ResourceSystem.js 📋 → core/, utils/
├── ui/
│   ├── UIManager.js 📋 → systems/, utils/
│   ├── ModalManager.js 📋 → utils/
│   └── DisplayUpdater.js 📋 → systems/, utils/
└── utils/
    ├── helpers.js ✅
    ├── validators.js 📋
    └── formatters.js 📋
```

### 模組載入順序
1. **基礎設施載入**：`utils/` → `core/`
2. **業務系統載入**：`systems/`
3. **介面系統載入**：`ui/`
4. **主程式初始化**：`main.js`

## 📊 資料流架構

### 資料來源層次
```
JSON配置檔案 → DataManager → 業務系統 → UI展示
     ↓              ↓           ↓         ↓
   驗證快取        規則執行    狀態管理   使用者互動
```

### 狀態管理機制
- **全域狀態**：`gameState` 物件統一管理
- **模組狀態**：各系統內部狀態獨立管理
- **UI狀態**：介面相關狀態單獨維護
- **快取狀態**：`DataManager` 負責資料快取

## 🚀 部署策略

### 開發環境
- 使用 `src/game-refactored.html` 直接開發測試
- 模組化檔案透過 `<script type="module">` 載入
- 本地開發伺服器支援即時重載

### 生產環境（GitHub Pages）
- **當前階段**：直接部署 `game-refactored.html`
- **對話2B後**：保持單檔案部署相容性
- **對話3**：使用 Vite 打包為 `dist/` 目錄
- 階段三：完整的 CI/CD 自動化部署

### 版本管理策略
- `main` 分支：穩定的生產版本
- `develop` 分支：開發版本整合
- `feature/*` 分支：特定功能開發
- `release/*` 分支：版本發布準備

## 📈 技術里程碑

### 版本規劃
- **v1.0** - 混合架構基礎（✅ 已完成）
- **v1.1** - 核心業務模組化（🔄 對話2A進行中）
- **v1.2** - UI架構重構（📋 對話2B目標）
- **v2.0** - 完整模組化系統（📋 對話3目標）

## 📈 後續發展規劃

### 對話二階段重點
- 業務系統模組化完成
- UI架構重構實現
- 測試框架建立與驗證

### 對話三階段規劃
- 完整的多檔案架構遷移
- Vite建構工具整合
- 現代化開發工作流程建立

### 長期技術路線
- PWA漸進式網頁應用支援
- 多語言國際化實現
- 商業化部署架構準備

此專案結構設計基於軟體工程最佳實踐，確保了程式碼的可維護性、可擴展性與可部署性，為專案的長期發展奠定了堅實的技術基礎。
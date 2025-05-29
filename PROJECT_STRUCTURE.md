# 末日房東模擬器 - 專案結構說明

## 📁 專案架構概覽

本專案採用**漸進式重構策略**，從單一HTML檔案架構演進為模組化系統。當前處於對話2A完成階段，已建立完整的業務系統核心架構。

## 🏗️ 完整目錄結構

```
apocalypse-landlord-simulator/
├── README.md                          # 專案說明文件
├── PROJECT_STRUCTURE.md               # 本檔案 - 專案結構與進度追蹤
├── LICENSE                            # 開源授權協議
├── .gitignore                         # Git版本控制忽略規則
├── package.json                       # Node.js專案配置（未來Vite使用）
│
├── public/                            # 🌐 靜態資源目錄
│   ├── favicon.ico                    # 網站圖示
│   ├── manifest.json                  # PWA配置（未來擴展）
│   └── robots.txt                     # 搜尋引擎爬蟲規則
│
├── src/                               # 📁 原始碼目錄
│   ├── index.html                     # 原始單一檔案版本（保留參考）
│   ├── game-refactored.html           # ✅ 重構版本 v1.1（當前主要版本）
│   │
│   ├── js/                           # 🔧 JavaScript模組目錄
│   │   ├── core/                     # 核心系統模組
│   │   │   ├── DataManager.js        # ✅ 資料管理核心
│   │   │   ├── RuleEngine.js         # ✅ 規則執行引擎
│   │   │   └── GameBridge.js         # ✅ 新舊系統橋接器
│   │   │
│   │   ├── systems/                  # 🎮 遊戲系統模組
│   │   │   ├── TenantSystem.js       # ✅ 租客系統管理（內嵌於主檔案）
│   │   │   ├── SkillSystem.js        # ✅ 技能系統執行（內嵌於主檔案）
│   │   │   ├── EventSystem.js        # 📋 事件系統觸發（對話2B目標）
│   │   │   ├── ResourceSystem.js     # 📋 資源流轉控制（對話2B目標）
│   │   │   └── BuildingSystem.js     # 🚀 建築系統管理（對話3目標）
│   │   │
│   │   ├── ui/                       # 🖥️ 使用者介面模組
│   │   │   ├── UIManager.js          # 📋 介面狀態管理（對話2B目標）
│   │   │   ├── ModalManager.js       # 📋 彈窗系統管理（對話2B目標）
│   │   │   ├── DisplayUpdater.js     # 📋 畫面更新邏輯（對話2B目標）
│   │   │   └── InteractionHandler.js # 🚀 使用者互動處理（對話3目標）
│   │   │
│   │   ├── utils/                    # 🛠️ 工具函數模組
│   │   │   ├── helpers.js            # ✅ 通用輔助函數
│   │   │   ├── validators.js         # 📋 資料驗證工具（對話2B目標）
│   │   │   ├── constants.js          # 📋 常數定義（對話2B目標）
│   │   │   └── formatters.js         # 🚀 格式化工具（對話3目標）
│   │   │
│   │   └── main.js                   # 🚀 主程式進入點（對話3目標）
│   │
│   ├── data/                         # 📊 遊戲資料配置目錄
│   │   ├── tenants.json              # ✅ 租客資料配置
│   │   ├── skills.json               # ✅ 技能系統配置
│   │   ├── events.json               # ✅ 事件系統配置
│   │   ├── rules.json                # ✅ 遊戲規則配置
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
├── dist/                             # 📦 建構輸出目錄（對話3使用）
│   ├── index.html                    # 建構後的HTML
│   ├── assets/                       # 建構後的資源
│   └── ...                           # 其他建構產物
│
├── docs/                             # 📚 專案文件目錄
│   ├── architecture.md              # ✅ 架構設計文件
│   ├── api.md                        # 📋 API文件（對話2B目標）
│   ├── development.md                # 🔧 開發環境指南
│   ├── deployment.md                 # 🚀 部署說明文件
│   └── changelog.md                  # 📈 版本更新記錄
│
├── tests/                           # 🧪 測試檔案目錄（對話2B重點）
│   ├── unit/                        # 單元測試
│   │   ├── core/                    # 核心系統測試
│   │   ├── systems/                 # 遊戲系統測試
│   │   └── utils/                   # 工具函數測試
│   ├── integration/                 # 整合測試
│   │   ├── system-bridge.test.js   # 系統橋接測試
│   │   ├── business-systems.test.js # 業務系統測試（新增）
│   │   └── data-consistency.test.js # 資料一致性測試
│   └── fixtures/                    # 測試資料夾具
│       ├── game-states/             # 遊戲狀態測試資料
│       └── config-samples/          # 配置檔案範例
│
└── tools/                           # 🔨 開發工具目錄
    ├── build.js                     # 建構腳本
    ├── deploy.js                    # 部署腳本
    ├── validate-config.js           # 配置檔案驗證工具
    └── generate-docs.js             # 自動文件生成工具
```

## 📋 檔案狀態說明

### 狀態圖例
- ✅ **已完成**：檔案已實作並經過驗證
- 📋 **對話2B目標**：下階段主要實作目標
- 🚀 **對話3目標**：後續階段實作目標
- 🌍 **未來擴展**：長期規劃功能

### 當前進度分佈

**對話2A已完成（✅）**：
- 核心架構系統：`DataManager.js`、`RuleEngine.js`、`GameBridge.js`
- 業務系統核心：`TenantSystem`（內嵌）、`SkillSystem`（內嵌）
- 資料配置體系：`tenants.json`、`skills.json`、`events.json`、`rules.json`
- 整合實作：`game-refactored.html` v1.1版本
- 工具模組：`helpers.js`
- 架構文件：`architecture.md`

**對話2B目標（📋）**：
- 業務系統擴展：`EventSystem.js`、`ResourceSystem.js`
- UI架構初期：`UIManager.js`、`ModalManager.js`、`DisplayUpdater.js`
- 測試框架：完整的業務系統測試機制
- 工具擴展：`validators.js`、`constants.js`
- API文件：`api.md`

**對話3目標（🚀）**：
- 完整模組分離：`main.js`、獨立CSS檔案
- 進階UI模組：`InteractionHandler.js`
- 建構系統：完整的Vite工作流程
- 工具完善：`formatters.js`

## 📊 開發進度追蹤

### 系統完成度
- **核心基礎設施**：100% ✅
- **業務邏輯系統**：60% 🟡（TenantSystem✅、SkillSystem✅、EventSystem📋、ResourceSystem📋）
- **使用者介面層**：10% 🔴（基礎監控✅、管理模組📋）
- **工具與輔助**：30% 🟡（helpers✅、其他📋）

### 版本歷程
- **v1.0**：基礎架構版本（對話1成果）
- **v1.1**：業務系統核心版本（對話2A成果）✅ 當前版本
- **v1.2**：系統深化版本（對話2B目標）📋
- **v2.0**：完整模組化版本（對話3目標）🚀

### 檔案規模變化
- **原始版本**：單一HTML檔案，約3000+行程式碼
- **v1.1版本**：單一HTML檔案 + 內嵌模組化，約4000+行（含業務系統）
- **預期v2.0**：多檔案模組架構，預估15+個獨立檔案

## 🎯 下階段準備狀態

### 對話2B技術基礎
- ✅ TenantSystem 和 SkillSystem 完整實作
- ✅ 系統代理機制建立
- ✅ JSON配置體系穩定
- ✅ 狀態監控介面就緒

### 待解決的技術債務
- EventSystem 和 ResourceSystem 模組化
- 完整功能等價性測試框架
- UI更新機制的效能優化
- 系統間協作的錯誤處理強化

### 檔案變更預期
**對話2B預期新增/修改**：
- 新增：EventSystem、ResourceSystem 類別（內嵌方式）
- 新增：UIManager 等UI管理模組（內嵌方式）
- 修改：game-refactored.html 升級至 v1.2
- 新增：測試相關檔案

---

**專案目前狀態**：混合架構 v1.1，核心業務系統85%完成，準備進入系統深化階段。詳細的架構設計原理請參考 `docs/architecture.md`。
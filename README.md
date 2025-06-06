# 末日房東模擬器 - Apocalypse Landlord Simulator

一個基於末日殭屍背景的房東租屋經營遊戲，採用現代化模組重構策略，從單體架構演進為 ES6 模組系統。

## 🎮 遊戲特色

- **末日背景設定**：在殭屍橫行的世界中經營租屋事業
- **策略性租客管理**：平衡租客技能與感染風險
- **資源管理挑戰**：合理分配食物、建材、醫療用品等資源
- **動態事件系統**：隨機事件與租客互動豐富遊戲體驗
- **技能系統**：不同職業租客提供獨特技能和服務

## 🚀 快速開始

### 推薦遊玩方式
1. 下載 `src/game-refactored.html` 檔案（當前 v1.1 版本）
2. 使用任何現代瀏覽器開啟檔案
3. 開始您的末日房東之旅

### 替代版本
- `src/index.html`：v2.0-rc 模組化版本（UI基礎架構完成）

### 遊戲目標
- 招募合適的租客並管理其需求
- 維持房屋防禦以抵禦殭屍威脅
- 平衡資源收支確保長期生存
- 善用租客技能應對各種挑戰

## 📁 專案結構

```
├── README.md                      # 📖 專案說明文件（本檔案）
├── PROJECT_STRUCTURE.md           # 📋 完整專案結構說明
└── src/
    ├── game-refactored.html       # 🎮 穩定版本 v1.1（推薦使用）
    ├── index.html                 # 🚀 重構版本 v2.0-rc（UI基礎架構完成）
    ├── js/                        # 🔧 JavaScript模組目錄（15個模組）
    ├── css/                       # 🎨 CSS模組目錄（模組化樣式）
    ├── data/                      # 📊 遊戲配置檔案
    │   ├── tenants.json           # 租客資料配置
    │   ├── skills.json            # 技能系統配置
    │   ├── events.json            # 事件系統配置
    │   └── rules.json             # 遊戲規則配置（擴展版）
    └── docs/
        └── architecture.md        # 架構設計文件
```

## 🎯 當前版本特色 v2.0-rc

### UI基礎架構模組化完成
本專案採用**直接模組分離重構策略**，當前版本 v2.0-rc 實現完整UI基礎架構：

- **UIManager**：UI系統統一協調，模組整合管理
- **DisplayUpdater**：純畫面更新邏輯，DOM操作統一管理
- **ModalManager**：模態框動態內容生成，統一狀態管理
- **InteractionHandler**：事件路由分發，快捷鍵管理
- **CSS模組化**：main.css + components.css 分離式架構

### 技術亮點
- **完全UI/業務分離**：main.js移除150行UI邏輯，專注業務協調
- **事件驅動UI通信**：標準化模組間協作機制
- **DOM元素快取**：高效能顯示更新系統
- **節流更新機制**：~60fps流暢用戶體驗
- **降級處理機制**：完備的後備模式支援

## 📊 系統狀態監控

遊戲右上角顯示當前系統狀態：
- 🟢 完整模組化系統 v2.0 - 運行中：UI基礎架構完整
- 🟡 部分模組化系統 v2.0 - 降級模式：部分UI功能使用後備
- 🔴 系統啟動失敗：需要檢查瀏覽器支援度

## 🎲 遊戲機制

### 租客系統
- **5種職業類型**：醫生、工人、農夫、軍人、老人
- **個人資源管理**：每位租客擁有獨立的資源與現金
- **滿意度系統**：租客滿意度影響續租意願和互動效果
- **感染風險**：部分申請者可能已被感染，需要謹慎篩選

### 技能系統
每種職業提供獨特技能：
- **醫生**：治療感染、健康檢查、醫療生產
- **工人**：專業維修、房間加固、建築升級
- **農夫**：作物種植、野外採集、食物保存
- **軍人**：夜間警戒、防禦建設、巡邏系統
- **老人**：糾紛調解、生活指導、人際網絡

### 資源管理
- **食物**：房東和租客的基本生存需求
- **建材**：房屋維修和防禦升級材料
- **醫療用品**：治療疾病和檢測感染的必需品
- **燃料**：維持房屋基本運作的能源
- **現金**：支付租客服務和應急開支

### 事件系統
- **隨機事件**：殭屍襲擊、商隊過路等意外狀況
- **衝突事件**：租客糾紛、資源分配問題
- **特殊事件**：醫療緊急狀況、建築危機
- **動態選擇**：基於租客類型和遊戲狀態生成選項

## 🔄 重構進展

### 當前狀態：UI基礎架構完成 v2.0-rc ✅
- ✅ **核心架構系統**（DataManager、RuleEngine、GameBridge）
- ✅ **配置驅動體系**（rules.json 集中配置，helpers.js v2.0）
- ✅ **統一驗證機制**（validators.js 統一驗證邏輯）
- ✅ **系統級常數**（constants.js 純技術常數管理）
- ✅ **業務邏輯模組**（TRES四大模組：TenantSystem、ResourceSystem、EventSystem、SkillSystem）
- ✅ **UI基礎架構**（UIManager、ModalManager、DisplayUpdater、InteractionHandler）
- ⚠️ **UI具體功能**（基本功能完成，進階功能需補完）

### 下一階段：UI功能補完 v2.0 ⚠️
**重構目標**：基於已完成的UI基礎架構，補完具體功能實作。

**重構進度**：
- ✅ **對話3A**：配置驅動核心架構（DataManager, RuleEngine, GameBridge, helpers, validators, constants）
- ✅ **對話3B**：業務系統分離（TenantSystem, SkillSystem, ResourceSystem, EventSystem）
- ✅ **對話3C**：UI基礎架構（UIManager, ModalManager, DisplayUpdater, InteractionHandler, CSS模組化）
- ⚠️ **對話3D**：UI功能補完（租客管理模態框、事件系統UI、按鈕狀態管理等）

**當前缺失功能**：
- ⚠️ 租客管理模態框詳細功能（60%完成）
- ⚠️ 事件系統模態框處理（10%完成）
- ⚠️ 按鈕狀態動態管理（部分完成）
- ⚠️ 房間互動詳細功能（基本完成）

**技術優勢**：
- **UI/業務徹底分離**：main.js專注業務邏輯，UI模組專責畫面
- **事件驅動架構**：標準化模組間通信機制
- **模組化開發**：支援並行開發不同功能模組
- **現代化基礎**：為商業化發展建立堅實技術基礎

## 🤖 AI輔助開發聲明

本專案採用**人機協作模式**進行開發：

### 技術實作（AI輔助）
- **UI系統架構**：UIManager、ModalManager、DisplayUpdater、InteractionHandler完整設計
- **業務邏輯模組**：TenantSystem、SkillSystem、ResourceSystem 完整實作
- **配置驅動架構**：rules.json、validators.js、constants.js 設計與實作
- **CSS模組化**：main.css、components.css 分離式架構
- **遊戲配置**：JSON配置檔案的結構設計與內容
- **架構設計**：模組化架構規劃與技術決策
- **文件撰寫**：技術文件、API說明、開發指南

### 開發管理（人類主導）
- **需求分析**：遊戲功能規劃與優先級設定
- **技術決策**：最終架構選擇與實施策略
- **品質把關**：功能驗證、效能測試、使用者體驗
- **專案規劃**：開發節奏、里程碑設定、風險管理

### 協作優勢
- **效率提升**：AI處理繁重的程式碼實作，人類專注創意與決策
- **品質保證**：AI提供技術最佳實踐，人類確保實用性與可維護性  
- **學習加速**：透過協作過程深度理解現代化開發架構
- **創新可能**：結合AI的技術能力與人類的創意思維

## 📚 文件資源

- **[架構設計文件](docs/architecture.md)**：詳細的技術架構說明和重構策略
- **[專案結構說明](PROJECT_STRUCTURE.md)**：完整的檔案組織和開發規劃

## 🚧 開發狀態

### 已完成功能 v2.0-rc ✅
- ✅ **完整模組化架構**（15個獨立模組檔案）
- ✅ **配置驅動核心**（DataManager v2.0、RuleEngine、GameBridge）
- ✅ **業務邏輯系統**（TRES四大模組完整實作）
- ✅ **UI基礎架構**（UIManager、ModalManager、DisplayUpdater、InteractionHandler）
- ✅ **CSS模組化**（main.css + components.css 分離式架構）
- ✅ **事件驅動通信**（標準化模組間協作機制）

### 進行中功能 ⚠️
- ⚠️ **UI功能補完**（對話3D目標）
- ⚠️ 租客管理模態框詳細功能
- ⚠️ 事件系統模態框處理
- ⚠️ 按鈕狀態動態管理系統

### 計劃功能 📋
- 📋 建構工具整合（Vite工作流程）
- 📋 自動化測試框架
- 📋 效能優化與監控
- 📋 商業化功能準備

## 🎯 技術特點

### 完整模組化開發架構
- **ES6 模組系統**：真正的模組化開發體驗
- **UI/業務徹底分離**：main.js專注業務邏輯，UI模組專責畫面
- **事件驅動通信**：模組間透過事件進行協作
- **配置驅動設計**：rules.json 集中管理所有參數
- **統一驗證機制**：validators.js 提供完整資料驗證

### 部署與相容性
- **零依賴**：不需要外部函式庫或框架
- **GitHub Pages 原生支援**：ES6模組直接部署
- **現代瀏覽器最佳化**：專注現代瀏覽器體驗
- **漸進增強**：向下相容性友好提示

### 開發體驗
- **模組化協作**：支援並行開發不同模組
- **配置驅動調整**：遊戲參數無需修改程式碼
- **即時驗證**：每個模組完成後立即整合測試
- **清晰架構**：職責分離，介面標準化
- **擴展就緒**：為商業化發展奠定基礎

## 🐛 問題回報

如果您遇到任何問題或有改進建議，請：
1. 檢查遊戲中的系統狀態指示器
2. 開啟瀏覽器開發者工具查看控制台訊息
3. 參考架構文件了解系統運作原理

## 📄 版權與使用條款

### 版權聲明
本專案及其所有內容（包括但不限於程式碼、文件、配置檔案、設計資源）均保留所有權利。

**Copyright © 2024. All Rights Reserved.**

### 使用許可
在版權法律框架明確AI生成內容歸屬前，本專案採用保守授權策略：

**✅ 允許用途**：
- 個人學習與研究
- 學術引用（需註明來源）
- 非商業性質的技術參考

**❌ 限制用途**：
- 商業使用或分發
- 修改後重新發布
- 移除版權聲明

### 法律考量說明
由於本專案大量使用AI輔助生成內容，在當前法律環境下，AI生成作品的版權歸屬存在不確定性。為避免潛在法律風險，暫採用保留版權的策略。

**未來授權規劃**：
待相關法律框架明確後，將考慮採用更開放的授權模式（如MIT、Apache 2.0等）。

---

**專案狀態**：UI基礎架構完成 v2.0-rc（90%完成）→ UI功能補完 v2.0（最終目標）  
**技術基礎**：完整模組化架構 + UI基礎設施已建立  
**預期時程**：1個對話完成功能補完  
**商業價值**：現代化架構為商業化發展奠定基礎
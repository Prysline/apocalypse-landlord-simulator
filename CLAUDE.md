# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

末日房東模擬器 - 基於 ES6 模組的單頁面遊戲應用，採用現代化模組架構。這是一個零外部依賴的純前端遊戲，使用配置驅動設計和事件通信機制。

## 快速開始

### 啟動遊戲
```bash
# 使用現代瀏覽器開啟
open src/index.html
# 或啟用除錯模式
open "src/index.html?debug=true"
```

### 除錯工具
```javascript
// 瀏覽器控制台命令
gameApp.debug()                                    // 完整系統狀態
gameApp.gameState.getStateStats()                  // 遊戲狀態統計
gameApp.tradeManager.getTradeStats()               // 交易系統統計
gameApp.tenantManager.validateIDSystemIntegrity()  // ID系統完整性檢查
```

## 核心架構

### 系統層級 (src/js/core/)
- **main.js**: 應用程式進入點，負責模組初始化和依賴注入
- **DataManager.js**: 並行載入 JSON 配置檔案，統一資料管理
- **GameState.js**: 中央狀態管理，支援路徑式存取和統一人物ID系統
- **EventBus.js**: 事件驅動通信，支援智慧前綴解析和模組解耦
- **LoadingManager.js**: 初始化進度管理和視覺回饋

### 業務邏輯層 (src/js/systems/)
- **ResourceManager.js**: 資源流轉控制和狀態監控
- **TenantManager.js**: 租客生命週期管理和關係追蹤
- **TradeManager.js**: 統一交易系統入口，整合所有交易類型
- **SkillManager.js**: 技能執行管理和效果處理
- **DayManager.js**: 每日循環處理和事件觸發
- **CommissionHandler.js**: 委託探索系統邏輯

### UI層 (src/js/ui/)
- **UICore.js**: UI系統統一對外介面，協調所有UI模組
- **UIDisplay.js**: DOM更新和畫面渲染邏輯
- **UIModal.js**: 基礎模態框管理
- **modal/*.js**: 各種具體模態框實作（租客、交易、技能等）

### 配置層 (src/data/)
所有遊戲參數來自 JSON 檔案，支援熱更新無需重新部署：
- **rules.json**: 遊戲規則和平衡參數
- **tenants.json**: 租客類型和屬性配置
- **skills.json**: 技能系統配置
- **events.json**: 事件系統配置

## 開發規範

### 模組通信
使用 EventBus 進行模組間通信，避免直接依賴：
```javascript
// 發送事件
this.eventBus.emit('resource_updated', { type: 'food', amount: 10 });

// 監聽事件
this.eventBus.on('tenant_moved_in', (data) => {
  // 處理租客入住事件
});
```

### 狀態管理
使用 GameState 進行統一狀態管理：
```javascript
// 路徑式存取
gameState.getByPath('landlord.cash');
gameState.setByPath('tenants.1.satisfaction', 85);

// 批量更新
gameState.batchUpdate({
  'resources.food': 25,
  'landlord.day': 2
});
```

### 配置存取
透過 DataManager 存取配置：
```javascript
const tenantTypes = dataManager.getData('tenants');
const gameRules = dataManager.getData('rules');
```

### 日誌系統
使用 SystemLogger，會根據除錯模式自動調整輸出：
```javascript
import systemLogger from '../utils/SystemLogger.js';

systemLogger.info("一般資訊");
systemLogger.debug("除錯資訊"); // 只在除錯模式顯示
systemLogger.error("錯誤資訊", error);
systemLogger.success("成功訊息");
```

## 資料結構

### 統一人物ID系統
所有人物（租客、訪客、申請者）使用統一ID系統：
- 租客ID：T001, T002...
- 訪客ID：V001, V002...
- 申請者ID：A001, A002...

### 遊戲狀態結構
```javascript
gameState = {
  landlord: { day, time, cash, hunger, ... },
  resources: { food, materials, medical, fuel },
  rooms: [{ tenant, needsRepair, reinforced }],
  tenants: { T001: { name, job, satisfaction, ... } },
  visitors: { V001: { name, type, offerings, ... } },
  // ...
}
```

## 常見開發任務

### 新增遊戲功能
1. 在對應的 Manager 類別中實作業務邏輯
2. 更新相關 JSON 配置檔案
3. 在 UICore 中新增對外介面
4. 透過 EventBus 通知其他模組

### 修改遊戲參數
直接編輯 `src/data/*.json` 檔案，無需修改程式碼

### 新增事件類型
1. 在 `src/data/events.json` 中定義事件配置
2. 在 EventSystem.js 中實作事件邏輯
3. 透過 DayManager 觸發事件

### UI 功能修改
1. 在對應的 modal/*.js 檔案中修改模態框邏輯
2. 在 UIDisplay.js 中更新畫面渲染
3. 確保透過 UICore 暴露必要的對外介面

## 技術特點

### 零外部依賴
專案不使用任何外部框架或函式庫，完全基於原生 ES6 模組

### GitHub Pages 原生支援
可直接部署到 GitHub Pages，無需建置過程

### 配置驅動熱更新
修改 JSON 檔案後重新載入頁面即可生效

### 記憶體和效能優化
- 自動清理歷史記錄防止記憶體洩漏
- 事件節流機制保證介面響應性
- DOM 元素快取減少重複查詢

## 除錯指南

### 系統狀態檢查
遊戲右上角顯示系統狀態：
- 🟢 系統就緒：正常運行
- 🟡 降級模式：部分功能使用後備機制
- 🔴 載入失敗：檢查瀏覽器相容性

### 常見問題
- **模組載入失敗**：檢查 ES6 模組支援（Chrome 61+, Firefox 60+, Safari 10.1+）
- **資料載入錯誤**：檢查 JSON 檔案格式和路徑
- **事件未觸發**：確認 EventBus 事件名稱和監聽器註冊

### 效能監控
```javascript
// 檢查載入狀態
loadingManager.getStatus();

// 檢查記憶體使用
gameState.getStateStats();

// 檢查事件統計
eventBus.getStats();
```
# 專案開發指南與規範

請遵循以下專案開發指南與規範：

## 核心架構
- **技術棧**：ES6 模組化、配置驅動、事件通信
- **核心組件**：DataManager, GameState, EventBus
- **依賴**：零外部依賴

## 系統設計原則
- **配置管理**：使用 `rules.json` 進行集中配置
- **驗證機制**：採用 `validators.js` 實現輕量級驗證
- **系統整合**：透過 `main.js` 協調各組件，並使用 `index.html` 進行測試

## 開發規範
- **原則**：遵循 DRY (Don't Repeat Yourself) 和 YAGNI (You Aren't Gonna Need It)
- **程式碼修改**：
  - 最小化修改範圍
  - 確保符合既有規範
  - 驗證修改結果
- **程式碼維護**：
  - 不在程式碼中包含版本資訊
  - 不在程式碼中包含更新描述

## 型別管理
- **型別檢查**：不使用 TypeScript 的語法，改用 JSDoc 型別註解
- **JSDoc 註解**：所有方法必須包含 JSDoc 型別註解
- **TS 檢查啟用**：所有 JavaScript 檔案開頭必須加入 `// @ts-check`

// @ts-nocheck

/**
 * @fileoverview Type.js - 統一類型定義系統
 * 職責：管理所有模組間共用的類型定義，確保類型一致性
 * 設計原則：集中管理、避免重複、確保一致性
 */

// ==================== 基礎聯合類型 ====================

/**
 * 資源類型聯合型別
 * @typedef {'food'|'materials'|'medical'|'fuel'|'cash'} ResourceType
 */

/**
 * 租客類型聯合型別
 * @typedef {'doctor'|'worker'|'farmer'|'soldier'|'elder'} TenantType
 */

/**
 * 日誌類型聯合型別
 * @typedef {'event'|'rent'|'danger'|'skill'} LogType
 */

/**
 * 交易類型聯合型別
 * @typedef {'rent'|'merchant'|'caravan'|'mutual_aid'} TradeType
 */

/**
 * 商人交易類型聯合型別
 * @typedef {'buy'|'sell'|'service'} MerchantTradeType
 */

/**
 * 商人服務類型聯合型別
 * @typedef {'healthCheck'|'quickRepair'|'security'|'information'} MerchantServiceType
 */

/**
 * 互助類型聯合型別
 * @typedef {'food_aid'|'cash_loan'|'medical_aid'|'tenant_purchase'|'landlord_purchase'} MutualAidType
 */

/**
 * 滿意度等級聯合型別
 * @typedef {'excellent'|'good'|'normal'|'warning'|'critical'} SatisfactionLevel
 */

/**
 * 租客狀態聯合型別
 * @typedef {'healthy'|'infected'|'on_mission'|'evicted'} TenantStatus
 */

/**
 * 事件類型聯合型別
 * @typedef {'zombie_attack'|'merchant_visit'|'caravan_arrival'|'resource_shortage'|'tenant_conflict'} EventType
 */

// ==================== 基礎資源類型 ====================

/**
 * 資源物件類型
 * @typedef {Object} Resources
 * @property {number} food - 食物數量
 * @property {number} materials - 建材數量
 * @property {number} medical - 醫療用品數量
 * @property {number} fuel - 燃料數量
 * @property {number} cash - 現金數量
 */

/**
 * 租客個人資源類型
 * @typedef {Object} PersonalResources
 * @property {number} food - 個人食物
 * @property {number} materials - 個人建材
 * @property {number} medical - 個人醫療用品
 * @property {number} fuel - 個人燃料
 * @property {number} cash - 個人現金
 */

/**
 * 資源閾值配置
 * @typedef {Object} ResourceThresholds
 * @property {number} warning - 警告線
 * @property {number} critical - 危險線
 * @property {number} emergency - 緊急線
 * @property {number} [maximum] - 最大值（可選）
 */

/**
 * 閾值配置類型定義
 * @typedef {Object} ThresholdConfig
 * @property {Object} resources - 資源閾值
 * @property {ResourceThresholds} resources.warning - 警告閾值
 * @property {ResourceThresholds} resources.critical - 危險閾值
 * @property {Object} satisfaction - 滿意度閾值
 * @property {Array<Object>} satisfaction.levels - 滿意度等級
 * @property {Object} building - 建築防禦閾值
 * @property {Object} hunger - 飢餓狀態閾值
 */

/**
 * 資源狀態評估結果類型
 * @typedef {Object} ResourceStatus
 * @property {ResourceType} resourceType - 資源類型
 * @property {number} currentValue - 當前數值
 * @property {'abundant'|'normal'|'warning'|'critical'|'emergency'} level - 狀態等級
 * @property {number} daysRemaining - 預估剩餘天數
 * @property {string[]} recommendations - 建議操作
 */

// ==================== 租客相關類型 ====================

/**
 * 租客物件類型
 * @typedef {Object} Tenant
 * @property {number} [id] - 統一個人ID
 * @property {string} name - 租客姓名
 * @property {TenantType} type - 租客類型
 * @property {string} typeName - 類型顯示名稱
 * @property {string} skill - 技能描述
 * @property {number} rent - 房租金額
 * @property {boolean} [infected] - 是否感染
 * @property {boolean} [onMission] - 是否執行任務中
 * @property {PersonalResources} [personalResources] - 個人資源
 * @property {string} [appearance] - 外觀描述
 * @property {number} [infectionRisk] - 感染風險
 * @property {string} [moveInDate] - 入住日期
 * @property {Object} [preferences] - 偏好設定
 * @property {Object} [skillHistory] - 技能使用歷史
 */

/**
 * 申請者物件類型
 * @typedef {Object} Applicant
 * @property {number} id - 統一個人ID
 * @property {string} name - 姓名
 * @property {TenantType} type - 類型
 * @property {string} typeName - 類型顯示名稱
 * @property {string} skill - 技能
 * @property {number} rent - 房租
 * @property {boolean} infected - 是否感染（隱藏）
 * @property {boolean} [revealedInfection] - 是否已揭露感染
 * @property {string} appearance - 外觀描述
 * @property {number} infectionRisk - 感染風險
 * @property {PersonalResources} personalResources - 個人資源
 * @property {string} description - 技能描述
 */

/**
 * 租客關係類型
 * @typedef {Object} TenantRelationship
 * @property {number} tenant1Id - 租客1ID
 * @property {number} tenant2Id - 租客2ID
 * @property {number} relationship - 關係值 (-100 到 100)
 * @property {string} lastInteraction - 最後互動日期
 * @property {string[]} interactionHistory - 互動歷史
 */

/**
 * 租客統計類型
 * @typedef {Object} TenantStats
 * @property {number} totalTenants - 總租客數
 * @property {number} healthyTenants - 健康租客數
 * @property {number} infectedTenants - 感染租客數
 * @property {number} onMissionTenants - 執行任務租客數
 * @property {number} averageSatisfaction - 平均滿意度
 * @property {number} totalRentIncome - 總租金收入
 * @property {Object.<TenantType, number>} typeDistribution - 職業分布
 */

// ==================== 房間相關類型 ====================

/**
 * 房間物件類型
 * @typedef {Object} Room
 * @property {number} id - 房間ID
 * @property {Tenant|null} tenant - 入住的租客
 * @property {boolean} needsRepair - 是否需要維修
 * @property {boolean} reinforced - 是否已加固
 * @property {number} [repairCost] - 維修費用
 * @property {string} [lastRepairDate] - 最後維修日期
 */

// ==================== 交易相關類型 ====================

/**
 * 商人交易選項類型
 * @typedef {Object} MerchantOffer
 * @property {MerchantTradeType} type - 交易類型
 * @property {ResourceType} [item] - 交易物品類型
 * @property {number} [amount] - 交易數量
 * @property {number} [price] - 交易價格
 * @property {MerchantServiceType} [service] - 服務類型
 * @property {string} description - 交易描述
 */

/**
 * 商隊交易選項類型
 * @typedef {Object} CaravanOffer
 * @property {Object.<ResourceType, number>} give - 付出的資源
 * @property {Object.<ResourceType, number>} receive - 獲得的資源
 * @property {string} description - 交易描述
 */

/**
 * 交易結果類型
 * @typedef {Object} TradeResult
 * @property {boolean} success - 交易是否成功
 * @property {string} [message] - 結果訊息
 * @property {Partial<Resources>} [resourceChanges] - 資源變更
 * @property {number} [totalValue] - 交易總價值
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 交易統計類型
 * @typedef {Object} TradeStats
 * @property {number} rentTransactions - 租金交易數
 * @property {number} merchantTransactions - 商人交易數
 * @property {number} caravanTransactions - 商隊交易數
 * @property {number} mutualAidTransactions - 互助交易數
 * @property {number} totalValue - 總交易價值
 * @property {Object} dailyStats - 每日統計
 * @property {number} dailyStats.day - 天數
 * @property {number} dailyStats.rentCollected - 收取租金
 * @property {number} dailyStats.merchantTrades - 商人交易
 * @property {number} dailyStats.caravanTrades - 商隊交易
 * @property {number} dailyStats.mutualAidEvents - 互助事件
 * @property {number} dailyStats.totalDailyValue - 每日總價值
 */

// ==================== 事件相關類型 ====================

/**
 * 事件物件類型
 * @typedef {Object} EventObject
 * @property {string} type - 事件類型
 * @property {any} data - 事件資料
 * @property {string} timestamp - 時間戳記（ISO格式）
 * @property {string} id - 事件唯一識別碼
 * @property {Object} [options] - 附加選項
 */

/**
 * 事件監聽器函數類型
 * @typedef {function(EventObject): (any|Promise<any>)} EventListener
 */

/**
 * 監聽器選項配置類型
 * @typedef {Object} ListenerOptions
 * @property {number} [priority=0] - 監聽器優先級
 * @property {function(EventObject): boolean} [filter] - 事件過濾器函數
 * @property {number} [throttle=0] - 節流間隔（毫秒）
 * @property {boolean} [once=false] - 是否僅執行一次
 */

// ==================== 系統管理類型 ====================

/**
 * 基礎狀態介面類型
 * @typedef {Object} BaseManagerStatus
 * @property {boolean} initialized - 是否已初始化
 * @property {boolean} configLoaded - 配置是否載入
 * @property {string} managerType - 管理器類型
 * @property {string} version - 版本資訊
 * @property {number} lastUpdated - 最後更新時間戳記
 * @property {number} createdAt - 建立時間戳記
 * @property {number} uptime - 運行時間（毫秒）
 * @property {boolean} hasGameState - 是否有 GameState 依賴
 * @property {boolean} hasEventBus - 是否有 EventBus 依賴
 * @property {string} eventNamingStrategy - 事件命名策略
 */

/**
 * UI狀態類型
 * @typedef {Object} UIState
 * @property {boolean} debugMode - 是否為除錯模式
 * @property {string|null} activeModal - 當前活躍的模態框
 * @property {boolean} systemReady - 系統是否就緒
 */

// ==================== 驗證相關類型 ====================

/**
 * 驗證器選項配置類型
 * @typedef {Object} ValidatorOptions
 * @property {boolean} [enabled=true] - 是否啟用驗證
 * @property {boolean} [strictMode=false] - 是否使用嚴格模式
 * @property {boolean} [logErrors=true] - 是否記錄錯誤
 */

/**
 * 驗證結果類型
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - 驗證是否通過
 * @property {string} [reason] - 通過原因
 * @property {string} [error] - 錯誤訊息
 * @property {string} [suggestion] - 修復建議
 */

// ==================== 遊戲狀態類型 ====================

/**
 * 遊戲狀態更新物件類型
 * @typedef {Object} StateUpdate
 * @property {Partial<Resources>} [resources] - 資源更新
 * @property {number} [day] - 天數更新
 * @property {Object} [system] - 系統狀態更新
 */

/**
 * 日誌條目類型
 * @typedef {Object} LogEntry
 * @property {string} message - 日誌訊息
 * @property {LogType} type - 日誌類型
 * @property {number} day - 遊戲天數
 * @property {string} timestamp - 時間戳
 */

// ==================== 函數類型 ====================

/**
 * 事件處理函數類型
 * @typedef {(event: Event) => void} EventHandler
 */

/**
 * 點擊事件處理函數類型
 * @typedef {(event: MouseEvent) => void} ClickHandler
 */

/**
 * 取消監聽器函數類型
 * @typedef {() => void} UnsubscribeFunction
 */

// ==================== 型別匯出 ====================

// 注意：JavaScript 中的 @typedef 註解僅用於類型檢查
// 實際的類型導入需要透過 JSDoc 註解在使用檔案中進行

/**
 * 統一類型定義模組
 * 此檔案包含所有模組間共用的類型定義，確保系統間的類型一致性
 *
 * 使用方式：
 * 在需要使用類型的檔案中加入以下註解：
 * @see {@link ./types/Type.js} 完整類型定義
 *
 * 並在檔案開頭加入具體的類型引用，例如：
 * @typedef {import('./types/Type.js').ResourceType} ResourceType
 * @typedef {import('./types/Type.js').Tenant} Tenant
 */

export default {};
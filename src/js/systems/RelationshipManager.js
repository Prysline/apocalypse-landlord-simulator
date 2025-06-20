// @ts-check

/**
 * @fileoverview RelationshipManager.js - 租客關係專責管理系統（簡化版）
 * 職責：關係值計算、狀態管理、清理維護
 * 設計原則：最小可用產品，避免過度設計
 */

import BaseManager from "./BaseManager.js";

/**
 * 租客關係專責管理系統
 * 專注核心關係管理功能，避免不必要的複雜性
 * @class
 * @extends BaseManager
 */
export class RelationshipManager extends BaseManager {
  /**
   * 建立 RelationshipManager 實例
   * @param {Object} gameState - 遊戲狀態管理器
   * @param {Object} eventBus - 事件總線
   * @param {Object} [config] - 關係系統配置
   */
  constructor(gameState, eventBus, config = {}) {
    super(gameState, eventBus, "RelationshipManager");

    // 簡化配置
    this.config = {
      baseValue: 50,
      range: { min: 0, max: 100 },
      ...config
    };

    // 核心狀態：關係值映射 (sortedIds -> value)
    /** @type {Map<string, number>} */
    this.relationships = new Map();

    // 職業關係矩陣
    this.typeMatrix = {
      soldier: { soldier: 70, worker: 60, farmer: 55, doctor: 65, elder: 50 },
      worker: { soldier: 60, worker: 65, farmer: 70, doctor: 60, elder: 55 },
      farmer: { soldier: 55, worker: 70, farmer: 75, doctor: 60, elder: 65 },
      doctor: { soldier: 65, worker: 60, farmer: 60, doctor: 70, elder: 80 },
      elder: { soldier: 50, worker: 55, farmer: 65, doctor: 80, elder: 75 }
    };

    console.log("🤝 RelationshipManager 初始化中...");
  }

  // ==========================================
  // BaseManager 實作
  // ==========================================

  getModulePrefix() {
    return "relationship";
  }

  setupEventListeners() {
    // 監聽探索關係變化事件
    this.onEvent("exploration_relationship_change", (eventObj) => {
      const { tenantId, change, reason } = eventObj.data;
      this._adjustTenantAllRelationships(tenantId, change, reason);
    }, { skipPrefix: true });

    // 監聽租客驅逐事件，清理關係記錄
    this.onEvent("tenant_tenantEvicted", (eventObj) => {
      const { tenant } = eventObj.data;
      this.cleanupTenantRelationships(tenant.id);
    }, { skipPrefix: true });

    console.log("✅ RelationshipManager 事件監聽器設置完成");
  }

  async initialize() {
    this._loadExistingRelationships();
    this.setupEventListeners();
    this.markInitialized(true);
    console.log("✅ RelationshipManager 初始化完成");
    return true;
  }

  // ==========================================
  // 核心關係管理 API
  // ==========================================

  /**
   * 取得租客間關係值
   * @param {string|number} tenantId1 - 租客1 ID
   * @param {string|number} tenantId2 - 租客2 ID
   * @returns {number} 關係值 (0-100)
   */
  getRelationshipValue(tenantId1, tenantId2) {
    try {
      const id1 = String(tenantId1);
      const id2 = String(tenantId2);

      // 自己與自己的關係值為100
      if (id1 === id2) {
        return 100;
      }

      const key = this._getRelationshipKey(id1, id2);
      const existingValue = this.relationships.get(key);

      if (existingValue !== undefined) {
        return existingValue;
      }

      // 無記錄時計算初始關係值
      const initialValue = this._calculateInitialRelationship(id1, id2);
      this.setRelationshipValue(id1, id2, initialValue, '初始關係值');

      return initialValue;

    } catch (error) {
      this.logError(`取得關係值失敗: ${tenantId1} <-> ${tenantId2}`, error);
      return this.config.baseValue;
    }
  }

  /**
   * 設置租客間關係值
   * @param {string|number} tenantId1 - 租客1 ID
   * @param {string|number} tenantId2 - 租客2 ID
   * @param {number} value - 關係值 (0-100)
   * @param {string} [reason] - 變更原因
   * @returns {boolean} 設置是否成功
   */
  setRelationshipValue(tenantId1, tenantId2, value, reason = '關係更新') {
    try {
      const id1 = String(tenantId1);
      const id2 = String(tenantId2);

      if (id1 === id2) {
        return true; // 自己與自己的關係不需變更
      }

      const clampedValue = this._clampValue(value);
      const key = this._getRelationshipKey(id1, id2);
      const oldValue = this.relationships.get(key) || this.config.baseValue;

      this.relationships.set(key, clampedValue);
      this._syncToGameState();

      // 記錄變更日誌（僅顯著變化）
      if (Math.abs(clampedValue - oldValue) >= 5) {
        this._logRelationshipChange(id1, id2, oldValue, clampedValue, reason);
      }

      return true;

    } catch (error) {
      this.logError(`設置關係值失敗: ${tenantId1} <-> ${tenantId2}`, error);
      return false;
    }
  }

  /**
   * 調整租客間關係值
   * @param {string|number} tenantId1 - 租客1 ID
   * @param {string|number} tenantId2 - 租客2 ID
   * @param {number} change - 變更量
   * @param {string} [reason] - 變更原因
   * @returns {number} 新的關係值
   */
  adjustRelationshipValue(tenantId1, tenantId2, change, reason = '關係調整') {
    const currentValue = this.getRelationshipValue(tenantId1, tenantId2);
    const newValue = currentValue + change;

    this.setRelationshipValue(tenantId1, tenantId2, newValue, reason);

    return this._clampValue(newValue);
  }

  /**
   * 取得租客的所有關係值
   * @param {string|number} tenantId - 租客 ID
   * @returns {Object} 關係值映射 { otherTenantId: relationshipValue, ... }
   */
  getTenantRelationships(tenantId) {
    try {
      const id = String(tenantId);
      const result = {};

      // 取得所有租客
      const allTenants = this.gameState.getAllTenants();

      // 查找與其他租客的關係值
      for (const otherTenant of allTenants) {
        const otherId = String(otherTenant.id);

        if (otherId !== id) {
          result[otherId] = this.getRelationshipValue(id, otherId);
        }
      }

      return result;

    } catch (error) {
      this.logError(`取得租客關係值失敗: ${tenantId}`, error);
      return {};
    }
  }

  // ==========================================
  // 清理與維護
  // ==========================================

  /**
   * 清理特定租客的關係值記錄
   * @param {string|number} tenantId - 已離開的租客 ID
   * @returns {number} 清理的記錄數量
   */
  cleanupTenantRelationships(tenantId) {
    try {
      const id = String(tenantId);
      let cleanedCount = 0;

      // 清理包含該租客的所有關係記錄
      for (const [key] of this.relationships.entries()) {
        const [id1, id2] = key.split('_');

        if (id1 === id || id2 === id) {
          this.relationships.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this._syncToGameState();
        this.addLog(`清理租客 ${tenantId} 的 ${cleanedCount} 個關係記錄`);
      }

      return cleanedCount;

    } catch (error) {
      this.logError(`清理租客關係記錄失敗: ${tenantId}`, error);
      return 0;
    }
  }

  /**
   * 清理已離開租客的關係值記錄（批量清理）
   * @returns {number} 清理的記錄數量
   */
  cleanupRelationships() {
    try {
      const currentTenants = this.gameState.getAllTenants();
      const currentTenantIds = new Set(currentTenants.map(t => String(t.id)));

      let cleanedCount = 0;

      // 檢查並清理無效的關係記錄
      for (const [key] of this.relationships.entries()) {
        const [id1, id2] = key.split('_');

        // 如果任一租客已不存在，刪除關係記錄
        if (!currentTenantIds.has(id1) || !currentTenantIds.has(id2)) {
          this.relationships.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this._syncToGameState();
        this.addLog(`批量清理了 ${cleanedCount} 個無效關係記錄`);
      }

      return cleanedCount;

    } catch (error) {
      this.logError('批量清理關係值記錄失敗', error);
      return 0;
    }
  }

  // ==========================================
  // 私有輔助方法
  // ==========================================

  /**
   * 計算初始關係值（基於職業類型）
   * @param {string} tenantId1 - 租客1 ID
   * @param {string} tenantId2 - 租客2 ID
   * @returns {number} 初始關係值
   * @private
   */
  _calculateInitialRelationship(tenantId1, tenantId2) {
    try {
      // 取得租客資訊
      const allTenants = this.gameState.getAllTenants();
      const tenant1 = allTenants.find(t => String(t.id) === tenantId1);
      const tenant2 = allTenants.find(t => String(t.id) === tenantId2);

      if (!tenant1 || !tenant2) {
        return this.config.baseValue;
      }

      // 基於職業類型計算
      return this.typeMatrix[tenant1.type]?.[tenant2.type] || this.config.baseValue;

    } catch (error) {
      this.logError(`計算初始關係值失敗: ${tenantId1} <-> ${tenantId2}`, error);
      return this.config.baseValue;
    }
  }

  /**
   * 調整租客與所有其他租客的關係（探索結果影響）
   * @param {string|number} tenantId - 租客 ID
   * @param {number} change - 變更量
   * @param {string} reason - 變更原因
   * @private
   */
  _adjustTenantAllRelationships(tenantId, change, reason) {
    try {
      const id = String(tenantId);
      const allTenants = this.gameState.getAllTenants();
      let adjustedCount = 0;

      for (const otherTenant of allTenants) {
        const otherId = String(otherTenant.id);

        if (otherId !== id) {
          this.adjustRelationshipValue(id, otherId, change, reason);
          adjustedCount++;
        }
      }

      if (adjustedCount > 0) {
        this.addLog(`租客 ${tenantId} 與 ${adjustedCount} 人的關係變化 ${change > 0 ? '+' : ''}${change} (${reason})`);
      }

    } catch (error) {
      this.logError(`調整租客關係值失敗: ${tenantId}`, error);
    }
  }

  /**
   * 生成關係鍵值（確保一致性）
   * @param {string} id1 - 租客1 ID
   * @param {string} id2 - 租客2 ID
   * @returns {string} 關係鍵值
   * @private
   */
  _getRelationshipKey(id1, id2) {
    const sortedIds = [id1, id2].sort();
    return `${sortedIds[0]}_${sortedIds[1]}`;
  }

  /**
   * 限制關係值在有效範圍內
   * @param {number} value - 關係值
   * @returns {number} 限制後的關係值
   * @private
   */
  _clampValue(value) {
    return Math.max(
      this.config.range.min,
      Math.min(this.config.range.max, Math.round(value))
    );
  }

  /**
   * 記錄關係變更日誌
   * @param {string} tenantId1 - 租客1 ID
   * @param {string} tenantId2 - 租客2 ID
   * @param {number} oldValue - 舊值
   * @param {number} newValue - 新值
   * @param {string} reason - 變更原因
   * @private
   */
  _logRelationshipChange(tenantId1, tenantId2, oldValue, newValue, reason) {
    // 取得租客姓名用於日誌
    const allTenants = this.gameState.getAllTenants();
    const tenant1 = allTenants.find(t => String(t.id) === tenantId1);
    const tenant2 = allTenants.find(t => String(t.id) === tenantId2);
    const name1 = tenant1?.name || tenantId1;
    const name2 = tenant2?.name || tenantId2;

    this.addLog(`關係變更: ${name1} <-> ${name2}: ${oldValue} → ${newValue} (${reason})`);
  }

  /**
   * 載入現有關係數據
   * @private
   */
  _loadExistingRelationships() {
    const existing = this.gameState.getStateValue("tenantRelationships", {});

    Object.entries(existing).forEach(([key, value]) => {
      if (typeof value === "number") {
        this.relationships.set(key, value);
      }
    });

    console.log(`🤝 載入 ${this.relationships.size} 個關係記錄`);
  }

  /**
   * 同步關係數據到遊戲狀態
   * @private
   */
  _syncToGameState() {
    const relationshipsObject = Object.fromEntries(this.relationships);
    this.gameState.setStateValue("tenantRelationships", relationshipsObject, "關係值同步");
  }

  /**
   * 清理系統數據
   * @returns {void}
   */
  cleanup() {
    this.relationships.clear();
    super.cleanup();
    console.log("RelationshipManager 已清理");
  }
}

export default RelationshipManager;
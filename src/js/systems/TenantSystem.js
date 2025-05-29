/**
 * TenantSystem - 租客生命週期管理系統
 *
 * 架構設計原則：
 * 1. 狀態機模式：管理租客生命週期狀態轉換
 * 2. 觀察者模式：處理租客狀態變化的事件通知
 * 3. 策略模式：處理不同租客類型的行為差異
 * 4. 工廠模式：建立租客實例的統一管理
 */

class TenantSystem {
  constructor(gameStateRef, dataManager, ruleEngine) {
    this.gameState = gameStateRef;
    this.dataManager = dataManager;
    this.ruleEngine = ruleEngine;

    // 租客狀態管理
    this.tenantStates = new Map(); // tenantId -> TenantState
    this.tenantFactory = new TenantFactory(dataManager);
    this.satisfactionCalculator = new SatisfactionCalculator();

    // 事件系統
    this.eventListeners = new Map();

    // 初始化策略管理器
    this.behaviorStrategies = new Map();
    this.initializeBehaviorStrategies();
  }

  /**
   * 初始化租客行為策略
   */
  initializeBehaviorStrategies() {
    this.behaviorStrategies.set("doctor", new DoctorBehaviorStrategy());
    this.behaviorStrategies.set("worker", new WorkerBehaviorStrategy());
    this.behaviorStrategies.set("farmer", new FarmerBehaviorStrategy());
    this.behaviorStrategies.set("soldier", new SoldierBehaviorStrategy());
    this.behaviorStrategies.set("elder", new ElderBehaviorStrategy());
  }

  /**
   * 生成申請者列表
   * @param {number} count - 申請者數量
   * @returns {Array} 申請者陣列
   */
  generateApplicants(count = null) {
    if (count === null) {
      count = Math.floor(Math.random() * 3) + 1;
    }

    const tenantConfigs = this.dataManager.getCachedData("tenants");
    if (!tenantConfigs) {
      console.warn("⚠️ 租客配置不可用，使用預設生成");
      return this.generateDefaultApplicants(count);
    }

    // 根據解鎖條件過濾可用租客
    const availableTenants = this.filterAvailableTenants(tenantConfigs);

    const applicants = [];
    for (let i = 0; i < count; i++) {
      const config =
        availableTenants[Math.floor(Math.random() * availableTenants.length)];
      const applicant = this.tenantFactory.createApplicant(config);
      applicants.push(applicant);
    }

    console.log(`📋 生成了 ${count} 個申請者`);
    return applicants;
  }

  /**
   * 根據解鎖條件過濾可用租客
   */
  filterAvailableTenants(tenantConfigs) {
    return tenantConfigs.filter((config) => {
      const unlockConditions = config.unlockConditions;
      if (!unlockConditions) return true;

      // 檢查日期條件
      if (unlockConditions.day && this.gameState.day < unlockConditions.day) {
        return false;
      }

      // 檢查建築防禦條件
      if (
        unlockConditions.buildingDefense &&
        this.gameState.buildingDefense < unlockConditions.buildingDefense
      ) {
        return false;
      }

      // 檢查租客總數條件
      if (unlockConditions.totalTenants) {
        const currentTenants = this.getCurrentTenantCount();
        if (currentTenants < unlockConditions.totalTenants) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 租客入住處理
   * @param {Object} applicant - 申請者物件
   * @param {number} roomId - 房間ID
   * @returns {boolean} 入住是否成功
   */
  hireTenant(applicant, roomId = null) {
    // 尋找可用房間
    const room = roomId
      ? this.gameState.rooms.find((r) => r.id === roomId)
      : this.gameState.rooms.find((r) => !r.tenant);

    if (!room) {
      console.warn("❌ 沒有可用房間");
      return false;
    }

    // 建立租客實例
    const tenant = this.tenantFactory.createTenant(applicant);

    // 分配房間
    room.tenant = tenant;

    // 初始化租客狀態
    this.initializeTenantState(tenant);

    // 觸發入住事件
    this.emitEvent("tenantHired", { tenant, room });

    // 記錄日誌
    this.addLog(`新租客 ${tenant.name} 入住房間 ${room.id}`, "rent");

    console.log(`🏠 租客 ${tenant.name} 成功入住房間 ${room.id}`);
    return true;
  }

  /**
   * 初始化租客狀態
   */
  initializeTenantState(tenant) {
    const tenantState = {
      id: tenant.id || `tenant_${Date.now()}`,
      satisfaction: 50,
      healthStatus: "healthy",
      lastInteraction: this.gameState.day,
      skillCooldowns: new Map(),
      personalHistory: [],
      relationships: new Map(),
    };

    this.tenantStates.set(tenant.name, tenantState);

    // 初始化遊戲狀態中的滿意度記錄
    if (!this.gameState.tenantSatisfaction) {
      this.gameState.tenantSatisfaction = {};
    }
    this.gameState.tenantSatisfaction[tenant.name] = tenantState.satisfaction;
  }

  /**
   * 租客離開處理
   * @param {string} tenantName - 租客姓名
   * @param {string} reason - 離開原因
   */
  evictTenant(tenantName, reason = "evicted") {
    const room = this.gameState.rooms.find(
      (r) => r.tenant && r.tenant.name === tenantName
    );
    if (!room) {
      console.warn(`❌ 找不到租客: ${tenantName}`);
      return false;
    }

    const tenant = room.tenant;

    // 處理離開後果
    this.handleTenantDeparture(tenant, reason);

    // 清理房間
    room.tenant = null;

    // 清理狀態記錄
    this.tenantStates.delete(tenantName);
    delete this.gameState.tenantSatisfaction[tenantName];

    // 觸發離開事件
    this.emitEvent("tenantEvicted", { tenant, reason });

    // 記錄日誌
    this.addLog(
      `租客 ${tenantName} 離開了房間 ${room.id} (原因: ${reason})`,
      reason === "infected" ? "danger" : "event"
    );

    return true;
  }

  /**
   * 處理租客離開的後果
   */
  handleTenantDeparture(tenant, reason) {
    switch (reason) {
      case "infected":
        // 感染離開需要消毒
        if (this.gameState.resources.medical >= 2) {
          this.gameState.resources.medical -= 2;
          this.addLog("消毒感染房間花費了 2 醫療用品", "danger");
        } else {
          // 沒有醫療用品，房間需要維修
          const room = this.gameState.rooms.find((r) => r.tenant === tenant);
          if (room) room.needsRepair = true;
          this.addLog("缺乏醫療用品，房間存在感染風險", "danger");
        }
        break;

      case "dissatisfied":
        // 不滿離開可能要求賠償
        if (Math.random() < 0.3) {
          const compensation = Math.floor(tenant.rent * 0.5);
          this.gameState.resources.cash = Math.max(
            0,
            this.gameState.resources.cash - compensation
          );
          this.addLog(
            `支付了 ${tenant.name} 的補償金 $${compensation}`,
            "event"
          );
        }
        break;

      case "evicted":
        // 強制驅逐可能產生聲譽影響
        if (Math.random() < 0.2) {
          this.addLog("強制驅逐影響了房東聲譽", "danger");
          // 可以在這裡添加聲譽系統的邏輯
        }
        break;
    }
  }

  /**
   * 每日租客狀態更新
   */
  updateDailyTenantStates() {
    const occupiedRooms = this.gameState.rooms.filter((room) => room.tenant);

    occupiedRooms.forEach((room) => {
      const tenant = room.tenant;
      const tenantState = this.tenantStates.get(tenant.name);

      if (!tenantState) {
        console.warn(`⚠️ 找不到租客狀態: ${tenant.name}`);
        return;
      }

      // 更新滿意度
      this.updateTenantSatisfaction(tenant, room, tenantState);

      // 處理租客行為
      this.processTenantBehavior(tenant, tenantState);

      // 檢查離開條件
      this.checkTenantDepartureConditions(tenant, tenantState);

      // 更新技能冷卻
      this.updateSkillCooldowns(tenantState);
    });

    // 處理租客互動
    this.processTenantInteractions(occupiedRooms);
  }

  /**
   * 更新租客滿意度
   */
  updateTenantSatisfaction(tenant, room, tenantState) {
    let satisfaction = tenantState.satisfaction;

    // 基礎生活條件影響
    if (room.reinforced) satisfaction += 3;
    if (room.needsRepair) satisfaction -= 8;
    if (tenant.personalResources.food < 2) satisfaction -= 10;
    if (tenant.personalResources.cash > 25) satisfaction += 5;

    // 建築防禦影響
    if (this.gameState.buildingDefense >= 8) satisfaction += 4;
    if (this.gameState.buildingDefense <= 2) satisfaction -= 6;

    // 全局效果影響
    if (this.gameState.emergencyTraining) satisfaction += 2;
    if (this.gameState.patrolSystem) satisfaction += 4;
    if (this.gameState.socialNetwork) satisfaction += 3;

    // 老人和諧氛圍加成
    const elderCount = this.getElderTenantCount();
    satisfaction += elderCount * 2;

    // 更新狀態
    satisfaction = Math.max(0, Math.min(100, satisfaction));
    tenantState.satisfaction = satisfaction;
    this.gameState.tenantSatisfaction[tenant.name] = satisfaction;
  }

  /**
   * 處理租客行為
   */
  processTenantBehavior(tenant, tenantState) {
    const strategy = this.behaviorStrategies.get(tenant.type);
    if (strategy) {
      strategy.processDailyBehavior(tenant, tenantState, this.gameState);
    }
  }

  /**
   * 檢查租客離開條件
   */
  checkTenantDepartureConditions(tenant, tenantState) {
    // 滿意度過低
    if (tenantState.satisfaction < 20 && Math.random() < 0.3) {
      this.evictTenant(tenant.name, "dissatisfied");
      return;
    }

    // 資源不足導致離開
    if (
      tenant.personalResources.food <= 0 &&
      tenant.personalResources.cash <= 0 &&
      Math.random() < 0.4
    ) {
      this.evictTenant(tenant.name, "resource_shortage");
      return;
    }
  }

  /**
   * 處理租客間互動
   */
  processTenantInteractions(occupiedRooms) {
    if (occupiedRooms.length < 2) return;

    // 互助機制
    if (Math.random() < 0.3) {
      this.processMutualAid(occupiedRooms);
    }

    // 衝突機制
    const conflictChance = this.calculateConflictChance(occupiedRooms);
    if (Math.random() < conflictChance) {
      this.processConflict(occupiedRooms);
    }
  }

  /**
   * 處理租客互助
   */
  processMutualAid(occupiedRooms) {
    const tenants = occupiedRooms.map((room) => room.tenant);

    // 找到需要幫助的租客
    const needyTenant = tenants.find(
      (t) =>
        t.personalResources.food <= 1 ||
        t.personalResources.cash <= 5 ||
        (t.type === "elder" && t.personalResources.medical <= 1)
    );

    // 找到能提供幫助的租客
    const helpfulTenant = tenants.find(
      (t) =>
        t !== needyTenant &&
        (t.personalResources.food >= 5 ||
          t.personalResources.cash >= 15 ||
          t.personalResources.medical >= 3)
    );

    if (needyTenant && helpfulTenant) {
      this.executeMutualAid(needyTenant, helpfulTenant);
    }
  }

  /**
   * 執行互助行為
   */
  executeMutualAid(needyTenant, helpfulTenant) {
    let aidType = "";

    if (
      needyTenant.personalResources.food <= 1 &&
      helpfulTenant.personalResources.food >= 3
    ) {
      helpfulTenant.personalResources.food -= 2;
      needyTenant.personalResources.food += 2;
      aidType = "食物";
    } else if (
      needyTenant.personalResources.cash <= 5 &&
      helpfulTenant.personalResources.cash >= 12
    ) {
      const loanAmount = 5;
      helpfulTenant.personalResources.cash -= loanAmount;
      needyTenant.personalResources.cash += loanAmount;
      aidType = "現金";
    } else if (
      needyTenant.type === "elder" &&
      needyTenant.personalResources.medical <= 1 &&
      helpfulTenant.personalResources.medical >= 2
    ) {
      helpfulTenant.personalResources.medical -= 1;
      needyTenant.personalResources.medical += 1;
      aidType = "醫療用品";
    }

    if (aidType) {
      this.addLog(
        `${helpfulTenant.name} 分享了${aidType}給 ${needyTenant.name}`,
        "event"
      );

      // 提升雙方滿意度
      const helpfulState = this.tenantStates.get(helpfulTenant.name);
      const needyState = this.tenantStates.get(needyTenant.name);

      if (helpfulState) helpfulState.satisfaction += 3;
      if (needyState) needyState.satisfaction += 5;
    }
  }

  /**
   * 計算衝突機率
   */
  calculateConflictChance(occupiedRooms) {
    const tenantCount = occupiedRooms.length;
    if (tenantCount < 2) return 0;

    let baseChance = 0.25;

    // 計算平均滿意度
    const avgSatisfaction =
      occupiedRooms.reduce((sum, room) => {
        const state = this.tenantStates.get(room.tenant.name);
        return sum + (state ? state.satisfaction : 50);
      }, 0) / tenantCount;

    baseChance -= (avgSatisfaction - 50) * 0.003;
    baseChance += (tenantCount - 2) * 0.08;

    // 資源短缺增加衝突
    if (this.gameState.resources.food < tenantCount * 3) baseChance += 0.1;
    if (this.gameState.resources.fuel < 3) baseChance += 0.05;

    // 老人減少衝突
    const elderCount = this.getElderTenantCount();
    baseChance -= elderCount * 0.12;

    return Math.max(0.02, Math.min(0.6, baseChance));
  }

  /**
   * 處理租客衝突
   */
  processConflict(occupiedRooms) {
    // 這裡應該觸發衝突事件，由EventSystem處理
    this.emitEvent("tenantConflict", {
      tenants: occupiedRooms.map((r) => r.tenant),
    });
  }

  // =============== 工具方法 ===============

  getCurrentTenantCount() {
    return this.gameState.rooms.filter((room) => room.tenant).length;
  }

  getElderTenantCount() {
    return this.gameState.rooms.filter(
      (room) =>
        room.tenant && room.tenant.type === "elder" && !room.tenant.infected
    ).length;
  }

  getTenantsByType(type) {
    return this.gameState.rooms
      .filter(
        (room) =>
          room.tenant && room.tenant.type === type && !room.tenant.infected
      )
      .map((room) => room.tenant);
  }

  getTenantState(tenantName) {
    return this.tenantStates.get(tenantName);
  }

  // =============== 事件系統 ===============

  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
  }

  emitEvent(eventName, data) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ 事件處理器錯誤 (${eventName}):`, error);
        }
      });
    }
  }

  addLog(message, type = "event") {
    if (typeof window.addLog === "function") {
      window.addLog(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // =============== 預設資料生成 ===============

  generateDefaultApplicants(count) {
    // 後備的申請者生成邏輯
    const defaultTypes = ["doctor", "worker", "farmer", "soldier", "elder"];
    const applicants = [];

    for (let i = 0; i < count; i++) {
      const type =
        defaultTypes[Math.floor(Math.random() * defaultTypes.length)];
      const applicant = {
        id: Date.now() + i,
        name: this.generateRandomName(),
        type: type,
        rent: [15, 12, 10, 18, 8][defaultTypes.indexOf(type)],
        infected: Math.random() < 0.2,
        personalResources: { food: 5, materials: 2, medical: 2, cash: 20 },
      };
      applicants.push(applicant);
    }

    return applicants;
  }

  generateRandomName() {
    const names = [
      "小明",
      "小華",
      "老王",
      "阿強",
      "小美",
      "阿珍",
      "大雄",
      "靜香",
    ];
    return names[Math.floor(Math.random() * names.length)];
  }
}

// =============== 租客工廠 ===============

class TenantFactory {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  createApplicant(config) {
    return {
      id: Date.now() + Math.random(),
      ...config,
      name: this.generateName(),
      infected: Math.random() < config.infectionRisk,
      personalResources: { ...config.personalResources },
      appearance:
        Math.random() < config.infectionRisk
          ? this.getInfectedAppearance()
          : this.getNormalAppearance(),
    };
  }

  createTenant(applicant) {
    return {
      ...applicant,
      moveInDate: window.gameState?.day || 1,
      skillCooldowns: new Map(),
      lastSkillUse: new Map(),
    };
  }

  generateName() {
    const names = [
      "小明",
      "小華",
      "小李",
      "老王",
      "阿強",
      "小美",
      "阿珍",
      "大雄",
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  getNormalAppearance() {
    const appearances = [
      "看起來精神狀態不錯",
      "衣著整潔，談吐得體",
      "眼神清澈，反應靈敏",
      "握手時手掌溫暖有力",
    ];
    return appearances[Math.floor(Math.random() * appearances.length)];
  }

  getInfectedAppearance() {
    const appearances = [
      "眼神有點呆滯，反應遲鈍",
      "皮膚蒼白，手有輕微顫抖",
      "說話時偶爾停頓，像在想什麼",
      "有股奇怪的味道，像是腐肉",
    ];
    return appearances[Math.floor(Math.random() * appearances.length)];
  }
}

// =============== 滿意度計算器 ===============

class SatisfactionCalculator {
  calculateSatisfaction(tenant, room, gameState, globalEffects = {}) {
    let satisfaction = 50; // 基礎滿意度

    // 房間條件
    if (room.reinforced) satisfaction += 3;
    if (room.needsRepair) satisfaction -= 8;

    // 個人資源狀況
    if (tenant.personalResources.food < 2) satisfaction -= 10;
    if (tenant.personalResources.cash > 25) satisfaction += 5;

    // 建築安全
    if (gameState.buildingDefense >= 8) satisfaction += 4;
    if (gameState.buildingDefense <= 2) satisfaction -= 6;

    // 全局效果
    Object.keys(globalEffects).forEach((effect) => {
      if (globalEffects[effect]) satisfaction += 2;
    });

    return Math.max(0, Math.min(100, satisfaction));
  }
}

// =============== 租客行為策略 ===============

class TenantBehaviorStrategy {
  processDailyBehavior(tenant, tenantState, gameState) {
    // 基本行為邏輯，由子類別覆寫
  }
}

class DoctorBehaviorStrategy extends TenantBehaviorStrategy {
  processDailyBehavior(tenant, tenantState, gameState) {
    // 醫生每日產出醫療用品
    if (!tenant.infected && Math.random() < 0.8) {
      gameState.resources.medical += 1;
      // 這裡可以記錄日誌或觸發事件
    }
  }
}

class WorkerBehaviorStrategy extends TenantBehaviorStrategy {
  processDailyBehavior(tenant, tenantState, gameState) {
    // 工人有機會自動維修
    if (!tenant.infected && Math.random() < 0.3) {
      const needRepairRooms = gameState.rooms.filter((r) => r.needsRepair);
      if (needRepairRooms.length > 0) {
        needRepairRooms[0].needsRepair = false;
        // 記錄維修行為
      }
    }
  }
}

class FarmerBehaviorStrategy extends TenantBehaviorStrategy {
  processDailyBehavior(tenant, tenantState, gameState) {
    // 農夫處理作物成長
    if (tenant.cropPlanted && gameState.day >= tenant.cropPlanted) {
      const yield = Math.floor(Math.random() * 10) + 8;
      gameState.resources.food += yield;
      tenant.cropPlanted = null;
    }
  }
}

class SoldierBehaviorStrategy extends TenantBehaviorStrategy {
  processDailyBehavior(tenant, tenantState, gameState) {
    // 軍人提供被動安全加成
    // 這裡可以實作軍人的特殊行為
  }
}

class ElderBehaviorStrategy extends TenantBehaviorStrategy {
  processDailyBehavior(tenant, tenantState, gameState) {
    // 老人提供和諧氛圍
    // 可以實作老人的特殊互動邏輯
  }
}

// 匯出模組
if (typeof window !== "undefined") {
  window.TenantSystem = TenantSystem;
}

export default TenantSystem;

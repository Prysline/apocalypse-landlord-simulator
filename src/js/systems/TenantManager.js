// @ts-check

/**
 * @fileoverview TenantManager.js - 租客生命週期管理系統
 * 職責：租客雇用/驅逐、申請者管理、個人資源管理、統計報告
 * 重構：滿意度邏輯已移至 SatisfactionManager 專責處理
 */

import BaseManager from "./BaseManager.js";
import SatisfactionManager from "./SatisfactionManager.js";
import { getValidator } from "../utils/validators.js";

/**
 * @see {@link ../Type.js} 完整類型定義
 * @typedef {import('../Type.js').TenantType} TenantType
 * @typedef {import('../Type.js').ResourceType} ResourceType
 * @typedef {import('../Type.js').LogType} LogType
 * @typedef {import('../Type.js').SatisfactionLevel} SatisfactionLevel
 * @typedef {import('../Type.js').TenantStatus} TenantStatus
 * @typedef {import('../Type.js').PersonalResources} PersonalResources
 * @typedef {import('../Type.js').Tenant} Tenant
 * @typedef {import('../Type.js').Applicant} Applicant
 * @typedef {import('../Type.js').Room} Room
 * @typedef {import('../Type.js').TenantStats} TenantStats
 */

/**
 * 雇用結果
 * @typedef {Object} HiringResult
 * @property {boolean} success - 是否成功
 * @property {string} [reason] - 失敗原因或成功訊息
 * @property {Tenant} [tenant] - 雇用的租客
 * @property {number} [roomId] - 分配的房間ID
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 驅逐結果
 * @typedef {Object} EvictionResult
 * @property {boolean} success - 是否成功
 * @property {string} reason - 驅逐原因
 * @property {number} [refund] - 退還金額
 * @property {number} [penalty] - 處理費用
 * @property {PersonalResources} [leftBehind] - 遺留物品
 * @property {string} [error] - 錯誤訊息
 */

/**
 * 租客生命週期管理系統
 * 專注於租客基本管理功能，滿意度邏輯委派給 SatisfactionManager
 * @class
 * @extends BaseManager
 */
export class TenantManager extends BaseManager {
  /**
   * 建立 TenantManager 實例
   * @param {Object} gameState - 遊戲狀態管理器
   * @param {Object} resourceManager - 資源管理器
   * @param {Object} dataManager - 資料管理器
   * @param {Object} eventBus - 事件總線
   */
  constructor(gameState, resourceManager, dataManager, eventBus) {
    super(gameState, eventBus, "TenantManager");

    // 依賴注入
    this.resourceManager = resourceManager;
    this.dataManager = dataManager;

    // 配置數據
    this.config = null;
    this.tenantTypes = null;

    // 統一ID管理系統
    this.nextPersonId = 1;
    this.personRegistry = new Map();

    // 滿意度管理器（依賴注入）
    this.satisfactionManager = null;

    // 工具
    this.validator = getValidator({
      enabled: true,
      strictMode: false,
      logErrors: true,
    });

    console.log("🏘️ TenantManager 初始化中...");
  }

  // ==========================================
  // BaseManager 抽象方法實作
  // ==========================================

  getModulePrefix() {
    return "tenant";
  }

  setupEventListeners() {
    if (!this.eventBus) throw new Error("EventBus 不可用");

    // 監聽搜刮請求
    this.onEvent("scavenge_request", async (eventObj) => {
      const data = eventObj.data;
      if (data?.tenantId) {
        const result = await this.sendTenantScavenging(data.tenantId);
        this.emitEvent("scavenge_result", result, { skipPrefix: true });
      }
    }, { skipPrefix: true });

    console.log("✅ TenantManager 事件監聽器設置完成");
  }

  // ==========================================
  // 系統初始化
  // ==========================================

  async initialize() {
    console.log("👥 載入租客管理系統配置...");

    await this.loadConfigurations();
    this.initializeSatisfactionManager();
    this.initializeTenantData();
    this.setupEventListeners();

    this.markInitialized(true);
    console.log("✅ TenantManager 初始化完成");

    return true;
  }

  async loadConfigurations() {
    this.tenantTypes = this.dataManager.getTenantTypes();
    if (!this.tenantTypes || this.tenantTypes.length === 0) {
      throw new Error("租客類型配置載入失敗");
    }

    const gameRules = this.dataManager.getGameRules();
    if (!gameRules) {
      throw new Error("遊戲規則配置載入失敗");
    }

    this.config = {
      maxTenants: gameRules.gameDefaults.initialRooms.count,
      maxApplicants: 5,
      evictionPenalty: 10,
      refundRate: 0.5,
    };

    console.log("📋 租客系統配置載入完成");
  }

  initializeSatisfactionManager() {
    const gameRules = this.dataManager.getGameRules();
    const satisfactionConfig = gameRules.gameBalance.tenants.satisfactionSystem;
    const satisfactionFactors = satisfactionConfig.factors;

    this.satisfactionManager = new SatisfactionManager(
      this.gameState,
      this.eventBus,
      satisfactionConfig,
      satisfactionFactors
    );

    // 初始化滿意度管理器
    this.satisfactionManager.initialize();
    console.log("😊 滿意度管理器初始化完成");
  }

  initializeTenantData() {
    const existingTenants = this.gameState.getAllTenants();
    existingTenants.forEach((tenant) => {
      this.ensurePersonalResources(tenant);
    });
  }

  // ==========================================
  // 統一ID管理
  // ==========================================

  generatePersonId() {
    return this.nextPersonId++;
  }

  registerPerson(id, person, role) {
    this.personRegistry.set(id, {
      ...person,
      _systemRole: role,
      _registeredAt: new Date().toISOString(),
    });
    this.gameState.state.people.set(person.id, person);
  }

  getPersonById(id) {
    return this.personRegistry.get(id) || null;
  }

  unregisterPerson(id) {
    this.personRegistry.delete(id);
  }

  getTypeName(typeId) {
    const tenantType = this.tenantTypes.find((t) => t.typeId === typeId);
    return tenantType ? tenantType.typeName : typeId;
  }

  // ==========================================
  // 租客雇用系統
  // ==========================================

  async hireTenant(applicantId, targetRoomId) {
    if (!this.initialized) {
      throw new Error("系統未初始化");
    }

    console.log(`👤 開始雇用租客ID: ${applicantId}`);

    const applicant = this.findApplicantById(applicantId);
    if (!applicant) {
      return {
        success: false,
        error: `找不到申請者 ID: ${applicantId}`,
        reason: "申請者不存在"
      };
    }

    console.log(`✅ 找到申請者: ${applicant.name} (${applicant.type})`);

    this.validateHiring(applicant, targetRoomId);
    const room = this.assignRoom(targetRoomId);
    if (!room) {
      return { success: false, error: "沒有可用房間" };
    }

    const tenant = this.createTenantFromApplicant(applicant);
    this.executeHiring(tenant, room);
    this.removeApplicant(applicant.id);

    this.emitEvent("tenantHired", { tenant: tenant, room: room });
    this.addLog(`新租客 ${tenant.name} 入住房間 ${room.id}`, "rent");

    return {
      success: true,
      reason: "雇用成功",
      tenant: tenant,
      roomId: room.id,
    };
  }

  validateHiring(applicant, targetRoomId) {
    if (!applicant || !applicant.name || !applicant.type) {
      throw new Error("申請者資料不完整");
    }

    const currentTenants = this.gameState.getAllTenants();
    if (currentTenants.length >= this.config.maxTenants) {
      throw new Error("已達最大租客數量限制");
    }

    if (targetRoomId) {
      const rooms = this.gameState.getStateValue("rooms", []);
      const targetRoom = rooms.find(r => r.id === targetRoomId);

      if (!targetRoom) {
        throw new Error(`房間 ${targetRoomId} 不存在`);
      }

      if (this.gameState.getRoomTenant(targetRoom.id)) {
        throw new Error(`房間 ${targetRoomId} 已有租客`);
      }
    } else {
      const emptyRooms = this.getEmptyRooms();
      if (emptyRooms.length === 0) {
        throw new Error("沒有可用的空房間");
      }
    }

    /** @type {'hire'} */
    const operationType = 'hire';
    const tenantOperation = {
      type: operationType,
      tenant: {
        name: applicant.name,
        type: applicant.type,
        infected: applicant.infected,
      },
      room: { id: targetRoomId || null },
    };

    const validationResult = this.validator.validateTenantOperation(tenantOperation);
    if (!validationResult.valid) {
      throw new Error(validationResult.error || "驗證失敗");
    }
  }

  assignRoom(targetRoomId) {
    const rooms = this.gameState.getStateValue("rooms", []);

    if (targetRoomId) {
      const targetRoom = rooms.find(r => r.id === targetRoomId);
      return targetRoom && !this.gameState.getRoomTenant(targetRoom.id) ? targetRoom : null;
    }

    const emptyRooms = rooms.filter(r => !this.gameState.getRoomTenant(r.id));

    emptyRooms.sort((a, b) => {
      if (a.reinforced && !b.reinforced) return -1;
      if (!a.reinforced && b.reinforced) return 1;
      if (a.needsRepair && !b.needsRepair) return 1;
      if (!a.needsRepair && b.needsRepair) return -1;
      return 0;
    });

    return emptyRooms.length > 0 ? emptyRooms[0] : null;
  }

  createTenantFromApplicant(applicant) {
    const tenant = {
      id: applicant.id,
      name: applicant.name,
      type: applicant.type,
      typeName: applicant.typeName,
      skill: applicant.skill,
      rent: applicant.rent,
      infected: applicant.infected || false,
      onMission: false,
      personalResources: { ...applicant.personalResources },
      appearance: applicant.appearance,
      infectionRisk: applicant.infectionRisk,
      moveInDate: new Date().toISOString(),
      preferences: {},
      skillHistory: {},
    };

    this.registerPerson(applicant.id, tenant, "tenant");
    return tenant;
  }

  executeHiring(tenant, room) {
    this.gameState.state.people.set(tenant.id, tenant);
    this.gameState.state.roles.tenants.set(room.id, tenant.id);
    this.gameState.state.roles.tenantRooms.set(tenant.id, room.id);

    const updateSuccess = this.gameState.setState({
      rooms: this.gameState.getStateValue("rooms", []),
    }, `租客${tenant.name}入住`);

    if (!updateSuccess) {
      throw new Error("狀態更新失敗");
    }

    this.ensurePersonalResources(tenant);
  }

  // ==========================================
  // 租客驅逐系統
  // ==========================================

  async evictTenant(tenantId, isInfected = false, reason = "正常退租") {
    if (!this.initialized) {
      throw new Error("系統未初始化");
    }

    console.log(`🚪 開始驅逐租客ID: ${tenantId} (原因: ${reason})`);

    const tenantInfo = this.findTenantAndRoom(tenantId);
    if (!tenantInfo) {
      return {
        success: false,
        reason: "找不到指定租客",
        error: "找不到指定租客",
      };
    }

    const { tenant, room } = tenantInfo;
    const result = this.executeEviction(tenant, room, isInfected, reason);

    this.emitEvent("tenantEvicted", {
      tenant: tenant,
      room: room,
      reason: reason,
      isInfected: isInfected,
      result: result,
    });

    this.addLog(
      `${tenant.name} 離開了房間 ${room.id}`,
      isInfected ? "danger" : "event"
    );

    return result;
  }

  executeEviction(tenant, room, isInfected, reason) {
    const result = {
      success: true,
      reason: reason,
      refund: 0,
      penalty: 0,
      leftBehind: { food: 0, materials: 0, medical: 0, fuel: 0, cash: 0 },
    };

    if (isInfected) {
      // 感染者驅逐：收取處理費用 + 消毒 + 遺留物品
      result.penalty = this.config.evictionPenalty;

      if (this.resourceManager.hasEnoughResource("medical", 2)) {
        this.resourceManager.modifyResource("medical", -2, "disinfection");
        this.addLog("驅逐感染租客花費了 2 醫療用品進行消毒", "danger");
      } else {
        this.addLog("缺乏醫療用品，房間可能存在感染風險", "danger");
        room.needsRepair = true;
      }

      // 感染者被驅逐時遺留個人物品
      if (tenant.personalResources) {
        result.leftBehind = { ...tenant.personalResources };

        Object.keys(result.leftBehind).forEach((resourceType) => {
          const amount = result.leftBehind[resourceType];
          if (amount > 0) {
            this.resourceManager.modifyResource(resourceType, amount, "tenant_leftBehind");
          }
        });

        const totalLeftBehind = Object.values(result.leftBehind).reduce((sum, val) => sum + val, 0);
        if (totalLeftBehind > 0) {
          this.addLog(`${tenant.name} 倉促離開，遺留了個人物品`, "event");
        }
      }
    } else {
      // 正常離開：可能退還押金，租客帶走所有物品
      if (Math.random() < this.config.refundRate) {
        result.refund = Math.floor(tenant.rent * this.config.refundRate);
        if (result.refund > 0) {
          this.resourceManager.modifyResource("cash", -result.refund, "eviction_refund");
          this.addLog(`退還 ${tenant.name} 的押金 ${result.refund}`, "event");
        }
      }

      // 正常離開時，租客帶走所有個人物品，不遺留任何東西
      if (tenant.personalResources) {
        const totalPersonalResources = Object.values(tenant.personalResources).reduce((sum, val) => sum + val, 0);
        if (totalPersonalResources > 0) {
          this.addLog(`${tenant.name} 帶走了所有個人物品`, "event");
        }
      }
    }

    // 清理租客資料
    this.gameState.state.people.delete(tenant.id);
    this.gameState.state.roles.tenants.delete(room.id);
    this.gameState.state.roles.tenantRooms.delete(tenant.id);

    const updateSuccess = this.gameState.setState({
      rooms: this.gameState.getStateValue("rooms", []),
    }, `租客${tenant.name}離開`);

    if (!updateSuccess) {
      throw new Error("狀態更新失敗");
    }

    this.cleanupTenantData(tenant.id);
    return result;
  }

  cleanupTenantData(tenantId) {
    this.unregisterPerson(tenantId);
  }

  // ==========================================
  // 滿意度系統代理方法
  // ==========================================

  updateTenantSatisfaction(tenantId) {
    return this.satisfactionManager.updateSatisfaction(tenantId);
  }

  getTenantSatisfaction(tenantId) {
    return this.satisfactionManager.getSatisfaction(tenantId);
  }

  getSatisfactionStatus(satisfaction) {
    return this.satisfactionManager.getSatisfactionStatus(satisfaction);
  }

  calculateAverageSatisfaction() {
    return this.satisfactionManager.calculateAverageSatisfaction();
  }

  getSatisfactionDistribution() {
    return this.satisfactionManager.getSatisfactionDistribution();
  }

  getAllSatisfaction() {
    return new Map(this.satisfactionManager.tenantSatisfaction);
  }

  // ==========================================
  // 申請者系統
  // ==========================================

  generateApplicants(count) {
    if (!this.initialized) {
      throw new Error("系統未初始化，無法生成申請者");
    }

    const generateCount = count || Math.floor(Math.random() * 3) + 1;
    const applicants = [];

    for (let i = 0; i < generateCount; i++) {
      const applicant = this.createRandomApplicant();
      applicants.push(applicant);
    }

    this.gameState.setStateValue("applicants", applicants, "生成新申請者");
    console.log(`👥 生成了 ${applicants.length} 個申請者`);
    return applicants;
  }

  createRandomApplicant() {
    const tenantType = this.getRandomTenantType();
    const name = this.generateRandomName();
    const personId = this.generatePersonId();

    const applicant = {
      id: personId,
      name: name,
      type: tenantType.typeId,
      typeName: tenantType.typeName,
      skill: tenantType.skill,
      rent: tenantType.rent,
      infected: Math.random() < tenantType.infectionRisk,
      revealedInfection: false,
      appearance: "",
      infectionRisk: tenantType.infectionRisk,
      personalResources: { ...tenantType.personalResources },
      description: tenantType.description,
    };

    this.registerPerson(personId, applicant, "applicant");

    applicant.appearance = applicant.infected
      ? this.getInfectedAppearance()
      : this.getNormalAppearance();

    return applicant;
  }

  getRandomTenantType() {
    return this.tenantTypes[Math.floor(Math.random() * this.tenantTypes.length)];
  }

  generateRandomName() {
    const rules = this.dataManager.getGameRules();
    const names = rules.characterGeneration.names;
    return names[Math.floor(Math.random() * names.length)];
  }

  getInfectedAppearance() {
    const rules = this.dataManager.getGameRules();
    const infectedAppearances = rules.characterGeneration.appearances.infected;
    return infectedAppearances[Math.floor(Math.random() * infectedAppearances.length)];
  }

  getNormalAppearance() {
    const rules = this.dataManager.getGameRules();
    const normalAppearances = rules.characterGeneration.appearances.normal;
    return normalAppearances[Math.floor(Math.random() * normalAppearances.length)];
  }

  removeApplicant(applicantId) {
    const currentApplicants = this.gameState.getStateValue("applicants", []);
    const filteredApplicants = currentApplicants.filter(a => a.id !== applicantId);

    this.gameState.setStateValue("applicants", filteredApplicants, `移除申請者 ${applicantId}`);
    this.unregisterPerson(applicantId);

    return true;
  }

  getCurrentApplicants() {
    return this.gameState.getStateValue("applicants", []);
  }

  clearApplicants() {
    const currentApplicants = this.getCurrentApplicants();
    this.gameState.setStateValue("applicants", [], "清空申請者列表");

    currentApplicants.forEach(applicant => {
      this.unregisterPerson(applicant.id);
    });

    return true;
  }

  // ==========================================
  // 搜刮派遣系統
  // ==========================================

  async sendTenantScavenging(tenantId) {
    const tenantInfo = this.findTenantAndRoom(tenantId);
    if (!tenantInfo) {
      return { success: false, error: "找不到指定租客" };
    }

    const { tenant } = tenantInfo;

    if (tenant.onMission) {
      return { success: false, error: "租客已在執行任務中" };
    }

    if (tenant.infected) {
      return { success: false, error: "感染租客無法執行搜刮任務" };
    }

    tenant.onMission = true;

    const baseSuccessRate = this.getScavengeSuccessRate(tenant);
    const isSuccess = Math.random() < baseSuccessRate;

    let result = {
      success: isSuccess,
      tenantId: tenantId,
      tenantName: tenant.name,
      rewards: {},
      message: "",
    };

    if (isSuccess) {
      result.rewards = this.generateScavengeRewards(tenant);
      result.message = `${tenant.name} 成功搜刮到物資`;

      Object.entries(result.rewards).forEach(([resourceType, amount]) => {
        if (amount > 0) {
          this.resourceManager.modifyResource(resourceType, amount, "scavenge_reward");
        }
      });
    } else {
      result.message = `${tenant.name} 搜刮失敗，空手而歸`;
    }

    tenant.onMission = false;

    this.emitEvent("scavengeCompleted", result);
    this.addLog(result.message, isSuccess ? "event" : "event");

    return result;
  }

  getScavengeSuccessRate(tenant) {
    let baseRate = 0.6;

    switch (tenant.type) {
      case "soldier":
        baseRate = 0.8;
        break;
      case "worker":
        baseRate = 0.7;
        break;
      case "doctor":
        baseRate = 0.5;
        break;
      case "farmer":
        baseRate = 0.6;
        break;
      case "elder":
        baseRate = 0.4;
        break;
    }

    return baseRate;
  }

  generateScavengeRewards(tenant) {
    const rewards = { food: 0, materials: 0, medical: 0, fuel: 0, cash: 0 };

    switch (tenant.type) {
      case "soldier":
        rewards.materials = Math.floor(Math.random() * 3) + 1;
        rewards.medical = Math.floor(Math.random() * 2);
        break;
      case "worker":
        rewards.materials = Math.floor(Math.random() * 4) + 2;
        rewards.fuel = Math.floor(Math.random() * 2);
        break;
      case "doctor":
        rewards.medical = Math.floor(Math.random() * 3) + 2;
        rewards.food = Math.floor(Math.random() * 2);
        break;
      case "farmer":
        rewards.food = Math.floor(Math.random() * 4) + 2;
        rewards.cash = Math.floor(Math.random() * 10) + 5;
        break;
      case "elder":
        rewards.cash = Math.floor(Math.random() * 15) + 10;
        break;
    }

    return rewards;
  }

  // ==========================================
  // 工具函數
  // ==========================================

  findTenantAndRoom(tenantId) {
    const rooms = this.gameState.getStateValue("rooms", []);

    for (const room of rooms) {
      const tenant = this.gameState.getRoomTenant(room.id);
      if (tenant && tenant.id === tenantId) {
        return { tenant: tenant, room: room };
      }
    }

    return null;
  }

  findApplicantById(applicantId) {
    const applicants = this.gameState.getStateValue("applicants", []);
    return applicants.find((applicant) => applicant.id === applicantId) || null;
  }

  ensurePersonalResources(tenant) {
    if (!tenant.personalResources) {
      tenant.personalResources = {
        food: 0,
        materials: 0,
        medical: 0,
        fuel: 0,
        cash: 0,
      };
    }
  }

  getEmptyRooms() {
    return this.gameState.getEmptyRooms();
  }

  getTenantStats() {
    const tenants = this.gameState.getAllTenants();

    const stats = {
      totalTenants: tenants.length,
      healthyTenants: tenants.filter((t) => !t.infected).length,
      infectedTenants: tenants.filter((t) => t.infected).length,
      onMissionTenants: tenants.filter((t) => t.onMission).length,
      averageSatisfaction: this.calculateAverageSatisfaction(),
      totalRentIncome: tenants.reduce((sum, t) => sum + t.rent, 0),
      typeDistribution: {},
    };

    const types = ["doctor", "worker", "farmer", "soldier", "elder"];
    types.forEach((type) => {
      stats.typeDistribution[type] = tenants.filter(t => t.type === type).length;
    });

    return stats;
  }

  async resetDailyStates() {
    this.gameState.setStateValue("dailyActions.scavengeUsed", 0, "每日重置");

    const allTenants = this.gameState.getAllTenants();
    allTenants.forEach(tenant => {
      if (tenant.onMission) {
        tenant.onMission = false;
      }
    });

    return true;
  }

  cleanup() {
    this.clearApplicants();
    this.personRegistry.clear();
    this.nextPersonId = 1;

    if (this.satisfactionManager) {
      this.satisfactionManager.cleanup();
    }

    super.cleanup();
    console.log("TenantManager 已清理");
  }
}

export default TenantManager;
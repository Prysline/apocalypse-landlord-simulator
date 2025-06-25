// @ts-check

/**
 * @fileoverview TenantManager.js - 租客生命週期管理系統
 * 職責：租客雇用/驅逐、申請者管理、個人資源管理、統計報告
 */

import BaseManager from "./BaseManager.js";
import SatisfactionManager from "./SatisfactionManager.js";
import { getValidator } from "../utils/validators.js";
import RelationshipManager from "./RelationshipManager.js";
import systemLogger from "../utils/SystemLogger.js";

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
 * 自主探索觸發條件
 * @typedef {Object} AutonomousExplorationTrigger
 * @property {string} tenantId - 評估租客ID
 * @property {boolean} shouldExplore - 是否應該觸發探索
 * @property {string} priority - 觸發優先級 ('low'|'medium'|'high'|'critical')
 * @property {Array<string>} reasons - 觸發原因列表
 * @property {string|null} partnerId - 自動配對的夥伴ID
 * @property {number} resourceUrgency - 資源急迫性 (0-1)
 * @property {number} economicPressure - 經濟壓力 (0-1)
 * @property {number} riskAssessment - 風險評估 (0-1)
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
   * @param {Object} [explorationManager] - 探索系統管理器（可選，供後續注入）
   */
  constructor(gameState, resourceManager, dataManager, eventBus, explorationManager = null) {
    super(gameState, eventBus, "TenantManager");

    // === 現有依賴注入 ===
    /** @type {Object} 資源管理器 */
    this.resourceManager = resourceManager;

    /** @type {Object} 資料管理器 */
    this.dataManager = dataManager;

    /** @type {Object} 探索系統管理器 */
    this.explorationManager = explorationManager;

    // === 專責管理器 ===
    /** @type {SatisfactionManager|null} 滿意度管理器 */
    this.satisfactionManager = null;

    /** @type {RelationshipManager|null} 關係管理器 */
    this.relationshipManager = null;

    // === 配置數據 ===
    /** @type {Object|null} 系統配置 */
    this.config = null;

    /** @type {Object|null} 租客類型配置 */
    this.tenantTypes = null;


    // === 統一ID管理系統 ===
    /** @type {number} 統一個人ID計數器 */
    this.nextPersonId = 1;

    /** @type {Map<number, Object>} 個人註冊表 */
    this.personRegistry = new Map();


    // === 自主探索相關屬性 ===

    /** @type {Object|null} 探索系統配置 */
    this.explorationConfig = null;

    /** @type {Map<string, number>} 自主探索冷卻 (tenantId -> expireDay) */
    this.autonomousCooldowns = new Map();

    /** @type {Array<Object>} 自主探索歷史記錄（限制50筆） */
    this.autonomousHistory = [];

    /** @type {boolean} 自主探索功能啟用狀態 */
    this.autonomousExplorationEnabled = false;

    /** @type {Object|null} 驗證器實例 */
    this.validator = getValidator({
      enabled: true,
      strictMode: false,
      logErrors: true,
    });

    systemLogger.info("🏘️ TenantManager 初始化中...");
  }

  // ==========================================
  // BaseManager 抽象方法實作
  // ==========================================

  getModulePrefix() {
    return "tenant";
  }

  setupEventListeners() {
    if (!this.eventBus) throw new Error("EventBus 不可用");

    // === day_advanced 事件處理 ===
    this.onEvent("day_advanced", () => {
      // === 自主探索檢查 ===
      if (this.autonomousExplorationEnabled) {
        this._processAutonomousExplorationCheck();
      }
    }, { skipPrefix: true });

    // === 探索系統事件監聽器 ===
    // 監聽超額資源分配事件
    this.onEvent('exploration_surplus_distribution', (eventObj) => {
      const { participants, resourceType, amountPerPerson, reason } = eventObj.data;

      participants.forEach(tenantId => {
        this.modifyPersonalResource(tenantId, resourceType, amountPerPerson, reason);
      });

      this.addLog(`超額資源分配完成: ${participants.length} 人各得 ${resourceType} x${amountPerPerson}`);
    }, { skipPrefix: true });

    // 監聽額外獎勵分配事件
    this.onEvent('exploration_bonus_distribution', (eventObj) => {
      const { participants, resourceType, amountPerPerson, reason } = eventObj.data;

      participants.forEach(tenantId => {
        this.modifyPersonalResource(tenantId, resourceType, amountPerPerson, reason);
      });

      this.addLog(`額外獎勵分配完成: ${participants.length} 人各得 ${resourceType} x${amountPerPerson}`);
    }, { skipPrefix: true });

    // 監聽基礎報酬分配事件
    this.onEvent('exploration_base_payment_distribution', (eventObj) => {
      const { participants, payments, reason } = eventObj.data;

      participants.forEach(tenantId => {
        for (const [resourceType, amount] of Object.entries(payments)) {
          if (amount > 0) {
            this.modifyPersonalResource(tenantId, resourceType, amount, reason);
          }
        }
      });

      this.addLog(`基礎報酬分配完成: ${participants.length} 人獲得委託基礎報酬`);
    }, { skipPrefix: true });

    // 監聽佣金分配事件
    this.onEvent('exploration_commission_payment', (eventObj) => {
      const { participants, payments, reason } = eventObj.data;

      participants.forEach(tenantId => {
        for (const [resourceType, amount] of Object.entries(payments)) {
          if (amount > 0) {
            this.modifyPersonalResource(tenantId, resourceType, amount, reason);
          }
        }
      });

      this.addLog(`佣金分配完成: ${participants.length} 人獲得委託報酬`);
    }, { skipPrefix: true });

    // 監聽受傷事件
    this.onEvent('exploration_injury_occurred', (eventObj) => {
      const { tenantId, explorationType } = eventObj.data;
      // 僅記錄，不做額外處理（受傷已由探索系統處理）
      this.addLog(`租客 ${tenantId} 在 ${explorationType} 探索中受傷`);
    }, { skipPrefix: true });

    // 監聽探索開始事件，設置租客狀態
    this.onEvent('exploration_started', (eventObj) => {
      const { participants, type } = eventObj.data;

      participants.forEach(participantId => {
        const tenant = this.getTenant(participantId);
        if (tenant) {
          tenant.onMission = true;
          tenant.missionType = type;

          // 通知UI更新
          this.emitEvent('tenant_status_changed', {
            tenantId: participantId,
            statusType: 'onMission',
            newValue: true
          });
        }
      });

      this.addLog(`租客開始${type === 'commission' ? '委託' : '自主'}探索任務`);
    }, { skipPrefix: true });

    // 監聽探索完成事件，重置租客狀態
    this.onEvent('exploration_completed', (eventObj) => {
      const { type, result } = eventObj.data;

      if (result?.participants) {
        result.participants.forEach(participantResult => {
          const tenant = this.getTenant(participantResult.tenantId);
          if (tenant) {
            tenant.onMission = false;
            tenant.missionType = null;

            // 通知UI更新
            this.emitEvent('tenant_status_changed', {
              tenantId: participantResult.tenantId,
              statusType: 'onMission',
              newValue: false
            });
          }
        });
      }

      this.addLog(`${type === 'commission' ? '委託' : '自主'}探索任務完成`);
    }, { skipPrefix: true });

    // 監聽參與者受傷事件（新的事件處理）
    this.onEvent('participant_injured', (eventObj) => {
      const { tenantId, tenantName, explorationType } = eventObj.data;

      // 設置租客的受傷狀態
      const tenant = this.getTenant(tenantId);
      if (tenant) {
        tenant.injured = true;
        this.addLog(`${tenantName} 在${explorationType === 'commission' ? '委託' : '自主'}探索中受傷 🩹`);

        // 通知UI更新
        this.emitEvent('tenant_status_changed', {
          tenantId: tenantId,
          statusType: 'injured',
          newValue: true
        });
      }
    }, { skipPrefix: true });

    // 監聽關係度變化事件
    this.onEvent('relationship_change', (eventObj) => {
      const { tenantId, change, reason } = eventObj.data;

      if (this.satisfactionManager) {
        this.satisfactionManager.modifySatisfaction(tenantId, change, reason);
        this.addLog(`租客 ${tenantId} 滿意度變化: ${change > 0 ? '+' : ''}${change} (${reason})`);
      } else {
        this.logWarning(`無法更新租客 ${tenantId} 滿意度: SatisfactionManager 未初始化`);
      }
    }, { skipPrefix: true });

    systemLogger.success("✅ TenantManager 事件監聽器設置完成");
  }

  // ==========================================
  // 系統初始化
  // ==========================================

  async initialize() {
    systemLogger.info("👥 載入租客管理系統配置...");

    await this.loadConfigurations();
    this.initializeSatisfactionManager();
    this.initializeRelationshipManager();
    this.initializeTenantData();
    this.setupEventListeners();

    this.markInitialized(true);

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

    systemLogger.success("📋 租客系統配置載入完成");
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
    systemLogger.success("😊 滿意度管理器初始化完成");
  }

  initializeRelationshipManager() {
    const gameRules = this.dataManager.getGameRules();
    const relationshipConfig = gameRules.gameBalance?.relationships || {};

    this.relationshipManager = new RelationshipManager(
      this.gameState,
      this.eventBus,
      relationshipConfig
    );

    // 初始化關係管理器
    this.relationshipManager.initialize();
    systemLogger.success("🤝 關係管理器初始化完成");
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

    systemLogger.debug(`👤 開始雇用租客ID: ${applicantId}`);

    const applicant = this.findApplicantById(applicantId);
    if (!applicant) {
      return {
        success: false,
        error: `找不到申請者 ID: ${applicantId}`,
        reason: "申請者不存在"
      };
    }

    systemLogger.debug(`✅ 找到申請者: ${applicant.name} (${applicant.type})`);

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
      injured: applicant.injured || false,
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

    systemLogger.info(`🚪 開始驅逐租客ID: ${tenantId} (原因: ${reason})`);

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
    systemLogger.info(`👥 生成了 ${applicants.length} 個申請者`);
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
      injured: false,
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
  // 關係值管理方法
  // ==========================================

  /**
   * 取得租客間關係值
   * @param {string|number} tenantId1 - 租客1 ID
   * @param {string|number} tenantId2 - 租客2 ID
   * @returns {number} 關係值 (0-100)
   */
  getRelationshipValue(tenantId1, tenantId2) {
    if (!this.relationshipManager) {
      this.logWarning(`無法取得關係值: RelationshipManager 未初始化`);
      return 50; // 預設值
    }

    return this.relationshipManager.getRelationshipValue(tenantId1, tenantId2);
  }

  /**
   * 設置租客間關係值（基於 ID）
   * @param {string|number} tenantId1 - 租客1 ID
   * @param {string|number} tenantId2 - 租客2 ID
   * @param {number} value - 關係值 (0-100)
   * @param {string} [reason] - 變更原因
   * @returns {boolean} 設置是否成功
   */
  setRelationshipValue(tenantId1, tenantId2, value, reason = '關係更新') {
    if (!this.relationshipManager) {
      this.logWarning(`無法設置關係值: RelationshipManager 未初始化`);
      return false;
    }

    return this.relationshipManager.setRelationshipValue(tenantId1, tenantId2, value, reason);
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
    if (!this.relationshipManager) {
      this.logWarning(`無法調整關係值: RelationshipManager 未初始化`);
      return 50; // 預設值
    }

    return this.relationshipManager.adjustRelationshipValue(tenantId1, tenantId2, change, reason);
  }

  /**
   * 取得租客的所有關係值
   * @param {string|number} tenantId - 租客 ID
   * @returns {Object} 關係值映射 { otherTenantId: relationshipValue, ... }
   */
  getTenantRelationships(tenantId) {
    if (!this.relationshipManager) {
      this.logWarning(`無法取得租客關係: RelationshipManager 未初始化`);
      return {};
    }

    return this.relationshipManager.getTenantRelationships(tenantId);
  }

  // ==========================================
  // 自主探索功能
  // ==========================================

  /**
   * 設置探索系統管理器（後注入方式）
   * @param {Object} explorationManager - 探索系統管理器
   * @returns {Promise<boolean>} 設置是否成功
   */
  async setExplorationManager(explorationManager) {
    try {
      this.explorationManager = explorationManager;

      // 載入探索配置
      await this._loadExplorationConfig();

      // 啟用自主探索功能
      this.autonomousExplorationEnabled = true;

      this.logSuccess("探索系統管理器已設置，自主探索功能已啟用");
      return true;

    } catch (error) {
      this.logError("設置探索系統管理器失敗", error);
      this.autonomousExplorationEnabled = false;
      return false;
    }
  }

  /**
   * 檢查自主探索觸發（每日循環調用）
   * @returns {Array<AutonomousExplorationTrigger>} 觸發的自主探索列表
   */
  checkAutonomousExploration() {
    if (!this.autonomousExplorationEnabled || !this.explorationManager) {
      return [];
    }

    const availableTenants = this.getAvailableTenants();
    const triggers = [];

    for (const tenant of availableTenants) {
      // 檢查冷卻時間
      if (this.isAutonomousExplorationOnCooldown(tenant.id)) {
        continue;
      }

      // 評估探索需求
      const trigger = this.evaluateAutonomousExplorationNeed(tenant);

      if (trigger.shouldExplore) {
        // 機率檢查
        const config = this.explorationConfig.autonomous;
        if (Math.random() > config.checkProbability) {
          continue;
        }

        // 尋找組隊夥伴
        trigger.partnerId = this._findAutonomousPartner(tenant.id);

        triggers.push(trigger);

        // 異步執行自主探索
        this._executeAutonomousExplorationAsync(trigger)
          .catch(error => {
            this.logError(`自主探索執行失敗: ${tenant.name}`, error);
          });
      }
    }

    if (triggers.length > 0) {
      this.addLog(`自主探索觸發: ${triggers.length} 位租客開始探索`);
    }

    return triggers;
  }

  /**
   * 評估租客自主探索需求
   * @param {Object} tenant - 租客物件
   * @returns {AutonomousExplorationTrigger} 觸發評估結果
   */
  evaluateAutonomousExplorationNeed(tenant) {
    const config = this.explorationConfig.autonomous;
    const resources = tenant.personalResources || {};
    const reasons = [];

    let shouldExplore = false;
    let priority = 'low';

    // 食物短缺檢查
    const foodAmount = resources.food || 0;
    if (foodAmount <= config.foodThreshold) {
      shouldExplore = true;
      priority = foodAmount === 0 ? 'critical' : 'high';
      reasons.push(foodAmount === 0 ? '食物完全短缺' : '食物嚴重不足');
    }

    // 經濟壓力檢查
    const rentCost = this._calculateTenantRentCost(tenant);
    const cashAmount = resources.cash || 0;
    const cashRatio = rentCost > 0 ? cashAmount / rentCost : 1;

    if (cashRatio < config.cashRatioThreshold) {
      shouldExplore = true;
      if (priority === 'low') priority = 'medium';
      reasons.push(`現金不足繳房租 (${Math.round(cashRatio * 100)}%)`);
    }

    // 計算評估因子
    const resourceUrgency = this._calculateResourceUrgency(resources);
    const economicPressure = Math.max(0, 1 - cashRatio);
    const riskAssessment = this._calculatePersonalRiskTolerance(tenant);

    // 綜合評估
    if (!shouldExplore && resourceUrgency > 0.6) {
      shouldExplore = true;
      priority = 'medium';
      reasons.push('整體資源緊缺');
    }

    return {
      tenantId: tenant.id,
      shouldExplore,
      priority,
      reasons,
      partnerId: null,
      resourceUrgency,
      economicPressure,
      riskAssessment
    };
  }

  // ==========================================
  // 冷卻機制管理
  // ==========================================

  /**
   * 檢查自主探索冷卻狀態
   * @param {string} tenantId - 租客ID
   * @returns {boolean} 是否在冷卻中
   */
  isAutonomousExplorationOnCooldown(tenantId) {
    const currentDay = this.gameState.getStateValue('day', 1);
    const expireDay = this.autonomousCooldowns.get(tenantId);

    return expireDay && currentDay < expireDay;
  }

  /**
   * 設置自主探索冷卻時間
   * @param {string} tenantId - 租客ID
   */
  setAutonomousExplorationCooldown(tenantId) {
    const currentDay = this.gameState.getStateValue('day', 1);
    const cooldownDays = this.explorationConfig.autonomous.cooldownDays || 1;
    const expireDay = currentDay + cooldownDays;

    this.autonomousCooldowns.set(tenantId, expireDay);
  }

  /**
   * 取得租客冷卻狀態
   * @param {string} tenantId - 租客ID
   * @returns {Object} 冷卻狀態
   */
  getTenantCooldownStatus(tenantId) {
    const currentDay = this.gameState.getStateValue('day', 1);
    const expireDay = this.autonomousCooldowns.get(tenantId);

    return {
      onCooldown: !!expireDay && currentDay < expireDay,
      expireDay: expireDay || null,
      remainingDays: expireDay ? Math.max(0, expireDay - currentDay) : 0
    };
  }

  // ==========================================
  // 統計和查詢 API
  // ==========================================

  /**
   * 取得自主探索統計
   * @returns {Object} 統計資料
   */
  getAutonomousExplorationStats() {
    const total = this.autonomousHistory.length;
    const successful = this.autonomousHistory.filter(h => h.result && h.result.success).length;
    const activeCooldowns = Array.from(this.autonomousCooldowns.values())
      .filter(expireDay => expireDay > this.gameState.getStateValue('day', 1)).length;

    return {
      enabled: this.autonomousExplorationEnabled,
      totalExplorations: total,
      successfulExplorations: successful,
      successRate: total > 0 ? successful / total : 0,
      activeCooldowns: activeCooldowns,
      recentExplorations: this.autonomousHistory.slice(-10)
    };
  }

  // ==========================================
  // 私有方法：自主探索邏輯
  // ==========================================

  /**
   * 處理自主探索檢查（內部調用）
   * @private
   */
  _processAutonomousExplorationCheck() {
    try {
      const triggers = this.checkAutonomousExploration();

      // 清理系統資源
      this._cleanExpiredCooldowns();

    } catch (error) {
      this.logError("自主探索檢查失敗", error);
    }
  }

  /**
   * 異步執行自主探索
   * @param {AutonomousExplorationTrigger} trigger - 觸發條件
   * @returns {Promise<Object>} 探索結果
   * @private
   */
  async _executeAutonomousExplorationAsync(trigger) {
    try {
      // 設定冷卻時間
      this.setAutonomousExplorationCooldown(trigger.tenantId);
      if (trigger.partnerId) {
        this.setAutonomousExplorationCooldown(trigger.partnerId);
      }

      // 發送自主探索觸發事件
      this.emitEvent('autonomous_exploration_triggered', {
        primaryTenant: trigger.tenantId,
        participants: trigger.partnerId ? [trigger.tenantId, trigger.partnerId] : [trigger.tenantId],
        priority: trigger.priority,
        reasons: trigger.reasons
      }, { skipPrefix: true });

      // 構建探索請求
      const explorationRequest = this._buildAutonomousExplorationRequest(trigger);

      // 委託給探索管理器執行
      const result = await this.explorationManager.executeExploration(explorationRequest);

      // 記錄歷史
      this._recordAutonomousExploration(trigger, result);

      this.addLog(`自主探索完成: ${trigger.tenantId} - ${result.success ? '成功' : '失敗'}`);

      return result;

    } catch (error) {
      this.logError(`自主探索執行失敗: ${trigger.tenantId}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 載入探索系統配置
   * @private
   */
  async _loadExplorationConfig() {
    try {
      this.explorationConfig = this.dataManager.getRuleValue('gameBalance.explorationSystem');

      if (!this.explorationConfig) {
        throw new Error('探索系統配置未找到');
      }

      systemLogger.info('自主探索配置已載入');

    } catch (error) {
      this.logError('自主探索配置載入失敗', error);

      // 使用預設配置
      this.explorationConfig = {
        autonomous: {
          foodThreshold: 2,
          cashRatioThreshold: 0.5,
          checkProbability: 0.8,
          cooldownDays: 1
        },
        riskTolerance: {
          soldier: 0.8, worker: 0.6, farmer: 0.5, doctor: 0.3, elder: 0.2
        },
        teamwork: {
          relationshipThreshold: 60
        }
      };

      this.logWarning('使用預設探索配置');
    }
  }

  /**
   * 構建自主探索請求
   * @param {AutonomousExplorationTrigger} trigger - 觸發條件
   * @returns {Object} 探索請求物件
   * @private
   */
  _buildAutonomousExplorationRequest(trigger) {
    // 收集參與者資訊
    const participants = [];

    const primaryTenant = this.findTenantAndRoom(trigger.tenantId).tenant;
    if (primaryTenant) {
      participants.push({
        id: primaryTenant.id,
        name: primaryTenant.name,
        type: primaryTenant.type,
        personalResources: primaryTenant.personalResources || {}
      });
    }

    if (trigger.partnerId) {
      const partner = this.findTenantAndRoom(trigger.partnerId).tenant;
      if (partner) {
        participants.push({
          id: partner.id,
          name: partner.name,
          type: partner.type,
          personalResources: partner.personalResources || {}
        });
      }
    }

    // 根據急迫性選擇目標資源
    let targetResource = 'food';
    let targetAmount = 5;

    if (trigger.reasons.some(r => r.includes('食物'))) {
      targetResource = 'food';
      targetAmount = Math.floor(Math.random() * 5) + 3;
    } else if (trigger.reasons.some(r => r.includes('現金'))) {
      targetResource = 'materials';
      targetAmount = Math.floor(Math.random() * 3) + 2;
    } else {
      const resources = ['food', 'materials', 'medical', 'fuel'];
      targetResource = resources[Math.floor(Math.random() * resources.length)];
      targetAmount = Math.floor(Math.random() * 4) + 2;
    }

    return {
      type: 'autonomous',
      requestId: `autonomous_${trigger.tenantId}_${Date.now()}`,
      resourceType: targetResource,
      targetAmount: targetAmount,
      participants: participants,
      priority: trigger.priority,
      basePayment: {},
      commission: {}
    };
  }

  /**
   * 其他私有輔助方法
   * @private
   */
  _calculateTenantRentCost(tenant) {
    let rentCost = tenant.rent || 0;
    const tenantInfo = this.findTenantAndRoom && this.findTenantAndRoom(tenant.id);
    if (tenantInfo && tenantInfo.room && tenantInfo.room.reinforced) {
      const reinforcementBonus = this.dataManager?.getRuleValue('gameBalance.economy.rentPayment.reinforcementBonus') || 0.2;
      rentCost *= (1 + reinforcementBonus);
    }
    return Math.round(rentCost);
  }

  _calculateResourceUrgency(resources) {
    let urgency = 0;
    let factorCount = 0;

    const food = resources.food || 0;
    if (food <= 0) urgency += 1.0;
    else if (food <= 2) urgency += 0.8;
    else if (food <= 5) urgency += 0.4;
    factorCount++;

    const cash = resources.cash || 0;
    if (cash <= 5) urgency += 0.6;
    else if (cash <= 15) urgency += 0.3;
    factorCount++;

    const medical = resources.medical || 0;
    if (medical <= 0) urgency += 0.4;
    else if (medical <= 1) urgency += 0.2;
    factorCount++;

    const fuel = resources.fuel || 0;
    if (fuel <= 1) urgency += 0.3;
    else if (fuel <= 3) urgency += 0.1;
    factorCount++;

    return factorCount > 0 ? Math.min(urgency / factorCount, 1) : 0;
  }

  _calculatePersonalRiskTolerance(tenant) {
    const baseRiskTolerance = this.explorationConfig.riskTolerance[tenant.type] || 0.5;
    const satisfaction = this.getTenantSatisfaction && this.getTenantSatisfaction(tenant.name) || 50;
    const satisfactionFactor = satisfaction / 100;
    const adjustedRisk = baseRiskTolerance * (0.8 + 0.4 * satisfactionFactor);
    return Math.max(0.1, Math.min(0.9, adjustedRisk));
  }

  _findAutonomousPartner(primaryTenantId) {
    const config = this.explorationConfig.teamwork;
    const availableTenants = this.getAvailableTenants && this.getAvailableTenants()
      .filter(t => t.id !== primaryTenantId) || [];

    const primaryTenant = this.findTenantAndRoom && this.findTenantAndRoom(primaryTenantId).tenant;
    if (!primaryTenant) return null;

    for (const candidate of availableTenants) {
      if (this.isAutonomousExplorationOnCooldown(candidate.id)) {
        continue;
      }

      const relationship = this.getRelationshipValue(primaryTenantId, candidate.id);

      if (relationship >= config.relationshipThreshold) {
        const partnerTrigger = this.evaluateAutonomousExplorationNeed(candidate);
        if (partnerTrigger.shouldExplore || Math.random() < 0.3) {
          return candidate.id;
        }
      }
    }

    return null;
  }

  _recordAutonomousExploration(trigger, result) {
    this.autonomousHistory.push({
      tenantId: trigger.tenantId,
      priority: trigger.priority,
      reasons: trigger.reasons,
      partnerId: trigger.partnerId,
      result: result,
      timestamp: new Date().toISOString()
    });

    if (this.autonomousHistory.length > 50) {
      this.autonomousHistory.shift();
    }
  }

  _cleanExpiredCooldowns() {
    const currentDay = this.gameState.getStateValue('day', 1);

    for (const [tenantId, expireDay] of this.autonomousCooldowns.entries()) {
      if (currentDay >= expireDay) {
        this.autonomousCooldowns.delete(tenantId);
      }
    }
  }

  /**
   * 計算基於職業的基礎關係值
   * @param {string} type1 - 職業類型1
   * @param {string} type2 - 職業類型2
   * @returns {number} 基礎關係值
   * @private
   */
  _calculateBaseRelationship(type1, type2) {
    // 職業關係矩陣
    const relationshipMatrix = {
      soldier: { soldier: 70, worker: 60, farmer: 55, doctor: 65, elder: 50 },
      worker: { soldier: 60, worker: 65, farmer: 70, doctor: 60, elder: 55 },
      farmer: { soldier: 55, worker: 70, farmer: 75, doctor: 60, elder: 65 },
      doctor: { soldier: 65, worker: 60, farmer: 60, doctor: 70, elder: 80 },
      elder: { soldier: 50, worker: 55, farmer: 65, doctor: 80, elder: 75 }
    };

    return relationshipMatrix[type1]?.[type2] || 50;
  }


  // ==========================================
  // 工具函數
  // ==========================================

  /**
   * 取得可用租客列表
   * @returns {Array<Object>} 可用租客列表
   */
  getAvailableTenants() {
    try {
      const allTenants = this.gameState.getAllTenants();

      // 過濾出可用的租客（不在任務中、健康狀態良好）
      return allTenants.filter(tenant => {
        // 檢查是否在任務中
        if (tenant.onMission) {
          return false;
        }

        // 檢查是否受感染
        if (tenant.infected) {
          return false;
        }

        // 檢查是否在自主探索冷卻中
        if (this.isAutonomousExplorationOnCooldown(tenant.id)) {
          return false;
        }

        return true;
      });

    } catch (error) {
      this.logError('取得可用租客列表失敗', error);
      return [];
    }
  }

  /**
   * 標準租客查詢的唯一方法
   * 所有其他方法都應該使用這個基礎 API
   */
  findTenantAndRoom(tenantId) {
    if (typeof tenantId === 'string') {
      tenantId = Number(tenantId)
    }
    const rooms = this.gameState.getStateValue("rooms", []);

    for (const room of rooms) {
      const tenant = this.gameState.getRoomTenant(room.id);
      if (tenant && tenant.id === tenantId) {
        return { tenant: tenant, room: room };
      }
    }

    return null;
  }

  getTenant(tenantId) {
    const result = this.findTenantAndRoom(tenantId);
    return result ? result.tenant : null;
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

  /**
   * 修改租客個人資源
   * @param {string} tenantId - 租客ID
   * @param {string} resourceType - 資源類型
   * @param {number} amount - 變更數量（可為負數）
   * @param {string} reason - 修改原因
   * @returns {boolean} 修改是否成功
   */
  modifyPersonalResource(tenantId, resourceType, amount, reason) {
    try {
      const tenantInfo = this.findTenantAndRoom(tenantId);
      if (!tenantInfo || !tenantInfo.tenant) {
        this.logWarning(`修改個人資源失敗：找不到租客 ${tenantId}`);
        return false;
      }

      const tenant = tenantInfo.tenant;

      // 確保個人資源物件存在
      if (!tenant.personalResources) {
        tenant.personalResources = {};
      }

      // 取得當前資源數量
      const currentAmount = tenant.personalResources[resourceType] || 0;
      const newAmount = Math.max(0, currentAmount + amount);

      // 更新資源
      tenant.personalResources[resourceType] = newAmount;

      // 更新遊戲狀態
      this.gameState.setState({
        people: this.gameState.getStateValue('people')
      }, `租客 ${tenant.name} ${reason}: ${resourceType} ${amount > 0 ? '+' : ''}${amount}`);

      this.addLog(`租客 ${tenant.name} ${reason}: ${resourceType} ${currentAmount} → ${newAmount}`);

      return true;

    } catch (error) {
      this.logError(`修改租客個人資源失敗: ${tenantId}`, error);
      return false;
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

  /**
   * 清理已離開租客的關係值記錄
   * @returns {number} 清理的記錄數量
   */
  cleanupRelationships() {
    try {
      const relationships = this.gameState.getStateValue('tenantRelationships', {});
      const currentTenants = this.gameState.getAllTenants();
      const currentTenantIds = new Set(currentTenants.map(t => String(t.id)));

      let cleanedCount = 0;

      // 檢查並清理無效的關係記錄
      for (const [relationshipKey, value] of Object.entries(relationships)) {
        const [id1, id2] = relationshipKey.split('_');

        // 如果任一租客已不存在，刪除關係記錄
        if (!currentTenantIds.has(id1) || !currentTenantIds.has(id2)) {
          delete relationships[relationshipKey];
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.gameState.setStateValue('tenantRelationships', relationships, '清理已離開租客的關係記錄');
        systemLogger.info(`清理了 ${cleanedCount} 個無效的關係記錄`);
      }

      return cleanedCount;

    } catch (error) {
      this.logError('清理關係值記錄失敗', error);
      return 0;
    }
  }

  /**
   * 修改租客滿意度（代理方法，委託給 SatisfactionManager）
   * @param {string} tenantId - 租客ID
   * @param {number} change - 滿意度變化值
   * @param {string} [reason='交易互動'] - 變化原因
   * @returns {boolean} 是否成功修改
   */
  modifyTenantSatisfaction(tenantId, change, reason = '交易互動') {
    if (!this.satisfactionManager) {
      this.logWarning(`無法修改租客 ${tenantId} 滿意度: SatisfactionManager 未初始化`);
      return false;
    }
    this.satisfactionManager.modifySatisfaction(Number(tenantId), change, reason);
    return true
  }

  cleanup() {
    // 清理申請者資料
    this.clearApplicants();

    // 清理個人註冊表
    this.personRegistry.clear();
    this.nextPersonId = 1;

    // 清理關係管理器
    if (this.relationshipManager) {
      this.relationshipManager.cleanup();
    }

    // 清理滿意度管理器
    if (this.satisfactionManager) {
      this.satisfactionManager.cleanup();
    }

    // 調用父類清理
    super.cleanup();
    systemLogger.success("TenantManager 已清理");
  }
}

export default TenantManager;
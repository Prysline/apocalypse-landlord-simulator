/**
 * ModalManager - 模態框管理系統
 * 職責：模態框狀態管理、內容動態生成、事件處理、多模態框協調
 */

import { UI_CONSTANTS } from "../utils/constants.js";

export class ModalManager extends EventTarget {
  constructor(gameInstance) {
    super();

    // 核心依賴
    this.game = gameInstance;

    // 模態框狀態管理
    this.activeModals = new Set();
    this.modalElements = new Map();
    this.modalHistory = [];

    // 內容生成器映射
    this.contentGenerators = new Map();

    // 配置參數
    this.config = {
      animationDuration: UI_CONSTANTS.ANIMATION?.MODAL_FADE_DURATION || 200,
      maxHistory: 10,
      allowMultiple: false,
      escapeToClose: true,
    };

    // 初始化狀態
    this.isInitialized = false;

    console.log("🪟 ModalManager 建構完成");
  }

  /**
   * 初始化模態框管理系統
   */
  initialize() {
    try {
      console.log("🪟 正在初始化 ModalManager...");

      // 掃描並註冊現有模態框
      this.scanAndRegisterModals();

      // 註冊內容生成器
      this.registerContentGenerators();

      // 設定模態框事件監聽
      this.setupModalEventListeners();

      this.isInitialized = true;
      console.log("✅ ModalManager 初始化完成");

      return true;
    } catch (error) {
      console.error("❌ ModalManager 初始化失敗:", error);
      return false;
    }
  }

  /**
   * 掃描並註冊現有模態框
   */
  scanAndRegisterModals() {
    const modalElements = document.querySelectorAll(".modal");

    modalElements.forEach((modal) => {
      const modalId = modal.id;
      if (modalId) {
        this.modalElements.set(modalId, modal);
        console.log(`📋 註冊模態框: ${modalId}`);
      }
    });

    console.log(`📊 共註冊 ${this.modalElements.size} 個模態框`);
  }

  /**
   * 註冊內容生成器
   */
  registerContentGenerators() {
    // 訪客模態框內容生成器
    this.contentGenerators.set("visitorModal", (data) => {
      return this.generateVisitorModalContent(data.applicants || []);
    });

    // 技能模態框內容生成器
    this.contentGenerators.set("skillModal", (data) => {
      return this.generateSkillModalContent(data.skillsByTenant || []);
    });

    // 搜刮模態框內容生成器
    this.contentGenerators.set("scavengeModal", (data) => {
      return this.generateScavengeModalContent(data.availableTenants || []);
    });

    console.log(`🏭 註冊了 ${this.contentGenerators.size} 個內容生成器`);
  }

  /**
   * 設定模態框事件監聽
   */
  setupModalEventListeners() {
    // 點擊背景關閉模態框
    document.addEventListener("click", (event) => {
      if (event.target.classList.contains("modal")) {
        this.closeModal(event.target.id);
      }
    });

    // ESC 鍵關閉模態框
    if (this.config.escapeToClose) {
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.activeModals.size > 0) {
          this.closeAllModals();
        }
      });
    }

    console.log("🎧 模態框事件監聽器已設定");
  }

  /**
   * 顯示訪客模態框
   */
  showVisitorModal() {
    console.log("🚪 顯示訪客模態框...");

    // 生成申請者
    const applicants = this.game.generateApplicants();

    // 顯示模態框
    this.openModal("visitorModal", { applicants });
  }

  /**
   * 顯示技能模態框
   */
  showSkillModal() {
    console.log("⚡ 顯示技能模態框...");

    // 檢查技能系統是否可用
    if (!this.game.skillSystem?.getStatus().initialized) {
      alert("技能系統載入中，請稍候...");
      return false;
    }

    // 收集租客技能資訊
    const skillsByTenant = this.collectTenantSkills();

    // 顯示模態框
    this.openModal("skillModal", { skillsByTenant });
    return true;
  }

  /**
   * 顯示搜刮模態框
   */
  showScavengeModal() {
    console.log("🎒 顯示搜刮模態框...");

    // 檢查搜刮條件
    if (
      this.game.gameState.scavengeUsed >= this.game.gameState.maxScavengePerDay
    ) {
      alert("今天的搜刮次數已用完！");
      return false;
    }

    // 取得可用租客
    const availableTenants = this.game.getAvailableTenantsForScavenge();

    if (availableTenants.length === 0) {
      alert("沒有可派遣的租客！");
      return false;
    }

    // 顯示模態框
    this.openModal("scavengeModal", { availableTenants });
    return true;
  }

  /**
   * 收集租客技能資訊
   */
  collectTenantSkills() {
    const skillsByTenant = [];

    this.game.gameState.rooms.forEach((room) => {
      if (room.tenant && !room.tenant.infected) {
        const tenant = room.tenant;
        const tenantSkills = this.game.skillSystem.getAvailableSkills(
          tenant.name
        );

        if (tenantSkills.length > 0) {
          skillsByTenant.push({ tenant, skills: tenantSkills });
        }
      }
    });

    return skillsByTenant;
  }

  /**
   * 統一的模態框開啟方法
   */
  openModal(modalId, data = {}) {
    try {
      // 檢查模態框是否存在
      const modalElement = this.modalElements.get(modalId);
      if (!modalElement) {
        console.error(`❌ 模態框不存在: ${modalId}`);
        return false;
      }

      // 關閉其他模態框（如果不允許多重開啟）
      if (!this.config.allowMultiple && this.activeModals.size > 0) {
        this.closeAllModals();
      }

      // 生成內容
      const contentGenerated = this.generateModalContent(modalId, data);
      if (!contentGenerated) {
        console.error(`❌ 內容生成失敗: ${modalId}`);
        return false;
      }

      // 顯示模態框
      modalElement.style.display = "block";
      this.activeModals.add(modalId);

      // 記錄歷史
      this.addToHistory(modalId, data);

      // 發送開啟事件
      this.dispatchEvent(
        new CustomEvent("modalOpened", {
          detail: { modalId, data, timestamp: Date.now() },
        })
      );

      console.log(`✅ 模態框已開啟: ${modalId}`);
      return true;
    } catch (error) {
      console.error(`❌ 開啟模態框失敗 ${modalId}:`, error);
      return false;
    }
  }

  /**
   * 生成模態框內容
   */
  generateModalContent(modalId, data) {
    const generator = this.contentGenerators.get(modalId);
    if (!generator) {
      console.warn(`⚠️ 沒有找到內容生成器: ${modalId}`);
      return true; // 允許顯示現有內容
    }

    try {
      const content = generator(data);
      this.setModalContent(modalId, content);
      return true;
    } catch (error) {
      console.error(`❌ 生成模態框內容失敗 ${modalId}:`, error);
      return false;
    }
  }

  /**
   * 設定模態框內容
   */
  setModalContent(modalId, content) {
    const modalElement = this.modalElements.get(modalId);
    if (!modalElement) return false;

    // 尋找內容容器
    const contentContainer = modalElement.querySelector(
      `#${modalId.replace("Modal", "List")}`
    );
    if (contentContainer && content.listContent) {
      contentContainer.innerHTML = content.listContent;
    }

    // 設定其他動態內容
    if (content.additionalUpdates) {
      content.additionalUpdates.forEach((update) => {
        const element = modalElement.querySelector(update.selector);
        if (element) {
          element.textContent = update.content;
        }
      });
    }

    return true;
  }

  /**
   * 生成訪客模態框內容
   */
  generateVisitorModalContent(applicants) {
    if (applicants.length === 0) {
      return {
        listContent: '<div class="applicant">今日沒有訪客前來應徵</div>',
      };
    }

    const listContent = applicants
      .map((applicant) => {
        const infectionStatus = applicant.revealedInfection
          ? '<br><span style="color:#ff6666; font-weight:bold;">⚠ 已檢測出感染！</span>'
          : "";

        return `
        <div class="applicant ${applicant.infected ? "infected" : ""}">
          <strong>${applicant.name}</strong> - ${
          applicant.typeName || applicant.type
        }<br>
          <small>${applicant.description || "尋找住所的倖存者"}</small><br>
          <small style="color: #aaa;">外觀: ${applicant.appearance}</small><br>
          房租: ${applicant.rent}/天${infectionStatus}<br>
          ${
            applicant.personalResources
              ? `<small>個人資源: 食物${applicant.personalResources.food} 現金$${applicant.personalResources.cash}</small><br>`
              : ""
          }
          <button class="btn ${applicant.infected ? "danger" : ""}" 
                  onclick="window.gameApp.hireTenant('${applicant.id}')">
            雇用${applicant.infected ? " (危險)" : ""}
          </button>
        </div>
      `;
      })
      .join("");

    return { listContent };
  }

  /**
   * 生成技能模態框內容
   */
  generateSkillModalContent(skillsByTenant) {
    if (skillsByTenant.length === 0) {
      return {
        listContent: "<p>目前沒有可用的技能</p>",
      };
    }

    const listContent = skillsByTenant
      .map((tenantData) => {
        const { tenant, skills } = tenantData;
        const roomId =
          this.game.gameState.rooms.find((r) => r.tenant === tenant)?.id || "?";

        return `
        <div class="tenant-skill-group">
          <h4 style="color: #66ccff; margin: 15px 0 10px 0;">
            ${tenant.name} (${tenant.typeName || tenant.type}) - 房間${roomId}
          </h4>
          <div style="font-size: 11px; color: #aaa; margin-bottom: 10px;">
            個人現金: $${tenant.personalResources?.cash || 0}
          </div>
          ${skills
            .map(
              (skill) => `
            <div class="skill-actions">
              <h5 style="margin: 5px 0; color: #ffcc66;">${skill.name}</h5>
              <p style="margin: 5px 0; font-size: 12px;">${
                skill.description
              }</p>
              ${
                skill.cooldownRemaining > 0
                  ? `<p style="color: #ff9966;">冷卻中：${skill.cooldownRemaining} 天</p>`
                  : ""
              }
              ${
                !skill.canAfford
                  ? `<p style="color: #ff6666;">資源不足</p>`
                  : ""
              }
              <button class="btn ${
                skill.canAfford && skill.cooldownRemaining === 0
                  ? "success"
                  : ""
              }" 
                      onclick="window.gameApp.useSkillFromMenu('${
                        tenant.name
                      }', '${skill.id}')"
                      ${
                        !skill.canAfford || skill.cooldownRemaining > 0
                          ? "disabled"
                          : ""
                      }>
                使用技能
              </button>
            </div>
          `
            )
            .join("")}
        </div>
      `;
      })
      .join("");

    return { listContent };
  }

  /**
   * 生成搜刮模態框內容
   */
  generateScavengeModalContent(availableTenants) {
    const remainingScavenges =
      this.game.gameState.maxScavengePerDay - this.game.gameState.scavengeUsed;

    const listContent = availableTenants
      .map((tenant) => {
        // 計算成功率
        const successRate = this.game.calculateScavengeSuccessRate(tenant);
        const riskLevel =
          successRate >= 80 ? "低" : successRate >= 60 ? "中" : "高";
        const riskColor =
          successRate >= 80
            ? "#66ff66"
            : successRate >= 60
            ? "#ffcc66"
            : "#ff6666";

        return `
        <div class="applicant">
          <strong>${tenant.name}</strong> - ${
          tenant.typeName || tenant.type
        }<br>
          <small>成功率: ${successRate}% (風險: <span style="color: ${riskColor}">${riskLevel}</span>)</small><br>
          <small>個人狀況: 食物${tenant.personalResources?.food || 0} 醫療${
          tenant.personalResources?.medical || 0
        }</small><br>
          <button class="btn" onclick="window.gameApp.sendTenantOnScavenge('${
            tenant.name
          }')">
            派遣搜刮
          </button>
        </div>
      `;
      })
      .join("");

    return {
      listContent,
      additionalUpdates: [
        {
          selector: "#remainingScavenges",
          content: remainingScavenges.toString(),
        },
      ],
    };
  }

  /**
   * 關閉指定模態框
   */
  closeModal(modalId = null) {
    try {
      if (modalId) {
        // 關閉指定模態框
        const modalElement = this.modalElements.get(modalId);
        if (modalElement && this.activeModals.has(modalId)) {
          modalElement.style.display = "none";
          this.activeModals.delete(modalId);

          this.dispatchEvent(
            new CustomEvent("modalClosed", {
              detail: { modalId, timestamp: Date.now() },
            })
          );

          console.log(`✅ 模態框已關閉: ${modalId}`);
          return true;
        }
      } else {
        // 關閉最近開啟的模態框
        if (this.activeModals.size > 0) {
          const lastModalId = Array.from(this.activeModals).pop();
          return this.closeModal(lastModalId);
        }
      }

      return false;
    } catch (error) {
      console.error(`❌ 關閉模態框失敗 ${modalId}:`, error);
      return false;
    }
  }

  /**
   * 關閉所有模態框
   */
  closeAllModals() {
    const closedModals = [];

    this.activeModals.forEach((modalId) => {
      const modalElement = this.modalElements.get(modalId);
      if (modalElement) {
        modalElement.style.display = "none";
        closedModals.push(modalId);
      }
    });

    this.activeModals.clear();

    if (closedModals.length > 0) {
      this.dispatchEvent(
        new CustomEvent("allModalsClosed", {
          detail: { closedModals, timestamp: Date.now() },
        })
      );

      console.log(`✅ 已關閉所有模態框: ${closedModals.join(", ")}`);
    }

    return closedModals.length;
  }

  /**
   * 添加到歷史記錄
   */
  addToHistory(modalId, data) {
    this.modalHistory.unshift({
      modalId,
      data,
      timestamp: Date.now(),
    });

    // 限制歷史記錄長度
    if (this.modalHistory.length > this.config.maxHistory) {
      this.modalHistory = this.modalHistory.slice(0, this.config.maxHistory);
    }
  }

  /**
   * 檢查模態框是否開啟
   */
  isModalOpen(modalId = null) {
    if (modalId) {
      return this.activeModals.has(modalId);
    }
    return this.activeModals.size > 0;
  }

  /**
   * 取得當前開啟的模態框
   */
  getActiveModals() {
    return Array.from(this.activeModals);
  }

  /**
   * 取得狀態資訊
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      registeredModals: this.modalElements.size,
      activeModals: this.activeModals.size,
      contentGenerators: this.contentGenerators.size,
      historyLength: this.modalHistory.length,
      config: this.config,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log("⚙️ ModalManager 配置已更新");
  }

  /**
   * 註冊新的內容生成器
   */
  registerContentGenerator(modalId, generator) {
    if (typeof generator !== "function") {
      console.error("❌ 內容生成器必須是函數");
      return false;
    }

    this.contentGenerators.set(modalId, generator);
    console.log(`🏭 註冊內容生成器: ${modalId}`);
    return true;
  }

  /**
   * 清理資源
   */
  cleanup() {
    this.closeAllModals();
    this.modalElements.clear();
    this.contentGenerators.clear();
    this.modalHistory = [];
    this.activeModals.clear();

    console.log("🧹 ModalManager 資源已清理");
  }
}

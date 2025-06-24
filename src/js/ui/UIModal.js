/**
 * UIModal.js - UI模態框控制器
 * 職責：模態框生命週期管理、內容動態生成
 */

import systemLogger from '../utils/SystemLogger.js';

export default class UIModal {
  constructor(gameApp, uiCore = null) {
    this.gameApp = gameApp;
    this.uiCore = uiCore;
    this.activeModal = null;
    this.confirmCallback = null;
    this.modalStack = []; // 記錄模態框堆疊
  }

  async initialize() {
    systemLogger.success('✅ UIModal 初始化完成');
  }

  // =================== 核心模態框方法 ===================

  /**
   * 顯示模態框
   * @param {string} modalId - 模態框ID
   * @returns {boolean} 是否成功顯示
   */
  show(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      // 記錄模態框堆疊
      if (this.activeModal && this.activeModal !== modalId) {
        this.modalStack.push(this.activeModal);
      }

      modal.style.display = 'flex';
      this.activeModal = modalId;
      return true;
    }
    return false;
  }

  /**
   * 關閉指定模態框
   * @param {string|null} modalId - 模態框ID，null 表示關閉當前活動的
   * @returns {boolean} 是否成功關閉
   */
  close(modalId = null) {
    const targetModal = modalId || this.activeModal;
    if (targetModal) {
      const modal = document.getElementById(targetModal);
      if (modal) {
        modal.style.display = 'none';

        // 如果關閉的是當前活動模態框，返回上一個
        if (targetModal === this.activeModal) {
          this.activeModal = this.modalStack.pop() || null;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * 關閉所有模態框
   * @returns {boolean} 是否成功關閉
   */
  closeAll() {
    document.querySelectorAll(".modal").forEach((modal) => {
      if (modal instanceof HTMLElement) {
        modal.style.display = "none";
      }
    });
    this.activeModal = null;
    this.modalStack = [];
    return true;
  }

  // =================== 業務模態框方法 ===================

  /**
   * 設定確認對話框內容
   * @param {string} title - 標題
   * @param {string} message - 訊息
   */
  setConfirmContent(title, message) {
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
  }


  // =================== 狀態查詢 ===================

  getActiveModal() {
    return this.activeModal;
  }

  getModalStack() {
    return [...this.modalStack];
  }

  isModalOpen(modalId = null) {
    if (modalId) {
      return this.activeModal === modalId || this.modalStack.includes(modalId);
    }
    return !!this.activeModal;
  }

  // =================== 除錯支援 ===================

  debug() {
    systemLogger.debug('💬 UIModal 狀態:', {
      activeModal: this.activeModal,
      modalStack: this.modalStack
    });
  }

  getStatus() {
    return {
      activeModal: this.activeModal,
      modalStack: [...this.modalStack]
    };
  }
}
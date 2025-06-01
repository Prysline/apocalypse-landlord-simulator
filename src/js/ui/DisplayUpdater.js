/**
 * DisplayUpdater - 畫面更新管理模組
 * 職責：DOM元素更新、狀態顯示計算、遊戲記錄管理、視覺效果協調
 */

import { UI_CONSTANTS, DATA_TYPES, MESSAGE_TEMPLATES } from "../utils/constants.js";

export class DisplayUpdater extends EventTarget {
  constructor(gameInstance) {
    super();

    // 核心依賴
    this.game = gameInstance;
    this.gameHelpers = null; // 將由初始化時注入

    // 顯示狀態管理
    this.lastUpdateTime = 0;
    this.updateQueue = new Set();
    this.isUpdating = false;

    // DOM 元素快取
    this.elements = new Map();
    this.logContainer = null;

    // 更新統計
    this.stats = {
      totalUpdates: 0,
      elementUpdates: 0,
      logEntries: 0,
      errorCount: 0,
    };

    // 配置參數
    this.config = {
      maxLogEntries: UI_CONSTANTS.SYSTEM_LIMITS?.HISTORY.MAX_LOG_ENTRIES || 50,
      updateThrottleMs: 16, // ~60fps
      enableAnimations: true,
      autoScrollLog: true,
    };

    console.log("📺 DisplayUpdater 建構完成");
  }

  /**
   * 初始化顯示更新系統
   */
  initialize(gameHelpers = null) {
    try {
      console.log("📺 正在初始化 DisplayUpdater...");

      // 注入 GameHelpers 參照
      this.gameHelpers = gameHelpers;

      // 快取重要 DOM 元素
      this.cacheElements();

      // 初始化遊戲記錄容器
      this.initializeLogContainer();

      // 設定畫面更新機制
      this.setupUpdateMechanisms();

      console.log("✅ DisplayUpdater 初始化完成");
      return true;
    } catch (error) {
      console.error("❌ DisplayUpdater 初始化失敗:", error);
      this.stats.errorCount++;
      return false;
    }
  }

  /**
   * 快取重要 DOM 元素
   */
  cacheElements() {
    const elementIds = [
      'day', 'time', 'cash', 'buildingDefenseText', 'landlordHungerText',
      'scavengeCount', 'food', 'materials', 'medical', 'fuel',
      'tenantList', 'systemStatus', 'dataSystem', 'ruleEngine', 'gameBridge'
    ];

    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.elements.set(id, element);
      } else {
        console.warn(`⚠️ DOM 元素未找到: ${id}`);
      }
    });

    console.log(`📋 已快取 ${this.elements.size} 個 DOM 元素`);
  }

  /**
   * 初始化遊戲記錄容器
   */
  initializeLogContainer() {
    this.logContainer = document.getElementById('gameLog');
    
    if (this.logContainer) {
      console.log("📜 遊戲記錄容器已就緒");
    } else {
      console.warn("⚠️ 遊戲記錄容器未找到");
    }
  }

  /**
   * 設定畫面更新機制
   */
  setupUpdateMechanisms() {
    // 設定節流更新機制
    this.throttledUpdate = this.throttle(
      this.performBatchUpdate.bind(this),
      this.config.updateThrottleMs
    );

    console.log("⚙️ 畫面更新機制已設定");
  }

  /**
   * 主要畫面更新方法（公開介面）
   */
  updateDisplay() {
    this.stats.totalUpdates++;
    
    if (this.isUpdating) {
      // 如果正在更新，加入佇列
      this.updateQueue.add('full-update');
      return;
    }

    try {
      this.isUpdating = true;
      this.lastUpdateTime = Date.now();

      // 更新所有顯示元素
      this.updateGameStateDisplay();
      this.updateResourceDisplay();
      this.updateRoomDisplay();
      this.updateTenantList();
      this.updateSystemStatusDisplay();

      // 發送更新完成事件
      this.dispatchEvent(new CustomEvent('displayUpdated', {
        detail: { timestamp: this.lastUpdateTime }
      }));

    } catch (error) {
      console.error("❌ 畫面更新失敗:", error);
      this.stats.errorCount++;
    } finally {
      this.isUpdating = false;
      
      // 處理佇列中的更新
      if (this.updateQueue.size > 0) {
        this.updateQueue.clear();
        setTimeout(() => this.updateDisplay(), 10);
      }
    }
  }

  /**
   * 更新遊戲狀態顯示
   */
  updateGameStateDisplay() {
    if (!this.game?.gameState) return;

    const gameState = this.game.gameState;

    // 基本遊戲狀態
    this.updateElement('day', gameState.day);
    this.updateElement('time', gameState.time === 'day' ? '白天' : '夜晚');
    this.updateElement('cash', gameState.resources.cash);
    this.updateElement('scavengeCount', gameState.scavengeUsed);

    // 使用 GameHelpers 計算狀態顯示
    if (this.gameHelpers) {
      this.updateDefenseStatus(gameState.buildingDefense);
      this.updateHungerStatus(gameState.landlordHunger);
    } else {
      // 降級顯示
      this.updateElement('buildingDefenseText', `防禦(${gameState.buildingDefense})`);
      this.updateElement('landlordHungerText', `飢餓(${gameState.landlordHunger})`);
    }
  }

  /**
   * 更新防禦狀態顯示
   */
  updateDefenseStatus(buildingDefense) {
    const defenseStatus = this.gameHelpers.getDefenseStatus(buildingDefense);
    const element = this.elements.get('buildingDefenseText');

    if (element) {
      element.textContent = defenseStatus.text;
      element.style.color = defenseStatus.color;
      
      // 處理危險狀態動畫
      if (defenseStatus.critical) {
        element.classList.add('danger-status');
      } else {
        element.classList.remove('danger-status');
      }
    }
  }

  /**
   * 更新飢餓狀態顯示
   */
  updateHungerStatus(landlordHunger) {
    const hungerStatus = this.gameHelpers.getHungerStatus(landlordHunger);
    const element = this.elements.get('landlordHungerText');

    if (element) {
      element.textContent = hungerStatus.text;
      element.style.color = hungerStatus.color;
      
      // 處理危險狀態動畫
      if (hungerStatus.critical) {
        element.classList.add('danger-status');
      } else {
        element.classList.remove('danger-status');
      }
    }
  }

  /**
   * 更新資源顯示
   */
  updateResourceDisplay() {
    if (!this.game?.gameState?.resources) return;

    const resources = this.game.gameState.resources;
    
    // 更新各種資源顯示
    [
      DATA_TYPES.RESOURCE_TYPES.FOOD,
      DATA_TYPES.RESOURCE_TYPES.MATERIALS,
      DATA_TYPES.RESOURCE_TYPES.MEDICAL,
      DATA_TYPES.RESOURCE_TYPES.FUEL
    ].forEach(resource => {
      this.updateElement(resource, resources[resource] || 0);
    });
  }

  /**
   * 更新房間顯示
   */
  updateRoomDisplay() {
    if (!this.game?.gameState?.rooms) return;

    this.game.gameState.rooms.forEach(room => {
      this.updateSingleRoom(room);
    });
  }

  /**
   * 更新單一房間顯示
   */
  updateSingleRoom(room) {
    const roomElement = document.getElementById(`room${room.id}`);
    const infoElement = document.getElementById(`room${room.id}-info`);

    if (!roomElement || !infoElement) return;

    // 重置房間樣式
    roomElement.className = 'room';

    if (room.tenant) {
      // 房間有租客
      roomElement.classList.add('occupied');
      
      if (room.tenant.infected) {
        roomElement.classList.add('infected');
      }

      // 計算租客滿意度顯示
      const satisfaction = this.getTenantSatisfaction(room.tenant.name);
      const satisfactionIcon = this.getSatisfactionIcon(satisfaction);

      infoElement.innerHTML = `
        ${room.tenant.name}<br>
        <small>${room.tenant.typeName || room.tenant.type}</small><br>
        <small>滿意度: ${satisfaction} ${satisfactionIcon}</small>
      `;
    } else {
      // 空房
      infoElement.textContent = '空房';
    }

    // 房間狀態處理
    if (room.needsRepair) {
      roomElement.classList.add('needs-repair');
      infoElement.innerHTML += '<br><small style="color:#ff6666">需要維修</small>';
    }

    if (room.reinforced) {
      roomElement.classList.add('reinforced');
      infoElement.innerHTML += '<br><small style="color:#66ccff">已加固</small>';
    }
  }

  /**
   * 取得租客滿意度
   */
  getTenantSatisfaction(tenantName) {
    return this.game?.gameState?.tenantSatisfaction?.[tenantName] || 50;
  }

  /**
   * 取得滿意度圖標
   */
  getSatisfactionIcon(satisfaction) {
    if (satisfaction >= 70) return '😊';
    if (satisfaction >= 40) return '😐';
    return '😞';
  }

  /**
   * 更新租客列表
   */
  updateTenantList() {
    const tenantListElement = this.elements.get('tenantList');
    if (!tenantListElement || !this.game?.gameState?.rooms) return;

    const tenants = this.game.gameState.rooms
      .filter(room => room.tenant)
      .map(room => room.tenant);

    if (tenants.length === 0) {
      tenantListElement.innerHTML = '<div class="tenant-item">暫無租客</div>';
      return;
    }

    const tenantHtml = tenants.map(tenant => {
      return this.generateTenantItemHtml(tenant);
    }).join('');

    tenantListElement.innerHTML = tenantHtml;
  }

  /**
   * 生成租客項目 HTML
   */
  generateTenantItemHtml(tenant) {
    const satisfaction = this.getTenantSatisfaction(tenant.name);
    
    // 狀態文字
    let statusText = '';
    if (tenant.infected) {
      statusText = '<br><small style="color:#ff6666">已感染！</small>';
    } else if (tenant.onMission) {
      statusText = '<br><small style="color:#ffaa66">執行任務中</small>';
    }

    // 個人資源資訊
    let resourceInfo = '';
    if (tenant.personalResources) {
      resourceInfo = `<br><small style="color:#cccccc;">個人: $${tenant.personalResources.cash || 0} 食物${tenant.personalResources.food || 0}</small>`;
    }

    // 額外資訊（如果有 TenantSystem）
    let extraInfo = '';
    if (this.game.tenantSystem?.getStatus().initialized) {
      const tenantState = this.game.tenantSystem.getTenantState(tenant.name);
      if (tenantState?.stats) {
        extraInfo = `<br><small style="color:#aaa;">住了 ${tenantState.stats.daysLived} 天</small>`;
      }
    }

    return `
      <div class="tenant-item ${tenant.infected ? 'infected' : ''} ${tenant.type || tenant.typeId}">
        ${tenant.name} (${tenant.typeName || tenant.type})<br>
        <small>房租: ${tenant.rent}/天</small>
        ${resourceInfo}
        <small>滿意度: ${satisfaction}%</small>
        ${extraInfo}
        ${statusText}
      </div>
    `;
  }

  /**
   * 更新系統狀態顯示
   */
  updateSystemStatusDisplay() {
    // 更新主要系統狀態
    this.updateSystemStatus();
    
    // 更新詳細系統資訊
    this.updateDetailedSystemInfo();
  }

  /**
   * 更新主要系統狀態
   */
  updateSystemStatus() {
    const statusElement = this.elements.get('systemStatus');
    if (!statusElement) return;

    if (!this.game) {
      statusElement.textContent = '🔴 系統未初始化';
      statusElement.className = 'system-status error';
      return;
    }

    const systemStatus = this.evaluateSystemHealth();
    
    statusElement.textContent = systemStatus.displayText;
    statusElement.className = `system-status ${systemStatus.className}`;
  }

  /**
   * 評估系統健康狀態
   */
  evaluateSystemHealth() {
    const game = this.game;
    
    // 檢查核心系統
    const hasDataManager = !!game.dataManager;
    const hasRuleEngine = !!game.ruleEngine;
    const hasGameBridge = !!game.gameBridge;
    
    // 檢查業務系統
    const hasResourceSystem = game.resourceSystem?.getStatus()?.initialized || false;
    const hasTenantSystem = game.tenantSystem?.getStatus()?.initialized || false;
    const hasSkillSystem = game.skillSystem?.getStatus()?.initialized || false;
    
    // 檢查配置狀態
    const configLoaded = game.configLoaded || false;

    // 計算健康分數
    const coreHealth = (hasDataManager + hasRuleEngine + hasGameBridge) / 3;
    const businessHealth = (hasResourceSystem + hasTenantSystem + hasSkillSystem) / 3;
    const configHealth = configLoaded ? 1 : 0;
    
    const overallHealth = (coreHealth * 0.3 + businessHealth * 0.5 + configHealth * 0.2);

    if (overallHealth >= 0.9) {
      return {
        displayText: '🟢 完整模組化系統 v2.0 - 運行中',
        className: 'modular'
      };
    } else if (overallHealth >= 0.6) {
      return {
        displayText: '🟡 部分模組化系統 v2.0 - 降級模式',
        className: 'partial'
      };
    } else {
      return {
        displayText: '🔴 基礎系統 v2.0 - 後備模式',
        className: 'error'
      };
    }
  }

  /**
   * 更新詳細系統資訊
   */
  updateDetailedSystemInfo() {
    // 資料系統狀態
    this.updateElement('dataSystem', 
      this.game?.dataManager ? '✅ 已載入' : '❌ 不可用'
    );

    // 規則引擎狀態
    this.updateElement('ruleEngine', 
      this.game?.ruleEngine ? '✅ 就緒' : '❌ 不可用'
    );

    // 系統橋接狀態
    this.updateElement('gameBridge', 
      this.game?.gameBridge ? '✅ 連接' : '❌ 未連接'
    );
  }

  /**
   * 安全的元素更新方法
   */
  updateElement(id, value) {
    this.stats.elementUpdates++;
    
    let element = this.elements.get(id);
    if (!element) {
      // 嘗試重新獲取元素
      element = document.getElementById(id);
      if (element) {
        this.elements.set(id, element);
      } else {
        console.warn(`⚠️ 元素不存在: ${id}`);
        return false;
      }
    }

    try {
      if (element.textContent !== String(value)) {
        element.textContent = value;
        
        // 可選的更新動畫
        if (this.config.enableAnimations) {
          this.addUpdateAnimation(element);
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ 更新元素失敗 ${id}:`, error);
      this.stats.errorCount++;
      return false;
    }
  }

  /**
   * 添加遊戲記錄
   */
  addLog(message, type = 'event') {
    if (!this.logContainer) {
      console.warn("⚠️ 遊戲記錄容器不可用");
      return false;
    }

    this.stats.logEntries++;

    try {
      const entry = document.createElement('div');
      entry.className = `log-entry ${type}`;
      entry.textContent = `第${this.game?.gameState?.day || '?'}天: ${message}`;
      
      this.logContainer.appendChild(entry);

      // 限制記錄條目數量
      this.limitLogEntries();

      // 自動滾動到底部
      if (this.config.autoScrollLog) {
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
      }

      // 發送記錄添加事件
      this.dispatchEvent(new CustomEvent('logAdded', {
        detail: { message, type, timestamp: Date.now() }
      }));

      return true;
    } catch (error) {
      console.error("❌ 添加遊戲記錄失敗:", error);
      this.stats.errorCount++;
      return false;
    }
  }

  /**
   * 限制記錄條目數量
   */
  limitLogEntries() {
    const entries = this.logContainer.children;
    const maxEntries = this.config.maxLogEntries;
    
    while (entries.length > maxEntries) {
      this.logContainer.removeChild(entries[0]);
    }
  }

  /**
   * 設定元素樣式
   */
  setElementStyle(id, styles) {
    let element = this.elements.get(id);
    if (!element) {
      element = document.getElementById(id);
      if (element) {
        this.elements.set(id, element);
      } else {
        return false;
      }
    }

    try {
      Object.assign(element.style, styles);
      return true;
    } catch (error) {
      console.error(`❌ 設定元素樣式失敗 ${id}:`, error);
      return false;
    }
  }

  /**
   * 切換元素類別
   */
  toggleElementClass(id, className, force = undefined) {
    let element = this.elements.get(id);
    if (!element) {
      element = document.getElementById(id);
      if (element) {
        this.elements.set(id, element);
      } else {
        return false;
      }
    }

    try {
      if (force !== undefined) {
        element.classList.toggle(className, force);
      } else {
        element.classList.toggle(className);
      }
      return true;
    } catch (error) {
      console.error(`❌ 切換元素類別失敗 ${id}:`, error);
      return false;
    }
  }

  /**
   * 添加更新動畫
   */
  addUpdateAnimation(element) {
    if (!this.config.enableAnimations) return;

    element.style.transition = 'color 0.3s ease';
    element.style.color = '#ffff99';
    
    setTimeout(() => {
      element.style.color = '';
    }, 300);
  }

  /**
   * 執行批次更新
   */
  performBatchUpdate() {
    if (this.updateQueue.size === 0) return;

    const updates = Array.from(this.updateQueue);
    this.updateQueue.clear();

    updates.forEach(updateType => {
      switch (updateType) {
        case 'full-update':
          this.updateDisplay();
          break;
        case 'game-state':
          this.updateGameStateDisplay();
          break;
        case 'resources':
          this.updateResourceDisplay();
          break;
        case 'rooms':
          this.updateRoomDisplay();
          break;
        case 'tenants':
          this.updateTenantList();
          break;
        case 'system-status':
          this.updateSystemStatusDisplay();
          break;
      }
    });
  }

  /**
   * 節流函數
   */
  throttle(func, wait) {
    let timeout;
    let previous = 0;
    
    return function (...args) {
      const now = Date.now();
      const remaining = wait - (now - previous);
      
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        func.apply(this, args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          previous = Date.now();
          timeout = null;
          func.apply(this, args);
        }, remaining);
      }
    };
  }

  /**
   * 排程特定更新
   */
  scheduleUpdate(updateType = 'full-update') {
    this.updateQueue.add(updateType);
    this.throttledUpdate();
  }

  /**
   * 清除所有記錄
   */
  clearLog() {
    if (this.logContainer) {
      this.logContainer.innerHTML = '';
    }
  }

  /**
   * 取得統計資訊
   */
  getStats() {
    return {
      ...this.stats,
      cachedElements: this.elements.size,
      lastUpdateTime: this.lastUpdateTime,
      isUpdating: this.isUpdating,
      queueSize: this.updateQueue.size,
    };
  }

  /**
   * 取得狀態資訊
   */
  getStatus() {
    return {
      initialized: !!this.logContainer,
      hasGameHelpers: !!this.gameHelpers,
      cachedElements: this.elements.size,
      config: this.config,
      stats: this.getStats(),
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log("⚙️ DisplayUpdater 配置已更新");
  }

  /**
   * 清理資源
   */
  cleanup() {
    this.elements.clear();
    this.updateQueue.clear();
    this.logContainer = null;
    this.gameHelpers = null;
    
    console.log("🧹 DisplayUpdater 資源已清理");
  }
}

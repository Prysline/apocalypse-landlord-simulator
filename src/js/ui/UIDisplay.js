/**
 * UIDisplay.js - UI顯示控制器
 * 職責：遊戲狀態映射、DOM更新
 */

import systemLogger from '../utils/SystemLogger.js';
export default class UIDisplay {
  constructor(gameApp, uiCore = null) {
    this.gameApp = gameApp;
    this.uiCore = uiCore;
    this.elements = new Map();
  }

  async initialize() {
    this.cacheElements();
    systemLogger.success('✅ UIDisplay 初始化完成');
  }

  cacheElements() {
    const elementIds = [
      'day', 'time', 'cash', 'food', 'materials', 'medical', 'fuel',
      'buildingDefenseText', 'landlordHungerText', 'scavengeCount',
      'tenantList', 'gameLog'
    ];

    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.elements.set(id, element);
      }
    });
  }

  // =================== 核心更新方法 ===================

  updateAll() {
    if (!this.gameApp?.gameState) return;

    const state = this.gameApp.gameState;

    this.updateGameStatus(state);
    this.updateResources(state);
    this.updateStatusInfo(state);
    this.updateRoomDisplays(state);
    this.updateTenantList(state);
  }

  /**
   * 更新遊戲狀態
   */
  updateGameStatus(state) {
    const day = state.getStateValue('day', 1);
    const timeOfDay = state.getStateValue('time', 'day');

    this.updateElement('day', `${day}`);
    this.updateElement('time', timeOfDay === 'day' ? '☀️白天' : '🌙夜晚');
  }

  /**
   * 更新資源顯示
   */
  updateResources(state) {
    const resources = state.getStateValue('resources', {});

    this.updateElement('cash', `${resources.cash || 0}`);
    this.updateElement('food', `${resources.food || 0}`);
    this.updateElement('materials', `${resources.materials || 0}`);
    this.updateElement('medical', `${resources.medical || 0}`);
    this.updateElement('fuel', `${resources.fuel || 0}`);

    this.updateResourceStatus(resources);
  }

  /**
   * 更新資源狀態
   */
  updateResourceStatus(resources) {
    if (!this.uiCore) return;

    const resourceTypes = ['food', 'materials', 'medical', 'fuel', 'cash'];

    resourceTypes.forEach(resourceType => {
      const value = resources[resourceType] || 0;
      const status = this.uiCore.getResourceStatus(resourceType, value);

      const elementId = resourceType === 'cash' ? 'cash' : resourceType;
      const element = this.elements.get(elementId);

      if (element) {
        element.classList.remove('resource-critical', 'resource-warning', 'resource-good');
        element.classList.add(`resource-${status.severity}`);
      }
    });
  }

  /**
   * 更新狀態資訊
   */
  updateStatusInfo(state) {
    if (!this.uiCore) return;

    const buildingDefense = state.getStateValue('buildingDefense', 0);
    const defenseText = this.uiCore.getStatusText(buildingDefense, 'defense');
    this.updateElement('buildingDefenseText', defenseText);

    const landlordHunger = state.getStateValue('landlordHunger', 0);
    const hungerText = this.uiCore.getStatusText(landlordHunger, 'hunger');
    this.updateElement('landlordHungerText', hungerText);

    const scavengeUsed = state.getStateValue('scavengeUsed', 0);
    this.updateElement('scavengeCount', `${scavengeUsed}/2`);
  }

  _getRoomsData(state) {
    const rooms = state.getStateValue('rooms', []);

    return rooms.map(room => {
      // 統一預處理共用邏輯
      const tenant = state.getRoomTenant(room.id);
      if (tenant) {
        room.tenantSatisfaction = state.getStateValue(`tenantSatisfaction.${tenant.name}`, 50);
        room.satisfactionEmoji = this.uiCore.getSatisfactionEmoji(room.tenantSatisfaction);
      }
      return room;
    });
  }

  /**
   * 更新房間顯示
   * @returns {void}
   */
  updateRoomDisplays(state) {
    const rooms = this._getRoomsData(state);

    rooms.forEach((room) => {
      const roomElement = document.getElementById(`room${room.id}`);
      const infoElement = document.getElementById(`room${room.id}-info`);

      if (!roomElement || !infoElement) return;

      // 重設CSS類
      roomElement.className = "room";

      const tenant = state.getRoomTenant(room.id);
      if (tenant) {
        roomElement.classList.add("occupied");

        if (tenant.infected) {
          roomElement.classList.add("infected");
        }

        if (room.reinforced) {
          roomElement.classList.add("reinforced");
        }

        // 顯示租客資訊
        const satisfaction = room.tenantSatisfaction || 50;
        // 表情符號表示滿意度等級
        const satisfactionEmoji = room.satisfactionEmoji || '😐';

        infoElement.innerHTML = `
                  ${tenant.name}<br>
                  <small>${tenant.skill}</small><br>
                  <small>滿意度: ${satisfaction} ${satisfactionEmoji}</small>
              `;
      } else {
        infoElement.textContent = "空房";
      }

      if (room.needsRepair) {
        roomElement.classList.add("needs-repair");
        infoElement.innerHTML +=
          '<br><small style="color:#ff6666">需要維修</small>';
      }

      if (room.reinforced) {
        infoElement.innerHTML +=
          '<br><small style="color:#66ccff">已加固</small>';
      }
    });
  }

  /**
   * 更新租客列表
   */
  updateTenantList(state) {
    const tenantListElement = this.elements.get('tenantList');
    if (!tenantListElement) return;

    const occupiedRooms = this.gameApp.gameState.getOccupiedRooms();
    const tenants = occupiedRooms.map(room => {
      const tenant = this.gameApp.gameState.getRoomTenant(room.id);
      if (tenant) {
        return {
          ...tenant,
          roomId: room.id,
          roomReinforced: room.reinforced,
          satisfaction: room.tenantSatisfaction,
          satisfactionEmoji: room.satisfactionEmoji
        };
      }
      return null;
    }).filter(tenant => tenant !== null);

    if (tenants.length === 0) {
      tenantListElement.innerHTML = '<div class="tenant-item">暫無租客</div>';
      return;
    }

    const tenantHTML = tenants.map(tenant => {
      // 顯示租客資訊
      const satisfaction = tenant.tenantSatisfaction || 50;
      // 表情符號表示滿意度等級
      const satisfactionEmoji = tenant.satisfactionEmoji || '😐';

      let statusIndicators = [];
      if (tenant.infected) statusIndicators.push('🦠已感染！');
      if (tenant.onMission) statusIndicators.push('🚶執行任務中');
      if (tenant.roomReinforced) statusIndicators.push('🛡️已加固');

      // === 個人資源概況 ===
      const personalResources = this.uiCore.safeGetPersonalResources(tenant);
      const totalValue = this.uiCore.getPersonalResourcesValue(personalResources);
      const statusInfo = this.uiCore.getStatusText(totalValue, 'personalWealth', true);

      // 生成資源圖示字串
      const resourceIcons = Object.entries(personalResources)
        .filter(([type, amount]) => amount > 0)
        .map(([type, amount]) => `${this.uiCore.getIcon(type, 'resource')}${amount}`)
        .join(' ');

      if (resourceIcons) {
        statusIndicators.push(`${resourceIcons} (${statusInfo.text})`);
      }

      return `
    <div class="tenant-item ${tenant.infected ? 'infected' : ''} ${tenant.type}" data-tenant-id="${tenant.id}">
      <strong>${tenant.name}</strong> (${tenant.typeName})<br>
      <small>房間 ${tenant.roomId} | 房租 ${tenant.rent}/天</small><br>
      <small>${satisfactionEmoji} 滿意度 ${satisfaction}%</small>
      ${statusIndicators.length > 0 ? `<br><small>${statusIndicators.join(' ')}</small>` : ''}
    </div>
  `;
    }).join('');

    tenantListElement.innerHTML = tenantHTML;
  }

















  // =================== 基本DOM操作 ===================

  updateElement(id, content) {
    const element = this.elements.get(id);
    if (element && element.textContent !== content) {
      element.textContent = content;
    }
  }

  /**
   * 更新遊戲日誌
   */
  updateGameLog(logData) {
    const gameLogEl = document.getElementById('gameLog');
    if (!gameLogEl || !logData) return;

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${logData.type || 'info'}`;

    const typeIcon = this.uiCore ? this.uiCore.getIcon(logData.type, 'log') : '';

    logEntry.innerHTML = `
      <span class="log-time">第${logData.day}天:</span>
      <span class="log-icon">${typeIcon}</span>
      <span class="log-message">${logData.message}</span>
    `;

    gameLogEl.appendChild(logEntry);
    gameLogEl.scrollTop = gameLogEl.scrollHeight;

    const maxLogs = 50;
    while (gameLogEl.children.length > maxLogs) {
      gameLogEl.removeChild(gameLogEl.firstChild);
    }
  }

  // =================== 除錯支援 ===================

  debug() {
    systemLogger.debug('🖥️ UIDisplay 狀態:', {
      elements: this.elements.size,
      gameState: !!this.gameApp?.gameState
    });
  }

  getDisplayStatus() {
    return {
      initialized: this.elements.size > 0,
      cachedElements: Array.from(this.elements.keys())
    };
  }
}
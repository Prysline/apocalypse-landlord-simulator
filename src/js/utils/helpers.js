/**
 * Game Utilities - 遊戲輔助函數模組
 *
 * 設計原則：
 * 1. 純函數優先：無副作用，便於測試
 * 2. 單一職責：每個函數只處理一項具體任務
 * 3. 參數驗證：確保輸入資料的有效性
 * 4. 錯誤處理：優雅地處理異常情況
 */

// ==================== 名稱生成系統 ====================

/**
 * 名稱資料庫
 * 基於中文常見姓名，分類管理確保多樣性
 */
const NAME_DATABASE = {
  surnames: ["陳", "林", "黃", "張", "李", "王", "吳", "劉", "蔡", "楊"],
  givenNames: [
    "志明",
    "小華",
    "小美",
    "阿珍",
    "大雄",
    "靜香",
    "胖虎",
    "小夫",
    "阿強",
    "小玉",
    "建國",
    "淑芬",
    "家豪",
    "怡君",
    "俊傑",
    "雅婷",
    "明哲",
    "佳蓉",
    "宗翰",
    "麗娟",
  ],
  nicknames: [
    "小明",
    "小華",
    "小李",
    "老王",
    "阿強",
    "小美",
    "阿珍",
    "大雄",
    "靜香",
    "胖虎",
    "小張",
    "阿陳",
    "小林",
    "老劉",
    "阿花",
    "小玉",
    "阿寶",
    "小鳳",
    "阿義",
    "小雲",
  ],
};

/**
 * 生成隨機姓名
 * @param {string} type - 姓名類型 ('full', 'nickname', 'formal')
 * @returns {string} 生成的姓名
 */
function generateName(type = "nickname") {
  const { surnames, givenNames, nicknames } = NAME_DATABASE;

  switch (type) {
    case "full":
      const surname = surnames[Math.floor(Math.random() * surnames.length)];
      const givenName =
        givenNames[Math.floor(Math.random() * givenNames.length)];
      return surname + givenName;

    case "formal":
      const formalSurname =
        surnames[Math.floor(Math.random() * surnames.length)];
      const formalGiven =
        givenNames[Math.floor(Math.random() * givenNames.length)];
      return `${formalSurname}${formalGiven}先生/女士`;

    case "nickname":
    default:
      return nicknames[Math.floor(Math.random() * nicknames.length)];
  }
}

/**
 * 檢查姓名是否重複
 * @param {string} name - 待檢查的姓名
 * @param {Array} existingNames - 已存在的姓名列表
 * @returns {boolean} 是否重複
 */
function isNameDuplicated(name, existingNames) {
  return existingNames.includes(name);
}

/**
 * 生成唯一姓名
 * @param {Array} existingNames - 已存在的姓名列表
 * @param {string} type - 姓名類型
 * @param {number} maxAttempts - 最大嘗試次數
 * @returns {string} 唯一姓名
 */
function generateUniqueName(
  existingNames = [],
  type = "nickname",
  maxAttempts = 50
) {
  let attempts = 0;
  let name;

  do {
    name = generateName(type);
    attempts++;

    if (attempts >= maxAttempts) {
      // 後備方案：添加數字後綴
      name = `${generateName(type)}${Math.floor(Math.random() * 1000)}`;
      break;
    }
  } while (isNameDuplicated(name, existingNames));

  return name;
}

// ==================== 外觀描述系統 ====================

/**
 * 外觀描述資料庫
 * 分為正常和感染狀態，提供豐富的描述變化
 */
const APPEARANCE_DATABASE = {
  normal: [
    "看起來精神狀態不錯",
    "衣著整潔，談吐得體",
    "眼神清澈，反應靈敏",
    "握手時手掌溫暖有力",
    "說話條理清晰，很有條理",
    "看起來很健康，氣色不錯",
    "動作自然流暢",
    "笑容真誠，讓人感到舒適",
    "舉止得宜，顯得有教養",
    "聲音宏亮，中氣十足",
  ],
  infected: [
    "眼神有點呆滯，反應遲鈍",
    "皮膚蒼白，手有輕微顫抖",
    "說話時偶爾停頓，像在想什麼",
    "衣服有些血跡，說是意外受傷",
    "體溫似乎偏低，一直在發抖",
    "有股奇怪的味道，像是腐肉",
    "走路姿勢略顯僵硬",
    "避免眼神接觸，顯得很緊張",
    "臉色灰敗，沒有血色",
    "呼吸聲有些異常，帶著喘息",
  ],
};

/**
 * 獲取正常外觀描述
 * @returns {string} 隨機的正常外觀描述
 */
function getNormalAppearance() {
  const descriptions = APPEARANCE_DATABASE.normal;
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

/**
 * 獲取感染外觀描述
 * @returns {string} 隨機的感染外觀描述
 */
function getInfectedAppearance() {
  const descriptions = APPEARANCE_DATABASE.infected;
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

/**
 * 基於健康狀態獲取外觀描述
 * @param {boolean} isInfected - 是否感染
 * @param {number} healthLevel - 健康等級 (0-100)
 * @returns {string} 對應的外觀描述
 */
function getAppearanceByHealth(isInfected, healthLevel = 100) {
  if (isInfected) {
    return getInfectedAppearance();
  }

  if (healthLevel < 30) {
    return "看起來身體虛弱，需要休息";
  } else if (healthLevel < 60) {
    return "精神略顯疲憊，但還算健康";
  } else {
    return getNormalAppearance();
  }
}

// ==================== 狀態文字轉換系統 ====================

/**
 * 防禦狀態等級定義
 * 基於數值範圍映射到描述性文字
 */
const DEFENSE_LEVELS = [
  { min: 0, max: 0, text: "脆弱", color: "#ff6666" },
  { min: 1, max: 2, text: "基本", color: "#ffaa66" },
  { min: 3, max: 5, text: "穩固", color: "#ffcc66" },
  { min: 6, max: 8, text: "堅固", color: "#66ccff" },
  { min: 9, max: 12, text: "要塞", color: "#66ff66" },
  { min: 13, max: Infinity, text: "銅牆鐵壁", color: "#66ff66" },
];

/**
 * 獲取防禦狀態文字
 * @param {number} defense - 防禦數值
 * @returns {Object} 包含文字和顏色的物件
 */
function getDefenseStatus(defense) {
  const level = DEFENSE_LEVELS.find(
    (level) => defense >= level.min && defense <= level.max
  );

  return {
    text: `${level.text}(${defense})`,
    color: level.color,
    level: level.text,
  };
}

/**
 * 飢餓狀態等級定義
 */
const HUNGER_LEVELS = [
  { min: 0, max: 0, text: "飽足", color: "#66ff66" },
  { min: 1, max: 1, text: "微餓", color: "#ffcc66" },
  { min: 2, max: 2, text: "有點餓", color: "#ffaa66" },
  { min: 3, max: 3, text: "飢餓", color: "#ff9966" },
  { min: 4, max: 4, text: "很餓", color: "#ff6666" },
  { min: 5, max: 6, text: "極度飢餓", color: "#ff3333" },
  { min: 7, max: Infinity, text: "瀕臨餓死", color: "#cc0000" },
];

/**
 * 獲取飢餓狀態文字
 * @param {number} hunger - 飢餓數值
 * @returns {Object} 包含文字和顏色的物件
 */
function getHungerStatus(hunger) {
  const level = HUNGER_LEVELS.find(
    (level) => hunger >= level.min && hunger <= level.max
  );

  return {
    text: `${level.text}(${hunger})`,
    color: level.color,
    level: level.text,
    critical: hunger >= 5,
  };
}

/**
 * 滿意度狀態轉換
 * @param {number} satisfaction - 滿意度數值 (0-100)
 * @returns {Object} 滿意度狀態資訊
 */
function getSatisfactionStatus(satisfaction) {
  let level, emoji, color;

  if (satisfaction >= 80) {
    level = "非常滿意";
    emoji = "😁";
    color = "#66ff66";
  } else if (satisfaction >= 60) {
    level = "滿意";
    emoji = "😊";
    color = "#66ccff";
  } else if (satisfaction >= 40) {
    level = "普通";
    emoji = "😐";
    color = "#ffcc66";
  } else if (satisfaction >= 20) {
    level = "不滿";
    emoji = "😞";
    color = "#ff9966";
  } else {
    level = "極度不滿";
    emoji = "😡";
    color = "#ff6666";
  }

  return { level, emoji, color, value: satisfaction };
}

// ==================== 數值計算與驗證 ====================

/**
 * 安全的數值範圍限定
 * @param {number} value - 輸入數值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限定後的數值
 */
function clamp(value, min, max) {
  if (typeof value !== "number" || isNaN(value)) {
    console.warn(`clamp: 無效的數值 ${value}，使用最小值 ${min}`);
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * 百分比計算
 * @param {number} current - 當前值
 * @param {number} total - 總值
 * @param {number} precision - 小數位精度
 * @returns {number} 百分比值
 */
function calculatePercentage(current, total, precision = 1) {
  if (total === 0) return 0;
  const percentage = (current / total) * 100;
  return (
    Math.round(percentage * Math.pow(10, precision)) / Math.pow(10, precision)
  );
}

/**
 * 加權隨機選擇
 * @param {Array} items - 選項陣列，每項包含 value 和 weight 屬性
 * @returns {*} 被選中的項目
 */
function weightedRandomChoice(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("weightedRandomChoice: 需要非空陣列");
  }

  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight || 1;
    if (random <= 0) {
      return item.value;
    }
  }

  return items[items.length - 1].value;
}

/**
 * 範圍內隨機整數
 * @param {number} min - 最小值（包含）
 * @param {number} max - 最大值（包含）
 * @returns {number} 隨機整數
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 範圍內隨機浮點數
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @param {number} precision - 小數位數
 * @returns {number} 隨機浮點數
 */
function randomFloat(min, max, precision = 2) {
  const random = Math.random() * (max - min) + min;
  return Math.round(random * Math.pow(10, precision)) / Math.pow(10, precision);
}

// ==================== 陣列與物件操作 ====================

/**
 * 安全的陣列隨機選擇
 * @param {Array} array - 目標陣列
 * @param {number} count - 選擇數量
 * @returns {Array} 選中的元素陣列
 */
function randomSelect(array, count = 1) {
  if (!Array.isArray(array) || array.length === 0) {
    return [];
  }

  if (count >= array.length) {
    return [...array];
  }

  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * 陣列打亂
 * Fisher-Yates 演算法實現
 * @param {Array} array - 目標陣列
 * @returns {Array} 打亂後的新陣列
 */
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 深度複製物件
 * @param {*} obj - 要複製的物件
 * @returns {*} 複製的物件
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item));
  }

  if (typeof obj === "object") {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * 獲取嵌套物件屬性
 * @param {Object} obj - 目標物件
 * @param {string} path - 屬性路徑，如 'a.b.c'
 * @param {*} defaultValue - 預設值
 * @returns {*} 屬性值或預設值
 */
function getNestedProperty(obj, path, defaultValue = undefined) {
  if (!obj || typeof path !== "string") {
    return defaultValue;
  }

  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }

  return current;
}

/**
 * 設定嵌套物件屬性
 * @param {Object} obj - 目標物件
 * @param {string} path - 屬性路徑
 * @param {*} value - 要設定的值
 * @returns {boolean} 是否設定成功
 */
function setNestedProperty(obj, path, value) {
  if (!obj || typeof path !== "string") {
    return false;
  }

  const keys = path.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return true;
}

// ==================== 時間與日期處理 ====================

/**
 * 格式化遊戲時間
 * @param {number} day - 天數
 * @param {string} timeOfDay - 時段 ('day', 'night')
 * @returns {string} 格式化的時間字串
 */
function formatGameTime(day, timeOfDay = "day") {
  const timeText = timeOfDay === "day" ? "白天" : "夜晚";
  return `第 ${day} 天 ${timeText}`;
}

/**
 * 計算遊戲週數
 * @param {number} day - 天數
 * @returns {number} 週數
 */
function getGameWeek(day) {
  return Math.ceil(day / 7);
}

/**
 * 檢查是否為週末（遊戲中的第7天和第14天等）
 * @param {number} day - 天數
 * @returns {boolean} 是否為週末
 */
function isWeekend(day) {
  return day % 7 === 0;
}

// ==================== 模組匯出 ====================

// 如果在模組環境中，使用 export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateName,
    generateUniqueName,
    getNormalAppearance,
    getInfectedAppearance,
    getAppearanceByHealth,
    getDefenseStatus,
    getHungerStatus,
    getSatisfactionStatus,
    clamp,
    calculatePercentage,
    weightedRandomChoice,
    randomInt,
    randomFloat,
    randomSelect,
    shuffleArray,
    deepClone,
    getNestedProperty,
    setNestedProperty,
    formatGameTime,
    getGameWeek,
    isWeekend,
  };
}

// 瀏覽器環境中，附加到全域物件
if (typeof window !== "undefined") {
  window.GameUtils = {
    generateName,
    generateUniqueName,
    getNormalAppearance,
    getInfectedAppearance,
    getAppearanceByHealth,
    getDefenseStatus,
    getHungerStatus,
    getSatisfactionStatus,
    clamp,
    calculatePercentage,
    weightedRandomChoice,
    randomInt,
    randomFloat,
    randomSelect,
    shuffleArray,
    deepClone,
    getNestedProperty,
    setNestedProperty,
    formatGameTime,
    getGameWeek,
    isWeekend,
  };
}

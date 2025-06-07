// @ts-check

/**
 * @fileoverview helpers.js - 極簡物件操作工具集 v2.0
 * 職責：提供系統所需的基礎物件操作功能
 * 設計原則：最小化、高效能、零依賴
 */

/**
 * 嵌套路徑類型定義
 * @typedef {string} NestedPath
 */

/**
 * 嵌套更新物件類型
 * @typedef {Object.<string, any>} NestedUpdateObject
 */

// ==================== 核心物件操作工具 ====================

/**
 * 安全取得嵌套物件值
 * @param {Object|null|undefined} obj - 來源物件
 * @param {NestedPath} path - 屬性路徑（點號分隔）
 * @param {any} [defaultValue=undefined] - 預設值
 * @returns {any} 屬性值或預設值
 *
 * @example
 * getNestedValue({a: {b: {c: 42}}}, 'a.b.c') // 42
 * getNestedValue({a: {b: null}}, 'a.b.c', 'default') // 'default'
 */
export function getNestedValue(obj, path, defaultValue = undefined) {
  if (!obj || typeof obj !== "object" || !path) {
    return defaultValue;
  }

  return path.split(".").reduce((current, key) => {
    return current && typeof current === "object" && key in current
      ? current[key]
      : defaultValue;
  }, obj);
}

/**
 * 設置嵌套物件值
 * @param {Object} obj - 目標物件
 * @param {NestedPath} path - 屬性路徑
 * @param {any} value - 要設置的值
 * @returns {boolean} 是否設置成功
 *
 * @example
 * const obj = {};
 * setNestedValue(obj, 'a.b.c', 42); // obj = {a: {b: {c: 42}}}
 */
export function setNestedValue(obj, path, value) {
  if (!obj || typeof obj !== "object" || !path) {
    return false;
  }

  const keys = path.split(".");
  let current = obj;

  // 建立路徑上的物件
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }

  // 設置最終值
  current[keys[keys.length - 1]] = value;
  return true;
}

/**
 * 建立嵌套更新物件（用於狀態更新）
 * @param {string} path - 路徑字串
 * @param {any} value - 要設定的值
 * @returns {Object} 嵌套更新物件
 *
 * @example
 * createNestedUpdate('resources.food', 25)
 * // 返回: {resources: {food: 25}}
 */
export function createNestedUpdate(path, value) {
  const keys = path.split(".");
  const result = {};
  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = {};
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
  return result;
}

/**
 * 深度複製物件
 * @param {any} obj - 要複製的物件
 * @returns {any} 深度複製的物件
 *
 * @example
 * const original = {a: {b: [1, 2, 3]}};
 * const copy = deepClone(original);
 * copy.a.b.push(4); // 不影響 original
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item));
  }

  const cloned = {};
  Object.keys(obj).forEach((key) => {
    cloned[key] = deepClone(obj[key]);
  });

  return cloned;
}

/**
 * 檢查嵌套路徑是否存在
 * @param {Object} obj - 來源物件
 * @param {string} path - 屬性路徑
 * @returns {boolean} 路徑是否存在
 *
 * @example
 * hasNestedPath({a: {b: {c: null}}}, 'a.b.c') // true
 * hasNestedPath({a: {b: {}}}, 'a.b.c') // false
 */
export function hasNestedPath(obj, path) {
  if (!obj || typeof obj !== "object" || !path) {
    return false;
  }

  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return false;
    }
    current = current[key];
  }

  return true;
}

// ==================== 類別封裝（可選使用）====================

/**
 * 物件工具類別 - 提供靜態方法版本
 */
export class ObjectUtils {
  static getNestedValue = getNestedValue;
  static setNestedValue = setNestedValue;
  static createNestedUpdate = createNestedUpdate;
  static deepClone = deepClone;
  static hasNestedPath = hasNestedPath;
}

// ==================== 預設匯出 ====================

export default {
  getNestedValue,
  setNestedValue,
  createNestedUpdate,
  deepClone,
  hasNestedPath,
  ObjectUtils,
};

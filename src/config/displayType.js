/**
 * 展示类型配置
 * 与前端 config/displayType.js 保持一致
 * 与模型 pageComponentModel.js 中的 displayType 枚举保持一致
 */

// 展示类型枚举
const DISPLAY_TYPES = {
  CAROUSEL: 'carousel',
  GRID: 'grid',
  LIST: 'list',
  SCROLL_SNAP: 'scroll-snap',
  SEAMLESS: 'seamless',
  VIDEO: 'video'
}

// 展示类型值数组（用于验证）
const DISPLAY_TYPE_VALUES = Object.values(DISPLAY_TYPES)

// 默认展示类型
const DEFAULT_DISPLAY_TYPE = DISPLAY_TYPES.CAROUSEL

/**
 * 验证展示类型是否有效
 * @param {string} type - 展示类型
 * @returns {boolean} 是否有效
 */
function isValidDisplayType(type) {
  return DISPLAY_TYPE_VALUES.includes(type)
}

module.exports = {
  DISPLAY_TYPES,
  DISPLAY_TYPE_VALUES,
  DEFAULT_DISPLAY_TYPE,
  isValidDisplayType
}

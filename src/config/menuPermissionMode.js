/**
 * 菜单权限模式配置
 * 与 userModel.js 中的 menuPermissionMode 枚举保持一致
 */

// 菜单权限模式枚举
const MENU_PERMISSION_MODES = {
  DEFAULT: 'default',
  CUSTOM: 'custom',
  TEMPLATE: 'template'
}

// 权限模式值数组（用于验证）
const MENU_PERMISSION_MODE_VALUES = Object.values(MENU_PERMISSION_MODES)

// 默认权限模式
const DEFAULT_MENU_PERMISSION_MODE = MENU_PERMISSION_MODES.DEFAULT

/**
 * 验证权限模式是否有效
 * @param {string} mode - 权限模式
 * @returns {boolean} 是否有效
 */
function isValidMenuPermissionMode(mode) {
  return MENU_PERMISSION_MODE_VALUES.includes(mode)
}

module.exports = {
  MENU_PERMISSION_MODES,
  MENU_PERMISSION_MODE_VALUES,
  DEFAULT_MENU_PERMISSION_MODE,
  isValidMenuPermissionMode
}

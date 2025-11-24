/**
 * 用户角色配置
 * 与前端保持一致的角色定义
 * 与 userModel.js 中的角色枚举保持一致
 */

// 角色枚举（与前端完全一致）
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  VIP: 'vip',
  USER: 'user'
}

// 角色值数组（用于验证）
const ROLE_VALUES = Object.values(ROLES)

// 默认角色
const DEFAULT_ROLE = ROLES.USER

/**
 * 验证角色是否有效
 * @param {string} role - 角色
 * @returns {boolean} 是否有效
 */
function isValidRole(role) {
  return ROLE_VALUES.includes(role)
}

/**
 * 检查是否为超级管理员
 * @param {string} role - 角色
 * @returns {boolean} 是否为超级管理员
 */
function isSuperAdmin(role) {
  return role === ROLES.SUPER_ADMIN
}

/**
 * 检查是否为管理员（包括超级管理员）
 * @param {string} role - 角色
 * @returns {boolean} 是否为管理员
 */
function isAdmin(role) {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN
}

module.exports = {
  ROLES,
  ROLE_VALUES,
  DEFAULT_ROLE,
  isValidRole,
  isSuperAdmin,
  isAdmin
}

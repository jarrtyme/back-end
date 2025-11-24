/**
 * VIP等级配置
 * 与 userModel.js 中的 vipLevel 范围保持一致
 */

// VIP等级范围
const VIP_LEVEL = {
  MIN: 0,
  MAX: 10
}

// 默认VIP等级
const DEFAULT_VIP_LEVEL = 0

/**
 * 验证VIP等级是否有效
 * @param {number} level - VIP等级
 * @returns {boolean} 是否有效
 */
function isValidVipLevel(level) {
  return (
    typeof level === 'number' && !isNaN(level) && level >= VIP_LEVEL.MIN && level <= VIP_LEVEL.MAX
  )
}

module.exports = {
  VIP_LEVEL,
  DEFAULT_VIP_LEVEL,
  isValidVipLevel
}

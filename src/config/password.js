/**
 * 密码验证规则配置
 * 与 userModel.js 中的密码验证规则保持一致
 */

// 密码长度限制
const PASSWORD_LENGTH = {
  MIN: 6,
  MAX: 20
}

/**
 * 验证密码是否符合规则
 * @param {string} password - 密码
 * @returns {Object} { valid: boolean, message?: string }
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: '密码不能为空' }
  }

  if (password.length < PASSWORD_LENGTH.MIN) {
    return {
      valid: false,
      message: `密码至少需要 ${PASSWORD_LENGTH.MIN} 个字符`
    }
  }

  if (password.length > PASSWORD_LENGTH.MAX) {
    return {
      valid: false,
      message: `密码最多 ${PASSWORD_LENGTH.MAX} 个字符`
    }
  }

  return { valid: true }
}

module.exports = {
  PASSWORD_LENGTH,
  validatePassword
}

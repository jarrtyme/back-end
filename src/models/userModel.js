const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const { ROLE_VALUES, DEFAULT_ROLE } = require('../config/role')
const {
  MENU_PERMISSION_MODE_VALUES,
  DEFAULT_MENU_PERMISSION_MODE
} = require('../config/menuPermissionMode')
const { VIP_LEVEL } = require('../config/vipLevel')
const { PASSWORD_LENGTH } = require('../config/password')

/**
 * 用户数据模型
 *
 * 该模型用于管理用户账户信息，包括：
 * - 用户基本信息（用户名、邮箱等）
 * - 密码加密存储
 * - 用户角色和权限
 * - 账户状态管理
 *
 * 安全特性：
 * - 密码自动加密
 * - 密码验证方法
 * - 用户状态验证
 */
const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: [3, '用户名至少3个字符'],
      maxlength: [20, '用户名最多20个字符']
    }, // 用户名 - 唯一标识符

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '请输入有效的邮箱地址']
    }, // 邮箱 - 用于登录和通知

    avatar: {
      type: String,
      default: '',
      trim: true
    }, // 头像 - 用户头像URL

    password: {
      type: String,
      required: true,
      minlength: [PASSWORD_LENGTH.MIN, `密码至少${PASSWORD_LENGTH.MIN}个字符`]
    }, // 密码 - 加密存储

    role: {
      type: String,
      enum: ROLE_VALUES,
      default: DEFAULT_ROLE
    }, // 角色 - 超级管理员、管理员、VIP用户、普通用户

    vipLevel: {
      type: Number,
      default: VIP_LEVEL.MIN,
      min: VIP_LEVEL.MIN,
      max: VIP_LEVEL.MAX
    }, // VIP等级 - 仅VIP用户使用，0表示非VIP用户

    menuPermissions: {
      type: [String],
      default: []
    }, // 菜单权限 - 存储允许访问的菜单key列表

    menuPermissionMode: {
      type: String,
      enum: MENU_PERMISSION_MODE_VALUES,
      default: DEFAULT_MENU_PERMISSION_MODE
    }, // 菜单权限模式 - default 使用角色默认, custom 使用自定义数组, template 来源于模板

    isActive: {
      type: Boolean,
      default: true
    }, // 账户状态 - 是否激活

    lastLogin: {
      type: Date,
      default: null
    }, // 最后登录时间

    createdAt: {
      type: Date,
      default: Date.now
    }, // 创建时间

    updatedAt: {
      type: Date,
      default: Date.now
    } // 更新时间
  },
  {
    timestamps: true, // 自动管理 createdAt 和 updatedAt
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password // 返回时排除密码字段
        delete ret.__v
        return ret
      }
    }
  }
)

/**
 * 密码加密中间件
 * 在保存用户之前自动加密密码
 */
UserSchema.pre('save', async function (next) {
  // 只有密码被修改时才重新加密
  if (!this.isModified('password')) {
    return next()
  }

  try {
    // 生成盐值并加密密码
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

/**
 * 密码验证方法
 * @param {string} candidatePassword - 待验证的密码
 * @returns {Promise<boolean>} - 验证结果
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

/**
 * 检查用户是否激活
 * @returns {boolean} - 用户是否激活
 */
UserSchema.methods.isAccountActive = function () {
  return this.isActive
}

/**
 * 更新最后登录时间
 */
UserSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date()
  return this.save()
}

/**
 * 获取用户公开信息（不包含敏感数据）
 * @returns {Object} - 用户公开信息
 */
UserSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    role: this.role,
    vipLevel: this.vipLevel,
    menuPermissions: this.menuPermissions,
    menuPermissionMode: this.menuPermissionMode,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt
  }
}

module.exports = mongoose.model('User', UserSchema)

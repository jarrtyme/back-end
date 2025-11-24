const UserModel = require('../models/userModel')
const MenuPermissionTemplateModel = require('../models/menuPermissionTemplateModel')
const { ROLES } = require('../config/role')

/**
 * 菜单权限服务
 * 处理菜单权限的获取和分配逻辑
 */
class MenuPermissionService {
  // 定义所有菜单项及其key
  static MENU_KEYS = {
    DASHBOARD: 'dashboard',
    MANAGEMENT: 'management',
    USERS: 'users',
    CLOTHING: 'clothing',
    PAGE_COMPONENTS: 'page-components',
    PAGES: 'pages',
    TOOLS: 'tools',
    UPLOAD: 'upload',
    SETTINGS: 'settings',
    MENU_PERMISSION: 'menu-permission'
  }

  // 定义默认菜单权限配置（根据角色）
  static DEFAULT_PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: [
      'dashboard',
      'management',
      'users',
      'clothing',
      'page-components',
      'pages',
      'tools',
      'upload',
      'settings',
      'menu-permission'
    ],
    [ROLES.ADMIN]: [
      'dashboard',
      'management',
      'users',
      'clothing',
      'page-components',
      'pages',
      'tools',
      'upload',
      'menu-permission'
      // 注意：admin 默认不包含 settings
    ],
    [ROLES.VIP]: [], // VIP用户权限根据VIP等级和menuPermissions字段动态分配
    [ROLES.USER]: ['dashboard'] // 普通用户只有仪表盘
  }

  // VIP等级对应的菜单权限配置
  static VIP_LEVEL_PERMISSIONS = {
    1: ['dashboard', 'clothing', 'upload'], // VIP1: 基础功能
    2: ['dashboard', 'clothing', 'page-components', 'upload'], // VIP2: 增加组件管理
    3: ['dashboard', 'management', 'clothing', 'page-components', 'pages', 'upload'], // VIP3: 增加页面管理
    4: ['dashboard', 'management', 'clothing', 'page-components', 'pages', 'tools', 'upload'], // VIP4: 增加工具菜单
    5: [
      'dashboard',
      'management',
      'clothing',
      'page-components',
      'pages',
      'tools',
      'upload',
      'settings'
    ] // VIP5及以上: 包含所有菜单（除用户管理）
  }

  /**
   * 获取默认菜单权限（不考虑自定义）
   * @param {Object} user
   * @returns {Array<string>}
   */
  static getDefaultMenuPermissions(user) {
    const role = user.role || ROLES.USER
    const vipLevel = user.vipLevel || 0

    if (role === ROLES.SUPER_ADMIN) {
      return this.DEFAULT_PERMISSIONS[ROLES.SUPER_ADMIN]
    }

    if (role === ROLES.ADMIN) {
      return this.DEFAULT_PERMISSIONS[ROLES.ADMIN]
    }

    if (role === ROLES.VIP) {
      if (vipLevel >= 5) {
        return this.VIP_LEVEL_PERMISSIONS[5]
      }
      if (vipLevel >= 4) {
        return this.VIP_LEVEL_PERMISSIONS[4]
      }
      if (vipLevel >= 3) {
        return this.VIP_LEVEL_PERMISSIONS[3]
      }
      if (vipLevel >= 2) {
        return this.VIP_LEVEL_PERMISSIONS[2]
      }
      if (vipLevel >= 1) {
        return this.VIP_LEVEL_PERMISSIONS[1]
      }
      return ['dashboard']
    }

    return this.DEFAULT_PERMISSIONS[ROLES.USER]
  }

  /**
   * 获取用户的菜单权限（考虑自定义）
   * @param {Object} user - 用户对象
   * @returns {Array<string>} - 菜单权限列表
   */
  static getUserMenuPermissions(user) {
    const defaultPermissions = this.getDefaultMenuPermissions(user)
    const customPermissions = Array.isArray(user.menuPermissions) ? user.menuPermissions : []
    const mode = user.menuPermissionMode || 'default'

    if (user.role === ROLES.SUPER_ADMIN) {
      return defaultPermissions
    }

    if (mode === 'custom') {
      return this.normalizeMenuPermissions(customPermissions)
    }

    if (mode === 'template') {
      return this.normalizeMenuPermissions(customPermissions)
    }

    return defaultPermissions
  }

  /**
   * 获取指定用户的菜单配置
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  static async getUserMenuConfig(userId) {
    const user = await UserModel.findById(userId)
    if (!user) {
      throw new Error('用户不存在')
    }

    const defaultPermissions = this.getDefaultMenuPermissions(user)
    const customPermissions = Array.isArray(user.menuPermissions) ? user.menuPermissions : []
    const effectivePermissions = this.getUserMenuPermissions(user)

    return {
      user: user.getPublicProfile(),
      defaultPermissions,
      customPermissions,
      menuPermissions: effectivePermissions,
      menuPermissionMode: user.menuPermissionMode || 'default'
    }
  }

  static getAllowedMenuKeys() {
    if (!this.ALLOWED_MENU_KEYS) {
      const keys = new Set()
      const collect = (items) => {
        items.forEach((item) => {
          keys.add(item.key)
          if (item.children && item.children.length > 0) {
            collect(item.children)
          }
        })
      }
      collect(this.getAllMenuItems())
      this.ALLOWED_MENU_KEYS = Array.from(keys)
    }
    return this.ALLOWED_MENU_KEYS
  }

  static normalizeMenuPermissions(menuPermissions = []) {
    const allowedSet = new Set(this.getAllowedMenuKeys())
    const normalized = []
    for (const key of menuPermissions) {
      if (allowedSet.has(key) && !normalized.includes(key)) {
        normalized.push(key)
      }
    }
    return normalized
  }

  /**
   * 更新用户的菜单权限
   * @param {string} userId - 用户ID
   * @param {Array<string>} menuPermissions - 菜单权限列表
   * @returns {Promise<Object>} - 更新后的用户信息
   */
  static async updateUserMenuPermissions(userId, menuPermissions, menuPermissionMode) {
    try {
      const normalizedPermissions = this.normalizeMenuPermissions(menuPermissions || [])
      const normalizedModeInput = ['default', 'custom', 'template'].includes(menuPermissionMode)
        ? menuPermissionMode
        : undefined
      const mode =
        normalizedModeInput ||
        (Array.isArray(menuPermissions) && menuPermissions.length > 0 ? 'custom' : 'default')

      const updatePayload =
        mode === 'default'
          ? { menuPermissions: [], menuPermissionMode: 'default' }
          : { menuPermissions: normalizedPermissions, menuPermissionMode: mode }
      const user = await UserModel.findByIdAndUpdate(userId, updatePayload, {
        new: true,
        runValidators: true
      })

      if (!user) {
        throw new Error('用户不存在')
      }

      return user.getPublicProfile()
    } catch (error) {
      console.error('更新用户菜单权限失败:', error)
      throw error
    }
  }

  /**
   * 批量更新用户菜单权限
   * @param {Array<string>} userIds
   * @param {Array<string>} menuPermissions
   * @returns {Promise<number>} - 更新数量
   */
  static async bulkUpdateUserMenuPermissions(
    userIds,
    menuPermissions,
    menuPermissionMode = 'custom'
  ) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return 0
    }

    const normalizedPermissions = this.normalizeMenuPermissions(menuPermissions || [])
    const normalizedMode = ['default', 'custom', 'template'].includes(menuPermissionMode)
      ? menuPermissionMode
      : 'custom'
    const isDefaultMode = normalizedMode === 'default'
    const result = await UserModel.updateMany(
      { _id: { $in: userIds } },
      {
        menuPermissions: isDefaultMode ? [] : normalizedPermissions,
        menuPermissionMode: isDefaultMode ? 'default' : normalizedMode
      }
    )
    return result.modifiedCount || 0
  }

  /**
   * 创建菜单模板
   */
  static async createTemplate({ name, description = '', menuPermissions = [] }, operatorId) {
    if (!name) {
      throw new Error('模板名称不能为空')
    }

    const normalizedPermissions = this.normalizeMenuPermissions(menuPermissions)
    const template = await MenuPermissionTemplateModel.create({
      name,
      description,
      menuPermissions: normalizedPermissions,
      createdBy: operatorId,
      updatedBy: operatorId
    })
    return template
  }

  /**
   * 获取模板列表
   */
  static async getTemplates() {
    const templates = await MenuPermissionTemplateModel.find().sort({ updatedAt: -1 }).lean()
    return templates
  }

  /**
   * 更新模板
   */
  static async updateTemplate(templateId, data, operatorId) {
    const updateData = { ...data }
    if (data.menuPermissions) {
      updateData.menuPermissions = this.normalizeMenuPermissions(data.menuPermissions)
    }
    updateData.updatedBy = operatorId

    const template = await MenuPermissionTemplateModel.findByIdAndUpdate(templateId, updateData, {
      new: true,
      runValidators: true
    })

    if (!template) {
      throw new Error('模板不存在')
    }

    return template
  }

  /**
   * 删除模板
   */
  static async deleteTemplate(templateId) {
    const template = await MenuPermissionTemplateModel.findByIdAndDelete(templateId)
    if (!template) {
      throw new Error('模板不存在')
    }
    return template
  }

  /**
   * 应用模板到多个用户
   */
  static async applyTemplateToUsers(templateId, userIds = []) {
    try {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        throw new Error('请选择要应用的用户')
      }

      const template = await MenuPermissionTemplateModel.findById(templateId)
      if (!template) {
        throw new Error('模板不存在')
      }

      const normalizedPermissions = this.normalizeMenuPermissions(template.menuPermissions)
      const result = await UserModel.updateMany(
        { _id: { $in: userIds } },
        { menuPermissions: normalizedPermissions, menuPermissionMode: 'template' }
      )

      return {
        template,
        affected: result.modifiedCount || 0
      }
    } catch (error) {
      console.error('应用模板失败:', error)
      throw error
    }
  }

  /**
   * 更新用户的VIP等级
   * @param {string} userId - 用户ID
   * @param {number} vipLevel - VIP等级
   * @returns {Promise<Object>} - 更新后的用户信息
   */
  static async updateUserVipLevel(userId, vipLevel) {
    try {
      if (vipLevel < 0 || vipLevel > 10) {
        throw new Error('VIP等级必须在0-10之间')
      }

      const user = await UserModel.findByIdAndUpdate(
        userId,
        { vipLevel, role: vipLevel > 0 ? 'vip' : 'user' },
        { new: true, runValidators: true }
      )

      if (!user) {
        throw new Error('用户不存在')
      }

      return user.getPublicProfile()
    } catch (error) {
      console.error('更新用户VIP等级失败:', error)
      throw error
    }
  }

  /**
   * 获取所有可用的菜单项配置
   * @returns {Array<Object>} - 菜单项配置列表
   */
  static getAllMenuItems() {
    return [
      {
        key: 'dashboard',
        label: '仪表盘',
        path: '/admin/dashboard',
        description: '系统概览和统计信息'
      },
      {
        key: 'management',
        label: '管理',
        path: '/admin',
        description: '系统管理功能',
        children: [
          {
            key: 'users',
            label: '用户管理',
            path: '/admin/users',
            description: '管理系统用户和权限'
          },
          {
            key: 'clothing',
            label: '服装管理',
            path: '/admin/clothing',
            description: '管理服装信息和库存'
          },
          {
            key: 'page-components',
            label: '组件管理',
            path: '/admin/page-components',
            description: '管理页面组件，包含媒体和描述'
          },
          {
            key: 'pages',
            label: '页面管理',
            path: '/admin/pages',
            description: '管理页面配置，组合多个组件'
          },
          {
            key: 'menu-permission',
            label: '权限管理',
            path: '/admin/menu-permission',
            description: '为不同用户配置可见菜单及模板'
          }
        ]
      },
      {
        key: 'tools',
        label: '工具',
        path: '/admin',
        description: '系统工具',
        children: [
          {
            key: 'upload',
            label: '文件管理',
            path: '/admin/upload',
            description: '上传和管理文件，支持媒体库描述管理'
          }
        ]
      },
      {
        key: 'settings',
        label: '设置',
        path: '/admin/settings',
        description: '系统设置'
      }
    ]
  }
}

module.exports = MenuPermissionService

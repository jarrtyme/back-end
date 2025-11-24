const express = require('express')
const router = express.Router()
const UserService = require('../services/userService')
const {
  authenticateToken,
  requireAdmin,
  refreshTokenIfNeeded
} = require('../middlewares/authMiddleware')

/**
 * 用户注册
 * POST /auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body

    // 基本验证
    if (!username || !email || !password) {
      return res.error('用户名、邮箱和密码不能为空', 400)
    }

    if (password.length < 6) {
      return res.error('密码至少6个字符', 400)
    }

    // 限制注册：不允许注册 super_admin 角色
    if (role === 'super_admin') {
      return res.error('不能注册超级管理员角色', 400)
    }

    // 如果指定了角色，验证是否有效（但不允许 super_admin）
    if (role && !['admin', 'vip', 'user'].includes(role)) {
      return res.error('无效的角色类型', 400)
    }

    const result = await UserService.register({ username, email, password, role })

    res.success(result, '注册成功', 201)
  } catch (error) {
    console.error('注册失败:', error)
    res.error(error.message || '注册失败', 400)
  }
})

/**
 * 用户登录
 * POST /auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.error('用户名和密码不能为空', 400)
    }

    const result = await UserService.login({ username, password })

    res.success(result, '登录成功')
  } catch (error) {
    console.error('登录失败:', error)
    res.error(error.message || '登录失败', 401)
  }
})

/**
 * 获取当前用户信息
 * POST /auth/profile
 */
router.post('/profile', authenticateToken, refreshTokenIfNeeded, async (req, res) => {
  try {
    const user = req.user.getPublicProfile()
    res.success({ user }, '获取用户信息成功')
  } catch (error) {
    console.error('获取用户信息失败:', error)
    res.error('获取用户信息失败', 500)
  }
})

/**
 * 更新用户信息
 * POST /auth/update
 */
router.post('/update', authenticateToken, refreshTokenIfNeeded, async (req, res) => {
  try {
    const userId = req.user._id
    const updateData = req.body

    // 不允许直接修改密码和角色
    delete updateData.password
    delete updateData.role

    const user = await UserService.updateUser(userId, updateData)

    res.success({ user }, '更新用户信息成功')
  } catch (error) {
    console.error('更新用户信息失败:', error)
    res.error(error.message || '更新用户信息失败', 400)
  }
})

/**
 * 修改密码
 * POST /auth/change-password
 */
router.post('/change-password', authenticateToken, refreshTokenIfNeeded, async (req, res) => {
  try {
    const userId = req.user._id
    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
      return res.error('旧密码和新密码不能为空', 400)
    }

    if (newPassword.length < 6) {
      return res.error('新密码至少6个字符', 400)
    }

    await UserService.changePassword(userId, oldPassword, newPassword)

    res.success(null, '密码修改成功')
  } catch (error) {
    console.error('修改密码失败:', error)
    res.error(error.message || '修改密码失败', 400)
  }
})

/**
 * 验证token
 * POST /auth/verify
 * 使用 authenticateToken 和 refreshTokenIfNeeded 中间件
 * 如果 token 即将过期，会在响应头返回新 token
 */
router.post('/verify', authenticateToken, refreshTokenIfNeeded, async (req, res) => {
  try {
    // authenticateToken 中间件已经验证了 token 并将用户信息添加到 req.user
    const user = req.user.getPublicProfile()

    res.success({ user }, 'Token验证成功')
  } catch (error) {
    console.error('Token验证失败:', error)
    res.error(error.message || 'Token验证失败', 401)
  }
})

/**
 * 获取用户列表（仅管理员）
 * POST /auth/users
 */
router.post('/users', authenticateToken, refreshTokenIfNeeded, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, username, email, ...query } = req.body

    // 构建查询条件
    const searchQuery = { ...query }

    // 如果提供了搜索关键词（用户名或邮箱），使用 $or 查询
    if (username || email) {
      const searchKeyword = username || email
      searchQuery.$or = [
        { username: { $regex: searchKeyword, $options: 'i' } },
        { email: { $regex: searchKeyword, $options: 'i' } }
      ]
    }

    const result = await UserService.getUserList(searchQuery, page, limit)

    res.success(
      {
        users: result.users,
        list: result.users, // 兼容别名
        total: result.pagination.total,
        count: result.pagination.total, // 兼容别名
        page: result.pagination.page,
        limit: result.pagination.limit,
        pages: result.pagination.pages
      },
      '获取用户列表成功'
    )
  } catch (error) {
    console.error('获取用户列表失败:', error)
    res.error('获取用户列表失败', 500)
  }
})

/**
 * 更新用户角色（仅管理员）
 * POST /auth/users/:userId/role
 * 注意：只有 super_admin 可以将用户升级为 super_admin
 */
router.post(
  '/users/:userId/role',
  authenticateToken,
  refreshTokenIfNeeded,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params
      const { role } = req.body
      const currentUser = req.user

      const { isValidRole } = require('../config/role')
      if (!role || !isValidRole(role)) {
        return res.error('角色必须是super_admin、admin、vip或user', 400)
      }

      // 安全检查：只有 super_admin 可以将用户升级为 super_admin
      if (role === 'super_admin' && currentUser.role !== 'super_admin') {
        return res.error('只有超级管理员可以将用户升级为超级管理员', 403)
      }

      const user = await UserService.updateUser(userId, { role })

      res.success({ user }, '更新用户角色成功')
    } catch (error) {
      console.error('更新用户角色失败:', error)
      res.error(error.message || '更新用户角色失败', 400)
    }
  }
)

/**
 * 禁用/启用用户（仅管理员）
 * POST /auth/users/:userId/status
 */
router.post(
  '/users/:userId/status',
  authenticateToken,
  refreshTokenIfNeeded,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params
      const { isActive } = req.body

      if (typeof isActive !== 'boolean') {
        return res.error('isActive必须是布尔值', 400)
      }

      const user = await UserService.updateUser(userId, { isActive })

      res.success({ user }, `用户已${isActive ? '启用' : '禁用'}`)
    } catch (error) {
      console.error('更新用户状态失败:', error)
      res.error(error.message || '更新用户状态失败', 400)
    }
  }
)

/**
 * 更新用户信息（仅管理员）
 * POST /auth/users/:userId/update
 */
router.post(
  '/users/:userId/update',
  authenticateToken,
  refreshTokenIfNeeded,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params
      const updateData = req.body

      // 不允许修改密码（密码修改有单独的接口）
      delete updateData.password

      const user = await UserService.updateUser(userId, updateData)

      res.success({ user }, '更新用户信息成功')
    } catch (error) {
      console.error('更新用户信息失败:', error)
      res.error(error.message || '更新用户信息失败', 400)
    }
  }
)

/**
 * 删除用户（仅管理员）
 * POST /auth/users/:userId/delete
 */
router.post(
  '/users/:userId/delete',
  authenticateToken,
  refreshTokenIfNeeded,
  requireAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params

      // 不能删除自己
      if (userId === req.user._id.toString()) {
        return res.error('不能删除自己的账户', 400)
      }

      await UserService.deleteUser(userId)

      res.success(null, '用户删除成功')
    } catch (error) {
      console.error('删除用户失败:', error)
      res.error(error.message || '删除用户失败', 400)
    }
  }
)

module.exports = router

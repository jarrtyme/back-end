const express = require('express')
const router = express.Router()

const PageService = require('../services/pageService')
const { authenticateToken, refreshTokenIfNeeded } = require('../middlewares/authMiddleware')

// ========== 公开访问接口（无需鉴权） ==========

// 查询已发布的页面列表（公开访问）
router.post('/public/list', async (req, res) => {
  try {
    const { page = 1, limit = 10, name } = req.body

    // 限制分页参数，防止查询过大
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10))) // 最大每页100条

    // 构建查询条件
    const searchQuery = {}
    if (name && name.trim()) {
      // 名称模糊查询
      searchQuery.name = {
        $regex: name.trim(),
        $options: 'i'
      }
    }

    // 使用 Promise.all 并行执行查询和计数，提高性能
    const [pages, total] = await Promise.all([
      PageService.findPublic(searchQuery, pageNum, limitNum),
      PageService.count({
        ...searchQuery,
        isPublished: true,
        isActive: true
      })
    ])

    res.success(
      {
        list: pages,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      'Public pages retrieved successfully'
    )
  } catch (error) {
    console.error('Error finding public pages:', error)
    res.error('Error finding public pages', 500)
  }
})

// 根据ID或名称查询单个已发布的页面（公开访问）
// 支持通过页面ID（MongoDB ObjectId）或页面名称查询
router.post('/public/findById', async (req, res) => {
  try {
    const { id } = req.body
    if (!id) {
      return res.error('ID or name is required', 400)
    }

    const page = await PageService.findPublicById(id)
    if (!page) {
      return res.error('Page not found or not published', 404)
    }

    res.success(page, 'Public page retrieved successfully')
  } catch (error) {
    console.error('Error finding public page by ID or name:', error)
    res.error('Error finding public page by ID or name', 500)
  }
})

// ========== 需要鉴权的管理接口 ==========

// 所有页面路由都需要鉴权，并支持无感刷新 token
router.use(authenticateToken)
router.use(refreshTokenIfNeeded)

// 查询页面列表（支持分页和条件查询）- 需要鉴权
router.post('/list', async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, isPublished, name } = req.body

    // 限制分页参数，防止查询过大
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10))) // 最大每页100条

    // 构建查询条件
    const searchQuery = {}
    if (isActive !== undefined) {
      searchQuery.isActive = isActive
    }
    if (isPublished !== undefined) {
      searchQuery.isPublished = isPublished
    }
    if (name && name.trim()) {
      // 名称模糊查询
      searchQuery.name = {
        $regex: name.trim(),
        $options: 'i'
      }
    }

    // 使用 Promise.all 并行执行查询和计数，提高性能
    const [pages, total] = await Promise.all([
      PageService.find(searchQuery, pageNum, limitNum),
      PageService.count(searchQuery)
    ])

    res.success(
      {
        list: pages,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      'Pages retrieved successfully'
    )
  } catch (error) {
    console.error('Error finding pages:', error)
    res.error('Error finding pages', 500)
  }
})

// 创建页面
router.post('/create', async (req, res) => {
  try {
    const {
      name,
      description = '',
      componentIds = [],
      order = 0,
      isActive = true,
      isPublished = false
    } = req.body

    if (!name || !name.trim()) {
      return res.error('Page name is required', 400)
    }

    // 验证 componentIds 是数组
    if (!Array.isArray(componentIds)) {
      return res.error('Component IDs must be an array', 400)
    }

    const pageData = {
      name: name.trim(),
      description: description.trim(),
      componentIds: componentIds,
      order: parseInt(order, 10) || 0,
      isActive: Boolean(isActive),
      isPublished: Boolean(isPublished)
    }

    const page = await PageService.create(pageData)

    // 重新查询以获取填充的组件信息
    const pageWithComponents = await PageService.findById(page._id)

    res.success(pageWithComponents, 'Page created successfully')
  } catch (error) {
    console.error('Error creating page:', error)
    res.error('Failed to create page: ' + error.message, 500)
  }
})

// 根据ID查询单个页面
router.post('/findById', async (req, res) => {
  try {
    const { id } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    const page = await PageService.findById(id)
    if (!page) {
      return res.error('Page not found', 404)
    }

    res.success(page, 'Page retrieved successfully')
  } catch (error) {
    console.error('Error finding page by ID:', error)
    res.error('Error finding page by ID', 500)
  }
})

// 更新页面信息
router.post('/update', async (req, res) => {
  try {
    const { id, ...updateFields } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    // 验证 componentIds（如果提供）
    if (updateFields.componentIds !== undefined) {
      if (!Array.isArray(updateFields.componentIds)) {
        return res.error('Component IDs must be an array', 400)
      }
    }

    // 处理 name
    if (updateFields.name) {
      updateFields.name = updateFields.name.trim()
    }

    // 处理 description
    if (updateFields.description !== undefined) {
      updateFields.description = updateFields.description.trim()
    }

    // 处理 order
    if (updateFields.order !== undefined) {
      updateFields.order = parseInt(updateFields.order, 10) || 0
    }

    // 处理 isActive
    if (updateFields.isActive !== undefined) {
      updateFields.isActive = Boolean(updateFields.isActive)
    }

    // 处理 isPublished
    if (updateFields.isPublished !== undefined) {
      updateFields.isPublished = Boolean(updateFields.isPublished)
    }

    const updatedPage = await PageService.update(id, updateFields)
    if (!updatedPage) {
      return res.error('Page not found', 404)
    }

    res.success(updatedPage, 'Page updated successfully')
  } catch (error) {
    console.error('Error updating page:', error)
    res.error('Failed to update page', 500)
  }
})

// 删除页面（支持单个和批量删除）
router.post('/remove', async (req, res) => {
  try {
    const { id, ids } = req.body

    // 批量删除模式
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const result = await PageService.batchRemove(ids)

      const statusCode = result.failCount === 0 ? 200 : 207 // 207 = Multi-Status
      return res.success(
        {
          success: result.success,
          failed: result.failed,
          total: result.total,
          successCount: result.successCount,
          failCount: result.failCount
        },
        `批量删除完成：成功 ${result.successCount} 个，失败 ${result.failCount} 个`,
        statusCode
      )
    }

    // 单个删除模式（保持向后兼容）
    if (!id) {
      return res.error('ID is required', 400)
    }

    const deletedPage = await PageService.remove(id)
    if (!deletedPage) {
      return res.error('Page not found', 404)
    }

    res.success(deletedPage, 'Page deleted successfully')
  } catch (error) {
    console.error('Error deleting page:', error)
    res.error('Failed to delete page', 500)
  }
})

module.exports = router

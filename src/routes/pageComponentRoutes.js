const express = require('express')
const router = express.Router()

const PageComponentService = require('../services/pageComponentService')
const { authenticateToken, refreshTokenIfNeeded } = require('../middlewares/authMiddleware')

// ========== 公开访问接口（无需鉴权） ==========

// 根据ID数组查询已启用的页面组件（公开访问）
router.post('/public/findByIds', async (req, res) => {
  try {
    const { ids } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.error('IDs array is required and cannot be empty', 400)
    }

    const components = await PageComponentService.findPublicByIds(ids)

    res.success(components, 'Public page components retrieved successfully')
  } catch (error) {
    console.error('Error finding public page components by IDs:', error)
    res.error('Error finding public page components by IDs', 500)
  }
})

// ========== 需要鉴权的管理接口 ==========

// 所有页面组件路由都需要鉴权，并支持无感刷新 token
router.use(authenticateToken)
router.use(refreshTokenIfNeeded)

// 查询页面组件列表（支持分页和条件查询）- 需要鉴权
router.post('/list', async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, displayType, name } = req.body

    // 限制分页参数，防止查询过大
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10))) // 最大每页100条

    // 构建查询条件
    const searchQuery = {}
    if (isActive !== undefined) {
      searchQuery.isActive = isActive
    }
    if (displayType) {
      searchQuery.displayType = displayType
    }
    if (name && name.trim()) {
      // 名称模糊查询
      searchQuery.name = {
        $regex: name.trim(),
        $options: 'i'
      }
    }

    // 使用 Promise.all 并行执行查询和计数，提高性能
    const [components, total] = await Promise.all([
      PageComponentService.find(searchQuery, pageNum, limitNum),
      PageComponentService.count(searchQuery)
    ])

    res.success(
      {
        list: components,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      'Page components retrieved successfully'
    )
  } catch (error) {
    console.error('Error finding page components:', error)
    res.error('Error finding page components', 500)
  }
})

// 创建页面组件
router.post('/create', async (req, res) => {
  try {
    const { name, displayType, items = [], order = 0, isActive = true } = req.body

    if (!name || !name.trim()) {
      return res.error('Component name is required', 400)
    }

    if (!displayType) {
      return res.error('Display type is required', 400)
    }

    const { isValidDisplayType } = require('../config/displayType')
    if (!isValidDisplayType(displayType)) {
      return res.error('Invalid display type', 400)
    }

    // 验证 items 格式
    if (!Array.isArray(items)) {
      return res.error('Items must be an array', 400)
    }

    // 验证每个 item 的格式
    for (const item of items) {
      if (!item.media || !item.media.url || !item.media.type) {
        return res.error('Each item must have media with url and type', 400)
      }
      const { isValidMediaType } = require('../config/mediaType')
      if (!isValidMediaType(item.media.type)) {
        return res.error('Media type must be "image" or "video"', 400)
      }
      if (!Array.isArray(item.descriptions)) {
        return res.error('Descriptions must be an array', 400)
      }
    }

    const componentData = {
      name: name.trim(),
      displayType,
      items: items.map((item) => ({
        media: {
          mediaId: item.media.mediaId || null,
          url: item.media.url,
          type: item.media.type,
          filename: item.media.filename || ''
        },
        descriptions: (item.descriptions || []).map((desc) => ({
          text: typeof desc === 'string' ? desc : desc.text || '',
          createdAt: desc.createdAt || new Date()
        }))
      })),
      order: parseInt(order, 10) || 0,
      isActive: Boolean(isActive)
    }

    // 如果是滚动快照类型，添加 widthMode
    if (displayType === 'scroll-snap' && req.body.widthMode) {
      componentData.widthMode = req.body.widthMode
    }

    const component = await PageComponentService.create(componentData)

    res.success(component, 'Page component created successfully')
  } catch (error) {
    console.error('Error creating page component:', error)
    res.error('Failed to create page component: ' + error.message, 500)
  }
})

// 根据ID查询单个页面组件
router.post('/findById', async (req, res) => {
  try {
    const { id } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    const component = await PageComponentService.findById(id)
    if (!component) {
      return res.error('Page component not found', 404)
    }

    res.success(component, 'Page component retrieved successfully')
  } catch (error) {
    console.error('Error finding page component by ID:', error)
    res.error('Error finding page component by ID', 500)
  }
})

// 更新页面组件信息
router.post('/update', async (req, res) => {
  try {
    const { id, ...updateFields } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    // 验证 displayType（如果提供）
    if (updateFields.displayType) {
      const { isValidDisplayType } = require('../config/displayType')
      if (!isValidDisplayType(updateFields.displayType)) {
        return res.error('Invalid display type', 400)
      }
    }

    // 验证 items（如果提供）
    if (updateFields.items) {
      if (!Array.isArray(updateFields.items)) {
        return res.error('Items must be an array', 400)
      }

      for (const item of updateFields.items) {
        if (!item.media || !item.media.url || !item.media.type) {
          return res.error('Each item must have media with url and type', 400)
        }
        const { isValidMediaType } = require('../config/mediaType')
        if (!isValidMediaType(item.media.type)) {
          return res.error('Media type must be "image" or "video"', 400)
        }
        if (!Array.isArray(item.descriptions)) {
          return res.error('Descriptions must be an array', 400)
        }
      }

      // 格式化 items
      updateFields.items = updateFields.items.map((item) => ({
        media: {
          mediaId: item.media.mediaId || null,
          url: item.media.url,
          type: item.media.type,
          filename: item.media.filename || ''
        },
        descriptions: (item.descriptions || []).map((desc) => ({
          text: typeof desc === 'string' ? desc : desc.text || '',
          createdAt: desc.createdAt || new Date()
        }))
      }))
    }

    // 处理 name
    if (updateFields.name) {
      updateFields.name = updateFields.name.trim()
    }

    // 处理 order
    if (updateFields.order !== undefined) {
      updateFields.order = parseInt(updateFields.order, 10) || 0
    }

    // 处理 isActive
    if (updateFields.isActive !== undefined) {
      updateFields.isActive = Boolean(updateFields.isActive)
    }

    // 处理 widthMode（仅当 displayType 为 scroll-snap 时）
    if (updateFields.widthMode !== undefined) {
      if (updateFields.displayType === 'scroll-snap' || updateFields.displayType === undefined) {
        // 验证 widthMode 值
        if (!['wide', 'narrow'].includes(updateFields.widthMode)) {
          return res.error('widthMode must be "wide" or "narrow"', 400)
        }
        updateFields.widthMode = updateFields.widthMode.trim()
      } else {
        // 如果不是 scroll-snap 类型，移除 widthMode
        delete updateFields.widthMode
      }
    }

    const updatedComponent = await PageComponentService.update(id, updateFields)
    if (!updatedComponent) {
      return res.error('Page component not found', 404)
    }

    res.success(updatedComponent, 'Page component updated successfully')
  } catch (error) {
    console.error('Error updating page component:', error)
    res.error('Failed to update page component', 500)
  }
})

// 删除页面组件（支持单个和批量删除）
router.post('/remove', async (req, res) => {
  try {
    const { id, ids } = req.body

    // 批量删除模式
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const result = await PageComponentService.batchRemove(ids)

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

    const deletedComponent = await PageComponentService.remove(id)
    if (!deletedComponent) {
      return res.error('Page component not found', 404)
    }

    res.success(deletedComponent, 'Page component deleted successfully')
  } catch (error) {
    console.error('Error deleting page component:', error)
    res.error('Failed to delete page component', 500)
  }
})

module.exports = router

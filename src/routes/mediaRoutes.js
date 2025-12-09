const express = require('express')
const router = express.Router()

const MediaService = require('../services/mediaService')
const { authenticateToken, refreshTokenIfNeeded } = require('../middlewares/authMiddleware')
const { addFileUrl } = require('../utils/fileUrl')
const { normalizeUrlForStorage } = require('../utils/urlUtils')

// 所有媒体库路由都需要鉴权，并支持无感刷新 token
router.use(authenticateToken)
router.use(refreshTokenIfNeeded)

// 查询媒体列表（支持分页和条件查询）- 需要鉴权
router.post('/list', async (req, res) => {
  try {
    const { page = 1, limit = 10, type, description, ...query } = req.body

    // 限制分页参数，防止查询过大
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10))) // 最大每页100条

    // 构建查询条件
    const searchQuery = { ...query }
    if (type) {
      searchQuery.type = type
    }

    // 如果提供了描述搜索关键词，支持 | 分隔的多个关键词查询
    if (description && description.trim()) {
      const keywords = description
        .split('|')
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
        .slice(0, 10) // 限制最多10个关键词，防止查询过慢

      if (keywords.length > 0) {
        // 转义正则表达式特殊字符，防止注入和性能问题
        const escapeRegex = (str) => {
          return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        }

        if (keywords.length === 1) {
          // 单个关键词：如果以^开头，使用前缀匹配（可以利用索引）
          const keyword = keywords[0]
          if (keyword.startsWith('^')) {
            // 前缀匹配，可以使用索引
            searchQuery['descriptions.text'] = {
              $regex: `^${escapeRegex(keyword.substring(1))}`,
              $options: 'i'
            }
          } else {
            // 普通模糊匹配
            searchQuery['descriptions.text'] = {
              $regex: escapeRegex(keyword),
              $options: 'i'
            }
          }
        } else {
          // 多个关键词使用 $or 查询，匹配任意一个关键词
          // 注意：$or 会与顶层查询条件进行 AND 操作
          searchQuery.$or = keywords.map((keyword) => {
            const escapedKeyword = escapeRegex(keyword)
            return {
              'descriptions.text': {
                $regex: escapedKeyword,
                $options: 'i'
              }
            }
          })
        }
      }
    }

    // 使用 Promise.all 并行执行查询和计数，提高性能
    const [mediaItems, total] = await Promise.all([
      MediaService.find(searchQuery, pageNum, limitNum),
      MediaService.count(searchQuery)
    ])

    // 为每个媒体添加完整URL
    const mediaWithUrls = addFileUrl(mediaItems, req)

    res.success(
      {
        list: mediaWithUrls,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      'Media items retrieved successfully'
    )
  } catch (error) {
    console.error('Error finding media items:', error)
    res.error('Error finding media items', 500)
  }
})

// 创建媒体记录（上传后创建）
router.post('/create', async (req, res) => {
  try {
    const { type, url, filename, size, mimetype, descriptions = [] } = req.body

    if (!type || !url) {
      return res.error('Type and URL are required', 400)
    }

    const { isValidMediaType } = require('../config/mediaType')
    if (!isValidMediaType(type)) {
      return res.error(
        'Invalid file type. Supported types: image, video, document, archive, text, other',
        400
      )
    }

    const normalizedUrl = normalizeUrlForStorage(url)

    const mediaData = {
      type,
      url: normalizedUrl, // 使用标准化后的 URL 存储
      filename: filename || '',
      size: size || 0,
      mimetype: mimetype || '',
      descriptions: descriptions.map((text) => ({ text }))
    }

    // 直接调用 create，内部会处理重复检查和更新逻辑
    const media = await MediaService.create(mediaData)

    // 检查是否是新创建的记录（通过比较创建时间和当前时间）
    // 如果记录的创建时间接近当前时间（2秒内），认为是新创建的
    const now = Date.now()
    const createdAt = new Date(media.createdAt || now).getTime()
    const isNew = now - createdAt < 2000 // 2秒内认为是新创建的

    // 添加完整URL
    const mediaWithUrl = addFileUrl(media, req)

    if (isNew) {
      res.success(mediaWithUrl, 'Media item created successfully')
    } else {
      res.success(mediaWithUrl, 'Media item already exists in library')
    }
  } catch (error) {
    console.error('Error creating media item:', error)
    // 如果是重复键错误，返回更友好的错误信息
    if (error.code === 11000 || error.message.includes('duplicate')) {
      return res.error('This media item already exists in the library', 409)
    }
    res.error('Failed to create media item: ' + error.message, 500)
  }
})

// 根据ID查询单个媒体
router.post('/findById', async (req, res) => {
  try {
    const { id } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    const mediaItem = await MediaService.findById(id)
    if (!mediaItem) {
      return res.error('Media item not found', 404)
    }

    // 添加完整URL
    const mediaWithUrl = addFileUrl(mediaItem, req)

    res.success(mediaWithUrl, 'Media item retrieved successfully')
  } catch (error) {
    console.error('Error finding media item by ID:', error)
    res.error('Error finding media item by ID', 500)
  }
})

// 更新媒体信息
router.post('/update', async (req, res) => {
  try {
    const { id, ...updateFields } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    const updatedMedia = await MediaService.update(id, updateFields)
    if (!updatedMedia) {
      return res.error('Media item not found', 404)
    }

    // 添加完整URL
    const mediaWithUrl = addFileUrl(updatedMedia, req)

    res.success(mediaWithUrl, 'Media item updated successfully')
  } catch (error) {
    console.error('Error updating media item:', error)
    res.error('Failed to update media item', 500)
  }
})

// 删除媒体记录（支持单个和批量删除）
router.post('/remove', async (req, res) => {
  try {
    const { id, ids } = req.body

    // 批量删除模式
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const results = []
      const errors = []

      for (let i = 0; i < ids.length; i++) {
        try {
          const mediaId = ids[i]
          const deletedMedia = await MediaService.remove(mediaId)
          if (deletedMedia) {
            results.push({
              id: mediaId,
              success: true
            })
          } else {
            errors.push({
              id: mediaId,
              error: 'Media item not found'
            })
          }
        } catch (error) {
          errors.push({
            id: ids[i],
            error: error.message
          })
        }
      }

      const statusCode = errors.length === 0 ? 200 : 207 // 207 = Multi-Status
      return res.success(
        {
          success: results,
          failed: errors,
          total: ids.length,
          successCount: results.length,
          failCount: errors.length
        },
        `批量删除完成：成功 ${results.length} 个，失败 ${errors.length} 个`,
        statusCode
      )
    }

    // 单个删除模式（保持向后兼容）
    if (!id) {
      return res.error('ID is required', 400)
    }

    const deletedMedia = await MediaService.remove(id)
    if (!deletedMedia) {
      return res.error('Media item not found', 404)
    }

    res.success(deletedMedia, 'Media item deleted successfully')
  } catch (error) {
    console.error('Error deleting media item:', error)
    res.error('Failed to delete media item', 500)
  }
})

// 添加描述
router.post('/addDescription', async (req, res) => {
  try {
    const { id, text } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }
    if (!text || !text.trim()) {
      return res.error('Description text is required', 400)
    }

    const updatedMedia = await MediaService.addDescription(id, text.trim())

    // 添加完整URL
    const mediaWithUrl = addFileUrl(updatedMedia, req)

    res.success(mediaWithUrl, 'Description added successfully')
  } catch (error) {
    console.error('Error adding description:', error)
    res.error('Failed to add description', 500)
  }
})

// 删除描述
router.post('/removeDescription', async (req, res) => {
  try {
    const { id, descriptionId } = req.body
    if (!id) {
      return res.error('Media ID is required', 400)
    }
    if (!descriptionId) {
      return res.error('Description ID is required', 400)
    }

    const updatedMedia = await MediaService.removeDescription(id, descriptionId)

    // 添加完整URL
    const mediaWithUrl = addFileUrl(updatedMedia, req)

    res.success(mediaWithUrl, 'Description removed successfully')
  } catch (error) {
    console.error('Error removing description:', error)
    res.error('Failed to remove description', 500)
  }
})

// 更新描述
router.post('/updateDescription', async (req, res) => {
  try {
    const { id, descriptionId, text } = req.body
    if (!id) {
      return res.error('Media ID is required', 400)
    }
    if (!descriptionId) {
      return res.error('Description ID is required', 400)
    }
    if (!text || !text.trim()) {
      return res.error('Description text is required', 400)
    }

    const updatedMedia = await MediaService.updateDescription(id, descriptionId, text.trim())

    // 添加完整URL
    const mediaWithUrl = addFileUrl(updatedMedia, req)

    res.success(mediaWithUrl, 'Description updated successfully')
  } catch (error) {
    console.error('Error updating description:', error)
    res.error('Failed to update description', 500)
  }
})

// 统一保存描述（一次性处理添加、更新、删除）
router.post('/saveDescriptions', async (req, res) => {
  try {
    const { id, descriptions } = req.body
    if (!id) {
      return res.error('Media ID is required', 400)
    }
    if (!Array.isArray(descriptions)) {
      return res.error('Descriptions must be an array', 400)
    }

    const updatedMedia = await MediaService.saveDescriptions(id, descriptions)

    // 添加完整URL
    const mediaWithUrl = addFileUrl(updatedMedia, req)

    res.success(mediaWithUrl, 'Descriptions saved successfully')
  } catch (error) {
    console.error('Error saving descriptions:', error)
    res.error('Failed to save descriptions: ' + error.message, 500)
  }
})

// 批量添加描述
router.post('/batchAddDescription', async (req, res) => {
  try {
    const { items } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.error('Items array is required and cannot be empty', 400)
    }

    const result = await MediaService.batchAddDescription(items)

    // 为成功的媒体记录添加完整URL
    const successWithUrls = await Promise.all(
      result.success.map(async (item) => {
        try {
          const media = await MediaService.findById(item.id)
          if (media) {
            return {
              ...item,
              media: addFileUrl(media, req)
            }
          }
          return item
        } catch (error) {
          return item
        }
      })
    )

    const responseData = {
      success: successWithUrls,
      failed: result.failed,
      total: result.total,
      successCount: result.successCount,
      failCount: result.failCount
    }

    const statusCode = result.failCount === 0 ? 200 : 207 // 207 = Multi-Status
    const message = `批量添加描述完成：成功 ${result.successCount} 个，失败 ${result.failCount} 个`

    return res.success(responseData, message, statusCode)
  } catch (error) {
    console.error('Error batch adding descriptions:', error)
    res.error('Failed to batch add descriptions: ' + error.message, 500)
  }
})

// 批量创建媒体记录（批量添加到媒体库）
router.post('/batchCreate', async (req, res) => {
  try {
    const { items } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.error('Items array is required and cannot be empty', 400)
    }

    const result = await MediaService.batchCreate(items)

    // 为成功的媒体记录添加完整URL
    const successWithUrls = result.success.map((item) => {
      if (item.media) {
        return {
          ...item,
          media: addFileUrl(item.media, req)
        }
      }
      return item
    })

    const responseData = {
      success: successWithUrls,
      failed: result.failed,
      total: result.total,
      successCount: result.successCount,
      failCount: result.failCount
    }

    const statusCode = result.failCount === 0 ? 200 : 207 // 207 = Multi-Status
    const message = `批量添加到媒体库完成：成功 ${result.successCount} 个，失败 ${result.failCount} 个`

    return res.success(responseData, message, statusCode)
  } catch (error) {
    console.error('Error batch creating media items:', error)
    res.error('Failed to batch create media items: ' + error.message, 500)
  }
})

module.exports = router

const MediaModel = require('../models/mediaModel.js')
const fs = require('fs')
const path = require('path')
const { normalizeUrl, cleanFilePath, normalizeUrlForStorage } = require('../utils/urlUtils')
const { safeDeleteFile } = require('../utils/pathValidator')
const { publicDir } = require('../config/paths')

// 根据URL查找媒体记录（支持多种URL格式匹配）
const findByUrl = async (url) => {
  try {
    if (!url) return null

    const normalizedUrl = normalizeUrl(url)
    const normalizedWithSlash = normalizedUrl.startsWith('/') ? normalizedUrl : '/' + normalizedUrl
    const normalizedWithoutSlash = normalizedUrl.startsWith('/')
      ? normalizedUrl.substring(1)
      : normalizedUrl

    // 尝试多种URL格式匹配
    const doc = await MediaModel.findOne({
      $or: [
        { url: url },
        { url: normalizedUrl },
        { url: normalizedWithSlash },
        { url: normalizedWithoutSlash },
        { url: { $regex: normalizedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
      ]
    })
    return doc
  } catch (error) {
    console.error('Error finding media by URL:', error)
    return null
  }
}

// 创建媒体记录（如果URL已存在则返回已存在的记录，并更新信息）
const create = async (data) => {
  try {
    // 确保 URL 使用标准化格式存储
    const normalizedUrl = normalizeUrlForStorage(data.url)
    data.url = normalizedUrl

    // 先检查URL是否已存在
    const existingMedia = await findByUrl(normalizedUrl)
    if (existingMedia) {
      let hasUpdate = false

      // 更新基本信息（如果提供了新值且不同）
      if (data.filename && existingMedia.filename !== data.filename) {
        existingMedia.filename = data.filename
        hasUpdate = true
      }
      if (data.size && existingMedia.size !== data.size) {
        existingMedia.size = data.size
        hasUpdate = true
      }
      if (data.mimetype && existingMedia.mimetype !== data.mimetype) {
        existingMedia.mimetype = data.mimetype
        hasUpdate = true
      }

      // 如果提供了新描述，添加到描述数组（不覆盖原有描述）
      if (data.descriptions && Array.isArray(data.descriptions) && data.descriptions.length > 0) {
        const newDescriptions = data.descriptions
          .filter((desc) => {
            const text = typeof desc === 'string' ? desc : desc.text
            return text && text.trim()
          })
          .map((desc) => {
            const text = typeof desc === 'string' ? desc : desc.text
            return {
              text: text.trim(),
              createdAt: new Date()
            }
          })
          .filter((newDesc) => {
            // 检查是否已存在相同描述（避免重复）
            return !existingMedia.descriptions.some(
              (existingDesc) => existingDesc.text === newDesc.text
            )
          })

        if (newDescriptions.length > 0) {
          existingMedia.descriptions.push(...newDescriptions)
          hasUpdate = true
        }
      }

      // 确保标记为已添加到媒体库
      if (!existingMedia.isAddedToLibrary) {
        existingMedia.isAddedToLibrary = true
        hasUpdate = true
      }

      // 只有在有更新时才保存
      if (hasUpdate) {
        await existingMedia.save()
      }

      return existingMedia
    }

    // 如果不存在，创建新记录
    const savedDoc = await MediaModel.create({
      ...data,
      isAddedToLibrary: true
    })
    return savedDoc
  } catch (error) {
    console.error('Error creating media item:', error)
    // 如果是唯一键冲突（URL重复），尝试查找已存在的记录
    if (error.code === 11000) {
      const existingMedia = await findByUrl(data.url)
      if (existingMedia) {
        return existingMedia
      }
    }
    throw error
  }
}

// 查询媒体列表（支持分页和条件查询）
const find = async (query = {}, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit
    // 使用 lean() 返回纯 JavaScript 对象，提高查询性能
    // 设置查询超时（30秒），防止长时间查询
    const docs = await MediaModel.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }) // 按创建时间倒序，使用索引优化
      .lean() // 返回纯对象，不返回 Mongoose 文档，提高性能
      .maxTimeMS(30000) // 30秒超时
      .exec()
    return docs
  } catch (error) {
    console.error('Error finding media items:', error)
    throw new Error('Error finding media items')
  }
}

// 获取总数
const count = async (query = {}) => {
  try {
    // 设置查询超时（30秒），防止长时间查询
    return await MediaModel.countDocuments(query)
      .maxTimeMS(30000) // 30秒超时
      .exec()
  } catch (error) {
    console.error('Error counting media items:', error)
    throw new Error('Error counting media items')
  }
}

// 根据ID查询单个媒体
const findById = async (id) => {
  try {
    const doc = await MediaModel.findById(id)
    return doc
  } catch (error) {
    console.error('Error finding media item by ID:', error)
    throw new Error('Error finding media item by ID')
  }
}

// 更新媒体信息
const update = async (mediaId, updateFields) => {
  try {
    const updatedMedia = await MediaModel.findByIdAndUpdate(
      mediaId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
    return updatedMedia
  } catch (error) {
    throw new Error('Error updating media item: ' + error.message)
  }
}

// 删除媒体记录（同时删除文件）
const remove = async (id) => {
  try {
    // 先查找媒体记录，获取文件路径
    const media = await MediaModel.findById(id)
    if (!media) {
      return null
    }

    // 删除文件
    if (media.url) {
      try {
        // 从URL中提取文件路径
        let filePath = media.url
        // 如果是完整URL，提取路径部分
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
          try {
            const url = new URL(filePath)
            filePath = url.pathname
          } catch {
            // 如果不是有效URL，尝试直接提取路径
            filePath = filePath.replace(/^https?:\/\/[^/]+/, '')
          }
        }

        // 清理路径：移除 /api 前缀和查询参数
        const cleanPath = cleanFilePath(filePath)

        // 使用工具函数安全删除文件
        const deleteResult = safeDeleteFile(cleanPath, publicDir, {
          requireUploadsPrefix: true,
          requireCategory: false
        })

        if (deleteResult.success) {
          console.log(`文件已删除: ${deleteResult.path}`)
        } else {
          console.warn(`删除文件失败: ${deleteResult.error}`)
        }
      } catch (fileError) {
        // 文件删除失败不影响记录删除，只记录错误
        console.error('删除文件失败:', fileError)
      }
    }

    // 删除数据库记录
    const deletedDoc = await MediaModel.findByIdAndDelete(id)
    return deletedDoc
  } catch (error) {
    console.error('Error deleting media item:', error)
    throw error
  }
}

// 添加描述
const addDescription = async (mediaId, descriptionText) => {
  try {
    const media = await MediaModel.findById(mediaId)
    if (!media) {
      throw new Error('Media item not found')
    }

    // 添加新描述到数组
    media.descriptions.push({
      text: descriptionText,
      createdAt: new Date()
    })

    await media.save()
    return media
  } catch (error) {
    console.error('Error adding description:', error)
    throw new Error('Error adding description: ' + error.message)
  }
}

// 删除描述
const removeDescription = async (mediaId, descriptionId) => {
  try {
    const media = await MediaModel.findById(mediaId)
    if (!media) {
      throw new Error('Media item not found')
    }

    // 统一处理 ID 类型转换：确保 descriptionId 转换为字符串进行比较
    const targetId = typeof descriptionId === 'string' ? descriptionId : String(descriptionId)

    // 使用 Mongoose 的 id() 方法查找描述，更可靠
    const description = media.descriptions.id(targetId)
    if (!description) {
      throw new Error('Description not found')
    }

    // 使用 remove() 方法删除子文档
    description.remove()
    await media.save()
    return media
  } catch (error) {
    console.error('Error removing description:', error)
    throw new Error('Error removing description: ' + error.message)
  }
}

// 更新描述
const updateDescription = async (mediaId, descriptionId, newText) => {
  try {
    const media = await MediaModel.findById(mediaId)
    if (!media) {
      throw new Error('Media item not found')
    }

    // 统一处理 ID 类型转换：确保 descriptionId 转换为字符串
    const targetId = typeof descriptionId === 'string' ? descriptionId : String(descriptionId)

    // 更新指定描述
    const description = media.descriptions.id(targetId)
    if (!description) {
      throw new Error('Description not found')
    }

    description.text = newText
    await media.save()
    return media
  } catch (error) {
    console.error('Error updating description:', error)
    throw new Error('Error updating description: ' + error.message)
  }
}

// 统一保存描述（一次性处理添加、更新、删除）
// descriptions: [{ _id: 'descriptionId', text: '描述文本' }, ...] 或 [{ text: '新描述' }, ...]
// 如果 _id 存在且在原描述中存在，则更新；如果 _id 不存在，则添加；如果原描述中的某个 _id 不在新列表中，则删除
const saveDescriptions = async (mediaId, descriptions) => {
  try {
    const media = await MediaModel.findById(mediaId)
    if (!media) {
      throw new Error('Media item not found')
    }

    // 统一处理 ID 类型转换
    const normalizeId = (id) => {
      if (!id) return null
      return typeof id === 'string' ? id : String(id)
    }

    // 构建新描述的映射（用于快速查找）
    const newDescMap = new Map()
    const descriptionsToAdd = []

    descriptions.forEach((desc) => {
      const text = desc.text ? desc.text.trim() : ''
      if (!text) return // 跳过空描述

      if (desc._id) {
        // 有 ID 的描述，需要更新或保留
        const id = normalizeId(desc._id)
        newDescMap.set(id, text)
      } else {
        // 没有 ID 的描述，需要添加
        descriptionsToAdd.push({
          text: text,
          createdAt: new Date()
        })
      }
    })

    // 处理现有描述：更新、保留或删除
    const descriptionsToKeep = []
    media.descriptions.forEach((desc) => {
      const id = normalizeId(desc._id)
      if (newDescMap.has(id)) {
        // 如果在新描述中存在，更新文本
        const newText = newDescMap.get(id)
        if (desc.text !== newText) {
          desc.text = newText
        }
        descriptionsToKeep.push(desc)
        newDescMap.delete(id) // 从映射中移除，表示已处理
      }
      // 如果不在新描述中，则会被删除（不添加到 descriptionsToKeep）
    })

    // 设置新的描述数组：保留的描述 + 新添加的描述
    media.descriptions = [...descriptionsToKeep, ...descriptionsToAdd]

    await media.save()
    return media
  } catch (error) {
    console.error('Error saving descriptions:', error)
    throw new Error('Error saving descriptions: ' + error.message)
  }
}

// 批量添加描述（追加到现有描述后面，不覆盖）
// items: [{ id: 'mediaId', texts: ['描述1', '描述2'] }, ...]
const batchAddDescription = async (items) => {
  try {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and cannot be empty')
    }

    const results = []
    const errors = []

    for (const item of items) {
      try {
        const { id, texts } = item
        if (!id) {
          errors.push({
            id: id || 'unknown',
            error: 'Media ID is required'
          })
          continue
        }

        if (!Array.isArray(texts) || texts.length === 0) {
          errors.push({
            id,
            error: 'Description texts array is required and cannot be empty'
          })
          continue
        }

        const media = await MediaModel.findById(id)
        if (!media) {
          errors.push({
            id,
            error: 'Media item not found'
          })
          continue
        }

        // 过滤并处理新描述文本
        const newDescriptions = texts
          .filter((text) => text && text.trim())
          .map((text) => ({
            text: text.trim(),
            createdAt: new Date()
          }))
          // 去重：检查是否已存在相同描述
          .filter((newDesc) => {
            return !media.descriptions.some((existingDesc) => existingDesc.text === newDesc.text)
          })

        // 批量追加新描述
        if (newDescriptions.length > 0) {
          media.descriptions.push(...newDescriptions)
          await media.save()
        }

        results.push({
          id,
          success: true,
          addedCount: newDescriptions.length
        })
      } catch (error) {
        errors.push({
          id: item.id || 'unknown',
          error: error.message
        })
      }
    }

    return {
      success: results,
      failed: errors,
      total: items.length,
      successCount: results.length,
      failCount: errors.length
    }
  } catch (error) {
    console.error('Error batch adding descriptions:', error)
    throw new Error('Error batch adding descriptions: ' + error.message)
  }
}

// 批量保存描述（一次性处理多个文件的描述保存）
// items: [{ id: 'mediaId', descriptions: [{ _id?: 'descriptionId', text: '描述文本' }, ...] }, ...]
const batchSaveDescriptions = async (items) => {
  try {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and cannot be empty')
    }

    const results = []
    const errors = []

    for (const item of items) {
      try {
        const { id, descriptions } = item
        if (!id) {
          errors.push({
            id: id || 'unknown',
            error: 'Media ID is required'
          })
          continue
        }

        if (!Array.isArray(descriptions)) {
          errors.push({
            id,
            error: 'Descriptions must be an array'
          })
          continue
        }

        const updatedMedia = await saveDescriptions(id, descriptions)
        results.push({
          id,
          success: true,
          media: updatedMedia
        })
      } catch (error) {
        errors.push({
          id: item.id || 'unknown',
          error: error.message
        })
      }
    }

    return {
      success: results,
      failed: errors,
      total: items.length,
      successCount: results.length,
      failCount: errors.length
    }
  } catch (error) {
    console.error('Error batch saving descriptions:', error)
    throw new Error('Error batch saving descriptions: ' + error.message)
  }
}

// 批量创建媒体记录
// items: [{ type, url, filename, size, mimetype, descriptions }, ...]
const batchCreate = async (items) => {
  try {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and cannot be empty')
    }

    const results = []
    const errors = []

    for (const item of items) {
      try {
        const { type, url, filename, size, mimetype, descriptions = [] } = item

        if (!type || !url) {
          errors.push({
            url: url || 'unknown',
            error: 'Type and URL are required'
          })
          continue
        }

        // 验证文件类型是否有效（现在支持所有文件类型）
        const { isValidMediaType } = require('../config/mediaType')
        if (!isValidMediaType(type)) {
          errors.push({
            url,
            error: `Invalid file type: ${type}. Supported types: image, video, document, archive, text, other`
          })
          continue
        }

        const mediaData = {
          type,
          url,
          filename: filename || '',
          size: size || 0,
          mimetype: mimetype || '',
          descriptions: descriptions.map((text) => ({ text }))
        }

        // 使用统一的 create 函数，内部会处理重复检查和更新逻辑
        const media = await create(mediaData)

        // 判断是否是新创建的记录
        const now = Date.now()
        const createdAt = new Date(media.createdAt || now).getTime()
        const isNew = now - createdAt < 2000 // 2秒内认为是新创建的

        results.push({
          url,
          success: true,
          media: media,
          isExisting: !isNew
        })
      } catch (error) {
        errors.push({
          url: item.url || 'unknown',
          error: error.message
        })
      }
    }

    return {
      success: results,
      failed: errors,
      total: items.length,
      successCount: results.length,
      failCount: errors.length
    }
  } catch (error) {
    console.error('Error batch creating media items:', error)
    throw new Error('Error batch creating media items: ' + error.message)
  }
}

module.exports = {
  create,
  find,
  count,
  findById,
  findByUrl,
  update,
  remove,
  addDescription,
  removeDescription,
  updateDescription,
  saveDescriptions,
  batchAddDescription,
  batchSaveDescriptions,
  batchCreate
}

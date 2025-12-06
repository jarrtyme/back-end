const PageModel = require('../models/pageModel.js')

/**
 * 统一处理组件数据，确保所有组件都有 link 字段
 * @param {Array} components - 组件数组
 * @returns {Array} 处理后的组件数组
 */
function normalizeComponents(components) {
  if (!components || !Array.isArray(components)) {
    return []
  }
  return components.map((component) => {
    // 确保 link 字段存在，如果不存在或为 null/undefined，设置为空字符串
    if (component.link === undefined || component.link === null) {
      component.link = ''
    }
    return component
  })
}

// 创建页面
const create = async (data) => {
  try {
    const page = await PageModel.create(data)
    return page
  } catch (error) {
    console.error('Error creating page:', error)
    throw new Error('Error creating page: ' + error.message)
  }
}

// 查询页面列表（支持分页和条件查询）
const find = async (query = {}, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit
    const docs = await PageModel.find(query)
      .populate('componentIds', '_id name displayType isActive') // 填充组件信息，包含 _id 以确保格式一致
      .skip(skip)
      .limit(limit)
      .sort({ order: 1, createdAt: -1 }) // 按排序顺序和创建时间排序
      .lean() // 返回纯对象，提高性能
      .maxTimeMS(30000) // 30秒超时
      .exec()
    return docs
  } catch (error) {
    console.error('Error finding pages:', error)
    throw new Error('Error finding pages')
  }
}

// 获取总数
const count = async (query = {}) => {
  try {
    return await PageModel.countDocuments(query)
      .maxTimeMS(30000) // 30秒超时
      .exec()
  } catch (error) {
    console.error('Error counting pages:', error)
    throw new Error('Error counting pages')
  }
}

// 根据ID查询单个页面
const findById = async (id) => {
  try {
    const doc = await PageModel.findById(id)
      .populate('componentIds') // 填充完整组件信息
      .lean() // 返回纯对象，与 find 保持一致

    // 统一处理组件数据，确保所有组件都有 link 字段
    if (doc && doc.componentIds) {
      doc.componentIds = normalizeComponents(doc.componentIds)
    }

    return doc
  } catch (error) {
    console.error('Error finding page by ID:', error)
    throw new Error('Error finding page by ID')
  }
}

// 更新页面信息
const update = async (pageId, updateFields) => {
  try {
    const updatedPage = await PageModel.findByIdAndUpdate(
      pageId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate('componentIds') // 填充完整组件信息
      .lean() // 返回纯对象，与其他方法保持一致

    // 统一处理组件数据，确保所有组件都有 link 字段
    if (updatedPage && updatedPage.componentIds) {
      updatedPage.componentIds = normalizeComponents(updatedPage.componentIds)
    }

    return updatedPage
  } catch (error) {
    throw new Error('Error updating page: ' + error.message)
  }
}

// 删除页面（支持单个和批量）
const remove = async (id) => {
  try {
    const deletedDoc = await PageModel.findByIdAndDelete(id)
    return deletedDoc
  } catch (error) {
    console.error('Error deleting page:', error)
    throw error
  }
}

// 批量删除页面
const batchRemove = async (ids) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('IDs array is required and cannot be empty')
    }

    const results = []
    const errors = []

    for (const id of ids) {
      try {
        const deletedDoc = await remove(id)
        if (deletedDoc) {
          results.push({
            id,
            success: true
          })
        } else {
          errors.push({
            id,
            error: 'Page not found'
          })
        }
      } catch (error) {
        errors.push({
          id,
          error: error.message
        })
      }
    }

    return {
      success: results,
      failed: errors,
      total: ids.length,
      successCount: results.length,
      failCount: errors.length
    }
  } catch (error) {
    console.error('Error batch deleting pages:', error)
    throw new Error('Error batch deleting pages: ' + error.message)
  }
}

// 查询已发布的页面（公开访问，无需鉴权）
const findPublic = async (query = {}, page = 1, limit = 10) => {
  try {
    const publicQuery = {
      ...query,
      isPublished: true,
      isActive: true
    }
    const skip = (page - 1) * limit
    const docs = await PageModel.find(publicQuery)
      .populate('componentIds') // 填充完整组件信息
      .skip(skip)
      .limit(limit)
      .sort({ order: 1, createdAt: -1 })
      .lean()
      .maxTimeMS(30000)
      .exec()

    // 统一处理组件数据，确保所有组件都有 link 字段
    docs.forEach((doc) => {
      if (doc && doc.componentIds) {
        doc.componentIds = normalizeComponents(doc.componentIds)
      }
    })

    return docs
  } catch (error) {
    console.error('Error finding public pages:', error)
    throw new Error('Error finding public pages')
  }
}

// 根据ID查询单个已发布的页面（公开访问，无需鉴权）
const findPublicById = async (id) => {
  try {
    const doc = await PageModel.findOne({
      _id: id,
      isPublished: true,
      isActive: true
    })
      .populate('componentIds') // 填充完整组件信息
      .lean()

    // 统一处理组件数据，确保所有组件都有 link 字段
    if (doc && doc.componentIds) {
      doc.componentIds = normalizeComponents(doc.componentIds)
    }

    return doc
  } catch (error) {
    console.error('Error finding public page by ID:', error)
    throw new Error('Error finding public page by ID')
  }
}

module.exports = {
  create,
  find,
  count,
  findById,
  update,
  remove,
  batchRemove,
  findPublic,
  findPublicById
}

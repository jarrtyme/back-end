const PageComponentModel = require('../models/pageComponentModel.js')
const PageModel = require('../models/pageModel.js')

// 创建页面组件
const create = async (data) => {
  try {
    // 检查名称是否已存在
    if (data.name) {
      const existingComponent = await PageComponentModel.findOne({
        name: data.name.trim()
      })
      if (existingComponent) {
        throw new Error('组件名称已存在，请使用其他名称')
      }
    }

    const pageComponent = await PageComponentModel.create(data)
    return pageComponent
  } catch (error) {
    // 如果是唯一索引冲突错误，返回友好提示
    if (error.code === 11000 || error.message.includes('duplicate key')) {
      throw new Error('组件名称已存在，请使用其他名称')
    }
    console.error('Error creating page component:', error)
    throw new Error('Error creating page component: ' + error.message)
  }
}

// 查询页面组件列表（支持分页和条件查询）
const find = async (query = {}, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit
    const docs = await PageComponentModel.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ order: 1, createdAt: -1 }) // 按排序顺序和创建时间排序
      .lean() // 返回纯对象，提高性能
      .maxTimeMS(30000) // 30秒超时
      .exec()
    return docs
  } catch (error) {
    console.error('Error finding page components:', error)
    throw new Error('Error finding page components')
  }
}

// 获取总数
const count = async (query = {}) => {
  try {
    return await PageComponentModel.countDocuments(query)
      .maxTimeMS(30000) // 30秒超时
      .exec()
  } catch (error) {
    console.error('Error counting page components:', error)
    throw new Error('Error counting page components')
  }
}

// 根据ID查询单个页面组件
const findById = async (id) => {
  try {
    // 注意：Mongoose 的 populate 不支持直接填充嵌套数组中的引用
    // 由于 media 对象中已冗余存储了 url、type、filename 等信息，通常不需要 populate mediaId
    // 如果需要完整的 media 信息，可以在业务层单独查询 Media 集合
    const doc = await PageComponentModel.findById(id).lean()
    return doc
  } catch (error) {
    console.error('Error finding page component by ID:', error)
    throw new Error('Error finding page component by ID')
  }
}

// 更新页面组件信息
const update = async (componentId, updateFields) => {
  try {
    // 如果更新了名称，检查名称是否与其他组件重复
    if (updateFields.name) {
      const trimmedName = updateFields.name.trim()
      const existingComponent = await PageComponentModel.findOne({
        name: trimmedName,
        _id: { $ne: componentId } // 排除当前组件自身
      })
      if (existingComponent) {
        throw new Error('组件名称已存在，请使用其他名称')
      }
      updateFields.name = trimmedName
    }

    const updatedComponent = await PageComponentModel.findByIdAndUpdate(
      componentId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
    return updatedComponent
  } catch (error) {
    // 如果是唯一索引冲突错误，返回友好提示
    if (error.code === 11000 || error.message.includes('duplicate key')) {
      throw new Error('组件名称已存在，请使用其他名称')
    }
    throw new Error('Error updating page component: ' + error.message)
  }
}

// 删除页面组件（支持单个和批量）
const remove = async (id) => {
  try {
    // 检查是否有页面正在使用该组件
    const pagesUsingComponent = await PageModel.find({
      componentIds: id
    })
      .select('_id name')
      .lean()

    if (pagesUsingComponent.length > 0) {
      const pageNames = pagesUsingComponent.map((p) => p.name).join('、')
      throw new Error(
        `无法删除组件：该组件正在被以下页面使用：${pageNames}。请先移除页面中的组件引用。`
      )
    }

    const deletedDoc = await PageComponentModel.findByIdAndDelete(id)
    return deletedDoc
  } catch (error) {
    console.error('Error deleting page component:', error)
    throw error
  }
}

// 批量删除页面组件
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
            error: 'Page component not found'
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
    console.error('Error batch deleting page components:', error)
    throw new Error('Error batch deleting page components: ' + error.message)
  }
}

// 根据ID数组批量查询已启用的页面组件（公开访问，无需鉴权）
const findPublicByIds = async (ids) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return []
    }

    // 查询已启用且ID在数组中的组件
    const docs = await PageComponentModel.find({
      _id: { $in: ids },
      isActive: true
    })
      .lean()
      .maxTimeMS(30000)
      .exec()

    // 按照输入ID的顺序排序，保持顺序一致性
    const componentMap = new Map()
    docs.forEach((doc) => {
      componentMap.set(String(doc._id), doc)
    })

    // 按照输入的ID顺序返回组件数组
    const orderedComponents = []
    ids.forEach((id) => {
      const idStr = String(id)
      if (componentMap.has(idStr)) {
        orderedComponents.push(componentMap.get(idStr))
      }
    })

    return orderedComponents
  } catch (error) {
    console.error('Error finding public page components by IDs:', error)
    throw new Error('Error finding public page components by IDs')
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
  findPublicByIds
}

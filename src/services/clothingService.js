const ClothingModel = require('../models/clothingModel.js')
const PageModel = require('../models/pageModel.js')

// 创建服装记录
const create = async (data) => {
  try {
    const savedDoc = await ClothingModel.create(data)
    return savedDoc
  } catch (error) {
    console.error('Error creating clothing item:', error)
    throw error
  }
}

// 查询服装列表（支持分页和条件查询）
const find = async (query, page = 1, limit = 10, populateComponents = false) => {
  try {
    const pageNum = Math.max(1, parseInt(page, 10))
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10))) // 限制最大每页100条
    const skip = (pageNum - 1) * limitNum

    let queryBuilder = ClothingModel.find(query).skip(skip).limit(limitNum).sort({ createdAt: -1 })

    // 如果需要填充页面信息
    if (populateComponents) {
      queryBuilder = queryBuilder.populate(
        'pageId',
        'name description isActive isPublished componentIds order'
      )
    }

    // 先获取总数，再查询数据（优化性能）
    const [docs, total] = await Promise.all([
      queryBuilder.exec(),
      ClothingModel.countDocuments(query)
    ])

    return {
      list: docs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }
  } catch (error) {
    console.error('Error finding clothing items:', error)
    throw new Error('Error finding clothing items')
  }
}

// 根据ID查询单个服装
const findById = async (id, populateComponents = false) => {
  try {
    let queryBuilder = ClothingModel.findById(id)

    // 如果需要填充页面信息
    if (populateComponents) {
      queryBuilder = queryBuilder.populate(
        'pageId',
        'name description isActive isPublished componentIds order'
      )
    }

    const doc = await queryBuilder.exec()
    return doc
  } catch (error) {
    console.error('Error finding clothing item by ID:', error)
    throw new Error('Error finding clothing item by ID')
  }
}

// 更新服装信息
const update = async (clothingId, updateFields) => {
  try {
    // 如果更新货号，检查新货号是否已被其他记录使用
    if (updateFields.itemNumber) {
      const existingClothing = await ClothingModel.findOne({
        itemNumber: updateFields.itemNumber,
        _id: { $ne: clothingId } // 排除当前记录
      })
      if (existingClothing) {
        throw new Error('货号已存在，请使用其他货号')
      }
    }

    const updatedClothing = await ClothingModel.findByIdAndUpdate(
      clothingId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
    return updatedClothing
  } catch (error) {
    // 如果是我们自定义的错误，直接抛出
    if (error.message.includes('货号已存在')) {
      throw error
    }
    // MongoDB唯一性约束错误
    if (error.code === 11000 || error.message?.includes('duplicate key')) {
      throw new Error('货号已存在，请使用其他货号')
    }
    throw new Error('Error updating clothing item: ' + error.message)
  }
}

// 删除服装记录
const remove = async (id) => {
  try {
    const deletedDoc = await ClothingModel.findByIdAndDelete(id)
    return deletedDoc
  } catch (error) {
    console.error('Error deleting clothing item:', error)
    throw error
  }
}

// 补货功能
const restock = async (id, quantity) => {
  try {
    const clothing = await ClothingModel.findById(id)
    if (!clothing) {
      throw new Error('Clothing item not found')
    }

    // 更新补货数量和剩余数量
    const updatedClothing = await ClothingModel.findByIdAndUpdate(
      id,
      {
        $inc: {
          restockQuantity: quantity,
          remainingQuantity: quantity
        }
      },
      { new: true, runValidators: true }
    )

    return updatedClothing
  } catch (error) {
    console.error('Error restocking clothing item:', error)
    throw new Error('Error restocking clothing item: ' + error.message)
  }
}

// 获取库存统计
const getInventoryStats = async () => {
  try {
    const stats = await ClothingModel.aggregate([
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalPurchaseQuantity: { $sum: '$purchaseQuantity' },
          totalRemainingQuantity: { $sum: '$remainingQuantity' },
          totalSoldQuantity: { $sum: '$soldQuantity' },
          totalProfit: { $sum: '$profit' },
          totalRevenue: { $sum: { $multiply: ['$sellingPrice', '$soldQuantity'] } },
          totalCost: {
            $sum: {
              $multiply: ['$purchasePrice', { $add: ['$purchaseQuantity', '$restockQuantity'] }]
            }
          }
        }
      }
    ])

    return (
      stats[0] || {
        totalItems: 0,
        totalPurchaseQuantity: 0,
        totalRemainingQuantity: 0,
        totalSoldQuantity: 0,
        totalProfit: 0,
        totalRevenue: 0,
        totalCost: 0
      }
    )
  } catch (error) {
    console.error('Error getting inventory stats:', error)
    throw new Error('Error getting inventory stats')
  }
}

// 绑定页面到服装（只能绑定一个）
const bindPage = async (clothingId, pageId) => {
  try {
    if (!pageId) {
      throw new Error('Page ID is required')
    }

    // 验证服装是否存在
    const clothing = await ClothingModel.findById(clothingId)
    if (!clothing) {
      throw new Error('Clothing item not found')
    }

    // 验证页面是否存在
    const validPage = await PageModel.findById(pageId).select('_id')
    if (!validPage) {
      throw new Error('Invalid page ID')
    }

    // 更新绑定的页面ID
    const updatedClothing = await ClothingModel.findByIdAndUpdate(
      clothingId,
      { $set: { pageId: pageId } },
      { new: true, runValidators: true }
    )

    return updatedClothing
  } catch (error) {
    console.error('Error binding page:', error)
    throw new Error('Error binding page: ' + error.message)
  }
}

// 解绑页面
const unbindPage = async (clothingId) => {
  try {
    // 验证服装是否存在
    const clothing = await ClothingModel.findById(clothingId)
    if (!clothing) {
      throw new Error('Clothing item not found')
    }

    // 移除绑定的页面ID
    const updatedClothing = await ClothingModel.findByIdAndUpdate(
      clothingId,
      { $set: { pageId: null } },
      { new: true, runValidators: true }
    )

    return updatedClothing
  } catch (error) {
    console.error('Error unbinding page:', error)
    throw new Error('Error unbinding page: ' + error.message)
  }
}

// 获取服装绑定的页面
const getBoundPage = async (clothingId) => {
  try {
    const clothing = await ClothingModel.findById(clothingId)
      .populate('pageId', 'name description isActive isPublished componentIds order')
      .select('pageId')
      .lean()

    if (!clothing) {
      throw new Error('Clothing item not found')
    }

    return clothing.pageId || null
  } catch (error) {
    console.error('Error getting bound page:', error)
    throw new Error('Error getting bound page: ' + error.message)
  }
}

// 获取公开的服装详情（不包含敏感信息，如库存、成本等）
const getPublicDetail = async (clothingId) => {
  try {
    const clothing = await ClothingModel.findById(clothingId)
      .populate('pageId', 'name description isActive isPublished componentIds order')
      .select(
        'itemNumber imageUrl purchasePrice sellingPrice lengthOrWaist bustOrInseam pageId createdAt updatedAt'
      )
      .lean()

    if (!clothing) {
      throw new Error('Clothing item not found')
    }

    // 只返回公开信息，不包含库存、成本等敏感信息
    return {
      _id: clothing._id,
      itemNumber: clothing.itemNumber,
      imageUrl: clothing.imageUrl,
      sellingPrice: clothing.sellingPrice,
      purchasePrice: clothing.purchasePrice, // 保留进货价，前端可以显示原价对比
      lengthOrWaist: clothing.lengthOrWaist,
      bustOrInseam: clothing.bustOrInseam,
      pageId: clothing.pageId || null, // 返回绑定的页面信息
      createdAt: clothing.createdAt,
      updatedAt: clothing.updatedAt
    }
  } catch (error) {
    console.error('Error getting public clothing detail:', error)
    throw new Error('Error getting public clothing detail: ' + error.message)
  }
}

module.exports = {
  create,
  find,
  findById,
  update,
  remove,
  restock,
  getInventoryStats,
  bindPage,
  unbindPage,
  getBoundPage,
  getPublicDetail
}

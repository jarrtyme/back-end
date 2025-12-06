const express = require('express')
const router = express.Router()

const ClothingService = require('../services/clothingService')
const { authenticateToken, refreshTokenIfNeeded } = require('../middlewares/authMiddleware')

// 公开接口：获取服装详情（不需要登录）
router.post('/getPublicDetail', async (req, res) => {
  try {
    const { id } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    const clothingDetail = await ClothingService.getPublicDetail(id)
    res.success(clothingDetail, 'Public clothing detail retrieved successfully')
  } catch (error) {
    console.error('Error getting public clothing detail:', error)
    res.error(error.message || 'Error getting public clothing detail', 500)
  }
})

// 所有服装管理路由都需要鉴权，并支持无感刷新 token
router.use(authenticateToken)
router.use(refreshTokenIfNeeded)

// 创建服装入库记录
router.post('/create', async (req, res) => {
  try {
    const newClothing = await ClothingService.create(req.body)
    res.success(newClothing, 'Clothing item created successfully')
  } catch (error) {
    console.error('Error creating clothing item:', error)
    // 处理货号唯一性约束错误
    if (
      error.code === 11000 ||
      error.message?.includes('duplicate key') ||
      error.message?.includes('货号已存在')
    ) {
      return res.error('货号已存在，请使用其他货号', 400)
    }
    res.error(error.message || 'Failed to create clothing item', 500)
  }
})

// 查询服装列表（支持分页和条件查询）
router.post('/find', async (req, res) => {
  const { page = 1, limit = 10, ...query } = req.body
  try {
    const result = await ClothingService.find(query, page, limit)
    res.success(result, 'Clothing items retrieved successfully')
  } catch (error) {
    console.error('Error finding clothing items:', error)
    res.error('Error finding clothing items', 500)
  }
})

// 根据ID查询单个服装
router.post('/findById', async (req, res) => {
  try {
    const { id } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    const clothingItem = await ClothingService.findById(id)
    if (!clothingItem) {
      return res.error('Clothing item not found', 404)
    }

    res.success(clothingItem, 'Clothing item retrieved successfully')
  } catch (error) {
    console.error('Error finding clothing item by ID:', error)
    res.error('Error finding clothing item by ID', 500)
  }
})

// 更新服装信息
router.post('/update', async (req, res) => {
  try {
    const { id, ...updateFields } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    const updatedClothing = await ClothingService.update(id, updateFields)
    if (!updatedClothing) {
      return res.error('Clothing item not found', 404)
    }

    res.success(updatedClothing, 'Clothing item updated successfully')
  } catch (error) {
    console.error('Error updating clothing item:', error)
    // 处理货号唯一性约束错误
    if (error.code === 11000 || error.message?.includes('duplicate key')) {
      return res.error('货号已存在，请使用其他货号', 400)
    }
    res.error(error.message || 'Failed to update clothing item', 500)
  }
})

// 删除服装记录
router.post('/remove', async (req, res) => {
  try {
    const { id } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    const deletedClothing = await ClothingService.remove(id)
    if (!deletedClothing) {
      return res.error('Clothing item not found', 404)
    }

    res.success(deletedClothing, 'Clothing item deleted successfully')
  } catch (error) {
    console.error('Error deleting clothing item:', error)
    res.error('Failed to delete clothing item', 500)
  }
})

// 补货操作
router.post('/restock', async (req, res) => {
  try {
    const { id, quantity } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }
    if (!quantity || quantity <= 0) {
      return res.error('Valid quantity is required', 400)
    }

    const restockedClothing = await ClothingService.restock(id, quantity)
    res.success(restockedClothing, 'Clothing item restocked successfully')
  } catch (error) {
    console.error('Error restocking clothing item:', error)
    res.error('Failed to restock clothing item', 500)
  }
})

// 获取库存统计
router.post('/stats', async (req, res) => {
  try {
    const stats = await ClothingService.getInventoryStats()
    res.success(stats, 'Inventory statistics retrieved successfully')
  } catch (error) {
    console.error('Error getting inventory stats:', error)
    res.error('Error getting inventory statistics', 500)
  }
})

// 绑定页面到服装（只能绑定一个）
router.post('/bindPage', async (req, res) => {
  try {
    const { id, pageId } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }
    if (!pageId) {
      return res.error('Page ID is required', 400)
    }

    const updatedClothing = await ClothingService.bindPage(id, pageId)
    if (!updatedClothing) {
      return res.error('Clothing item not found', 404)
    }

    res.success(updatedClothing, 'Page bound successfully')
  } catch (error) {
    console.error('Error binding page:', error)
    res.error(error.message || 'Failed to bind page', 500)
  }
})

// 解绑页面
router.post('/unbindPage', async (req, res) => {
  try {
    const { id } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    const updatedClothing = await ClothingService.unbindPage(id)
    if (!updatedClothing) {
      return res.error('Clothing item not found', 404)
    }

    res.success(updatedClothing, 'Page unbound successfully')
  } catch (error) {
    console.error('Error unbinding page:', error)
    res.error(error.message || 'Failed to unbind page', 500)
  }
})

// 获取服装绑定的页面（查询接口）
router.post('/getBoundPage', async (req, res) => {
  try {
    const { id } = req.body
    if (!id) {
      return res.error('ID is required', 400)
    }

    const page = await ClothingService.getBoundPage(id)
    res.success(page, 'Bound page retrieved successfully')
  } catch (error) {
    console.error('Error getting bound page:', error)
    res.error(error.message || 'Error getting bound page', 500)
  }
})

module.exports = router

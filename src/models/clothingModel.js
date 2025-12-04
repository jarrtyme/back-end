const mongoose = require('mongoose')

/**
 * 服装数据模型
 *
 * 该模型用于管理服装商品的完整生命周期，包括：
 * - 商品基本信息（货号、图片、价格等）
 * - 库存管理（进货、补货、剩余数量）
 * - 销售统计（售卖件数、利润计算）
 * - 成本控制（运费、退货运费）
 *
 * 自动计算功能：
 * - 售卖件数 = 进货件数 + 补货件数 - 剩余件数
 * - 利润 = (售卖价 × 售卖件数) - (进货价 × 总进货件数) - 运费 - 退货运费
 */
const ClothingSchema = new mongoose.Schema({
  itemNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  }, // 货号 - 商品的唯一标识符
  imageUrl: {
    type: String,
    default: ''
  }, // 图片地址 - 商品图片的URL链接
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  }, // 进货价 - 商品采购成本，必须大于等于0
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  }, // 售卖价 - 商品销售价格，必须大于等于0
  lengthOrWaist: {
    type: Number,
    default: 0
  }, // 衣长/腰围 - 服装尺寸信息（上衣为衣长，下装为腰围）
  bustOrInseam: {
    type: Number,
    default: 0
  }, // 胸围/内长 - 服装尺寸信息（上衣为胸围，下装为内长）
  purchaseQuantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  }, // 进货件数 - 初始采购的商品数量
  remainingQuantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  }, // 剩余件数 - 当前库存数量
  restockQuantity: {
    type: Number,
    default: 0,
    min: 0
  }, // 补货件数 - 后续补货的数量
  shippingCost: {
    type: Number,
    default: 0,
    min: 0
  }, // 运费 - 商品运输成本
  returnCost: {
    type: Number,
    default: 0,
    min: 0
  }, // 退货运费 - 退货产生的运输成本
  soldQuantity: {
    type: Number,
    default: 0,
    min: 0
  }, // 售卖件数 - 已售出的商品数量（自动计算）
  profit: {
    type: Number,
    default: 0
  }, // 利润 - 商品销售利润（自动计算）
  pageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Page',
    default: null
  }, // 绑定的页面ID - 用于页面展示该服装时使用（只能绑定一个页面）
  createdAt: {
    type: Date,
    default: Date.now
  }, // 创建时间 - 记录创建时间戳
  updatedAt: {
    type: Date,
    default: Date.now
  } // 更新时间 - 记录最后修改时间戳
})

/**
 * 保存前中间件：自动计算售卖件数和利润
 *
 * 在保存文档前自动执行以下计算：
 * 1. 更新修改时间
 * 2. 计算售卖件数 = 进货件数 + 补货件数 - 剩余件数
 * 3. 计算利润 = 总收入 - 总成本 - 运费 - 退货运费
 *    - 总收入 = 售卖价 × 售卖件数
 *    - 总成本 = 进货价 × (进货件数 + 补货件数)
 */
ClothingSchema.pre('save', function (next) {
  // 更新修改时间
  this.updatedAt = new Date()

  // 计算售卖件数：总进货量减去剩余库存
  this.soldQuantity = this.purchaseQuantity + this.restockQuantity - this.remainingQuantity

  // 计算利润
  const totalRevenue = this.sellingPrice * this.soldQuantity // 总收入
  const totalCost = this.purchasePrice * (this.purchaseQuantity + this.restockQuantity) // 总成本
  this.profit = totalRevenue - totalCost - this.shippingCost - this.returnCost // 净利润

  next()
})

/**
 * 更新前中间件：自动更新修改时间
 *
 * 在使用 findOneAndUpdate 方法更新文档时，
 * 自动设置 updatedAt 字段为当前时间
 */
ClothingSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() })
  next()
})

// 创建 Mongoose 模型实例
const ClothingModel = mongoose.model('Clothing', ClothingSchema)

// 导出模型供其他模块使用
module.exports = ClothingModel

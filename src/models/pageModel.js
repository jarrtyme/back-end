const mongoose = require('mongoose')

/**
 * 页面数据模型
 *
 * 用于管理网站页面配置
 * - 每个页面包含多个组件（通过组件ID引用）
 * - 支持页面名称、路由路径、描述等
 */
const PageSchema = new mongoose.Schema({
  // 页面名称
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, '页面名称最多100个字符']
  },
  // 路由路径（已废弃，保留字段以兼容旧数据）
  // 注意：此字段不应有唯一索引，因为允许为 null，多个 null 值会违反唯一性约束
  path: {
    type: String,
    required: false,
    trim: true,
    // 明确不设置唯一索引，避免多个 null 值冲突
    // 如果数据库中存在 path_1 唯一索引，需要通过迁移脚本删除
    index: false
  },
  // 页面描述
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: [500, '页面描述最多500个字符']
  },
  // 组件ID列表（引用 PageComponent）
  componentIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'PageComponent',
    default: []
  },
  // 排序顺序
  order: {
    type: Number,
    default: 0
  },
  // 是否启用
  isActive: {
    type: Boolean,
    default: true
  },
  // 是否发布（已发布的页面可以对外访问）
  isPublished: {
    type: Boolean,
    default: false
  },
  // 创建时间
  createdAt: {
    type: Date,
    default: Date.now
  },
  // 更新时间
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

// 保存前中间件：自动更新修改时间
PageSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

// 更新前中间件：自动更新修改时间
PageSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() })
  next()
})

// 添加索引以优化查询性能
PageSchema.index({ isActive: 1, isPublished: 1, order: 1 }) // 复合索引
PageSchema.index({ createdAt: -1 }) // 创建时间索引

// 创建 Mongoose 模型实例
const PageModel = mongoose.model('Page', PageSchema)

// 导出模型供其他模块使用
module.exports = PageModel

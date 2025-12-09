const mongoose = require('mongoose')
const { MEDIA_TYPE_VALUES, DEFAULT_MEDIA_TYPE } = require('../config/mediaType')

/**
 * 媒体库数据模型
 *
 * 用于管理所有类型的文件资源，以及对应的描述信息
 * - 支持所有文件类型：image, video, document, archive, text, other
 * - 每个文件可以有多个描述（数组）
 * - 描述可以动态添加和删除
 */
const MediaSchema = new mongoose.Schema({
  // 文件类型：'image', 'video', 'document', 'archive', 'text', 'other'
  type: {
    type: String,
    required: true,
    enum: MEDIA_TYPE_VALUES,
    default: DEFAULT_MEDIA_TYPE,
    trim: true
  },
  // 媒体文件URL
  url: {
    type: String,
    required: true,
    trim: true
  },
  // 原始文件名
  filename: {
    type: String,
    default: ''
  },
  // 文件大小（字节）
  size: {
    type: Number,
    default: 0
  },
  // MIME类型
  mimetype: {
    type: String,
    default: ''
  },
  // 描述数组 - 可以添加多个描述
  descriptions: {
    type: [
      {
        text: {
          type: String,
          required: true,
          trim: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    default: []
  },
  // 是否已添加到媒体库（标记媒体源是否已经在媒体库中）
  isAddedToLibrary: {
    type: Boolean,
    default: true // 默认已添加，因为创建时就是添加到媒体库
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
MediaSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

// 更新前中间件：自动更新修改时间
MediaSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() })
  next()
})

// 添加索引以优化查询性能
MediaSchema.index({ type: 1, createdAt: -1 }) // 复合索引：按类型和创建时间排序（最常用）
MediaSchema.index({ 'descriptions.text': 1 }) // 描述文本索引：用于描述搜索（正则查询）
MediaSchema.index({ url: 1 }, { unique: true }) // URL索引：用于URL查找，唯一索引
MediaSchema.index({ createdAt: -1 }) // 创建时间索引：用于排序

// 创建 Mongoose 模型实例
const MediaModel = mongoose.model('Media', MediaSchema)

// 导出模型供其他模块使用
module.exports = MediaModel

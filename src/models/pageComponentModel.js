const mongoose = require('mongoose')
const {
  DISPLAY_TYPE_VALUES,
  DEFAULT_DISPLAY_TYPE,
  DISPLAY_TYPES
} = require('../config/displayType')
const { MEDIA_TYPE_VALUES, DEFAULT_MEDIA_TYPE } = require('../config/mediaType')

const MEDIA_OPTIONAL_TYPES = [DISPLAY_TYPES.HEADER, DISPLAY_TYPES.FOOTER]

const isMediaRequiredForComponent = function () {
  const ownerComponent = typeof this.ownerDocument === 'function' ? this.ownerDocument() : null
  const displayType = ownerComponent?.displayType
  return !MEDIA_OPTIONAL_TYPES.includes(displayType)
}

/**
 * 页面组件数据模型
 *
 * 用于管理网站装修页面的组件配置
 * - 每个组件包含多个项目（items）
 * - 每个项目包含媒体（图片/视频）和多个文字描述
 * - 支持不同的展示类型（轮播图、网格、列表等）
 */
const PageComponentSchema = new mongoose.Schema({
  // 组件名称
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, '组件名称最多100个字符']
  },
  // 展示类型：'carousel', 'grid', 'list', 'scroll-snap', 'seamless', 'video' 等
  displayType: {
    type: String,
    required: true,
    enum: DISPLAY_TYPE_VALUES,
    default: DEFAULT_DISPLAY_TYPE,
    trim: true
  },
  // 组件项数组
  items: {
    type: [
      {
        // 媒体信息（从媒体库选择）
        media: {
          // 媒体ID（关联到媒体库）
          mediaId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Media',
            default: null
          },
          // 媒体URL（冗余存储，方便查询）
          url: {
            type: String,
            trim: true,
            validate: {
              validator: function (value) {
                if (!isMediaRequiredForComponent.call(this)) {
                  return true
                }
                return typeof value === 'string' && value.length > 0
              },
              message: '该组件类型的媒体 URL 不能为空'
            }
          },
          // 媒体类型：'image' 或 'video'
          type: {
            type: String,
            enum: MEDIA_TYPE_VALUES,
            default: DEFAULT_MEDIA_TYPE,
            trim: true,
            validate: {
              validator: function (value) {
                if (!isMediaRequiredForComponent.call(this)) {
                  return true
                }
                return Boolean(value)
              },
              message: '该组件类型的媒体类型不能为空'
            }
          },
          // 文件名（可选）
          filename: {
            type: String,
            default: '',
            trim: true
          }
        },
        // 文字描述数组
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
        }
      }
    ],
    default: []
  },
  // 组件跳转链接（可选）
  link: {
    type: String,
    trim: true,
    default: ''
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
  // 滚动快照宽度模式：'wide'（宽模式，最大720px）或 'narrow'（窄模式，最大480px）
  // 仅当 displayType 为 'scroll-snap' 时有效
  widthMode: {
    type: String,
    enum: ['wide', 'narrow'],
    default: 'wide',
    trim: true
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
PageComponentSchema.pre('save', function (next) {
  this.updatedAt = new Date()
  next()
})

// 更新前中间件：自动更新修改时间
PageComponentSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() })
  next()
})

// 添加索引以优化查询性能
PageComponentSchema.index({ isActive: 1, order: 1 }) // 复合索引：按启用状态和排序顺序
PageComponentSchema.index({ createdAt: -1 }) // 创建时间索引：用于排序
PageComponentSchema.index({ name: 1 }) // 名称索引：用于搜索

// 创建 Mongoose 模型实例
const PageComponentModel = mongoose.model('PageComponent', PageComponentSchema)

// 导出模型供其他模块使用
module.exports = PageComponentModel

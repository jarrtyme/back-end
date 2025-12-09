/**
 * 媒体类型配置
 * 与前端保持一致
 * 与 pageComponentModel.js 和 mediaModel.js 中的媒体类型枚举保持一致
 * 现在支持所有文件类型，不仅仅是图片和视频
 */

// 媒体类型枚举（支持所有文件类型）
const MEDIA_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
  ARCHIVE: 'archive',
  TEXT: 'text',
  OTHER: 'other'
}

// 媒体类型值数组（用于验证）
const MEDIA_TYPE_VALUES = Object.values(MEDIA_TYPES)

// 默认媒体类型
const DEFAULT_MEDIA_TYPE = MEDIA_TYPES.IMAGE

/**
 * 验证媒体类型是否有效
 * @param {string} type - 媒体类型
 * @returns {boolean} 是否有效
 */
function isValidMediaType(type) {
  return MEDIA_TYPE_VALUES.includes(type)
}

module.exports = {
  MEDIA_TYPES,
  MEDIA_TYPE_VALUES,
  DEFAULT_MEDIA_TYPE,
  isValidMediaType
}

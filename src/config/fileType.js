/**
 * 文件类型配置
 * 与前端保持一致的扩展名定义
 */

// 文件类型枚举
const FILE_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
  ARCHIVE: 'archive',
  TEXT: 'text',
  OTHER: 'other'
}

// 图片扩展名列表（与前端保持一致）
const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.ico',
  '.tiff',
  '.tif',
  '.heic',
  '.heif',
  '.avif',
  '.jfif',
  '.jp2',
  '.jpx',
  '.j2k',
  '.j2c',
  '.psd',
  '.raw',
  '.cr2',
  '.nef',
  '.orf',
  '.sr2'
]

// 视频扩展名列表（与前端保持一致）
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv']

// 文档扩展名列表（与前端保持一致）
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']

// 压缩包扩展名列表（与前端保持一致）
const ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z', '.tar', '.gz']

// 文本文件扩展名列表（与前端保持一致）
const TEXT_EXTENSIONS = ['.txt', '.csv', '.json', '.xml', '.md']

// 所有扩展名映射
const EXTENSIONS_MAP = {
  [FILE_TYPES.IMAGE]: IMAGE_EXTENSIONS,
  [FILE_TYPES.VIDEO]: VIDEO_EXTENSIONS,
  [FILE_TYPES.DOCUMENT]: DOCUMENT_EXTENSIONS,
  [FILE_TYPES.ARCHIVE]: ARCHIVE_EXTENSIONS,
  [FILE_TYPES.TEXT]: TEXT_EXTENSIONS
}

/**
 * 根据文件名获取文件类型
 * @param {string} filename - 文件名
 * @returns {string} 文件类型
 */
function getFileTypeFromName(filename) {
  if (!filename) return FILE_TYPES.OTHER
  const ext = `.${filename.toLowerCase().split('.').pop()}`

  if (IMAGE_EXTENSIONS.includes(ext)) return FILE_TYPES.IMAGE
  if (VIDEO_EXTENSIONS.includes(ext)) return FILE_TYPES.VIDEO
  if (DOCUMENT_EXTENSIONS.includes(ext)) return FILE_TYPES.DOCUMENT
  if (ARCHIVE_EXTENSIONS.includes(ext)) return FILE_TYPES.ARCHIVE
  if (TEXT_EXTENSIONS.includes(ext)) return FILE_TYPES.TEXT

  return FILE_TYPES.OTHER
}

/**
 * 检查是否为图片文件
 * @param {string} filename - 文件名
 * @returns {boolean} 是否为图片
 */
function isImageFile(filename) {
  if (!filename) return false
  const ext = `.${filename.toLowerCase().split('.').pop()}`
  return IMAGE_EXTENSIONS.includes(ext)
}

/**
 * 检查是否为视频文件
 * @param {string} filename - 文件名
 * @returns {boolean} 是否为视频
 */
function isVideoFile(filename) {
  if (!filename) return false
  const ext = `.${filename.toLowerCase().split('.').pop()}`
  return VIDEO_EXTENSIONS.includes(ext)
}

/**
 * 验证文件扩展名是否属于指定类型
 * @param {string} filename - 文件名
 * @param {string} fileType - 文件类型
 * @returns {boolean} 是否匹配
 */
function validateFileExtension(filename, fileType) {
  if (!filename || !fileType) return false
  const ext = `.${filename.toLowerCase().split('.').pop()}`
  const allowedExts = EXTENSIONS_MAP[fileType]
  return allowedExts ? allowedExts.includes(ext) : false
}

module.exports = {
  FILE_TYPES,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  TEXT_EXTENSIONS,
  EXTENSIONS_MAP,
  getFileTypeFromName,
  isImageFile,
  isVideoFile,
  validateFileExtension
}

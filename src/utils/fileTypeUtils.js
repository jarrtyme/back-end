/**
 * 文件类型工具函数
 * 统一管理文件类型判断逻辑
 */

const mime = require('mime-types')

/**
 * 根据文件扩展名获取 MIME 类型
 * @param {string} ext - 文件扩展名（可带或不带点）
 * @returns {string} MIME 类型
 */
function getMimeType(ext) {
  const normalizedExt = ext.startsWith('.') ? ext : '.' + ext
  return mime.lookup(normalizedExt) || 'application/octet-stream'
}

/**
 * 根据 MIME 类型判断文件类型
 * @param {string} mimetype - MIME 类型
 * @returns {string} 文件类型：'image', 'video', 'document', 'archive', 'text', 'other'
 */
function getFileTypeFromMimeType(mimetype) {
  if (!mimetype) return 'other'

  if (mimetype.startsWith('image/')) return 'image'
  if (mimetype.startsWith('video/')) return 'video'
  if (mimetype.startsWith('text/')) return 'text'

  if (
    mimetype.includes('pdf') ||
    mimetype.includes('document') ||
    mimetype.includes('word') ||
    mimetype.includes('spreadsheet') ||
    mimetype.includes('excel') ||
    mimetype.includes('presentation') ||
    mimetype.includes('powerpoint')
  ) {
    return 'document'
  }

  if (
    mimetype.includes('zip') ||
    mimetype.includes('rar') ||
    mimetype.includes('7z') ||
    mimetype.includes('compressed')
  ) {
    return 'archive'
  }

  return 'other'
}

/**
 * 根据文件扩展名判断文件类型
 * @param {string} ext - 文件扩展名（可带或不带点）
 * @returns {string} 文件类型：'image', 'video', 'document', 'archive', 'text', 'other'
 */
function getFileTypeFromExtension(ext) {
  const normalizedExt = ext.toLowerCase()
  const extWithDot = normalizedExt.startsWith('.') ? normalizedExt : '.' + normalizedExt

  // 图片扩展名
  const imageExts = [
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

  // 视频扩展名
  const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv', '.mkv']

  // 文档扩展名
  const documentExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']

  // 压缩包扩展名
  const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz']

  // 文本扩展名（包含 .md）
  const textExts = ['.txt', '.csv', '.json', '.xml', '.md', '.markdown']

  if (imageExts.includes(extWithDot)) return 'image'
  if (videoExts.includes(extWithDot)) return 'video'
  if (documentExts.includes(extWithDot)) return 'document'
  if (archiveExts.includes(extWithDot)) return 'archive'
  if (textExts.includes(extWithDot)) return 'text'

  return 'other'
}

/**
 * 根据分类目录名称判断文件类型
 * @param {string} category - 分类目录名称
 * @returns {string} 文件类型：'image', 'video', 'document', 'archive', 'text', 'other'
 */
function getFileTypeFromCategory(category) {
  const categoryMap = {
    images: 'image',
    videos: 'video',
    documents: 'document',
    archives: 'archive',
    texts: 'text'
  }
  return categoryMap[category] || 'other'
}

/**
 * 综合判断文件类型（优先使用 MIME 类型，其次使用扩展名）
 * @param {string} mimetype - MIME 类型
 * @param {string} ext - 文件扩展名
 * @returns {string} 文件类型
 */
function getFileType(mimetype, ext) {
  // 优先使用 MIME 类型判断
  if (mimetype) {
    const typeFromMime = getFileTypeFromMimeType(mimetype)
    if (typeFromMime !== 'other') {
      return typeFromMime
    }
  }

  // 如果 MIME 类型无法判断，使用扩展名
  if (ext) {
    return getFileTypeFromExtension(ext)
  }

  return 'other'
}

module.exports = {
  getMimeType,
  getFileTypeFromMimeType,
  getFileTypeFromExtension,
  getFileTypeFromCategory,
  getFileType
}

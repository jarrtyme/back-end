/**
 * 文件 URL 工具函数
 * 用于生成完整的文件访问 URL
 */

// 确保 dotenv 已加载（如果还没有加载）
// 这确保在模块被 require 时，环境变量已经可用
if (typeof require !== 'undefined') {
  try {
    // 尝试加载 dotenv（如果还没有加载）
    const dotenv = require('dotenv')
    const path = require('path')
    // 只在当前目录查找 .env 文件
    dotenv.config({ path: path.join(__dirname, '../../.env') })
  } catch (e) {
    // dotenv 可能已经加载或不存在，忽略错误
  }
}

/**
 * 获取文件完整 URL
 * @param {string} filePath - 文件路径（如：/uploads/filename.jpg）
 * @param {object} req - Express 请求对象（可选，用于自动获取协议和主机）
 * @returns {string} 完整的文件 URL
 */
function getFileUrl(filePath, req = null) {
  if (!filePath) {
    return ''
  }

  // 如果已经是完整 URL，直接返回
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }

  // 如果提供了 req 对象，使用请求的协议和主机（自动匹配 HTTP/HTTPS）
  if (req) {
    // 从请求头中获取协议（支持代理场景）
    const protocol =
      req.protocol ||
      (req.secure ? 'https' : 'http') ||
      (req.get && req.get('X-Forwarded-Proto')) ||
      'http'
    // 从请求头中获取主机（支持代理场景），完全依赖请求对象，不设置默认值
    const host = (req.get && req.get('host')) || req.headers.host

    // 如果没有获取到 host，返回相对路径
    if (!host) {
      const cleanFilePath = filePath.startsWith('/') ? filePath : `/${filePath}`
      return cleanFilePath
    }

    // 判断是否需要 /api 前缀
    // 1. 检查请求路径是否包含 /api（如果 Nginx 保留了原始路径）
    const requestPath = req.baseUrl || req.path || req.url || ''
    const originalUrl = req.originalUrl || ''
    const hasApiInPath = requestPath.includes('/api') || originalUrl.includes('/api')

    // 2. 判断是否是本地环境
    const isLocal =
      host === 'localhost' ||
      host.startsWith('localhost:') ||
      host === '127.0.0.1' ||
      host.startsWith('127.0.0.1:') ||
      host.startsWith('0.0.0.0:')

    // 3. 如果需要 /api 前缀：
    //    - 路径中包含 /api，或者
    //    - 路径中不包含 /api 但 host 不是本地地址（生产环境通过 Nginx 代理）
    const needsApiPrefix = hasApiInPath || !isLocal

    const cleanFilePath = filePath.startsWith('/') ? filePath : `/${filePath}`
    // 根据判断结果决定是否需要 /api 前缀
    const apiPrefix = needsApiPrefix ? '/api' : ''
    return `${protocol}://${host}${apiPrefix}${cleanFilePath}`
  }

  // 如果没有 req 对象，尝试使用环境变量配置（可选）
  let baseUrl = process.env.FILE_BASE_URL

  // 如果环境变量不存在，尝试再次加载 dotenv
  if (!baseUrl) {
    try {
      const dotenv = require('dotenv')
      const path = require('path')
      dotenv.config({ path: path.join(__dirname, '../../.env') })
      baseUrl = process.env.FILE_BASE_URL
    } catch (e) {
      // 忽略错误
    }
  }

  // 如果环境变量也没有，返回相对路径（不设置默认域名）
  if (!baseUrl) {
    const cleanFilePath = filePath.startsWith('/') ? filePath : `/${filePath}`
    return cleanFilePath
  }

  // 确保 baseUrl 不以 / 结尾，filePath 以 / 开头
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  const cleanFilePath = filePath.startsWith('/') ? filePath : `/${filePath}`
  // 检查 baseUrl 是否包含 /api，如果包含说明后台部署在 /api 路径下
  const needsApiPrefix = cleanBaseUrl.includes('/api')
  const apiPrefix = needsApiPrefix ? '/api' : ''
  return `${cleanBaseUrl}${apiPrefix}${cleanFilePath}`
}

/**
 * 批量处理文件对象，添加完整 URL
 * @param {Object|Array} fileData - 文件对象或文件对象数组
 * @param {object} req - Express 请求对象（可选，用于自动获取协议和主机）
 * @returns {Object|Array} 添加了 url 字段的文件对象或数组
 */
function addFileUrl(fileData, req = null) {
  if (Array.isArray(fileData)) {
    return fileData.map((file) => {
      // 如果已经有完整的URL（以http://或https://开头），直接返回
      if (file.url && (file.url.startsWith('http://') || file.url.startsWith('https://'))) {
        return file
      }
      // 优先使用 path 或已有的 url，如果没有则根据 filename 生成 path
      const filePath = file.path || file.url || (file.filename ? `/uploads/${file.filename}` : '')
      return {
        ...file,
        url: getFileUrl(filePath, req)
      }
    })
  }

  if (fileData && typeof fileData === 'object') {
    // 如果已经有完整的URL（以http://或https://开头），直接返回
    if (
      fileData.url &&
      (fileData.url.startsWith('http://') || fileData.url.startsWith('https://'))
    ) {
      return fileData
    }
    // 优先使用 path 或已有的 url，如果没有则根据 filename 生成 path
    const filePath =
      fileData.path || fileData.url || (fileData.filename ? `/uploads/${fileData.filename}` : '')
    return {
      ...fileData,
      url: getFileUrl(filePath, req)
    }
  }

  return fileData
}

module.exports = {
  getFileUrl,
  addFileUrl
}

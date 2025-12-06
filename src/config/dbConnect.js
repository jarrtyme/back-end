const mongoose = require('mongoose')
const config = require('./database')

/**
 * 清理废弃的数据库索引
 * 在数据库连接成功后自动执行，确保不会因为历史遗留的索引导致错误
 */
async function cleanupObsoleteIndexes() {
  try {
    // 清理 Page 模型中废弃的 path 字段唯一索引
    // path 字段已废弃，允许为 null，多个 null 值会违反唯一性约束
    const PageModel = require('../models/pageModel')
    const collection = PageModel.collection
    const indexes = await collection.indexes()

    // 检查是否存在 path_1 唯一索引（历史遗留问题）
    const pathIndex = indexes.find((idx) => idx.name === 'path_1' && idx.unique)

    if (pathIndex) {
      console.log('⚠️  检测到 path_1 唯一索引（已废弃），正在删除...')
      try {
        await collection.dropIndex('path_1')
        console.log('✅ 成功删除 path_1 唯一索引')
      } catch (dropError) {
        if (!dropError.message.includes('index not found')) {
          console.warn('⚠️  删除 path_1 索引失败:', dropError.message)
        }
      }
    }
  } catch (err) {
    // 索引清理失败不应该阻止应用启动
    console.warn('⚠️  清理废弃索引时出错:', err.message)
  }
}

// 连接数据库
const connectDB = async () => {
  try {
    console.log(`正在连接到数据库...`)
    console.log(`环境: ${process.env.NODE_ENV || 'development'}`)

    // 隐藏密码的连接URL（用于日志显示）
    const safeUrl = config.url.replace(/:([^:@]+)@/, ':****@')
    console.log(`连接URL: ${safeUrl}`)
    if (config.options.authSource) {
      console.log(`认证数据库 (authSource): ${config.options.authSource}`)
    }

    await mongoose.connect(config.url, config.options)

    console.log(`✅ 成功连接到 MongoDB`)
    console.log(`数据库名称: ${mongoose.connection.db.databaseName}`)

    // 数据库连接成功后执行初始化任务：清理废弃的索引
    await cleanupObsoleteIndexes()

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB 连接错误:', err.message)
    })

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB 连接已断开')
    })

    // 优雅关闭
    process.on('SIGINT', async () => {
      await mongoose.connection.close()
      console.log('MongoDB 连接已关闭，应用退出')
      process.exit(0)
    })
  } catch (error) {
    console.error('❌ MongoDB 连接失败:', error.message)

    // 提供更详细的错误信息和解决建议
    if (error.message.includes('Authentication failed')) {
      console.error('\n🔍 认证失败，请检查以下配置：')
      console.error('1. 确认用户名和密码是否正确')
      console.error('2. 确认 authSource 配置是否正确（用户是在哪个数据库中创建的）')
      console.error('   - 如果用户是在目标数据库中创建的，authSource 应该是数据库名')
      console.error('   - 如果用户是在 admin 数据库中创建的，设置 MONGODB_AUTH_SOURCE=admin')
      console.error('3. 确认用户是否有访问该数据库的权限')
      console.error('\n当前配置：')
      console.error(`  - 数据库名: ${process.env.MONGODB_DATABASE || 'clothing_inventory'}`)
      console.error(`  - 用户名: ${process.env.MONGODB_USER || '未设置'}`)
      console.error(`  - authSource: ${config.options.authSource || '未设置'}`)
    }

    console.error('\n连接详情:', {
      url: config.url.replace(/:([^:@]+)@/, ':****@'), // 隐藏密码
      authSource: config.options.authSource,
      error: error.message
    })
    process.exit(1)
  }
}

module.exports = connectDB

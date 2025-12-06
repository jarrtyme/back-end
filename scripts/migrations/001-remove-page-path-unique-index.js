/**
 * 数据库迁移脚本：移除 Page 模型中 path 字段的唯一索引
 *
 * 问题描述：
 * - Page 模型的 path 字段已废弃，允许为 null
 * - 数据库中存在 path_1 唯一索引，导致多个 null 值违反唯一性约束
 * - 这会导致创建页面时出现 E11000 duplicate key error
 *
 * 解决方案：
 * - 删除 path_1 唯一索引
 * - 保留 path 字段（兼容旧数据），但不设置任何索引
 *
 * 执行方式：
 * node scripts/migrations/001-remove-page-path-unique-index.js
 *
 * 或者在生产环境：
 * NODE_ENV=production node scripts/migrations/001-remove-page-path-unique-index.js
 */

require('dotenv').config()
const mongoose = require('mongoose')
const PageModel = require('../../src/models/pageModel')
const connectDB = require('../../src/config/dbConnect')

async function migrate() {
  try {
    console.log('🚀 开始数据库迁移：移除 Page.path 唯一索引')
    console.log('='.repeat(60))

    // 连接数据库
    await connectDB()
    console.log('✅ 数据库连接成功\n')

    // 获取集合
    const collection = PageModel.collection

    // 获取所有索引
    console.log('📋 检查当前索引...')
    const indexes = await collection.indexes()
    console.log('当前索引列表:')
    indexes.forEach((idx) => {
      const unique = idx.unique ? ' [唯一索引]' : ''
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}${unique}`)
    })
    console.log()

    // 检查是否存在 path_1 唯一索引
    const pathIndex = indexes.find((idx) => idx.name === 'path_1' && idx.unique)

    if (pathIndex) {
      console.log('⚠️  发现 path_1 唯一索引（需要删除）')
      console.log(`   索引定义: ${JSON.stringify(pathIndex.key)}`)
      console.log()

      console.log('🗑️  正在删除 path_1 唯一索引...')
      await collection.dropIndex('path_1')
      console.log('✅ 成功删除 path_1 唯一索引\n')

      // 验证删除结果
      const newIndexes = await collection.indexes()
      const stillExists = newIndexes.find((idx) => idx.name === 'path_1')

      if (stillExists) {
        console.error('❌ 警告：索引删除后仍然存在，请手动检查')
        process.exit(1)
      } else {
        console.log('✅ 验证通过：path_1 索引已成功删除')
      }
    } else {
      console.log('ℹ️  未发现 path_1 唯一索引，无需删除')

      // 检查是否存在非唯一的 path 索引
      const nonUniquePathIndex = indexes.find((idx) => idx.name === 'path_1' && !idx.unique)
      if (nonUniquePathIndex) {
        console.log('ℹ️  发现 path_1 非唯一索引，保留不变')
      }
    }

    console.log()
    console.log('='.repeat(60))
    console.log('✅ 迁移完成')
    console.log()
    console.log('📝 迁移说明：')
    console.log('  - path 字段已保留（兼容旧数据）')
    console.log('  - path 字段不再有唯一索引约束')
    console.log('  - 可以创建多个 path 为 null 的页面')
    console.log()

    // 关闭数据库连接
    await mongoose.connection.close()
    process.exit(0)
  } catch (error) {
    console.error('❌ 迁移失败:', error)
    console.error('错误详情:', error.message)
    process.exit(1)
  }
}

// 运行迁移
migrate()

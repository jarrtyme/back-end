/**
 * 删除 Page 模型中 path 字段的唯一索引
 *
 * 问题：数据库中存在 path_1 唯一索引，但 path 字段已废弃且允许为 null
 * 多个 null 值会违反唯一性约束，导致创建页面失败
 *
 * 使用方法：
 * node scripts/removePagePathIndex.js
 */

require('dotenv').config()
const mongoose = require('mongoose')
const PageModel = require('../src/models/pageModel')

async function removePathIndex() {
  try {
    // 连接数据库
    const connectDB = require('../src/config/dbConnect')
    await connectDB()

    console.log('正在检查索引...')

    // 获取集合
    const collection = PageModel.collection

    // 获取所有索引
    const indexes = await collection.indexes()
    console.log(
      '当前索引列表:',
      indexes.map((idx) => idx.name)
    )

    // 检查是否存在 path_1 索引
    const pathIndex = indexes.find((idx) => idx.name === 'path_1')

    if (pathIndex) {
      console.log('找到 path_1 索引，正在删除...')
      await collection.dropIndex('path_1')
      console.log('✅ 成功删除 path_1 索引')
    } else {
      console.log('⚠️  未找到 path_1 索引，可能已经被删除')
    }

    // 显示删除后的索引列表
    const newIndexes = await collection.indexes()
    console.log(
      '删除后的索引列表:',
      newIndexes.map((idx) => idx.name)
    )

    console.log('✅ 操作完成')
    process.exit(0)
  } catch (error) {
    console.error('❌ 删除索引失败:', error)
    process.exit(1)
  }
}

// 运行脚本
removePathIndex()

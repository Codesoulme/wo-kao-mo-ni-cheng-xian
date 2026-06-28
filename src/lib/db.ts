import { PrismaClient } from '@prisma/client'

// Task 22: 用版本号 bust globalThis 缓存——schema 变更后强制新建 PrismaClient 实例
// 否则 dev server 长期运行时 globalThis.prisma 会持有旧 schema 的 client，新字段会报 unknown argument
const PRISMA_CACHE_VERSION = 'v27-projection-snapshot';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __prismaCacheVersion?: string
}

// 若缓存版本不匹配，清除旧实例
if (globalForPrisma.__prismaCacheVersion !== PRISMA_CACHE_VERSION) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.__prismaCacheVersion = PRISMA_CACHE_VERSION;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
[English](./README.md) | 简体中文

# LexiFlow

一个交互式的全栈英文学习 Web 应用，提供每日地道表达、词汇记忆卡片、情境测验与双语精读练习。

## 功能特性

- **每日地道表达（Daily Expressions）**：精选职场与日常地道短语，支持美音 / 英音切换与语速调节（`0.8x` / `1.0x`）。
- **交互式词汇卡片（Flashcards）**：3D 翻转卡片展示音标、英文释义与双语例句，支持按 CEFR 等级、场景分类与掌握状态筛选。
- **情境测验（Context Quiz）**：基于词库动态生成四选一测验题，提供即时例句解析与成绩记录。
- **双语精读（Reading Lab）**：支持中英双语切换、全文朗读、核心表达发音卡片以及阅读完成状态记录。
- **游客体验与账号同步** *（持续开发中）*：免登录即可试玩，注册登录后由 PostgreSQL + Prisma 提供云端持久化与多端同步。

## 技术栈

- **前端**：React 18、TypeScript、Vite、Lucide Icons、Web Speech API
- **后端**：Node.js、Express、TypeScript、Prisma ORM、PostgreSQL 16、Zod、Helmet
- **测试与 CI**：Node.js 内置测试运行器（`node:test` + `tsx`）、GitHub Actions（含 PostgreSQL 服务容器）

## 目录结构

```text
lexiflow/
├── client/                  # React + Vite + TypeScript 前端应用
├── server/                  # Express + TypeScript + Prisma 后端服务
│   ├── prisma/              # Prisma 数据模型、迁移文件与种子脚本
│   ├── src/
│   │   ├── config/          # Zod 强校验环境变量配置
│   │   ├── db/              # PrismaClient 实例
│   │   ├── middleware/      # 鉴权、参数校验与请求限流
│   │   ├── routes/          # REST API 路由模块
│   │   └── utils/           # scrypt 密码哈希与 JWT 工具
│   └── tests/               # 单元测试与 PostgreSQL 集成测试
├── deploy/                  # 生产环境 Nginx、PM2 与部署脚本模板
├── docker-compose.yml       # PostgreSQL 16 容器编排配置
└── .github/workflows/       # 自动化 CI 测试与构建流水线
```

## 本地开发

### 环境要求

- Node.js 20+（推荐 22 LTS）
- Docker Desktop / Docker Engine（用于启动 PostgreSQL 16）

### 启动步骤

```bash
# 1. 使用 Docker 启动 PostgreSQL 16（仅监听 127.0.0.1:5432）
npm run db:up

# 2. 配置后端环境变量
cp .env.example server/.env

# 3. 安装依赖并生成 Prisma Client
npm run install:all
npm run db:generate --prefix server

# 4. 执行数据库迁移、写入初始文章并导入约 4,500 个高频词典词条
npm run db:migrate
npm run db:seed
npm run db:import-dict

# 5. 启动后端 API 服务（默认端口 4000）
npm run dev:server

# 6. 另开终端启动前端开发服务器（默认端口 5173）
npm run dev:client
```

## 测试与构建

```bash
# 运行不依赖数据库的后端单元测试
npm run test:unit --prefix server

# 运行完整后端测试（单元测试 + PostgreSQL 集成测试）
npm test

# TypeScript 类型检查并构建前后端生产产物
npm run build
```

## 生产部署概览

仓库中的 `deploy/` 目录与 `docker-compose.yml` 提供了经典混合部署模板：
- `docker-compose.yml`：运行 PostgreSQL 16 数据库并挂载持久化数据卷（仅绑定本机回环端口）。
- `deploy/setup-vps.sh`：一键初始化 Ubuntu 24.04/22.04 服务器（配置 swap、UFW 防火墙、Nginx、Node.js 22、PM2 与 Docker Compose）。
- `deploy/ecosystem.config.cjs`：使用 PM2 守护编译后的后端服务（`server/dist/index.js`）。
- `deploy/nginx/lexiflow.conf`：静态托管 `client/dist/`（含 SPA 路由回退），并将 `/api/` 反向代理至 `127.0.0.1:4000`。
- `deploy/deploy.sh`：拉取代码、执行 `prisma migrate deploy`、构建前后端产物并平滑重启 PM2。
- `deploy/backup-db.sh`：基于 `pg_dump` 的 PostgreSQL 自动压缩备份与过期清理脚本。

## 开发路线

- [x] PostgreSQL + Prisma 数据层、TypeScript 后端重构与 Cookie JWT 用户认证
- [x] 后端 SM-2 间隔重复引擎、90 天学习热力图统计、词典缓存查词、文章导入与可选 AI 接口
- [x] 前端界面全面升级（仪表盘热力图、SRS 复习队列、划词查词弹窗、账号弹窗与深浅色主题）
- [x] 生产部署脚本完善与数据库备份规范
- [ ] 多词书管理与 CSV/JSON 批量导入导出

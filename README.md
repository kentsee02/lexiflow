# LexiFlow

一个轻量、交互式的英文学习 Web 应用，提供每日地道表达、词汇记忆卡片、情境测验与双语精读练习。

## 功能模块 Features

- **每日地道表达（Daily Expression）**：支持美音 / 英音切换、语速调节（`0.8x` / `1.0x`）以及表达浏览切换。
- **词汇记忆卡片（Flashcards）**：3D 翻转卡片展示词义、音标、英文释义与双语例句，支持按 CEFR 等级（`B1` / `B2` / `C1`）、场景分类、掌握状态与关键词筛选，并可自定义添加或管理词汇。
- **情境词汇测验（Context Quiz）**：从词库动态生成四选一测验题，即时给出反馈与例句解析，并记录历史最高分与练习次数。
- **双语精读实验室（Reading Lab）**：支持中英双语切换、全文朗读、重点表达发音卡片以及阅读完成进度记录。

## 技术栈 Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Lucide Icons, Web Speech API
- **Backend**: Node.js (ESM), Express, CORS, dotenv, JSON file store
- **Testing & CI**: Node.js built-in test runner (`node:test`), GitHub Actions

## 目录结构 Structure

```text
lexiflow/
├── client/                  # React + Vite + TypeScript 前端应用
├── server/                  # Node.js + Express REST API 与接口测试
│   ├── src/
│   │   ├── app.js           # 路由与核心业务逻辑
│   │   ├── index.js         # 服务启动入口
│   │   ├── data/seed.js     # 初始词库、每日表达与精读文章
│   │   └── store/jsonStore.js
│   └── tests/api.test.js    # REST API 集成测试
├── deploy/                  # 生产环境 Nginx、PM2 与部署脚本模板
└── .github/workflows/       # CI 自动测试与构建流水线
```

## 本地开发 Local Development

环境要求：Node.js 20+（推荐 22 LTS）。

```bash
# 1. 安装前后端依赖
npm run install:all

# 2. 启动后端 API 服务（默认端口 4000）
npm run dev:server

# 3. 另开终端启动前端开发服务器（默认端口 5173，自动代理 /api 请求到 4000）
npm run dev:client
```

## 测试与构建 Testing & Build

```bash
# 运行后端接口自动化测试
npm test

# TypeScript 类型检查与前端生产构建 (输出至 client/dist)
npm run build
```

## 生产部署概览 Production Deployment

`deploy/` 目录包含标准生产环境配置模板：
- `deploy/nginx/lexiflow.conf`：静态托管 `client/dist`，处理 SPA 路由回退，并将 `/api/` 反向代理至后端服务。
- `deploy/ecosystem.config.cjs`：使用 PM2 守护 `server/src/index.js` 进程。
- `deploy/deploy.sh`：拉取最新代码、安装依赖、构建前端并平滑重启 API 服务。

## 开发路线 Roadmap

- [ ] 支持用户账号体系与多端学习进度同步
- [ ] 引入间隔重复算法（SRS）自动安排词汇复习节奏
- [ ] 后端持久化由 JSON 文件平滑迁移至 SQLite / PostgreSQL
- [ ] 新增口语跟读与听写练习模式

# 薄荷起始页 (MintStart)

一个漂亮、可定制的新标签页 / 起始页，支持账户系统与云端同步。

## ✨ 功能

- 快速拨号（Launchpad）— 拖拽排序、文件夹分组、分页
- Bing 壁纸自动更换
- 时钟与搜索
- 账户体系：注册 / 登录 / 修改密码
- 云端同步：登录后快捷方式和搜索引擎偏好保存到云端，多设备一致
- 使用统计：管理员可查看用户使用时长等统计

## 🏠 线上地址

- 主站: https://mintstart.cn
- API: https://api.mintstart.cn

## 🛠 技术栈

- React 19 + Vite 8
- 前端托管: Cloudflare Pages
- 后台: NestJS + SQLite + Prisma（独立仓库，经 Cloudflare Tunnel 暴露）
- 样式: 纯 CSS（无 UI 框架）

## 🚀 本地开发

```bash
npm install
npm run dev
```

开发服务器默认 `http://localhost:5173`，`/api` 代理到 `http://localhost:8787`（后台）。

## 📦 生产构建与部署

```bash
npm run build        # 产物输出到 dist/
npm run deploy:pages # 构建并上传到 Cloudflare Pages（需 CLOUDFLARE_API_TOKEN 环境变量）
```

生产环境 API 地址通过 `.env.production` 的 `VITE_API_BASE_URL` 配置。

## 🧪 测试

```bash
npm test
```

## 🐛 反馈 Bug

发现 Bug？欢迎提 [Issue](https://github.com/xu1132/MintStart/issues/new)，请包含：

- 复现步骤
- 期望行为与实际行为
- 截图（如适用）
- 浏览器 / 系统版本

## 🤝 贡献代码

1. Fork 本仓库
2. 创建功能分支: `git checkout -b feat/your-feature`
3. 提交改动: `git commit -m "feat: ..."`
4. 推送到你的仓库: `git push origin feat/your-feature`
5. 发起 Pull Request 到 `main` 分支

> 提交信息请遵循 [Conventional Commits](https://www.conventionalcommits.org/) 风格
> （`feat:` / `fix:` / `docs:` / `refactor:` 等前缀）。

## 📄 许可证

[MIT License](LICENSE) © 2026 xu1132

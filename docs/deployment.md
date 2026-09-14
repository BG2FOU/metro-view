# 部署

## 静态站点

```sh
npm ci
npm run build
```

将 `dist/` 部署到任意静态托管平台即可。

## AMap 凭据

开发环境可在 `.env.local` 中配置 `VITE_AMAP_API_KEY` 与 `AMAP_SECURITY_JS_CODE`。生产环境建议通过同源代理保护安全密钥，并设置：

```text
VITE_AMAP_AUTH_MODE=proxy
VITE_AMAP_SERVICE_HOST=https://metro.example.com/_AMapService
```

不要把真实 Key、Security Code、代理密钥或本地 `.env` 文件提交到仓库。`wrangler.jsonc` 仅提供通用 Cloudflare Worker 构建示例，部署前请改成自己的项目配置。

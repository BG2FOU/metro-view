# Metro View

一个基于 TypeScript、Vite 与 AMap JS API 的轨道交通运行图推演前端。项目展示线路几何、列车插值位置、车站到站板、运行图切换和可调速模拟时钟。

> **数据声明：** 本公开仓库只包含人工构造的 `示例 A 线`、`示例 B 线`及合成时刻表。站名、线路、坐标、车次、交路和切换日期均为演示数据，不对应任何真实线路或运营计划，也不能用于乘车或运营决策。

## 功能

- GeoJSON 线路与车站展示，区分高架、地下、预留站和车辆段支线。
- 按运行图在路径上确定性推演列车的运行、停站、等待和下线状态。
- 车站双向到站板、列车详情、非载客提示和线路显示开关。
- 实时与模拟时钟，支持暂停及 `1×/5×/10×/30×/60×` 倍速。
- 基础/下一版运行图以及工作日/双休日运行图选择。
- 运行时数据分块加载，生产构建不包含源数据审计信息。

## 快速开始

要求 Node.js 22.10 或更高版本。

```sh
npm ci
npm run prepare:runtime-timetables
npm test
npm run build
npm run dev
```

本地地图需要 AMap Web Key。复制 `.env.example` 为 `.env.local` 后填写本地凭据；不要提交密钥。

## 示例数据

- 线路：`src/data/line-a.geojson`、`src/data/line-b.geojson`
- 合成时刻表工厂：`src/data/sample-timetable.ts`
- 各示例图：`src/data/*-timetable.ts`
- 运行时精简数据：`src/data/runtime/*.json`

替换数据前请阅读 [`docs/data-format.md`](docs/data-format.md)。所有示例文件均带有明确的 sample 语义，公开仓库不包含原闭源项目的原始文件、真实站名、真实坐标、真实图号、真实车次、运营备注、提取证据或内部更新文档。

## 验证

```sh
npm run check:runtime-timetables
npm run typecheck
npm test
npm run build
npm run test:e2e
```

部署说明见 [`docs/deployment.md`](docs/deployment.md)。

## 许可证

见 [`LICENSE`](LICENSE)。第三方依赖与地图服务分别遵循其自身许可证和服务条款。

# 数据格式

公开版本使用两类输入：规范化线路 GeoJSON 与运行图对象。仓库内数据均为合成样例。

## 线路 GeoJSON

根对象必须包含：

- `type: "FeatureCollection"`
- `coordinateSystem: "GCJ-02"`（当前 AMap 适配器要求）
- `lineId`：需同步扩展 `src/domain/model.ts` 中的 `LineId`
- `lineColor`
- `features`

车站使用 `Point`，属性至少包括 `id`、`nameZh`、`nameEn`、`sequence`、`stationType` 和 `structureType`。线路分段使用 `LineString`，属性至少包括 `id`、`segmentId`、`sequence`、`partNo`、`partCount`、`fromId`、`toId` 和 `structureType`。车辆段支线增加 `segmentType: "depot_line"`。

## 运行图

运行时引擎只依赖 `DomainTimetable`：

- `trips`：车次、方向、交路、车辆、载客属性与事件；
- `circulations`：同一车辆关联的车次及车次间连接；
- `conventions.serviceDayRollover`：跨零点服务日边界。

事件可使用 `arrival`、`departure`、`pass` 或 `boundaryTime`，时间格式为 `HH:mm:ss`。`scripts/prepare-runtime-timetables.ts` 会从示例源数据生成仅保留运行字段的 JSON；提交前运行：

```sh
npm run prepare:runtime-timetables
npm run check:runtime-timetables
```

## 发布前数据边界

如果基于本项目制作公开派生版本，请确认没有提交运营原件、真实时刻、真实坐标、访问凭据、内部域名、审核记录或生成证据。建议从无父提交的干净快照发布，避免历史提交携带已删除数据。

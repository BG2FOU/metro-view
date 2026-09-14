# 自动发布到公开仓库

闭源仓库的 `public/metro-view` 分支由 `.github/workflows/release-public.yml`
自动发布到 `BG2FOU/metro-view` 的 `main` 分支。工作流会先检查私有源文件和运行标识，
再创建无父提交的公开快照，因此不会把闭源仓库历史带入公开仓库。

## 一次性配置

在闭源仓库 `BG2FOU/AMTR-view` 的 **Settings → Secrets and variables → Actions**
中新建仓库 Secret：

- **Name**：`PUBLIC_REPO_METRO_VIEW_TOKEN`
- **Value**：仅授权 `BG2FOU/metro-view` 的 fine-grained personal access token
- **Repository permissions**：`Contents: Read and write`

不要把 token 写入代码、工作流文件或日志。配置后，向 `public/metro-view` 推送即可触发发布；
也可以在 Actions 页面手动运行 `Release sanitized public mirror`。

## 保护措施

- 工作流只在 `public/metro-view` 分支触发，并限制并发发布。
- 发布前拒绝私有数据、证据文件、原始文档和已知运行标识。
- 公开快照不包含本工作流文件本身，也不携带闭源提交历史。
- 使用 `--force-with-lease`，避免覆盖公开仓库中意外产生的并发更新。
- 公开快照继承 `public/metro-view` 最新推送提交的作者、提交者、时间和完整提交消息，
  保持原提交消息的首行以兼容 Conventional Commits/Husky 规则，并追加
  `Public-Source-Commit` trailer 用于追踪源提交。

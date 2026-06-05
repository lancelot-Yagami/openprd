# 设计

## 背景

现有 `openprd benchmark add` 能把来源放入 candidate，`approve` 能晋级 approved registry；现有 `openprd grow . --review` 能在收工复盘时提示增长候选。本次新增的能力应贴近 benchmark 模块，而不是把外部信源当作通用 growth 自动应用规则。

## 目标

- 支持记录“本轮外部信源被用户采纳”的轻量事件。
- 用规范化来源 key 去重，避免 `example.com/docs` 和 `example.com/review` 被当成完全无关来源。
- 多次采纳后形成推荐，但不自动写入 approved registry。

## 范围

- 新增 `openprd benchmark observe <url|repo|file>`。
- 对 candidate source 增加 `adoptedCount`、`lastUsedAt`、`evidence` 和 promotion recommendation。
- `benchmark list` 与 `grow review` 展示达到阈值的推荐。
- 保持 `benchmark approve` 作为唯一晋级动作。

## 约束

- 不把宽泛一级域名作为唯一事实边界；URL 来源使用可注册域名加首段路径生成稳定 source key。
- 不自动 approve，避免 Agent 自己给自己沉淀偏见。
- 记录证据只保存任务、理由、采纳信号和时间，不保存敏感凭证。

## 风险与开放问题

- 风险: 来源规范化过宽会误合并同站不同产品文档。
- 风险: 来源规范化过窄会导致同一站点被拆成多个候选。
- 问题: 后续是否从 hook transcript 中自动提取观察事件。

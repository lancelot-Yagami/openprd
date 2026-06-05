## 新增需求

### 需求：知识候选生命周期治理
OpenPrd 需要为项目级知识候选提供正式生命周期，让已审查候选不再表现为未解决的质量债。

#### 场景：列出待审候选
- **当** 用户运行 `openprd knowledge candidates`。
- **则** OpenPrd 默认只列出 `pending-review` 候选，并展示编号、标题、状态、候选路径、草案技能路径和建议下一步。

#### 场景：拒绝无价值候选
- **当** 用户运行 `openprd knowledge reject --id <candidate-id> --reason <text>`。
- **则** OpenPrd 需要同时在 `candidate.json` 和 `.openprd/knowledge/index.json` 中把候选标记为 `rejected`，记录审查元数据，并保留原始证据文件。

#### 场景：归档重复或过期候选
- **当** 用户运行 `openprd knowledge archive --id <candidate-id> --reason <text>`。
- **则** OpenPrd 需要把候选标记为 `archived`，记录归档元数据，并从质量报告的待确认提醒中排除。

#### 场景：恢复已处理候选
- **当** 用户运行 `openprd knowledge restore --id <candidate-id>`。
- **则** OpenPrd 需要把候选重新标记为 `pending-review`，并允许质量报告再次把它作为待审候选提示。

#### 场景：质量报告只提示真实待审候选
- **当** `.openprd/knowledge/candidates` 同时存在待审、已合并、已升级、已拒绝、已归档或历史已审状态的候选。
- **则** `openprd quality . --verify` 只把 `pending-review` 候选计为未处理，同时保留按状态分组的审计数量。

#### 场景：兼容历史状态
- **当** 既有候选状态是 `reviewed-noise`、`reviewed-duplicate`、`reviewed-weak-signal`、`merged` 或 `promoted`。
- **则** OpenPrd 需要把它视为已审查，不能纳入待审候选提醒。

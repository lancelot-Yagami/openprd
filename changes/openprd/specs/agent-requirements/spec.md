## 新增需求

### 需求：OpenPrd 会话线与需求线隔离
OpenPrd 在多项目并行、多对话并行和历史会话恢复场景下，仍然会复用当前项目的 active requirement、active change、旧 review artifact 或旧 PRD 内容，导致不同对话、不同需求任务之间发生串线和上下文污染。

#### 场景：主流程成功
- **当** 用户提供历史 session id 并要求继续时，OpenPrd 先查全局 session registry，定位真实 workspace，再在对应 workspace 内恢复本轮对象。
- **则** 新增全局 session registry，记录 sessionId 与 workspaceRoot、lane、change、task、workUnit 等映射。

#### 场景：边界情况保持可见
- **当** session registry 缺记录，但 repo-local binding 存在时，可以在候选 workspace 内回退解析，并明确标注来源。
- **则** 产品应保持该情况明确可见，以支持实现和验证

#### 场景：失败模式得到处理
- **当** 显式 session id 落到当前项目 active change，导致恢复错线。
- **则** 产品应提供有边界且可评审的结果

#### 场景：review 确认后继续当前 lane
- **当** 用户通过 review.html 认可当前稳定评审稿，并明确要求继续当前 OpenPrd 下一步。
- **则** 产品应先记录精确 review artifact，再继续同一条 lane，不得停在“只记录 review”的中间态。

#### 场景：review 后执行授权保持清晰
- **当** review 已确认、tasks 已就绪，但当前 lane 仍需要执行授权。
- **则** Agent 应直接展示执行确认清单，不得再用泛泛的确认话术重复向用户索取授权。

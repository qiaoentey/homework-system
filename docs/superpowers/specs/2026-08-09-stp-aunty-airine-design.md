# STP Aunty Airine 司机选项设计

## 目标

在 STP 学生资料与 Enrol 的 Van 司机下拉名单加入 `Aunty Airine`。

## 范围

- STP 显示现有共用司机加 `Aunty Airine`。
- WS 继续显示原有 `Aunty Airine`，不重复。
- MK 名单维持不变。
- 沿用现有 `vanDriver` 字符串资料，不更改数据库或旧学生资料。

## 验证

用分院司机名单测试锁定三个分院的隔离规则，再运行完整测试、Sites Worker、构建与电脑/手机流程后发布。

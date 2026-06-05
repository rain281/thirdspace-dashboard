# Next Action Visibility Fix Design

## 背景

`NEXT ACTION` 已替换今日页首行的 `OVERVIEW`，但原首行高度只有 78px，卡片同时包含标题、徽标、行动文本、原因、风险提示和按钮，导致内容显示不全。

## 目标

让 `NEXT ACTION` 在今日工作页完整可读，同时不改变推荐逻辑和其他卡片职责。

## 方案

1. 将今日页首行高度从 78px 增加到 104px。
2. 将窄屏 / container 布局首行高度从 72px 增加到 110px。
3. `NEXT ACTION` 主行动和原因允许最多 2 行显示。
4. 风险提示保持一行压缩展示，避免再次挤占主行动空间。

## 非目标

1. 不改 `calculateNextAction()` 推荐优先级。
2. 不移动 `TODAY`、`TODAY'S TODOS`、`PROJECT POOL`。
3. 不新增独立卡片或数据源。

## 验收标准

1. `NEXT ACTION` 标签、徽标、主行动、原因、风险提示、按钮 6真实/6总数元素可见。
2. 桌面布局首行不裁切卡片内容。
3. 窄屏 / container 布局首行不裁切卡片内容。
4. `npm run build` 1真实/1总数通过。
5. Rain 插件部署文件 2真实/2总数一致。

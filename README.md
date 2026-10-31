# dsh-git-sidebar

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 侧边栏添加一个 **Git 卡片**（排在浏览器卡片下方），点进去顶部显示当前仓库的 git 更改。

## 特性

- 设置弹窗左侧导航新增 **“Git”** 菜单项，`order: 101`（排在浏览器 `order: 100` 下方）
- 点进去**顶部显示 git 更改**：
  - 分支名 / 上游 / ahead / behind
  - 已暂存 / 未暂存 / 未跟踪 / 总计 计数徽标
  - 工作区干净 / 有未提交更改 状态提示
- **更改文件列表**：每个文件显示状态徽标（改/增/删/移/复/冲/新/型）+ 路径 + 暂存状态
- **点击文件查看 diff**：带语法着色（增绿/删红/位置蓝），支持暂存区与工作区 diff
- 刷新按钮，手动重新读取状态
- 界面**中英双语**：跟随 DSH 设置面板语言
- 纯前端 + 两个只读 HTTP 端点，不执行任何写操作（不 add / commit / push）

## 工作原理

```
浏览器 "Git" 卡片
   │  fetch GET /dsh-git-sidebar/status
   ▼
Host 半区 (lib/index.js)
   │  1. git status --porcelain=v1 -b  → 分支 + 文件状态
   │  2. 解析 XY 状态码 → 暂存区/工作区/未跟踪分类
   │  3. 统计计数
   ▼
JSON { ok, branch, upstream, ahead, behind, counts, files, clean }

点击文件
   │  fetch GET /dsh-git-sidebar/diff?file=<path>&staged=<0|1>
   ▼
Host 半区
   │  git diff [--cached] -- <file>
   ▼
JSON { ok, diff }
```

## 文件状态徽标

| 徽标 | 含义 | 颜色 |
|------|------|------|
| 改 (M) | Modified | 橙 |
| 增 (A) | Added | 绿 |
| 删 (D) | Deleted | 红 |
| 移 (R) | Renamed | 蓝 |
| 复 (C) | Copied | 蓝 |
| 冲 (U) | Unmerged/Conflict | 紫 |
| 新 (?) | Untracked | 灰 |
| 型 (T) | Typechange | 青 |

## 安装

```bash
dsh plugin --profile web add dsh-git-sidebar
# 或从 GitHub 安装：
dsh plugin --profile web add 'github:wisebreeze/dsh-git-sidebar'
```

重启 `dsh web`，打开设置弹窗 → 左侧导航中浏览器下方的 **“Git”**。

## 卸载

```bash
dsh plugin --profile web remove dsh-git-sidebar
```

## 目录结构

```
dsh-git-sidebar/
├── lib/
│   ├── index.js      # Host 半区:注册 /status + /diff 端点
│   └── client.js     # 浏览器半区 bundle:Git 卡片 UI
├── package.json      # dsh.client 声明 + exports
├── cordis.patch.yml  # 组合 overlay(安装即用)
├── README.md
└── LICENSE           # MIT
```

## 安全说明

- 仅调用 git 的**只读子命令**（`status` / `diff` / `rev-parse`），不执行任何写操作。
- `GIT_TERMINAL_PROMPT=0` 禁止 git 弹出凭证提示，避免挂起。
- 命令执行超时 8 秒，防止慢仓库卡住 Web 端点。
- diff 输出限制 4MB，防止超大 diff 撑爆内存。

## 许可证

[MIT](LICENSE)

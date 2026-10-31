# dsh-browser-plus

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 界面添加一个**侧边栏浏览器**，核心特性是**智能输入框**：输入网址直接访问，输入非网址自动走 Bing 搜索。

## 特性

- 设置弹窗左侧导航新增 **“浏览器”** 菜单项
- **智能输入框**（核心）：
  - `https://example.com` → 直接访问
  - `example.com` / `example.com/path` → 补 `https://` 后访问
  - `1.2.3.4` → 当作 IP 地址访问
  - `deepseek harness 是什么` → Bing 搜索
  - `deepseek` → Bing 搜索（单词不含点，视为搜索词）
- 输入框右侧实时显示提示徽标：`将直接访问` / `将使用 Bing 搜索`
- 浏览器工具栏：后退 / 前进 / 刷新 / 主页 / 在新标签页打开
- iframe 渲染目标页面，带 `sandbox` 安全限制
- 界面**中英双语**：跟随 DSH 设置面板语言
- 纯前端 + 两个只读 HTTP 端点，不写任何配置、不改动持久化数据

## 智能识别规则

| 输入 | 识别为 | 目标 URL |
|------|--------|----------|
| `https://github.com` | URL | `https://github.com` |
| `http://localhost:3000` | URL | `http://localhost:3000` |
| `github.com` | URL | `https://github.com` |
| `github.com/wisebreeze` | URL | `https://github.com/wisebreeze` |
| `1.2.3.4` | URL | `https://1.2.3.4` |
| `1.2.3.4:8080` | URL | `https://1.2.3.4:8080` |
| `deepseek harness` | 搜索 | `https://www.bing.com/search?q=deepseek%20harness` |
| `deepseek` | 搜索 | `https://www.bing.com/search?q=deepseek` |
| `12345` | 搜索 | `https://www.bing.com/search?q=12345` |
| `mailto:a@b.com` | 搜索 | `https://www.bing.com/search?q=mailto%3Aa%40b.com` |

判定逻辑（Host 半区 `resolveInput`）：

1. 已带 `http://` / `https://` scheme → 严格校验后直接访问
2. 不含空格且形如 `域名.TLD` 或 `IP` → 补 `https://` 后访问
3. 其他情况（含空格、纯数字、单词等）→ Bing 搜索

## 工作原理

```
浏览器输入框
   │  用户按回车
   ▼
fetch GET /dsh-browser-plus/resolve?q=<输入>
   │
   ▼
Host 半区 (lib/index.js)
   │  resolveInput(input) 智能判定
   ▼
JSON { ok, kind: 'url'|'search', url }
   │
   ▼
iframe.src = url  →  渲染目标页面
```

## 安装

### 1. 通过 DSH CLI 安装

```bash
dsh plugin --profile web add dsh-browser-plus
# 或从 GitHub 安装（未发布 npm 时）：
dsh plugin --profile web add 'github:wisebreeze/dsh-browser-plus'
```

### 2. 重启并查看

重启 `dsh web`，打开设置弹窗 → 左侧导航中的 **“浏览器”**，输入网址或搜索词即可。

## 卸载

```bash
dsh plugin --profile web remove dsh-browser-plus
```

## 目录结构

```
dsh-browser-plus/
├── lib/
│   ├── index.js      # Host 半区:注册 /resolve + /proxy 端点
│   └── client.js     # 浏览器半区 bundle:侧边栏浏览器 UI
├── package.json      # dsh.client 声明 + exports
├── cordis.patch.yml  # 组合 overlay(安装即用)
├── README.md
└── LICENSE           # MIT
```

## 开发与本地修改

- 客户端代码是**手写 bundle**（纯 JS + `require("react")`，无构建工具链）：修改 `lib/client.js` 后刷新页面即生效。
- Host 半区是标准 ESM 插件：修改 `lib/index.js` 后重启 `dsh web`。
- 发布到 npm 前请同步 `package.json` 与 `lib/index.js` 中的 `PLUGIN_VERSION`。

## 安全说明

- 代理端点 `/dsh-browser-plus/proxy` 拒绝本地/内网地址（`localhost` / `127.0.0.0/8` / `10.0.0.0/8` / `172.16.0.0/12` / `192.168.0.0/16` / `169.254.0.0/16` / `::1`），避免成为 SSRF 跳板。
- iframe 带 `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"` 与 `referrerPolicy="no-referrer"`。
- 所有端点只读、无副作用。

## 许可证

[MIT](LICENSE)

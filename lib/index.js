/**
 * dsh-git-sidebar — Host 半区
 *
 * 标准 DSH Web 插件(Host 侧):在组合中以 `name: 'dsh-git-sidebar'` 行挂载,
 * 向浏览器提供只读 HTTP 端点:
 *
 *   GET /dsh-git-sidebar/status
 *     在 DSH 进程当前工作目录执行 git status,返回:
 *       - 分支名 / ahead / behind
 *       - 更改文件列表(暂存区 + 工作区 + 未跟踪)
 *       - 统计:已暂存 / 未暂存 / 未跟踪 计数
 *
 *   GET /dsh-git-sidebar/diff?file=<path>&staged=<0|1>
 *     返回单个文件的 diff 文本(默认工作区 diff;staged=1 取暂存区 diff)。
 *
 * 设计原则:端点只读、无副作用、不执行任何写操作(git add/commit/push 等
 * 一律不做);仅调用 git 的只读子命令(status / diff / rev-parse)。
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** 插件自身版本,与 package.json 的 version 字段保持一致。 */
const PLUGIN_VERSION = "0.1.0";

/** git 命令执行超时(毫秒)。 */
const GIT_TIMEOUT_MS = 8000;

/**
 * 在指定目录执行 git 子命令(只读)。
 * @param {string[]} args - git 参数。
 * @param {string} cwd - 工作目录。
 * @returns {Promise<string>} stdout。
 */
async function git(args, cwd) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout;
}

/**
 * 解析 `git status --porcelain=v1 -b` 的输出。
 * @param {string} out - git status 原始输出。
 * @returns {{branch:string,upstream:string|null,ahead:number,behind:number,files:Array}}
 */
function parseStatus(out) {
  const lines = out.split("\n");
  let branch = "(unknown)";
  let upstream = null;
  let ahead = 0;
  let behind = 0;
  const files = [];

  for (const line of lines) {
    if (!line) continue;
    // 分支行:## main...origin/main [ahead 2, behind 1]
    if (line.startsWith("## ")) {
      const head = line.slice(3);
      const m = head.match(/^([^\s.]+)(?:\.\.\.([^\s]+))?(?:\s*\[ahead\s+(\d+)(?:,\s*behind\s+(\d+))?\])?/);
      if (m) {
        branch = m[1];
        upstream = m[2] || null;
        ahead = m[3] ? parseInt(m[3], 10) : 0;
        behind = m[4] ? parseInt(m[4], 10) : 0;
      } else {
        // 分离头状态(如 "No commits yet on main")
        branch = head.split(" ")[0] || "(unknown)";
      }
      continue;
    }
    // 文件行:XY <path>  或  XY <path> -> <rename>
    const xy = line.slice(0, 2);
    const rest = line.slice(3);
    if (rest === undefined) continue;
    let path = rest;
    let renamedFrom = null;
    const arrow = rest.indexOf(" -> ");
    if (arrow >= 0) {
      renamedFrom = rest.slice(0, arrow);
      path = rest.slice(arrow + 4);
    }
    // 去掉路径外的引号(git 对含特殊字符的路径会加引号)
    if (path.startsWith('"') && path.endsWith('"')) {
      path = path.slice(1, -1);
    }
    files.push({
      path,
      renamedFrom,
      x: xy[0], // 暂存区状态
      y: xy[1], // 工作区状态
      staged: xy[0] !== " " && xy[0] !== "?",
      worktree: xy[1] !== " " && xy[1] !== "?",
      untracked: xy === "??",
    });
  }
  return { branch, upstream, ahead, behind, files };
}

/**
 * 把 git 状态码映射为人类可读的中文标签。
 * @param {string} code - 单个状态码字符(M/A/D/R/C/?/ 等)。
 * @returns {string} 中文标签。
 */
function statusLabel(code) {
  const map = {
    " ": " ",
    M: "修改",
    A: "新增",
    D: "删除",
    R: "重命名",
    C: "复制",
    U: "冲突",
    "?": "未跟踪",
    T: "类型变",
  };
  return map[code] || code;
}

/**
 * 采集当前工作目录的 git 状态。
 * @param {string} [cwd] - 工作目录,默认 process.cwd()。
 * @returns {Promise<object>} 状态对象。
 */
async function statusPayload(cwd) {
  const dir = cwd || process.cwd();
  let out;
  try {
    out = await git(["status", "--porcelain=v1", "-b"], dir);
  } catch (error) {
    const msg = String((error && error.message) || error);
    if (/not a git repository|fatal: not a git/i.test(msg)) {
      return { ok: false, error: "not-a-git-repo", cwd: dir };
    }
    return { ok: false, error: msg, cwd: dir };
  }
  const parsed = parseStatus(out);
  const staged = parsed.files.filter((f) => f.staged).length;
  const unstaged = parsed.files.filter((f) => f.worktree).length;
  const untracked = parsed.files.filter((f) => f.untracked).length;
  return {
    ok: true,
    plugin: { name: "dsh-git-sidebar", version: PLUGIN_VERSION },
    cwd: dir,
    timestamp: Date.now(),
    branch: parsed.branch,
    upstream: parsed.upstream,
    ahead: parsed.ahead,
    behind: parsed.behind,
    clean: parsed.files.length === 0,
    counts: { staged, unstaged, untracked, total: parsed.files.length },
    files: parsed.files.map((f) => ({
      path: f.path,
      renamedFrom: f.renamedFrom,
      xLabel: statusLabel(f.x),
      yLabel: statusLabel(f.y),
      staged: f.staged,
      worktree: f.worktree,
      untracked: f.untracked,
      status: f.untracked
        ? "untracked"
        : f.staged && f.worktree
        ? "both"
        : f.staged
        ? "staged"
        : "unstaged",
    })),
  };
}

/**
 * 获取单个文件的 diff 文本。
 * @param {string} file - 文件路径。
 * @param {boolean} staged - 是否取暂存区 diff。
 * @param {string} [cwd] - 工作目录。
 * @returns {Promise<object>} diff 结果。
 */
async function diffPayload(file, staged, cwd) {
  const dir = cwd || process.cwd();
  const args = ["diff", "--no-color"];
  if (staged) args.push("--cached");
  args.push("--", file);
  try {
    const diff = await git(args, dir);
    return { ok: true, file, staged, diff };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error), file };
  }
}

/**
 * 解析工作目录:优先从会话上下文读取,回退到 process.cwd()。
 *
 * 优先级:
 *   1. 显式传入的 cwd 参数(测试用)
 *   2. ctx.sessions 中指定 sessionId 的 meta.cwd
 *   3. ctx.sessions 中第一个活跃会话的 meta.cwd
 *   4. process.cwd()
 *
 * @param {object} [ctx] - cordis 上下文(可选)。
 * @param {string} [sessionId] - 会话 ID(可选)。
 * @returns {string} 工作目录绝对路径。
 */
function resolveCwd(ctx, sessionId) {
  // 1. 尝试从 sessions 服务读
  if (ctx && typeof ctx.get === "function") {
    const sessions = ctx.get("sessions");
    if (sessions) {
      // 指定 sessionId:精确取
      if (sessionId) {
        try {
          const s = sessions.get(sessionId);
          const cwd = s && (s.header && s.header.cwd) || (s.meta && s.meta.cwd) || (s.cwd);
          if (cwd) return cwd;
        } catch {}
      }
      // 未指定:取第一个活跃会话的 cwd
      try {
        const list = sessions.list ? sessions.list() : [];
        for (const s of list) {
          const cwd = (s && s.header && s.header.cwd) || (s.meta && s.meta.cwd) || (s.cwd);
          if (cwd) return cwd;
        }
      } catch {}
    }
  }
  // 2. 回退到进程工作目录
  return process.cwd();
}

/**
 * 插件主体:等待 webServer 就绪后注册只读 git 端点。
 * @param {object} ctx - Host cordis 上下文。
 */
function apply(ctx) {
  ctx.inject(["webServer"], (webCtx) => {
    const sendJson = (res, body, status = 200) => {
      const text = JSON.stringify(body);
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(text);
    };

    webCtx.webServer.register({
      kind: "exact",
      path: "/dsh-git-sidebar/status",
      handler: async (req, res) => {
        try {
          const u = new URL(req.url, "http://localhost");
          const sessionId = u.searchParams.get("session") || "";
          const cwd = resolveCwd(ctx, sessionId);
          const payload = await statusPayload(cwd);
          sendJson(res, payload);
        } catch (error) {
          sendJson(res, { ok: false, error: String((error && error.message) || error) }, 500);
        }
      },
    });

    webCtx.webServer.register({
      kind: "exact",
      path: "/dsh-git-sidebar/diff",
      handler: async (req, res) => {
        try {
          const u = new URL(req.url, "http://localhost");
          const file = u.searchParams.get("file") || "";
          const staged = u.searchParams.get("staged") === "1";
          const sessionId = u.searchParams.get("session") || "";
          if (!file) {
            sendJson(res, { ok: false, error: "missing file param" }, 400);
            return;
          }
          const cwd = resolveCwd(ctx, sessionId);
          const payload = await diffPayload(file, staged, cwd);
          sendJson(res, payload);
        } catch (error) {
          sendJson(res, { ok: false, error: String((error && error.message) || error) }, 500);
        }
      },
    });
  });
}

export { PLUGIN_VERSION, apply, statusPayload, diffPayload, parseStatus, statusLabel, resolveCwd };

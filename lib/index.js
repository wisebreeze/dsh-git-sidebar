/**
 * dsh-browser-plus — Host 半区
 *
 * 标准 DSH Web 插件(Host 侧):在组合中以 `name: 'dsh-browser-plus'` 行挂载,
 * 向浏览器提供两个只读 HTTP 端点:
 *
 *   GET /dsh-browser-plus/resolve?q=<输入>
 *     智能解析输入:若为合法 URL 则返回 {kind:'url', url};否则返回
 *     {kind:'search', url:'https://www.bing.com/search?q=...'}。
 *
 *   GET /dsh-browser-plus/proxy?url=<目标URL>
 *     代理 fetch 目标 URL(解决浏览器跨域限制),返回原始响应体与 content-type。
 *     仅支持 GET,禁止本地/内网地址,避免成为 SSRF 跳板。
 *
 * 设计原则:端点只读、无副作用、不写持久化;代理对目标地址做基本安全校验。
 */

/** 插件自身版本,与 package.json 的 version 字段保持一致。 */
const PLUGIN_VERSION = "0.1.0";

/** Bing 搜索基础 URL。 */
const BING_SEARCH_URL = "https://www.bing.com/search";

/**
 * 判断输入是否为合法的可访问 URL。
 *
 * 规则(宽松但安全):
 *   - 含 scheme(http/https)且 host 合法 → URL
 *   - 形如 example.com / example.com/path / 1.2.3.4 → 补 https:// 后视为 URL
 *   - 含空格、纯数字、明显搜索词 → 非URL
 *
 * @param {string} input - 用户原始输入。
 * @returns {{kind:'url',url:string} | {kind:'search',url:string}}
 */
function resolveInput(input) {
  const raw = String(input == null ? "" : input).trim();
  if (!raw) return { kind: "search", url: BING_SEARCH_URL };

  // 已带 scheme:严格校验 http/https
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw);
  if (withScheme) {
    try {
      const u = new URL(raw);
      if (u.protocol === "http:" || u.protocol === "https:") {
        return { kind: "url", url: u.href };
      }
      // 其他 scheme(mailto/ftp...)不当作网页 URL
    } catch {
      // fallthrough 到搜索
    }
  }

  // 不含空格且像域名:补 https://
  // 域名启发式:至少一个点,且 TLD 段为字母(2+),首段不含空格/特殊符号
  if (!/\s/.test(raw) && /^[^\s/?#]+\.[^\s/?#]+/.test(raw)) {
    // 排除含控制字符的输入
    if (/[\u0000-\u001f]/.test(raw)) return { kind: "search", url: searchUrl(raw) };
    try {
      const u = new URL("https://" + raw);
      const host = u.hostname;
      const lastSeg = host.split(".").pop();
      // host 必须含点,且最后一段是字母(避免 "1.2" 被误判)
      if (host.includes(".") && /^[a-zA-Z]{2,}$/.test(lastSeg)) {
        return { kind: "url", url: u.href };
      }
      // 纯 IPv4
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
        return { kind: "url", url: u.href };
      }
    } catch {
      // fallthrough
    }
  }

  // 其余一律按搜索处理
  return { kind: "search", url: searchUrl(raw) };
}

/**
 * 构造 Bing 搜索 URL。
 * @param {string} query - 搜索关键词。
 * @returns {string} 编码后的搜索 URL。
 */
function searchUrl(query) {
  return BING_SEARCH_URL + "?q=" + encodeURIComponent(String(query));
}

/**
 * 安全校验代理目标:禁止访问本地/内网地址,避免 SSRF。
 * @param {string} url - 目标 URL。
 * @returns {{ok:true,url:string} | {ok:false,error:string}}
 */
function safeProxyTarget(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, error: "invalid url" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "only http/https allowed" };
  }
  const host = u.hostname.toLowerCase();
  // 禁止本地回环 / 内网 / 链路本地
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    return { ok: false, error: "target blocked: private/loopback address" };
  }
  return { ok: true, url: u.href };
}

/**
 * 插件主体:等待 webServer 就绪后注册端点。
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

    // 智能解析输入
    webCtx.webServer.register({
      kind: "exact",
      path: "/dsh-browser-plus/resolve",
      handler: async (req, res) => {
        try {
          const u = new URL(req.url, "http://localhost");
          const q = u.searchParams.get("q") || "";
          sendJson(res, { ok: true, input: q, ...resolveInput(q) });
        } catch (error) {
          sendJson(res, { ok: false, error: String((error && error.message) || error) }, 500);
        }
      },
    });

    // 代理 fetch(解决浏览器跨域)
    webCtx.webServer.register({
      kind: "exact",
      path: "/dsh-browser-plus/proxy",
      handler: async (req, res) => {
        try {
          const u = new URL(req.url, "http://localhost");
          const target = u.searchParams.get("url") || "";
          const check = safeProxyTarget(target);
          if (!check.ok) {
            sendJson(res, { ok: false, error: check.error }, 400);
            return;
          }
          const resp = await fetch(check.url, {
            method: "GET",
            redirect: "follow",
            headers: { "user-agent": "dsh-browser-plus/0.1.0" },
          });
          const contentType = resp.headers.get("content-type") || "application/octet-stream";
          const body = await resp.arrayBuffer();
          res.writeHead(resp.status, {
            "content-type": contentType,
            "cache-control": "no-store",
            "x-dsh-browser-plus-origin": check.url,
          });
          res.end(Buffer.from(body));
        } catch (error) {
          sendJson(res, { ok: false, error: String((error && error.message) || error) }, 502);
        }
      },
    });
  });
}

export { PLUGIN_VERSION, apply, resolveInput, searchUrl, safeProxyTarget };

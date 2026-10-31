/**
 * dsh-browser-plus — 浏览器半区 bundle
 *
 * 由 dsh 的 client 模块系统加载:window.__ModuleLoader__.load 注册本包的
 * factory,工厂内 require 从平台种子表解析(react)。
 *
 * 在 Web 界面注册一个侧边栏浏览器面板:
 *   - 顶部智能输入框:输入网址直接访问,输入非网址走 Bing 搜索
 *   - 中部 iframe 渲染目标页面
 *   - 底部工具栏:后退/前进/刷新/打开新窗口
 *
 * 智能识别策略(与 Host 半区 resolveInput 一致):
 *   - http(s)://example.com → 直接访问
 *   - example.com / example.com/path → 补 https:// 后访问
 *   - 含空格或不像域名 → Bing 搜索
 *
 * 样式策略(与 dsh-about 一致):全部视觉样式直接写在元素级 React style 上,
 * 主题变量 var(--dsw-alias-*) 定义在页面根上,深浅主题自动适配,均带回退值。
 */
window.__ModuleLoader__.load({
  id: "dsh-browser-plus",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");

    /** 浏览器面板字典:zh 为准,en 补齐。 */
    var NS = "browser-plus";
    var DICT = {
      zh: {
        "panel.title": "浏览器",
        "input.placeholder": "输入网址或搜索词…",
        "btn.back": "后退",
        "btn.forward": "前进",
        "btn.refresh": "刷新",
        "btn.open": "在新标签页打开",
        "btn.home": "主页",
        "status.loading": "加载中…",
        "status.empty": "在上方输入网址或搜索词",
        "error.resolve": "无法解析输入",
        "error.load": "页面无法加载(可能被目标站点拒绝嵌入)",
        "hint.search": "将使用 Bing 搜索",
        "hint.url": "将直接访问",
      },
      en: {
        "panel.title": "Browser",
        "input.placeholder": "Enter URL or search…",
        "btn.back": "Back",
        "btn.forward": "Forward",
        "btn.refresh": "Refresh",
        "btn.open": "Open in new tab",
        "btn.home": "Home",
        "status.loading": "Loading…",
        "status.empty": "Enter a URL or search term above",
        "error.resolve": "Unable to resolve input",
        "error.load": "Page cannot be loaded (target site may refuse embedding)",
        "hint.search": "Will search with Bing",
        "hint.url": "Will navigate directly",
      },
    };

    var T = function (k) { return DICT.zh[k] || k; };

    /** 主题色 token(带回退值)。 */
    var THEME = {
      bg: "var(--dsw-alias-bg, #ffffff)",
      bgAlt: "var(--dsw-alias-bg-alt, #f7f7f8)",
      border: "var(--dsw-alias-border-l2, #e5e5e7)",
      text: "var(--dsw-alias-text, #1f1f23)",
      textMuted: "var(--dsw-alias-text-muted, #6b6b73)",
      accent: "var(--dsw-alias-accent, #4d6bfe)",
      accentBg: "var(--dsw-alias-accent-bg, rgba(77,107,254,0.08))",
      danger: "var(--dsw-alias-danger, #e5484d)",
    };

    /** :hover 等无法内联的样式,注入一份 <style>。 */
    var HOVER_CSS = [
      ".dsh-bp-btn:hover { opacity: 0.85; }",
      ".dsh-bp-btn:disabled { opacity: 0.4; cursor: not-allowed; }",
      ".dsh-bp-input:focus { border-color: " + THEME.accent + "; }",
      ".dsh-bp-link:hover { text-decoration: underline; }",
    ].join("\n");

    /**
     * 调用 Host 半区 /dsh-browser-plus/resolve 智能解析输入。
     * @param {string} input - 用户输入。
     * @returns {Promise<{kind:'url'|'search', url:string}>}
     */
    function resolveInput(input) {
      var url = "/dsh-browser-plus/resolve?q=" + encodeURIComponent(input);
      return fetch(url, { headers: { accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data || !data.ok) throw new Error((data && data.error) || "resolve failed");
          return { kind: data.kind, url: data.url };
        });
    }

    /**
     * 侧边栏浏览器主组件。
     */
    function BrowserPanel() {
      var inputRef = React.useRef(null);
      var iframeRef = React.useRef(null);

      var historyRef = React.useRef([]);
      var idxRef = React.useRef(-1);

      var inputState = React.useState("");
      var input = inputState[0];
      var setInput = inputState[1];

      var urlState = React.useState("");
      var currentUrl = urlState[0];
      var setCurrentUrl = urlState[1];

      var hintState = React.useState("");
      var hint = hintState[0];
      var setHint = hintState[1];

      var statusState = React.useState("empty");
      var status = statusState[0];
      var setStatus = statusState[1];

      var canBackState = React.useState(false);
      var canBack = canBackState[0];
      var setCanBack = canBackState[1];

      var canForwardState = React.useState(false);
      var canForward = canForwardState[0];
      var setCanForward = canForwardState[1];

      /** 实时预判输入类型(用于显示 hint,不发起请求)。 */
      React.useEffect(function () {
        var v = input.trim();
        if (!v) { setHint(""); return; }
        // 与 Host resolveInput 同款启发式(轻量版,不发请求)
        var looksLikeUrl = false;
        if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) {
          looksLikeUrl = /^https?:\/\//i.test(v);
        } else if (!/\s/.test(v) && /^[^\s/?#]+\.[^\s/?#]+/.test(v)) {
          var lastSeg = v.split("/")[0].split(".").pop();
          looksLikeUrl = /^[a-zA-Z]{2,}$/.test(lastSeg) || /^(\d{1,3}\.){3}\d{1,3}$/.test(v.split("/")[0]);
        }
        setHint(looksLikeUrl ? T("hint.url") : T("hint.search"));
      }, [input]);

      function updateNav() {
        setCanBack(idxRef.current > 0);
        setCanForward(idxRef.current < historyRef.current.length - 1);
      }

      /** 导航到指定 URL(压入历史)。 */
      function navigateTo(url) {
        if (!url) return;
        // 截断 forward 历史
        historyRef.current = historyRef.current.slice(0, idxRef.current + 1);
        historyRef.current.push(url);
        idxRef.current = historyRef.current.length - 1;
        setCurrentUrl(url);
        setStatus("loading");
        updateNav();
      }

      /** 提交输入:智能解析后导航。 */
      function submitInput() {
        var v = input.trim();
        if (!v) return;
        setStatus("loading");
        resolveInput(v).then(
          function (res) {
            navigateTo(res.url);
          },
          function (err) {
            setStatus("error");
            setHint(String((err && err.message) || err));
          }
        );
      }

      function goBack() {
        if (idxRef.current <= 0) return;
        idxRef.current -= 1;
        setCurrentUrl(historyRef.current[idxRef.current]);
        setStatus("loading");
        updateNav();
      }

      function goForward() {
        if (idxRef.current >= historyRef.current.length - 1) return;
        idxRef.current += 1;
        setCurrentUrl(historyRef.current[idxRef.current]);
        setStatus("loading");
        updateNav();
      }

      function refresh() {
        if (!currentUrl) return;
        setStatus("loading");
        // 通过 key 变化强制 iframe 重新加载
        setCurrentUrl(currentUrl + (currentUrl.indexOf("?") >= 0 ? "&" : "?") + "_dsh_bp=" + Date.now());
      }

      function goHome() {
        historyRef.current = [];
        idxRef.current = -1;
        setCurrentUrl("");
        setInput("");
        setStatus("empty");
        setHint("");
        updateNav();
        if (inputRef.current) inputRef.current.focus();
      }

      function openExternal() {
        if (currentUrl && typeof window !== "undefined") {
          window.open(currentUrl, "_blank", "noopener,noreferrer");
        }
      }

      function onInputKeyDown(e) {
        if (e.key === "Enter" || e.keyCode === 13) {
          e.preventDefault();
          submitInput();
        }
      }

      function onIframeLoad() {
        if (currentUrl) setStatus("loaded");
      }

      // ===== 渲染 =====

      var headerStyle = {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 10px",
        borderBottom: "1px solid " + THEME.border,
        background: THEME.bgAlt,
      };

      var btnStyle = {
        flex: "0 0 auto",
        width: "28px",
        height: "28px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid " + THEME.border,
        borderRadius: "6px",
        background: THEME.bg,
        color: THEME.text,
        cursor: "pointer",
        fontSize: "13px",
        padding: "0",
      };

      var inputWrapStyle = {
        flex: "1 1 auto",
        position: "relative",
        display: "flex",
        alignItems: "center",
      };

      var inputStyle = {
        width: "100%",
        height: "30px",
        padding: "0 10px 0 28px",
        border: "1px solid " + THEME.border,
        borderRadius: "6px",
        background: THEME.bg,
        color: THEME.text,
        fontSize: "13px",
        outline: "none",
        boxSizing: "border-box",
        transition: "border-color 0.15s",
      };

      var searchIconStyle = {
        position: "absolute",
        left: "8px",
        top: "50%",
        transform: "translateY(-50%)",
        color: THEME.textMuted,
        pointerEvents: "none",
        fontSize: "13px",
      };

      var hintStyle = {
        position: "absolute",
        right: "8px",
        top: "50%",
        transform: "translateY(-50%)",
        color: THEME.textMuted,
        fontSize: "11px",
        pointerEvents: "none",
        background: THEME.bgAlt,
        padding: "1px 5px",
        borderRadius: "3px",
      };

      var bodyStyle = {
        flex: "1 1 auto",
        position: "relative",
        background: THEME.bg,
        overflow: "hidden",
      };

      var iframeStyle = {
        width: "100%",
        height: "100%",
        border: "none",
        display: currentUrl ? "block" : "none",
      };

      var placeholderStyle = {
        position: "absolute",
        inset: "0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        color: THEME.textMuted,
        fontSize: "13px",
        padding: "24px",
        textAlign: "center",
      };

      var toolbarStyle = {
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "6px 10px",
        borderTop: "1px solid " + THEME.border,
        background: THEME.bgAlt,
        fontSize: "11px",
        color: THEME.textMuted,
      };

      var linkStyle = {
        color: THEME.accent,
        cursor: "pointer",
        textDecoration: "none",
        maxWidth: "60%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      };

      // 搜索图标(SVG)
      var searchIcon = React.createElement(
        "svg",
        { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
        React.createElement("circle", { cx: "11", cy: "11", r: "7" }),
        React.createElement("path", { d: "m21 21-4.3-4.3" })
      );

      // 后退图标
      var backIcon = React.createElement(
        "svg",
        { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
        React.createElement("path", { d: "M19 12H5" }),
        React.createElement("path", { d: "m12 19-7-7 7-7" })
      );

      // 前进图标
      var forwardIcon = React.createElement(
        "svg",
        { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
        React.createElement("path", { d: "M5 12h14" }),
        React.createElement("path", { d: "m12 5 7 7-7 7" })
      );

      // 刷新图标
      var refreshIcon = React.createElement(
        "svg",
        { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
        React.createElement("path", { d: "M3 12a9 9 0 0 1 15-6.7L21 8" }),
        React.createElement("path", { d: "M21 3v5h-5" }),
        React.createElement("path", { d: "M21 12a9 9 0 0 1-15 6.7L3 16" }),
        React.createElement("path", { d: "M3 21v-5h5" })
      );

      // 外链图标
      var externalIcon = React.createElement(
        "svg",
        { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
        React.createElement("path", { d: "M15 3h6v6" }),
        React.createElement("path", { d: "M10 14 21 3" }),
        React.createElement("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" })
      );

      // 主页图标
      var homeIcon = React.createElement(
        "svg",
        { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
        React.createElement("path", { d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }),
        React.createElement("path", { d: "M9 22V12h6v10" })
      );

      var header = React.createElement(
        "div",
        { style: headerStyle },
        React.createElement("button", { className: "dsh-bp-btn", style: btnStyle, onClick: goBack, disabled: !canBack, title: T("btn.back") }, backIcon),
        React.createElement("button", { className: "dsh-bp-btn", style: btnStyle, onClick: goForward, disabled: !canForward, title: T("btn.forward") }, forwardIcon),
        React.createElement("button", { className: "dsh-bp-btn", style: btnStyle, onClick: refresh, disabled: !currentUrl, title: T("btn.refresh") }, refreshIcon),
        React.createElement("button", { className: "dsh-bp-btn", style: btnStyle, onClick: goHome, title: T("btn.home") }, homeIcon),
        React.createElement(
          "div",
          { style: inputWrapStyle },
          React.createElement("span", { style: searchIconStyle }, searchIcon),
          React.createElement("input", {
            ref: inputRef,
            className: "dsh-bp-input",
            style: inputStyle,
            type: "text",
            value: input,
            placeholder: T("input.placeholder"),
            onChange: function (e) { setInput(e.target.value); },
            onKeyDown: onInputKeyDown,
            spellCheck: false,
            autoComplete: "off",
          }),
          hint
            ? React.createElement("span", { style: hintStyle }, hint)
            : null
        ),
        React.createElement("button", { className: "dsh-bp-btn", style: btnStyle, onClick: openExternal, disabled: !currentUrl, title: T("btn.open") }, externalIcon)
      );

      var body = React.createElement(
        "div",
        { style: bodyStyle },
        currentUrl
          ? React.createElement("iframe", {
              ref: iframeRef,
              style: iframeStyle,
              src: currentUrl,
              onLoad: onIframeLoad,
              sandbox: "allow-scripts allow-same-origin allow-forms allow-popups",
              referrerPolicy: "no-referrer",
            })
          : null,
        !currentUrl
          ? React.createElement(
              "div",
              { style: placeholderStyle },
              React.createElement(
                "svg",
                { width: "40", height: "40", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" },
                React.createElement("circle", { cx: "11", cy: "11", r: "7" }),
                React.createElement("path", { d: "m21 21-4.3-4.3" })
              ),
              React.createElement("div", null, T("status.empty"))
            )
          : null,
        status === "loading" && currentUrl
          ? React.createElement(
              "div",
              { style: { position: "absolute", top: "8px", right: "8px", background: THEME.bgAlt, color: THEME.textMuted, fontSize: "11px", padding: "2px 8px", borderRadius: "4px", border: "1px solid " + THEME.border } },
              T("status.loading")
            )
          : null
      );

      var toolbar = React.createElement(
        "div",
        { style: toolbarStyle },
        currentUrl
          ? [
              React.createElement("span", { key: "label" }, T("btn.open") + ":"),
              React.createElement(
                "a",
                { key: "link", className: "dsh-bp-link", style: linkStyle, href: currentUrl, target: "_blank", rel: "noopener noreferrer", title: currentUrl },
                currentUrl.replace(/^https?:\/\//, "").slice(0, 50)
              ),
            ]
          : React.createElement("span", null, T("panel.title"))
      );

      var rootStyle = {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "0",
        background: THEME.bg,
        color: THEME.text,
        fontFamily: "var(--dsw-alias-font, system-ui, -apple-system, sans-serif)",
      };

      return React.createElement("div", { style: rootStyle }, header, body, toolbar);
    }

    /**
     * 插件入口:注入样式 + 注册侧边栏面板槽位。
     * 这里复用 settings.section 槽位作为演示;实际生产中可注册到
     * 专门的 sidebar 槽位(若 DSH 提供)。
     */
    function apply(ctx) {
      var localeService = ctx.get("locale");
      if (localeService !== undefined) {
        T = localeService.bind(NS);
        ctx.effect(function () { return localeService.register(NS, DICT); }, "dsh-browser-plus: dictionaries");
      } else {
        var lang = (typeof navigator !== "undefined" && (navigator.language || "").toLowerCase()) || "zh";
        var dict = lang.indexOf("zh") === 0 ? DICT.zh : DICT.en;
        T = function (k) { return dict[k] || DICT.zh[k] || k; };
      }

      if (typeof document !== "undefined") {
        ctx.effect(
          function () {
            var tag = document.createElement("style");
            tag.dataset.plugin = "dsh-browser-plus";
            tag.dataset.pluginCss = "dsh-browser-plus/enhance";
            tag.textContent = HOVER_CSS;
            document.head.appendChild(tag);
            return function () { tag.remove(); };
          },
          "dsh-browser-plus: enhance stylesheet"
        );
      }

      ctx.slots.inject("settings.section", function () {
        var spec = {
          name: "settings.section",
          id: "wisebreeze:dsh-browser-plus",
          order: 100,
          label: function () { return T("panel.title"); },
        };
        if (ctx.get("locale") !== undefined) spec.locale = NS;
        return ctx.slots.register(spec, function () { return React.createElement(BrowserPanel, null); });
      });
    }

    exports.apply = apply;
    exports.inject = ["slots"];
    return module.exports;
  },
});

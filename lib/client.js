/**
 * dsh-git-sidebar — 浏览器半区 bundle
 *
 * 由 dsh 的 client 模块系统加载:window.__ModuleLoader__.load 注册本包的
 * factory,工厂内 require 从平台种子表解析(react)。
 *
 * 在 Web 设置面板注册 "Git" 卡片:`settings.section` 槽,order=101
 * (排在浏览器 order=100 下方)。点进去顶部显示当前仓库的 git 更改:
 *   - 分支名 / upstream / ahead / behind
 *   - 已暂存 / 未暂存 / 未跟踪 计数
 *   - 更改文件列表(状态徽标 + 路径)
 *   - 刷新按钮 + 点击文件查看 diff
 *
 * 样式策略(与 dsh-about 一致):全部视觉样式直接写在元素级 React style 上,
 * 主题变量 var(--dsw-alias-*) 定义在页面根上,深浅主题自动适配,均带回退值。
 */
window.__ModuleLoader__.load({
  id: "dsh-git-sidebar",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");

    /** 翻译函数,apply 时注入。 */
    var T = function (k) { return k; };

    /** Git 卡片字典:zh 为准,en 补齐。 */
    var NS = "git-sidebar";
    var DICT = {
      zh: {
        "nav.label": "Git",
        "brand.sub": "当前仓库的 git 更改",
        "status.clean": "工作区干净",
        "status.dirty": "有未提交的更改",
        "status.loading": "读取中…",
        "status.error": "读取失败",
        "status.notrepo": "当前目录不是 git 仓库",
        "row.branch": "分支",
        "row.upstream": "上游",
        "row.ahead": "领先",
        "row.behind": "落后",
        "count.staged": "已暂存",
        "count.unstaged": "未暂存",
        "count.untracked": "未跟踪",
        "count.total": "共",
        "btn.refresh": "刷新",
        "btn.back": "返回列表",
        "diff.empty": "无差异内容",
        "diff.loading": "加载差异…",
        "diff.error": "无法加载差异",
        "file.staged": "已暂存",
        "file.unstaged": "未暂存",
        "file.untracked": "未跟踪",
        "file.both": "暂存+工作区",
        "label.modified": "改",
        "label.added": "增",
        "label.deleted": "删",
        "label.renamed": "移",
        "label.copied": "复",
        "label.conflict": "冲",
        "label.untracked": "新",
        "label.typechange": "型",
        "empty.files": "没有文件更改",
      },
      en: {
        "nav.label": "Git",
        "brand.sub": "Git changes in the current repository",
        "status.clean": "Working tree clean",
        "status.dirty": "Uncommitted changes",
        "status.loading": "Loading…",
        "status.error": "Failed to load",
        "status.notrepo": "Not a git repository",
        "row.branch": "Branch",
        "row.upstream": "Upstream",
        "row.ahead": "Ahead",
        "row.behind": "Behind",
        "count.staged": "Staged",
        "count.unstaged": "Unstaged",
        "count.untracked": "Untracked",
        "count.total": "Total",
        "btn.refresh": "Refresh",
        "btn.back": "Back",
        "diff.empty": "No diff content",
        "diff.loading": "Loading diff…",
        "diff.error": "Failed to load diff",
        "file.staged": "staged",
        "file.unstaged": "unstaged",
        "file.untracked": "untracked",
        "file.both": "staged+worktree",
        "label.modified": "M",
        "label.added": "A",
        "label.deleted": "D",
        "label.renamed": "R",
        "label.copied": "C",
        "label.conflict": "U",
        "label.untracked": "?",
        "label.typechange": "T",
        "empty.files": "No file changes",
      },
    };

    /** 状态码 → 字典 key 映射(用于文件徽标)。 */
    function labelKeyFor(code) {
      var m = {
        M: "label.modified",
        A: "label.added",
        D: "label.deleted",
        R: "label.renamed",
        C: "label.copied",
        U: "label.conflict",
        "?": "label.untracked",
        T: "label.typechange",
      };
      return m[code] || "label.modified";
    }

    /** 状态码 → 徽标颜色。 */
    function badgeColor(code) {
      var m = {
        M: "#d97706",
        A: "#16a34a",
        D: "#dc2626",
        R: "#2563eb",
        C: "#2563eb",
        U: "#9333ea",
        "?": "#6b7280",
        T: "#0891b2",
      };
      return m[code] || "#6b7280";
    }

    /** 文件状态徽标。 */
    function StatusBadge(props) {
      var code = props.code;
      var label = T(labelKeyFor(code));
      var color = badgeColor(code);
      return React.createElement(
        "span",
        {
          style: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "22px",
            height: "20px",
            padding: "0 5px",
            borderRadius: "4px",
            backgroundColor: color,
            color: "#fff",
            fontSize: "11px",
            fontWeight: 600,
            lineHeight: 1,
            flexShrink: 0,
          },
        },
        label
      );
    }

    /** 信息行(标签 + 值)。 */
    function InfoRow(props) {
      return React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "8px 16px",
            borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.08))",
          },
        },
        React.createElement(
          "span",
          { style: { fontSize: "13px", color: "var(--dsw-alias-text-secondary, #6b7280)", minWidth: "56px", flexShrink: 0 } },
          T(props.labelKey)
        ),
        React.createElement(
          "span",
          { style: { fontSize: "13px", color: "var(--dsw-alias-text-primary, #1f2937)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", wordBreak: "break-all" } },
          props.value
        )
      );
    }

    /** 计数徽标。 */
    function CountBadge(props) {
      var colors = {
        staged: "#16a34a",
        unstaged: "#d97706",
        untracked: "#6b7280",
        total: "#2563eb",
      };
      var color = colors[props.kind] || "#6b7280";
      var zero = !props.value;
      return React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            padding: "8px 12px",
            borderRadius: "8px",
            backgroundColor: zero
              ? "var(--dsw-alias-bg-secondary, rgba(0,0,0,0.03))"
              : color + "1a",
            border: "1px solid " + (zero ? "transparent" : color + "40"),
            flex: 1,
            minWidth: 0,
          },
        },
        React.createElement(
          "span",
          { style: { fontSize: "18px", fontWeight: 700, color: zero ? "var(--dsw-alias-text-secondary, #9ca3af)" : color, lineHeight: 1 } },
          String(props.value)
        ),
        React.createElement(
          "span",
          { style: { fontSize: "11px", color: "var(--dsw-alias-text-secondary, #6b7280)" } },
          T("count." + props.kind)
        )
      );
    }

    /** 文件行。 */
    function FileRow(props) {
      var f = props.file;
      var code = f.untracked ? "?" : f.staged ? f.x : f.y;
      return React.createElement(
        "div",
        {
          onClick: props.onClick,
          style: {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 16px",
            cursor: "pointer",
            borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.04))",
          },
        },
        React.createElement(StatusBadge, { code: code }),
        React.createElement(
          "span",
          {
            style: {
              fontSize: "13px",
              color: "var(--dsw-alias-text-primary, #1f2937)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              wordBreak: "break-all",
              flex: 1,
              minWidth: 0,
            },
            title: f.renamedFrom ? f.renamedFrom + " → " + f.path : f.path,
          },
          f.renamedFrom ? f.renamedFrom + " → " + f.path : f.path
        ),
        React.createElement(
          "span",
          { style: { fontSize: "11px", color: "var(--dsw-alias-text-tertiary, #9ca3af)", flexShrink: 0 } },
          T("file." + f.status)
        )
      );
    }

    /** diff 视图。 */
    function DiffView(props) {
      var file = props.file;
      var back = props.back;
      var _state = React.useState({ loading: true, diff: "", error: null });
      var state = _state[0];
      var setState = _state[1];

      React.useEffect(
        function () {
          setState({ loading: true, diff: "", error: null });
          var staged = file.status === "staged" || file.status === "both";
          var url = "/dsh-git-sidebar/diff?file=" + encodeURIComponent(file.path) + "&staged=" + (staged ? "1" : "0");
          fetch(url, { headers: { accept: "application/json" } })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (!data || !data.ok) throw new Error((data && data.error) || "diff failed");
              setState({ loading: false, diff: data.diff || "", error: null });
            })
            .catch(function (err) {
              setState({ loading: false, diff: "", error: String((err && err.message) || err) });
            });
        },
        [file.path, file.status]
      );

      var header = React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 16px",
            borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.08))",
            position: "sticky",
            top: 0,
            backgroundColor: "var(--dsw-alias-bg-primary, #fff)",
            zIndex: 1,
          },
        },
        React.createElement(
          "button",
          {
            onClick: back,
            style: {
              border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.12))",
              background: "transparent",
              color: "var(--dsw-alias-text-primary, #1f2937)",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer",
            },
          },
          "‹ " + T("btn.back")
        ),
        React.createElement(
          "span",
          {
            style: {
              fontSize: "13px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: "var(--dsw-alias-text-primary, #1f2937)",
              wordBreak: "break-all",
              flex: 1,
              minWidth: 0,
            },
          },
          file.path
        ),
        React.createElement(
          "span",
          { style: { fontSize: "11px", color: "var(--dsw-alias-text-secondary, #6b7280)", flexShrink: 0 } },
          T("file." + file.status)
        )
      );

      var body;
      if (state.loading) {
        body = React.createElement(
          "div",
          { style: { padding: "24px 16px", textAlign: "center", color: "var(--dsw-alias-text-secondary, #6b7280)", fontSize: "13px" } },
          T("diff.loading")
        );
      } else if (state.error) {
        body = React.createElement(
          "div",
          { style: { padding: "24px 16px", textAlign: "center", color: "#dc2626", fontSize: "13px" } },
          T("diff.error") + ": " + state.error
        );
      } else if (!state.diff) {
        body = React.createElement(
          "div",
          { style: { padding: "24px 16px", textAlign: "center", color: "var(--dsw-alias-text-secondary, #6b7280)", fontSize: "13px" } },
          T("diff.empty")
        );
      } else {
        var lines = state.diff.split("\n");
        body = React.createElement(
          "pre",
          {
            style: {
              margin: 0,
              padding: "12px 16px",
              fontSize: "12px",
              lineHeight: "1.6",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: "var(--dsw-alias-text-primary, #1f2937)",
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            },
          },
          lines.map(function (line, i) {
            var color = "inherit";
            var bg = "transparent";
            if (line.startsWith("+") && !line.startsWith("+++")) {
              color = "#16a34a";
              bg = "rgba(22,163,74,0.08)";
            } else if (line.startsWith("-") && !line.startsWith("---")) {
              color = "#dc2626";
              bg = "rgba(220,38,38,0.08)";
            } else if (line.startsWith("@@")) {
              color = "#2563eb";
            }
            return React.createElement(
              "div",
              { key: i, style: { color: color, backgroundColor: bg, padding: "0 4px" } },
              line || " "
            );
          })
        );
      }

      return React.createElement("div", null, header, body);
    }

    /** Git 卡片主组件。 */
    function GitPanel() {
      var _state = React.useState({ loading: true, data: null, error: null });
      var state = _state[0];
      var setState = _state[1];

      var _sel = React.useState(null);
      var selected = _sel[0];
      var setSelected = _sel[1];

      function load() {
        setState({ loading: true, data: null, error: null });
        fetch("/dsh-git-sidebar/status", { headers: { accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data || !data.ok) {
              setState({ loading: false, data: null, error: (data && data.error) || "unknown" });
            } else {
              setState({ loading: false, data: data, error: null });
            }
          })
          .catch(function (err) {
            setState({ loading: false, data: null, error: String((err && err.message) || err) });
          });
      }

      React.useEffect(function () {
        load();
      }, []);

      if (state.loading) {
        return React.createElement(
          "div",
          { style: { padding: "32px 16px", textAlign: "center", color: "var(--dsw-alias-text-secondary, #6b7280)", fontSize: "14px" } },
          T("status.loading")
        );
      }

      if (state.error) {
        var errMsg = state.error === "not-a-git-repo" ? T("status.notrepo") : T("status.error") + ": " + state.error;
        return React.createElement(
          "div",
          { style: { padding: "32px 16px", textAlign: "center", color: "#dc2626", fontSize: "13px" } },
          errMsg
        );
      }

      var d = state.data;

      var header = React.createElement(
        "div",
        {
          style: {
            borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.08))",
            position: "sticky",
            top: 0,
            backgroundColor: "var(--dsw-alias-bg-primary, #fff)",
            zIndex: 1,
          },
        },
        React.createElement(InfoRow, { labelKey: "row.branch", value: d.branch }),
        d.upstream
          ? React.createElement(InfoRow, { labelKey: "row.upstream", value: d.upstream })
          : null,
        React.createElement(InfoRow, {
          labelKey: "row.ahead",
          value: (d.ahead || 0) + " / " + T("row.behind") + " " + (d.behind || 0),
        }),
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              gap: "8px",
              padding: "12px 16px",
              borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.08))",
            },
          },
          React.createElement(CountBadge, { kind: "staged", value: d.counts.staged }),
          React.createElement(CountBadge, { kind: "unstaged", value: d.counts.unstaged }),
          React.createElement(CountBadge, { kind: "untracked", value: d.counts.untracked }),
          React.createElement(CountBadge, { kind: "total", value: d.counts.total })
        ),
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 16px",
              borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.08))",
            },
          },
          React.createElement(
            "span",
            {
              style: {
                fontSize: "12px",
                color: d.clean ? "#16a34a" : "var(--dsw-alias-text-secondary, #6b7280)",
                fontWeight: 500,
              },
            },
            d.clean ? "✓ " + T("status.clean") : T("status.dirty")
          ),
          React.createElement(
            "button",
            {
              onClick: load,
              style: {
                border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.12))",
                background: "transparent",
                color: "var(--dsw-alias-text-primary, #1f2937)",
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                cursor: "pointer",
              },
            },
            "↻ " + T("btn.refresh")
          )
        )
      );

      var body;
      if (selected) {
        body = React.createElement(DiffView, {
          file: selected,
          back: function () { setSelected(null); },
        });
      } else if (d.files.length === 0) {
        body = React.createElement(
          "div",
          { style: { padding: "32px 16px", textAlign: "center", color: "var(--dsw-alias-text-secondary, #9ca3af)", fontSize: "13px" } },
          T("empty.files")
        );
      } else {
        body = React.createElement(
          "div",
          null,
          d.files.map(function (f, i) {
            return React.createElement(FileRow, {
              key: f.path + ":" + i,
              file: f,
              onClick: function () { setSelected(f); },
            });
          })
        );
      }

      return React.createElement("div", null, header, body);
    }

    /** enhance 样式(仅补充无法内联的细节,当前为空占位)。 */
    var HOVER_CSS = "";

    /**
     * 插件入口:绑定字典 + 注册 settings.section 槽位。
     * @param {object} ctx - Client cordis 上下文。
     */
    function apply(ctx) {
      var localeService = ctx.get("locale");
      if (localeService !== undefined) {
        T = localeService.bind(NS);
        ctx.effect(function () { return localeService.register(NS, DICT); }, "dsh-git-sidebar: dictionaries");
      } else {
        var lang = (typeof navigator !== "undefined" && (navigator.language || "").toLowerCase()) || "zh";
        var dict = lang.indexOf("zh") === 0 ? DICT.zh : DICT.en;
        T = function (k) { return dict[k] || DICT.zh[k] || k; };
      }

      if (typeof document !== "undefined") {
        ctx.effect(
          function () {
            var tag = document.createElement("style");
            tag.dataset.plugin = "dsh-git-sidebar";
            tag.dataset.pluginCss = "dsh-git-sidebar/enhance";
            tag.textContent = HOVER_CSS;
            document.head.appendChild(tag);
            return function () { tag.remove(); };
          },
          "dsh-git-sidebar: enhance stylesheet"
        );
      }

      ctx.slots.inject("settings.section", function () {
        var spec = {
          name: "settings.section",
          id: "wisebreeze:dsh-git-sidebar",
          order: 101,
          label: function () { return T("nav.label"); },
        };
        if (ctx.get("locale") !== undefined) spec.locale = NS;
        return ctx.slots.register(spec, function () {
          return React.createElement(GitPanel, null);
        });
      });
    }

    exports.apply = apply;
    exports.inject = ["slots"];
    return module.exports;
  },
});

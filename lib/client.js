/**
 * dsh-git-sidebar — 浏览器半区 bundle
 *
 * 由 dsh 的 client 模块系统加载:window.__ModuleLoader__.load 注册本包的
 * factory,工厂内 require 从平台种子表解析(react)。
 *
 * 在 Web 主界面注册一个右侧栏 Git 面板:
 *   - 开始页 guide 卡片(order=35,排在浏览器 order=30 之后)
 *   - 右侧栏 tab 内容(sidebar.right.pane.tab)
 *   - 标签标题(sidebar.right.pane.tab.title)
 * 点进去顶部显示当前仓库的 git 更改:
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
        "guide.title": "Git",
        "guide.description": "查看当前仓库的 git 更改",
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
        "tab.changes": "文件更改",
        "tab.log": "历史 commit",
        "log.loading": "读取历史中…",
        "log.error": "读取历史失败",
        "log.empty": "没有 commit 历史",
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
        "guide.title": "Git",
        "guide.description": "View git changes in the current repository",
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
        "tab.changes": "Changes",
        "tab.log": "History",
        "log.loading": "Loading history…",
        "log.error": "Failed to load history",
        "log.empty": "No commits",
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

    /** 状态码 → 徽标颜色(用 dsw-static 语义色,深浅模式自适应)。 */
    function badgeColor(code) {
      var m = {
        M: "var(--dsw-static-amber-500)",      // 修改-橙
        A: "var(--dsw-static-green-500)",       // 新增-绿
        D: "var(--dsw-static-red-500)",         // 删除-红
        R: "var(--dsw-static-blue-500)",        // 重命名-蓝
        C: "var(--dsw-static-blue-500)",        // 复制-蓝
        U: "var(--dsw-static-amber-600)",       // 冲突-深橙
        "?": "var(--dsw-alias-label-quaternary)", // 未跟踪-最淡
        T: "var(--dsw-static-amber-400)",       // 类型变-浅橙
      };
      return m[code] || "var(--dsw-alias-label-quaternary)";
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
            color: "var(--dsw-alias-label-primary-foreground)",
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
            borderBottom: "1px solid var(--dsw-alias-border-l3)",
          },
        },
        React.createElement(
          "span",
          { style: { fontSize: "13px", color: "var(--dsw-alias-label-secondary)", minWidth: "56px", flexShrink: 0 } },
          T(props.labelKey)
        ),
        React.createElement(
          "span",
          { style: { fontSize: "13px", color: "var(--dsw-alias-label-primary)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", wordBreak: "break-all" } },
          props.value
        )
      );
    }

    /** 计数徽标(用 dsw-static 语义色 + dsw-alias 背景)。 */
    function CountBadge(props) {
      var colors = {
        staged: "var(--dsw-static-green-500)",
        unstaged: "var(--dsw-static-amber-500)",
        untracked: "var(--dsw-alias-label-quaternary)",
        total: "var(--dsw-static-blue-500)",
      };
      var color = colors[props.kind] || "var(--dsw-alias-label-quaternary)";
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
              ? "var(--dsw-alias-bg-layer-1)"
              : "var(--dsw-alias-interactive-bg-hover)",
            border: "1px solid " + (zero ? "var(--dsw-alias-border-l3)" : "var(--dsw-alias-border-l2)"),
            flex: 1,
            minWidth: 0,
          },
        },
        React.createElement(
          "span",
          { style: { fontSize: "18px", fontWeight: 700, color: zero ? "var(--dsw-alias-label-tertiary)" : color, lineHeight: 1 } },
          String(props.value)
        ),
        React.createElement(
          "span",
          { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } },
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
            borderBottom: "1px solid var(--dsw-alias-border-l3)",
          },
        },
        React.createElement(StatusBadge, { code: code }),
        React.createElement(
          "span",
          {
            style: {
              fontSize: "13px",
              color: "var(--dsw-alias-label-primary)",
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
          { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary)", flexShrink: 0 } },
          T("file." + f.status)
        )
      );
    }

    /** diff 视图。 */
    /** 纯 diff 文本渲染(带语法着色),供 DiffView 和 CommitDetail 复用。 */
    function DiffText(props) {
      var text = props.text || "";
      if (!text) {
        return React.createElement("div", { style: { padding: "24px 16px", textAlign: "center", color: "var(--dsw-alias-label-tertiary)", fontSize: "13px" } }, T("diff.empty"));
      }
      var lines = text.split("\n");
      return React.createElement(
        "pre",
        {
          style: {
            margin: 0,
            padding: "12px 16px",
            fontSize: "12px",
            lineHeight: "1.6",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "var(--dsw-alias-label-primary)",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "transparent",
          },
        },
        lines.map(function (line, i) {
          var color = "inherit";
          var bg = "transparent";
          if (line.startsWith("+") && !line.startsWith("+++")) {
            color = "var(--dsw-static-green-500)";
            bg = "var(--dsw-static-green-500-a08)";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            color = "var(--dsw-static-red-500)";
            bg = "var(--dsw-static-red-600-a08)";
          } else if (line.startsWith("@@")) {
            color = "var(--dsw-static-blue-500)";
          }
          return React.createElement(
            "div",
            { key: i, style: { color: color, backgroundColor: bg, padding: "0 4px" } },
            line || " "
          );
        })
      );
    }

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
            borderBottom: "1px solid var(--dsw-alias-border-l3)",
            background: "transparent",
            flex: "0 0 auto",
          },
        },
        React.createElement(
          "button",
          {
            onClick: back,
            style: {
              border: "1px solid var(--dsw-alias-border-l2)",
              background: "transparent",
              color: "var(--dsw-alias-label-primary)",
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
              color: "var(--dsw-alias-label-primary)",
              wordBreak: "break-all",
              flex: 1,
              minWidth: 0,
            },
          },
          file.path
        ),
        React.createElement(
          "span",
          { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary)", flexShrink: 0 } },
          T("file." + file.status)
        )
      );

      var body;
      if (state.loading) {
        body = React.createElement(
          "div",
          { style: { padding: "24px 16px", textAlign: "center", color: "var(--dsw-alias-label-tertiary)", fontSize: "13px" } },
          T("diff.loading")
        );
      } else if (state.error) {
        body = React.createElement(
          "div",
          { style: { padding: "24px 16px", textAlign: "center", color: "var(--dsw-static-red-500)", fontSize: "13px" } },
          T("diff.error") + ": " + state.error
        );
      } else {
        body = React.createElement(DiffText, { text: state.diff });
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

      // tab 切换:changes(文件更改) / log(commit 历史)
      var _tab = React.useState("changes");
      var tab = _tab[0];
      var setTab = _tab[1];

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
          { style: { padding: "32px 16px", textAlign: "center", color: "var(--dsw-alias-label-tertiary)", fontSize: "14px" } },
          T("status.loading")
        );
      }

      if (state.error) {
        var errMsg = state.error === "not-a-git-repo" ? T("status.notrepo") : T("status.error") + ": " + state.error;
        return React.createElement(
          "div",
          { style: { padding: "32px 16px", textAlign: "center", color: "var(--dsw-static-red-500)", fontSize: "13px" } },
          errMsg
        );
      }

      var d = state.data;

      // tab 栏(文件更改 / 历史 commit)
      var tabBar = React.createElement(
        "div",
        {
          style: {
            display: "flex",
            borderBottom: "1px solid var(--dsw-alias-border-l3)",
            background: "transparent",
          },
        },
        React.createElement(TabButton, { active: tab === "changes", onClick: function () { setTab("changes"); setSelected(null); }, label: T("tab.changes") }),
        React.createElement(TabButton, { active: tab === "log", onClick: function () { setTab("log"); setSelected(null); }, label: T("tab.log") })
      );

      // 顶部信息(分支/upstream/ahead-behind/计数/状态/刷新)
      var header = React.createElement(
        "div",
        {
          style: {
            borderBottom: "1px solid var(--dsw-alias-border-l3)",
            background: "transparent",
            flex: "0 0 auto",
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
            },
          },
          React.createElement(
            "span",
            {
              style: {
                fontSize: "12px",
                color: d.clean ? "var(--dsw-static-green-500)" : "var(--dsw-alias-label-secondary)",
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
                border: "1px solid var(--dsw-alias-border-l2)",
                background: "transparent",
                color: "var(--dsw-alias-label-primary)",
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
      if (tab === "log") {
        body = React.createElement(LogView, null);
      } else if (selected) {
        body = React.createElement(DiffView, {
          file: selected,
          back: function () { setSelected(null); },
        });
      } else if (d.files.length === 0) {
        body = React.createElement(
          "div",
          { style: { padding: "32px 16px", textAlign: "center", color: "var(--dsw-alias-label-tertiary)", fontSize: "13px" } },
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

      // 根容器:flex 列布局,header/tabBar 固定,body 滚动
      return React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
            color: "var(--dsw-alias-label-primary)",
            background: "var(--dsw-alias-bg-base)",
          },
        },
        header,
        tabBar,
        React.createElement(
          "div",
          { style: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" } },
          body
        )
      );
    }

    /** Tab 按钮。 */
    function TabButton(props) {
      var active = props.active;
      return React.createElement(
        "button",
        {
          onClick: props.onClick,
          style: {
            flex: 1,
            padding: "10px 16px",
            border: "none",
            borderBottom: active ? "2px solid var(--dsw-alias-brand-primary)" : "2px solid transparent",
            background: "transparent",
            color: active ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-secondary)",
            fontSize: "13px",
            fontWeight: active ? 600 : 400,
            cursor: "pointer",
          },
        },
        props.label
      );
    }

    /** commit 历史视图。 */
    function LogView() {
      var _s = React.useState({ loading: true, data: null, error: null });
      var s = _s[0];
      var setS = _s[1];

      var _sel = React.useState(null);
      var selCommit = _sel[0];
      var setSelCommit = _sel[1];

      function loadLog() {
        setS({ loading: true, data: null, error: null });
        fetch("/dsh-git-sidebar/log?limit=50", { headers: { accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data || !data.ok) {
              setS({ loading: false, data: null, error: (data && data.error) || "unknown" });
            } else {
              setS({ loading: false, data: data, error: null });
            }
          })
          .catch(function (err) {
            setS({ loading: false, data: null, error: String((err && err.message) || err) });
          });
      }

      React.useEffect(function () { loadLog(); }, []);

      if (s.loading) {
        return React.createElement("div", { style: { padding: "24px 16px", textAlign: "center", color: "var(--dsw-alias-label-tertiary)", fontSize: "13px" } }, T("log.loading"));
      }
      if (s.error) {
        var msg = s.error === "not-a-git-repo" ? T("status.notrepo") : T("log.error") + ": " + s.error;
        return React.createElement("div", { style: { padding: "24px 16px", textAlign: "center", color: "var(--dsw-static-red-500)", fontSize: "13px" } }, msg);
      }

      // 选中某条 commit 时,显示其详情(含 diff)
      if (selCommit) {
        return React.createElement(CommitDetail, { hash: selCommit, back: function () { setSelCommit(null); } });
      }

      var commits = (s.data && s.data.commits) || [];
      if (commits.length === 0) {
        return React.createElement("div", { style: { padding: "24px 16px", textAlign: "center", color: "var(--dsw-alias-label-tertiary)", fontSize: "13px" } }, T("log.empty"));
      }

      return React.createElement(
        "div",
        null,
        commits.map(function (c, i) {
          return React.createElement(
            "div",
            {
              key: c.hash + ":" + i,
              onClick: function () { setSelCommit(c.hash); },
              style: {
                padding: "10px 16px",
                borderBottom: "1px solid var(--dsw-alias-border-l3)",
                cursor: "pointer",
              },
            },
            React.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" } },
              React.createElement("span", {
                style: {
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "12px",
                  color: "var(--dsw-alias-brand-primary)",
                  fontWeight: 600,
                },
              }, c.hash.slice(0, 7)),
              React.createElement("span", {
                style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary)" },
              }, c.date ? c.date.slice(0, 10) : "")
            ),
            React.createElement("div", {
              style: { fontSize: "13px", color: "var(--dsw-alias-label-primary)", lineHeight: 1.4 },
            }, c.subject),
            React.createElement("div", {
              style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary)", marginTop: "2px" },
            }, c.author)
          );
        })
      );
    }

    /** 单条 commit 详情(含 diff)。 */
    function CommitDetail(props) {
      var _s = React.useState({ loading: true, data: null, error: null });
      var s = _s[0];
      var setS = _s[1];

      React.useEffect(function () {
        setS({ loading: true, data: null, error: null });
        fetch("/dsh-git-sidebar/show?hash=" + encodeURIComponent(props.hash), { headers: { accept: "application/json" } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data || !data.ok) {
              setS({ loading: false, data: null, error: (data && data.error) || "unknown" });
            } else {
              setS({ loading: false, data: data, error: null });
            }
          })
          .catch(function (err) {
            setS({ loading: false, data: null, error: String((err && err.message) || err) });
          });
      }, [props.hash]);

      var backBtn = React.createElement(
        "button",
        {
          onClick: props.back,
          style: {
            border: "none",
            background: "transparent",
            color: "var(--dsw-alias-brand-primary)",
            fontSize: "13px",
            cursor: "pointer",
            padding: "10px 16px",
          },
        },
        "← " + T("btn.back")
      );

      if (s.loading) {
        return React.createElement("div", null, backBtn, React.createElement("div", { style: { padding: "24px 16px", textAlign: "center", color: "var(--dsw-alias-label-tertiary)", fontSize: "13px" } }, T("diff.loading")));
      }
      if (s.error) {
        return React.createElement("div", null, backBtn, React.createElement("div", { style: { padding: "24px 16px", textAlign: "center", color: "var(--dsw-static-red-500)", fontSize: "13px" } }, T("diff.error") + ": " + s.error));
      }

      var c = s.data.commit;
      var meta = React.createElement(
        "div",
        { style: { padding: "0 16px 12px", borderBottom: "1px solid var(--dsw-alias-border-l3)" } },
        React.createElement("div", { style: { fontSize: "13px", color: "var(--dsw-alias-label-primary)", fontWeight: 600, marginBottom: "6px" } }, c.subject),
        React.createElement("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }, c.hash),
        React.createElement("div", { style: { fontSize: "11px", color: "var(--dsw-alias-label-tertiary)", marginTop: "4px" } }, c.author + " · " + (c.date ? c.date.slice(0, 19).replace("T", " ") : ""))
      );

      var diffBody = s.data.diff
        ? React.createElement(DiffText, { text: s.data.diff })
        : React.createElement("div", { style: { padding: "24px 16px", textAlign: "center", color: "var(--dsw-alias-label-tertiary)", fontSize: "13px" } }, T("diff.empty"));

      return React.createElement("div", null, backBtn, meta, diffBody);
    }

    /** enhance 样式(仅补充无法内联的细节,当前为空占位)。 */
    var HOVER_CSS = "";

    /**
     * 插件入口:绑定字典 + 注册右侧栏 tab type(guide 卡片) + 面板内容 + 标签标题。
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

      /** 右侧栏 tab type 身份:keyed Slot 派发键 + guide 卡片 id。 */
      var TAB_ID = "wisebreeze:dsh-git-sidebar";
      var TAB_KIND = "git";

      /** guide 卡片图标(开始页卡片左侧的小图标)。 */
      function GitGuideIcon(props) {
        var size = (props && props.size) || 20;
        return React.createElement(
          "svg",
          { width: size, height: size, viewBox: "0 0 24 24", fill: "none", style: { display: "block" } },
          React.createElement("path", {
            d: "M6 3a3 3 0 0 0-1 5.83v6.34a3 3 0 1 0 2 0V8.83A3.001 3.001 0 0 0 6 3Z",
            fill: "currentColor",
          }),
          React.createElement("path", {
            d: "M17 5a2 2 0 1 0-2 2v2.5a1.5 1.5 0 0 1-1.5 1.5H10a3.5 3.5 0 0 0-3.5 3.5V15a2 2 0 1 0 2 0v-.5A1.5 1.5 0 0 1 10 13h3.5A3.5 3.5 0 0 0 17 9.5V7a2 2 0 0 0 0-2Z",
            fill: "currentColor",
          })
        );
      }

      // 1. 注册右侧栏 tab type(含 guide 卡片,order=35 排在浏览器 order=30 之后)
      var sidebarRightTabs = ctx.get("sidebarRightTabs");
      if (sidebarRightTabs !== undefined && typeof sidebarRightTabs.register === "function") {
        ctx.effect(function () {
          return sidebarRightTabs.register({
            id: TAB_ID,
            kind: TAB_KIND,
            multiple: false,
            priority: "builtin",
            title: function () { return T("nav.label"); },
            guide: [{
              id: "git-status",
              order: 35,
              title: function () { return T("guide.title"); },
              description: function () { return T("guide.description"); },
              icon: GitGuideIcon,
            }],
          });
        }, "dsh-git-sidebar: tab type");
      }

      // 2. 注册右侧栏面板内容(sidebar.right.pane.tab,key = TAB_ID)
      ctx.slots.inject("sidebar.right.pane.tab", function () {
        var spec = { name: "sidebar.right.pane.tab", key: TAB_ID };
        if (ctx.get("locale") !== undefined) spec.locale = NS;
        return ctx.slots.register(spec, function () {
          return React.createElement(GitPanel, null);
        });
      });

      // 3. 注册标签标题(sidebar.right.pane.tab.title,key = TAB_ID)
      ctx.slots.inject("sidebar.right.pane.tab.title", function () {
        var spec = { name: "sidebar.right.pane.tab.title", key: TAB_ID };
        if (ctx.get("locale") !== undefined) spec.locale = NS;
        return ctx.slots.register(spec, function () {
          return React.createElement("span", null, T("nav.label"));
        });
      });
    }

    exports.apply = apply;
    exports.inject = ["slots", "locale", "sidebarRight", "sidebarRightTabs"];
    return module.exports;
  },
});

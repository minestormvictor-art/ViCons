/* ============================================================================
   ViCons — 畫面 8：MCP 服務（版本釘死 + 42 工具）
   ========================================================================= */
(function () {
  'use strict';
  var el = VC.el, frag = VC.frag;

  var GROUPS = [
    { n: '載入與圖紙', tools: ['load_plan', 'sheet_info', 'sheet_context', 'view_sheet', 'read_sheet_text', 'set_scale', 'find_text', 'sheet_graph'] },
    { n: '量測', tools: ['measure_polygon', 'measure_line', 'measure_surface', 'place_count', 'count_marks', 'symbol_sweep', 'cut_out', 'detect_rooms'] },
    { n: '條件與材料', tools: ['apply_rules', 'edit_condition', 'duplicate_condition', 'split_condition', 'edit_materials', 'derive_base', 'derive_transitions', 'resolve_tag'] },
    { n: '匯出', tools: ['export_report', 'export_takeoff', 'export_marked_pdf', 'export_dxf', 'import_takeoff'] },
    { n: '標註與審查', tools: ['annotate', 'link_annotation', 'list_annotations', 'mark_verdict', 'delete_verdict', 'list_shapes'] },
    { n: '其他', tools: ['one_click', 'find_schedule', 'sweep_schedule_row', 'undo_last', 'edit_shape', 'delete_shape', 'takeoff_summary'] }
  ];

  VC.registerView('mcp', { nav: 'mcp', wide: true }, function (root, ctx) {
    var total = GROUPS.reduce(function (a, g) { return a + g.tools.length; }, 0);

    root.appendChild(ctx.pagehead({
      title: 'MCP 服務',
      sub: 'OpenTakeoff MCP server · 讓 agent 直接開圖、設比例、量測、匯出',
      crumb: '<a href="#overview-2">總覽</a> / MCP 服務',
      actions: [
        el('button', { class: 'btn', onclick: function () { ctx.toast('已複製 mcp.json 片段', 'ok'); } }, '⧉ 複製設定'),
        el('button', { class: 'btn btn--primary', onclick: function () { ctx.toast('stdio 握手測試：OK · 42 tools', 'ok'); } }, '▸ 測試連線')
      ]
    }));

    /* ---------- 連線狀態 ---------- */
    root.appendChild(el('div', { class: 'grid grid--3', style: 'margin-bottom:var(--sp-5)' },
      ctx.card({
        title: '連線狀態', mod: 'card--accent',
        headerRight: ctx.badge('待信任', 'warn'),
        body: frag(
          el('div', { style: 'display:flex; align-items:center; gap:var(--sp-3); margin-bottom:var(--sp-4)' },
            el('span', { class: 'dot dot--warn dot--pulse', style: 'width:10px;height:10px' }),
            el('span', { style: 'font-size:var(--fs-sm)' }, '尚未啟用')),
          el('div', {
            style: 'padding:var(--sp-3); background:var(--warn-wash); border:1px solid var(--warn-line); border-radius:var(--r-md); font-size:var(--fs-xs); line-height:var(--lh-base); color:var(--warn)'
          },
            '需到「連接器管理」頁右上角的自訂連接器入口，對 opentakeoff 按一次「信任」。寫入設定不會自動生效。'))
      }),

      ctx.card({
        title: '版本與來源',
        body: el('dl', { class: 'kv', style: 'grid-template-columns:96px 1fr' },
          el('dt', {}, '版本'), el('dd', {}, '0.9.66'),
          el('dt', {}, '釘死'), el('dd', { style: 'color:var(--ok)' }, '✓ 非浮動 latest'),
          el('dt', {}, '來源'), el('dd', {}, '本地已建置 · 已審查'),
          el('dt', {}, '傳輸'), el('dd', {}, 'stdio'),
          el('dt', {}, '工具數'), el('dd', {}, total + ' 個'),
          el('dt', {}, 'Node'), el('dd', {}, '>= 20（本機 v24.19.0）'),
          el('dt', {}, 'CWD'), el('dd', {}, '不需指定'))
      }),

      ctx.card({
        title: '安全邊界',
        bodyMod: 'card__body--tight',
        body: el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-3)' },
          [
            ['web/scripts/fetch-voice-model.mjs', '不執行', 'warn', '會下載 45 MB 模型；語音對算量非必需，缺席時優雅降級'],
            ['server/（AI 沙箱）', '不啟動', 'ok', '只用 web/ 靜態切片'],
            ['capture/capture_server.py', '不啟動', 'ok', '除非明確要做訓練語料貢獻'],
            ['Contribute 按鈕', '未配置', 'ok', '未設 endpoint 時不發送任何內容']
          ].map(function (r) {
            return el('div', { style: 'display:flex; gap:var(--sp-2); align-items:flex-start' },
              ctx.badge(r[1], r[2]),
              el('div', {},
                el('div', { class: 'u-mono', style: 'font-size:var(--fs-2xs); color:var(--ink-soft)' }, r[0]),
                el('div', { class: 'u-muted', style: 'font-size:var(--fs-2xs)' }, r[3])));
          }))
      })));

    /* ---------- 設定片段 ---------- */
    root.appendChild(ctx.secTitle('設定片段'));
    root.appendChild(el('div', {
      class: 'u-mono',
      style: 'background:var(--bg); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--sp-4); font-size:var(--fs-xs); line-height:1.7; color:var(--ink-soft); overflow-x:auto'
    }, el('pre', { style: 'margin:0' },
      '{\n' +
      '  "mcpServers": {\n' +
      '    "opentakeoff": {\n' +
      '      "command": "C:\\\\Program Files\\\\nodejs\\\\node.exe",\n' +
      '      "args": ["<OPENTAKEOFF_ROOT>\\\\mcp\\\\dist\\\\server.js"],\n' +
      '      "disabled": false\n' +
      '    }\n' +
      '  }\n' +
      '}')));

    /* ---------- 工具清單 ---------- */
    root.appendChild(ctx.secTitle(total + ' 個工具 · 依用途分組'));
    root.appendChild(el('div', { class: 'grid grid--3' },
      GROUPS.map(function (g) {
        return ctx.card({
          title: g.n,
          headerRight: ctx.badge(g.tools.length + ' 個', 'neutral'),
          bodyMod: 'card__body--tight',
          body: el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--sp-1)' },
            g.tools.map(function (t) {
              return el('span', {
                class: 'tag', style: 'cursor:pointer',
                title: '點擊查看工具說明',
                onclick: function () { ctx.toast('工具：' + t, 'info'); }
              }, t);
            }))
        });
      })));
  });
})();

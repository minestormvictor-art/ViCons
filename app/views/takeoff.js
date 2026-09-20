/* ============================================================================
   ViCons — 畫面 3：量測引擎（全螢幕畫布 + 右側檢視器）
   這是唯一 flush 版面：主區不滾動，引擎 iframe 撐滿。
   ========================================================================= */
(function () {
  'use strict';
  var el = VC.el, frag = VC.frag;

  /* 假量測結果，模擬 OpenTakeoff conditions */
  var CONDITIONS = [
    { tag: 'CPT-01', finish: 'Carpet Tile — Interface Urban Retreat', shapes: 12, sf: 3184.5, lf: 0, ea: 0, waste: 5 },
    { tag: 'VNL-02', finish: 'Vinyl Sheet — Altro Aquarius', shapes: 7, sf: 842.25, lf: 96.4, ea: 0, waste: 8 },
    { tag: 'PNT-03', finish: 'Emulsion Paint — Dulux Diamond', shapes: 24, sf: 6120.0, lf: 410.2, ea: 0, waste: 0 },
    { tag: 'SKT-04', finish: 'Skirting — Altro Whiterock 100mm', shapes: 0, sf: 0, lf: 683.7, ea: 0, waste: 10 },
    { tag: 'DR-05', finish: 'Single Leaf Door — FD60', shapes: 0, sf: 0, lf: 0, ea: 18, waste: 0 }
  ];

  function fmt(n, d) { return n.toLocaleString('en-US', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }); }

  VC.registerView('takeoff', { nav: 'takeoff', flush: true, wide: true }, function (root, ctx) {
    var wrap = el('div', { class: 'stage' });

    /* 窄屏時檢視器收成抽屜，這個遮罩讓點擊空白處可關閉 */
    var scrim = el('div', {
      class: 'stage__scrim',
      onclick: function () { closeInsp(); }
    });

    function openInsp() { inspector.classList.add('is-open'); scrim.classList.add('is-open'); }
    function closeInsp() { inspector.classList.remove('is-open'); scrim.classList.remove('is-open'); }
    function toggleInsp() {
      if (inspector.classList.contains('is-open')) closeInsp(); else openInsp();
    }

    /* ================= 左：畫布區 ================= */
    var canvas = el('div', { style: 'display:grid; grid-template-rows:auto 1fr auto; min-height:0; background:var(--canvas)' });

    /* 工具列 */
    canvas.appendChild(el('div', {
      style: 'display:flex; align-items:center; gap:var(--sp-3); padding:var(--sp-2) var(--sp-4); border-bottom:1px solid var(--line); background:var(--panel); flex-wrap:wrap'
    },
      el('div', { class: 'seg' },
        el('button', { class: 'seg__btn', 'aria-pressed': 'true' }, '面積'),
        el('button', { class: 'seg__btn', 'aria-pressed': 'false' }, '長度'),
        el('button', { class: 'seg__btn', 'aria-pressed': 'false' }, '計數')),
      el('div', { style: 'width:1px; height:18px; background:var(--line)' }),
      el('button', { class: 'btn btn--sm', onclick: function () { ctx.toast('房間自動偵測完成：12 個房間，3 個待確認', 'ok'); } }, '⌗ 房間偵測'),
      el('button', { class: 'btn btn--sm' }, '▨ Hatch 識別'),
      el('button', { class: 'btn btn--sm' }, '⟳ 卷材排版'),
      el('div', { style: 'width:1px; height:18px; background:var(--line)' }),
      el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, '比例'),
      el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2)' },
        el('input', { class: 'input input--mono', style: 'width:110px; height:26px', value: '1:100', 'aria-label': '圖面比例' }),
        ctx.badge('已確認', 'ok')),
      el('div', { style: 'margin-left:auto; display:flex; align-items:center; gap:var(--sp-2)' },
        el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, 'p.12 / 42'),
        el('button', { class: 'btn btn--sm btn--icon' }, '‹'),
        el('button', { class: 'btn btn--sm btn--icon' }, '›'),
        el('span', { style: 'width:1px; height:18px; background:var(--line)' }),
        el('button', { class: 'btn btn--sm' }, '⊞'),
        el('button', { class: 'btn btn--sm' }, '⊟'),
        /* 只在窄屏出現：把溯源檢視器叫出來（業務規則不允許把它藏掉） */
        el('button', {
          class: 'btn btn--sm stage__insp-toggle',
          'aria-label': '開啟溯源檢視器',
          onclick: toggleInsp
        }, '☰ 溯源'),
        el('button', { class: 'btn btn--sm', onclick: function () { ctx.toast('已切換至全螢幕畫布', 'info'); } }, '⛶'))));

    /* 畫布：以 SVG 示意圖紙，證明 dark HUD 對圖紙的可讀性 */
    canvas.appendChild(el('div', {
      style: 'position:relative; overflow:hidden; display:grid; place-items:center; background:radial-gradient(circle at 50% 40%, var(--canvas-sheet), var(--canvas) 70%)'
    },
      el('div', {
        style: 'position:absolute; inset:0; opacity:.35; background-image:linear-gradient(var(--pure-white)08 1px, transparent 1px), linear-gradient(90deg, var(--pure-white)08 1px, transparent 1px); background-size:28px 28px'
      }),
      el('div', { html: svgPlan(), style: 'position:relative; width:min(760px, 88%); filter:drop-shadow(0 14px 40px var(--pure-black)90)' }),
      /* 浮動 chips */
      el('div', { style: 'position:absolute; top:var(--sp-4); left:var(--sp-4); display:flex; gap:var(--sp-2)' },
        ctx.pill('載入中 0.0s · 已就緒', 'dot--ok'),
        ctx.pill('條件 5 · 圖形 43', '')),
      el('div', { style: 'position:absolute; bottom:var(--sp-4); right:var(--sp-4); display:flex; gap:var(--sp-2)' },
        el('button', { class: 'btn btn--sm' }, '↶ 復原'),
        el('button', { class: 'btn btn--sm' }, '⇩ 匯出 CSV'),
        el('button', { class: 'btn btn--sm btn--primary', onclick: function () { ctx.go('bridge'); } }, '⇄ 送往算量接口'))));

    /* 底部狀態列 */
    canvas.appendChild(el('div', {
      style: 'display:flex; align-items:center; gap:var(--sp-4); padding:var(--sp-2) var(--sp-4); border-top:1px solid var(--line); background:var(--panel); font-size:var(--fs-xs); color:var(--ink-faint)'
    },
      el('span', {}, '比例來源：標題欄自動讀取'),
      el('span', {}, '·'),
      el('span', {}, '量測記錄 43 筆'),
      el('span', {}, '·'),
      el('span', {}, '方法：多邊形 31 / 線段 9 / 計數 3'),
      el('div', { style: 'margin-left:auto; display:flex; gap:var(--sp-4)' },
        el('span', {}, '操作者：示範使用者'),
        el('span', {}, '2026-09-19 16:42'))));

    /* ================= 右：檢視器 ================= */
    var totalSf = CONDITIONS.reduce(function (a, c) { return a + c.sf; }, 0);

    var inspector = el('aside', { class: 'inspector', id: 'inspector' },
      el('div', { class: 'inspector__head' },
        el('h4', {}, '量測條件'),
        el('div', { class: 'spacer', style: 'flex:1' }),
        ctx.badge('5 項', 'neutral'),
        /* 窄屏抽屜的關閉鈕；寬屏時隨 toggle 一併隱藏 */
        el('button', {
          class: 'btn btn--sm btn--icon stage__insp-toggle',
          'aria-label': '關閉溯源檢視器',
          onclick: closeInsp
        }, '✕')),

      el('div', { class: 'inspector__body' },
        /* 條件清單 */
        el('div', { class: 'inspector__section' },
          el('div', { class: 'inspector__label' }, '條件'),
          el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-2)' },
            CONDITIONS.map(function (c, i) {
              return el('div', {
                style: 'border:1px solid ' + (i === 0 ? 'var(--cobalt)' : 'var(--line)') + '; background:' + (i === 0 ? 'var(--cobalt-wash)' : 'var(--panel)') + '; border-radius:var(--r-md); padding:var(--sp-3); cursor:pointer'
              },
                el('div', { style: 'display:flex; align-items:center; gap:var(--sp-2); margin-bottom:var(--sp-2)' },
                  ctx.tag(c.tag),
                  el('div', { class: 'spacer', style: 'flex:1' }),
                  el('span', { class: 'u-muted', style: 'font-size:var(--fs-2xs)' }, c.shapes + ' 形')),
                el('div', { style: 'font-size:var(--fs-xs); color:var(--ink-soft); margin-bottom:var(--sp-2)' }, c.finish),
                el('div', { style: 'display:flex; gap:var(--sp-4); font-family:var(--font-mono); font-size:var(--fs-xs)' },
                  c.sf ? el('span', {}, fmt(c.sf) + ' SF') : null,
                  c.lf ? el('span', {}, fmt(c.lf, 1) + ' LF') : null,
                  c.ea ? el('span', {}, c.ea + ' EA') : null,
                  c.waste ? el('span', { class: 'u-muted' }, '損耗 ' + c.waste + '%') : null));
            }))),

        /* 合計 */
        el('div', { class: 'inspector__section' },
          el('div', { class: 'inspector__label' }, '本頁合計'),
          el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-2)' },
            [['面積', fmt(totalSf) + ' SF', fmt(totalSf * 0.0929, 1) + ' m²'],
             ['長度', '1,190.3 LF', '362.8 m'],
             ['計數', '18 EA', '18 EA']].map(function (r) {
              return el('div', {
                style: 'display:flex; align-items:baseline; gap:var(--sp-2); padding:var(--sp-2) var(--sp-3); background:var(--panel); border:1px solid var(--line); border-radius:var(--r-sm)'
              },
                el('span', { style: 'font-size:var(--fs-xs); color:var(--ink-faint); width:40px' }, r[0]),
                el('span', { style: 'font-family:var(--font-mono); font-weight:var(--fw-semi); flex:1; text-align:right' }, r[1]),
                el('span', { class: 'u-muted u-mono', style: 'font-size:var(--fs-2xs); width:64px; text-align:right' }, r[2]));
            }))),

        /* 溯源（本機既有要求：每筆記錄 scale / method / who） */
        el('div', { class: 'inspector__section' },
          el('div', { class: 'inspector__label' }, '溯源'),
          el('dl', { class: 'kv' },
            el('dt', {}, '圖紙'), el('dd', {}, 'AC-2024-045-A-013'),
            el('dt', {}, '比例'), el('dd', {}, '1:100（自動／已確認）'),
            el('dt', {}, '單位'), el('dd', {}, 'imperial (SF/LF)'),
            el('dt', {}, '操作者'), el('dd', {}, '示範使用者'),
            el('dt', {}, '時間'), el('dd', {}, '2026-09-19 16:42'))),

        /* 送往接口 */
        el('div', { class: 'inspector__section' },
          el('button', { class: 'btn btn--primary btn--block', onclick: function () { ctx.go('bridge'); } }, '⇄ 送往算量接口'),
          el('div', { class: 'u-muted', style: 'font-size:var(--fs-2xs); line-height:var(--lh-base)' },
            '量測只給量、不給價。單價由 SoR 造價核心決定，缺單價會自動標紅列入報價審查。')))
    );

    wrap.appendChild(canvas);
    wrap.appendChild(scrim);
    wrap.appendChild(inspector);
    root.appendChild(wrap);
  });

  /* ---------- 圖紙示意 SVG（暗底、淺線，符合 dark HUD） ---------- */
  function svgPlan() {
    return [
      '<svg viewBox="0 0 760 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="平面圖示意，顯示已量測的房間多邊形">',
      '<defs>',
      '<pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">',
      '<line x1="0" y1="0" x2="0" y2="6" stroke="var(--cobalt)" stroke-width="1.4" opacity=".55"/></pattern>',
      '</defs>',
      '<rect x="0" y="0" width="760" height="420" fill="var(--canvas-sheet)" stroke="var(--line)"/>',
      /* 標題欄 */
      '<rect x="530" y="330" width="228" height="88" fill="var(--canvas-title)" stroke="var(--line-strong)"/>',
      '<line x1="530" y1="352" x2="758" y2="352" stroke="var(--line)"/>',
      '<line x1="530" y1="374" x2="758" y2="374" stroke="var(--line)"/>',
      '<line x1="530" y1="396" x2="758" y2="396" stroke="var(--line)"/>',
      '<line x1="640" y1="330" x2="640" y2="418" stroke="var(--line)"/>',
      '<text x="540" y="345" fill="var(--ink-faint)" font-size="8" font-family="Consolas,monospace">DWG. NO.</text>',
      '<text x="648" y="345" fill="var(--ink-soft)" font-size="8" font-family="Consolas,monospace">AC-2024-045-A-013</text>',
      '<text x="540" y="367" fill="var(--ink-faint)" font-size="8" font-family="Consolas,monospace">TITLE</text>',
      '<text x="648" y="367" fill="var(--ink-soft)" font-size="8" font-family="Consolas,monospace">PROPOSED LAYOUT</text>',
      '<text x="540" y="389" fill="var(--ink-faint)" font-size="8" font-family="Consolas,monospace">SCALE</text>',
      '<text x="648" y="389" fill="var(--ink-soft)" font-size="8" font-family="Consolas,monospace">1:100 @ A3</text>',
      '<text x="540" y="411" fill="var(--ink-faint)" font-size="8" font-family="Consolas,monospace">REV</text>',
      '<text x="648" y="411" fill="var(--ink-soft)" font-size="8" font-family="Consolas,monospace">C05</text>',
      /* 外牆 */
      '<path d="M60 60 H470 V150 H400 V240 H470 V320 H60 Z" fill="none" stroke="var(--line-drawing)" stroke-width="2"/>',
      /* 內隔間 */
      '<line x1="230" y1="60" x2="230" y2="320" stroke="var(--line-drawing)" stroke-width="1.4"/>',
      '<line x1="60" y1="200" x2="230" y2="200" stroke="var(--line-drawing)" stroke-width="1.4"/>',
      /* 已量測多邊形（藍色填滿 + hatch） */
      '<polygon points="64,64 226,64 226,196 64,196" fill="var(--cobalt)22" stroke="var(--cobalt)" stroke-width="1.6"/>',
      '<polygon points="64,64 226,64 226,196 64,196" fill="url(#hatch)" stroke="none"/>',
      '<polygon points="234,64 466,64 466,146 234,146" fill="var(--cobalt)22" stroke="var(--cobalt)" stroke-width="1.6"/>',
      '<polygon points="234,64 466,64 466,146 234,146" fill="url(#hatch)" stroke="none"/>',
      /* 選中的多邊形（高亮 + 頂點） */
      '<polygon points="234,204 396,204 396,316 234,316" fill="var(--cobalt)33" stroke="var(--info)" stroke-width="2.2"/>',
      '<circle cx="234" cy="204" r="3.6" fill="var(--info)"/><circle cx="396" cy="204" r="3.6" fill="var(--info)"/>',
      '<circle cx="396" cy="316" r="3.6" fill="var(--info)"/><circle cx="234" cy="316" r="3.6" fill="var(--info)"/>',
      /* 尺寸標註 */
      '<line x1="234" y1="326" x2="396" y2="326" stroke="var(--warn)" stroke-width="1"/>',
      '<line x1="234" y1="322" x2="234" y2="330" stroke="var(--warn)" stroke-width="1"/>',
      '<line x1="396" y1="322" x2="396" y2="330" stroke="var(--warn)" stroke-width="1"/>',
      '<text x="300" y="340" fill="var(--warn)" font-size="9" font-family="Consolas,monospace" text-anchor="middle">5.40 m</text>',
      /* 計數標記 */
      '<circle cx="480" cy="200" r="9" fill="var(--ok)22" stroke="var(--ok)" stroke-width="1.4"/>',
      '<text x="480" y="203" fill="var(--ok)" font-size="8" font-family="Consolas,monospace" text-anchor="middle">D5</text>',
      '<circle cx="480" cy="232" r="9" fill="var(--ok)22" stroke="var(--ok)" stroke-width="1.4"/>',
      '<text x="480" y="235" fill="var(--ok)" font-size="8" font-family="Consolas,monospace" text-anchor="middle">D6</text>',
      /* 方向註記（本機既有規範） */
      '<text x="64" y="48" fill="var(--ink-faint)" font-size="8" font-family="Consolas,monospace">↑UP=LID</text>',
      '<text x="150" y="48" fill="var(--ink-faint)" font-size="8" font-family="Consolas,monospace">↓DOWN=BASE</text>',
      '</svg>'
    ].join('');
  }
})();

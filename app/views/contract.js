/* ============================================================================
   ViCons — 畫面 13 · 合約類型                     app/views/contract.js
   ----------------------------------------------------------------------------
   對應 VicBid「合同类型」，改寫成深色設計語言。

   職責：選定合約類型，並載入該類型對應的差異化條款庫。
        選錯類型的代價很高（風險分配完全不同），所以三張卡要一眼可比。

   設計決定：卡片上直接顯示「風險承擔方」與「最適用情境」，
            而不是只寫一段描述 —— 決策者要的是比較，不是介紹。
   ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var el = VC.el;

  var TYPES = {
    lump_sum: {
      zh: '總價合約', en: 'Lump Sum Contract', icon: '▤', accent: 'var(--cobalt)',
      desc: '承包商以固定總價承擔工程，價格風險由承包商承擔。',
      risk: '價格風險：承包商', best: '圖則齊全、範圍明確的工程',
      clauses: [
        { section: '商務標', items: ['固定總價報價書', '價格調整條款', '變更管理程序', '支付條款', '保留金條款'] },
        { section: '技術標', items: ['施工總進度計劃', '施工方案與方法', '質量保證計劃', '安全施工方案', '環保措施'] },
        { section: '風險與承諾', items: ['價格風險承諾', '工期承諾', '質量擔保', '完工擔保', '保險要求'] },
        { section: '合約管理', items: ['變更索賠程序', '爭議解決機制', '違約責任', '合約終止條件'] }
      ]
    },
    nec: {
      zh: 'NEC 合約', en: 'NEC Contract', icon: '⇄', accent: 'var(--ok)',
      desc: '新工程合約，強調合作管理、早期警告與補償事件。',
      risk: '價格風險：分擔', best: '範圍未定、需邊做邊改的工程',
      clauses: [
        { section: '商務標', items: ['費率表', '補償事件程序', '早期警告機制', '風險評估', '項目管理計劃'] },
        { section: '技術標', items: ['施工進度計劃', '信息分配', '質量計劃', '健康安全計劃', '環境管理'] },
        { section: '風險與承諾', items: ['合作承諾', '風險分擔條款', '早期警告義務', '補償事件通知', '保險條款'] },
        { section: '合約管理', items: ['項目經理職責', '裁決人機制', '爭議解決', '變更程序'] }
      ]
    },
    term: {
      zh: '定期合約', en: 'Term Contract', icon: '⟳', accent: 'var(--warn)',
      desc: '按單價與實際工作量結算，適用維修、保養及週期性服務。',
      risk: '價格風險：按量結算', best: '維修保養、工作量浮動的服務',
      clauses: [
        { section: '商務標', items: ['單價費率表', '工作量調減條款', '價格調整機制', '最低工作量保證', '支付條款'] },
        { section: '技術標', items: ['服務方案', '響應時間承諾', '質量標準', '人員配置', '設備配置'] },
        { section: '風險與承諾', items: ['單價風險', '工作量波動風險', '服務質量承諾', '續約條件', '保險要求'] },
        { section: '合約管理', items: ['定期評估', '續約與終止', '變更程序', '爭議解決'] }
      ]
    }
  };

  var DETECTED = 'nec';          /* 模擬「標書自動偵測」結果 */
  var SELECTED = 'nec';          /* 目前選定 */
  var checked = {};              /* 條款勾選態 */

  function keyOf(type, section, item) { return type + '::' + section + '::' + item; }

  function isChecked(type, section, item) {
    var k = keyOf(type, section, item);
    return checked[k] === undefined ? true : checked[k];
  }

  /* ---------- 類型卡 ---------- */
  function typeCard(ctx, key, t) {
    var on = SELECTED === key;

    var icon = el('div', {
      style: 'width:38px; height:38px; border-radius:var(--r-md); display:grid; place-items:center; font-size:18px; background:' + (on ? 'var(--cobalt-wash)' : 'var(--panel-2)') + '; border:1px solid ' + (on ? 'var(--cobalt-line)' : 'var(--line)') + '; color:' + t.accent
    }, t.icon);

    var titleBox = el('div', {},
      el('div', { class: 'u-strong' }, t.zh),
      el('div', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, t.en));

    var top = el('div', { style: 'display:flex; align-items:center; gap:var(--sp-3)' },
      icon, titleBox,
      el('div', { class: 'spacer' }),
      DETECTED === key ? VC.badge('標書偵測', 'info') : null,
      on ? el('span', { style: 'color:var(--cobalt-ink); font-size:var(--fs-xs)' }, '● 已選') : null);

    var risk = el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--sp-1); margin-top:var(--sp-3)' },
      VC.tag(t.risk),
      VC.tag(t.best));

    var clauseChips = el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--sp-1); margin-top:var(--sp-3)' });
    t.clauses.forEach(function (cl) { clauseChips.appendChild(VC.tag(cl.section + ' ' + cl.items.length)); });

    var card = el('div', {
      class: 'card card--interactive' + (on ? ' card--accent' : ''),
      onclick: function () { SELECTED = key; VC.toast('已選擇 ' + t.zh + '，已載入對應條款庫', 'ok'); ctx.go('contract'); }
    },
      el('div', { class: 'card__body' },
        top,
        el('p', { class: 'u-soft', style: 'margin:var(--sp-3) 0 0; font-size:var(--fs-sm); line-height:var(--lh-loose)' }, t.desc),
        risk,
        clauseChips));

    return card;
  }

  /* ---------- 條款明細 ---------- */
  function clauseDetail(ctx) {
    var t = TYPES[SELECTED];
    var body = el('div', { class: 'card__body' });

    t.clauses.forEach(function (cl) {
      var rows = el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-1)' });

      cl.items.forEach(function (it) {
        var on = isChecked(SELECTED, cl.section, it);
        var box = el('input', { type: 'checkbox' });
        box.checked = on;
        box.addEventListener('change', function (e) {
          checked[keyOf(SELECTED, cl.section, it)] = e.target.checked;
          VC.toast(e.target.checked ? '已納入：' + it : '已剔出：' + it, e.target.checked ? 'ok' : 'warn', 1400);
        });

        rows.appendChild(el('label', {
          style: 'display:flex; align-items:center; gap:var(--sp-3); padding:var(--sp-2) var(--sp-3); border:1px solid var(--line); border-radius:var(--r-sm); background:var(--panel-2); cursor:pointer'
        }, box, el('span', { style: 'font-size:var(--fs-sm)' + (on ? '' : '; color:var(--ink-faint); text-decoration:line-through') }, it)));
      });

      body.appendChild(el('div', { style: 'margin-bottom:var(--sp-5)' },
        el('div', { class: 'kicker', style: 'display:block; margin-bottom:var(--sp-2)' }, cl.section),
        rows));
    });

    var head = el('div', { class: 'card__header' },
      el('h3', {}, t.zh + ' — 條款明細'),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已匯出 ' + t.en + '_Clauses.xlsx', 'ok'); } }, '⇩ 匯出條款'),
      el('button', { class: 'btn btn--sm btn--primary', onclick: function () { ctx.go('nav-map'); } }, '下一步：提交導航器 →'));

    return el('div', { class: 'card' }, head, body);
  }

  /* ---------- 五態 ---------- */
  function renderData(root, ctx) {
    root.appendChild(ctx.pagehead({
      title: '合約類型',
      sub: '選定類型後，系統載入該類型的差異化條款庫、承諾與風險章節模板',
      actions: [DETECTED ? VC.pill('標書偵測：' + TYPES[DETECTED].zh, 'dot--ok') : null]
    }));

    var grid = el('div', { class: 'grid grid--3' });
    Object.keys(TYPES).forEach(function (k) { grid.appendChild(typeCard(ctx, k, TYPES[k])); });
    root.appendChild(grid);

    root.appendChild(ctx.secTitle('條款明細'));
    root.appendChild(clauseDetail(ctx));
  }

  function renderEmpty(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '合約類型', sub: '尚未有標書可判斷' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'empty', icon: '▤', title: '還沒有標書可判斷合約類型',
        desc: '合約類型通常寫在標書的投標須知或合約條件一節。先匯入標書，系統會自動偵測；也可以直接從下方三種手動選。',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { ctx.go('intake'); } }, '⇪ 匯入標書'),
          el('button', { class: 'btn', onclick: function () { VC.toast('可直接在下方手動選擇類型', 'info'); } }, '手動選擇')
        ]
      })
    }));
    var grid = el('div', { class: 'grid grid--3' });
    Object.keys(TYPES).forEach(function (k) { grid.appendChild(typeCard(ctx, k, TYPES[k])); });
    root.appendChild(grid);
  }

  function renderLoading(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '合約類型', sub: '正在比對標書條款…' }));
    var grid = el('div', { class: 'grid grid--3' });
    for (var i = 0; i < 3; i++) {
      grid.appendChild(el('div', { class: 'card' },
        el('div', { class: 'card__body' },
          el('div', { class: 'skel skel--title' }),
          el('div', { class: 'skel skel--line', style: 'width:90%' }),
          el('div', { class: 'skel skel--line', style: 'width:76%' }),
          el('div', { class: 'skel skel--line', style: 'width:58%' }))));
    }
    root.appendChild(grid);
  }

  function renderError(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '合約類型', sub: '偵測失敗' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'error', icon: '✕', title: '無法自動偵測合約類型',
        desc: '標書可能是掃描影像，沒有可提取的文字層，所以無法判斷條款類型。請改為手動選擇 —— 三種類型的條款庫都仍然可用。',
        detail: '來源：示範標書.pdf（第 1–48 頁）\n文字層：0 字（全為影像）\n建議：改用 OCR 版本，或手動選擇合約類型',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('已切換為手動選擇', 'info'); } }, '改為手動選擇'),
          el('button', { class: 'btn', onclick: function () { ctx.go('intake'); } }, '重新匯入')
        ]
      })
    }));
  }

  function renderDegraded(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '合約類型', sub: '條款庫版本較舊' }));
    root.appendChild(el('div', { class: 'card card--accent' },
      el('div', { class: 'card__body' },
        ctx.state({
          kind: 'warn', icon: '!', title: '條款庫未對應最新版合約條件',
          desc: '目前載入的是 2024 年版條款模板，但標書引用的是較新的合約條件。勾選前請逐項對照標書原文，不要直接沿用。',
          actions: [el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已標示 3 項需人工覆核的條款', 'warn'); } }, '標示需覆核項')]
        }))));
    root.appendChild(clauseDetail(ctx));
  }

  VC.registerView('contract', { nav: 'contract' }, function (root, ctx) {
    VC.dev.screen('contract', root, ctx, {
      data: renderData, empty: renderEmpty, loading: renderLoading,
      error: renderError, degraded: renderDegraded
    });
  });
})();

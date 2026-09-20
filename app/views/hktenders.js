/* ============================================================================
   ViCons — 畫面 10 · 現在招標                      app/views/hktenders.js
   ----------------------------------------------------------------------------
   對應 VicBid「现在招标」，改寫成深色設計語言。

   職責：把「現在有咩可以投」做實 —— 平台入口、招標日曆、與自身資格初篩。
        這是整條投標鏈的起點，所以在側邊欄排在投標準備第一項。

   慣例：佈局用 inline style + 間距變數，不另立工具類（跟隨既有 codebase 慣例）
   ========================================================================= */
(function () {
  'use strict';
  var VC = window.VC;
  var el = VC.el;

  var FLEX_ROW = 'display:flex; align-items:center; gap:var(--sp-3)';
  var FLEX_BET = 'display:flex; align-items:center; justify-content:space-between; gap:var(--sp-3)';

  /* ---------- 示範資料（已去識別化，不含任何真實機構或合約編號） ---------- */
  var PLATFORMS = [
    { name: 'GovHK 政府招標', desc: '政府物料供應及採購', url: 'https://www.gov.hk/tc/residents/government/tender.htm', tag: '中央' },
    { name: 'ArchSD 建築署', desc: '樓宇及設施工程', url: 'https://www.archsd.gov.hk/', tag: '樓宇' },
    { name: 'CEDD 土木工程拓展署', desc: '土地及基礎建設', url: 'https://www.cedd.gov.hk/', tag: '土木' },
    { name: 'HyD 路政署', desc: '道路及橋樑工程', url: 'https://www.hyd.gov.hk/', tag: '土木' },
    { name: 'DSD 渠務署', desc: '污水及雨水排放', url: 'https://www.dsd.gov.hk/', tag: '土木' },
    { name: 'WSD 水務署', desc: '供水及水管工程', url: 'https://www.wsd.gov.hk/', tag: '土木' },
    { name: 'EMSD 機電工程署', desc: '機電及能源工程', url: 'https://www.emsd.gov.hk/', tag: '機電' },
    { name: 'HKHA 房屋委員會', desc: '公營房屋建造', url: 'https://www.housingauthority.gov.hk/', tag: '樓宇' },
    { name: 'MTR 港鐵', desc: '鐵路及車站工程', url: 'https://www.mtr.com.hk/', tag: '鐵路' }
  ];

  var TENDERS = [
    { id: 't1', name: '示範醫院 A · 專科樓層翻新工程', org: '示範機構 A', deadline: '2026-10-14', type: 'NEC',      status: 'open',    value: 48.2, fit: 'high' },
    { id: 't2', name: '示範診所 B · 內部裝修工程',     org: '示範機構 A', deadline: '2026-09-30', type: 'Lump Sum', status: 'open',    value: 18.6, fit: 'high' },
    { id: 't3', name: '示範屋邨 · 外牆修葺定期合約',   org: '示範機構 B', deadline: '2026-11-06', type: 'Term',     status: 'open',    value: 35.0, fit: 'mid' },
    { id: 't4', name: '示範校舍 · 結構加固工程',       org: '示範機構 C', deadline: '2026-09-22', type: 'NEC',      status: 'closing', value: 27.4, fit: 'mid' },
    { id: 't5', name: '示範數據中心 · 機電更新工程',   org: '示範機構 D', deadline: '2026-12-01', type: 'NEC',      status: 'open',    value: 61.3, fit: 'review' },
    { id: 't6', name: '示範碼頭 · 海堤修復工程',       org: '示範機構 B', deadline: '2026-08-28', type: 'Term',     status: 'closed',  value: 12.9, fit: 'no' }
  ];

  var FILTER = { k: 'all' };

  /* ---------- 小工具 ---------- */
  function fitBadge(fit) {
    if (fit === 'high') return VC.badge('符合', 'ok');
    if (fit === 'mid') return VC.badge('部分', 'warn');
    if (fit === 'review') return VC.badge('待評', 'info');
    return VC.badge('不符', 'neutral');
  }
  function statusBadge(s) {
    if (s === 'open') return VC.badge('開放中', 'ok');
    if (s === 'closing') return VC.badge('即將截標', 'danger');
    return VC.badge('已截標', 'neutral');
  }

  function filtered() {
    if (FILTER.k === 'all') return TENDERS;
    if (FILTER.k === 'high') return TENDERS.filter(function (t) { return t.fit === 'high'; });
    return TENDERS.filter(function (t) { return t.status === FILTER.k; });
  }

  /* ---------- 平台入口（純連結，不是卡片容器，故不用 .card） ---------- */
  function platformGrid() {
    var grid = el('div', { class: 'grid grid--3' });

    PLATFORMS.forEach(function (p) {
      var top = el('div', { style: FLEX_BET },
        el('span', { class: 'u-strong' }, p.name),
        VC.badge(p.tag, 'neutral'));

      var link = el('a', {
        href: p.url, target: '_blank', rel: 'noopener',
        style: 'display:block; padding:var(--sp-3); border:1px solid var(--line); border-radius:var(--r-md); background:var(--panel); text-decoration:none; color:inherit'
      },
        top,
        el('div', { class: 'u-muted', style: 'font-size:var(--fs-xs); margin-top:var(--sp-1)' }, p.desc),
        el('div', { style: 'margin-top:var(--sp-2); font-size:var(--fs-xs); color:var(--cobalt-ink)' }, '前往平台 ↗'));

      grid.appendChild(link);
    });
    return grid;
  }

  function platformCard() {
    var head = el('div', { class: 'card__header' },
      el('h3', {}, '香港招標平台'),
      el('div', { class: 'spacer' }),
      el('span', { class: 'u-muted', style: 'font-size:var(--fs-xs)' }, '9 個官方入口'));
    var body = el('div', { class: 'card__body' }, platformGrid());
    return el('div', { class: 'card' }, head, body);
  }

  /* ---------- 招標表 ---------- */
  function rowsOf(list) {
    return list.map(function (t) {
      var name = el('div', {},
        el('div', { class: 'u-strong' }, t.name),
        el('div', { class: 'u-muted', style: 'font-size:var(--fs-2xs)' }, t.org));

      var actions = el('div', { style: 'display:flex; gap:var(--sp-1)' },
        el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已加入專案：' + t.name, 'ok'); } }, '加入'),
        el('button', { class: 'btn btn--sm btn--ghost', title: '編輯', onclick: function () { VC.toast('開啟編輯：' + t.name, 'info'); } }, '✎'));

      return [
        name,
        el('span', { class: 'u-mono' }, t.type),
        el('span', { class: 'u-mono' }, t.deadline),
        el('span', { class: 'u-mono u-right' }, 'HK$ ' + t.value.toFixed(1) + ' M'),
        fitBadge(t.fit),
        statusBadge(t.status),
        actions
      ];
    });
  }

  function tableCard(ctx, list, cached) {
    var cols = [
      { key: 'n', label: '招標項目', cls: 'col-desc' },
      { key: 't', label: '合約類型' },
      { key: 'd', label: '截標日期' },
      { key: 'v', label: '估值', cls: 'col-num' },
      { key: 'f', label: '資格初篩' },
      { key: 's', label: '狀態' },
      { key: 'a', label: '' }
    ];

    var seg = el('div', { class: 'seg', role: 'group', 'aria-label': '招標篩選' });
    [['all', '全部'], ['open', '開放中'], ['closing', '即將截標'], ['high', '資格符合']].forEach(function (f) {
      seg.appendChild(el('button', {
        class: 'seg__btn', type: 'button',
        'aria-pressed': FILTER.k === f[0] ? 'true' : 'false',
        onclick: function () { FILTER.k = f[0]; ctx.go('hk-tenders'); }
      }, f[1]));
    });

    var head = el('div', { class: 'card__header' },
      el('h3', {}, '招標資料庫'),
      el('div', { class: 'spacer' }),
      seg,
      el('span', { class: 'u-muted', style: 'font-size:var(--fs-2xs)' },
        cached ? '快取資料 · 待覆核' : list.length + ' 筆'));

    var bodyDiv = el('div', { class: 'card__body card__body--flush' },
      ctx.table({ cols: cols, rows: rowsOf(list) }));

    var foot = el('div', { class: 'card__footer' },
      el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已匯出 HK_Tenders.xlsx', 'ok'); } }, '匯出 Excel'),
      el('button', { class: 'btn btn--sm btn--ghost', onclick: function () { VC.toast('開啟新增招標表單', 'info'); } }, '手動新增'));

    return el('div', { class: 'card' }, head, bodyDiv, foot);
  }

  /* ---------- 五態 ---------- */
  function renderData(root, ctx) {
    root.appendChild(ctx.pagehead({
      title: '現在招標',
      sub: '9 個官方平台 · 6 筆已收錄 · 最近同步今天 06:00',
      actions: [el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已同步招標公告', 'ok'); } }, '同步')]
    }));

    root.appendChild(el('div', { class: 'grid grid--4' },
      ctx.stat({ icon: '◉', value: '4', label: '開放中招標', badge: '+2 本週', badgeKind: 'info' }),
      ctx.stat({ icon: '⏱', value: '1', label: '7 日內截標', badge: '急', badgeKind: 'danger' }),
      ctx.stat({ icon: '✓', value: '2', label: '資格初篩符合', badge: '可直接投', badgeKind: 'ok' }),
      ctx.stat({ icon: '◫', value: '6', label: '已收錄總數', delta: '+1', deltaKind: 'up' })));

    root.appendChild(ctx.secTitle('平台入口'));
    root.appendChild(platformCard());
    root.appendChild(ctx.secTitle('招標資料庫'));
    root.appendChild(tableCard(ctx, filtered(), false));
  }

  function renderEmpty(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '現在招標', sub: '尚未加入任何招標項目' }));
    root.appendChild(platformCard());
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'empty', icon: '⌕', title: '還沒有招標記錄',
        desc: '你可以從上方平台自行查找，或手動新增一筆招標，把截標日期與合約類型記下來，方便排投標優先次序。',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('開啟新增招標表單', 'info'); } }, '手動新增招標'),
          el('button', { class: 'btn', onclick: function () { VC.toast('已載入 6 筆示範招標', 'ok'); } }, '載入示範資料')
        ]
      })
    }));
  }

  function renderLoading(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '現在招標', sub: '正在同步各平台招標公告…' }));
    var grid = el('div', { class: 'grid grid--3' });
    for (var i = 0; i < 6; i++) {
      grid.appendChild(el('div', { class: 'card' },
        el('div', { class: 'card__body' },
          el('div', { class: 'skel skel--title' }),
          el('div', { class: 'skel skel--line', style: 'width:88%' }),
          el('div', { class: 'skel skel--line', style: 'width:64%' }))));
    }
    root.appendChild(grid);
  }

  function renderError(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '現在招標', sub: '招標公告來源' }));
    root.appendChild(ctx.card({
      body: ctx.state({
        kind: 'error', icon: '✕', title: '無法同步招標公告',
        desc: '三個來源中兩個回應逾時。這不影響你已手動加入的招標記錄，可稍後重試。',
        detail: 'GET https://www.archsd.gov.hk/ → 504 Gateway Timeout (12.4s)\nGET https://www.cedd.gov.hk/  → 504 Gateway Timeout (12.1s)\nGET https://www.hyd.gov.hk/   → 200 OK (0.8s)',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { VC.toast('重試中…', 'info'); } }, '重試'),
          el('button', { class: 'btn', onclick: function () { VC.toast('已切換為手動維護', 'info'); } }, '改用手動維護')
        ]
      })
    }));
  }

  function renderDegraded(root, ctx) {
    root.appendChild(ctx.pagehead({ title: '現在招標', sub: '部分來源不可用 · 已降級' }));
    root.appendChild(el('div', { class: 'card card--accent' },
      el('div', { class: 'card__body' },
        ctx.state({
          kind: 'warn', icon: '!', title: '只剩 1 個來源在線',
          desc: '自動抓取已停用，以下結果來自最近一次成功快取（2026-09-18 06:00）。資料可能已過時，投標前請自行到平台覆核。',
          actions: [el('button', { class: 'btn btn--sm', onclick: function () { VC.toast('已開啟 ArchSD 平台', 'info'); } }, '前往 ArchSD 覆核')]
        }))));
    root.appendChild(tableCard(ctx, TENDERS.slice(0, 3), true));
  }

  VC.registerView('hk-tenders', { nav: 'hk-tenders' }, function (root, ctx) {
    VC.dev.screen('hk-tenders', root, ctx, {
      data: renderData, empty: renderEmpty, loading: renderLoading,
      error: renderError, degraded: renderDegraded
    });
  });
})();

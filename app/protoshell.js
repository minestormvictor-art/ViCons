/* ============================================================================
   ViCons — 原型外殼  protoshell.js
   ----------------------------------------------------------------------------
   只做三件事：DOM 建構器、分頁路由、Toast。零依賴、無構建。
   刻意保持極薄 —— 這支檔案日後會原封不動搬進正式程式當內核。
   ========================================================================= */
(function (root) {
  'use strict';

  /* ---------- DOM 建構器 ---------- */
  function el(tag, attrs) {
    var n = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style') n.setAttribute('style', v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(n, arguments[i]);
    return n;
  }
  function append(n, c) {
    if (c == null || c === false) return n;
    if (Array.isArray(c)) { c.forEach(function (x) { append(n, x); }); return n; }
    n.appendChild(typeof c === 'object' && c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  }
  function frag() { var f = document.createDocumentFragment(); for (var i = 0; i < arguments.length; i++) append(f, arguments[i]); return f; }

  /* 常用片段 */
  function badge(text, kind) { return el('span', { class: 'badge badge--' + (kind || 'neutral') }, text); }
  function pill(text, dotClass) {
    return el('span', { class: 'pill' }, el('span', { class: 'dot ' + (dotClass || '') }), text);
  }
  function tag(text) { return el('span', { class: 'tag' }, text); }
  function stat(o) {
    return el('div', { class: 'stat' },
      el('div', { class: 'stat__top' },
        el('div', { class: 'stat__icon' }, o.icon || '▦'),
        o.badge ? badge(o.badge, o.badgeKind) : null),
      el('div', { class: 'stat__value' }, o.value),
      el('div', { class: 'stat__label' }, o.label),
      o.delta ? el('div', { class: 'stat__delta stat__delta--' + (o.deltaKind || 'up') }, o.delta) : null);
  }
  function card(o) {
    var c = el('div', { class: 'card' + (o.mod ? ' ' + o.mod : '') });
    if (o.title || o.headerRight) {
      c.appendChild(el('div', { class: 'card__header' },
        el('h3', {}, o.title || ''),
        el('div', { class: 'spacer' }),
        o.headerRight || null));
    }
    c.appendChild(el('div', { class: 'card__body' + (o.bodyMod ? ' ' + o.bodyMod : '') },
      o.body == null ? '' : o.body));
    if (o.footer) c.appendChild(el('div', { class: 'card__footer' }, o.footer));
    return c;
  }
  function pagehead(o) {
    var head = el('div', { class: 'pagehead' });
    if (o.crumb) head.appendChild(el('div', { class: 'crumb', html: o.crumb }));
    head.appendChild(el('div', { class: 'pagehead__row' },
      el('div', {},
        el('h1', {}, o.title),
        o.sub ? el('div', { class: 'sub' }, o.sub) : null),
      el('div', { class: 'pagehead__actions' }, o.actions || null)));
    return head;
  }
  function secTitle(t) { return el('div', { class: 'sec-title' }, t); }
  function state(o) {
    return el('div', { class: 'state state--' + (o.kind || 'empty') },
      el('div', { class: 'state__icon' }, o.icon || '∅'),
      el('div', { class: 'state__title' }, o.title),
      o.desc ? el('div', { class: 'state__desc' }, o.desc) : null,
      o.detail ? el('div', { class: 'state__detail' }, o.detail) : null,
      o.actions ? el('div', { class: 'state__actions' }, o.actions) : null);
  }

  /* ---------- 表格 ---------- */
  /* cols: [{key,label,cls,align,sortable}]  rows: [[cell,...]] 或 [{cells,attrs}] */
  function table(o) {
    var thead = el('thead', {}, el('tr', {}, o.cols.map(function (c) {
      return el('th', { class: (c.cls || '') + (c.sortable ? ' sortable' : ''), scope: 'col' }, c.label);
    })));
    var tbody = el('tbody', {}, (o.rows || []).map(function (r) {
      var cells = Array.isArray(r) ? r : r.cells;
      var attrs = Array.isArray(r) ? {} : (r.attrs || {});
      return el('tr', attrs, cells.map(function (cell, i) {
        var c = o.cols[i] || {};
        return el('td', { class: c.cls || '' }, cell == null ? '' : cell);
      }));
    }));
    var t = el('table', { class: 'tbl' }, thead, tbody);
    if (o.foot) t.appendChild(el('tfoot', {}, el('tr', {}, o.foot.map(function (cell, i) {
      var c = o.cols[i] || {};
      return el('td', { class: c.cls || '' }, cell == null ? '' : cell);
    }))));
    return el('div', { class: 'tbl-wrap' + (o.wrapMod ? ' ' + o.wrapMod : '') }, t);
  }

  /* ---------- Toast ---------- */
  function toast(msg, kind, ms) {
    var host = document.getElementById('toasts');
    if (!host) return;
    var icon = { ok: '✓', warn: '!', err: '✕', info: 'i' }[kind || 'info'];
    var node = el('div', { class: 'toast toast--' + (kind || 'info') },
      el('strong', {}, icon), el('span', {}, msg));
    host.appendChild(node);
    setTimeout(function () {
      node.style.opacity = '0';
      node.style.transition = 'opacity .2s';
      setTimeout(function () { node.remove(); }, 220);
    }, ms || 2600);
  }

  /* ---------- 路由 ---------- */
  var VIEWS = [];
  function registerView(id, meta, render) { VIEWS.push({ id: id, meta: meta || {}, render: render }); }
  function findView(id) {
    for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i].id === id) return VIEWS[i];
    return null;
  }

  function go(id) {
    var v = findView(id) || findView('overview-1');
    if (!v) return;
    var hostRoot = document.getElementById('view-root');
    var mainEl = document.getElementById('main');
    hostRoot.innerHTML = '';
    mainEl.classList.toggle('main--flush', !!v.meta.flush);
    hostRoot.classList.toggle('main__wrap--wide', !!v.meta.wide);
    v.render(hostRoot, { el: el, frag: frag, badge: badge, pill: pill, tag: tag, stat: stat,
                         card: card, pagehead: pagehead, secTitle: secTitle, state: state,
                         table: table, toast: toast, go: go });

    /* 同步側邊欄高亮 + 原型 chips */
    var navKey = v.meta.nav || '';
    Array.prototype.forEach.call(document.querySelectorAll('.navitem'), function (a) {
      if (a.dataset.view === navKey) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.proto-chip'), function (b) {
      b.classList.toggle('on', b.dataset.go === id);
    });
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    mainEl.scrollTop = 0;
  }

  /* ---------- 事件綁定 ---------- */
  function wire() {
    /* 原型 chips */
    Array.prototype.forEach.call(document.querySelectorAll('.proto-chip'), function (b) {
      b.addEventListener('click', function () { go(b.dataset.go); });
    });
    /* 側邊欄：無專屬畫面的先導去總覽，並提示 */
    Array.prototype.forEach.call(document.querySelectorAll('.navitem'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var id = a.dataset.view;
        if (findView(id)) { go(id); return; }
        go(id === 'overview' ? 'overview-2' : 'overview-2');
        toast('「' + a.querySelector('.navitem__label').textContent + '」畫面尚在規劃中，本原型聚焦 UI 骨幹', 'info');
      });
    });
    /* 收合側邊欄 */
    var shell = document.querySelector('.app');
    document.getElementById('collapse').addEventListener('click', function () {
      shell.classList.toggle('app--collapsed');
    });
    /* hash 路由 */
    window.addEventListener('hashchange', function () { go(location.hash.slice(1) || 'overview-1'); });
  }

  root.VC = {
    el: el, frag: frag, append: append, badge: badge, pill: pill, tag: tag, stat: stat,
    card: card, pagehead: pagehead, secTitle: secTitle, state: state, table: table,
    toast: toast, registerView: registerView, go: go, wire: wire,
    VIEWS: VIEWS
  };
})(window);

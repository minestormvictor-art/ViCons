/* ============================================================================
   ViCons — 原型審查面板  devpanel.js
   ----------------------------------------------------------------------------
   ⚠ 這支檔案是「原型專用」的審查輔助，**不會**搬進正式程式。

   protoshell.js 是刻意保持極薄的產品內核，要原封不動搬去正式實作。
   把審查用的狀態切換器混進去會污染它，所以獨立成這一支。

   用途：讓審查者逐一切換每個畫面的 有資料 / 空 / 載入 / 錯誤 / 降級 五態，
   不需要改資料庫、不需要改程式。業務規則要求「四態齊備」，
   把每一態做成可實際點到，是唯一誠實的驗收方式。

   用法（在 view 檔尾）：
     window.VC.registerView('xxx', { nav:'xxx' }, function (root, ctx) {
       window.VC.dev.screen('xxx', root, ctx, {
         data:     function (r, c) { ... },
         empty:    function (r, c) { ... },
         loading:  function (r, c) { ... },
         error:    function (r, c) { ... },
         degraded: function (r, c) { ... }
       });
     });

   沒提供的狀態會回退到 data，所以最起碼寫 data + empty 就可運作。

   ⚠ 命名注意：IIFE 參數刻意叫 win 而不是 root ——
      若叫 root，會與 screen() 的 root（畫面宿主元素）互相遮蔽，
      導致 root.VC 取不到而拋 TypeError。這個 bug 被 _audit.cjs 抓到過。
   ========================================================================= */
(function (win) {
  'use strict';

  var STATES = [
    { k: 'data',     t: '有資料' },
    { k: 'empty',    t: '空' },
    { k: 'loading',  t: '載入' },
    { k: 'error',    t: '錯誤' },
    { k: 'degraded', t: '降級' }
  ];

  /* 記住每個畫面各自選了哪一態，切去別的畫面再回來不會重置 */
  var memory = {};

  function get(viewId) { return memory[viewId] || 'data'; }
  function set(viewId, k) { memory[viewId] = k; }

  /** 緊湊的分段控件：讓審查者一眼看出這是原型切換器，不是產品功能。 */
  function stateSeg(viewId, onChange) {
    var VC = win.VC;
    var cur = get(viewId);
    var seg = VC.el('div', { class: 'seg', role: 'group', 'aria-label': '預覽資料狀態' });

    STATES.forEach(function (s) {
      seg.appendChild(VC.el('button', {
        class: 'seg__btn',
        type: 'button',
        'aria-pressed': s.k === cur ? 'true' : 'false',
        title: '預覽「' + s.t + '」狀態',
        onclick: function () { set(viewId, s.k); onChange(s.k); }
      }, s.t));
    });

    var label = VC.el('span', { class: 'devpanel__label' }, '預覽狀態');
    return VC.el('div', { class: 'devpanel' }, label, seg);
  }

  /**
   * screen(viewId, host, ctx, renderers)
   * 建立「切換列 + 內容宿主」，並依當前狀態呼叫對應 renderer。
   * 每次切換都清空宿主重繪 —— 原型無需保留 DOM，避免狀態殘留。
   *
   * host 是畫面宿主元素（由 registerView 的 render(root, ctx) 傳入），
   * 不是 window，所以在此一律經 win.VC 取得建構器。
   */
  function screen(viewId, host, ctx, renderers) {
    var VC = win.VC;

    var content = VC.el('div', {});
    var bar = VC.el('div', { class: 'devpanel-bar' });
    bar.appendChild(stateSeg(viewId, draw));

    host.appendChild(bar);
    host.appendChild(content);

    function draw() {
      content.innerHTML = '';
      var m = get(viewId);
      var fn = renderers[m] || renderers.data;
      if (typeof fn === 'function') fn(content, ctx, m);
    }
    draw();

    return { redraw: draw };
  }

  win.VC = win.VC || {};
  win.VC.dev = { stateSeg: stateSeg, screen: screen, get: get, set: set, STATES: STATES };
})(window);

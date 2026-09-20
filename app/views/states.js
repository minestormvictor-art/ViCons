/* ============================================================================
   ViCons — 畫面 9：狀態樣板（空 / 載入 / 錯誤 / 降級 / 權限）
   同步交付用：每個畫面都必須實作這裡列的狀態，不得只做 happy path。
   ========================================================================= */
(function () {
  'use strict';
  var el = VC.el, frag = VC.frag;

  VC.registerView('states', { nav: '', wide: true }, function (root, ctx) {
    root.appendChild(ctx.pagehead({
      title: '狀態樣板',
      sub: '每個畫面都必須實作以下狀態。只做「有資料」的正常態是驗收不通過的。',
      crumb: '<a href="#overview-2">總覽</a> / 狀態樣板'
    }));

    /* ---------- 1. 空狀態 ---------- */
    root.appendChild(ctx.secTitle('1 · 空狀態 Empty'));
    root.appendChild(el('div', { class: 'grid grid--3' },
      ctx.card({ body: ctx.state({
        kind: 'empty', icon: '▦', title: '尚未建立任何專案',
        desc: '建立第一個專案以開始投標流程。可從標書檔案匯入，或直接新增空白專案。',
        actions: [el('button', { class: 'btn btn--primary' }, '匯入標書'), el('button', { class: 'btn' }, '新增空白專案')]
      }) }),
      ctx.card({ body: ctx.state({
        kind: 'empty', icon: '◫', title: '量測引擎未載入任何圖紙',
        desc: '拖入 PDF 施工圖或完成圖即可開始。所有運算在本機瀏覽器完成，圖紙不會上傳。',
        actions: [el('button', { class: 'btn btn--primary' }, '選擇圖紙檔案')]
      }) }),
      ctx.card({ body: ctx.state({
        kind: 'empty', icon: '▥', title: 'SoR 尚無條目',
        desc: '從量測接口匯入算量結果，或匯入既有 Excel 工程量清單。',
        actions: [el('button', { class: 'btn' }, '前往算量接口'), el('button', { class: 'btn' }, '匯入 Excel')]
      }) }))); 

    /* ---------- 2. 載入 ---------- */
    root.appendChild(ctx.secTitle('2 · 載入中 Loading'));
    root.appendChild(el('div', { class: 'grid grid--3' },
      /* 骨架 */
      ctx.card({ title: '骨架屏（首選）', body: frag(
        el('div', { class: 'skel skel--title' }),
        el('div', { class: 'skel skel--line', style: 'width:92%' }),
        el('div', { class: 'skel skel--line', style: 'width:78%' }),
        el('div', { class: 'skel skel--line', style: 'width:85%' }),
        el('div', { class: 'skel skel--line', style: 'width:60%' })
      ) }),
      /* 統計卡骨架 */
      ctx.card({ title: '統計卡骨架', body: el('div', { class: 'grid grid--2', style: 'gap:var(--sp-3)' },
        el('div', { class: 'skel skel--stat' }), el('div', { class: 'skel skel--stat' }),
        el('div', { class: 'skel skel--stat' }), el('div', { class: 'skel skel--stat' })) }),
      /* 進度式 */
      ctx.card({ title: '長任務進度', body: frag(
        el('div', { style: 'display:flex; align-items:baseline; gap:var(--sp-2); margin-bottom:var(--sp-2)' },
          el('span', { style: 'font-size:var(--fs-sm); flex:1' }, '解析圖紙文字層…'),
          el('span', { class: 'u-mono', style: 'font-size:var(--fs-xs); color:var(--ink-faint)' }, '62%')),
        el('div', { class: 'bar', style: 'height:6px' },
          el('div', { class: 'bar__fill', style: 'width:62%' })),
        el('div', { class: 'u-muted', style: 'font-size:var(--fs-2xs); margin-top:var(--sp-2)' },
          'p.24 / 42 · 已完成 26 頁，預估尚餘 8 秒'),
        el('button', { class: 'btn btn--sm', style: 'margin-top:var(--sp-3)' }, '取消')
      ) }))); 

    /* ---------- 3. 錯誤 ---------- */
    root.appendChild(ctx.secTitle('3 · 錯誤 Error'));
    root.appendChild(el('div', { class: 'grid grid--2' },
      ctx.card({ body: ctx.state({
        kind: 'error', icon: '✕', title: '解析失敗：圖紙沒有可讀文字層',
        desc: '這批 PDF 的標題欄文字已轉為曲線，無法直接抽取。可改用逐格 OCR 路徑（較慢，但標題欄信心值可達 84–95）。',
        detail: 'Error: no text layer detected\n  sheet: p07 of 42\n  text density: 0.0006 chars/pt²\n  threshold: 0.0030 chars/pt²',
        actions: [
          el('button', { class: 'btn btn--primary', onclick: function () { ctx.toast('已切換至逐格 OCR 路徑', 'ok'); } }, '改用 OCR 路徑'),
          el('button', { class: 'btn' }, '檢視診斷報告')
        ]
      }) }),
      ctx.card({ body: ctx.state({
        kind: 'error', icon: '⚡', title: '量測引擎無法載入',
        desc: '三個來源全部探測失敗。引擎未掛載時此面板會顯示建置指引，不會出現空白框。',
        detail: '探測結果（並行）\n  1. engine/index.html                     ✕ 404\n  2. <OPENTAKEOFF_ROOT>/…/index.html        ✕ 未找到\n  3. http://localhost:5173/                  ✕ 逾時 2.6s',
        actions: [
          el('button', { class: 'btn btn--primary' }, '重試連線'),
          el('button', { class: 'btn' }, '查看建置指令')
        ]
      }) }))); 

    /* ---------- 4. 降級 ---------- */
    root.appendChild(ctx.secTitle('4 · 降級 Degraded（可用但不完整）'));
    root.appendChild(el('div', { class: 'grid grid--2' },
      ctx.card({ body: ctx.state({
        kind: 'warn', icon: '⚠', title: '以 file:// 開啟 — 只能下載 CSV',
        desc: 'IndexedDB 以來源為界。用 file:// 開啟時，接口無法直寫 VicBid 的 vicbid_db，但仍可下載 VicBid 格式 CSV 手動匯入。',
        detail: '當前來源：file://\n直寫 IndexedDB：✕ 不可用\n下載 CSV：      ✓ 可用\n\n建議：改用 python serve.py 取得同源環境',
        actions: [
          el('button', { class: 'btn btn--primary' }, '⇩ 下載 CSV'),
          el('button', { class: 'btn' }, '同源啟動說明')
        ]
      }) }),
      ctx.card({ body: ctx.state({
        kind: 'warn', icon: '◌', title: '語音輸入不可用（優雅降級）',
        desc: '語音 WASM 模型（23.5 MB）為 lazy load。未下載時語音路徑停用，其餘量測功能完全不受影響。',
        actions: [el('button', { class: 'btn' }, '了解詳情')]
      }) }))); 

    /* ---------- 5. 阻斷 / 確認 ---------- */
    root.appendChild(ctx.secTitle('5 · 阻斷與二次確認'));
    root.appendChild(el('div', { class: 'grid grid--2' },
      ctx.card({
        title: '破壞性操作需二次確認',
        body: frag(
          el('p', { class: 'u-muted', style: 'font-size:var(--fs-xs); margin:0 0 var(--sp-4)' },
            '任何刪除、覆寫、全清操作，必須先列出受影響範圍並要求明示確認。'),
          el('div', {
            style: 'background:var(--panel-2); border:1px solid var(--line-strong); border-radius:var(--r-lg); padding:var(--sp-4)'
          },
            el('div', { style: 'display:flex; gap:var(--sp-3); margin-bottom:var(--sp-3)' },
              el('span', { style: 'font-size:18px; color:var(--danger)' }, '⚠'),
              el('div', {},
                el('div', { style: 'font-weight:var(--fw-semi); margin-bottom:var(--sp-1)' }, '確認全清量測匯入紀錄？'),
                el('div', { class: 'u-muted', style: 'font-size:var(--fs-xs); line-height:var(--lh-base)' },
                  '將刪除 9 筆 source = opentakeoff 的紀錄。手動輸入（2 筆）與 Excel 匯入（3 筆）不受影響。'))),
            el('div', { class: 'u-mono', style: 'font-size:var(--fs-2xs); background:var(--bg); border:1px solid var(--line); border-radius:var(--r-sm); padding:var(--sp-3); color:var(--ink-faint); line-height:1.7' },
              '將刪除：\n  CPT-01-AR · VNL-02-AR · VNL-02-LN · PNT-03-AR\n  PNT-03-LN · SKT-04-LN · DR-05-EA · MAT-01 · BUY-01\n不受影響：\n  MB-5100 · MB-5210（手動）｜MB-6030 等（Excel）'),
            el('div', { style: 'display:flex; gap:var(--sp-2); justify-content:flex-end; margin-top:var(--sp-4)' },
              el('button', { class: 'btn btn--sm' }, '取消'),
              el('button', { class: 'btn btn--sm', onclick: function () { ctx.toast('已建立還原點', 'ok'); } }, '先建立還原點'),
              el('button', { class: 'btn btn--sm btn--danger', onclick: function () { ctx.toast('需輸入專案名稱才可確認', 'warn'); } }, '確認刪除'))))
      }),
      ctx.card({
        title: '權限 / 唯讀態',
        body: el('div', { style: 'display:flex; flex-direction:column; gap:var(--sp-3)' },
          el('div', { style: 'display:flex; align-items:center; gap:var(--sp-3)' },
            ctx.badge('唯讀', 'info'),
            el('span', { style: 'font-size:var(--fs-sm)' }, '檢視者角色：所有編輯控件停用')),
          el('div', { style: 'display:flex; gap:var(--sp-2)' },
            el('button', { class: 'btn btn--sm', disabled: 'disabled', 'aria-disabled': 'true' }, '編輯'),
            el('button', { class: 'btn btn--sm', disabled: 'disabled', 'aria-disabled': 'true' }, '刪除'),
            el('button', { class: 'btn btn--sm' }, '匯出（允許）')),
          el('div', { class: 'u-muted', style: 'font-size:var(--fs-2xs); line-height:var(--lh-base)' },
            '停用控件必須同時設 disabled 與 aria-disabled，並保留可讀的工具提示說明原因。'),
          el('div', { style: 'border-top:1px solid var(--line-soft); padding-top:var(--sp-3); margin-top:var(--sp-1)' },
            el('div', { class: 'u-muted', style: 'font-size:var(--fs-2xs); margin-bottom:var(--sp-2)' }, '鍵盤焦點環（Tab 試試）'),
            el('div', { style: 'display:flex; gap:var(--sp-2)' },
              el('button', { class: 'btn btn--sm' }, 'Tab 到我'),
              el('button', { class: 'btn btn--sm btn--primary' }, '還有我'),
              el('input', { class: 'input', style: 'width:120px; height:26px', placeholder: '輸入框' }))))
      })));
  });
})();

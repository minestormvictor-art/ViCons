# ViCons — 程式實作計劃 v1.0

**日期**：2026-09-19
**前置**：`UI-DESIGN-SPEC.md` 已定案（合併 App / 桌面優先 / 零構建 vanilla / 統一深色 / 分組側邊欄）
**狀態**：待審批後開工

---

## 1. 技術決策與理由

### 1.1 決定：維持零構建 vanilla

| 選項 | 評估 | 決定 |
|---|---|---|
| Vite + React + TS | 會引入 274+ 依賴與構建鏈；現有 OpenTakeoff 已因 Vite 6 要求 node ≥ 24 而吃過苦頭；每次改動要重新過安全審計 | ✗ |
| 原生 ES modules + 單一 HTML | 無依賴、無打包、雙擊即跑、可離線、審計面積極小 | ✓ |

**理由不是「省事」，是三個現有約束**：

1. **`serve.py` 的同源要求** —— IndexedDB 以來源為界，算量接口直寫 `vicbid_db` 必須同源。這個架構已經跑通，不應為換框架而重做。
2. **已驗證的橋接層** —— `ot-vicbid-bridge.js` 與 `ot-vicbid-report-bridge.js` 已通過 54 + 34 項測試，且是無依賴的 UMD 風格模組。搬進任何框架都要重新驗證。
3. **審計成本** —— OpenTakeoff 引入時的安全審計（0 P0 / 2 P1 / 92 分）是既有成果。新增 274 個 npm 依賴等於從零重做一次，且會摧毀「版本釘死」這個已建立的安全姿態。

**代價與對策**：沒有型別檢查、沒有 JSX、手寫 `el()` 建構器較囉唆。對策是把 `shell.js` 的建構器做成薄而穩的內核（原型已驗證可行），並用 `_audit.cjs` 的渲染迴歸 harness 補上「無型別系統」的缺口 —— 讓每個 view 在 DOM 樁下真的執行，比語法檢查強。

### 1.2 決定：單一 `vicbid_db`，13 個 store 沿用

現有 schema 已驗證：

```
projects, tenders, sor_items, requirements, compliance, site_aspects,
tech_plans, schedules, hk_tenders, versions, notes, settings, bid_indicators
```

**不自創 store，不改 keyPath。** 溯源資訊（`source` / `otSchema` / `otImportId` / `otProject` / `otRef` / `otRow`）以**額外欄位**掛在 `sor_items` 上 —— VicBid 的 `renderSoR` 只讀已知欄位，額外欄位被忽略但保留在庫中。這是已驗證的相容策略。

若要新增能力（例如 tender id 溯源），**先加欄位，不急著改 schema 版本**。

---

## 2. 目標結構

```
D:\Victore\ViCons\                     ← 新工作區（建議）
├── index.html                         ← 唯一入口
├── serve.py                           ← 由 ViConst 沿用（同源掛載）
├── tokens/
│   ├── vicons-tokens.css              ← ✅ 已產出
│   └── vicons-components.css          ← ✅ 已產出
├── app/
│   ├── shell.js                       ← 內核（由原型 protoshell.js 升級）
│   ├── boot.js                        ← 啟動
│   ├── services/
│   │   ├── parse.js                   ← 自 VicBid 遷入（200 行）
│   │   ├── export.js                  ← 自 VicBid 遷入（132 行）
│   │   └── storage.js                 ← 自 VicBid app.js 抽出 Storage 模組
│   ├── bridge/
│   │   ├── ot-vicbid-bridge.js        ← 原封搬入（勿改，已驗證 54 項）
│   │   └── ot-vicbid-report-bridge.js ← 原封搬入（勿改，已驗證）
│   └── views/
│       ├── overview.js                ← ✅ 原型已完成
│       ├── takeoff.js                 ← ✅ 原型已完成
│       ├── bridge.js                  ← ✅ 原型已完成
│       ├── sor.js                     ← ✅ 原型已完成
│       ├── compliance.js              ← ✅ 原型已完成
│       ├── output.js                  ← ✅ 原型已完成
│       ├── mcp.js                     ← ✅ 原型已完成
│       ├── states.js                  ← 樣板，不進正式導航
│       └── [8 個待遷移 view]
├── engine/                            ← OpenTakeoff dist-portable 掛載點
└── _audit.cjs                         ← 渲染迴歸 harness（由原型沿用並擴充）
```

---

## 3. 分階段實作

### Phase 0 — 骨架與遷移（不動 UI）

| # | 任務 | 驗收 |
|---|---|---|
| 0.1 | 建新工作區，複製 tokens + 原型 8 個 view | `node _audit.cjs` 75 PASS |
| 0.2 | `protoshell.js` → `shell.js`：補上真實 `Storage`（IndexedDB）、`modal`、`router` 持久化 | Storage 能開 `vicbid_db` v2 並列出 13 store |
| 0.3 | 搬入 `parse.js` / `export.js` / 兩個 bridge（**逐字不改**） | 原 ViConst 的 `run-all.cjs` 四支測試全部仍 PASS |
| 0.4 | 搬入 `serve.py`，改掛載點指向新結構 | `http://127.0.0.1:4180/` 開得起來，`/engine/` 載入成功 |

**Phase 0 出口條件**：新舊兩邊測試同時綠燈，且舊專案目錄未動。

### Phase 1 — 8 個待遷移畫面套用新設計語言

依複雜度排序：

| 順序 | 畫面 | 難度 | 關鍵點 |
|---|---|---|---|
| 1.1 | 資料與備份 | 低 | 沿用邏輯，換版面 |
| 1.2 | 標書匯入 | 低 | 拖放區已有 `.drop` 元件 |
| 1.3 | 合約類型 | 低 | 表單版面 |
| 1.4 | 提交導航器 | 中 | 流程視覺化，用 `.flow` |
| 1.5 | Site Aspect | 中 | 表格 + 檢查清單 |
| 1.6 | 進度規劃 | 中 | 時序表 |
| 1.7 | 技術施工方案 | 中 | 富文本 + 附件 |
| 1.8 | 現在招標 (hkTenders) | 中 | 外部資料 + 篩選 |

**每個畫面的驗收**：四態齊備（空／載入／錯誤／降級）、無硬編碼色值、數字等寬右對齊、harness 新增斷言。

### Phase 2 — 接通真實資料

| # | 任務 | 驗收 |
|---|---|---|
| 2.1 | 8 個原型畫面從假資料改接真實 IndexedDB | 新增 → 重整 → 資料仍在 |
| 2.2 | 量測引擎 iframe 真實載入 + 三來源並行探測 | 三個來源各測一次，失敗顯示建置指引而非空白框 |
| 2.3 | 算量接口端到端：量測 → 匯出 → 映射 → 寫入 → SoR 核對 | 手動走一次全鏈路，數字對得上 |
| 2.4 | 缺單價 → 報價審查 → 提交清單阻斷 的完整邏輯 | 缺 1 項單價，提交鈕即變 disabled |
| 2.5 | MCP 信任流程實測 | 連接器頁按信任後，真實跑一次 `load_plan` |

### Phase 3 — 收尾

| # | 任務 |
|---|---|
| 3.1 | 全域搜尋（Ctrl+K）實際接上索引 |
| 3.2 | 專案切換器接上真實專案列表 |
| 3.3 | 資料匯出／匯入／備份還原 |
| 3.4 | 「作業規範」內容頁（併入資料與備份） |
| 3.5 | 瀏覽器實測收尾 + 鍵盤全流程走一遍 |

---

## 4. 風險清單

| # | 風險 | 影響 | 對策 |
|---|---|---|---|
| R1 | **無瀏覽器實測** —— 沙箱內 agent-browser 與 headless Chrome 全部 hang 死 | 視覺問題（對比度、溢出、字型 fallback）只靠人工肉眼發現 | 每個 Phase 結束請你手動開一次；harness 只能保證不拋錯，不保證好看 |
| R2 | **8 個 view 遷移時行為回歸** —— VicBid 有 `_audit.cjs`（39KB）覆蓋既有行為 | 換版面時可能弄壞既有邏輯 | 遷移前先把 VicBid 的 `_audit.cjs` 跑成基線，每遷一個畫面重跑；**只改 render 層，不動資料邏輯** |
| R3 | **bridge 搬移導致契約漂移** | 算量接口失準，造價錯 | bridge 兩個檔案逐字不改，只用相對路徑調整；搬完立刻重跑 54+34 項測試 |
| R4 | **同源要求被破壞** | 直寫 IndexedDB 失效 | `serve.py` 的 `/VicBid/` 掛載點必須保留（或改指向新結構的等效路徑）。`file://` 降級路徑必須測過 |
| R5 | **瀏覽器儲存配額** —— IndexedDB 預設配額可能不足以放大量圖紙 | 量測中途失敗 | 圖紙走 iframe 的記憶體，**不入庫**；只把量測結果（輕量 JSON）入庫。這是現有設計，遷移時勿改 |
| R6 | **設計 token 被繞過** —— 趕工時有人寫死色值 | 視覺分裂，dark 一致性崩 | Phase 1 每個畫面收尾時跑一次硬編碼色值掃描（`grep` `#[0-9a-f]{3,6}`） |
| R7 | ViConst 舊專案被誤改 | 丟失已驗證成果 | **新工作區另開，舊目錄唯讀**。所有搬移都是複製，不是移動 |

---

## 5. 測試策略

三層，對應「無真實瀏覽器」的限制：

| 層 | 工具 | 覆蓋 | 現況 |
|---|---|---|---|
| L1 語法 | `node --check` | 所有 JS 檔可解析 | ✅ 10/10 通過 |
| L2 渲染迴歸 | `_audit.cjs`（DOM 樁） | 每個 view 真的執行並建出 DOM、關鍵內容存在、契約斷言 | ✅ 75 PASS / 0 FAIL |
| L3 契約 | 原 ViConst 的 4 支測試 | bridge 解析映射（54）、IndexedDB 直寫回滾（34）、MCP 握手（42 tools）、hub render（41） | 待搬移後重跑 |
| L4 人工 | 你本人開瀏覽器 | 視覺、互動、鍵盤 | **每個 Phase 結束必做** |

**關鍵原則**：`_audit.cjs` 的 DOM 樁會真的執行 view 並檢查它建出的 DOM（分頁切換、表格列數、統計卡、降級面板）。這比語法檢查強得多，但**明確不能取代 L4**。不要因為 L2 全綠就宣稱完成。

---

## 6. 里程碑

| 里程碑 | 內容 | 出口條件 |
|---|---|---|
| **M0** 審批 | 設計規格 + 原型 + 本計劃 | 你確認設計與架構 |
| **M1** 骨架 | Phase 0 完成 | L2 75 PASS + L3 4 支測試重跑全綠 |
| **M2** 畫面齊 | Phase 1 八個畫面套新語言 | 13 個畫面全部四態齊備 |
| **M3** 真數據 | Phase 2 完成 | 端到端手動走通一次 |
| **M4** 可交付 | Phase 3 完成 | L1–L3 全綠 + L4 你驗收通過 |

---

## 7. 開工前需你確認的三件事

1. **新工作區路徑** —— 建議 `D:\Victore\ViCons\`。舊的 `D:\Victore\2026-08-22-16-47-11\ViConst\` 與 `VicBid\` 保持**唯讀不動**，作為回退基準。
2. **`VicBid/_audit.cjs`（39KB）的三層驗收報告** —— 專案內有 `VicBid 测试用例与验收报告.md`。開工前我需要跑一次拿到現時基線，才知道遷移有沒有弄壞東西。
3. **Inspector 在 ≤1280px 的處置** —— 變抽屜、變底部面板、還是直接隱藏？這影響 `.app` 的 grid 規則，越早定越好。

---

## 8. 明確不做

- 不做 SSR / 不做後端（純本機，不上傳）
- 不做手機版（最小寬度 1024px）
- 不引入前端框架、不引入打包器
- 不改 `vicbid_db` schema 版本、不改 bridge 契約
- 不動 OpenTakeoff 引擎原始碼（以 iframe 掛載，版本釘死 0.9.66）
- 不做多人協作 / 雲端同步

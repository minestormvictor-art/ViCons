# ViCons

**Vi + Construction** — 香港工程投標與算量協同平台。

把三個既有元件整合成單一桌面應用：

| 來源元件 | 角色 | 併入方式 |
|---|---|---|
| ViConst | 工程 hub：量測引擎／算量接口／MCP 服務 | 深色 HUD 視覺語言成為全站基準 |
| VicBid | 投標管理：13 store、11 個畫面 | 功能全數保留，視覺改寫為深色 |
| OpenTakeoff | 量測引擎內核（版本釘死 **0.9.66**） | 同源 iframe 掛載，42 個 MCP 工具 |

> 舊專案 `D:\Victore\2026-08-22-16-47-11\`（ViConst + VicBid）**保持唯讀**，
> 作為回退基準。本工作區的所有內容都是複製過來再改的。

---

## 快速開始

```bash
# 起本機預覽（必須用伺服器開，直接雙擊 index.html 會有同源問題）
python serve.py
# → http://127.0.0.1:4190
```

```bash
# 渲染回歸 harness（不需要瀏覽器）
node _audit.cjs
# → 應顯示 131 PASS / 0 FAIL
```

---

## 目錄結構

```
ViCons/
├── index.html                  單一入口（原型外殼）
├── serve.py                    本機預覽伺服器，port 4190，no-store
├── _audit.cjs                  DOM 樁渲染回歸 harness
│
├── tokens/
│   ├── vicons-tokens.css       ★ 設計 token 單一真實來源（127 個變數）
│   └── vicons-components.css   15 類元件 + 響應式斷點
│
├── app/
│   ├── protoshell.js           薄內核：DOM 建構器 / 路由 / Toast（要原封搬進正式程式）
│   ├── devpanel.js             ⚠ 原型專用審查面板（正式實作時刪掉）
│   ├── boot.js                 4 行啟動
│   └── views/                  17 個畫面，一畫面一檔，互不引用
│
├── _integration/               從 ViConst 逐字複製的兩支 bridge
│   ├── ot-vicbid-bridge.js         CSV → SoR 映射
│   └── ot-vicbid-report-bridge.js  JSON report.v1
│
└── docs/design/
    ├── UI-DESIGN-SPEC.md       9 章設計規格（含驗收標準）
    └── IMPLEMENTATION-PLAN.md  8 章落地計劃（4 Phase / 7 風險 / 測試策略）
```

---

## 17 個畫面

**骨幹（第一批）**

| # | 畫面 | view id | 說明 |
|---|---|---|---|
| 1–2 | 總覽 | `overview-1` / `overview-2` | 空狀態 / 有專案 |
| 3 | 量測引擎 | `takeoff` | flush 畫布 + 溯源檢視器 |
| 4 | 算量接口 | `bridge` | CSV 匯入 → 映射預覽 → 落庫 |
| 5 | SoR 造價核心 | `sor` | 缺單價是主角 |
| 6 | 合規矩陣 | `compliance` | 逐條款對應 |
| 7 | 提交清單 | `output` | 阻斷閘門 |
| 8 | MCP 服務 | `mcp` | 連線狀態與工具清單 |
| 9 | 狀態樣板 | `states` | 空／載入／錯誤／降級／二次確認 |

**補充（第二批，補齊 VicBid 既有功能）**

| # | 畫面 | view id | 說明 |
|---|---|---|---|
| 10 | 現在招標 | `hk-tenders` | 9 個官方平台 + 招標日曆 |
| 11 | 標書匯入 | `intake` | 四步流程、投標指標、要求抽取 |
| 12 | 合約類型 | `contract` | 三種類型條款庫、風險承擔比較 |
| 13 | 提交導航器 | `nav-map` | 條款勾選 + 要求指派 + 缺口偵測 |
| 14 | Site Aspect | `site` | 七章現場條件 + 完成度 |
| 15 | 技術施工方案 | `tech` | 八章分四組 + 完成度 |
| 16 | 進度規劃 | `schedule` | 甘特圖 + 關鍵路徑 + 日期驗證 |
| 17 | 資料與備份 | `backup` | 13 store 盤點、備份還原、AI 設定 |

---

## 硬性契約（不可改）

| 契約 | 內容 |
|---|---|
| `vicbid_db` schema | v2，13 個 store，**不改版本、不改 keyPath** |
| 13 個 store 名 | `projects` `tenders` `sor_items` `requirements` `compliance` `site_aspects` `tech_plans` `schedules` `hk_tenders` `versions` `notes` `settings` `bid_indicators` |
| `sor_items` 欄位 | `{ id, code, description, unit, quantity, rate, importedAt }`；溯源以**額外欄位**掛上 |
| bridge 兩支檔案 | 逐字不改，只用相對路徑調整 |
| 量測不帶價 | `rate` 一律 0，單價由 SoR 造價核心唯一裁決 |
| 回滾來源隔離 | 替換模式**只刪** `source === 'opentakeoff'`，手動與 Excel 資料不動 |
| MCP 版本 | 指向本地已建置已審查的 0.9.66，**不用浮動 latest** |

---

## 業務規則（UI 必須反映）

- **量價分離** —— 量測畫面絕不出現單價欄位
- **缺漏要吵** —— 缺單價／缺文件／缺圖號用 `--danger` / `--warn` 主動標示，不靜默通過
- **溯源不可藏** —— 檢視器常駐（≤1280px 收成抽屜，仍留有開啟入口，不隱藏）
- **阻斷閘門** —— 提交清單有硬性缺漏時，「產生提交包」必須 `disabled`
- **漲紅跌綠** —— `--price-up` 紅 / `--price-down` 綠（中文慣例）
- **四態齊備** —— 每個畫面實作 空／載入／錯誤／降級

### 窄屏處置（≤1280px）

溯源檢視器改為右側**抽屜**，不用底部面板、也不隱藏：

- 不用底部面板 —— 會吃掉畫布垂直空間，而畫布是該畫面的主角
- 不隱藏 —— 違反「溯源不可藏」，圖號／比例／操作者／時間必須隨時可查
- 抽屜同時提供開啟入口（工具列「☰ 溯源」）與關閉出口（標題欄「✕」＋遮罩點擊）

---

## 驗證（5 層）

| 層 | 內容 | 通過標準 |
|---|---|---|
| L1 | `node --check` × 20 檔 | 全 PASS |
| L2 | DOM 樁渲染回歸 `_audit.cjs` | **131 PASS / 0 FAIL** |
| L3 | 硬編碼色值掃描（含 8 位 alpha） | **0** |
| L4 | CSS 變數完整性 | 127 定義 / 106 使用 / **0 未定義** |
| L5 | HTTP 狀態 × 14 個資源 | 全部 **200** |
| L5b | 敏感字串掃描 | **0** |

> ⚠ **L2 不能取代肉眼驗收。** 本沙箱的 agent-browser 與 headless Chrome 全部會 hang 死，
> 所以沒有真實瀏覽器實測。`_audit.cjs` 會真的執行每個 view 並斷言它建出的 DOM，
> 但**視覺效果必須由人開一次確認**。

補充：VicBid 原專案基線 `_audit.cjs` = **83 PASS / 0 FAIL**，遷移過程不得令它倒退。

---

## 設計慣例

- **絕不硬編碼色值**：一律 `var(--token)`。掃描含 8 位 alpha（`#RRGGBBAA`），這種值最易漏。
- **佈局用 inline style + 間距變數**，不另立工具類（跟隨既有 codebase 慣例）。
- **`el()` 嵌套最多 3 層**，超過就用命名中間變數。靠目視數 `)))` 必錯。
- **一畫面一檔，互不引用**。
- **數字欄一律 `tabular-nums` + 等寬字型**，讓表格可逐行比較。

---

## 開發狀態

- ✅ 17 個畫面完成，五態齊備
- ✅ 窄屏檢視器抽屜
- ✅ 5 層驗證全綠
- ⬜ 尚未接上真實 IndexedDB（目前是示範資料 + 本機狀態）
- ⬜ 尚未接上 OpenTakeoff 引擎與兩支 bridge
- ⬜ 尚未在真實瀏覽器做視覺驗收

去識別化說明：本專案所有示範資料（機構名、合約編號、項目名、人名）均為虛構代號
（`AC-2024-xxx`、`示範醫院 A`、`示範使用者` 等），不含任何真實客戶資料。
此為刻意設計，**請勿改回真實值**。

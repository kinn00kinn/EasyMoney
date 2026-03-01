# EasyMoney Architecture

## 1. 全体構成 (文章アーキテクチャ図)

```
React (Vite) SPA
  └─ `/api/*` へ fetch
Cloudflare Worker (wrangler)
  ├─ itty-router + zod で REST ルーティング
  ├─ PayPay CSV パーサ (PapaParse)
  └─ Cloudflare D1 (SQLite) に永続化
```

- フロントと API は同一リポジトリ・同一デプロイ。Cloudflare の `ASSETS` binding がフロント配信を担当し、`/api/` だけ Worker が処理。
- D1 には複式簿記のトランザクション (`transactions`) と仕訳行 (`entries`) を保存。家計簿 UI はシンプルな入力に見えても内部では必ず借方=貸方を生成。

## 2. データモデル / テーブル設計

| Table | 役割 | 主な列 |
| --- | --- | --- |
| `accounts` | 現金/銀行/クレカ等の口座 | `type (cash/bank/credit)`, `balance` は `entries` から集計 |
| `categories` | 費目 (収入/支出/振替) | `kind` で借方/貸方側の意味を判定 |
| `transactions` | 家計簿の1取引 | `direction`, `payment_method`, `source(manual/import)` |
| `entries` | 仕訳行 | `ledger_type (account/category)`, `side (debit/credit)` |
| `imports` | CSV 取り込みバッチ | `provider=paypay-bank`, `status` |
| `import_rows` | CSV 内の行 | `flow (inflow/outflow)`, `category_id`, `transaction_id` |

`worker/migrations/0001_init.sql` でスキーマ、`0002_seed.sql` で口座/カテゴリの初期データを投入します。

## 3. API 一覧

| Method | Path | 説明 |
| --- | --- | --- |
| `GET /api/health` | ヘルスチェック |
| `GET /api/accounts` | 口座一覧 + 最新残高 |
| `POST /api/accounts` | 口座作成 |
| `PATCH /api/accounts/:id` | 口座情報を更新 |
| `DELETE /api/accounts/:id` | 未使用の口座を削除 |
| `GET /api/categories` | カテゴリ一覧 + 累計 |
| `POST /api/categories` | カテゴリ作成 |
| `PATCH /api/categories/:id` | カテゴリ名称や区分を更新 |
| `DELETE /api/categories/:id` | 未使用のカテゴリを削除 |
| `GET /api/transactions?month=YYYY-MM` | 取引一覧 (最新 50件) |
| `POST /api/transactions` | 手入力取引 → 仕訳を自動生成 |
| `GET /api/transactions/:id` | 取引詳細 + 仕訳行 |
| `PATCH /api/transactions/:id` | 取引内容を更新（仕訳も再生成） |
| `DELETE /api/transactions/:id` | 取引を削除 |
| `GET /api/transactions/suggestions` | 入力支援の候補 (よく使うお店/カテゴリ/口座) |
| `GET /api/analytics/summary` | 口座残高と今月の収入/支出 |
| `GET /api/analytics/monthly` | 過去 12 ヶ月の収支推移 |
| `GET /api/analytics/categories` | カテゴリ別の集計 |
| `GET /api/analytics/sankey` | 支払方法 × カテゴリの出力データ |
| `GET /api/backup` | 全データの JSON バックアップをダウンロード |
| `POST /api/imports/paypay` | PayPay銀行 CSV を取り込み (multipart/form-data) |
| `GET /api/imports/:id` | 取り込み行の確認 |
| `POST /api/imports/:id/confirm` | 行ごとにカテゴリを割り当てて仕訳化 |
| `POST /api/demo/seed` | デモデータ投入 (Authorization: Bearer `<DEMO_TOKEN>`) |

レスポンスは `{ data: ... }` or `{ ok: true }` を基本形に統一。

## 4. 画面一覧 / 画面遷移

1. **取引入力**  
   - 金額・日付・内容・口座・カテゴリ・メモの入力フォーム  
   - よく使うお店/カテゴリ/支払方法のチップでワンタップ入力  
   - 直近 50 件を表示、モバイルでも片手操作できるグリッド
2. **口座**  
   - 現金/銀行/クレカの残高カード  
   - 口座追加フォーム
3. **カテゴリ**  
   - 区分別の一覧と累計支出  
   - カテゴリ追加フォーム
4. **分析**  
   - 今月のサマリ、月次推移ラインチャート、カテゴリ別円グラフ、支払方法×カテゴリのトップフロー表
5. **CSV 取込**  
   - 口座選択と CSV アップロード  
   - 解析結果をテーブル表示し、カテゴリを選択 → 登録

ナビゲーションはタブで切り替え。スマホでは縦並び。

## 5. 実装順序 (MVP 推奨ステップ)

1. **基盤**: Cloudflare C3 でフルスタックテンプレート作成 → Wrangler/D1 を設定  
2. **DB & API**: `accounts`, `categories`, `transactions`, `entries` を D1 で整備し、`/api/*` を実装  
3. **フロント基礎**: React Query + 共通 API クライアントを追加し、取引入力/一覧 + 口座表示を構築  
4. **分析/グラフ**: `recharts` で月次推移・カテゴリ別・支払方法別ビューを追加  
5. **CSV 取込**: PayPay フォーマットのパース、取り込みステップ、確定 API を実装  
6. **仕上げ**: UI 微調整、README/ドキュメント整備、デプロイ設定 (`npm run deploy`)

この順番で進めることで、常に整合性の取れた複式簿記データを中心に設計できます。

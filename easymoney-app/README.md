# EasyMoney

Cloudflare Workers + React で構築した、複式簿記ベースの家計簿 Web アプリです。  
フロントは Vite/React、API は Cloudflare Worker、データは D1 に保存します。

## プロジェクト構成

- `src/` … React フロントエンド (取引入力、口座管理、分析ダッシュボード、CSV 取込 UI)
- `worker/` … Cloudflare Worker API と D1 用マイグレーション
- `worker/index.js` … REST API (口座・カテゴリ・取引・分析・CSV 取込)
- `worker/migrations` … D1 スキーマと初期データ

詳細なアーキテクチャや API 使用例は `docs/ARCHITECTURE.md` を参照してください。

## セットアップ

1. 依存関係をインストール

   ```bash
   npm install
   ```

2. Cloudflare D1 を作成し、払い出された `database_id` を下記コマンドで設定

   ```bash
   npm run configure:d1 <your-d1-database-id>
   ```

   任意で第 2 引数に `database_name` も上書きできます。
3. マイグレーションを適用

   ```bash
   npx wrangler d1 execute <DATABASE_NAME> --local --file worker/migrations/0001_init.sql
   npx wrangler d1 execute <DATABASE_NAME> --local --file worker/migrations/0002_seed.sql
   ```

   本番/ステージングでは `--local` を省き、Cloudflare 側の D1 に適用してください。

4. ローカル開発を開始 (Cloudflare 公式 C3 テンプレート準拠)

   ```bash
   npm run dev
   ```

   `@cloudflare/vite-plugin` が Vite と Worker を統合し、`/api/*` に対するリクエストを Worker に転送します。

## ビルドとデプロイ

```bash
npm run build      # Vite ビルド + Worker バンドル
npm run preview    # ビルド済みフロントの確認
npm run deploy     # D1 設定チェック後に wrangler deploy
```

`npm run deploy` は `wrangler.jsonc` に本番用 `database_id` が入っていない場合はエラーで停止し、Cloudflare へ無効なリクエストを送らないようになっています。既に `wrangler deploy` を直接実行する CI がある場合も同じチェックを入れてください。

## 主要機能

- 手入力による取引登録 (複式簿記の仕訳を自動生成)
- 取引詳細ビューで仕訳を確認しながら編集
- 月別フィルタで取引一覧とカテゴリ分析を切り替え
- 口座残高・カテゴリ別累計・月次推移などの分析表示
- PayPay 銀行 CSV 取込と仕訳への反映
- REST API
  - `GET/POST /api/accounts`
  - `GET/POST /api/categories`
  - `GET/POST /api/transactions`
  - `GET /api/analytics/*`
  - `POST /api/imports/paypay`, `GET /api/imports/:id`, `POST /api/imports/:id/confirm`

## 環境変数・バインディング

`wrangler.jsonc` に定義済み:

- `DB` … Cloudflare D1 (複式簿記データ)
- `ASSETS` … Cloudflare による静的アセット配信 (C3 テンプレートで自動付与)

必要に応じて API キーや他サービスのバインディングを `wrangler.jsonc` の `vars` セクションに追加してください。

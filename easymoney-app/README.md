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

4. ローカル開発を開始 (Cloudflare Worker + Vite を同時に起動)

   ```bash
   npm run dev
   ```

   `wrangler dev --local` が裏側で実行され、`http://127.0.0.1:5173` に Vite、`http://127.0.0.1:8787` に Worker(API) が立ち上がります。  
   `.dev.vars` に `DEMO_TOKEN` やその他の環境変数を書いておけば自動で読み込まれます。

5. **初回だけ** D1 スキーマを適用 (ローカル)

   ```bash
   wrangler d1 execute local-easymoney-db --local --file worker/migrations/0001_init.sql
   wrangler d1 execute local-easymoney-db --local --file worker/migrations/0002_seed.sql
   ```

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
- よく使うお店/カテゴリ/支払方法のサジェストで素早く入力
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
- `DEMO_TOKEN` … デモデータ投入 API 用のトークン。任意のランダム文字列に置き換えてください。

### OAuth ログイン

本番環境では OAuth を介したログインが必要です。`wrangler.toml/json` あるいは Cloudflare Dashboard で次の変数を設定してください。

- `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`
- `OAUTH_AUTHORIZATION_URL`, `OAUTH_TOKEN_URL`, `OAUTH_USERINFO_URL`
- `OAUTH_REDIRECT_URI` (例: `https://<your-domain>/api/auth/callback`)
- 任意: `OAUTH_SCOPES` (デフォルトは `openid profile email`)
- 任意: `OAUTH_ALLOWED_EMAILS` (カンマ区切りで許可ドメイン/メールを制限)
- 任意: `AUTH_COOKIE_SECURE` (`false` にすると開発用 HTTP でも Cookie をセットできます)

必要に応じて API キーや他サービスのバインディングを `wrangler.jsonc` の `vars` セクションに追加してください。

## デモデータの投入

1. `wrangler.jsonc` の `vars.DEMO_TOKEN` をランダム文字列に書き換え、Cloudflare 側でも `wrangler secret put DEMO_TOKEN` などで同じ値を設定する。
2. デプロイ済み Worker かローカル dev サーバーを起動。
3. トークンを環境変数にセットしてスクリプトを実行。

```bash
export DEMO_TOKEN=your_token_value
npm run seed:demo -- --url=https://<your-worker-domain>/api/demo/seed
# ローカルであれば --url オプションは省略可 ( http://127.0.0.1:8787/api/demo/seed )
```

`?reset=true` を付けると既存の取引やインポートを削除してからサンプル（食費/日用品/給与など8件）を挿入します。

### ローカルでの動作確認

1. `.dev.vars` に `DEMO_TOKEN=local-demo` のような値を記載して `npm run dev` を起動します。（`wrangler dev --local` が立ち上がり、API は `127.0.0.1:8787` で待ち受けます）
2. 別ターミナルで `export DEMO_TOKEN=local-demo` した上で、`npm run seed:demo -- --url=http://127.0.0.1:8787/api/demo/seed?reset=true` を実行するとローカル Worker にデモデータを投入できます。
3. フロントエンド (Vite) は `http://localhost:5173` で確認できます。`/api/*` へのアクセスは 8787 ポートの Worker へプロキシされます。

これで UI を開くだけで最新の取引・サジェスト候補をすぐ確認できます。

### トラブルシューティング

- 500 エラーで Worker が落ちる場合は `wrangler dev` のコンソールに出るスタックトレースを確認し、D1 マイグレーションの適用漏れや `DEMO_TOKEN` の不一致がないかをチェックしてください。
- `env.DB` バインディングが無い状態で `/api` にアクセスすると「D1 binding is not configured...」というエラーが返ります。`npm run dev` (`wrangler dev --local`) を起動した状態か、本番にデプロイされた Worker に向けてアクセスしてください。

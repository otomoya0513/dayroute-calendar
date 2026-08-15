# DayRoute

DayRoute は、1日の予定と移動ルートを地図上でまとめて確認できるスケジュール管理アプリです。予定ごとに場所と時刻を登録すると、予定間の移動時間や距離を算出し、間に合わない可能性がある移動を分かりやすく表示します。

## 主な機能

- 日・週・月・年単位での予定確認
- 場所検索を使った予定の登録
- 予定間の移動ルート、所要時間、距離の表示
- 移動時間が不足する可能性がある予定の通知
- 自宅や職場など、よく使う場所のお気に入り登録
- 1日の開始地点を含めた移動計画の確認
- ブラウザーのローカルストレージへの予定・場所の保存

本番環境: https://dayroute-calendar.vercel.app

## 技術構成

[vinext](https://github.com/cloudflare/vinext) 上で動作する、シンプルなフルスタックのスターターです。
必要に応じて Cloudflare D1 と Drizzle も利用できます。

## 前提条件

- Node.js `>=22.13.0`
- `flock`、`curl`、GNU `timeout` を利用できる Linux

## Sites のライフサイクル

Sites のライフサイクル CLI は、このチェックアウトを返す前にロックファイルに基づく依存関係のインストールを実行します。`app/` 以下のソースを編集し、確認または共有できるまとまりになった時点でチェックポイントを作成してください。リモートの Sites ビルダーは、Push されたコミットに対して `npm run build` を実行します。通常のチェックポイント前の手順として、インストールやビルドを繰り返さないでください。

このスターターでは `wrangler.jsonc` を使用しません。

`install:ci` は、意図的に再試行を行わず、`npm ci` を1回だけ実行します。同じプロジェクトでの同時インストールを拒否し、一致するイメージ組み込み済みの npm キャッシュを `--prefer-offline` で利用します。キャッシュオブジェクトがない場合はレジストリへフォールバックし、それ以外の場合は `package-lock.json` に記録された vinext の tarball 全体をダウンロードして検証します。また、npm のソケット数を1つに制限し、停止したインストールを終了します。`build` は短いタイムアウトを適用した後、Sites の成果物を検証します。これらの補助スクリプトは Linux を対象として GNU `timeout` を使用するため、macOS ネイティブのスクリプトではありません。

プロジェクト単位で書き込み可能なホーム、npm、XDG、一時パスを必要とするスクリプトは、`scripts/sites-env.sh` を使用します。`dev` と `start` の各スクリプトは呼び出し元の実行環境を尊重し、Wrangler のログをチェックアウト内に保持します。生成される `.sites-runtime/` ディレクトリは破棄可能で、Git の管理対象外です。

## 含まれる構成

- サイトのコードは `app/` 以下で編集します
- `app/chatgpt-auth.ts` は、Dispatch が管理する任意の ChatGPT サインイン補助関数を提供します
- `.openai/hosting.json` は、任意の Sites D1 および R2 バインディングを宣言します
- `vite.config.ts` は、ローカル開発用に宣言済みのバインディングを再現します
- `db/index.ts` は、Cloudflare Worker 環境から D1 バインディングを読み取ります
- `db/schema.ts` は、意図的に空の状態から始まります
- `examples/d1/` には、任意で利用できる D1 のサンプル画面が含まれます
- `drizzle.config.ts` は、必要に応じたローカルでのマイグレーション生成に対応します

## ワークスペース認証ヘッダー

OpenAI ワークスペースのサイトは、`oai-authenticated-user-email` から現在のユーザーのメールアドレスを読み取れます。

SIWC で認証されたワークスペースのサイトでは、ユーザーの SIWC プロフィールに空でない `name` クレームがある場合、`oai-authenticated-user-full-name` も受け取ることがあります。氏名の値はパーセントエンコードされた UTF-8 で、`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8` が付随します。

氏名は任意項目として扱い、存在しない場合はメールアドレスへフォールバックしてください。

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Dispatch が管理する任意の ChatGPT サインイン

サイトで任意または必須の ChatGPT サインインが必要な場合は、`app/chatgpt-auth.ts` からすぐに使える補助関数をインポートしてください。

- 任意のサインイン済み UI には `getChatGPTUser()` を使用します。
- 匿名の訪問者を ChatGPT サインインへ誘導するサーバーレンダリングページには、`requireChatGPTUser(returnTo)` を使用します。
- ブラウザーのリンクまたはアクションには、`chatGPTSignInPath(returnTo)` と `chatGPTSignOutPath(returnTo)` を使用します。
- サインインまたはサインアウト後の移動先として、同一オリジンの相対 `returnTo` パスを渡します。補助関数が検証し、安全にエンコードします。
- 保護対象のページはリクエストごとの識別ヘッダーに依存するため、`export const dynamic = "force-dynamic"` を指定します。

Dispatch は `/signin-with-chatgpt`、`/signout-with-chatgpt`、`/callback`、OAuth Cookie、識別ヘッダーの注入を管理します。これらの予約済みパスにアプリのルートを実装しないでください。補助関数をインポートして呼び出さないルートは、匿名アクセスとの互換性を維持します。

SIWC が確立するのは識別情報のみで、ワークスペースへの所属を証明するものではありません。ワークスペース全体を制限する場合は Sites ホスティングプラットフォームのアクセスポリシー制御を使用するか、サーバー側で明示的なメンバーシップ確認または許可リスト確認を実施してください。

SIWC は、アカウントページ、ユーザー固有のダッシュボード、保存済みレコード、現在の ChatGPT ユーザーに紐づく書き込み操作に使用します。公開コンテンツは匿名のままにしてください。

## 診断コマンド

- `npm run install:ci`: ロックファイルに基づく、制限時間付きのインストールを1回実行します
- `npm run dev`: Vite/Vinext 開発サーバーを起動します
- `npm run build`: デプロイ可能な Sites 成果物をビルドして検証します
- `npm run start`: ビルド済みの Vinext アプリケーションを起動します
- `npm test`: ビルドと検証を行い、レンダリングされた開発プレビューのメタデータを確認します
- `npm run validate:artifact`: 既存の成果物のマニフェストと ESM の `default.fetch` エクスポートを再確認します
- `npm run db:generate`: スキーマ変更後に Drizzle のマイグレーションを生成します

ビルドおよび検証コマンドは、通常のチェックポイント手順ではなく、リモートで失敗した後の対象を絞った診断に使用してください。

制御されたカナリア実行では、`SITES_INSTALL_TIMEOUT`、`SITES_INSTALL_KILL_AFTER`、`SITES_BUILD_TIMEOUT`、`SITES_BUILD_KILL_AFTER` を使って既定のタイムアウトを上書きできます。タイムアウトするとコマンドは失敗し、補助スクリプトが変更のないインストールやビルドを再試行することはありません。

## 関連情報

- [vinext ドキュメント](https://github.com/cloudflare/vinext)
- [Drizzle D1 ガイド](https://orm.drizzle.team/docs/get-started/d1-new)

# DayRoute Maestro E2E テスト

`.maestro/` 内のフローは、`https://dayroute-calendar.vercel.app` の本番アプリケーションをテストします。

## テスト範囲

- 本番ページの読み込みと、日・週・月・年表示の切り替え
- 場所のオートコンプリートを使用した予定の作成
- ブラウザー再読み込み後の予定の保持
- お気に入り地点の作成と開始地点の選択

各フローは開始時にブラウザーの状態を消去するため、個別に実行できます。
予定作成フローでは、DayRoute の localStorage によるデータ保持を検証するため、意図的に状態を消去せず一度再読み込みします。

## ローカルでの実行

Maestro CLI をインストールし、リポジトリのルートからすべてのフローを実行します。

```powershell
maestro test .maestro
```

短時間で完了する本番スモークテストのみを実行します。

```powershell
maestro test .maestro --include-tags smoke
```

## GitHub Actions

`.github/workflows/maestro-e2e.yml` は、以下のタイミングで実行されます。

- **Actions > Maestro E2Eテスト > Run workflow** から手動で実行したとき
- デプロイ成功のステータスイベントを受け取った後
- 毎日 09:00（日本標準時）

このワークフローは Vercel の本番 URL を対象とし、シークレットを必要としません。

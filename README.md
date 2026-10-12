# MATCHMAN ウェブサイト

Unityプロジェクトと同じ Unity Authentication のアカウントを使うサイトです。`Website` フォルダ単独をGitリポジトリとして扱い、Vercelへ公開します。公開環境の認証・データベース設定は別途必要です。

## できること

- ゲーム紹介、開発ノート、Steamページ準備中の案内
- Unity Authentication のログインIDとパスワードによる新規登録・ログイン
- Googleログイン。最初にゲームと同じログインIDでサイトに入り、アカウント画面からGoogleを連携すると、次回から同じプレイヤーIDにGoogleでログイン可能
- プレイヤー名の初回設定と変更。3〜16文字の日本語・英字・数字・アンダースコアを使用。NFKC正規化と小文字化した名前で重複を防止
- 初回設定の後、変更するたびに14日間の待機期間を設定。次に変更できる日時を表示
- Unity Cloud Save に名前を反映。ゲームのログイン時と約60秒ごとに自分の名前を再取得。フレンド側も公開名を約60秒ごとに再取得
- レベル、ティア、ダイヤ数を既存の `mc_profile` から読み取り表示

Steamの実際のストアURLが決まるまでは、ボタンを押せない「準備中」として表示します。公開後は `public/app.js` の `steamUrl` に **MATCHMAN自身のSteamストアURL** を指定します。

## アカウントと名前の仕組み

```
ブラウザ → /api/auth → Unity Authentication
ブラウザ → /api/name → Neon Postgres（名前の重複・14日制限の確定）
                       → Unity Cloud Save mc_name_meta / mc_public_name
Unityゲーム → mc_name_meta を読む → 自分の名前
Unityゲーム → 友人の mc_public_name を読む → フレンド欄の名前
```

Unity Authentication のユーザー名は**ログインID**です。ゲームの「フレンドコード」は既存の Unity Player Name を利用しているため、このサイトは Player Name を変更しません。画面に表示する**プレイヤー名**は別に管理します。

Google連携はUnity Authenticationの `google.com` プロバイダーを既存プレイヤーにリンクします。GoogleのメールアドレスでUnityアカウントを推測・統合しません。別のプレイヤーIDにすでに紐付くGoogleアカウントを強制的に奪わないよう `forceLink: false` としています。Googleログイン時は `signInOnly: true` を指定し、未連携のGoogleアカウントから別のゲームアカウントを自動作成しません。現行ゲームにはGoogleログイン画面がないため、ゲーム側では従来のログインID・パスワードを使います。

名前の一意性と変更制限は Neon の `player_names` テーブルで原子的に判定します。ブラウザの表示だけで制限していません。Cloud Save への同期に失敗したときは `sync_pending` を残し、次のプロフィール表示で再試行します。ゲームの `mc_profile` 全体をサイトから上書きせず、進行状況を保護します。

初回設定は `changes=0`、以後の変更は `changes` が増えます。初回も設定後14日間は変更できません。同じ名前を再送した場合は変更回数を増やしません。

ゲーム内で作成済みのログインID・パスワードも利用できます。現在の**ゲスト専用アカウントはサイトで直接ログインできません**。ゲスト進行状況を引き継ぐには、Unity Authentication のアカウント連携機能をゲーム内に追加する必要があります。新規登録をすると新しいゲームアカウントになります。

以前から存在するゲーム内の名前は、最初にサイトで名前を登録するまでは中央の重複管理に入りません。既存プレイヤーは初回ログイン時に名前を設定してください。重複した既存名は先に登録したアカウントが確保し、後から登録する側は別名を選びます。サイト管理済みのアカウントについては、旧ゲーム内の自由な名前変更を使えないようにしています。

## ローカルで表示

Node.js 20以上が必要です。

```powershell
cd Website
npm install
npm run dev
```

`http://127.0.0.1:3000` で表示します。環境変数を設定しなくてもデザインを確認できます。アカウントの実動作には以下の設定が必要です。

公開環境で`SESSION_SECRET`と`DATABASE_URL`が両方揃うまでは、新規登録・ログインを画面とAPIの両方で停止します。設定途中にUnity側だけアカウントが作られる状態を避けるためです。

## 実サービスの設定と公開手順

1. Unity Dashboard で、このゲームと**同じ** Unity Project ID と Environment を確認します。現プロジェクトIDは `.env.example` に記載されています。
2. NeonでPostgresプロジェクトを作り、`db/schema.sql` をSQL Editorで実行します。別のデータベースを使う場合も同じテーブルと一意制約が必要です。
3. `.env.example` を `Website/.env` にコピーし、`DATABASE_URL` とランダムな32文字以上の `SESSION_SECRET` を設定します。`SESSION_SECRET` はサーバー専用で、公開アセットに入れないでください。`.env` は `.gitignore` に登録済みです。
4. Google CloudでOAuth同意画面を設定し、**Webアプリケーション**用のOAuthクライアントIDを作成します。承認済みJavaScript生成元にローカルの `http://127.0.0.1:3000`（利用できない場合は `http://localhost:3000` に統一）と公開時の `https://<サイトのドメイン>` を登録します。ポップアップのJavaScriptコールバック方式を使用するため、リダイレクトURIやクライアントシークレットはサイト側で使用しません。
5. Unity DashboardのAuthenticationで **Googleプロバイダー**を有効にし、同じWebクライアントIDを設定します。`GOOGLE_CLIENT_ID` にこのIDを指定します。クライアントIDは公開可能な識別子ですが、秘密鍵・クライアントシークレットをブラウザに渡さないでください。Google設定が空欄ならサイトではGoogleボタンを表示しません。
6. ローカルで実アカウントを使って登録、名前設定、再ログイン、Unityゲーム内反映、フレンド欄更新を確認します。GoogleについてはログインIDでログイン → Google連携 → ログアウト → Googleログイン → **同じPLAYER ACCOUNT ID**になることを確認します。既存の本番プレイヤーの名前を使った検証は、14日制限が実際に発生するため慎重に行ってください。
7. このフォルダ単独のリポジトリをVercelへ読み込み、**Root Directoryは既定のリポジトリルート（`.`）** にします。`UNITY_PROJECT_ID`、`UNITY_ENVIRONMENT`、`DATABASE_URL`、`SESSION_SECRET`、`GOOGLE_CLIENT_ID` をEnvironment Variablesに登録します。`public` が静的サイト、`api` がサーバー関数です。公開URLをGoogle Cloudの承認済みJavaScript生成元に追加します。
8. Steamページが完成したら `public/app.js` の `steamUrl` を実URLに変更し、リンク先を確認します。

Vercel Hobbyは無料ですが、公式規約では個人の非商用利用に制限されています。将来ダイヤ販売などの商用運用を始める際は、公開前にプランと規約を再確認してください。Unity Authenticationは現行ドキュメントで利用料金なしとされています。Neonも無料枠がありますが、容量・利用枠は公開前に現行プランを確認してください。

## 安全性と今後の運用

- Unityのパスワードは本サイトのDBに保存しません。ログイン情報はTLS上でUnity Authenticationへ渡します。
- GoogleのIDトークンはサーバーでGoogle公式ライブラリにより署名・発行者・有効期限・クライアントIDを検証してからUnity Authenticationへ送ります。Googleのメールアドレスをアカウント識別子として使用しません。
- UnityのトークンはAES-GCMで暗号化した`HttpOnly`・`SameSite=Strict` Cookieに保持し、名前変更にはCSRFトークンと同一Origin確認を使います。
- サーバー秘密情報はVercel環境変数だけに置きます。ブラウザには返しません。
- ゲームのCloud Saveは通常のクライアントから自分のデータを書き込める仕組みです。**改造クライアントによる名前偽装や不正な進行状況の変更まで防ぐには、将来サーバー権限でのゲーム内検証が必要**です。今回の制限は通常のサイト・ゲーム操作に対して機能します。
- 認証失敗の試行回数制限、パスワード再設定、ゲストから正式アカウントへの移行、法的表示・プライバシーポリシーは一般公開前に追加・確認してください。
- ニュース欄は `public/index.html` の開発ノートを編集します。実際に公開していない更新を「配信済み」と記載しないでください。

## 元に戻す方法

サイト本体は独立した `Website` ディレクトリです。Unity側で変更した5ファイルの元版は `DevBackups/WebNameIntegration-20261012` に保存しました。戻す場合はUnityを停止し、この5ファイルを `Assets/Scripts` に戻してからEditorを再コンパイルしてください。既存シーン、Prefab、`mc_profile` の構造は変更していません。

## 参考ドキュメント

- [Unity Authentication Username & Password](https://docs.unity.com/en-us/authentication/platform-signin/username-password)
- [Unity Authentication REST API](https://docs.unity.com/en-us/oas-player-auth-client/1.0.0)
- [Unity Authentication Google](https://docs.unity.com/en-us/authentication/platform-signin/google)
- [Google Identity Services](https://developers.google.com/identity/gsi/web/guides/display-button)
- [Google IDトークンの検証](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Unity Cloud Save REST API](https://docs.unity.com/en-us/oas-cloud-save/1.0.0)
- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)

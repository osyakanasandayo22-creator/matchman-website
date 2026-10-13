# MATCHMAN: Google ログイン設定

Googleログインは、サイトの公開URLが確定してから設定します。このサイトはGoogle Identity ServicesのJavaScriptコールバックでIDトークンを受け取り、サーバーで検証した後、Unity Authenticationの`google.com`プロバイダーに渡します。

## 1. Google CloudでクライアントIDを作成

1. [Google Cloud Console](https://console.cloud.google.com/) に、運営に使用するGoogleアカウントでログインします。
2. 上部のプロジェクト選択から、再利用候補の既存プロジェクト **ShortCut**（プロジェクトID `shortcut-485012`）を選びます。2026年10月13日のリソース一覧では最終アクセスが2026年1月21日で、Firebaseラベルがない候補でした。OAuthクライアントと有効なAPIの一覧はGoogle Cloud Console側の読み込みエラーで未確認です。既存設定を確認してからMATCHMAN用に設定してください。
3. 左メニューの **Google Auth Platform → Branding** でアプリ名`MATCHMAN`、サポート用メールアドレス、デベロッパー連絡先を設定します。一般向けに公開する場合は、サイトと一致したホームページ・プライバシーポリシーのURLなど、画面が要求する情報も設定します。
4. **Audience** では、一般プレイヤー向けなら`External`を選びます。`Testing`の間は登録したテストユーザーだけが利用できます。公開するときはGoogle側の公開状態と要求される審査を確認します。
5. **Clients → Create client → Application type: Web application** を選びます。名前は例えば`MATCHMAN Website`にします。
6. **Authorized JavaScript origins** に、実際の公開URLのオリジン（例: `https://matchman-website.vercel.app`）を登録します。パスや末尾の`/`は付けません。ローカルでも試す場合は`http://localhost:3000`も追加します。VercelのプレビューURLは毎回変わるため、まず固定のProduction URLを登録します。
7. このサイトはJavaScriptコールバック方式なので、**Authorized redirect URIs は空欄**で構いません。**Create**を押し、表示された`...apps.googleusercontent.com`形式の**Client ID**を控えます。Client Secretはこのサイトでは使いません。

公開用のサポートメールアドレスは未準備です。Googleのブランディング画面に運営者個人のGmailを公開用として登録せず、専用アドレスを用意してから設定してください。

## 2. 同じIDをUnityとVercelに設定

1. [Unity Dashboard](https://cloud.unity.com/) のMATCHMANプロジェクト（Unity Project IDは`.env.example`を参照）の **Authentication** で **Google** をID Providerに追加・有効化し、上記の**Web App Client ID**を設定して保存します。ゲームが使用するEnvironmentとサイトの`UNITY_ENVIRONMENT`を同じにします。
2. VercelのMATCHMANサイトで **Settings → Environment Variables** を開き、`GOOGLE_CLIENT_ID`に同じClient IDを登録します。少なくともProduction環境に登録し、再デプロイします。
3. `UNITY_PROJECT_ID`、`UNITY_ENVIRONMENT`、`SESSION_SECRET`、`DATABASE_URL`もサイトの実動作に必要です。`SESSION_SECRET`や`DATABASE_URL`をブラウザやGitHubに貼らず、Vercelの環境変数にだけ保存します。

## 3. 連携を確認

1. 既存のMATCHMANアカウントに、従来のログインID・パスワードでサイトからログインします。
2. アカウント欄で**Googleアカウントを連携**します。
3. ログアウト後、**Googleでログイン**します。同じ`ACCOUNT ID`が表示されることを確認します。

未連携のGoogleアカウントでGoogleログインを押すと、新しいゲームアカウントを自動作成します。既存アカウントを維持したい場合は先に既存アカウントへGoogleを連携してください。ゲームはサイトで認証したアカウントをCode Linkで受け取ります。Unity DashboardのPlayer AuthenticationでCode Linkプロバイダーも有効にしてください。

## 公式資料

- [Google Identity Services: Web用クライアントID](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Unity Authentication: Google](https://docs.unity.com/en-us/authentication/platform-signin/google)

const $ = id => document.getElementById(id);
const state = { mode: 'login', csrf: null, profile: null, googleReady: false };

function message(text, success = false) {
  const node = $('account-message');
  node.textContent = text;
  node.classList.toggle('ok', success);
  node.hidden = !text;
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api/${path}`, { credentials: 'same-origin', cache: 'no-store', ...options });
  } catch {
    throw new Error('接続できませんでした。通信状態を確認してください。');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || '処理に失敗しました。');
  return data;
}

function setMode(mode) {
  state.mode = mode;
  const signup = mode === 'signup';
  $('tab-login').classList.toggle('active', !signup);
  $('tab-login').setAttribute('aria-selected', String(!signup));
  $('tab-signup').classList.toggle('active', signup);
  $('tab-signup').setAttribute('aria-selected', String(signup));
  $('auth-intro').textContent = signup ? '新しいアカウントを作成します。登録後、プレイヤー名を設定してください。' : 'ゲームで登録したログインIDとパスワードを入力してください。';
  $('password').autocomplete = signup ? 'new-password' : 'current-password';
  $('password-hint').hidden = !signup;
  $('auth-submit').firstChild.textContent = signup ? 'アカウントを作成 ' : 'ログインする ';
  $('google-login-area').hidden = signup;
  message('');
}

function dateLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '日時を確認できません';
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(date);
}

function renderProfile(profile) {
  state.profile = profile;
  state.csrf = profile.csrf;
  $('auth-view').hidden = true;
  $('profile-view').hidden = false;
  $('profile-name').textContent = profile.displayName || '名前未設定';
  $('profile-id').textContent = `ACCOUNT ID  ${profile.playerId}`;
  $('profile-tier').textContent = profile.tier || 'E';
  $('tier-icon').src = `/assets/tier-${String(profile.tier || 'E').toLowerCase()}.png`;
  $('tier-icon').alt = `ティア${profile.tier || 'E'}`;
  $('profile-level').textContent = Number(profile.level || 1).toLocaleString('ja-JP');
  $('profile-diamonds').textContent = Number(profile.diamonds || 0).toLocaleString('ja-JP');

  const firstSet = Boolean(profile.firstSet);
  const available = !firstSet || new Date(profile.nextChangeAt).getTime() <= Date.now();
  $('name-heading').textContent = firstSet ? 'プレイヤー名を変更' : '最初のプレイヤー名を設定';
  if (!firstSet && profile.displayName && profile.displayName !== '名前未設定')
    $('display-name').value = profile.displayName;
  $('name-submit').textContent = firstSet ? '変更する' : '設定する';
  $('display-name').disabled = !available || !profile.nameServiceReady;
  $('name-submit').disabled = !available || !profile.nameServiceReady;
  $('name-status').textContent = !profile.nameServiceReady ? '名前管理サービスは公開時に利用可能になります。' :
    firstSet && !available ? `次回の変更可能日時：${dateLabel(profile.nextChangeAt)}` :
    firstSet ? '変更後、次に変更できるのは14日後です。' :
    '初回設定です。設定後、次に変更できるのは14日後です。';
  $('sync-note').hidden = !profile.syncPending;
  $('sync-note').textContent = profile.syncPending ? '名前を確保しました。ゲームへの反映を再試行中です。しばらくしてからページを再読み込みしてください。' : '';
  $('google-link-button').hidden = profile.googleLinked === true || !state.googleReady;
  $('google-link-status').textContent = profile.googleLinked === true ? '連携済みです。次回からGoogleで同じゲームアカウントにログインできます。' :
    !state.googleReady ? 'Googleログインの公開設定を準備中です。' :
    'このゲームアカウントにGoogleを連携すると、次回からGoogleでもログインできます。';
}

async function handleGoogleCredential(response) {
  const mode = $('profile-view').hidden ? 'signin' : 'link';
  message('');
  try {
    await api('google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(mode === 'link' ? { 'X-CSRF-Token': state.csrf } : {}) },
      body: JSON.stringify({ mode, credential: response.credential })
    });
    renderProfile(await api('profile'));
    message(mode === 'link' ? 'Googleアカウントを連携しました。' : 'Googleでログインしました。', true);
  } catch (error) { message(error.message); }
}

async function configureGoogle() {
  try {
    const { googleClientId } = await api('config');
    if (!googleClientId) {
      $('google-login-note').textContent = 'Googleログインは公開設定の準備中です。現在はログインIDをご利用ください。';
      return;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client?hl=ja';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Googleログインを読み込めませんでした。'));
      document.head.append(script);
    });
    if (!window.google?.accounts?.id) throw new Error('Googleログインを読み込めませんでした。');
    window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential, auto_select: false });
    for (const id of ['google-login-button', 'google-link-button']) {
      $(id).replaceChildren();
      window.google.accounts.id.renderButton($(id), { theme: 'outline', size: 'large', text: id === 'google-login-button' ? 'signin_with' : 'continue_with', locale: 'ja', width: 300 });
    }
    state.googleReady = true;
    if (state.profile) renderProfile(state.profile);
  } catch (error) {
    $('google-login-note').textContent = error.message;
  }
}

async function loadProfile() {
  try {
    renderProfile(await api('profile'));
  } catch (error) {
    $('auth-view').hidden = false;
    $('profile-view').hidden = true;
    window.google?.accounts?.id?.disableAutoSelect();
    if (!/ログインしてください|ログインし直してください/.test(error.message)) message(error.message);
  }
}

$('tab-login').addEventListener('click', () => setMode('login'));
$('tab-signup').addEventListener('click', () => setMode('signup'));
$('auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  message('');
  const button = $('auth-submit');
  button.disabled = true;
  try {
    await api('auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: state.mode, username: $('username').value.trim(), password: $('password').value }) });
    $('password').value = '';
    renderProfile(await api('profile'));
    message(state.mode === 'signup' ? 'アカウントを作成しました。プレイヤー名を設定してください。' : 'ログインしました。', true);
  } catch (error) { message(error.message); }
  finally { button.disabled = false; }
});
$('name-form').addEventListener('submit', async event => {
  event.preventDefault();
  message('');
  const button = $('name-submit');
  button.disabled = true;
  try {
    const result = await api('name', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf }, body: JSON.stringify({ name: $('display-name').value }) });
    $('display-name').value = '';
    renderProfile(await api('profile'));
    message(result.message, !result.syncPending);
  } catch (error) { message(error.message); button.disabled = false; }
});
$('logout').addEventListener('click', async () => {
  try {
    await api('logout', { method: 'POST', headers: { 'X-CSRF-Token': state.csrf } });
    state.csrf = null;
    state.profile = null;
    $('auth-view').hidden = false;
    $('profile-view').hidden = true;
    message('ログアウトしました。', true);
  } catch (error) { message(error.message); }
});

const steamUrl = '';
if (steamUrl) {
  for (const id of ['steam-hero', 'steam-footer']) {
    const button = $(id);
    const link = document.createElement('a');
    link.href = steamUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = button.className;
    link.textContent = 'Steamで見る ↗';
    button.replaceWith(link);
  }
}

loadProfile();
configureGoogle();

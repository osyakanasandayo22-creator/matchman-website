const code = new URLSearchParams(location.search).get('gameCode');
if (code || location.hash === '#account') {
  const destination = new URL('/account.html', location.origin);
  if (code) destination.searchParams.set('gameCode', code);
  location.replace(destination);
}

// Replace this with MATCHMAN's Steam store URL after its page is public.
const steamUrl = '';
if (steamUrl) {
  for (const id of ['steam-hero', 'steam-footer']) {
    const button = document.getElementById(id);
    const link = document.createElement('a');
    link.href = steamUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = button.className;
    link.textContent = 'Steamで見る ↗';
    button.replaceWith(link);
  }
}

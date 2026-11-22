// Apply the saved theme before first paint to avoid a flash.
try {
  var s = JSON.parse(localStorage.getItem('tidewise:v1') || '{}').state;
  var t = (s && s.settings && s.settings.theme) || 'system';
  if (t === 'system') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
} catch (e) {}

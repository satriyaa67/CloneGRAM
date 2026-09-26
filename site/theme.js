// Applies the saved theme before first paint (separate file because the CSP forbids inline scripts).
(function () {
  var pref = 'system';
  try { pref = localStorage.getItem('clonegram.theme') || 'system'; } catch (e) { /* storage blocked */ }
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();

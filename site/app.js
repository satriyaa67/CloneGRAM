'use strict';
/*
 * CloneGRAM dashboard. Talks to the same-origin API (worker/).
 * Security: every value that comes from Telegram or the API is rendered with textContent, never innerHTML.
 * Only the static icon strings below are injected as markup.
 */
(() => {
  const TOKEN_KEY = 'clonegram.adminToken';
  const REFRESH_MS = 15000;

  const ICONS = {
    overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/></svg>',
    queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    connections: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    campaigns: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12 5 5 9-10"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>',
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  };

  const PAGES = [
    { id: 'overview', label: 'Genel görünüm', short: 'Özet' },
    { id: 'queue', label: 'İçerik kuyruğu', short: 'Kuyruk' },
    { id: 'connections', label: 'Bağlantılar', short: 'Bağlantı' },
    { id: 'campaigns', label: 'Kampanyalar', short: 'Kampanya', soon: true },
    { id: 'settings', label: 'Ayarlar', short: 'Ayarlar' },
  ];

  const REASONS = {
    bot_not_member: 'Bot bu sohbette değil. Önce botu kanala/gruba ekle.',
    bot_not_admin: 'Bot bu kanalda yönetici değil. Kanallarda bot yönetici olarak eklenmeli.',
    bot_cannot_post: 'Botun bu sohbette gönderi paylaşma yetkisi yok. Yönetici ayarlarından "Mesaj gönder" iznini aç.',
    source_content_protected: 'Bu kaynakta içerik koruması açık. CloneGRAM korumalı içeriği işlemez.',
    bot_cannot_read_group_messages: 'Bot grup mesajlarını göremiyor. Botu grupta yönetici yap ya da BotFather\'da gizlilik modunu kapat.',
    private_chats_not_supported: 'Özel sohbetler kaynak ya da hedef olamaz.',
  };

  const ERRORS = {
    rights_confirmation_required: 'Kaynak eklemek için içeriği yeniden yayımlama hakkını onaylaman gerekiyor.',
    invalid_chat_id: 'Sohbet kimliği geçersiz. @kullaniciadi ya da -100 ile başlayan sayısal kimlik gir.',
    invalid_role: 'Geçersiz rol.',
    unauthorized: 'Yönetici anahtarı geçersiz.',
    admin_api_not_configured: 'Sunucuda yönetici anahtarı tanımlı değil. Dağıtım adımlarını kontrol et.',
    telegram_rate_limited: 'Telegram kısa süreli sınır uyguladı. Birkaç saniye sonra tekrar dene.',
    internal_error: 'Sunucuda beklenmeyen bir hata oluştu.',
    network: 'Sunucuya ulaşılamadı. Bağlantını kontrol et.',
  };

  const STATUS_LABEL = { received: 'Yeni', in_review: 'İncelemede', scheduled: 'Planlandı', published: 'Yayımlandı', skipped: 'Atlandı', failed: 'Hata' };
  const MEDIA_LABEL = { text: 'Metin', photo: 'Fotoğraf', video: 'Video', animation: 'GIF', document: 'Dosya', audio: 'Ses', voice: 'Sesli mesaj', video_note: 'Görüntülü not', sticker: 'Çıkartma' };

  const state = { mode: null, token: null, entered: false, page: 'overview', filter: 'all', data: {}, timer: null, apiReachable: false };
  const root = document.getElementById('root');

  // ---------- DOM helpers ----------
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === false || value === null || value === undefined) continue;
      if (key === 'class') el.className = value;
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else if (key === 'html') el.innerHTML = value; // static icon markup only
      else el.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }
  const icon = (name, cls) => h('span', { class: cls || 'ico', 'aria-hidden': 'true', html: ICONS[name] });

  function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 3600);
  }

  function relTime(iso) {
    if (!iso) return '';
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs < 60) return rtf.format(Math.round(diff), 'second');
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    return new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  const RECENT_ERROR_MS = 15 * 60 * 1000;
  const recentError = (webhook) => !!(webhook?.lastError && webhook.lastErrorAt && Date.now() - new Date(webhook.lastErrorAt).getTime() < RECENT_ERROR_MS);
  const chatLabel = (title, username) => (username ? `${title} · @${username}` : title);
  const truncate = (text, n) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

  // ---------- API ----------
  class ApiError extends Error {
    constructor(status, body) {
      super(body?.error || `http_${status}`);
      this.status = status;
      this.body = body || {};
    }
  }

  async function api(path, options = {}) {
    if (state.mode === 'demo') return demoApi(path, options);
    let response;
    try {
      response = await fetch(path, {
        method: options.method || 'GET',
        headers: { authorization: `Bearer ${state.token}`, ...(options.body ? { 'content-type': 'application/json' } : {}) },
        body: options.body ? JSON.stringify(options.body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new ApiError(0, { error: 'network' });
    }
    let body = null;
    try { body = await response.json(); } catch { /* non-JSON */ }
    if (response.status === 401) {
      if (state.entered) logout('Oturum sona erdi. Yönetici anahtarını tekrar gir.');
      throw new ApiError(401, body);
    }
    if (!response.ok || body?.ok === false) throw new ApiError(response.status, body);
    return body;
  }

  function errorText(error) {
    const code = error?.body?.error || error?.message;
    if (code === 'telegram_error') {
      const d = (error.body.description || '').toLowerCase();
      if (d.includes('chat not found')) return 'Telegram bu sohbeti bulamadı. Kullanıcı adını kontrol et ve botun sohbete eklendiğinden emin ol.';
      if (d.includes('unauthorized')) return 'Bot token\'ı geçersiz görünüyor. GitHub\'daki TELEGRAM_BOT_TOKEN değerini kontrol et.';
      return `Telegram hatası: ${error.body.description || 'bilinmiyor'}`;
    }
    return ERRORS[code] || 'İşlem tamamlanamadı.';
  }

  async function probeApi() {
    if (location.protocol === 'file:') return false;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      const r = await fetch('/health', { cache: 'no-store', signal: controller.signal });
      clearTimeout(t);
      const body = await r.json();
      return r.ok && body?.service === 'clonegram-api';
    } catch {
      return false;
    }
  }

  // ---------- boot / auth ----------
  async function boot() {
    state.apiReachable = await probeApi();
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (state.apiReachable && saved) {
      state.mode = 'live';
      state.token = saved;
      try {
        await api('/api/summary');
        return enterApp();
      } catch {
        sessionStorage.removeItem(TOKEN_KEY);
      }
    }
    renderGate();
  }

  function renderGate(message) {
    stopTimer();
    root.replaceChildren();
    const errorEl = h('p', { class: 'error-text', role: 'alert' }, message || '');
    if (!message) errorEl.hidden = true;
    const input = h('input', { class: 'input', id: 'token', type: 'password', autocomplete: 'current-password', required: true, minlength: 8, placeholder: '••••••••••••' });
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Bağlan');

    const form = h('form', {
      onsubmit: async (event) => {
        event.preventDefault();
        submit.disabled = true;
        submit.textContent = 'Kontrol ediliyor…';
        state.mode = 'live';
        state.token = input.value.trim();
        try {
          await api('/api/summary');
          sessionStorage.setItem(TOKEN_KEY, state.token);
          enterApp();
        } catch (error) {
          state.token = null;
          errorEl.hidden = false;
          errorEl.textContent = error.status === 401 ? ERRORS.unauthorized : errorText(error);
          submit.disabled = false;
          submit.textContent = 'Bağlan';
          input.focus();
        }
      },
    },
      h('div', { class: 'field' },
        h('label', { for: 'token' }, 'Yönetici anahtarı'),
        input,
        h('span', { class: 'hint' }, 'GitHub\'a ADMIN_API_TOKEN olarak kaydettiğin değer. Yalnızca bu sekmede tutulur.')),
      errorEl,
      submit);

    const demoButton = h('button', { class: 'btn ghost', type: 'button', onclick: () => { state.mode = 'demo'; enterApp(); } }, 'Örnek verilerle incele');

    root.append(h('main', { class: 'gate' },
      h('div', { class: 'gate-box' },
        h('div', { class: 'gate-brand' }, h('img', { src: 'assets/clonegram-mark.svg', alt: '' }), h('div', { class: 'word' }, 'Clone', h('span', {}, 'GRAM'))),
        h('h1', {}, state.apiReachable ? 'Yayın stüdyona giriş yap' : 'Sunucu bağlantısı yok'),
        h('p', { class: 'lead' }, state.apiReachable
          ? 'Kaynak kanallarından gelen içerikleri buradan izleyip yöneteceksin.'
          : 'Bu sayfa CloneGRAM API\'sine ulaşamadı. Canlı kurulum tamamlanınca buradan giriş yapabilirsin; şimdilik örnek verilerle gezinebilirsin.'),
        state.apiReachable ? form : null,
        h('div', { class: 'gate-foot' }, demoButton))));
    if (state.apiReachable) input.focus();
  }

  function logout(message) {
    state.entered = false;
    sessionStorage.removeItem(TOKEN_KEY);
    state.token = null;
    state.mode = null;
    state.data = {};
    renderGate(message);
  }

  // ---------- shell ----------
  function enterApp() {
    state.entered = true;
    const hash = location.hash.replace('#', '');
    state.page = PAGES.some((p) => p.id === hash) ? hash : 'overview';
    renderShell();
    navigate(state.page, { push: false });
  }

  function navButton(page, compact) {
    return h('button', {
      type: 'button',
      'data-page': page.id,
      onclick: () => navigate(page.id),
    }, icon(page.id), compact ? page.short : page.label,
    !compact && page.id === 'queue' ? h('span', { class: 'count num', id: 'nav-count' }) : null,
    !compact && page.soon ? h('span', { class: 'soon' }, 'Faz 4') : null);
  }

  function renderShell() {
    root.replaceChildren(
      h('div', { class: 'app' },
        h('aside', { class: 'side' },
          h('div', { class: 'brand' }, h('img', { src: 'assets/clonegram-mark.svg', alt: '' }), h('div', { class: 'word' }, 'Clone', h('span', {}, 'GRAM'))),
          h('nav', { class: 'nav', 'aria-label': 'Ana menü' }, PAGES.map((p) => navButton(p, false))),
          h('div', { class: 'side-foot' },
            h('div', { class: 'mode-pill', id: 'mode-pill' }, h('span', { class: 'dot' }), state.mode === 'demo' ? 'Örnek veri modu' : 'Canlı bağlantı'))),
        h('div', { class: 'main' },
          h('header', { class: 'top' },
            h('div', { class: 'crumb' }, h('span', {}, 'CloneGRAM / '), h('strong', { id: 'crumb' }, '')),
            h('div', { class: 'top-actions' },
              h('button', { class: 'btn ghost', type: 'button', onclick: () => refresh(true), 'aria-label': 'Yenile' }, icon('refresh'), 'Yenile'))),
          h('main', { class: 'page', id: 'page', tabindex: '-1' }))),
      h('nav', { class: 'mobile-nav', 'aria-label': 'Mobil menü' }, PAGES.map((p) => navButton(p, true))));
  }

  function navigate(id, { push = true } = {}) {
    state.page = id;
    if (push) history.replaceState(null, '', `#${id}`);
    document.querySelectorAll('[data-page]').forEach((b) => {
      if (b.dataset.page === id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    const page = PAGES.find((p) => p.id === id);
    document.getElementById('crumb').textContent = page.label;
    document.title = `${page.label} · CloneGRAM`;
    refresh(false);
    startTimer();
  }

  function startTimer() {
    stopTimer();
    if (state.mode !== 'live' || !['overview', 'queue'].includes(state.page)) return;
    state.timer = setInterval(() => { if (!document.hidden) refresh(false, true); }, REFRESH_MS);
  }
  function stopTimer() { if (state.timer) clearInterval(state.timer); state.timer = null; }

  const loaders = {
    overview: async () => {
      const [status, summary, items] = await Promise.all([
        api('/api/status').catch((error) => ({ error })),
        api('/api/summary'),
        api('/api/content?limit=5'),
      ]);
      return { status, summary, items: items.items };
    },
    queue: async () => {
      const q = state.filter === 'all' ? '' : `&status=${state.filter}`;
      const [items, summary] = await Promise.all([api(`/api/content?limit=100${q}`), api('/api/summary')]);
      return { items: items.items, summary };
    },
    connections: async () => {
      const [chats, discovered] = await Promise.all([api('/api/chats'), api('/api/discovered')]);
      return { chats: chats.chats, discovered: discovered.chats };
    },
    campaigns: async () => ({}),
    settings: async () => ({ status: await api('/api/status').catch((error) => ({ error })) }),
  };

  async function refresh(manual, silent) {
    const page = state.page;
    const container = document.getElementById('page');
    if (!container) return;
    if (!silent) container.replaceChildren(h('div', { class: 'rows' }, h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' })));
    try {
      const data = await loaders[page]();
      if (state.page !== page) return;
      state.data[page] = data;
      container.replaceChildren(...views[page](data).filter(Boolean));
      updateChrome(data);
      if (manual) toast('Güncellendi');
    } catch (error) {
      if (error.status === 401) return;
      if (state.page !== page) return;
      container.replaceChildren(h('div', { class: 'note bad' }, icon('info'), h('span', {}, errorText(error))));
    }
  }

  function updateChrome(data) {
    const summary = data.summary;
    const count = document.getElementById('nav-count');
    if (count && summary) count.textContent = summary.content.received ? String(summary.content.received) : '';
    const pill = document.getElementById('mode-pill');
    if (pill && data.status && state.mode === 'live') {
      const dot = pill.querySelector('.dot');
      const healthy = !data.status.error && data.status.webhook?.active && !recentError(data.status.webhook);
      dot.className = `dot ${data.status.error ? 'bad' : healthy ? 'ok' : 'warn'}`;
    }
  }

  // ---------- views ----------
  const pageHead = (eyebrow, title, lead, action) =>
    h('div', { class: 'head' }, h('div', {}, h('span', { class: 'eyebrow' }, eyebrow), h('h1', {}, title), lead ? h('p', {}, lead) : null), action || null);

  function demoNote() {
    return state.mode === 'demo'
      ? h('div', { class: 'note' }, icon('info'), h('span', {}, h('strong', {}, 'Örnek veri modu. '), 'Değişiklikler kaydedilmez. Canlı panele giriş için ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); logout(); } }, 'çıkış yap'), '.'))
      : null;
  }

  function itemRow(item) {
    const skipped = item.status === 'skipped';
    const kindName = skipped ? 'lock' : item.media_type === 'text' ? 'text' : item.media_type === 'photo' ? 'photo' : ['video', 'animation', 'video_note'].includes(item.media_type) ? 'video' : 'file';
    const kindClass = skipped ? 'lock' : kindName === 'text' ? 'text' : kindName === 'photo' ? 'photo' : '';
    const title = skipped
      ? h('div', { class: 'row-title dim' }, 'Korumalı içerik: saklanmadı, işlenmeyecek')
      : h('div', { class: 'row-title', title: item.text || '' }, item.text ? truncate(item.text.replace(/\s+/g, ' '), 140) : `${MEDIA_LABEL[item.media_type] || 'Medya'} (açıklama yok)`);
    return h('div', { class: 'row' },
      h('div', { class: `kind ${kindClass}` }, icon(kindName)),
      h('div', { class: 'row-body' }, title,
        h('div', { class: 'row-meta' },
          h('span', {}, item.source_title ? chatLabel(item.source_title, item.source_username) : 'Kaynak'),
          h('span', {}, MEDIA_LABEL[item.media_type] || item.media_type),
          item.media_group_id ? h('span', {}, 'Albüm') : null,
          h('span', { title: new Date(item.received_at).toLocaleString('tr-TR') }, relTime(item.received_at)))),
      h('span', { class: `pill ${skipped ? 'mute' : item.status === 'received' ? '' : 'ok'}` }, STATUS_LABEL[item.status] || item.status));
  }

  function setupSteps(status, summary, hasItems) {
    const botOk = status && !status.error && !!status.bot?.username;
    const hookOk = botOk && status.webhook?.active;
    const steps = [
      [botOk, 'Bot bağlı', botOk ? `@${status.bot.username} olarak çalışıyor.` : 'Bot bilgisi alınamadı. Dağıtımdaki TELEGRAM_BOT_TOKEN değerini kontrol et.'],
      [hookOk, 'Telegram bildirimleri açık', hookOk ? (recentError(status.webhook) ? `Son hata (${relTime(status.webhook.lastErrorAt)}): ${status.webhook.lastError}` : 'Yeni gönderiler anında buraya düşer.') : 'Webhook kayıtlı değil. Dağıtım iş akışını yeniden çalıştır.'],
      [(summary.chats.source || 0) > 0, 'Kaynak kanal ekli', 'Botu kaynak kanala ekle, sonra Bağlantılar\'dan kaynak olarak kaydet.'],
      [(summary.chats.destination || 0) > 0, 'Hedef kanal ekli', 'Botu hedef kanala mesaj gönderme yetkili yönetici olarak ekle ve kaydet.'],
      [hasItems, 'İlk içerik geldi', 'Kaynak kanalda yeni bir gönderi paylaş; birkaç saniye içinde kuyrukta görünür.'],
    ];
    const done = steps.filter(([ok]) => ok).length;
    return h('section', {},
      h('div', { class: 'sec-head' }, h('h2', {}, 'Kurulum'), h('span', { class: 'xs muted num' }, `${done}/${steps.length} tamam`)),
      h('ol', { class: 'steps' }, steps.map(([ok, title, detail], i) =>
        h('li', {}, h('span', { class: `mark ${ok ? 'done' : ''}` }, ok ? icon('check') : String(i + 1)),
          h('div', {}, h('b', {}, title), !ok || i < 2 ? h('p', {}, detail) : null),
          i >= 2 && !ok ? h('button', { class: 'btn ghost', type: 'button', onclick: () => navigate(i === 4 ? 'queue' : 'connections') }, i === 4 ? 'Kuyruğa git' : 'Bağlantılar') : null))));
  }

  const views = {
    overview({ status, summary, items }) {
      const c = summary.content;
      const total = Object.values(c).reduce((a, b) => a + b, 0);
      return [
        pageHead(new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('tr-TR'), 'Yayın akışın, kontrol altında.', 'Kaynaklarından gelen içerik burada toplanır. Yayımlama adımı bir sonraki fazda eklenecek.'),
        demoNote(),
        status?.error ? h('div', { class: 'note warn' }, icon('info'), h('span', {}, errorText(status.error))) : null,
        h('div', { class: 'statline' },
          h('span', {}, h('b', {}, String(c.received || 0)), 'yeni içerik'),
          h('span', {}, h('b', {}, String(c.skipped || 0)), 'korumalı, atlandı'),
          h('span', {}, h('b', {}, String(summary.chats.source || 0)), 'kaynak'),
          h('span', {}, h('b', {}, String(summary.chats.destination || 0)), 'hedef')),
        setupSteps(status, summary, total > 0),
        h('section', {},
          h('div', { class: 'sec-head' }, h('h2', {}, 'Son gelenler'), items.length ? h('button', { class: 'btn ghost', type: 'button', onclick: () => navigate('queue') }, 'Tüm kuyruk') : null),
          items.length ? h('div', { class: 'rows' }, items.map(itemRow))
            : h('div', { class: 'rows' }, h('div', { class: 'empty' }, h('b', {}, 'Henüz içerik yok'), h('p', {}, 'Kaynak kanal ekleyip orada yeni bir gönderi paylaştığında burada görünecek. Bot, eklendiği andan sonraki gönderileri alır.')))),
      ];
    },

    queue({ items, summary }) {
      const c = summary.content;
      const filters = [['all', 'Tümü', Object.values(c).reduce((a, b) => a + b, 0)], ['received', 'Yeni', c.received || 0], ['skipped', 'Atlanan', c.skipped || 0]];
      return [
        pageHead('YAYIN STÜDYOSU', 'İçerik kuyruğu', 'Kaynak kanallarından gelen gönderiler. Düzenleme, filigran ve onay Faz 2\'de burada olacak.'),
        demoNote(),
        h('div', { class: 'filters', role: 'group', 'aria-label': 'Duruma göre filtrele' }, filters.map(([id, label, n]) =>
          h('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.filter === id), onclick: () => { state.filter = id; refresh(false); } }, `${label} · ${n}`))),
        items.length ? h('div', { class: 'rows' }, items.map(itemRow))
          : h('div', { class: 'rows' }, h('div', { class: 'empty' }, h('b', {}, state.filter === 'skipped' ? 'Atlanan içerik yok' : 'Kuyruk boş'), h('p', {}, state.filter === 'skipped' ? 'Korumalı içerik gelirse burada, içeriği saklanmadan listelenir.' : 'Kaynak kanalda paylaşılan yeni gönderiler burada görünür.'))),
      ];
    },

    connections({ chats, discovered }) {
      const sources = chats.filter((c) => c.role === 'source');
      const destinations = chats.filter((c) => c.role === 'destination');
      const pending = discovered.filter((d) => !(d.registered_roles || '').split(',').includes('source') || !(d.registered_roles || '').split(',').includes('destination'));

      const chatRows = (list, role) => list.length
        ? h('div', { class: 'rows' }, list.map((c) => h('div', { class: 'row' },
          h('div', { class: `kind ${role === 'source' ? '' : 'photo'}` }, icon('connections')),
          h('div', {}, h('div', { class: 'row-title' }, c.title), h('div', { class: 'row-meta' }, c.username ? h('span', {}, `@${c.username}`) : h('span', { class: 'num' }, String(c.telegram_chat_id)), h('span', {}, c.chat_type === 'channel' ? 'Kanal' : 'Grup'), h('span', {}, `kontrol: ${relTime(c.last_checked_at)}`))),
          h('span', { class: 'pill ok' }, role === 'source' ? 'Kaynak' : 'Hedef'))))
        : h('div', { class: 'rows' }, h('div', { class: 'empty' }, h('b', {}, role === 'source' ? 'Kaynak yok' : 'Hedef yok'), h('p', {}, role === 'source' ? 'Aşağıdan ya da "Botun eklendiği sohbetler" listesinden ekle.' : 'Botu hedef kanala yönetici olarak ekleyip kaydet.')));

      return [
        pageHead('TELEGRAM', 'Bağlantılar', 'Kaynak: içeriğin geldiği kanal. Hedef: içeriğin yayımlanacağı, senin yönettiğin kanal.'),
        demoNote(),
        discoveredSection(pending),
        h('section', {}, h('div', { class: 'sec-head' }, h('h2', {}, 'Kaynaklar'), h('span', { class: 'xs muted' }, String(sources.length))), chatRows(sources, 'source')),
        h('section', {}, h('div', { class: 'sec-head' }, h('h2', {}, 'Hedefler'), h('span', { class: 'xs muted' }, String(destinations.length))), chatRows(destinations, 'destination')),
        h('section', {}, h('div', { class: 'sec-head' }, h('h2', {}, 'Elle ekle')), manualForm()),
      ];
    },

    campaigns() {
      return [
        pageHead('İZİNLİ ABONELER', 'Kampanyalar', null),
        h('div', { class: 'soon-box' },
          h('h2', {}, 'Faz 4\'te geliyor'),
          h('p', { class: 'muted' }, 'Kampanyalar yalnızca botuna kendisi abone olan ve pazarlama iznini veren kişilere gidecek.'),
          h('ul', {},
            h('li', {}, 'Metin, görsel ve butonlu mesaj; kişiselleştirme ve önizleme'),
            h('li', {}, 'Etiket ve segmentlerle hedefleme, zamanlama ve iptal'),
            h('li', {}, '/stop ile tek adımda çıkış; engelleyenler otomatik hariç'),
            h('li', {}, 'Gönderildi, başarısız, engellendi ve tıklama raporu'))),
      ];
    },

    settings({ status }) {
      const s = status && !status.error ? status : null;
      const row = (label, value) => [h('dt', {}, label), h('dd', {}, value)];
      return [
        pageHead('SİSTEM', 'Ayarlar', null),
        demoNote(),
        status?.error ? h('div', { class: 'note bad' }, icon('info'), h('span', {}, errorText(status.error))) : null,
        h('section', {}, h('div', { class: 'sec-head' }, h('h2', {}, 'Telegram')),
          h('dl', { class: 'kv' },
            row('Bot', s ? h('span', {}, `@${s.bot.username}`) : '—'),
            row('Grup mesajlarını okuma', s ? (s.bot.canReadAllGroupMessages ? 'Açık (gizlilik modu kapalı)' : 'Kapalı: gruplarda bot yönetici olmalı') : '—'),
            row('Webhook', s ? h('span', { class: `pill ${s.webhook.active ? 'ok' : 'warn'}` }, s.webhook.active ? 'Aktif' : 'Kayıtlı değil') : '—'),
            row('Bekleyen güncelleme', s ? h('span', { class: 'num' }, String(s.webhook.pendingUpdates)) : '—'),
            row('Son webhook hatası', s ? (s.webhook.lastError ? `${s.webhook.lastError} (${relTime(s.webhook.lastErrorAt)})` : 'Yok') : '—'))),
        h('section', {}, h('div', { class: 'sec-head' }, h('h2', {}, 'Oturum')),
          h('dl', { class: 'kv' }, row('Mod', state.mode === 'demo' ? 'Örnek veri' : 'Canlı'), row('Anahtar', 'Yalnızca bu tarayıcı sekmesinde tutulur'))),
        h('div', {}, h('button', { class: 'btn', type: 'button', onclick: () => logout() }, 'Çıkış yap')),
      ];
    },
  };

  function discoveredSection(pending) {
    return h('section', {},
      h('div', { class: 'sec-head' }, h('h2', {}, 'Botun eklendiği sohbetler'), h('span', { class: 'xs muted' }, 'Botu bir kanala ekleyince burada belirir')),
      pending.length
        ? h('div', { class: 'rows' }, pending.map((d) => {
          const roles = (d.registered_roles || '').split(',');
          const actions = h('div', { class: 'row-actions' });
          const holder = h('div', {});
          if (!roles.includes('source')) actions.append(h('button', { class: 'btn', type: 'button', onclick: () => confirmSource(holder, d.telegram_chat_id, d.title) }, 'Kaynak yap'));
          if (!roles.includes('destination')) actions.append(h('button', { class: 'btn', type: 'button', onclick: (e) => register({ chatId: d.telegram_chat_id, role: 'destination' }, holder, e.currentTarget) }, 'Hedef yap'));
          return h('div', {},
            h('div', { class: 'row' },
              h('div', { class: 'kind' }, icon('connections')),
              h('div', {}, h('div', { class: 'row-title' }, d.title), h('div', { class: 'row-meta' },
                d.username ? h('span', {}, `@${d.username}`) : h('span', { class: 'num' }, String(d.telegram_chat_id)),
                h('span', {}, d.chat_type === 'channel' ? 'Kanal' : 'Grup'),
                h('span', {}, d.bot_status === 'administrator' || d.bot_status === 'creator' ? 'Bot yönetici' : 'Bot üye'),
                d.can_post === 0 ? h('span', {}, 'gönderi izni yok') : null)),
              actions),
            holder);
        }))
        : h('div', { class: 'rows' }, h('div', { class: 'empty' }, h('b', {}, 'Bekleyen sohbet yok'), h('p', {}, 'Telegram\'da kanal ayarlarından botu yönetici olarak ekle. Birkaç saniye içinde burada görünür.'))));
  }

  function confirmSource(holder, chatId, title) {
    const box = h('div', { class: 'inline-confirm' });
    const checkbox = h('input', { type: 'checkbox', id: `rights-${chatId}` });
    const go = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: (e) => register({ chatId, role: 'source', rightsConfirmed: true }, holder, e.currentTarget) }, 'Kaynak olarak kaydet');
    checkbox.addEventListener('change', () => { go.disabled = !checkbox.checked; });
    box.append(h('label', { class: 'check', for: `rights-${chatId}` }, checkbox, h('span', {}, `"${title}" içeriğini yeniden yayımlama hakkım olduğunu onaylıyorum.`)), go,
      h('button', { class: 'btn ghost', type: 'button', onclick: () => holder.replaceChildren() }, 'Vazgeç'));
    holder.replaceChildren(box);
    checkbox.focus();
  }

  function manualForm() {
    const chatInput = h('input', { class: 'input', id: 'chat-id', placeholder: '@kanaladi veya -1001234567890', autocomplete: 'off', required: true });
    const roleSelect = h('select', { class: 'input', id: 'chat-role' }, h('option', { value: 'source' }, 'Kaynak'), h('option', { value: 'destination' }, 'Hedef'));
    const rights = h('input', { type: 'checkbox', id: 'manual-rights' });
    const rightsLabel = h('label', { class: 'check', for: 'manual-rights' }, rights, h('span', {}, 'Bu kaynaktaki içeriği yeniden yayımlama hakkım olduğunu onaylıyorum.'));
    const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Ekle');
    const result = h('div', { class: 'form-result' });
    roleSelect.addEventListener('change', () => { rightsLabel.hidden = roleSelect.value !== 'source'; });

    return h('form', {
      class: 'form',
      onsubmit: (event) => {
        event.preventDefault();
        const raw = chatInput.value.trim();
        const chatId = /^-?\d+$/.test(raw) ? Number(raw) : raw.startsWith('@') ? raw : `@${raw}`;
        const role = roleSelect.value;
        if (role === 'source' && !rights.checked) { result.replaceChildren(h('ul', { class: 'reasons' }, h('li', {}, ERRORS.rights_confirmation_required))); return; }
        register({ chatId, role, rightsConfirmed: role === 'source' ? true : undefined }, result, submit);
      },
    },
      h('div', { class: 'field' }, h('label', { for: 'chat-id' }, 'Kanal ya da grup'), chatInput),
      h('div', { class: 'field' }, h('label', { for: 'chat-role' }, 'Rol'), roleSelect),
      submit, rightsLabel, result);
  }

  async function register(body, holder, button) {
    if (state.mode === 'demo') { toast('Örnek veri modunda kayıt yapılmaz.'); return; }
    if (button) { button.disabled = true; }
    try {
      const res = await api('/api/chats', { method: 'POST', body });
      toast(`${res.chat.title} ${body.role === 'source' ? 'kaynak' : 'hedef'} olarak eklendi.`);
      refresh(false);
    } catch (error) {
      if (button) button.disabled = false;
      const reasons = error.body?.reasons;
      holder.replaceChildren(h('ul', { class: 'reasons', role: 'alert' },
        reasons?.length ? reasons.map((r) => h('li', {}, REASONS[r] || r)) : h('li', {}, errorText(error))));
    }
  }

  // ---------- demo data (no network) ----------
  function demoApi(path, options) {
    const now = Date.now();
    const iso = (min) => new Date(now - min * 60000).toISOString();
    const items = [
      { id: 3, media_type: 'video', text: 'Haftalık ilham: tasarımın küçük detayları', status: 'received', received_at: iso(2), source_title: 'Studio Notes', source_username: 'studio_notes', media_group_id: null },
      { id: 2, media_type: 'photo', text: 'Yeni koleksiyondan bir kare', status: 'received', received_at: iso(9), source_title: 'Studio Notes', source_username: 'studio_notes', media_group_id: 'a1' },
      { id: 1, media_type: 'text', text: null, status: 'skipped', received_at: iso(40), source_title: 'Kilitli Kanal', source_username: null, media_group_id: null },
    ];
    if (options.method === 'POST') return Promise.reject(new ApiError(400, { error: 'demo' }));
    const routes = {
      '/api/status': { ok: true, bot: { username: 'clonegram_bot', canReadAllGroupMessages: false }, webhook: { active: true, pendingUpdates: 0, lastError: null, lastErrorAt: null } },
      '/api/summary': { ok: true, content: { received: 2, skipped: 1 }, chats: { source: 1, destination: 1 } },
      '/api/chats': { ok: true, chats: [
        { telegram_chat_id: -1001, role: 'source', title: 'Studio Notes', username: 'studio_notes', chat_type: 'channel', last_checked_at: iso(60) },
        { telegram_chat_id: -1002, role: 'destination', title: 'CloneGRAM Yayın', username: 'clonegram_yayin', chat_type: 'channel', last_checked_at: iso(58) }] },
      '/api/discovered': { ok: true, chats: [{ telegram_chat_id: -1003, title: 'Creative Lab', chat_type: 'supergroup', username: null, bot_status: 'administrator', can_post: null, registered_roles: null }] },
    };
    const [base, query] = path.split('?');
    if (base === '/api/content') {
      const status = new URLSearchParams(query).get('status');
      const limit = Number(new URLSearchParams(query).get('limit')) || 100;
      return Promise.resolve({ ok: true, items: items.filter((i) => !status || i.status === status).slice(0, limit) });
    }
    return Promise.resolve(routes[base]);
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.mode === 'live' && ['overview', 'queue'].includes(state.page)) refresh(false, true); });
  boot();
})();

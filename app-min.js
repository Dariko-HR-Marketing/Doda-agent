/* DODA: sodda chat interfeysi (tizimga kirgan foydalanuvchi uchun). Ovoz: jonli subtitr, matn bo'yicha javob. */
(() => {
  'use strict';

  const D = () => window.DODA || {};
  const me = () => (D().getUser ? D().getUser() : null);
  const lang = () => (D().getLang ? D().getLang() : 'uz');

  const T = {
    uz: {
      placeholder: 'DODAga yozing yoki gapiring…', send: 'Yuborish', stop: 'To‘xtatish', mic: 'Ovozli kiritish', micStop: 'Tinglashni to‘xtatish',
      menu: 'Menyu', close: 'Yopish', newChat: 'Yangi suhbat', files: 'Fayllar va xotira', account: 'Akkaunt', chats: 'Suhbatlar', noChats: 'Hali suhbat yo‘q',
      hello: 'Salom', ask: 'Nima haqida gaplashamiz?', hint: 'Yozing yoki 🎙 bosib gapiring.', note: 'DODA xato qilishi mumkin. Matn Google Gemini xizmatiga yuboriladi: maxfiy ma’lumot yozmang.',
      listening: 'Eshityapman… gapiring', sending: 'Yuborilmoqda…', cancel: 'Bekor qilish', you: 'Siz',
      netErr: 'Aloqa xatosi. Qayta urinib ko‘ring.', remembered: 'Eslab qoldim: ', limit: 'Oylik limit',
      consentTitle: 'Ovozli kiritish',
      consentText: 'Brauzeringiz ovozingizni matnga aylantirish uchun Google xizmatiga yuboradi. Bunga roziligingiz kerak (keyin akkauntda o‘chira olasiz).',
      agree: 'Roziman', decline: 'Hozir emas',
      e_not_allowed: 'Mikrofonga ruxsat bering (manzil satridagi qulf belgisi orqali).', e_no_speech: 'Ovoz eshitilmadi. Qayta urinib ko‘ring.',
      e_lang: 'Bu til brauzerda ovoz uchun qo‘llab-quvvatlanmaydi.', e_network: 'Ovozni matnga o‘girish xizmatiga ulanib bo‘lmadi.', e_other: 'Ovozli kiritishda xatolik.',
    },
    ru: {
      placeholder: 'Напишите DODA или скажите…', send: 'Отправить', stop: 'Остановить', mic: 'Голосовой ввод', micStop: 'Остановить запись',
      menu: 'Меню', close: 'Закрыть', newChat: 'Новый диалог', files: 'Файлы и память', account: 'Аккаунт', chats: 'Диалоги', noChats: 'Пока нет диалогов',
      hello: 'Здравствуйте', ask: 'О чём поговорим?', hint: 'Пишите или нажмите 🎙 и говорите.', note: 'DODA может ошибаться. Текст отправляется в Google Gemini: не пишите конфиденциальное.',
      listening: 'Слушаю… говорите', sending: 'Отправка…', cancel: 'Отмена', you: 'Вы',
      netErr: 'Ошибка связи. Повторите попытку.', remembered: 'Запомнил: ', limit: 'Месячный лимит',
      consentTitle: 'Голосовой ввод',
      consentText: 'Браузер отправляет вашу речь в сервис Google для преобразования в текст. Для этого нужно ваше согласие (позже можно отключить в аккаунте).',
      agree: 'Согласен', decline: 'Не сейчас',
      e_not_allowed: 'Разрешите доступ к микрофону (значок замка в адресной строке).', e_no_speech: 'Речь не распознана. Повторите.',
      e_lang: 'Этот язык не поддерживается браузером для голоса.', e_network: 'Не удалось подключиться к сервису распознавания речи.', e_other: 'Ошибка голосового ввода.',
    },
  };
  const tr = (k) => T[lang()][k] ?? k;

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }

  const svg = (d, size = 20) => {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    for (const part of d) { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', part); s.append(p); }
    return s;
  };
  const ICONS = {
    mic: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M19 11a7 7 0 0 1-14 0', 'M12 18v3'],
    up: ['M12 19V5', 'M5 12l7-7 7 7'],
    stop: ['M7 7h10v10H7z'],
    menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
    x: ['M6 6l12 12', 'M18 6L6 18'],
  };

  async function api(path, { method = 'GET', body } = {}) {
    try {
      const res = await fetch(D().API + path, {
        method, credentials: 'include',
        headers: { 'Accept-Language': lang(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, data: await res.json().catch(() => ({})) };
    } catch { return { status: 0, data: {} }; }
  }

  /* ---------- kichik xavfsiz markdown: abzas, ro'yxat, **qalin**, `kod` ---------- */
  function inline(el, text) {
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) el.append(document.createTextNode(text.slice(last, m.index)));
      const tok = m[0];
      el.append(tok.startsWith('**') ? h('strong', {}, tok.slice(2, -2)) : h('code', {}, tok.slice(1, -1)));
      last = m.index + tok.length;
    }
    if (last < text.length) el.append(document.createTextNode(text.slice(last)));
  }
  function renderMd(container, text) {
    const frag = document.createDocumentFragment();
    let list = null;
    let para = [];
    const flushPara = () => { if (para.length) { const p = h('p'); para.forEach((ln, i) => { if (i) p.append(document.createElement('br')); inline(p, ln); }); frag.append(p); para = []; } };
    for (const line of text.split('\n')) {
      const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
      const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (ul || ol) {
        flushPara();
        const tag = ul ? 'ul' : 'ol';
        if (!list || list.tagName.toLowerCase() !== tag) { list = h(tag); frag.append(list); }
        const li = h('li'); inline(li, (ul || ol)[1]); list.append(li);
      } else if (!line.trim()) { flushPara(); list = null; }
      else { list = null; para.push(line); }
    }
    flushPara();
    container.replaceChildren(frag);
  }

  /* ---------- holat ---------- */
  let root = null;
  let ui = {};
  let convId = null;
  let busy = false;
  let abortCtl = null;
  let stick = true;
  let voiceAllowed = null; // rozilik holati
  let rec = null;
  let listening = false;
  let autoTimer = null;
  let micError = false;

  const storeKey = () => { const u = me(); return u ? 'doda_conv_' + u.id : null; };
  const saveConv = () => { try { const k = storeKey(); if (k && convId) localStorage.setItem(k, convId); } catch { /* ixtiyoriy */ } };
  const forgetConv = () => { try { const k = storeKey(); if (k) localStorage.removeItem(k); } catch { /* ixtiyoriy */ } convId = null; };

  function firstName() {
    const u = me();
    const n = ((u && u.email) || '').split('@')[0].replace(/[._-]+/g, ' ').trim().split(' ')[0] || '';
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
  }

  /* ---------- tuzilma ---------- */
  function mount() {
    if (root) unmount();
    document.body.classList.add('min-on');

    ui.stream = h('main', { class: 'min-stream', id: 'min-stream', 'aria-live': 'polite' });
    ui.col = h('div', { class: 'min-col' });
    ui.stream.append(ui.col);
    ui.stream.addEventListener('scroll', () => { stick = ui.stream.scrollHeight - ui.stream.scrollTop - ui.stream.clientHeight < 80; });

    ui.langBtn = h('button', { type: 'button', class: 'min-icon min-lang', onclick: () => D().setLang && D().setLang(lang() === 'uz' ? 'ru' : 'uz') });
    ui.menuBtn = h('button', { type: 'button', class: 'min-icon', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: openSheet }, svg(ICONS.menu));
    ui.brand = h('button', { type: 'button', class: 'min-brand', onclick: newChat }, h('span', { class: 'min-mark', 'aria-hidden': 'true' }, 'D'), h('span', {}, 'DODA'));

    ui.input = h('textarea', { id: 'min-input', class: 'min-input', rows: '1', maxlength: '4000', autocomplete: 'off' });
    ui.micBtn = h('button', { type: 'button', class: 'min-circle min-mic', 'aria-pressed': 'false', onclick: toggleVoice }, svg(ICONS.mic));
    ui.sendBtn = h('button', { type: 'submit', class: 'min-circle min-send', disabled: true }, svg(ICONS.up));
    ui.live = h('div', { class: 'min-live', role: 'status', 'aria-live': 'polite' });
    ui.consent = h('div', { class: 'min-consent', hidden: true });
    ui.form = h('form', { class: 'min-form', onsubmit: onSubmit }, ui.consent, h('div', { class: 'min-pill' }, ui.input, ui.micBtn, ui.sendBtn), ui.live);
    ui.note = h('p', { class: 'min-note' });

    ui.input.addEventListener('input', () => { autoGrow(); cancelAuto(); updateSend(); });
    ui.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ui.form.requestSubmit(); }
    });

    root = h('div', { id: 'min', class: 'min' },
      h('header', { class: 'min-top' }, ui.brand, h('div', { class: 'min-top-r' }, ui.langBtn, ui.menuBtn)),
      ui.stream,
      h('footer', { class: 'min-foot' }, ui.form, ui.note));
    document.body.append(root);

    // Brauzer ovozli kiritishni qo'llamasa, mikrofon tugmasi ko'rsatilmaydi (kam element)
    if (!speechCtor()) ui.micBtn.hidden = true;

    relabel();
    showEmpty();
    loadHistory();
    api('/api/auth/me').then((r) => { voiceAllowed = !!(r.data.consents && r.data.consents.voice && r.data.consents.voice.accepted); });
    ui.input.focus({ preventScroll: true });
  }

  function unmount() {
    stopVoice(true);
    cancelAuto();
    if (abortCtl) abortCtl.abort();
    closeSheet();
    closeFiles();
    if (root) root.remove();
    root = null; ui = {}; busy = false; convId = null;
    document.body.classList.remove('min-on');
  }

  function relabel() {
    if (!root) return;
    ui.input.placeholder = tr('placeholder');
    ui.input.setAttribute('aria-label', tr('placeholder'));
    ui.micBtn.setAttribute('aria-label', listening ? tr('micStop') : tr('mic'));
    ui.micBtn.title = tr('mic');
    ui.sendBtn.setAttribute('aria-label', busy ? tr('stop') : tr('send'));
    ui.menuBtn.setAttribute('aria-label', tr('menu'));
    ui.langBtn.textContent = lang().toUpperCase();
    ui.langBtn.setAttribute('aria-label', lang() === 'uz' ? 'Til: o‘zbekcha. Русский tilga o‘tish' : 'Язык: русский. Переключить на o‘zbekcha');
    ui.brand.setAttribute('aria-label', tr('newChat'));
    ui.note.textContent = tr('note');
    const empty = ui.col.querySelector('.min-empty');
    if (empty) { empty.querySelector('h1').textContent = greeting(); empty.querySelector('p').textContent = tr('ask'); empty.querySelector('small').textContent = tr('hint'); }
  }
  document.addEventListener('doda:lang', () => { if (root) { relabel(); renderConsent(); } });

  const greeting = () => (firstName() ? `${tr('hello')}, ${firstName()}` : tr('hello'));

  function showEmpty() {
    ui.col.replaceChildren(h('div', { class: 'min-empty' }, h('h1', {}, greeting()), h('p', {}, tr('ask')), h('small', {}, tr('hint'))));
  }

  /* ---------- xabarlar ---------- */
  function clearEmpty() { const e = ui.col.querySelector('.min-empty'); if (e) e.remove(); }
  function scrollDown(force) { if (force || stick) ui.stream.scrollTop = ui.stream.scrollHeight; }

  function addUser(text) {
    clearEmpty();
    const el = h('div', { class: 'min-msg user' }, h('div', { class: 'min-bubble' }, text));
    ui.col.append(el); stick = true; scrollDown(true);
  }
  function addDoda(text = '') {
    clearEmpty();
    const body = h('div', { class: 'min-text' });
    const meta = h('div', { class: 'min-meta' });
    const el = h('div', { class: 'min-msg doda' }, body, meta);
    if (text) renderMd(body, text);
    ui.col.append(el); scrollDown();
    return { el, body, meta };
  }

  async function loadHistory() {
    let id = null;
    try { const k = storeKey(); id = k ? localStorage.getItem(k) : null; } catch { /* ixtiyoriy */ }
    if (!id) return;
    const r = await api('/api/conversations/' + encodeURIComponent(id));
    if (!root) return;
    if (r.status !== 200 || !r.data.messages || !r.data.messages.length) { forgetConv(); return; }
    convId = id;
    ui.col.replaceChildren();
    for (const m of r.data.messages) (m.role === 'user' ? addUser(m.content) : addDoda(m.content));
    scrollDown(true);
  }

  function newChat() {
    if (busy) return;
    stopVoice(true); cancelAuto();
    forgetConv(); showEmpty(); ui.input.value = ''; autoGrow(); updateSend(); setLive('');
    closeSheet();
    ui.input.focus({ preventScroll: true });
  }

  /* ---------- yuborish ---------- */
  function autoGrow() { ui.input.style.height = 'auto'; ui.input.style.height = Math.min(ui.input.scrollHeight, 160) + 'px'; }
  function updateSend() {
    const has = ui.input.value.trim().length > 0;
    ui.sendBtn.disabled = !busy && !has;
    ui.sendBtn.classList.toggle('on', has || busy);
  }
  function setBusy(b) {
    busy = b;
    ui.sendBtn.replaceChildren(svg(b ? ICONS.stop : ICONS.up));
    ui.sendBtn.setAttribute('aria-label', b ? tr('stop') : tr('send'));
    ui.sendBtn.classList.toggle('stop', b);
    ui.micBtn.disabled = b;
    updateSend();
  }

  function onSubmit(e) {
    e.preventDefault();
    if (busy) { if (abortCtl) abortCtl.abort(); return; }
    cancelAuto(); stopVoice(true);
    const v = ui.input.value.trim();
    if (!v) return;
    ui.input.value = ''; autoGrow();
    send(v);
  }

  async function readSse(res, cb) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const ev = /^event: (.+)$/m.exec(block);
        const dt = /^data: (.+)$/m.exec(block);
        if (!dt) continue;
        let data; try { data = JSON.parse(dt[1]); } catch { continue; }
        cb(ev ? ev[1] : 'message', data);
      }
    }
  }

  const LABEL = { 'gemini-3.5-flash-lite': 'Flash-Lite', 'gemini-3.8-flash': 'Gemini 3.8 Flash' };

  async function send(text) {
    addUser(text);
    const reply = addDoda();
    reply.el.classList.add('typing');
    setBusy(true);
    abortCtl = new AbortController();
    let full = '';
    let model = '';
    let raf = 0;
    const paint = () => { raf = 0; renderMd(reply.body, full); scrollDown(); };
    try {
      const res = await fetch(D().API + '/api/chat', {
        method: 'POST', credentials: 'include', signal: abortCtl.signal,
        headers: { 'Content-Type': 'application/json', 'Accept-Language': lang() },
        body: JSON.stringify({ message: text, ...(convId ? { conversationId: convId } : {}) }),
      });
      if (!res.ok || !(res.headers.get('content-type') || '').includes('text/event-stream')) {
        const j = await res.json().catch(() => ({}));
        reply.el.classList.remove('typing'); reply.el.classList.add('error');
        reply.body.textContent = (j && j.error && j.error.message) || tr('netErr');
      } else {
        await readSse(res, (event, data) => {
          if (event === 'meta') { convId = data.conversationId; model = data.model; saveConv(); }
          else if (event === 'delta') { reply.el.classList.remove('typing'); full += data.text; if (!raf) raf = requestAnimationFrame(paint); }
          else if (event === 'error') {
            reply.el.classList.remove('typing');
            if (!full) { reply.el.classList.add('error'); reply.body.textContent = data.message || tr('netErr'); }
            else reply.meta.textContent = data.message || tr('netErr');
          } else if (event === 'done') {
            const frac = data.budgetUsd ? data.monthUsd / data.budgetUsd : 0;
            reply.meta.textContent = `${LABEL[model] || model} · $${data.costUsd.toFixed(4)}` + (frac >= 0.8 ? ` · ${tr('limit')}: $${data.monthUsd.toFixed(2)} / $${data.budgetUsd}` : '');
            setBusy(false); // xotirani ajratish davom etishi mumkin: kutdirmaymiz
          } else if (event === 'memory') {
            const n = h('div', { class: 'min-mem' }, tr('remembered') + data.facts.join('; '));
            reply.el.append(n); scrollDown();
            document.dispatchEvent(new CustomEvent('doda:memory'));
          }
        });
      }
    } catch (e) {
      reply.el.classList.remove('typing');
      if (!(e && e.name === 'AbortError')) { if (!full) { reply.el.classList.add('error'); reply.body.textContent = tr('netErr'); } }
    }
    if (raf) cancelAnimationFrame(raf);
    if (full) renderMd(reply.body, full);
    reply.el.classList.remove('typing');
    abortCtl = null;
    setBusy(false);
    scrollDown();
    if (root) ui.input.focus({ preventScroll: true });
  }

  /* ---------- ovoz: jonli subtitr ---------- */
  function speechCtor() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }

  function setLive(text, cancelable) {
    if (!ui.live) return;
    ui.live.replaceChildren();
    if (text) ui.live.append(document.createTextNode(text));
    if (cancelable) ui.live.append(h('button', { type: 'button', class: 'min-link', onclick: () => { cancelAuto(); } }, tr('cancel')));
    ui.live.classList.toggle('on', !!text);
  }

  function cancelAuto() { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; setLive(''); } }

  function scheduleAuto() {
    cancelAuto();
    setLive(tr('sending'), true);
    autoTimer = setTimeout(() => {
      autoTimer = null; setLive('');
      const v = ui.input.value.trim();
      if (v && !busy) { ui.input.value = ''; autoGrow(); updateSend(); send(v); }
    }, 1800);
  }

  function renderConsent() {
    if (!ui.consent) return;
    if (ui.consent.hidden) return;
    ui.consent.replaceChildren(
      h('b', {}, tr('consentTitle')), h('p', {}, tr('consentText')),
      h('div', { class: 'min-consent-actions' },
        h('button', { type: 'button', class: 'min-btn primary', onclick: grantVoice }, tr('agree')),
        h('button', { type: 'button', class: 'min-btn', onclick: () => { ui.consent.hidden = true; } }, tr('decline'))));
  }

  async function grantVoice() {
    const r = await api('/api/account/consents', { method: 'POST', body: { type: 'voice', accepted: true } });
    if (r.status === 200) { voiceAllowed = true; ui.consent.hidden = true; startVoice(); }
  }

  function toggleVoice() {
    if (listening) { stopVoice(false); return; }
    cancelAuto();
    if (voiceAllowed === false) { ui.consent.hidden = false; renderConsent(); return; }
    startVoice();
  }

  function voiceMsg(code) {
    return { 'not-allowed': 'e_not_allowed', 'service-not-allowed': 'e_not_allowed', 'no-speech': 'e_no_speech', 'language-not-supported': 'e_lang', network: 'e_network' }[code] || 'e_other';
  }

  function startVoice() {
    const SR = speechCtor();
    if (!SR || listening) return;
    micError = false;
    const base = ui.input.value.trim();
    let finalText = '';
    rec = new SR();
    rec.lang = lang() === 'ru' ? 'ru-RU' : 'uz-UZ';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => { listening = true; ui.micBtn.classList.add('live'); ui.micBtn.setAttribute('aria-pressed', 'true'); ui.micBtn.setAttribute('aria-label', tr('micStop')); setLive(tr('listening')); };
    rec.onresult = (e) => {
      let interim = ''; let fin = '';
      for (let i = 0; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript; }
      finalText = fin;
      ui.input.value = [base, (fin + interim).trim()].filter(Boolean).join(' ');
      ui.input.classList.toggle('interim', !!interim);
      autoGrow(); updateSend();
    };
    rec.onerror = (e) => { micError = true; const code = e && e.error; if (code !== 'aborted') setLive(tr(voiceMsg(code))); };
    rec.onend = () => {
      listening = false; rec = null;
      if (!root) return;
      ui.micBtn.classList.remove('live'); ui.micBtn.setAttribute('aria-pressed', 'false'); ui.micBtn.setAttribute('aria-label', tr('mic'));
      ui.input.classList.remove('interim');
      const v = ui.input.value.trim();
      if (!micError && v && finalText.trim()) scheduleAuto();
      else if (!micError) setLive('');
    };
    try { rec.start(); } catch { micError = true; setLive(tr('e_other')); }
  }

  function stopVoice(silent) {
    if (rec) { try { silent ? rec.abort() : rec.stop(); } catch { /* ixtiyoriy */ } }
    if (silent) { listening = false; if (ui.micBtn) ui.micBtn.classList.remove('live'); }
  }

  /* ---------- menyu va fayllar ---------- */
  let sheet = null;
  let files = null;

  async function openSheet() {
    if (sheet) return;
    const list = h('ul', { class: 'min-chats' });
    const item = (label, fn, cls = '') => h('button', { type: 'button', class: 'min-row ' + cls, onclick: fn }, label);
    sheet = h('div', { class: 'min-sheet-wrap', onclick: (e) => { if (e.target === sheet) closeSheet(); } },
      h('aside', { class: 'min-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': tr('menu') },
        h('div', { class: 'min-sheet-head' }, h('b', {}, tr('menu')), h('button', { type: 'button', class: 'min-icon', 'aria-label': tr('close'), onclick: closeSheet }, svg(ICONS.x))),
        item('＋  ' + tr('newChat'), newChat, 'strong'),
        item(tr('files'), () => { closeSheet(); openFiles(); }),
        item(tr('account'), () => { closeSheet(); if (D().openAccount) D().openAccount(); }),
        h('div', { class: 'min-sep' }, tr('chats')),
        list));
    document.body.append(sheet);
    ui.menuBtn.setAttribute('aria-expanded', 'true');
    sheet.querySelector('.min-row').focus();
    const r = await api('/api/conversations');
    if (!sheet) return;
    const rows = (r.data.conversations || []).slice(0, 12);
    if (!rows.length) list.append(h('li', { class: 'min-none' }, tr('noChats')));
    for (const c of rows) {
      list.append(h('li', {}, h('button', { type: 'button', class: 'min-row chat' + (c.id === convId ? ' on' : ''), onclick: () => openChat(c.id) }, c.title)));
    }
  }
  function closeSheet() {
    if (sheet) sheet.remove();
    sheet = null;
    if (ui.menuBtn) ui.menuBtn.setAttribute('aria-expanded', 'false');
  }

  async function openChat(id) {
    if (busy) return;
    const r = await api('/api/conversations/' + encodeURIComponent(id));
    if (r.status !== 200) return;
    convId = id; saveConv();
    ui.col.replaceChildren();
    for (const m of r.data.messages) (m.role === 'user' ? addUser(m.content) : addDoda(m.content));
    closeSheet(); scrollDown(true);
  }

  function openFiles() {
    if (files || !window.DODA_WS) return;
    const body = h('div', { class: 'min-files-body' });
    files = h('div', { class: 'min-files', role: 'dialog', 'aria-modal': 'true', 'aria-label': tr('files') },
      h('div', { class: 'min-files-head' }, h('b', {}, tr('files')), h('button', { type: 'button', class: 'min-icon', 'aria-label': tr('close'), onclick: closeFiles }, svg(ICONS.x))),
      body);
    document.body.append(files);
    window.DODA_WS.mount(body);
  }
  function closeFiles() {
    if (!files) return;
    if (window.DODA_WS) { if (window.DODA_WS.isDirty && window.DODA_WS.isDirty() && !window.confirm(lang() === 'ru' ? 'Несохранённые изменения будут потеряны. Закрыть?' : 'Saqlanmagan o‘zgarishlar yo‘qoladi. Yopamizmi?')) return; window.DODA_WS.unmount(); }
    files.remove(); files = null;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (files) closeFiles();
    else if (sheet) closeSheet();
    else if (autoTimer) cancelAuto();
    else if (listening) stopVoice(true);
  });

  document.addEventListener('doda:login', mount);
  document.addEventListener('doda:logout', unmount);
  if (me()) mount();
})();

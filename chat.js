/* DODA: haqiqiy suhbat (server orqali Gemini). Kirmagan/namuna rejimida eski namuna ishlayveradi. */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  let convId = null;
  let busy = false;

  const D = () => window.DODA || {};
  const me = () => (D().getUser ? D().getUser() : null);
  const lang = () => (D().getLang ? D().getLang() : 'uz');

  const T = {
    uz: {
      you: 'SIZ', typing: 'Yozmoqda…', fresh: '＋ Yangi suhbat', netErr: 'Aloqa xatosi. Qayta urinib ko‘ring.',
      hint: 'Suhbat serverda saqlanadi. Yozgan matningiz Google Gemini xizmatiga yuboriladi (chet elda qayta ishlanadi), maxfiy ma’lumot yozmang.',
      month: 'oy', remembered: 'Eslab qoldim: ', rememberedHint: ' (Bilim markazida ko‘rish va tahrirlash mumkin)', greeting: 'Eshitaman. Savol bering yoki fikr almashamiz. Agentlar va topshiriqlar keyingi bosqichda ulanadi.',
    },
    ru: {
      you: 'ВЫ', typing: 'Печатает…', fresh: '＋ Новый диалог', netErr: 'Ошибка связи. Повторите попытку.',
      hint: 'Диалог хранится на сервере. Ваш текст отправляется в сервис Google Gemini (обрабатывается за границей), не пишите конфиденциальные данные.',
      month: 'мес.', remembered: 'Запомнил: ', rememberedHint: ' (можно посмотреть и изменить в «Центре знаний»)', greeting: 'Слушаю. Задайте вопрос или обсудим идею. Агенты и задачи подключим на следующем этапе.',
    },
  };
  const tr = (k) => T[lang()][k] ?? k;

  function stream() { return $('#chat-stream'); }
  function scroll() { const s = stream(); if (s) s.scrollTop = s.scrollHeight; }

  function initials() {
    const u = me();
    const n = ((u && u.email) || '?').split('@')[0].replace(/[^a-zA-Z0-9А-Яа-я]/g, '');
    return (n.slice(0, 2) || '?').toUpperCase();
  }

  function bubble(who, text) {
    const isDoda = who === 'DODA';
    const el = document.createElement('div');
    el.className = 'chat-message ' + (isDoda ? 'doda' : 'user');
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = isDoda ? 'D' : initials();
    const body = document.createElement('div');
    body.className = 'message-body';
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const b = document.createElement('b');
    b.textContent = isDoda ? 'DODA' : tr('you');
    const time = document.createElement('span');
    time.textContent = new Date().toLocaleTimeString(lang() === 'ru' ? 'ru-RU' : 'uz-UZ', { hour: '2-digit', minute: '2-digit' });
    meta.append(b, time);
    const p = document.createElement('p');
    p.className = 'chat-text';
    p.textContent = text;
    body.append(meta, p);
    el.append(avatar, body);
    stream().append(el);
    scroll();
    return { el, p, body };
  }

  function note(body, text, cls = 'chat-foot') {
    const f = document.createElement('small');
    f.className = cls;
    f.textContent = text;
    body.append(f);
    scroll();
  }

  function resetStream() {
    const s = stream();
    if (!s) return;
    s.replaceChildren();
    bubble('DODA', tr('greeting'));
  }

  function storeKey() { const u = me(); return u ? 'doda_conv_' + u.id : null; }
  function saveConv() { try { const k = storeKey(); if (k && convId) localStorage.setItem(k, convId); } catch { /* ixtiyoriy */ } }
  function forgetConv() { try { const k = storeKey(); if (k) localStorage.removeItem(k); } catch { /* ixtiyoriy */ } convId = null; }

  async function loadHistory() {
    let id = null;
    try { const k = storeKey(); id = k ? localStorage.getItem(k) : null; } catch { /* ixtiyoriy */ }
    if (!id) { resetStream(); return; }
    try {
      const res = await fetch(D().API + '/api/conversations/' + encodeURIComponent(id), { credentials: 'include', headers: { 'Accept-Language': lang() } });
      if (!res.ok) { forgetConv(); resetStream(); return; }
      const data = await res.json();
      convId = id;
      stream().replaceChildren();
      for (const m of data.messages) bubble(m.role === 'assistant' ? 'DODA' : 'KAPITAN', m.content);
      if (!data.messages.length) resetStream();
    } catch { resetStream(); }
  }

  /** SSE oqimini o'qiydi: har bir "event/data" blok uchun cb(event, data) */
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
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = /^event: (.+)$/m.exec(block);
        const dt = /^data: (.+)$/m.exec(block);
        if (!dt) continue;
        let data = null;
        try { data = JSON.parse(dt[1]); } catch { continue; }
        cb(ev ? ev[1] : 'message', data);
      }
    }
  }

  function setBusy(b) {
    busy = b;
    const btn = $('#chat-form .send-button');
    if (btn) btn.disabled = b;
    const st = $('#doda-state');
    if (st) st.textContent = b ? tr('typing') : (lang() === 'ru' ? 'DODA готова к диалогу' : 'DODA suhbatga tayyor');
  }

  const MODEL_LABEL = { 'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite', 'gemini-3.8-flash': 'Gemini 3.8 Flash' };

  async function send(text) {
    text = text.trim();
    if (!text || busy) return;
    bubble('KAPITAN', text);
    const reply = bubble('DODA', '…');
    reply.el.classList.add('typing');
    setBusy(true);
    let got = false;
    let model = '';
    try {
      const res = await fetch(D().API + '/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept-Language': lang() },
        body: JSON.stringify({ message: text, ...(convId ? { conversationId: convId } : {}) }),
      });
      if (!res.ok || !(res.headers.get('content-type') || '').includes('text/event-stream')) {
        const j = await res.json().catch(() => ({}));
        reply.el.classList.remove('typing');
        reply.el.classList.add('error');
        reply.p.textContent = (j && j.error && j.error.message) || tr('netErr');
        setBusy(false);
        return;
      }
      await readSse(res, (event, data) => {
        if (event === 'meta') { convId = data.conversationId; saveConv(); model = data.model; }
        else if (event === 'delta') {
          if (!got) { reply.p.textContent = ''; reply.el.classList.remove('typing'); got = true; }
          reply.p.textContent += data.text;
          scroll();
        } else if (event === 'error') {
          reply.el.classList.remove('typing');
          if (!got) { reply.el.classList.add('error'); reply.p.textContent = data.message || tr('netErr'); }
          else note(reply.body, data.message || tr('netErr'), 'chat-foot err');
        } else if (event === 'done') {
          const label = MODEL_LABEL[model] || model;
          note(reply.body, `${label} · ${data.tokensIn + data.tokensOut} token · $${data.costUsd.toFixed(4)} · ${tr('month')}: $${data.monthUsd.toFixed(2)} / $${data.budgetUsd}`);
          setBusy(false); // xotirani ajratish keyin davom etishi mumkin: yozishni kutdirmaymiz
        } else if (event === 'memory') {
          note(reply.body, tr('remembered') + data.facts.join('; ') + tr('rememberedHint'), 'chat-foot mem');
          document.dispatchEvent(new CustomEvent('doda:memory'));
        }
      });
      if (!got) { reply.el.classList.remove('typing'); }
    } catch {
      reply.el.classList.remove('typing');
      reply.el.classList.add('error');
      reply.p.textContent = tr('netErr');
    }
    setBusy(false);
  }

  /** Sahifa matnlarini haqiqiy holatga moslash */
  function relabel() {
    const hint = $('.prototype-hint');
    if (hint) hint.textContent = tr('hint');
    const env = $('.environment');
    if (env && env.lastChild && env.lastChild.nodeType === 3) env.lastChild.textContent = ' MVP SINOV';
    const note1 = $('.mode-note');
    if (note1) {
      const b = note1.querySelector('b');
      const sm = note1.querySelector('small');
      if (b) b.textContent = lang() === 'ru' ? 'Диалог: Gemini' : 'Suhbat: Gemini';
      if (sm) sm.textContent = lang() === 'ru' ? 'Агенты и задачи: демо' : 'Agentlar va topshiriqlar: namuna';
    }
    const head = document.querySelector('.conversation .section-head');
    if (head && !head.querySelector('.chat-new')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-new';
      btn.addEventListener('click', () => { if (busy) return; forgetConv(); resetStream(); });
      head.append(btn);
    }
    const nb = document.querySelector('.chat-new');
    if (nb) nb.textContent = tr('fresh');
  }

  /* app.js dagi namuna ishlovchilarini faqat tizimga kirgan foydalanuvchi uchun chetlab o'tamiz */
  const form = $('#chat-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      if (!me()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const ta = $('#chat-input');
      const v = ta.value;
      ta.value = '';
      send(v);
    }, true);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-example]');
    if (!b || !me()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    send(b.dataset.example);
  }, true);
  const ta = $('#chat-input');
  if (ta) {
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && me()) { e.preventDefault(); form.requestSubmit(); }
    });
  }

  document.addEventListener('doda:login', () => { relabel(); loadHistory(); });
  document.addEventListener('doda:logout', () => { convId = null; busy = false; resetStream(); });
  if (me()) { relabel(); loadHistory(); }
})();

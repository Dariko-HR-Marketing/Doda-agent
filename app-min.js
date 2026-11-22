/* DODA: chat interfeysi (yon panel, katta yozish kartochkasi, ovozli kiritish, fayl biriktirish). Tizimga kirgan foydalanuvchi uchun. */
(() => {
  'use strict';

  const D = () => window.DODA || {};
  const me = () => (D().getUser ? D().getUser() : null);
  const lang = () => (D().getLang ? D().getLang() : 'uz');

  const T = {
    uz: {
      placeholder: 'DODAga yozing yoki gapiring…', send: 'Yuborish', stop: 'To‘xtatish', mic: 'Ovozli kiritish', micStop: 'Tinglashni to‘xtatish',
      closeT: 'Yopish', sugFor: 'Bu ish uchun mos agent:', sugGo: 'Agentga o‘tish', todayT: 'Bugun', tasksT: 'Vazifalar', agentsT: 'Agentlar', keysT: 'AI kalitlari', keyBannerT: 'Boshlash uchun o‘z AI kalitingizni ulang', keyBannerP: 'DODA sizning shaxsiy Anthropic (Claude), Google Gemini yoki OpenAI hisobingiz bilan ishlaydi: xarajat to‘g‘ridan-to‘g‘ri sizning hisobingizdan yechiladi.', keyBannerB: 'Kalit ulash', newChat: 'Yangi suhbat', search: 'Qidiruv', searchPh: 'Suhbatlardan qidirish…', files: 'Fayllar va xotira', chats: 'Suhbatlar', noChats: 'Hali suhbat yo‘q', noMatch: 'Hech narsa topilmadi',
      today: 'Bugun', yesterday: 'Kecha', week: 'Oxirgi 7 kun', older: 'Oldinroq', rename: 'Nomini o‘zgartirish', del: 'O‘chirish', delSure: 'Aniq o‘chiraman', more: 'Amallar',
      account: 'Akkaunt', language: 'Til', logout: 'Chiqish', sbOpen: 'Panelni ochish', sbClose: 'Panelni yopish',
      morning: 'Xayrli tong', day: 'Xayrli kun', evening: 'Xayrli kech', night: 'Xayrli tun', ask: 'Nima haqida gaplashamiz?',
      listening: 'Eshityapman… gapiring', recBusy: 'Matnga aylantirilmoqda…', recDiscard: 'Yozuvni bekor qilish', recStop: 'To‘xtatish: matnni ko‘rib, tahrirlash', recSend: 'To‘xtatish va yuborish', e_old: 'server yangilanmagan', e_short: 'Yozuv juda qisqa. Qayta urinib ko‘ring.', e_stt: 'Ovozni matnga aylantirib bo‘lmadi. Qayta urinib ko‘ring.', sending: 'Yuborilmoqda…', cancel: 'Bekor qilish',
      netErr: 'Aloqa xatosi. Qayta urinib ko‘ring.', remembered: 'Eslab qoldim: ', limit: 'Oylik limit',
      attach: 'Fayl biriktirish', attachHint: 'Matnli fayllar: .txt .md .csv .json', removeAtt: 'Olib tashlash', file: 'Fayl',
      attOnly: 'Shu faylni ko‘rib chiqing.', fileBig: 'Fayl juda katta (har biri 12 000 belgigacha, jami 16 000).', binary: 'Hozircha faqat matnli fayllar qo‘llanadi.', tooMany: 'Ko‘pi bilan 3 ta fayl.',
      model: 'Model', auto: 'Avto', autoD: 'DODA o‘zi tanlaydi (tejamkor)', fast: 'Tez', fastD: 'Tez va arzon model: oddiy savollar uchun', smart: 'Aqlli', smartD: 'Kuchli model: murakkab ishlar uchun',
      copy: 'Nusxa olish', copied: 'Nusxalandi',
      note: 'DODA xato qilishi mumkin. Matn va ovoz yozuvi AI xizmatiga (Google Gemini, Anthropic Claude yoki OpenAI) yuboriladi: maxfiy ma’lumot yozmang.',
      consentTitle: 'Ovozli kiritish',
      consentText: 'Gapirganingizda ovoz yozib olinadi va matnga aylantirish uchun AI xizmatiga (Google Gemini yoki OpenAI) yuboriladi. Ovoz yozuvi DODA serverida saqlanmaydi. Bunga roziligingiz kerak (keyin akkauntda o‘chira olasiz).',
      agree: 'Roziman', decline: 'Hozir emas',
      e_not_allowed: 'Mikrofonga ruxsat bering (manzil satridagi qulf belgisi orqali).', e_no_speech: 'Ovoz eshitilmadi. Qayta urinib ko‘ring.',
      e_lang: 'Bu til brauzerda ovoz uchun qo‘llab-quvvatlanmaydi.', e_network: 'Ovozni matnga o‘girish xizmatiga ulanib bo‘lmadi.', e_other: 'Ovozli kiritishda xatolik.',
    },
    ru: {
      placeholder: 'Напишите DODA или скажите…', send: 'Отправить', stop: 'Остановить', mic: 'Голосовой ввод', micStop: 'Остановить запись',
      closeT: 'Закрыть', sugFor: 'Подходящий агент для этой задачи:', sugGo: 'Перейти к агенту', todayT: 'Сегодня', tasksT: 'Задачи', agentsT: 'Агенты', keysT: 'Ключи ИИ', keyBannerT: 'Чтобы начать, подключите свой ключ ИИ', keyBannerP: 'DODA работает с вашим личным аккаунтом Anthropic (Claude), Google Gemini или OpenAI: расходы списываются напрямую с вашего счёта.', keyBannerB: 'Подключить ключ', newChat: 'Новый диалог', search: 'Поиск', searchPh: 'Поиск по диалогам…', files: 'Файлы и память', chats: 'Диалоги', noChats: 'Пока нет диалогов', noMatch: 'Ничего не найдено',
      today: 'Сегодня', yesterday: 'Вчера', week: 'Последние 7 дней', older: 'Ранее', rename: 'Переименовать', del: 'Удалить', delSure: 'Точно удалить', more: 'Действия',
      account: 'Аккаунт', language: 'Язык', logout: 'Выйти', sbOpen: 'Открыть панель', sbClose: 'Закрыть панель',
      morning: 'Доброе утро', day: 'Добрый день', evening: 'Добрый вечер', night: 'Доброй ночи', ask: 'О чём поговорим?',
      listening: 'Слушаю… говорите', recBusy: 'Преобразую в текст…', recDiscard: 'Отменить запись', recStop: 'Остановить: посмотреть и править текст', recSend: 'Остановить и отправить', e_old: 'сервер не обновлён', e_short: 'Запись слишком короткая. Повторите.', e_stt: 'Не удалось преобразовать речь в текст. Повторите.', sending: 'Отправка…', cancel: 'Отмена',
      netErr: 'Ошибка связи. Повторите попытку.', remembered: 'Запомнил: ', limit: 'Месячный лимит',
      attach: 'Прикрепить файл', attachHint: 'Текстовые файлы: .txt .md .csv .json', removeAtt: 'Убрать', file: 'Файл',
      attOnly: 'Посмотрите этот файл.', fileBig: 'Файл слишком большой (до 12 000 символов каждый, всего 16 000).', binary: 'Пока поддерживаются только текстовые файлы.', tooMany: 'Не более 3 файлов.',
      model: 'Модель', auto: 'Авто', autoD: 'DODA выбирает сама (экономно)', fast: 'Быстро', fastD: 'Быстрая и дешёвая модель: для простых вопросов', smart: 'Умно', smartD: 'Мощная модель: для сложных задач',
      copy: 'Копировать', copied: 'Скопировано',
      note: 'DODA может ошибаться. Текст и запись голоса отправляются в ИИ-сервис (Google Gemini, Anthropic Claude или OpenAI): не пишите конфиденциальное.',
      consentTitle: 'Голосовой ввод',
      consentText: 'При разговоре голос записывается и отправляется в ИИ-сервис (Google Gemini или OpenAI) для преобразования в текст. Запись не сохраняется на сервере DODA. Для этого нужно ваше согласие (позже можно отключить в аккаунте).',
      agree: 'Согласен', decline: 'Не сейчас',
      e_not_allowed: 'Разрешите доступ к микрофону (значок замка в адресной строке).', e_no_speech: 'Речь не распознана. Повторите.',
      e_lang: 'Этот язык не поддерживается браузером для голоса.', e_network: 'Не удалось подключиться к сервису распознавания речи.', e_other: 'Ошибка голосового ввода.',
    },
  };
  const tr = (k) => T[lang()][k] ?? k;

  const ATTACH_MARK = '\n\n---\n[Biriktirilgan fayl:';
  const LIMITS = { files: 3, each: 12000, total: 16000 };

  /* ---------- yordamchilar ---------- */
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
  const IC = {
    mic: ['M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M19 11a7 7 0 0 1-14 0', 'M12 18v3'],
    up: ['M12 19V5', 'M5 12l7-7 7 7'],
    stop: ['M7 7h10v10H7z'],
    panel: ['M4 5h16v14H4z', 'M9 5v14'],
    plus: ['M12 5v14', 'M5 12h14'],
    search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M20 20l-4-4'],
    folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
    x: ['M6 6l12 12', 'M18 6L6 18'],
    agents: ['M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M5 22v-3a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3', 'M9 11h.01', 'M15 11h.01'],
    key: ['M15.5 8.5a4 4 0 1 1-5.2 3.8L4 18.6V21h3v-2h2v-2h2l1.1-1.2', 'M16.5 7.5h.01'],
    sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2', 'M12 20v2', 'M2 12h2', 'M20 12h2', 'M5 5l1.5 1.5', 'M17.5 17.5L19 19', 'M19 5l-1.5 1.5', 'M6.5 17.5L5 19'],
    tasks: ['M4 6l2 2 3-3', 'M12 7h8', 'M4 14l2 2 3-3', 'M12 15h8'],
    copy: ['M9 9h10v10H9z', 'M5 15V5h10'],
    check: ['M5 12l5 5 9-10'],
    more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
    chevron: ['M6 9l6 6 6-6'],
    clip: ['M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7'],
    edit: ['M4 20h4l10-10-4-4L4 16z'],
    trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
    user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
    out: ['M9 4H5v16h4', 'M16 8l4 4-4 4', 'M20 12H9'],
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

  /* ---------- kichik xavfsiz markdown ---------- */
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
    let list = null; let para = [];
    const flush = () => { if (para.length) { const p = h('p'); para.forEach((ln, i) => { if (i) p.append(document.createElement('br')); inline(p, ln); }); frag.append(p); para = []; } };
    for (const line of text.split('\n')) {
      const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
      const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (ul || ol) {
        flush();
        const tag = ul ? 'ul' : 'ol';
        if (!list || list.tagName.toLowerCase() !== tag) { list = h(tag); frag.append(list); }
        const li = h('li'); inline(li, (ul || ol)[1]); list.append(li);
      } else if (!line.trim()) { flush(); list = null; }
      else { list = null; para.push(line); }
    }
    flush();
    container.replaceChildren(frag);
  }

  /* ---------- holat ---------- */
  let root = null;
  let ui = {};
  let convId = null;
  let convList = [];
  let busy = false;
  let abortCtl = null;
  let stick = true;
  let voiceAllowed = null;
  let serverStt = null;
  let hasKeys = null;
  let rec = null;
  let listening = false;
  let autoTimer = null;
  let micError = false;
  let recAudio = null;
  let pop = null;
  let files = null;
  let atts = [];
  let query = '';
  let listTimer = null;
  let tier = 'auto';
  try { const t = localStorage.getItem('doda_tier'); if (['auto', 'light', 'main'].includes(t)) tier = t; } catch { /* ixtiyoriy */ }

  const isMobile = () => window.matchMedia('(max-width: 899px)').matches;
  const storeKey = () => { const u = me(); return u ? 'doda_conv_' + u.id : null; };
  const saveConv = () => { try { const k = storeKey(); if (k && convId) localStorage.setItem(k, convId); } catch { /* ixtiyoriy */ } };
  const forgetConv = () => { try { const k = storeKey(); if (k) localStorage.removeItem(k); } catch { /* ixtiyoriy */ } convId = null; };

  function firstName() {
    const u = me();
    const n = ((u && u.email) || '').split('@')[0].replace(/[._-]+/g, ' ').trim().split(' ')[0] || '';
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
  }
  function greeting() {
    const hr = new Date().getHours();
    const w = hr >= 5 && hr < 11 ? 'morning' : hr >= 11 && hr < 17 ? 'day' : hr >= 17 && hr < 23 ? 'evening' : 'night';
    return firstName() ? `${tr(w)}, ${firstName()}` : tr(w);
  }
  const initials = () => (firstName() || '?').slice(0, 2).toUpperCase();

  /* ---------- tuzilma ---------- */
  function mount() {
    if (root) unmount();
    document.body.classList.add('min-on');

    // yon panel
    ui.brand = h('button', { type: 'button', class: 'sb-brand', onclick: newChat }, h('span', { class: 'min-mark', 'aria-hidden': 'true' }, 'D'), h('span', {}, 'DODA'));
    ui.sbClose = h('button', { type: 'button', class: 'min-icon', onclick: () => setSidebar(false) }, svg(IC.panel));
    ui.rowNew = h('button', { type: 'button', class: 'sb-row', onclick: newChat }, svg(IC.plus, 18), h('span'));
    ui.rowSearch = h('button', { type: 'button', class: 'sb-row', onclick: toggleSearch }, svg(IC.search, 18), h('span'));
    ui.rowToday = h('button', { type: 'button', class: 'sb-row', onclick: () => { if (isMobile()) setSidebar(false); openOverlay('today'); } }, svg(IC.sun, 18), h('span'));
    ui.rowTasks = h('button', { type: 'button', class: 'sb-row', onclick: () => { if (isMobile()) setSidebar(false); openOverlay('tasks'); } }, svg(IC.tasks, 18), h('span'));
    ui.rowAgents = h('button', { type: 'button', class: 'sb-row', onclick: () => { if (isMobile()) setSidebar(false); openOverlay('agents'); } }, svg(IC.agents, 18), h('span'));
    ui.rowFiles = h('button', { type: 'button', class: 'sb-row', onclick: () => { if (isMobile()) setSidebar(false); openOverlay('files'); } }, svg(IC.folder, 18), h('span'));
    ui.search = h('input', { type: 'search', class: 'sb-search', hidden: true, autocomplete: 'off', oninput: (e) => { query = e.target.value.trim().toLowerCase(); renderList(); } });
    ui.list = h('div', { class: 'sb-list' });
    ui.userBtn = h('button', { type: 'button', class: 'sb-user', 'aria-haspopup': 'menu', onclick: openUserMenu },
      h('span', { class: 'sb-avatar', 'aria-hidden': 'true' }, initials()), h('span', { class: 'sb-uname' }, firstName() || '—'), svg(IC.chevron, 16));
    ui.sb = h('aside', { class: 'sb', 'aria-label': 'DODA' },
      h('div', { class: 'sb-head' }, ui.brand, ui.sbClose),
      h('nav', { class: 'sb-nav' }, ui.rowNew, ui.rowSearch, ui.rowToday, ui.rowTasks, ui.rowAgents, ui.rowFiles),
      ui.search, ui.list, h('div', { class: 'sb-foot' }, ui.userBtn));
    ui.backdrop = h('div', { class: 'sb-backdrop', onclick: () => setSidebar(false) });

    // asosiy qism
    ui.sbOpenBtn = h('button', { type: 'button', class: 'min-icon mn-toggle', onclick: () => setSidebar(true) }, svg(IC.panel));
    ui.title = h('div', { class: 'mn-title' });
    ui.langBtn = h('button', { type: 'button', class: 'min-icon min-lang', onclick: () => D().setLang && D().setLang(lang() === 'uz' ? 'ru' : 'uz') });
    ui.stream = h('main', { class: 'min-stream', id: 'min-stream', 'aria-live': 'polite' });
    ui.col = h('div', { class: 'min-col' });
    ui.stream.append(ui.col);
    ui.stream.addEventListener('scroll', () => { stick = ui.stream.scrollHeight - ui.stream.scrollTop - ui.stream.clientHeight < 80; });

    // yozish kartochkasi
    ui.input = h('textarea', { id: 'min-input', class: 'min-input', rows: '1', maxlength: '4000', autocomplete: 'off' });
    ui.plusBtn = h('button', { type: 'button', class: 'min-circle', 'aria-haspopup': 'menu', onclick: openPlusMenu }, svg(IC.plus));
    ui.tierBtn = h('button', { type: 'button', class: 'min-tier', 'aria-haspopup': 'menu', onclick: openTierMenu });
    ui.micBtn = h('button', { type: 'button', class: 'min-circle min-mic', 'aria-pressed': 'false', onclick: toggleVoice }, svg(IC.mic));
    ui.sendBtn = h('button', { type: 'submit', class: 'min-circle min-send', disabled: true }, svg(IC.up));
    ui.fileInput = h('input', { type: 'file', hidden: true, multiple: true, accept: '.txt,.md,.csv,.json,.log,.tsv,text/*', onchange: (e) => { addFiles([...e.target.files]); e.target.value = ''; } });
    ui.atts = h('div', { class: 'cmp-atts' });
    ui.consent = h('div', { class: 'min-consent', hidden: true });
    ui.keyBanner = h('div', { class: 'min-consent key-banner', hidden: true });
    ui.live = h('div', { class: 'min-live', role: 'status', 'aria-live': 'polite' });
    ui.recCancel = h('button', { type: 'button', class: 'min-circle', onclick: () => finishRec('cancel') }, svg(IC.x));
    ui.recCanvas = h('canvas', { class: 'rec-wave', 'aria-hidden': 'true' });
    ui.recText = h('span', { class: 'rec-text', hidden: true, role: 'status' });
    ui.recTime = h('span', { class: 'rec-time' }, '0:00');
    ui.recStop = h('button', { type: 'button', class: 'min-circle rec-stop', onclick: () => finishRec('stop') }, svg(IC.stop, 18));
    ui.recSend = h('button', { type: 'button', class: 'min-circle rec-send', onclick: () => finishRec('send') }, svg(IC.up));
    ui.recBar = h('div', { class: 'rec-bar', hidden: true }, ui.recCancel, h('div', { class: 'rec-mid' }, ui.recCanvas, ui.recText), ui.recTime, ui.recStop, ui.recSend);
    ui.form = h('form', { class: 'cmp', onsubmit: onSubmit }, ui.keyBanner, ui.consent, ui.atts, ui.input,
      h('div', { class: 'cmp-row' }, ui.plusBtn, h('span', { class: 'cmp-gap' }), ui.tierBtn, ui.micBtn, ui.sendBtn), ui.recBar, ui.fileInput);
    ui.note = h('p', { class: 'min-note' });

    ui.input.addEventListener('input', () => { autoGrow(); cancelAuto(); updateSend(); });
    ui.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ui.form.requestSubmit(); } });
    ui.form.addEventListener('dragover', (e) => { e.preventDefault(); });
    ui.form.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]); });

    ui.mn = h('div', { class: 'mn' },
      h('header', { class: 'mn-top' }, ui.sbOpenBtn, ui.title, h('div', { class: 'mn-top-r' }, ui.langBtn)),
      h('div', { class: 'mn-body' }, ui.stream, h('footer', { class: 'min-foot' }, ui.form, ui.live, ui.note)));

    root = h('div', { id: 'min', class: 'min' }, ui.sb, ui.backdrop, ui.mn);
    document.body.append(root);

    if (!speechCtor() && !canRecord()) ui.micBtn.hidden = true;
    let open = !isMobile();
    try { const v = localStorage.getItem('doda_sb'); if (v === '0' && !isMobile()) open = false; } catch { /* ixtiyoriy */ }
    setSidebar(open, true);
    window.addEventListener('resize', onResize);

    relabel();
    showEmpty();
    loadList();
    loadHistory();
    refreshKeys();
    api('/api/voice/status').then((r) => { if (r.status === 200) serverStt = !!r.data.server; if (root && ui.micBtn && !speechCtor() && !canRecord()) ui.micBtn.hidden = true; });
    api('/api/auth/me').then((r) => { voiceAllowed = !!(r.data.consents && r.data.consents.voice && r.data.consents.voice.accepted); });
    ui.input.focus({ preventScroll: true });
  }

  function unmount() {
    stopVoice(true); cancelAuto(); closePop();
    if (abortCtl) abortCtl.abort();
    closeFiles(true);
    window.removeEventListener('resize', onResize);
    if (root) root.remove();
    root = null; ui = {}; busy = false; convId = null; convList = []; atts = []; query = '';
    document.body.classList.remove('min-on');
  }

  let lastMobile = null;
  function onResize() {
    const m = isMobile();
    if (lastMobile !== null && m !== lastMobile) setSidebar(!m, true);
    lastMobile = m;
  }
  function setSidebar(open, silent) {
    if (!root) return;
    root.classList.toggle('sb-open', open);
    ui.sbOpenBtn.setAttribute('aria-expanded', String(open));
    lastMobile = isMobile();
    if (!silent && !isMobile()) { try { localStorage.setItem('doda_sb', open ? '1' : '0'); } catch { /* ixtiyoriy */ } }
  }

  function relabel() {
    if (!root) return;
    ui.input.placeholder = tr('placeholder');
    ui.input.setAttribute('aria-label', tr('placeholder'));
    ui.micBtn.setAttribute('aria-label', listening ? tr('micStop') : tr('mic'));
    ui.sendBtn.setAttribute('aria-label', busy ? tr('stop') : tr('send'));
    ui.plusBtn.setAttribute('aria-label', tr('attach'));
    ui.sbClose.setAttribute('aria-label', tr('sbClose'));
    ui.sbOpenBtn.setAttribute('aria-label', tr('sbOpen'));
    ui.langBtn.textContent = lang().toUpperCase();
    ui.langBtn.setAttribute('aria-label', lang() === 'uz' ? 'Til: o‘zbekcha. Русский tilga o‘tish' : 'Язык: русский. Переключить на o‘zbekcha');
    ui.brand.setAttribute('aria-label', tr('newChat'));
    ui.rowNew.lastChild.textContent = tr('newChat');
    ui.rowSearch.lastChild.textContent = tr('search');
    ui.recCancel.setAttribute('aria-label', tr('recDiscard')); ui.recStop.setAttribute('aria-label', tr('recStop')); ui.recSend.setAttribute('aria-label', tr('recSend'));
    ui.recStop.title = tr('recStop'); ui.recSend.title = tr('recSend'); ui.recCancel.title = tr('recDiscard');
    renderKeyBanner();
    ui.rowToday.lastChild.textContent = tr('todayT');
    ui.rowTasks.lastChild.textContent = tr('tasksT');
    ui.rowAgents.lastChild.textContent = tr('agentsT');
    ui.rowFiles.lastChild.textContent = tr('files');
    ui.search.placeholder = tr('searchPh');
    ui.search.setAttribute('aria-label', tr('searchPh'));
    ui.userBtn.setAttribute('aria-label', tr('account'));
    ui.tierBtn.replaceChildren(h('span', {}, { auto: tr('auto'), light: tr('fast'), main: tr('smart') }[tier]), svg(IC.chevron, 14));
    ui.tierBtn.setAttribute('aria-label', tr('model'));
    ui.note.textContent = tr('note');
    const empty = ui.col.querySelector('.min-empty');
    if (empty) { empty.querySelector('h1').textContent = greeting(); empty.querySelector('p').textContent = tr('ask'); }
    renderList(); renderAtts();
  }
  document.addEventListener('doda:lang', () => { if (root) { relabel(); renderConsent(); relangOverlay(); } });

  /* ---------- yon panel: suhbatlar ---------- */
  function toggleSearch() {
    ui.search.hidden = !ui.search.hidden;
    if (!ui.search.hidden) ui.search.focus(); else { ui.search.value = ''; query = ''; renderList(); }
  }

  async function loadList() {
    const r = await api('/api/conversations');
    if (!root || r.status !== 200) return;
    convList = r.data.conversations || [];
    renderList();
  }
  function refreshListSoon() { clearTimeout(listTimer); listTimer = setTimeout(loadList, 400); }

  function groupOf(ts) {
    const d = new Date(ts); const now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    return diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : diff <= 7 ? 'week' : 'older';
  }

  function renderList() {
    if (!ui.list) return;
    ui.list.replaceChildren();
    const rows = convList.filter((c) => !query || c.title.toLowerCase().includes(query));
    const cur = convList.find((c) => c.id === convId);
    ui.title.textContent = cur ? cur.title : '';
    if (!rows.length) { ui.list.append(h('div', { class: 'sb-none' }, query ? tr('noMatch') : tr('noChats'))); return; }
    let lastG = null;
    for (const c of rows) {
      const g = groupOf(c.updatedAt);
      if (g !== lastG) { ui.list.append(h('div', { class: 'sb-group' }, tr(g))); lastG = g; }
      ui.list.append(chatRow(c));
    }
  }

  function chatRow(c) {
    const link = h('button', { type: 'button', class: 'sb-link', title: c.title, onclick: () => openChat(c.id) }, c.title);
    const more = h('button', { type: 'button', class: 'sb-more', 'aria-label': tr('more'), 'aria-haspopup': 'menu', onclick: (e) => { e.stopPropagation(); openChatMenu(more, c, li, link); } }, svg(IC.more, 18));
    const li = h('div', { class: 'sb-item' + (c.id === convId ? ' on' : '') }, link, more);
    return li;
  }

  function startRename(c, li, link) {
    const inp = h('input', { class: 'sb-rename', value: c.title, maxlength: '80', 'aria-label': tr('rename') });
    li.replaceChildren(inp);
    inp.focus(); inp.select();
    let done = false;
    const finish = async (save) => {
      if (done) return; done = true;
      const v = inp.value.trim();
      if (save && v && v !== c.title) { const r = await api('/api/conversations/' + encodeURIComponent(c.id), { method: 'PATCH', body: { title: v } }); if (r.status === 200) c.title = v; }
      renderList();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
    inp.addEventListener('blur', () => finish(true));
    void link;
  }

  async function deleteChat(c) {
    const r = await api('/api/conversations/' + encodeURIComponent(c.id), { method: 'DELETE' });
    if (r.status === 200) { convList = convList.filter((x) => x.id !== c.id); if (c.id === convId) newChat(true); else renderList(); }
  }

  /* ---------- suzuvchi menyular ---------- */
  function closePop() {
    if (!pop) return;
    pop.el.remove();
    document.removeEventListener('mousedown', pop.onDown, true);
    if (pop.anchor && pop.anchor.setAttribute) pop.anchor.setAttribute('aria-expanded', 'false');
    pop = null;
  }
  function openPop(anchor, content, { align = 'left', above = true } = {}) {
    closePop();
    const el = h('div', { class: 'pop', role: 'menu' }, content);
    document.body.append(el);
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth; const hgt = el.offsetHeight;
    let left = align === 'right' ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = above ? r.top - hgt - 8 : r.bottom + 8;
    if (top < 8) top = Math.min(r.bottom + 8, window.innerHeight - hgt - 8);
    el.style.left = left + 'px'; el.style.top = top + 'px';
    const onDown = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePop(); };
    document.addEventListener('mousedown', onDown, true);
    anchor.setAttribute('aria-expanded', 'true');
    pop = { el, anchor, onDown };
    const first = el.querySelector('button'); if (first) first.focus();
  }

  function popRow(icon, label, fn, cls = '', desc = '') {
    return h('button', { type: 'button', role: 'menuitem', class: 'pop-row ' + cls, onclick: fn },
      icon ? svg(icon, 18) : null, h('span', { class: 'pop-txt' }, h('span', {}, label), desc ? h('small', {}, desc) : null));
  }

  function openPlusMenu() {
    openPop(ui.plusBtn, h('div', {}, popRow(IC.clip, tr('attach'), () => { closePop(); ui.fileInput.click(); }, '', tr('attachHint'))), { align: 'left' });
  }

  function openTierMenu() {
    const row = (key, label, desc) => popRow(tier === key ? IC.check : null, label, () => { tier = key; try { localStorage.setItem('doda_tier', key); } catch { /* ixtiyoriy */ } closePop(); relabel(); }, tier === key ? 'sel' : 'nosel', desc);
    openPop(ui.tierBtn, h('div', {}, row('auto', tr('auto'), tr('autoD')), row('light', tr('fast'), tr('fastD')), row('main', tr('smart'), tr('smartD'))), { align: 'right' });
  }

  function openChatMenu(anchor, c, li, link) {
    const del = popRow(IC.trash, tr('del'), () => {
      if (!del.dataset.sure) { del.dataset.sure = '1'; del.querySelector('.pop-txt > span').textContent = tr('delSure'); return; }
      closePop(); deleteChat(c);
    }, 'danger');
    openPop(anchor, h('div', {}, popRow(IC.edit, tr('rename'), () => { closePop(); startRename(c, li, link); }), del), { align: 'left', above: false });
  }

  function openUserMenu() {
    const seg = (code) => h('button', { type: 'button', class: 'seg' + (lang() === code ? ' on' : ''), 'aria-pressed': String(lang() === code), onclick: () => { if (D().setLang) D().setLang(code); closePop(); } }, code.toUpperCase());
    openPop(ui.userBtn, h('div', {},
      popRow(IC.key, tr('keysT'), () => { closePop(); openOverlay('keys'); }),
      popRow(IC.user, tr('account'), () => { closePop(); if (D().openAccount) D().openAccount(); }),
      h('div', { class: 'pop-lang' }, h('span', {}, tr('language')), h('div', { class: 'segs' }, seg('uz'), seg('ru'))),
      popRow(IC.out, tr('logout'), () => { closePop(); if (D().logout) D().logout(); })), { align: 'left' });
  }

  /* ---------- xabarlar ---------- */
  function setEmptyMode(on) { if (ui.mn) ui.mn.classList.toggle('empty', on); }
  function showEmpty() {
    setEmptyMode(true);
    ui.col.replaceChildren(h('div', { class: 'min-empty' }, h('h1', {}, greeting()), h('p', {}, tr('ask'))));
  }
  function clearEmpty() { const e = ui.col.querySelector('.min-empty'); if (e) e.remove(); setEmptyMode(false); }
  function scrollDown(force) { if (force || stick) ui.stream.scrollTop = ui.stream.scrollHeight; }

  function splitAttach(text) {
    const i = text.indexOf(ATTACH_MARK);
    if (i < 0) return { typed: text, names: [] };
    const names = []; const re = /\n\n---\n\[Biriktirilgan fayl: ([^\]\n]*)\]\n/g; let m;
    while ((m = re.exec(text))) names.push(m[1]);
    return { typed: text.slice(0, i), names };
  }

  function addUser(text) {
    clearEmpty();
    const { typed, names } = splitAttach(text);
    const bubble = h('div', { class: 'min-bubble' }, typed);
    for (const n of names) bubble.append(h('div', { class: 'min-attchip' }, svg(IC.clip, 14), h('span', {}, n)));
    ui.col.append(h('div', { class: 'min-msg user' }, bubble));
    stick = true; scrollDown(true);
  }

  function copyText(text, btn) {
    const done = () => { btn.replaceChildren(svg(IC.check, 16)); btn.title = tr('copied'); setTimeout(() => { btn.replaceChildren(svg(IC.copy, 16)); btn.title = tr('copy'); }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => {});
    else { const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text; document.body.append(ta); ta.select(); try { document.execCommand('copy'); done(); } catch { /* ixtiyoriy */ } ta.remove(); }
  }

  function addDoda(text = '') {
    clearEmpty();
    const body = h('div', { class: 'min-text' });
    const meta = h('span', { class: 'min-meta' });
    const copyBtn = h('button', { type: 'button', class: 'min-copy', title: tr('copy'), 'aria-label': tr('copy') }, svg(IC.copy, 16));
    const actions = h('div', { class: 'min-actions', hidden: true }, copyBtn, meta);
    const el = h('div', { class: 'min-msg doda' }, body, actions);
    el._raw = text;
    copyBtn.addEventListener('click', () => copyText(el._raw, copyBtn));
    if (text) { renderMd(body, text); actions.hidden = false; }
    ui.col.append(el); scrollDown();
    return { el, body, meta, actions };
  }

  async function loadHistory() {
    let id = null;
    try { const k = storeKey(); id = k ? localStorage.getItem(k) : null; } catch { /* ixtiyoriy */ }
    if (!id) return;
    await openChat(id, true);
  }

  async function openChat(id, quiet) {
    if (busy) return;
    const r = await api('/api/conversations/' + encodeURIComponent(id));
    if (!root) return;
    if (r.status !== 200 || !r.data.messages || !r.data.messages.length) { if (quiet) forgetConv(); return; }
    stopVoice(true); cancelAuto();
    convId = id; saveConv();
    ui.col.replaceChildren(); setEmptyMode(false);
    for (const m of r.data.messages) (m.role === 'user' ? addUser(m.content) : addDoda(m.content));
    renderList(); scrollDown(true);
    if (isMobile()) setSidebar(false, true);
  }

  function newChat(keepSidebar) {
    if (busy) return;
    stopVoice(true); cancelAuto();
    forgetConv(); showEmpty(); ui.input.value = ''; atts = []; renderAtts(); autoGrow(); updateSend(); setLive('');
    renderList();
    if (keepSidebar !== true && isMobile()) setSidebar(false, true);
    ui.input.focus({ preventScroll: true });
  }

  /* ---------- fayl biriktirish ---------- */
  function renderAtts() {
    if (!ui.atts) return;
    ui.atts.replaceChildren();
    ui.atts.hidden = atts.length === 0;
    atts.forEach((a, i) => ui.atts.append(h('span', { class: 'cmp-att' }, svg(IC.clip, 14), h('span', {}, a.name),
      h('button', { type: 'button', class: 'cmp-att-x', 'aria-label': tr('removeAtt'), onclick: () => { atts.splice(i, 1); renderAtts(); updateSend(); } }, svg(IC.x, 14)))));
  }
  async function addFiles(list) {
    for (const f of list) {
      if (atts.length >= LIMITS.files) { setLive(tr('tooMany')); setTimeout(() => { if (!autoTimer && !listening) setLive(''); }, 3500); break; }
      if (f.size > 400 * 1024) { setLive(tr('fileBig')); continue; }
      let text = '';
      try { text = await f.text(); } catch { continue; }
      if (text.includes('\u0000')) { setLive(tr('binary')); continue; }
      text = text.trim();
      if (!text) continue;
      const total = atts.reduce((n, a) => n + a.text.length, 0);
      if (text.length > LIMITS.each || total + text.length > LIMITS.total) { setLive(tr('fileBig')); continue; }
      atts.push({ name: f.name.slice(0, 80), text });
    }
    renderAtts(); updateSend();
  }

  /* ---------- yuborish ---------- */
  function autoGrow() { ui.input.style.height = 'auto'; ui.input.style.height = Math.min(ui.input.scrollHeight, 200) + 'px'; }
  function updateSend() {
    const has = ui.input.value.trim().length > 0 || atts.length > 0;
    ui.sendBtn.disabled = !busy && !has;
    ui.sendBtn.classList.toggle('on', has || busy);
  }
  function setBusy(b) {
    busy = b;
    ui.sendBtn.replaceChildren(svg(b ? IC.stop : IC.up));
    ui.sendBtn.setAttribute('aria-label', b ? tr('stop') : tr('send'));
    ui.sendBtn.classList.toggle('stop', b);
    ui.micBtn.disabled = b;
    updateSend();
  }

  function onSubmit(e) {
    e.preventDefault();
    if (busy) { if (abortCtl) abortCtl.abort(); return; }
    cancelAuto(); stopVoice(true);
    const typed = ui.input.value.trim();
    if (!typed && !atts.length) return;
    const text = (typed || tr('attOnly')) + atts.map((a) => `${ATTACH_MARK} ${a.name}]\n${a.text}`).join('');
    ui.input.value = ''; atts = []; renderAtts(); autoGrow(); setLive('');
    send(text);
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

  const LABEL = {
    'gemini-3.5-flash-lite': 'Gemini Flash-Lite', 'gemini-3.8-flash': 'Gemini 3.8 Flash',
    'claude-haiku-5-5': 'Claude Haiku 5.5', 'claude-sonnet-5-5': 'Claude Sonnet 5.5',
    'gpt-6-luna': 'GPT-6 Luna', 'gpt-6.2-sol': 'GPT-6.2 Sol',
  };

  /* DODA: so'rov aniq ishga o'xshasa va mos agent aniq bo'lsa, javob ostida taklif ko'rsatadi (AI siz, qoidalar bo'yicha) */
  async function suggestAgent(text, el) {
    if (!text || text.trim().length < 25) return;
    const r = await api('/api/agents/route', { method: 'POST', body: { text } });
    const m = r.status === 200 && r.data && r.data.match;
    if (!m || m.confidence !== 'high' || !el.isConnected) return;
    const chip = h('div', { class: 'min-sug' }, h('span', {}, tr('sugFor') + ' '), h('b', {}, m.name),
      h('button', { type: 'button', class: 'min-btn primary', onclick: () => { chip.remove(); document.dispatchEvent(new CustomEvent('doda:open', { detail: { kind: 'agents', agent: m.agentId, text } })); } }, tr('sugGo')),
      h('button', { type: 'button', class: 'min-icon', 'aria-label': tr('closeT'), onclick: () => chip.remove() }, svg(IC.x, 14)));
    el.append(chip); scrollDown();
  }

  async function send(text) {
    addUser(text);
    const reply = addDoda();
    reply.el.classList.add('typing');
    setBusy(true);
    abortCtl = new AbortController();
    let full = ''; let model = ''; let raf = 0;
    const paint = () => { raf = 0; renderMd(reply.body, full); scrollDown(); };
    try {
      const res = await fetch(D().API + '/api/chat', {
        method: 'POST', credentials: 'include', signal: abortCtl.signal,
        headers: { 'Content-Type': 'application/json', 'Accept-Language': lang() },
        body: JSON.stringify({ message: text, tier, ...(convId ? { conversationId: convId } : {}) }),
      });
      if (!res.ok || !(res.headers.get('content-type') || '').includes('text/event-stream')) {
        const j = await res.json().catch(() => ({}));
        reply.el.classList.remove('typing'); reply.el.classList.add('error');
        reply.body.textContent = (j && j.error && j.error.message) || tr('netErr');
        if (j && j.error && j.error.code === 'api_key_required') {
          hasKeys = false; renderKeyBanner();
          reply.body.append(h('div', { class: 'min-consent-actions', style: 'margin-top:10px' }, h('button', { type: 'button', class: 'min-btn primary', onclick: () => openOverlay('keys') }, tr('keyBannerB'))));
        }
      } else {
        await readSse(res, (event, data) => {
          if (event === 'meta') { convId = data.conversationId; model = data.model; saveConv(); }
          else if (event === 'delta') { reply.el.classList.remove('typing'); full += data.text; reply.el._raw = full; if (!raf) raf = requestAnimationFrame(paint); }
          else if (event === 'error') {
            reply.el.classList.remove('typing');
            if (!full) { reply.el.classList.add('error'); reply.body.textContent = data.message || tr('netErr'); }
            else { reply.actions.hidden = false; reply.meta.textContent = data.message || tr('netErr'); }
          } else if (event === 'done') {
            const frac = data.budgetUsd ? data.monthUsd / data.budgetUsd : 0;
            reply.actions.hidden = false;
            reply.meta.textContent = `${LABEL[model] || model} · $${data.costUsd.toFixed(4)}` + (frac >= 0.8 ? ` · ${tr('limit')}: $${data.monthUsd.toFixed(2)} / $${data.budgetUsd}` : '');
            setBusy(false);
            refreshListSoon();
            suggestAgent(text, reply.el);
          } else if (event === 'memory') {
            reply.el.append(h('div', { class: 'min-mem' }, tr('remembered') + data.facts.join('; '))); scrollDown();
            document.dispatchEvent(new CustomEvent('doda:memory'));
          }
        });
      }
    } catch (e) {
      reply.el.classList.remove('typing');
      if (!(e && e.name === 'AbortError')) { if (!full) { reply.el.classList.add('error'); reply.body.textContent = tr('netErr'); } }
    }
    if (raf) cancelAnimationFrame(raf);
    if (full) { renderMd(reply.body, full); reply.actions.hidden = false; }
    reply.el.classList.remove('typing');
    abortCtl = null;
    setBusy(false);
    refreshListSoon();
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
      const typed = ui.input.value.trim();
      if (typed && !busy) { onSubmit(new Event('submit')); }
    }, 1800);
  }

  function renderConsent() {
    if (!ui.consent || ui.consent.hidden) return;
    ui.consent.replaceChildren(
      h('b', {}, tr('consentTitle')), h('p', {}, tr('consentText')),
      h('div', { class: 'min-consent-actions' },
        h('button', { type: 'button', class: 'min-btn primary', onclick: grantVoice }, tr('agree')),
        h('button', { type: 'button', class: 'min-btn', onclick: () => { ui.consent.hidden = true; } }, tr('decline'))));
  }
  async function grantVoice() {
    const r = await api('/api/account/consents', { method: 'POST', body: { type: 'voice', accepted: true } });
    if (r.status === 200) { voiceAllowed = true; ui.consent.hidden = true; beginVoice(); }
  }
  function toggleVoice() {
    if (listening) { stopVoice(false); return; }
    if (recAudio) return;
    cancelAuto();
    if (voiceAllowed === false) { ui.consent.hidden = false; renderConsent(); return; }
    beginVoice();
  }
  const beginVoice = () => (canRecord() ? startRec() : startVoice());
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
    rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
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

  /* ---------- ovoz: yozib olish, to'lqin, Gemini orqali matn (Gemini ilovasi uslubida) ---------- */
  const REC_MAX_S = 90;
  const canRecord = () => serverStt !== false && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  function pickMime() {
    for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* ixtiyoriy */ }
    }
    return '';
  }
  function setRecUi(on, busy) {
    ui.form.classList.toggle('recording', on);
    ui.recBar.hidden = !on;
    ui.recCanvas.hidden = !!busy; ui.recText.hidden = !busy;
    ui.recText.textContent = busy ? tr('recBusy') : '';
    ui.recStop.disabled = ui.recSend.disabled = ui.recCancel.disabled = !!busy;
    ui.recTime.hidden = !!busy;
  }
  function drawWave(r) {
    const cv = ui.recCanvas;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(40, cv.clientWidth); const hgt = Math.max(20, cv.clientHeight);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hgt);
    const step = 6; const n = Math.floor(w / step);
    const hist = r.hist.slice(-n);
    g.fillStyle = '#cfe6ec';
    for (let i = 0; i < n; i++) {
      const k = i - (n - hist.length);
      const a = k >= 0 ? hist[k] : 0;
      const bh = Math.max(2, Math.min(hgt, a * hgt));
      g.fillRect(i * step, (hgt - bh) / 2, 2.5, bh);
    }
  }
  async function startRec() {
    if (recAudio) return;
    setLive('');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { setLive(tr('e_not_allowed')); return; }
    if (!root) { stream.getTracks().forEach((t) => t.stop()); return; }
    const mime = pickMime();
    let mr;
    try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined); }
    catch { stream.getTracks().forEach((t) => t.stop()); setLive(tr('e_other')); return; }
    const r = { stream, mr, chunks: [], hist: [], t0: Date.now(), ending: false, mode: 'stop', base: ui.input.value.trim(), ctx: null, timer: null, tick: null };
    recAudio = r;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      r.ctx = new AC();
      const an = r.ctx.createAnalyser(); an.fftSize = 512;
      r.ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      r.tick = setInterval(() => {
        an.getByteTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        r.hist.push(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        if (r.hist.length > 400) r.hist.splice(0, 100);
        drawWave(r);
      }, 60);
    } catch { /* to'lqinsiz ham yozish ishlaydi */ }
    mr.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
    mr.onstop = () => onRecStop(r);
    mr.start(250);
    setRecUi(true, false);
    ui.micBtn.classList.add('live');
    const upd = () => {
      const s = Math.floor((Date.now() - r.t0) / 1000);
      ui.recTime.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      if (s >= REC_MAX_S) finishRec('stop');
    };
    upd(); r.timer = setInterval(upd, 500);
  }
  function finishRec(mode) {
    const r = recAudio;
    if (!r || r.ending) return;
    r.ending = true; r.mode = mode;
    try { if (r.mr.state !== 'inactive') r.mr.stop(); else onRecStop(r); } catch { onRecStop(r); }
  }
  function cleanupRec(r) {
    clearInterval(r.timer); clearInterval(r.tick);
    r.stream.getTracks().forEach((t) => t.stop());
    if (r.ctx) { try { r.ctx.close(); } catch { /* ixtiyoriy */ } }
  }
  function blobToB64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  async function onRecStop(r) {
    if (r.done) return; r.done = true;
    cleanupRec(r);
    const finish = () => { recAudio = null; if (!root) return; setRecUi(false, false); ui.micBtn.classList.remove('live'); };
    if (r.mode === 'cancel' || !root) { finish(); return; }
    const blob = new Blob(r.chunks, { type: (r.mr.mimeType || 'audio/webm').split(';')[0] === '' ? 'audio/webm' : (r.mr.mimeType || 'audio/webm') });
    if (blob.size < 1200) { finish(); setLive(tr('e_short')); setTimeout(() => setLive(''), 3500); return; }
    setRecUi(true, true);
    let res;
    try {
      const data = await blobToB64(blob);
      res = await api('/api/voice/transcribe', { method: 'POST', body: { mime: blob.type || 'audio/webm', data, lang: lang() } });
    } catch { res = { status: 0, data: {} }; }
    finish();
    if (!root) return;
    if (res.status === 403) { voiceAllowed = false; ui.consent.hidden = false; renderConsent(); return; }
    const text = res.status === 200 && res.data && typeof res.data.text === 'string' ? res.data.text.trim() : null;
    if (text === null) { setLive((res.data && res.data.error && res.data.error.message) || (tr('e_stt') + ' (' + (res.status === 404 ? tr('e_old') : 'status ' + res.status) + ')')); setTimeout(() => setLive(''), 8000); return; }
    if (!text) { setLive(tr('e_no_speech')); setTimeout(() => setLive(''), 3500); return; }
    ui.input.value = [r.base, text].filter(Boolean).join(' ');
    autoGrow(); updateSend();
    if (r.mode === 'send' && !busy) onSubmit(new Event('submit'));
    else ui.input.focus({ preventScroll: true });
  }

  function stopVoice(silent) {
    if (silent && recAudio && !recAudio.ending) finishRec('cancel');
    if (rec) { try { silent ? rec.abort() : rec.stop(); } catch { /* ixtiyoriy */ } }
    if (silent) { listening = false; if (ui.micBtn) ui.micBtn.classList.remove('live'); }
  }

  /* ---------- fayllar (ishchi maydon) ---------- */
  /* ---------- foydalanuvchining shaxsiy AI kalitlari (BYOK) ---------- */
  async function refreshKeys() {
    const r = await api('/api/keys');
    if (!root || r.status !== 200) return;
    hasKeys = r.data.sharedAvailable || r.data.providers.some((p) => p.connected && p.status === 'active');
    renderKeyBanner();
  }
  function renderKeyBanner() {
    if (!ui.keyBanner) return;
    ui.keyBanner.hidden = hasKeys !== false;
    if (hasKeys !== false) return;
    ui.keyBanner.replaceChildren(
      h('b', {}, tr('keyBannerT')), h('p', {}, tr('keyBannerP')),
      h('div', { class: 'min-consent-actions' }, h('button', { type: 'button', class: 'min-btn primary', onclick: () => openOverlay('keys') }, tr('keyBannerB'))));
  }
  document.addEventListener('doda:open', (e) => { const d = e.detail || {}; closeFiles(true); openOverlay(d.kind, d.agent ? { agent: d.agent, text: d.text } : undefined); });
  document.addEventListener('doda:open-keys', () => { closeFiles(true); openOverlay('keys'); });
  document.addEventListener('doda:keys', () => { refreshKeys(); serverSttRefresh(); });
  function serverSttRefresh() {
    api('/api/voice/status').then((r) => { if (r.status === 200) serverStt = !!r.data.server; if (root && ui.micBtn) ui.micBtn.hidden = !speechCtor() && !canRecord(); });
  }

  const OVERLAYS = { files: () => window.DODA_WS, tasks: () => window.DODA_TASKS, agents: () => window.DODA_AGENTS, keys: () => window.DODA_KEYS, today: () => window.DODA_TODAY };
  function openOverlay(kind, opts) {
    const mod = OVERLAYS[kind] && OVERLAYS[kind]();
    if (files || !mod) return;
    const body = h('div', { class: 'min-files-body' });
    const titleEl = h('b');
    const closeBtn = h('button', { type: 'button', class: 'min-icon', onclick: () => closeFiles() }, svg(IC.x));
    files = h('div', { class: 'min-files', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'min-files-head' }, titleEl, closeBtn), body);
    files.dataset.kind = kind;
    files._ui = { titleEl, closeBtn, body, opts };
    overlayLabels();
    previousFocus = document.activeElement;
    document.body.append(files);
    mod.mount(body, opts);
    closeBtn.focus();
  }
  let previousFocus = null;
  function overlayTitle(kind) { return kind === 'today' ? tr('todayT') : kind === 'tasks' ? tr('tasksT') : kind === 'agents' ? tr('agentsT') : kind === 'keys' ? tr('keysT') : tr('files'); }
  function overlayLabels() {
    if (!files) return;
    const title = overlayTitle(files.dataset.kind);
    files._ui.titleEl.textContent = title;
    files.setAttribute('aria-label', title);
    files._ui.closeBtn.setAttribute('aria-label', tr('closeT'));
  }
  /* Til almashganda ochiq oyna yangi tilda qayta chiziladi (saqlanmagan o'zgarish bo'lsa, faqat sarlavha yangilanadi) */
  function relangOverlay() {
    if (!files) return;
    overlayLabels();
    const kind = files.dataset.kind;
    const mod = OVERLAYS[kind] && OVERLAYS[kind]();
    if (!mod || (mod.isDirty && mod.isDirty())) return;
    mod.unmount();
    files._ui.body.replaceChildren();
    mod.mount(files._ui.body, files._ui.opts);
  }
  function closeFiles(force) {
    if (!files) return;
    const kind0 = files.dataset.kind;
    const mod = OVERLAYS[kind0] && OVERLAYS[kind0]();
    if (mod) {
      if (!force && mod.isDirty && mod.isDirty() && !window.confirm(lang() === 'ru' ? 'Несохранённые изменения будут потеряны. Закрыть?' : 'Saqlanmagan o‘zgarishlar yo‘qoladi. Yopilsinmi?')) return;
      mod.unmount();
    }
    files.remove(); files = null;
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    previousFocus = null;
    if (kind0 === 'keys') refreshKeys();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !root) return;
    if (pop) closePop();
    else if (files) closeFiles();
    else if (isMobile() && root.classList.contains('sb-open')) setSidebar(false, true);
    else if (autoTimer) cancelAuto();
    else if (recAudio) finishRec('cancel');
    else if (listening) stopVoice(true);
  });

  document.addEventListener('doda:login', mount);
  document.addEventListener('doda:logout', unmount);
  if (me()) mount();
})();

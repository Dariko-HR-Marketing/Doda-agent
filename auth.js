/* DODA: ro'yxatdan o'tish, kirish, akkaunt. Server: doda-api (cookie sessiya). */
(() => {
  'use strict';

  const host = location.hostname;
  const API = host === 'localhost' || host === '127.0.0.1' ? 'http://localhost:8787' : 'https://doda-api.tajriba24.uz';

  const I18N = {
    uz: {
      tagline: 'Yordamchi agentlar uyushmasi',
      login: 'Kirish', register: 'Ro‘yxatdan o‘tish',
      email: 'Pochta', password: 'Parol', passwordHint: 'Kamida 10 ta belgi',
      show: 'Ko‘rsatish', hide: 'Yashirish',
      loginBtn: 'Kirish', registerBtn: 'Ro‘yxatdan o‘tish', google: 'Google bilan davom etish', or: 'yoki',
      cTerms: 'Foydalanish shartlari (oferta)ni o‘qib chiqdim va qabul qilaman',
      cData: 'Shaxsiy ma’lumotlarimni qayta ishlashga roziman',
      cCross: 'Ma’lumotlarim sun’iy intellekt xizmatlariga (Google, Anthropic, OpenAI) chet elga uzatilishiga roziman',
      cVoice: 'Ovoz yozuvlarimni qayta ishlashga roziman (ixtiyoriy)',
      legal: 'Shartlar va rozilik matni (qoralama)',
      sentTitle: 'Pochtangizni tekshiring', sentText: 'Tasdiqlash havolasi yuborildi. Xat kelmasa, “Spam” papkasini ham ko‘ring. Havola 24 soat amal qiladi.', back: 'Kirish sahifasiga qaytish',
      verifying: 'Pochta tasdiqlanmoqda…', verifiedTitle: 'Pochta tasdiqlandi', verifiedText: 'Endi tizimga kirishingiz mumkin.',
      offlineTitle: 'Server bilan aloqa yo‘q', offlineText: 'Hisob tizimi hozir ishlamayapti. Namuna rejimida davom etishingiz mumkin: ma’lumotlar faqat shu qurilmada qoladi.', demo: 'Namuna rejimida davom etish', retry: 'Qayta urinish',
      account: 'Akkaunt', voiceConsent: 'Ovoz yozuvlarini qayta ishlashga rozilik', logout: 'Chiqish', close: 'Yopish',
      deleteTitle: 'Akkauntni o‘chirish', deleteText: 'Akkaunt va unga bog‘liq barcha ma’lumot butunlay o‘chiriladi. Buni qaytarib bo‘lmaydi.', deleteAck: 'Tushundim, o‘chirilsin', deleteBtn: 'Akkauntni o‘chirish',
      forgot: 'Parolni unutdingizmi?', forgotTitle: 'Parolni tiklash', forgotText: 'Pochtangizni kiriting: tiklash havolasini yuboramiz.', sendLink: 'Havola yuborish',
      sentResetText: 'Agar bu pochta ro‘yxatdan o‘tgan bo‘lsa, tiklash havolasi yuborildi. Havola 1 soat amal qiladi. Xat kelmasa, “Spam” papkasini ko‘ring.',
      resend: 'Xatni qayta yuborish', resent: 'Xat qayta yuborildi. “Spam” papkasini ham ko‘ring.', notVerifiedHint: 'Xat kelmadimi?',
      resetTitle: 'Yangi parol', resetBtn: 'Parolni saqlash', resetDoneTitle: 'Parol yangilandi', resetDoneText: 'Xavfsizlik uchun barcha qurilmalardan chiqarildingiz. Yangi parol bilan kiring.',
      needConsent: 'Davom etish uchun uchta majburiy rozilikni belgilang.',
      googleNew: 'Yangi foydalanuvchi bo‘lsangiz, “Ro‘yxatdan o‘tish” bo‘limida rozilik belgilab, Google tugmasini bosing.',
      network: 'Aloqa xatosi. Internetni tekshirib, qayta urinib ko‘ring.', saving: 'Yuborilmoqda…',
      e_state_invalid: 'Kirish seansi eskirgan. Qayta urinib ko‘ring.', e_google_failed: 'Google bilan kirib bo‘lmadi. Qayta urinib ko‘ring.',
      e_google_cancelled: 'Google bilan kirish bekor qilindi.', e_email_unverified: 'Google pochtangiz tasdiqlanmagan.',
      e_consent_required: 'Yangi akkaunt uchun avval “Ro‘yxatdan o‘tish” bo‘limida rozilik belgilang.',
    },
    ru: {
      tagline: 'Объединение помощников-агентов',
      login: 'Вход', register: 'Регистрация',
      email: 'Почта', password: 'Пароль', passwordHint: 'Не менее 10 символов',
      show: 'Показать', hide: 'Скрыть',
      loginBtn: 'Войти', registerBtn: 'Зарегистрироваться', google: 'Продолжить через Google', or: 'или',
      cTerms: 'Я прочитал(а) и принимаю условия использования (оферту)',
      cData: 'Я согласен(на) на обработку моих персональных данных',
      cCross: 'Я согласен(на) на передачу моих данных за границу сервисам искусственного интеллекта (Google, Anthropic, OpenAI)',
      cVoice: 'Я согласен(на) на обработку моих голосовых записей (необязательно)',
      legal: 'Условия и текст согласия (черновик)',
      sentTitle: 'Проверьте почту', sentText: 'Ссылка для подтверждения отправлена. Если письма нет, проверьте папку «Спам». Ссылка действует 24 часа.', back: 'Вернуться ко входу',
      verifying: 'Подтверждаем почту…', verifiedTitle: 'Почта подтверждена', verifiedText: 'Теперь вы можете войти в систему.',
      offlineTitle: 'Нет связи с сервером', offlineText: 'Система аккаунтов сейчас недоступна. Можно продолжить в демо-режиме: данные останутся только на этом устройстве.', demo: 'Продолжить в демо-режиме', retry: 'Повторить',
      account: 'Аккаунт', voiceConsent: 'Согласие на обработку голосовых записей', logout: 'Выйти', close: 'Закрыть',
      deleteTitle: 'Удаление аккаунта', deleteText: 'Аккаунт и все связанные данные будут удалены безвозвратно. Это действие нельзя отменить.', deleteAck: 'Понимаю, удалить', deleteBtn: 'Удалить аккаунт',
      forgot: 'Забыли пароль?', forgotTitle: 'Восстановление пароля', forgotText: 'Введите почту: мы отправим ссылку для восстановления.', sendLink: 'Отправить ссылку',
      sentResetText: 'Если эта почта зарегистрирована, ссылка для восстановления отправлена. Она действует 1 час. Если письма нет, проверьте папку «Спам».',
      resend: 'Отправить письмо повторно', resent: 'Письмо отправлено повторно. Проверьте и папку «Спам».', notVerifiedHint: 'Письмо не пришло?',
      resetTitle: 'Новый пароль', resetBtn: 'Сохранить пароль', resetDoneTitle: 'Пароль обновлён', resetDoneText: 'В целях безопасности вы вышли со всех устройств. Войдите с новым паролем.',
      needConsent: 'Для продолжения отметьте три обязательных согласия.',
      googleNew: 'Если вы новый пользователь, отметьте согласия на вкладке «Регистрация» и нажмите кнопку Google.',
      network: 'Ошибка связи. Проверьте интернет и повторите попытку.', saving: 'Отправка…',
      e_state_invalid: 'Сеанс входа устарел. Повторите попытку.', e_google_failed: 'Не удалось войти через Google. Повторите попытку.',
      e_google_cancelled: 'Вход через Google отменён.', e_email_unverified: 'Ваша почта Google не подтверждена.',
      e_consent_required: 'Для нового аккаунта сначала отметьте согласия на вкладке «Регистрация».',
    },
  };

  const LANG_KEY = 'doda_lang';
  let lang = 'uz';
  try {
    const saved = localStorage.getItem(LANG_KEY);
    lang = saved === 'ru' || saved === 'uz' ? saved : (navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'uz';
  } catch { /* localStorage yo'q bo'lsa ham ishlaydi */ }
  const tr = (k) => I18N[lang][k] ?? k;

  /** Xavfsiz DOM yaratish: foydalanuvchi matni hech qachon innerHTML orqali qo'yilmaydi */
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

  async function api(path, { method = 'GET', body } = {}) {
    try {
      const res = await fetch(API + path, {
        method,
        credentials: 'include',
        headers: { 'Accept-Language': lang, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data, network: false };
    } catch {
      return { status: 0, data: {}, network: true };
    }
  }

  const errText = (r) => (r.network ? tr('network') : r.data?.error?.message || tr('network'));

  /* ---------- holat ---------- */
  let root = null;
  let view = 'login';
  let notice = null; // {kind:'error'|'ok', text}
  let busy = false;
  let user = null;
  let draft = { email: '' };
  let resetToken = null;

  function clearHash() {
    history.replaceState(null, '', location.pathname + location.search);
  }

  function lockApp(locked) {
    const shell = document.querySelector('.shell');
    if (shell) {
      if (locked) shell.setAttribute('inert', '');
      else shell.removeAttribute('inert');
      shell.setAttribute('aria-hidden', locked ? 'true' : 'false');
    }
  }

  function setNotice(n) {
    notice = n;
    const old = root && root.querySelector('.auth-notice');
    if (old) old.replaceWith(noticeEl());
  }

  function setBusy(b) {
    busy = b;
    if (!root) return;
    root.querySelectorAll('.auth-primary, .auth-google').forEach((el) => { el.disabled = b; });
    const card = root.querySelector('.auth-card');
    if (card) card.setAttribute('aria-busy', String(b));
  }

  function ensureRoot() {
    if (!root) {
      root = h('div', { id: 'auth-root', class: 'auth-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'auth-title' });
      document.body.append(root);
    }
    return root;
  }

  function hideAuth() {
    if (root) root.remove();
    root = null;
    lockApp(false);
  }

  function showAuth(next, opts = {}) {
    view = next;
    if (opts.notice !== undefined) notice = opts.notice;
    lockApp(true);
    render();
  }

  /* ---------- qismlar ---------- */
  function langSwitch() {
    return h(
      'div',
      { class: 'auth-lang', role: 'group', 'aria-label': 'Til / Язык' },
      ['uz', 'ru'].map((l) =>
        h('button', { type: 'button', 'aria-pressed': String(l === lang), class: l === lang ? 'on' : '', onclick: () => setLang(l) }, l === 'uz' ? 'O‘zbekcha' : 'Русский'),
      ),
    );
  }

  function setLang(l) {
    lang = l;
    try { localStorage.setItem(LANG_KEY, l); } catch { /* e'tiborsiz */ }
    document.documentElement.lang = l;
    render();
  }

  function head(titleKey) {
    return [
      h('div', { class: 'auth-brand' }, h('div', { class: 'auth-mark', 'aria-hidden': 'true' }, 'D'), h('div', {}, h('strong', {}, 'DODA'), h('small', {}, tr('tagline')))),
      langSwitch(),
      titleKey ? h('h1', { id: 'auth-title', class: 'sr-only' }, tr(titleKey)) : null,
    ];
  }

  function noticeEl() {
    if (!notice) return h('div', { class: 'auth-notice', role: 'status', 'aria-live': 'polite' });
    return h('div', { class: 'auth-notice ' + notice.kind, role: notice.kind === 'error' ? 'alert' : 'status', 'aria-live': 'polite' },
      notice.text,
      notice.action ? h('button', { type: 'button', class: 'auth-linkbtn', onclick: notice.action.onclick }, notice.action.label) : null);
  }

  function field(id, label, attrs) {
    return h('label', { class: 'auth-field', for: id }, h('span', {}, label), h('input', { id, ...attrs }));
  }

  function passwordField(id, autocomplete, hint) {
    const input = h('input', { id, type: 'password', required: true, autocomplete, minlength: hint ? '10' : false, maxlength: '128', 'aria-describedby': hint ? id + '-hint' : false });
    const toggle = h('button', { type: 'button', class: 'auth-peek', 'aria-pressed': 'false', onclick: () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.textContent = show ? tr('hide') : tr('show');
      toggle.setAttribute('aria-pressed', String(show));
    } }, tr('show'));
    return h('div', { class: 'auth-field' }, h('label', { for: id }, h('span', {}, tr('password'))), h('div', { class: 'auth-input-row' }, input, toggle), hint ? h('small', { id: id + '-hint' }, tr('passwordHint')) : null);
  }

  function check(id, text, required) {
    return h('label', { class: 'auth-check' }, h('input', { type: 'checkbox', id, required: required ? true : false }), h('span', {}, text));
  }

  const googleIcon = () => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('fill', 'currentColor');
    p.setAttribute('d', 'M21.35 11.1H12v2.98h5.35c-.23 1.4-1.64 4.1-5.35 4.1a6.1 6.1 0 1 1 0-12.2c1.9 0 3.17.8 3.9 1.5l2.66-2.56A9.9 9.9 0 0 0 12 2a10 10 0 1 0 0 20c5.77 0 9.6-4.05 9.6-9.76 0-.65-.07-1.15-.25-1.14z');
    svg.append(p);
    return svg;
  };

  async function startGoogle(consents) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const r = await api('/api/auth/google/start', { method: 'POST', body: { locale: lang, ...(consents ? { consents } : {}) } });
    if (r.status === 200 && r.data.url) { location.assign(r.data.url); return; }
    setBusy(false);
    setNotice({ kind: 'error', text: errText(r) });
  }

  function readConsents(form) {
    const v = (id) => form.querySelector('#' + id).checked;
    return { terms: v('c-terms'), personalData: v('c-data'), crossBorder: v('c-cross'), voice: v('c-voice') };
  }

  /* ---------- ekranlar ---------- */
  function loginView() {
    const form = h('form', { class: 'auth-form', novalidate: false, onsubmit: onLogin },
      field('l-email', tr('email'), { type: 'email', required: true, autocomplete: 'email', inputmode: 'email', maxlength: '254', value: draft.email }),
      passwordField('l-pass', 'current-password', false),
      h('button', { type: 'button', class: 'auth-linkbtn', onclick: () => { notice = null; showAuth('forgot'); } }, tr('forgot')),
      noticeEl(),
      h('button', { type: 'submit', class: 'auth-primary', disabled: busy }, tr('loginBtn')),
      h('div', { class: 'auth-or' }, h('span', {}, tr('or'))),
      h('button', { type: 'button', class: 'auth-google', disabled: busy, onclick: () => startGoogle(null) }, googleIcon(), tr('google')),
    );
    return [...head('login'), tabs('login'), form];
  }

  function registerView() {
    const form = h('form', { class: 'auth-form', onsubmit: onRegister },
      field('r-email', tr('email'), { type: 'email', required: true, autocomplete: 'email', inputmode: 'email', maxlength: '254', value: draft.email }),
      passwordField('r-pass', 'new-password', true),
      h('fieldset', { class: 'auth-consents' },
        h('legend', { class: 'sr-only' }, tr('register')),
        check('c-terms', tr('cTerms'), true),
        check('c-data', tr('cData'), true),
        check('c-cross', tr('cCross'), true),
        check('c-voice', tr('cVoice'), false),
        h('a', { class: 'auth-legal', href: './legal.html', target: '_blank', rel: 'noopener' }, tr('legal')),
      ),
      noticeEl(),
      h('button', { type: 'submit', class: 'auth-primary', disabled: busy }, tr('registerBtn')),
      h('div', { class: 'auth-or' }, h('span', {}, tr('or'))),
      h('button', { type: 'button', class: 'auth-google', disabled: busy, onclick: () => {
        const c = readConsents(form);
        if (!(c.terms && c.personalData && c.crossBorder)) { setNotice({ kind: 'error', text: tr('needConsent') }); return; }
        startGoogle(c);
      } }, googleIcon(), tr('google')),
    );
    return [...head('register'), tabs('register'), form];
  }

  function tabs(active) {
    const tab = (id, label) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(active === id), class: active === id ? 'on' : '', onclick: () => { notice = null; showAuth(id); } }, label);
    return h('div', { class: 'auth-tabs', role: 'tablist' }, tab('login', tr('login')), tab('register', tr('register')));
  }

  function forgotView() {
    const form = h('form', { class: 'auth-form', onsubmit: onForgot },
      h('h2', { class: 'auth-h2' }, tr('forgotTitle')),
      h('p', { class: 'auth-p' }, tr('forgotText')),
      field('f-email', tr('email'), { type: 'email', required: true, autocomplete: 'email', inputmode: 'email', maxlength: '254', value: draft.email }),
      noticeEl(),
      h('button', { type: 'submit', class: 'auth-primary' }, tr('sendLink')),
      h('button', { type: 'button', class: 'auth-secondary', onclick: () => { notice = null; showAuth('login'); } }, tr('back')),
    );
    return [...head('forgotTitle'), form];
  }

  function resetView() {
    const form = h('form', { class: 'auth-form', onsubmit: onReset },
      h('h2', { class: 'auth-h2' }, tr('resetTitle')),
      passwordField('n-pass', 'new-password', true),
      noticeEl(),
      h('button', { type: 'submit', class: 'auth-primary' }, tr('resetBtn')),
    );
    return [...head('resetTitle'), form];
  }

  function sentView(textKey) {
    return [...head('sentTitle'), h('div', { class: 'auth-message' },
      h('h2', {}, tr('sentTitle')), h('p', {}, tr(textKey)), noticeEl(),
      h('div', { class: 'auth-actions' },
        textKey === 'sentText' ? h('button', { type: 'button', class: 'auth-secondary', onclick: (e) => resend(e.currentTarget) }, tr('resend')) : null,
        h('button', { class: 'auth-primary', onclick: () => showAuth('login', { notice: null }) }, tr('back'))))];
  }

  function messageView(titleKey, textKey, actions) {
    return [...head(titleKey), h('div', { class: 'auth-message' }, h('h2', {}, tr(titleKey)), h('p', {}, tr(textKey)), actions)];
  }

  function render() {
    ensureRoot();
    let body;
    if (view === 'register') body = registerView();
    else if (view === 'sent') body = sentView('sentText');
    else if (view === 'sentReset') body = sentView('sentResetText');
    else if (view === 'forgot') body = forgotView();
    else if (view === 'reset') body = resetView();
    else if (view === 'resetDone') body = messageView('resetDoneTitle', 'resetDoneText', h('button', { class: 'auth-primary', onclick: () => showAuth('login', { notice: null }) }, tr('loginBtn')));
    else if (view === 'verifying') body = [...head('verifying'), h('div', { class: 'auth-message' }, h('p', { role: 'status' }, tr('verifying')))];
    else if (view === 'verified') body = messageView('verifiedTitle', 'verifiedText', h('button', { class: 'auth-primary', onclick: () => showAuth('login', { notice: null }) }, tr('loginBtn')));
    else if (view === 'offline') body = messageView('offlineTitle', 'offlineText', h('div', { class: 'auth-actions' },
      h('button', { class: 'auth-primary', onclick: hideAuth }, tr('demo')),
      h('button', { class: 'auth-secondary', onclick: boot }, tr('retry'))));
    else body = loginView();

    const card = h('div', { class: 'auth-card' }, body);
    root.replaceChildren(card);
    const first = card.querySelector('input:not([type=checkbox]), .auth-primary');
    // Telefonda avtofokus klaviaturani o'zi ochib yuboradi, shuning uchun faqat sichqonchali qurilmalarda
    const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (fine && first && ['login', 'register', 'forgot', 'reset'].includes(view)) first.focus({ preventScroll: true });
  }

  /* ---------- harakatlar ---------- */
  async function onLogin(e) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    draft.email = form.querySelector('#l-email').value.trim();
    setBusy(true); setNotice(null);
    const r = await api('/api/auth/login', { method: 'POST', body: { email: draft.email, password: form.querySelector('#l-pass').value } });
    setBusy(false);
    if (r.status === 200) { onLoggedIn(r.data.user); return; }
    const notVerified = r.data?.error?.code === 'email_not_verified';
    setNotice({ kind: 'error', text: errText(r), action: notVerified ? { label: tr('resend'), onclick: () => resend(null) } : undefined });
  }

  async function onRegister(e) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const c = readConsents(form);
    draft.email = form.querySelector('#r-email').value.trim();
    if (!(c.terms && c.personalData && c.crossBorder)) { setNotice({ kind: 'error', text: tr('needConsent') }); return; }
    const password = form.querySelector('#r-pass').value;
    setBusy(true); setNotice(null);
    const r = await api('/api/auth/register', { method: 'POST', body: { email: draft.email, password, locale: lang, consents: c } });
    setBusy(false);
    if (r.status === 202) { showAuth('sent'); return; }
    setNotice({ kind: 'error', text: errText(r) });
  }

  async function resend(btn) {
    if (!draft.email) { showAuth('login'); return; }
    if (btn) btn.disabled = true;
    const r = await api('/api/auth/resend-verification', { method: 'POST', body: { email: draft.email } });
    if (btn) btn.disabled = false;
    setNotice(r.status === 202 ? { kind: 'ok', text: tr('resent') } : { kind: 'error', text: errText(r) });
  }

  async function onForgot(e) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    draft.email = form.querySelector('#f-email').value.trim();
    setBusy(true); setNotice(null);
    const r = await api('/api/auth/forgot', { method: 'POST', body: { email: draft.email } });
    setBusy(false);
    if (r.status === 202) { showAuth('sentReset', { notice: null }); return; }
    setNotice({ kind: 'error', text: errText(r) });
  }

  async function onReset(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setNotice(null);
    const r = await api('/api/auth/reset', { method: 'POST', body: { token: resetToken, password: e.currentTarget.querySelector('#n-pass').value } });
    setBusy(false);
    if (r.status === 200) { resetToken = null; showAuth('resetDone', { notice: null }); return; }
    setNotice({ kind: 'error', text: errText(r) });
  }

  /* ---------- akkaunt oynasi ---------- */
  function initials(email) {
    const name = (email || '?').split('@')[0].replace(/[^a-zA-Z0-9А-Яа-я]/g, '');
    return (name.slice(0, 2) || '?').toUpperCase();
  }

  function applyUser() {
    const ini = initials(user.email);
    const av = document.querySelector('.top-avatar');
    const pr = document.querySelector('.profile');
    if (av) { av.textContent = ini; av.title = user.email; }
    if (pr) {
      const box = pr.querySelector('div');
      const b = pr.querySelector('b');
      if (box) box.textContent = ini;
      if (b) b.textContent = user.email.split('@')[0];
    }
    for (const el of [av, pr]) {
      if (el && !el.dataset.acc) {
        el.dataset.acc = '1';
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', tr('account'));
        el.addEventListener('click', openAccount);
        el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openAccount(); } });
      }
    }
  }

  function onLoggedIn(u) {
    user = u;
    notice = null;
    draft = { email: '' };
    hideAuth();
    applyUser();
  }

  async function openAccount() {
    document.getElementById('acc-dialog')?.remove();
    const me = await api('/api/auth/me');
    if (me.status !== 200) { showAuth('login'); return; }
    const dlg = h('dialog', { id: 'acc-dialog', class: 'modal small-modal acc-dialog', 'aria-labelledby': 'acc-title' });
    const voice = h('input', { type: 'checkbox', id: 'acc-voice' });
    voice.checked = me.data.consents?.voice?.accepted === true;
    voice.addEventListener('change', async () => { voice.disabled = true; await api('/api/account/consents', { method: 'POST', body: { type: 'voice', accepted: voice.checked } }); voice.disabled = false; });

    const ack = h('input', { type: 'checkbox', id: 'acc-ack' });
    const del = h('button', { class: 'auth-danger', disabled: true, onclick: async () => {
      del.disabled = true;
      const r = await api('/api/account', { method: 'DELETE' });
      if (r.status === 200) { dlg.close(); user = null; showAuth('login', { notice: null }); } else { del.disabled = false; err.textContent = errText(r); }
    } }, tr('deleteBtn'));
    ack.addEventListener('change', () => { del.disabled = !ack.checked; });
    const err = h('div', { class: 'auth-notice error', role: 'alert' });

    dlg.append(
      h('div', { class: 'modal-head' }, h('div', {}, h('span', { class: 'section-kicker' }, tr('account').toUpperCase()), h('h2', { id: 'acc-title' }, user.email)),
        h('button', { class: 'close-button', 'aria-label': tr('close'), onclick: () => dlg.close() }, '×')),
      h('label', { class: 'auth-check' }, voice, h('span', {}, tr('voiceConsent'))),
      h('div', { class: 'auth-actions' },
        h('button', { class: 'auth-secondary', onclick: async () => { await api('/api/auth/logout', { method: 'POST', body: {} }); dlg.close(); user = null; showAuth('login', { notice: null }); } }, tr('logout'))),
      h('details', { class: 'auth-delete' }, h('summary', {}, tr('deleteTitle')), h('p', {}, tr('deleteText')),
        h('label', { class: 'auth-check' }, ack, h('span', {}, tr('deleteAck'))), err, del),
    );
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
  }

  /* ---------- ishga tushirish ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#/, '');
    const [path, query = ''] = raw.split('?');
    return { path, params: new URLSearchParams(query) };
  }

  async function boot() {
    document.documentElement.lang = lang;
    const { path, params } = parseHash();
    let startNotice = null;
    let startView = 'login';

    if (path === '/reset' && params.get('token')) {
      resetToken = params.get('token');
      clearHash();
      showAuth('reset', { notice: null });
      return;
    }

    if (path === '/verify' && params.get('token')) {
      lockApp(true); showAuth('verifying');
      const r = await api('/api/auth/verify-email', { method: 'POST', body: { token: params.get('token') } });
      clearHash();
      if (r.status === 200) startView = 'verified';
      else startNotice = { kind: 'error', text: errText(r) };
    } else if (path === '/auth/error') {
      const code = params.get('code') || '';
      startNotice = { kind: 'error', text: I18N[lang]['e_' + code] || tr('network') };
      clearHash();
    } else if (path === '/auth/done') {
      clearHash();
    }

    const me = await api('/api/auth/me');
    if (me.network) { showAuth('offline'); return; }
    if (me.status === 200) { onLoggedIn(me.data.user); return; }
    if (startView === 'verified') { notice = null; showAuth('verified'); return; }
    showAuth(startView, { notice: startNotice });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

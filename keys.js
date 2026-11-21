/* DODA: foydalanuvchining shaxsiy AI kalitlari (BYOK). window.DODA_KEYS = { mount, unmount }.
   Kalit serverga faqat shu yerda yuboriladi; server uni shifrlab saqlaydi va hech qachon qaytarmaydi (faqat oxirgi 4 belgi). */
(() => {
  'use strict';
  const D = () => window.DODA || {};
  const lang = () => (D().getLang ? D().getLang() : 'uz');
  const T = {
    uz: {
      title: 'AI kalitlari',
      intro: 'DODA sizning o‘z AI hisobingiz bilan ishlaydi: har bir so‘rov faqat sizning kalitingiz bilan yuboriladi va barcha token sarfi to‘g‘ridan-to‘g‘ri sizning shaxsiy provayder hisobingizdan yechiladi. Kamida bittasini ulang.',
      secure: 'Kalit serverda shifrlangan holda saqlanadi, chatda va jurnallarda ko‘rinmaydi, boshqa foydalanuvchilarga berilmaydi. Istalgan vaqtda o‘chira olasiz.',
      noStorage: 'Serverda kalit saqlash sozlanmagan (administrator KEYS_SECRET ni yaratishi kerak).',
      connected: 'Ulangan', notConnected: 'Ulanmagan', invalid: 'Yaroqsiz: almashtiring',
      getKey: 'Kalit olish', paste: 'Kalitni shu yerga qo‘ying', save: 'Tekshirib saqlash', saveNoCheck: 'Tekshirmasdan saqlash', replace: 'Almashtirish', remove: 'O‘chirish', sure: 'Aniq o‘chiraman',
      saving: 'Tekshirilmoqda…', saved: 'Saqlandi', savedQuota: 'Saqlandi. Kalit to‘g‘ri, lekin hozir limit tugagan.', savedUnchecked: 'Saqlandi (tekshirilmadi).', removed: 'O‘chirildi', netErr: 'Aloqa xatosi.',
      usage: 'Shu oydagi sarf (sizning hisobingizdan)', total: 'Jami', tokens: 'token', none: 'Hozircha sarf yo‘q.',
      claude: 'Claude (Anthropic)', gemini: 'Google Gemini', openai: 'OpenAI',
      claudeD: 'Matn, tahlil, kod. Ovozni matnga aylantirmaydi.', geminiD: 'Matn va ovozni matnga aylantirish.', openaiD: 'Matn va ovozni matnga aylantirish.',
      billing: 'To‘lov va limitlar provayderning o‘z sahifasida boshqariladi.',
    },
    ru: {
      title: 'Ключи ИИ',
      intro: 'DODA работает с вашим собственным аккаунтом ИИ: каждый запрос отправляется только с вашим ключом, а весь расход токенов списывается напрямую с вашего личного счёта у провайдера. Подключите хотя бы один.',
      secure: 'Ключ хранится на сервере в зашифрованном виде, не показывается в чате и журналах и не передаётся другим пользователям. Вы можете удалить его в любой момент.',
      noStorage: 'Хранение ключей на сервере не настроено (администратор должен создать KEYS_SECRET).',
      connected: 'Подключён', notConnected: 'Не подключён', invalid: 'Недействителен: замените',
      getKey: 'Получить ключ', paste: 'Вставьте ключ сюда', save: 'Проверить и сохранить', saveNoCheck: 'Сохранить без проверки', replace: 'Заменить', remove: 'Удалить', sure: 'Точно удалить',
      saving: 'Проверяю…', saved: 'Сохранено', savedQuota: 'Сохранено. Ключ верный, но сейчас лимит исчерпан.', savedUnchecked: 'Сохранено (без проверки).', removed: 'Удалено', netErr: 'Ошибка связи.',
      usage: 'Расход в этом месяце (с вашего счёта)', total: 'Всего', tokens: 'токенов', none: 'Расходов пока нет.',
      claude: 'Claude (Anthropic)', gemini: 'Google Gemini', openai: 'OpenAI',
      claudeD: 'Текст, анализ, код. Не преобразует голос в текст.', geminiD: 'Текст и преобразование голоса в текст.', openaiD: 'Текст и преобразование голоса в текст.',
      billing: 'Оплата и лимиты управляются на странице самого провайдера.',
    },
  };
  const tr = (k) => T[lang()][k] ?? k;
  const META = {
    anthropic: { name: 'claude', desc: 'claudeD', url: 'https://console.anthropic.com/settings/keys', ph: 'sk-ant-…' },
    gemini: { name: 'gemini', desc: 'geminiD', url: 'https://aistudio.google.com/apikey', ph: 'AIza…' },
    openai: { name: 'openai', desc: 'openaiD', url: 'https://platform.openai.com/api-keys', ph: 'sk-…' },
  };
  let box = null;

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
      const res = await fetch(D().API + path, {
        method, credentials: 'include',
        headers: { 'Accept-Language': lang(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, data: await res.json().catch(() => ({})) };
    } catch { return { status: 0, data: {} }; }
  }
  const errText = (r) => (r.data && r.data.error && r.data.error.message) || tr('netErr');
  const money = (n) => '$' + (n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2));
  const changed = () => document.dispatchEvent(new CustomEvent('doda:keys'));

  function card(p, reload) {
    const m = META[p.id];
    const input = h('input', { class: 'ky-in', type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: '400', placeholder: tr('paste'), 'aria-label': tr(m.name) + ': ' + tr('paste'), name: 'k-' + p.id });
    const msg = h('div', { class: 'tk-msg ky-msg', role: 'status', 'aria-live': 'polite' });
    const save = h('button', { type: 'button', class: 'tk-btn primary' }, p.connected ? tr('replace') : tr('save'));
    const noCheck = h('button', { type: 'button', class: 'ky-link' }, tr('saveNoCheck'));
    const busy = (b) => { save.disabled = noCheck.disabled = b; input.disabled = b; };

    const submit = async (verify) => {
      const key = input.value.trim();
      if (!key) { input.focus(); return; }
      busy(true); msg.className = 'tk-msg ky-msg'; msg.textContent = verify ? tr('saving') : '';
      const r = await api('/api/keys/' + p.id, { method: 'PUT', body: { key, verify } });
      busy(false);
      if (r.status === 200) {
        input.value = '';
        const w = r.data.warning;
        changed();
        await reload(w === 'quota' ? tr('savedQuota') : w === 'unverified' ? tr('savedUnchecked') : tr('saved'), p.id);
      } else { msg.textContent = errText(r); }
    };
    save.addEventListener('click', () => submit(true));
    noCheck.addEventListener('click', () => submit(false));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(true); } });

    const del = h('button', { type: 'button', class: 'tk-btn danger small' }, tr('remove'));
    del.addEventListener('click', async () => {
      if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = tr('sure'); return; }
      await api('/api/keys/' + p.id, { method: 'DELETE' });
      changed();
      await reload(tr('removed'), p.id);
    });

    const status = !p.connected ? h('span', { class: 'ky-badge off' }, tr('notConnected'))
      : p.status === 'invalid' ? h('span', { class: 'ky-badge bad' }, tr('invalid'))
      : h('span', { class: 'ky-badge on' }, tr('connected') + ' · ····' + p.last4);

    return h('section', { class: 'ky-card' + (p.connected ? ' on' : ''), 'data-provider': p.id },
      h('div', { class: 'ky-head' }, h('div', {}, h('div', { class: 'ky-name' }, tr(m.name)), h('div', { class: 'tk-muted' }, tr(m.desc))), status),
      h('div', { class: 'ky-row' }, input, save),
      h('div', { class: 'ky-foot' }, h('a', { href: m.url, target: '_blank', rel: 'noopener noreferrer', class: 'ky-link' }, tr('getKey') + ' ↗'), noCheck, p.connected ? del : null),
      msg);
  }

  async function render(flash, focusId) {
    if (!box) return;
    const [k, u] = await Promise.all([api('/api/keys'), api('/api/usage')]);
    if (!box) return;
    const providers = k.status === 200 ? k.data.providers : [];
    const usage = u.status === 200 ? u.data : null;
    const rows = usage ? ['anthropic', 'gemini', 'openai'].filter((id) => usage.byProvider[id].usd > 0 || usage.byProvider[id].tokensIn > 0) : [];
    box.replaceChildren(...[
      h('p', { class: 'tk-goal-txt' }, tr('intro')),
      h('p', { class: 'ky-secure' }, '🔒 ' + tr('secure')),
      k.status === 200 && !k.data.storageReady ? h('p', { class: 'tk-msg' }, tr('noStorage')) : null,
      flash ? h('div', { class: 'ky-flash', role: 'status' }, flash) : null,
      h('div', { class: 'ky-cards' }, providers.map((p) => card(p, render))),
      h('p', { class: 'tk-muted' }, tr('billing')),
      h('h2', {}, tr('usage')),
      usage && rows.length
        ? h('div', { class: 'ky-usage' },
            rows.map((id) => h('div', { class: 'ky-urow' }, h('span', {}, tr(META[id].name)), h('span', { class: 'tk-muted' }, `${(usage.byProvider[id].tokensIn + usage.byProvider[id].tokensOut).toLocaleString('en-US')} ${tr('tokens')}`), h('b', {}, money(usage.byProvider[id].usd)))),
            h('div', { class: 'ky-urow total' }, h('span', {}, tr('total')), h('span', {}), h('b', {}, money(usage.ownUsd))))
        : h('p', { class: 'tk-muted' }, tr('none')),
    ].filter(Boolean));
    if (focusId) { const el = box.querySelector(`[data-provider="${focusId}"] .ky-in`); if (el && !flash) el.focus(); }
  }

  function mount(container, opts = {}) {
    unmount();
    box = h('div', { class: 'tk' });
    container.append(box);
    render('', opts.focus);
  }
  function unmount() { if (box) box.remove(); box = null; }
  window.DODA_KEYS = { mount, unmount };
})();

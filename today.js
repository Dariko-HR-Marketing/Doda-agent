/* DODA: "Bugun" paneli. Hamma ro'yxatlar, faol vazifalar, agentlar va oxirgi ishlar bir joyda. window.DODA_TODAY = { mount, unmount } */
(() => {
  'use strict';
  const D = () => window.DODA || {};
  const lang = () => (D().getLang ? D().getLang() : 'uz');
  const T = {
    uz: {
      attn: 'Diqqat talab qiladi', overdue: 'Kechikkan', today: 'Bugun', open: 'Ochiq', none: 'Hozircha shoshilinch ish yo‘q.', quick: 'Bugunga vazifa qo‘shish…', add: 'Qo‘shish',
      tasks: 'Faol vazifalar', noTasks: 'Faol vazifa yo‘q.', agents: 'Agentlar', noAgents: 'Agent yo‘q: Agentlar bo‘limida yarating.', runs: 'So‘nggi ishlar', noRuns: 'Hali ish bajarilmagan.',
      usage: 'Shu oydagi sarf', usageD: 'sizning provayder hisobingizdan', doda: 'DODA', priority: 'Muhim', ok: 'yaxshi', needs: 'yaxshilash kerak', unchecked: 'tekshirilmadi', netErr: 'Aloqa xatosi.', openN: 'ochiq', late: 'Kechikdi',
    },
    ru: {
      attn: 'Требует внимания', overdue: 'Просрочено', today: 'Сегодня', open: 'Открыто', none: 'Срочных дел пока нет.', quick: 'Добавить задачу на сегодня…', add: 'Добавить',
      tasks: 'Активные задачи', noTasks: 'Активных задач нет.', agents: 'Агенты', noAgents: 'Агентов нет: создайте в разделе «Агенты».', runs: 'Последние работы', noRuns: 'Работ пока нет.',
      usage: 'Расход в этом месяце', usageD: 'с вашего счёта у провайдера', doda: 'DODA', priority: 'Важно', ok: 'хорошо', needs: 'нужно доработать', unchecked: 'не проверено', netErr: 'Ошибка связи.', openN: 'открыто', late: 'Просрочено',
    },
  };
  const tr = (k) => T[lang()][k] ?? k;
  let box = null;

  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
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
  const pad2 = (n) => String(n).padStart(2, '0');
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const shortDate = (s) => { const [, m, d] = s.split('-'); return `${d}.${m}`; };
  const openIn = (kind, agent) => document.dispatchEvent(new CustomEvent('doda:open', { detail: { kind, agent } }));
  const ago = (ts) => {
    const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return lang() === 'ru' ? 'только что' : 'hozirgina';
    if (m < 60) return m + (lang() === 'ru' ? ' мин' : ' daq');
    const hr = Math.round(m / 60);
    if (hr < 24) return hr + (lang() === 'ru' ? ' ч' : ' soat');
    return Math.round(hr / 24) + (lang() === 'ru' ? ' дн' : ' kun');
  };
  const money = (n) => '$' + (n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2));
  const section = (title, ...kids) => h('section', { class: 'td-sec', 'data-st': '1' }, h('h4', { class: 'ag-h4' }, title), ...kids);
  const stat = (n, label, cls = '') => h('div', { class: 'td-stat ' + cls }, h('b', {}, String(n)), h('span', {}, label));

  async function load() {
    if (!box) return;
    const r = await api('/api/today?d=' + todayStr());
    if (!box) return;
    if (r.status !== 200) { box.replaceChildren(h('p', { class: 'ag-msg' }, tr('netErr'))); return; }
    const d = r.data;
    const now = todayStr();
    const dt = new Date();
    const WD = { uz: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'], ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'] };
    const MO = { uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'], ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'] };
    const L = lang() === 'ru' ? 'ru' : 'uz';
    const dateTxt = L === 'ru' ? `${WD.ru[dt.getDay()]}, ${dt.getDate()} ${MO.ru[dt.getMonth()]}` : `${WD.uz[dt.getDay()]}, ${dt.getDate()}-${MO.uz[dt.getMonth()]}`;

    // diqqat ro'yxati
    const list = h('ul', { class: 'ag-todos' });
    const paint = (items) => list.replaceChildren(...(items.length ? items.map((t) => {
      const cb = h('button', { type: 'button', role: 'checkbox', 'aria-checked': 'false', class: 'ag-cb', 'aria-label': t.text }, h('span', { class: 'ag-tick' }, '✓'));
      const li = h('li', { class: 'ag-td in' }, cb, h('span', { class: 'ag-td-t' }, t.text),
        t.due ? h('i', { class: 'ag-due' + (t.due < now ? ' late' : t.due === now ? ' today' : '') }, (t.repeat !== 'none' ? '↻ ' : '') + (t.due === now ? tr('today') : t.due < now ? tr('late') + ' · ' + shortDate(t.due) : shortDate(t.due))) : null,
        t.priority ? h('i', { class: 'ag-due today' }, '★') : null,
        h('button', { type: 'button', class: 'ag-lk', onclick: () => (t.agentId ? openIn('agents', t.agentId) : openIn('agents')) }, t.agentName || tr('doda')));
      cb.addEventListener('click', async () => {
        cb.classList.add('on'); li.classList.add('done');
        const x = await api('/api/todos/' + t.id, { method: 'PATCH', body: { done: true, today: now } });
        if (x.status === 200) setTimeout(load, 350); else { cb.classList.remove('on'); li.classList.remove('done'); }
      });
      return li;
    }) : [h('li', { class: 'ag-empty' }, tr('none'))]));
    paint(d.attention);

    const input = h('input', { class: 'ag-in', maxlength: '300', placeholder: tr('quick'), 'aria-label': tr('quick') });
    const addBtn = h('button', { type: 'button', class: 'ag-btn pri' }, tr('add'));
    const submit = async () => { const text = input.value.trim(); if (!text) { input.focus(); return; } const x = await api('/api/todos', { method: 'POST', body: { agent: 'doda', text, due: now } }); if (x.status === 201) { input.value = ''; load(); } };
    addBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); } });

    const tasks = d.tasks.length ? h('div', { class: 'td-rows' }, d.tasks.map((t) => {
      const p = t.total ? Math.round((t.done / t.total) * 100) : 0;
      return h('button', { type: 'button', class: 'td-row', onclick: () => openIn('tasks') }, h('span', { class: 'td-row-t' }, t.title), h('span', { class: 'ag-muted' }, `${t.done}/${t.total}`), h('span', { class: 'tk-bar' }, h('i', { style: `width:${p}%` })));
    })) : h('p', { class: 'ag-empty left' }, tr('noTasks'));

    const agents = d.agents.length ? h('div', { class: 'ag-grid td-agents' }, d.agents.map((a) => h('button', { type: 'button', class: 'ag-card', onclick: () => openIn('agents', a.id) }, h('span', { class: 'ag-dot' }), h('b', {}, a.name), h('span', { class: 'ag-chips' }, h('i', { class: 'ag-chip' }, `${a.openTodos} ${tr('openN')}`), a.lastRun ? h('i', { class: 'ag-chip' }, ago(a.lastRun)) : null)))) : h('p', { class: 'ag-empty left' }, tr('noAgents'));

    const runs = d.runs.length ? h('div', { class: 'td-rows' }, d.runs.map((x) => h('button', { type: 'button', class: 'td-row run', onclick: () => openIn('agents', x.agentId) }, h('b', {}, x.agentName), h('span', { class: 'td-row-t' }, x.request), h('i', { class: 'ag-v ' + x.verdict }, tr(x.verdict === 'needs_work' ? 'needs' : x.verdict)), h('span', { class: 'ag-muted' }, ago(x.createdAt))))) : h('p', { class: 'ag-empty left' }, tr('noRuns'));

    box.replaceChildren(h('div', { class: 'ag' },
      h('div', { class: 'td-head', 'data-st': '1' }, h('h3', { class: 'ag-h' }, dateTxt), h('div', { class: 'td-stats' }, stat(d.counts.overdue, tr('overdue'), d.counts.overdue ? 'late' : ''), stat(d.counts.today, tr('today'), d.counts.today ? 'today' : ''), stat(d.counts.open, tr('open')))),
      section(tr('attn'), h('div', { class: 'ag-addrow' }, input, addBtn), list),
      section(tr('tasks'), tasks), section(tr('agents'), agents), section(tr('runs'), runs),
      h('p', { class: 'ag-muted td-usage', 'data-st': '1' }, `${tr('usage')}: ${money(d.usage.monthUsd)} · ${tr('usageD')}`)));
    [...box.querySelectorAll('[data-st]')].forEach((el, i) => el.style.setProperty('--i', String(i)));
  }

  function mount(container) { unmount(); box = h('div', { class: 'agroot' }, h('div', { class: 'ag-muted' }, '…')); container.append(box); load(); }
  function unmount() { if (box) box.remove(); box = null; }
  window.DODA_TODAY = { mount, unmount };
})();

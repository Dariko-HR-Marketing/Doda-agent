/* DODA: vazifalar (pasport: maqsad, 5 bosqich, checklist). window.DODA_TASKS = { mount, unmount } */
(() => {
  'use strict';
  const D = () => window.DODA || {};
  const lang = () => (D().getLang ? D().getLang() : 'uz');
  const T = {
    uz: {
      title: 'Vazifalar', newTask: 'Yangi vazifa', empty: 'Hali vazifa yo‘q. Maqsadni yozing, DODA reja tuzib beradi.',
      goalPh: 'Maqsadni yozing. Masalan: “Kompaniyam uchun sayt ochmoqchiman, byudjet 5 mln so‘m”', plan: 'DODA reja tuzsin', planning: 'Reja tuzilmoqda…',
      blank: 'Bo‘sh vazifa', back: 'Orqaga', stage: 'bosqich', addItem: 'Qadam qo‘shish…', add: 'Qo‘shish', done: 'Bajarildi deb belgilash', reopen: 'Qayta ochish',
      archive: 'Arxivlash', del: 'O‘chirish', sure: 'Aniq o‘chiraman', goal: 'Maqsad', progress: 'bajarildi', statusDone: 'Bajarilgan', netErr: 'Aloqa xatosi.', rm: 'Olib tashlash',
    },
    ru: {
      title: 'Задачи', newTask: 'Новая задача', empty: 'Задач пока нет. Опишите цель, и DODA составит план.',
      goalPh: 'Опишите цель. Например: «Хочу открыть сайт для компании, бюджет 5 млн сум»', plan: 'DODA, составь план', planning: 'Составляю план…',
      blank: 'Пустая задача', back: 'Назад', stage: 'этап', addItem: 'Добавить шаг…', add: 'Добавить', done: 'Отметить выполненной', reopen: 'Открыть снова',
      archive: 'В архив', del: 'Удалить', sure: 'Точно удалить', goal: 'Цель', progress: 'выполнено', statusDone: 'Выполнено', netErr: 'Ошибка связи.', rm: 'Убрать',
    },
  };
  const tr = (k) => T[lang()][k] ?? k;

  let box = null;
  let cur = null; // ochiq vazifa

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
  const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);

  function bar(done, total) {
    const p = pct(done, total);
    return h('div', { class: 'tk-bar', role: 'progressbar', 'aria-valuenow': String(p), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: `width:${p}%` }));
  }

  /* ---------- ro'yxat ---------- */
  async function showList() {
    cur = null;
    if (!box) return;
    box.replaceChildren(h('div', { class: 'tk-muted' }, '…'));
    const r = await api('/api/tasks');
    if (!box || cur) return;
    const tasks = r.status === 200 ? r.data.tasks : [];

    const goal = h('textarea', { class: 'tk-goal', rows: '3', maxlength: '2000', placeholder: tr('goalPh'), 'aria-label': tr('newTask') });
    const msg = h('div', { class: 'tk-msg', role: 'status', 'aria-live': 'polite' });
    const planBtn = h('button', { type: 'button', class: 'tk-btn primary' }, tr('plan'));
    const blankBtn = h('button', { type: 'button', class: 'tk-btn' }, tr('blank'));
    planBtn.addEventListener('click', async () => {
      const g = goal.value.trim();
      if (g.length < 5) { goal.focus(); return; }
      planBtn.disabled = blankBtn.disabled = true; planBtn.textContent = tr('planning'); msg.textContent = '';
      const res = await api('/api/tasks/plan', { method: 'POST', body: { goal: g } });
      if (res.status === 201) showTask(res.data.task);
      else { msg.textContent = errText(res); planBtn.disabled = blankBtn.disabled = false; planBtn.textContent = tr('plan'); }
    });
    blankBtn.addEventListener('click', async () => {
      const g = goal.value.trim();
      const res = await api('/api/tasks', { method: 'POST', body: { title: (g || tr('newTask')).slice(0, 120), goal: g } });
      if (res.status === 201) showTask(res.data.task); else msg.textContent = errText(res);
    });

    box.replaceChildren(
      h('div', { class: 'tk-new' }, h('h2', {}, tr('newTask')), goal, h('div', { class: 'tk-row' }, planBtn, blankBtn), msg),
      tasks.length
        ? h('ul', { class: 'tk-list' }, tasks.map((t) => h('li', {},
            h('button', { type: 'button', class: 'tk-card' + (t.status === 'done' ? ' done' : ''), onclick: () => openTask(t.id) },
              h('span', { class: 'tk-card-t' }, t.title),
              h('span', { class: 'tk-card-m' }, `${t.done}/${t.total} ${tr('progress')}` + (t.status === 'done' ? ' · ' + tr('statusDone') : '')),
              bar(t.done, t.total)))))
        : h('p', { class: 'tk-muted' }, tr('empty')),
    );
  }

  async function openTask(id) {
    const r = await api('/api/tasks/' + encodeURIComponent(id));
    if (r.status === 200) showTask(r.data.task);
  }

  /* ---------- vazifa pasporti ---------- */
  function showTask(t) {
    if (!box) return;
    cur = t;
    const total = t.stages.reduce((n, s) => n + s.items.length, 0);
    const done = t.stages.reduce((n, s) => n + s.items.filter((i) => i.done).length, 0);
    const update = (task) => showTask(task);

    const title = h('input', { class: 'tk-title', value: t.title, maxlength: '120', 'aria-label': tr('title') });
    title.addEventListener('change', async () => {
      const v = title.value.trim();
      if (!v) { title.value = t.title; return; }
      const r = await api('/api/tasks/' + t.id, { method: 'PATCH', body: { title: v } });
      if (r.status === 200) cur = r.data.task;
    });

    const stageEls = t.stages.map((s) => {
      const name = h('input', { class: 'tk-stage-name', value: s.name, maxlength: '60', 'aria-label': tr('stage') + ' ' + s.stage });
      name.addEventListener('change', async () => {
        const v = name.value.trim();
        if (!v) { name.value = s.name; return; }
        await api('/api/tasks/' + t.id, { method: 'PATCH', body: { stages: [{ stage: s.stage, name: v }] } });
      });
      const input = h('input', { class: 'tk-add-in', placeholder: tr('addItem'), maxlength: '300', 'aria-label': tr('addItem') });
      const add = async () => {
        const v = input.value.trim();
        if (!v) return;
        input.disabled = true;
        const r = await api(`/api/tasks/${t.id}/items`, { method: 'POST', body: { stage: s.stage, text: v } });
        if (r.status === 201) update(r.data.task); else input.disabled = false;
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); add(); } });
      const sd = s.items.filter((i) => i.done).length;
      return h('section', { class: 'tk-stage' },
        h('div', { class: 'tk-stage-head' }, h('span', { class: 'tk-num' }, String(s.stage)), name, h('span', { class: 'tk-muted' }, s.items.length ? `${sd}/${s.items.length}` : '')),
        h('ul', { class: 'tk-items' }, s.items.map((i) => {
          const cb = h('input', { type: 'checkbox', id: 'tki' + i.id, checked: i.done });
          cb.addEventListener('change', async () => {
            const r = await api('/api/tasks/items/' + i.id, { method: 'PATCH', body: { done: cb.checked } });
            if (r.status === 200) update(r.data.task); else cb.checked = !cb.checked;
          });
          const rm = h('button', { type: 'button', class: 'tk-x', 'aria-label': tr('rm'), title: tr('rm') }, '×');
          rm.addEventListener('click', async () => { const r = await api('/api/tasks/items/' + i.id, { method: 'DELETE' }); if (r.status === 200) update(r.data.task); });
          return h('li', { class: i.done ? 'done' : '' }, cb, h('label', { for: 'tki' + i.id }, i.text), rm);
        })),
        input);
    });

    const setStatus = async (status) => { const r = await api('/api/tasks/' + t.id, { method: 'PATCH', body: { status } }); if (r.status === 200) { if (status === 'archived') showList(); else update(r.data.task); } };
    const delBtn = h('button', { type: 'button', class: 'tk-btn danger' }, tr('del'));
    delBtn.addEventListener('click', async () => {
      if (!delBtn.dataset.sure) { delBtn.dataset.sure = '1'; delBtn.textContent = tr('sure'); return; }
      const r = await api('/api/tasks/' + t.id, { method: 'DELETE' });
      if (r.status === 200) showList();
    });

    box.replaceChildren(
      h('button', { type: 'button', class: 'tk-back', onclick: showList }, '← ' + tr('back')),
      title,
      t.goal ? h('p', { class: 'tk-goal-txt' }, h('b', {}, tr('goal') + ': '), t.goal) : null,
      h('div', { class: 'tk-prog' }, bar(done, total), h('span', {}, `${pct(done, total)}% · ${done}/${total}`)),
      h('div', { class: 'tk-stages' }, stageEls),
      h('div', { class: 'tk-row end' },
        h('button', { type: 'button', class: 'tk-btn', onclick: () => setStatus(t.status === 'done' ? 'active' : 'done') }, t.status === 'done' ? tr('reopen') : tr('done')),
        h('button', { type: 'button', class: 'tk-btn', onclick: () => setStatus('archived') }, tr('archive')),
        delBtn));
  }

  function mount(container) {
    unmount();
    box = h('div', { class: 'tk' });
    container.append(box);
    showList();
  }
  function unmount() { if (box) box.remove(); box = null; cur = null; }

  window.DODA_TASKS = { mount, unmount };
})();

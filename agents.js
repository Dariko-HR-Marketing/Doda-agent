/* DODA: agentlar uyushmasi. Bosh agent DODA va rol agentlar: imkoniyatlar katalogi (tavsiya + galochka), to-do ro'yxat, xotira, topshiriq.
   window.DODA_AGENTS = { mount, unmount } */
(() => {
  'use strict';
  const D = () => window.DODA || {};
  const lang = () => (D().getLang ? D().getLang() : 'uz');
  const T = {
    uz: {
      title: 'Agentlar', sub: 'Bosh agent DODA topshiriqni taqsimlaydi, rol agentlar bajaradi. Har birining o‘z ro‘yxati va xotirasi bor.',
      chief: 'Bosh agent', chiefD: 'Umumiy ro‘yxat, xotira, topshiriq taqsimoti', newAgent: 'Yangi agent', back: 'Orqaga',
      todo: 'Ro‘yxat', memory: 'Xotira', work: 'Ish', caps: 'Imkoniyatlar', settings: 'Sozlama',
      open: 'ochiq', mem: 'xotira', none: 'Hali agent yo‘q. Birinchisini yarating.',
      routePh: 'DODA’ga topshiriq yozing: qaysi agent bajarsin, DODA aniqlaydi…', routeBtn: 'Agentni tanlash', routing: 'Tahlil qilinmoqda…', bestFit: 'Eng mos agent', sure2: 'aniq', maybe: 'taxminan', toAgent: 'Agentga topshirish', addToAgent: 'Agent ro‘yxatiga', addToDoda: 'DODA ro‘yxatiga', added: 'Qo‘shildi', others: 'Boshqa variantlar', noFit: 'Mos agent yo‘q.', createSuggest: 'DODA tavsiyasi: yangi agent yarating', createBtn: 'Tavsiya bilan yaratish', generalHint: 'Bu umumiy savolga o‘xshaydi: agent kerak emas. Chatda DODA o‘zi javob beradi. Xohlasangiz ro‘yxatga qo‘shing.', assign: 'Agentga',
      // wizard
      step1: 'Qaysi rol kerak?', step1D: 'Rolni tanlang. DODA unga mos vazifa, vosita va holatlarni tavsiya qiladi.', other: 'Boshqa rol', otherPh: 'Rolni yozing. Masalan: “Mijozlar bilan yozishma yurituvchi” yoki “Moliya hisobotchi”',
      suggest: 'DODA tavsiyasini ko‘rish', closest: 'Bu rol shu shablonga yaqin:', useTpl: 'Shablondan foydalanish', keepOwn: 'O‘zimniki',
      step2: 'DODA tavsiyasi', step2D: 'Tavsiya etilganlari belgilangan. Keraksizini olib tashlang, kerakligini qo‘shing.', name: 'Agent nomi', create: 'Agentni yaratish', creating: 'Yaratilmoqda…',
      duties: 'Vazifalar', tools: 'Vositalar', situations: 'Holatlar', all: 'Hammasi', nothing: 'Hech biri', selected: 'tanlandi', soon: 'tez orada', approval: 'tasdiq bilan', addOwn: 'O‘zingizniki…', recommended: 'DODA tavsiyasi',
      // run
      request: 'Topshiriq', requestPh: 'Agentga nima qilish kerak?', taskLink: 'Vazifaga bog‘lash', noTask: 'Bog‘lamaslik', fast: 'Tez', smart: 'Aqlli', run: 'Topshirish', running: 'Agent ishlayapti…',
      history: 'Natijalar', noRuns: 'Hali natija yo‘q.', copy: 'Nusxa', copied: 'Nusxalandi', ok: 'DODA tekshirdi: yaxshi', needs: 'DODA: yaxshilash kerak', unchecked: 'Tekshirilmadi', saveLesson: 'Saboq qilib saqlash', lessonSaved: 'Xotiraga yozildi',
      // todo
      todoPh: 'Yangi vazifa…', addBtn: 'Qo‘shish', clearDone: 'Bajarilganlarni tozalash', todoEmpty: 'Ro‘yxat bo‘sh.', done: 'bajarilgan', priority: 'Muhim',
      // memory
      memPh: 'Nimani eslab qolsin?', fact: 'Fakt', lesson: 'Saboq', preference: 'Afzallik', memEmpty: 'Xotira bo‘sh. Agent bu yerdagi yozuvlarni har topshiriqda hisobga oladi.', dodaMemD: 'DODA suhbatlardan va sizdan faktlarni eslab qoladi. Hammasi shu yerda ko‘rinadi.',
      // settings
      instr: 'Ko‘rsatma', save: 'Saqlash', saved: 'Saqlandi', del: 'Agentni o‘chirish', sure: 'Aniq o‘chiraman', remove: 'O‘chirish', netErr: 'Aloqa xatosi.',
    },
    ru: {
      title: 'Агенты', sub: 'Главный агент DODA распределяет задания, ролевые агенты выполняют. У каждого свой список и память.',
      chief: 'Главный агент', chiefD: 'Общий список, память, распределение заданий', newAgent: 'Новый агент', back: 'Назад',
      todo: 'Список', memory: 'Память', work: 'Работа', caps: 'Возможности', settings: 'Настройки',
      open: 'открыто', mem: 'память', none: 'Агентов пока нет. Создайте первого.',
      routePh: 'Напишите задание для DODA: она определит, какой агент выполнит…', routeBtn: 'Подобрать агента', routing: 'Анализирую…', bestFit: 'Лучше всего подходит', sure2: 'уверенно', maybe: 'вероятно', toAgent: 'Передать агенту', addToAgent: 'В список агента', addToDoda: 'В список DODA', added: 'Добавлено', others: 'Другие варианты', noFit: 'Подходящего агента нет.', createSuggest: 'Рекомендация DODA: создайте нового агента', createBtn: 'Создать по рекомендации', generalHint: 'Похоже на общий вопрос: агент не нужен. В чате DODA ответит сама. При желании добавьте в список.', assign: 'Агенту',
      step1: 'Какая роль нужна?', step1D: 'Выберите роль. DODA предложит подходящие задачи, инструменты и ситуации.', other: 'Другая роль', otherPh: 'Опишите роль. Например: «Ведёт переписку с клиентами» или «Финансовый отчётность»',
      suggest: 'Показать рекомендации DODA', closest: 'Эта роль близка к шаблону:', useTpl: 'Использовать шаблон', keepOwn: 'Свою',
      step2: 'Рекомендации DODA', step2D: 'Рекомендуемое уже отмечено. Уберите лишнее, добавьте нужное.', name: 'Имя агента', create: 'Создать агента', creating: 'Создаю…',
      duties: 'Задачи', tools: 'Инструменты', situations: 'Ситуации', all: 'Все', nothing: 'Ничего', selected: 'выбрано', soon: 'скоро', approval: 'с подтверждением', addOwn: 'Своё…', recommended: 'Рекомендация DODA',
      request: 'Задание', requestPh: 'Что должен сделать агент?', taskLink: 'Связать с задачей', noTask: 'Не связывать', fast: 'Быстро', smart: 'Умно', run: 'Отправить', running: 'Агент работает…',
      history: 'Результаты', noRuns: 'Результатов пока нет.', copy: 'Копия', copied: 'Скопировано', ok: 'DODA проверила: хорошо', needs: 'DODA: нужно доработать', unchecked: 'Не проверено', saveLesson: 'Сохранить как урок', lessonSaved: 'Записано в память',
      todoPh: 'Новая задача…', addBtn: 'Добавить', clearDone: 'Очистить выполненные', todoEmpty: 'Список пуст.', done: 'выполнено', priority: 'Важно',
      memPh: 'Что запомнить?', fact: 'Факт', lesson: 'Урок', preference: 'Предпочтение', memEmpty: 'Память пуста. Агент учитывает эти записи в каждом задании.', dodaMemD: 'DODA запоминает факты из диалогов и от вас. Всё видно здесь.',
      instr: 'Инструкция', save: 'Сохранить', saved: 'Сохранено', del: 'Удалить агента', sure: 'Точно удалить', remove: 'Удалить', netErr: 'Ошибка связи.',
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
  const errText = (r) => (r.data && r.data.error && r.data.error.message) || tr('netErr');
  const stagger = (els) => els.forEach((el, i) => el.style.setProperty('--i', String(Math.min(i, 14))));
  const svg = (d, s = 16) => { const n = 'http://www.w3.org/2000/svg'; const e = document.createElementNS(n, 'svg'); e.setAttribute('viewBox', '0 0 24 24'); e.setAttribute('width', s); e.setAttribute('height', s); e.setAttribute('fill', 'none'); e.setAttribute('stroke', 'currentColor'); e.setAttribute('stroke-width', '2'); e.setAttribute('stroke-linecap', 'round'); e.setAttribute('stroke-linejoin', 'round'); e.setAttribute('aria-hidden', 'true'); for (const p of d) { const x = document.createElementNS(n, 'path'); x.setAttribute('d', p); e.append(x); } return e; };
  const I = { check: ['M5 12l5 5 9-10'], x: ['M6 6l12 12', 'M18 6L6 18'], star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'], plus: ['M12 5v14', 'M5 12h14'], back: ['M15 5l-7 7 7 7'] };

  const view = (el) => { box.replaceChildren(el); stagger([...el.querySelectorAll('[data-st]')]); };

  /* ================= umumiy komponentlar ================= */

  /** Galochkali katalog: vazifalar, vositalar, holatlar. state = { ids:Set, custom:[{group,text}] } */
  function checklist(catalog, state, onChange) {
    const wrap = h('div', { class: 'ag-cl' });
    const counter = h('span', { class: 'ag-count', 'aria-live': 'polite' });
    const total = () => state.ids.size + state.custom.length;
    const bump = () => { counter.textContent = `${total()} ${tr('selected')}`; counter.classList.remove('pop'); void counter.offsetWidth; counter.classList.add('pop'); onChange && onChange(); };
    counter.textContent = `${total()} ${tr('selected')}`;

    for (const g of catalog.groups) {
      const sel = g.items.filter((i) => i.status === 'ready');
      const head = h('div', { class: 'ag-gh' }, h('b', {}, tr(g.id)), h('span', { class: 'ag-gc' }));
      const all = h('button', { type: 'button', class: 'ag-lk' }, tr('all'));
      const none = h('button', { type: 'button', class: 'ag-lk' }, tr('nothing'));
      head.append(h('span', { class: 'ag-gs' }, all, none));
      const list = h('ul', { class: 'ag-items' });
      const customs = h('ul', { class: 'ag-items ag-custom' });
      const refresh = () => {
        const n = sel.filter((i) => state.ids.has(i.id)).length + state.custom.filter((c) => c.group === g.id).length;
        head.querySelector('.ag-gc').textContent = `${n}/${sel.length + state.custom.filter((c) => c.group === g.id).length}`;
      };
      const rows = g.items.map((it) => {
        const on = state.ids.has(it.id);
        const cb = h('button', { type: 'button', role: 'checkbox', 'aria-checked': String(on), class: 'ag-cb' + (on ? ' on' : ''), disabled: it.status === 'soon', 'aria-label': it.label }, svg(I.check, 14));
        const row = h('li', { class: 'ag-it' + (it.status === 'soon' ? ' soon' : '') + (it.rec ? ' rec' : ''), 'data-st': '1' },
          cb,
          h('div', { class: 'ag-it-t' },
            h('div', { class: 'ag-it-l' }, it.label,
              it.rec && it.status === 'ready' ? h('i', { class: 'ag-b rec', title: tr('recommended') }, '★') : null,
              it.status === 'soon' ? h('i', { class: 'ag-b' }, tr('soon')) : null,
              it.approval ? h('i', { class: 'ag-b appr' }, tr('approval')) : null),
            h('div', { class: 'ag-it-d' }, it.desc)));
        const toggle = () => {
          if (it.status === 'soon') return;
          const v = !state.ids.has(it.id);
          v ? state.ids.add(it.id) : state.ids.delete(it.id);
          cb.classList.toggle('on', v); cb.setAttribute('aria-checked', String(v)); refresh(); bump();
        };
        row.addEventListener('click', toggle);
        cb.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
        row._sync = () => { const v = state.ids.has(it.id); cb.classList.toggle('on', v); cb.setAttribute('aria-checked', String(v)); };
        list.append(row);
        return row;
      });
      const setAll = (v) => { for (const i of sel) v ? state.ids.add(i.id) : state.ids.delete(i.id); rows.forEach((r) => r._sync()); refresh(); bump(); };
      all.addEventListener('click', () => setAll(true));
      none.addEventListener('click', () => setAll(false));

      const renderCustom = () => {
        customs.replaceChildren(...state.custom.filter((c) => c.group === g.id).map((c) => {
          const rm = h('button', { type: 'button', class: 'ag-x', 'aria-label': tr('remove') }, svg(I.x, 14));
          const li = h('li', { class: 'ag-it own' }, h('span', { class: 'ag-cb on' }, svg(I.check, 14)), h('div', { class: 'ag-it-t' }, h('div', { class: 'ag-it-l' }, c.text)), rm);
          rm.addEventListener('click', () => { state.custom.splice(state.custom.indexOf(c), 1); renderCustom(); refresh(); bump(); });
          return li;
        }));
        refresh();
      };
      const input = h('input', { class: 'ag-in sm', maxlength: '200', placeholder: tr('addOwn'), 'aria-label': tr(g.id) + ': ' + tr('addOwn') });
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing) return;
        e.preventDefault();
        const v = input.value.trim();
        if (!v || state.custom.length >= 30) return;
        state.custom.push({ group: g.id, text: v }); input.value = ''; renderCustom(); bump();
      });
      refresh(); renderCustom();
      wrap.append(h('section', { class: 'ag-group' }, head, list, customs, input));
    }
    return { el: wrap, counter };
  }

  /** To-do paneli: scope = 'doda' yoki agent id */
  function todoPanel(scope) {
    const root = h('div', { class: 'ag-panel' });
    const input = h('input', { class: 'ag-in', maxlength: '300', placeholder: tr('todoPh'), 'aria-label': tr('todoPh') });
    let prio = false;
    const star = h('button', { type: 'button', class: 'ag-star', 'aria-pressed': 'false', title: tr('priority'), 'aria-label': tr('priority') }, svg(I.star, 16));
    star.addEventListener('click', () => { prio = !prio; star.classList.toggle('on', prio); star.setAttribute('aria-pressed', String(prio)); });
    const add = h('button', { type: 'button', class: 'ag-btn pri' }, tr('addBtn'));
    const list = h('ul', { class: 'ag-todos' });
    const foot = h('div', { class: 'ag-foot' });
    const msg = h('div', { class: 'ag-msg', role: 'status' });
    let todos = [];
    let panelAgents = [];

    const render = (animateId) => {
      const openN = todos.filter((t) => !t.done).length;
      list.replaceChildren(...(todos.length ? todos.map((t) => {
        const cb = h('button', { type: 'button', role: 'checkbox', 'aria-checked': String(t.done), class: 'ag-cb' + (t.done ? ' on' : ''), 'aria-label': t.text }, svg(I.check, 14));
        const st = h('button', { type: 'button', class: 'ag-star sm' + (t.priority ? ' on' : ''), 'aria-pressed': String(t.priority), title: tr('priority'), 'aria-label': tr('priority') }, svg(I.star, 14));
        const rm = h('button', { type: 'button', class: 'ag-x', 'aria-label': tr('remove') }, svg(I.x, 14));
        let assign = null;
        if (scope === 'doda' && !t.done && panelAgents.length) {
          assign = h('select', { class: 'ag-assign', 'aria-label': tr('assign') }, h('option', { value: '' }, '→ ' + tr('assign')), ...panelAgents.map((x) => h('option', { value: x.id }, x.name)));
          assign.addEventListener('change', async () => { if (!assign.value) return; li.classList.add('out'); const r = await api('/api/todos/' + t.id, { method: 'PATCH', body: { agent: assign.value } }); if (r.status === 200) { todos = r.data.todos; setTimeout(() => render(), 180); } else li.classList.remove('out'); });
        }
        const li = h('li', { class: 'ag-td' + (t.done ? ' done' : '') + (t.id === animateId ? ' in' : '') }, cb, h('span', { class: 'ag-td-t' }, t.text), assign, st, rm);
        cb.addEventListener('click', async () => { li.classList.toggle('done'); const r = await api('/api/todos/' + t.id, { method: 'PATCH', body: { done: !t.done } }); if (r.status === 200) { todos = r.data.todos; setTimeout(() => render(), 220); } });
        st.addEventListener('click', async () => { const r = await api('/api/todos/' + t.id, { method: 'PATCH', body: { priority: !t.priority } }); if (r.status === 200) { todos = r.data.todos; render(); } });
        rm.addEventListener('click', async () => { li.classList.add('out'); const r = await api('/api/todos/' + t.id, { method: 'DELETE' }); if (r.status === 200) { todos = r.data.todos; setTimeout(() => render(), 180); } });
        return li;
      }) : [h('li', { class: 'ag-empty' }, tr('todoEmpty'))]));
      const doneN = todos.length - openN;
      foot.replaceChildren(h('span', { class: 'ag-muted' }, `${openN} ${tr('open')} · ${doneN} ${tr('done')}`), doneN ? h('button', { type: 'button', class: 'ag-lk', onclick: async () => { const r = await api('/api/todos?agent=' + scope, { method: 'DELETE' }); if (r.status === 200) { todos = r.data.todos; render(); } } }, tr('clearDone')) : null);
    };
    const submit = async () => {
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      const r = await api('/api/todos', { method: 'POST', body: { agent: scope, text, priority: prio } });
      if (r.status === 201) { input.value = ''; prio = false; star.classList.remove('on'); msg.textContent = ''; todos = r.data.todos; const top = todos.filter((t) => t.text === text).sort((a, b) => b.id - a.id)[0]; render(top && top.id); input.focus(); }
      else msg.textContent = errText(r);
    };
    add.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); } });
    root.append(h('div', { class: 'ag-addrow' }, input, star, add), msg, list, foot);
    api('/api/todos?agent=' + scope).then((r) => { if (r.status === 200) { todos = r.data.todos; render(); } });
    if (scope === 'doda') api('/api/agents').then((r) => { if (r.status === 200) { panelAgents = r.data.agents; render(); } });
    return root;
  }

  /** Agent xotirasi paneli */
  function memoryPanel(agentId) {
    const root = h('div', { class: 'ag-panel' });
    const kinds = ['fact', 'lesson', 'preference'];
    let kind = 'fact';
    const seg = h('div', { class: 'ag-seg', role: 'group' }, kinds.map((k) => { const b = h('button', { type: 'button', class: 'ag-sg' + (k === kind ? ' on' : ''), 'aria-pressed': String(k === kind) }, tr(k)); b.addEventListener('click', () => { kind = k; [...seg.children].forEach((x, i) => { x.classList.toggle('on', kinds[i] === k); x.setAttribute('aria-pressed', String(kinds[i] === k)); }); }); return b; }));
    const input = h('input', { class: 'ag-in', maxlength: '300', placeholder: tr('memPh'), 'aria-label': tr('memPh') });
    const add = h('button', { type: 'button', class: 'ag-btn pri' }, tr('addBtn'));
    const list = h('ul', { class: 'ag-mem' });
    const msg = h('div', { class: 'ag-msg', role: 'status' });
    let items = [];
    const render = () => {
      list.replaceChildren(...(items.length ? items.map((m, i) => {
        const rm = h('button', { type: 'button', class: 'ag-x', 'aria-label': tr('remove') }, svg(I.x, 14));
        const li = h('li', { class: 'ag-mi in', style: `--i:${Math.min(i, 10)}` }, h('i', { class: 'ag-k ' + m.kind }, tr(m.kind)), h('span', { class: 'ag-td-t' }, m.text), rm);
        rm.addEventListener('click', async () => { li.classList.add('out'); await api(`/api/agents/${agentId}/memory/${m.id}`, { method: 'DELETE' }); setTimeout(load, 180); });
        return li;
      }) : [h('li', { class: 'ag-empty' }, tr('memEmpty'))]));
    };
    const load = async () => { const r = await api(`/api/agents/${agentId}/memory`); if (r.status === 200) { items = r.data.memory; render(); } };
    const submit = async () => {
      const text = input.value.trim();
      if (text.length < 3) { input.focus(); return; }
      const r = await api(`/api/agents/${agentId}/memory`, { method: 'POST', body: { kind, text } });
      if (r.status === 201) { input.value = ''; msg.textContent = ''; await load(); input.focus(); } else msg.textContent = errText(r);
    };
    add.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); } });
    root.append(seg, h('div', { class: 'ag-addrow' }, input, add), msg, list);
    load();
    root._reload = load;
    return root;
  }

  /** Segmentli tab paneli (siljuvchi ko'rsatkich bilan) */
  function tabs(defs, start) {
    const bar = h('div', { class: 'ag-tabs', role: 'tablist' });
    const ind = h('span', { class: 'ag-ind' });
    const body = h('div', { class: 'ag-tabbody' });
    const btns = defs.map((d) => h('button', { type: 'button', role: 'tab', class: 'ag-tab', 'data-k': d.key }, d.label));
    bar.append(...btns, ind);
    let cur = null;
    const cache = {};
    const show = (key) => {
      cur = key;
      btns.forEach((b) => { const on = b.dataset.k === key; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); if (on) { ind.style.width = b.offsetWidth + 'px'; ind.style.transform = `translateX(${b.offsetLeft}px)`; } });
      const d = defs.find((x) => x.key === key);
      cache[key] = cache[key] || d.render();
      body.replaceChildren(cache[key]); body.classList.remove('swap'); void body.offsetWidth; body.classList.add('swap');
    };
    btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.k)));
    requestAnimationFrame(() => show(start || defs[0].key));
    new ResizeObserver(() => { const b = btns.find((x) => x.dataset.k === cur); if (b) { ind.style.width = b.offsetWidth + 'px'; ind.style.transform = `translateX(${b.offsetLeft}px)`; } }).observe(bar);
    return { bar, body };
  }

  const back = (fn, label) => h('button', { type: 'button', class: 'ag-back', onclick: fn }, svg(I.back, 16), label || tr('back'));

  /* ================= bosh sahifa ================= */
  async function home() {
    view(h('div', { class: 'ag ag-load' }, h('div', { class: 'ag-muted' }, '…')));
    const [r, td] = await Promise.all([api('/api/agents'), api('/api/todos?agent=doda')]);
    if (!box) return;
    const agents = r.status === 200 ? r.data.agents : [];
    const dodaOpen = td.status === 200 ? td.data.todos.filter((t) => !t.done).length : 0;
    const chief = h('button', { type: 'button', class: 'ag-chief', 'data-st': '1', onclick: dodaPage },
      h('span', { class: 'ag-orb', 'aria-hidden': 'true' }, 'D'),
      h('span', { class: 'ag-chief-t' }, h('b', {}, 'DODA'), h('span', {}, tr('chief') + ' · ' + tr('chiefD'))),
      h('span', { class: 'ag-chips' }, h('i', { class: 'ag-chip' }, `${dodaOpen} ${tr('open')}`)));
    const cards = agents.map((a) => h('button', { type: 'button', class: 'ag-card', 'data-st': '1', onclick: () => agentPage(a) },
      h('span', { class: 'ag-dot' }), h('b', {}, a.name), h('span', { class: 'ag-role' }, a.role),
      h('span', { class: 'ag-chips' }, h('i', { class: 'ag-chip' }, `${a.openTodos} ${tr('open')}`), h('i', { class: 'ag-chip' }, `${a.memoryCount} ${tr('mem')}`), h('i', { class: 'ag-chip' }, `${a.capabilities.length + a.custom.length} ✓`))));
    cards.push(h('button', { type: 'button', class: 'ag-card new', 'data-st': '1', onclick: wizard }, svg(I.plus, 22), h('b', {}, tr('newAgent'))));
    view(h('div', { class: 'ag' }, h('p', { class: 'ag-sub' }, tr('sub')), routeBox(agents), chief, h('div', { class: 'ag-grid' }, cards), agents.length ? null : h('p', { class: 'ag-muted' }, tr('none'))));
  }

  /* ================= DODA marshrutizatori ================= */
  function routeBox(agents) {
    const ta = h('textarea', { class: 'ag-in ta', rows: '2', maxlength: '2000', placeholder: tr('routePh'), 'aria-label': tr('routePh') });
    const go = h('button', { type: 'button', class: 'ag-btn pri' }, tr('routeBtn'));
    const out = h('div', { class: 'ag-route-out', 'aria-live': 'polite' });
    const addTodo = async (agent, text, btn) => { const r = await api('/api/todos', { method: 'POST', body: { agent, text: text.slice(0, 300) } }); btn.textContent = r.status === 201 ? '✓ ' + tr('added') : errText(r); btn.disabled = true; };
    const run = async () => {
      const text = ta.value.trim();
      if (text.length < 3) { ta.focus(); return; }
      go.disabled = true; go.textContent = tr('routing'); out.replaceChildren();
      const r = await api('/api/agents/route', { method: 'POST', body: { text } });
      go.disabled = false; go.textContent = tr('routeBtn');
      if (r.status !== 200) { out.replaceChildren(h('div', { class: 'ag-msg' }, errText(r))); return; }
      const d = r.data;
      const todoBtn = (agentId) => { const b = h('button', { type: 'button', class: 'ag-btn sm' }, agentId === 'doda' ? tr('addToDoda') : tr('addToAgent')); b.addEventListener('click', () => addTodo(agentId, text, b)); return b; };
      let card;
      if (d.match) {
        const a = agents.find((x) => x.id === d.match.agentId);
        card = h('div', { class: 'ag-rc in' },
          h('div', { class: 'ag-rc-h' }, h('span', { class: 'ag-muted' }, tr('bestFit')), h('i', { class: 'ag-chip' }, tr(d.match.confidence === 'high' ? 'sure2' : 'maybe'))),
          h('b', { class: 'ag-rc-n' }, d.match.name),
          h('div', { class: 'ag-row' }, h('button', { type: 'button', class: 'ag-btn pri sm', onclick: () => a && agentPage(a, 'work', text) }, tr('toAgent')), todoBtn(d.match.agentId)),
          d.alternatives.length ? h('div', { class: 'ag-alt' }, h('span', { class: 'ag-muted' }, tr('others') + ': '), ...d.alternatives.map((x) => h('button', { type: 'button', class: 'ag-lk', onclick: () => { const aa = agents.find((y) => y.id === x.agentId); aa && agentPage(aa, 'work', text); } }, x.name))) : null);
      } else if (d.create) {
        card = h('div', { class: 'ag-rc in' },
          h('div', { class: 'ag-rc-h' }, h('span', { class: 'ag-muted' }, tr('noFit'))),
          h('b', { class: 'ag-rc-n' }, tr('createSuggest')),
          h('div', { class: 'ag-row' }, h('button', { type: 'button', class: 'ag-btn pri sm', onclick: () => startCreate(d.create.template, text) }, tr('createBtn')), todoBtn('doda')));
      } else {
        card = h('div', { class: 'ag-rc in' }, h('p', { class: 'ag-sub' }, tr('generalHint')), h('div', { class: 'ag-row' }, todoBtn('doda')));
      }
      out.replaceChildren(card);
    };
    go.addEventListener('click', run);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } });
    return h('div', { class: 'ag-route', 'data-st': '1' }, ta, h('div', { class: 'ag-row' }, go, h('span', { class: 'ag-muted' }, 'Ctrl+Enter')), out);
  }

  /** Tavsiya etilgan rol bilan to'g'ridan-to'g'ri 2-bosqich (marshrutizatordan) */
  async function startCreate(templateId, prefill) {
    const [c, r] = await Promise.all([api('/api/agents/catalog?template=' + templateId), api('/api/agents')]);
    if (!box || c.status !== 200) return;
    const tpl = (r.data.templates || []).find((t) => t.id === templateId);
    step2(templateId, null, c.data, tpl ? (tpl[lang()] || tpl.uz).name : templateId, prefill);
  }

  /* ================= yangi agent ustasi ================= */
  async function wizard() {
    const r = await api('/api/agents');
    if (!box) return;
    const templates = r.status === 200 ? r.data.templates : [];
    const otherBox = h('div', { class: 'ag-other', hidden: true });
    const ta = h('textarea', { class: 'ag-in ta', rows: '2', maxlength: '200', placeholder: tr('otherPh'), 'aria-label': tr('other') });
    const hint = h('div', { class: 'ag-hint', hidden: true });
    const go = h('button', { type: 'button', class: 'ag-btn pri' }, tr('suggest'));
    otherBox.append(ta, hint, go);
    go.addEventListener('click', async () => {
      const q = ta.value.trim();
      if (q.length < 3) { ta.focus(); return; }
      const c = await api('/api/agents/catalog?q=' + encodeURIComponent(q));
      if (c.status !== 200) return;
      const nearest = templates.find((t) => t.id === c.data.template);
      if (nearest && c.data.template !== 'general') {
        const l = nearest[lang()] || nearest.uz;
        hint.hidden = false;
        hint.replaceChildren(h('span', {}, tr('closest') + ' '), h('b', {}, l.name), h('div', { class: 'ag-row' },
          h('button', { type: 'button', class: 'ag-btn pri sm', onclick: () => pick(nearest.id, null) }, tr('useTpl')),
          h('button', { type: 'button', class: 'ag-btn sm', onclick: () => pick(null, q) }, tr('keepOwn'))));
      } else pick(null, q);
    });
    const cards = templates.map((t) => { const l = t[lang()] || t.uz; return h('button', { type: 'button', class: 'ag-card tpl', 'data-st': '1', onclick: () => pick(t.id, null) }, h('b', {}, l.name), h('span', { class: 'ag-role' }, l.role)); });
    const other = h('button', { type: 'button', class: 'ag-card tpl new', 'data-st': '1' }, svg(I.plus, 20), h('b', {}, tr('other')));
    other.addEventListener('click', () => { otherBox.hidden = !otherBox.hidden; if (!otherBox.hidden) ta.focus(); });
    view(h('div', { class: 'ag' }, back(home), h('h3', { class: 'ag-h' }, tr('step1')), h('p', { class: 'ag-sub' }, tr('step1D')), h('div', { class: 'ag-grid' }, [...cards, other]), otherBox));

    async function pick(templateId, ownRole) {
      const c = await api('/api/agents/catalog?' + (templateId ? 'template=' + templateId : 'template=general'));
      if (c.status !== 200) return;
      const tpl = templateId ? templates.find((t) => t.id === templateId) : null;
      const defName = tpl ? (tpl[lang()] || tpl.uz).name : (ownRole || '').slice(0, 40);
      step2(templateId, ownRole, c.data, defName);
    }
  }

  function step2(templateId, ownRole, data, defName, prefill) {
    const state = { ids: new Set(data.recommended), custom: [] };
    const name = h('input', { class: 'ag-in', maxlength: '60', value: defName, 'aria-label': tr('name') });
    const msg = h('div', { class: 'ag-msg', role: 'status' });
    const cl = checklist(data.catalog, state);
    const create = h('button', { type: 'button', class: 'ag-btn pri lg' }, tr('create'));
    create.addEventListener('click', async () => {
      const nm = name.value.trim();
      if (!nm) { name.focus(); return; }
      create.disabled = true; create.textContent = tr('creating'); msg.textContent = '';
      const common = { name: nm, capabilities: [...state.ids], custom: state.custom };
      const body = templateId ? { template: templateId, ...common }
        : { ...common, role: (ownRole || nm).slice(0, 200), instructions: `Sen "${nm}" rolisan. Vazifang: ${(ownRole || nm).slice(0, 300)}. Aniq, qisqa va foydali yoz; ma'lumot yetishmasa, nimaligini ayt.` };
      const r = await api('/api/agents', { method: 'POST', body });
      if (r.status === 201) agentPage(r.data.agent, 'work', prefill); else { msg.textContent = errText(r); create.disabled = false; create.textContent = tr('create'); }
    });
    view(h('div', { class: 'ag' },
      back(wizard),
      h('h3', { class: 'ag-h' }, tr('step2')), h('p', { class: 'ag-sub' }, tr('step2D')),
      h('div', { class: 'ag-namerow' }, name, cl.counter),
      cl.el, msg, h('div', { class: 'ag-sticky' }, create)));
  }

  /* ================= agent sahifasi ================= */
  async function agentPage(a, start, prefill) {
    const nameIn = h('input', { class: 'ag-title', value: a.name, maxlength: '60', 'aria-label': tr('name') });
    nameIn.addEventListener('change', async () => { const v = nameIn.value.trim(); if (!v) { nameIn.value = a.name; return; } const r = await api('/api/agents/' + a.id, { method: 'PATCH', body: { name: v } }); if (r.status === 200) a = r.data.agent; });
    const catR = await api('/api/agents/catalog?template=' + (a.template || 'general'));
    if (!box) return;
    const t = tabs([
      { key: 'work', label: tr('work'), render: () => workPanel(a, prefill) },
      { key: 'todo', label: tr('todo'), render: () => todoPanel(a.id) },
      { key: 'memory', label: tr('memory'), render: () => memoryPanel(a.id) },
      { key: 'caps', label: tr('caps'), render: () => capsPanel(a, catR.data) },
      { key: 'settings', label: tr('settings'), render: () => settingsPanel(a) },
    ], start);
    view(h('div', { class: 'ag' }, back(home), h('div', { class: 'ag-head' }, h('span', { class: 'ag-dot big' }), nameIn), h('p', { class: 'ag-sub' }, a.role), t.bar, t.body));
  }

  function workPanel(a, prefill) {
    const root = h('div', { class: 'ag-panel' });
    let tier = 'main';
    const req = h('textarea', { class: 'ag-in ta', rows: '4', maxlength: '6000', placeholder: tr('requestPh'), 'aria-label': tr('request') });
    const sel = h('select', { class: 'ag-in sm', 'aria-label': tr('taskLink') }, h('option', { value: '' }, tr('noTask')));
    const msg = h('div', { class: 'ag-msg', role: 'status', 'aria-live': 'polite' });
    const runs = h('div', { class: 'ag-runs' });
    const sgs = ['light', 'main'].map((k) => h('button', { type: 'button', class: 'ag-sg' + (k === tier ? ' on' : ''), 'aria-pressed': String(k === tier) }, tr(k === 'light' ? 'fast' : 'smart')));
    sgs.forEach((b, i) => b.addEventListener('click', () => { tier = i ? 'main' : 'light'; sgs.forEach((x, j) => { x.classList.toggle('on', j === i); x.setAttribute('aria-pressed', String(j === i)); }); }));
    const go = h('button', { type: 'button', class: 'ag-btn pri' }, tr('run'));
    if (prefill) req.value = prefill;
    let list = [];
    const paint = () => {
      runs.replaceChildren(...(list.length ? list.map((r, i) => {
        const copy = h('button', { type: 'button', class: 'ag-lk' }, tr('copy'));
        copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(r.result); copy.textContent = tr('copied'); setTimeout(() => { copy.textContent = tr('copy'); }, 1500); } catch { /* ixtiyoriy */ } });
        const les = r.review && r.verdict === 'needs_work' ? h('button', { type: 'button', class: 'ag-lk' }, tr('saveLesson')) : null;
        if (les) les.addEventListener('click', async () => { const x = await api(`/api/agents/${a.id}/memory`, { method: 'POST', body: { kind: 'lesson', text: r.review.slice(0, 300) } }); les.textContent = x.status === 201 ? tr('lessonSaved') : errText(x); les.disabled = true; });
        return h('article', { class: 'ag-run in', style: `--i:${Math.min(i, 6)}` },
          h('div', { class: 'ag-run-q' }, r.request), h('pre', { class: 'ag-run-r' }, r.result),
          h('div', { class: 'ag-run-m' }, h('i', { class: 'ag-v ' + r.verdict }, tr(r.verdict === 'needs_work' ? 'needs' : r.verdict)), r.review ? h('span', { class: 'ag-muted' }, r.review) : null, h('span', { class: 'ag-muted' }, `${r.model} · $${r.costUsd.toFixed(4)}`), copy, les));
      }) : [h('p', { class: 'ag-empty' }, tr('noRuns'))]));
    };
    go.addEventListener('click', async () => {
      const q = req.value.trim();
      if (q.length < 3) { req.focus(); return; }
      go.disabled = true; go.textContent = tr('running'); go.classList.add('busy'); msg.textContent = '';
      const r = await api(`/api/agents/${a.id}/run`, { method: 'POST', body: { request: q, tier, ...(sel.value ? { taskId: sel.value } : {}) } });
      go.disabled = false; go.textContent = tr('run'); go.classList.remove('busy');
      if (r.status === 201) { list = [r.data.run, ...list]; req.value = ''; paint(); } else {
        msg.textContent = errText(r);
        if (r.data && r.data.error && r.data.error.code === 'api_key_required') msg.append(' ', h('button', { type: 'button', class: 'ag-lk', onclick: () => document.dispatchEvent(new CustomEvent('doda:open-keys')) }, 'AI kalitlari'));
      }
    });
    root.append(req, h('div', { class: 'ag-row' }, sel, h('span', { class: 'ag-seg' }, sgs), go), msg, h('h4', { class: 'ag-h4' }, tr('history')), runs);
    Promise.all([api('/api/tasks'), api(`/api/agents/${a.id}/runs`)]).then(([tk, rr]) => {
      if (tk.status === 200) for (const t of tk.data.tasks.filter((x) => x.status === 'active')) sel.append(h('option', { value: t.id }, t.title));
      list = rr.status === 200 ? rr.data.runs : []; paint();
    });
    paint();
    return root;
  }

  function capsPanel(a, data) {
    const root = h('div', { class: 'ag-panel' });
    const state = { ids: new Set(a.capabilities), custom: (a.custom || []).map((c) => ({ ...c })) };
    const msg = h('div', { class: 'ag-msg', role: 'status' });
    const save = h('button', { type: 'button', class: 'ag-btn pri', disabled: true }, tr('save'));
    const cl = checklist(data.catalog, state, () => { save.disabled = false; msg.textContent = ''; });
    save.addEventListener('click', async () => {
      const r = await api('/api/agents/' + a.id, { method: 'PATCH', body: { capabilities: [...state.ids], custom: state.custom } });
      if (r.status === 200) { a.capabilities = r.data.agent.capabilities; a.custom = r.data.agent.custom; save.disabled = true; msg.textContent = tr('saved'); } else msg.textContent = errText(r);
    });
    root.append(h('div', { class: 'ag-namerow' }, h('span', { class: 'ag-muted' }, tr('recommended') + ' ★'), cl.counter), cl.el, msg, h('div', { class: 'ag-sticky' }, save));
    return root;
  }

  function settingsPanel(a) {
    const root = h('div', { class: 'ag-panel' });
    const instr = h('textarea', { class: 'ag-in ta', rows: '6', maxlength: '3000', 'aria-label': tr('instr') }); instr.value = a.instructions;
    const msg = h('div', { class: 'ag-msg', role: 'status' });
    const save = h('button', { type: 'button', class: 'ag-btn pri' }, tr('save'));
    save.addEventListener('click', async () => { const v = instr.value.trim(); if (!v) return; const r = await api('/api/agents/' + a.id, { method: 'PATCH', body: { instructions: v } }); msg.textContent = r.status === 200 ? tr('saved') : errText(r); if (r.status === 200) a = Object.assign(a, r.data.agent); });
    const del = h('button', { type: 'button', class: 'ag-btn danger' }, tr('del'));
    del.addEventListener('click', async () => { if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = tr('sure'); return; } const r = await api('/api/agents/' + a.id, { method: 'DELETE' }); if (r.status === 200) home(); });
    root.append(h('h4', { class: 'ag-h4' }, tr('instr')), instr, h('div', { class: 'ag-row' }, save, msg), h('div', { class: 'ag-row end' }, del));
    return root;
  }

  /* ================= DODA (bosh agent) sahifasi ================= */
  function dodaPage() {
    const t = tabs([
      { key: 'todo', label: tr('todo'), render: () => todoPanel('doda') },
      { key: 'memory', label: tr('memory'), render: dodaMemory },
    ], 'todo');
    view(h('div', { class: 'ag' }, back(home), h('div', { class: 'ag-head' }, h('span', { class: 'ag-orb big', 'aria-hidden': 'true' }, 'D'), h('h3', { class: 'ag-title static' }, 'DODA')), h('p', { class: 'ag-sub' }, tr('chief') + ' · ' + tr('chiefD')), t.bar, t.body));
  }
  function dodaMemory() {
    const root = h('div', { class: 'ag-panel' });
    const input = h('input', { class: 'ag-in', maxlength: '200', placeholder: tr('memPh'), 'aria-label': tr('memPh') });
    const add = h('button', { type: 'button', class: 'ag-btn pri' }, tr('addBtn'));
    const list = h('ul', { class: 'ag-mem' });
    const msg = h('div', { class: 'ag-msg', role: 'status' });
    let facts = [];
    const render = () => {
      list.replaceChildren(...(facts.length ? facts.map((f, i) => {
        const rm = h('button', { type: 'button', class: 'ag-x', 'aria-label': tr('remove') }, svg(I.x, 14));
        const li = h('li', { class: 'ag-mi in', style: `--i:${Math.min(i, 10)}` }, h('i', { class: 'ag-k fact' }, tr('fact')), h('span', { class: 'ag-td-t' }, f.text), rm);
        rm.addEventListener('click', async () => { li.classList.add('out'); const r = await api('/api/doda/memory/' + f.index, { method: 'DELETE' }); if (r.status === 200) { facts = r.data.facts; setTimeout(render, 180); } });
        return li;
      }) : [h('li', { class: 'ag-empty' }, tr('memEmpty'))]));
    };
    const submit = async () => {
      const text = input.value.trim();
      if (text.length < 8) { input.focus(); return; }
      const r = await api('/api/doda/memory', { method: 'POST', body: { text } });
      if (r.status === 201) { input.value = ''; msg.textContent = ''; facts = r.data.facts; render(); } else msg.textContent = errText(r);
    };
    add.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); } });
    root.append(h('p', { class: 'ag-sub' }, tr('dodaMemD')), h('div', { class: 'ag-addrow' }, input, add), msg, list);
    api('/api/doda/memory').then((r) => { if (r.status === 200) { facts = r.data.facts; render(); } });
    return root;
  }

  function mount(container) { unmount(); box = h('div', { class: 'agroot' }); container.append(box); home(); }
  function unmount() { if (box) box.remove(); box = null; }
  window.DODA_AGENTS = { mount, unmount };
})();

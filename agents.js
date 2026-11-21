/* DODA: agentlar (rol agentlar). DODA topshiriq beradi, agent bajaradi, DODA tekshiradi. window.DODA_AGENTS = { mount, unmount } */
(() => {
  'use strict';
  const D = () => window.DODA || {};
  const lang = () => (D().getLang ? D().getLang() : 'uz');
  const T = {
    uz: {
      title: 'Agentlar', intro: 'Agent faqat sizning topshirig‘ingizni ko‘radi: suhbatlaringiz va xotirangiz unga berilmaydi. Natijani DODA tekshiradi.',
      my: 'Mening agentlarim', none: 'Hali agent yo‘q. Quyidan shablon tanlang.', templates: 'Shablondan qo‘shish', custom: 'O‘z agentingiz', name: 'Nomi', role: 'Vazifasi (qisqa)', instr: 'Ko‘rsatma (u qanday ishlaydi)',
      create: 'Yaratish', back: 'Orqaga', request: 'Topshiriq', requestPh: 'Agentga nima qilish kerak? Masalan: “Menejer uchun vakansiya matni yoz”', task: 'Vazifa bilan bog‘lash (ixtiyoriy)', noTask: 'Bog‘lamaslik',
      model: 'Model', fast: 'Tez', smart: 'Aqlli', run: 'Topshirish', running: 'Agent ishlayapti…', history: 'Natijalar', noRuns: 'Hali natija yo‘q.', copy: 'Nusxa olish', copied: 'Nusxalandi',
      ok: 'DODA tekshirdi: yaxshi', needs: 'DODA: yaxshilash kerak', unchecked: 'Tekshirilmadi', del: 'Agentni o‘chirish', sure: 'Aniq o‘chiraman', save: 'Saqlash', saved: 'Saqlandi', netErr: 'Aloqa xatosi.', edit: 'Sozlamalar',
    },
    ru: {
      title: 'Агенты', intro: 'Агент видит только ваше задание: ваши диалоги и память ему не передаются. Результат проверяет DODA.',
      my: 'Мои агенты', none: 'Агентов пока нет. Выберите шаблон ниже.', templates: 'Добавить из шаблона', custom: 'Свой агент', name: 'Название', role: 'Задача (кратко)', instr: 'Инструкция (как он работает)',
      create: 'Создать', back: 'Назад', request: 'Задание', requestPh: 'Что должен сделать агент? Например: «Напиши текст вакансии для менеджера»', task: 'Связать с задачей (необязательно)', noTask: 'Не связывать',
      model: 'Модель', fast: 'Быстро', smart: 'Умно', run: 'Отправить', running: 'Агент работает…', history: 'Результаты', noRuns: 'Результатов пока нет.', copy: 'Копировать', copied: 'Скопировано',
      ok: 'DODA проверила: хорошо', needs: 'DODA: нужно доработать', unchecked: 'Не проверено', del: 'Удалить агента', sure: 'Точно удалить', save: 'Сохранить', saved: 'Сохранено', netErr: 'Ошибка связи.', edit: 'Настройки',
    },
  };
  const tr = (k) => T[lang()][k] ?? k;
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

  async function showList() {
    if (!box) return;
    box.replaceChildren(h('div', { class: 'tk-muted' }, '…'));
    const r = await api('/api/agents');
    if (!box) return;
    const agents = r.status === 200 ? r.data.agents : [];
    const templates = r.status === 200 ? r.data.templates : [];
    const msg = h('div', { class: 'tk-msg', role: 'status' });
    const add = async (body) => {
      const res = await api('/api/agents', { method: 'POST', body });
      if (res.status === 201) showAgent(res.data.agent); else msg.textContent = errText(res);
    };

    const nm = h('input', { class: 'ag-in', maxlength: '60', placeholder: tr('name'), 'aria-label': tr('name') });
    const rl = h('input', { class: 'ag-in', maxlength: '200', placeholder: tr('role'), 'aria-label': tr('role') });
    const ins = h('textarea', { class: 'tk-goal', rows: '3', maxlength: '3000', placeholder: tr('instr'), 'aria-label': tr('instr') });
    const mk = h('button', { type: 'button', class: 'tk-btn', onclick: () => { if (nm.value.trim() && rl.value.trim() && ins.value.trim()) add({ name: nm.value, role: rl.value, instructions: ins.value }); } }, tr('create'));

    box.replaceChildren(
      h('p', { class: 'tk-goal-txt' }, tr('intro')),
      h('h2', {}, tr('my')),
      agents.length
        ? h('ul', { class: 'tk-list' }, agents.map((a) => h('li', {}, h('button', { type: 'button', class: 'tk-card', onclick: () => showAgent(a) }, h('span', { class: 'tk-card-t' }, a.name), h('span', { class: 'tk-card-m' }, a.role)))))
        : h('p', { class: 'tk-muted' }, tr('none')),
      h('h2', {}, tr('templates')),
      h('ul', { class: 'tk-list' }, templates.map((t) => { const l = t[lang()] || t.uz; return h('li', {}, h('button', { type: 'button', class: 'tk-card', onclick: () => add({ template: t.id }) }, h('span', { class: 'tk-card-t' }, '+ ' + l.name), h('span', { class: 'tk-card-m' }, l.role))); })),
      h('details', { class: 'ag-custom' }, h('summary', {}, tr('custom')), nm, rl, ins, mk),
      msg);
  }

  async function showAgent(a) {
    if (!box) return;
    let tier = 'main';
    const req = h('textarea', { class: 'tk-goal', rows: '4', maxlength: '6000', placeholder: tr('requestPh'), 'aria-label': tr('request') });
    const sel = h('select', { class: 'ag-in', 'aria-label': tr('task') }, h('option', { value: '' }, tr('noTask')));
    const msg = h('div', { class: 'tk-msg', role: 'status', 'aria-live': 'polite' });
    const runs = h('div', { class: 'ag-runs' });
    const segFast = h('button', { type: 'button', class: 'ag-seg', 'aria-pressed': 'false' }, tr('fast'));
    const segSmart = h('button', { type: 'button', class: 'ag-seg on', 'aria-pressed': 'true' }, tr('smart'));
    const setTier = (t) => { tier = t; segFast.classList.toggle('on', t === 'light'); segSmart.classList.toggle('on', t === 'main'); segFast.setAttribute('aria-pressed', String(t === 'light')); segSmart.setAttribute('aria-pressed', String(t === 'main')); };
    segFast.addEventListener('click', () => setTier('light')); segSmart.addEventListener('click', () => setTier('main'));
    const go = h('button', { type: 'button', class: 'tk-btn primary' }, tr('run'));

    const renderRuns = (list) => {
      runs.replaceChildren(...(list.length ? list : [null]).map((r) => {
        if (!r) return h('p', { class: 'tk-muted' }, tr('noRuns'));
        const copy = h('button', { type: 'button', class: 'tk-btn small' }, tr('copy'));
        copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(r.result); copy.textContent = tr('copied'); setTimeout(() => { copy.textContent = tr('copy'); }, 1500); } catch { /* ixtiyoriy */ } });
        return h('article', { class: 'ag-run' },
          h('div', { class: 'ag-run-q' }, r.request),
          h('pre', { class: 'ag-run-r' }, r.result),
          h('div', { class: 'ag-run-m' },
            h('span', { class: 'ag-badge ' + r.verdict }, tr(r.verdict === 'needs_work' ? 'needs' : r.verdict)),
            r.review ? h('span', { class: 'tk-muted' }, r.review) : null,
            h('span', { class: 'tk-muted' }, `${r.model} · $${r.costUsd.toFixed(4)}`), copy));
      }));
    };
    let list = [];
    go.addEventListener('click', async () => {
      const q = req.value.trim();
      if (q.length < 3) { req.focus(); return; }
      go.disabled = true; go.textContent = tr('running'); msg.textContent = '';
      const res = await api(`/api/agents/${a.id}/run`, { method: 'POST', body: { request: q, tier, ...(sel.value ? { taskId: sel.value } : {}) } });
      go.disabled = false; go.textContent = tr('run');
      if (res.status === 201) { list = [res.data.run, ...list]; renderRuns(list); req.value = ''; } else msg.textContent = errText(res);
    });

    const name = h('input', { class: 'tk-title', value: a.name, maxlength: '60', 'aria-label': tr('name') });
    name.addEventListener('change', async () => { const v = name.value.trim(); if (!v) { name.value = a.name; return; } const r = await api('/api/agents/' + a.id, { method: 'PATCH', body: { name: v } }); if (r.status === 200) a = r.data.agent; });
    const instr = h('textarea', { class: 'tk-goal', rows: '5', maxlength: '3000', 'aria-label': tr('instr') }); instr.value = a.instructions;
    const saveMsg = h('span', { class: 'tk-muted' });
    const save = h('button', { type: 'button', class: 'tk-btn small' }, tr('save'));
    save.addEventListener('click', async () => { const v = instr.value.trim(); if (!v) return; const r = await api('/api/agents/' + a.id, { method: 'PATCH', body: { instructions: v } }); saveMsg.textContent = r.status === 200 ? tr('saved') : errText(r); if (r.status === 200) a = r.data.agent; });
    const del = h('button', { type: 'button', class: 'tk-btn danger' }, tr('del'));
    del.addEventListener('click', async () => { if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = tr('sure'); return; } const r = await api('/api/agents/' + a.id, { method: 'DELETE' }); if (r.status === 200) showList(); });

    box.replaceChildren(
      h('button', { type: 'button', class: 'tk-back', onclick: showList }, '← ' + tr('back')),
      name, h('p', { class: 'tk-goal-txt' }, a.role),
      h('div', { class: 'tk-new' }, h('h2', {}, tr('request')), req,
        h('div', { class: 'tk-row' }, sel, h('span', { class: 'ag-segs', role: 'group', 'aria-label': tr('model') }, segFast, segSmart), go), msg),
      h('h2', {}, tr('history')), runs,
      h('details', { class: 'ag-custom' }, h('summary', {}, tr('edit')), instr, h('div', { class: 'tk-row' }, save, saveMsg, del)));
    const [tk, rr] = await Promise.all([api('/api/tasks'), api(`/api/agents/${a.id}/runs`)]);
    if (!box) return;
    if (tk.status === 200) for (const t of tk.data.tasks.filter((x) => x.status === 'active')) sel.append(h('option', { value: t.id }, t.title));
    list = rr.status === 200 ? rr.data.runs : [];
    renderRuns(list);
  }

  function mount(container) { unmount(); box = h('div', { class: 'tk' }); container.append(box); showList(); }
  function unmount() { if (box) box.remove(); box = null; }
  window.DODA_AGENTS = { mount, unmount };
})();

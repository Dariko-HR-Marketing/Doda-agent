/* DODA: ishchi maydon (Bilim markazi sahifasida). Fayllar serverda, har o'zgarish versiyalanadi. */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const D = () => window.DODA || {};
  const lang = () => (D().getLang ? D().getLang() : 'uz');

  const T = {
    uz: {
      title: 'Ishchi maydon', sub: 'Fayllaringiz serverda saqlanadi. DODA ham ba’zi fayllarni yozadi (xotira): ular “DODA” belgisi bilan ko‘rinadi. Har o‘zgarish versiyalanadi, xohlagan vaqtda tiklay olasiz.',
      files: 'Fayllar', newFile: '＋ Yangi fayl', pathPh: 'masalan: loyihalar/reja.md', create: 'Yaratish', cancel: 'Bekor qilish',
      pick: 'Chapdan faylni tanlang yoki yangisini yarating.', save: 'Saqlash', saved: 'Saqlandi', dirty: '● saqlanmagan', versions: 'Versiyalar', restore: 'Tiklash',
      del: 'O‘chirish', delSure: 'Aniq o‘chiraman', empty: '(bo‘sh)', doda: 'DODA', you: 'Siz', bytes: 'bayt',
      netErr: 'Aloqa xatosi.', conflictBtn: 'Faylni qayta yuklash', discard: 'Saqlanmagan o‘zgarishlar yo‘qoladi. Davom etasizmi?',
      deleted: 'Fayl o‘chirildi.', restored: 'Versiya tiklandi', noVersions: 'Versiyalar yo‘q', loading: 'Yuklanmoqda…',
    },
    ru: {
      title: 'Рабочая область', sub: 'Ваши файлы хранятся на сервере. DODA тоже записывает некоторые файлы (память): они помечены «DODA». Каждое изменение версионируется, его можно откатить.',
      files: 'Файлы', newFile: '＋ Новый файл', pathPh: 'например: проекты/план.md', create: 'Создать', cancel: 'Отмена',
      pick: 'Выберите файл слева или создайте новый.', save: 'Сохранить', saved: 'Сохранено', dirty: '● не сохранено', versions: 'Версии', restore: 'Восстановить',
      del: 'Удалить', delSure: 'Точно удалить', empty: '(пусто)', doda: 'DODA', you: 'Вы', bytes: 'байт',
      netErr: 'Ошибка связи.', conflictBtn: 'Перезагрузить файл', discard: 'Несохранённые изменения будут потеряны. Продолжить?',
      deleted: 'Файл удалён.', restored: 'Версия восстановлена', noVersions: 'Версий нет', loading: 'Загрузка…',
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

  async function api(path, { method = 'GET', body } = {}) {
    try {
      const res = await fetch(D().API + path, {
        method,
        credentials: 'include',
        headers: { 'Accept-Language': lang(), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, data: await res.json().catch(() => ({})) };
    } catch {
      return { status: 0, data: {} };
    }
  }
  const errMsg = (r) => (r.data && r.data.error && r.data.error.message) || tr('netErr');

  let panel = null;
  let ui = {};
  let files = [];
  let current = null; // { path, version }
  let dirty = false;
  let delTimer = null;

  const fmtTime = (ts) => new Date(ts).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  function setStatus(text, kind = '') {
    ui.status.textContent = text;
    ui.status.className = 'ws-status ' + kind;
  }

  function markDirty(d) {
    dirty = d;
    if (current) setStatus(d ? tr('dirty') : '', d ? 'warn' : '');
  }

  function build() {
    ui.list = h('ul', { class: 'ws-list', 'aria-label': tr('files') });
    ui.newBtn = h('button', { type: 'button', class: 'ws-btn ws-new', onclick: () => { ui.newRow.hidden = !ui.newRow.hidden; if (!ui.newRow.hidden) ui.newPath.focus(); } }, tr('newFile'));
    ui.newPath = h('input', { type: 'text', class: 'ws-input', placeholder: tr('pathPh'), maxlength: '120', 'aria-label': tr('pathPh'), autocomplete: 'off', spellcheck: 'false' });
    ui.newRow = h('form', { class: 'ws-newrow', hidden: true, onsubmit: (e) => { e.preventDefault(); createFile(); } },
      ui.newPath, h('button', { type: 'submit', class: 'ws-btn primary' }, tr('create')));
    ui.title = h('div', { class: 'ws-file-title' }, tr('pick'));
    ui.status = h('span', { class: 'ws-status', role: 'status', 'aria-live': 'polite' });
    ui.area = h('textarea', { class: 'ws-area', spellcheck: 'false', disabled: true, 'aria-label': tr('title') });
    ui.area.addEventListener('input', () => markDirty(true));
    ui.area.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });
    ui.saveBtn = h('button', { type: 'button', class: 'ws-btn primary', disabled: true, onclick: save }, tr('save'));
    ui.verBtn = h('button', { type: 'button', class: 'ws-btn', disabled: true, onclick: loadVersions }, tr('versions'));
    ui.verSel = h('select', { class: 'ws-select', hidden: true, 'aria-label': tr('versions') });
    ui.restoreBtn = h('button', { type: 'button', class: 'ws-btn', hidden: true, onclick: restore }, tr('restore'));
    ui.delBtn = h('button', { type: 'button', class: 'ws-btn danger', disabled: true, onclick: remove }, tr('del'));
    ui.reload = h('button', { type: 'button', class: 'ws-btn', hidden: true, onclick: () => current && openFile(current.path, true) }, tr('conflictBtn'));

    panel.replaceChildren(
      h('div', { class: 'ws-head' }, h('h2', {}, tr('title')), h('p', {}, tr('sub'))),
      h('div', { class: 'ws-body' },
        h('div', { class: 'ws-side' }, h('div', { class: 'ws-side-head' }, h('b', {}, tr('files')), ui.newBtn), ui.newRow, ui.list),
        h('div', { class: 'ws-main' },
          h('div', { class: 'ws-main-head' }, ui.title, ui.status),
          ui.area,
          h('div', { class: 'ws-actions' }, ui.saveBtn, ui.reload, ui.verBtn, ui.verSel, ui.restoreBtn, ui.delBtn))),
    );
  }

  function renderList() {
    ui.list.replaceChildren();
    for (const f of files) {
      const btn = h('button', { type: 'button', class: 'ws-item' + (current && current.path === f.path ? ' on' : ''), 'aria-current': current && current.path === f.path ? 'true' : 'false', onclick: () => openFile(f.path) },
        h('span', { class: 'ws-item-path' }, f.path),
        h('span', { class: 'ws-item-meta' }, `${f.size} ${tr('bytes')} · ${f.updatedBy === 'doda' ? tr('doda') : tr('you')} · ${fmtTime(f.updatedAt)}`));
      ui.list.append(h('li', {}, btn));
    }
  }

  async function loadList() {
    const r = await api('/api/workspace');
    if (r.status !== 200) { setStatus(errMsg(r), 'err'); return; }
    files = r.data.files;
    renderList();
  }

  function clearEditor() {
    current = null;
    dirty = false;
    ui.title.textContent = tr('pick');
    ui.area.value = '';
    ui.area.disabled = true;
    for (const b of [ui.saveBtn, ui.verBtn, ui.delBtn]) b.disabled = true;
    ui.verSel.hidden = true;
    ui.restoreBtn.hidden = true;
    ui.reload.hidden = true;
    setStatus('');
    renderList();
  }

  async function openFile(path, force = false) {
    if (!force && dirty && !window.confirm(tr('discard'))) return;
    setStatus(tr('loading'));
    const r = await api('/api/workspace/file?path=' + encodeURIComponent(path));
    if (r.status !== 200) { setStatus(errMsg(r), 'err'); return; }
    current = { path: r.data.path, version: r.data.version };
    dirty = false;
    ui.title.textContent = r.data.path;
    ui.area.value = r.data.content;
    ui.area.disabled = false;
    for (const b of [ui.saveBtn, ui.verBtn, ui.delBtn]) b.disabled = false;
    ui.verSel.hidden = true;
    ui.restoreBtn.hidden = true;
    ui.reload.hidden = true;
    setStatus(`v${r.data.version} · ${r.data.updatedBy === 'doda' ? tr('doda') : tr('you')} · ${fmtTime(r.data.updatedAt)}`);
    renderList();
  }

  async function save() {
    if (!current || ui.saveBtn.disabled) return;
    ui.saveBtn.disabled = true;
    const r = await api('/api/workspace/file', { method: 'PUT', body: { path: current.path, content: ui.area.value, baseVersion: current.version } });
    ui.saveBtn.disabled = false;
    if (r.status === 200) {
      current.version = r.data.version;
      dirty = false;
      setStatus(`${tr('saved')} · v${r.data.version}`, 'ok');
      ui.verSel.hidden = true;
      ui.restoreBtn.hidden = true;
      loadList();
    } else if (r.status === 409) {
      setStatus(errMsg(r), 'err');
      ui.reload.hidden = false;
    } else {
      setStatus(errMsg(r), 'err');
    }
  }

  async function createFile() {
    const path = ui.newPath.value.trim();
    if (!path) return;
    const r = await api('/api/workspace/file', { method: 'PUT', body: { path, content: '' } });
    if (r.status !== 200) { setStatus(errMsg(r), 'err'); return; }
    ui.newPath.value = '';
    ui.newRow.hidden = true;
    await loadList();
    await openFile(r.data.path, true);
    ui.area.focus();
  }

  async function remove() {
    if (!current) return;
    if (!ui.delBtn.dataset.sure) {
      ui.delBtn.dataset.sure = '1';
      ui.delBtn.textContent = tr('delSure');
      clearTimeout(delTimer);
      delTimer = setTimeout(() => { delete ui.delBtn.dataset.sure; ui.delBtn.textContent = tr('del'); }, 4000);
      return;
    }
    clearTimeout(delTimer);
    delete ui.delBtn.dataset.sure;
    ui.delBtn.textContent = tr('del');
    const r = await api('/api/workspace/file?path=' + encodeURIComponent(current.path), { method: 'DELETE' });
    if (r.status !== 200) { setStatus(errMsg(r), 'err'); return; }
    await loadList();
    clearEditor();
    setStatus(tr('deleted'), 'ok');
  }

  async function loadVersions() {
    if (!current) return;
    const r = await api('/api/workspace/versions?path=' + encodeURIComponent(current.path));
    if (r.status !== 200) { setStatus(errMsg(r), 'err'); return; }
    ui.verSel.replaceChildren();
    if (!r.data.versions.length) { setStatus(tr('noVersions')); return; }
    for (const v of r.data.versions) {
      ui.verSel.append(h('option', { value: String(v.version) }, `v${v.version} · ${v.updatedBy === 'doda' ? tr('doda') : tr('you')} · ${fmtTime(v.updatedAt)} · ${v.size} ${tr('bytes')}`));
    }
    ui.verSel.hidden = false;
    ui.restoreBtn.hidden = false;
  }

  async function restore() {
    if (!current) return;
    if (dirty && !window.confirm(tr('discard'))) return;
    const r = await api('/api/workspace/restore', { method: 'POST', body: { path: current.path, version: Number(ui.verSel.value) } });
    if (r.status !== 200) { setStatus(errMsg(r), 'err'); return; }
    await openFile(current.path, true);
    await loadList();
    setStatus(`${tr('restored')} · v${r.data.version}`, 'ok');
  }

  function mount(container) {
    if (panel) unmount();
    panel = h('section', { class: 'ws glass', id: 'ws-panel' });
    container.append(panel);
    build();
    loadList();
  }

  function unmount() {
    if (panel) panel.remove();
    panel = null;
    files = [];
    current = null;
    dirty = false;
  }

  window.DODA_WS = { mount, unmount, isDirty: () => dirty };

  document.addEventListener('doda:memory', async () => {
    if (!panel) return;
    await loadList();
    if (current && !dirty && current.path === 'xotira/faktlar.md') openFile(current.path, true);
  });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();

/* Explicit, same-origin migration from the v4 browser store. Never deletes local data. */
(() => {
  const STORE = 'doda_demo_tasks_v4';
  const DB = 'doda-prototype-local-files-v1';
  let local = [];
  try { local = JSON.parse(localStorage.getItem(STORE) || '[]').filter(t => t && t.id !== 'sample'); }
  catch { return; }
  if (!local.length) return;

  const api = async (path, body) => {
    const response = await fetch('/api/' + path, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(typeof result.detail === 'string' ? result.detail : 'Server xatosi (' + response.status + ')');
    return result;
  };

  async function getLegacyFile(id) {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const request = database.transaction('files').objectStore('files').get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { database.close(); }
  }

  async function encode(blob) {
    const url = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return url.slice(url.indexOf(',') + 1);
  }

  async function snapshot(tasks) {
    const attachments = {};
    for (const task of tasks) {
      for (const file of task.files || []) {
        if (attachments[file.id]) continue;
        const original = await getLegacyFile(file.id);
        if (!original?.blob) throw Error('Mahalliy fayl topilmadi: ' + file.name);
        attachments[file.id] = { name: original.name || file.name, data: await encode(original.blob) };
      }
    }
    return { format: 'doda-v4-local-backup', exported_at: new Date().toISOString(), tasks, attachments };
  }

  function saveBackup(data) {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'DODA-mahalliy-zaxira.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  window.addEventListener('doda:live', event => {
    const existing = new Set(event.detail.serverIds);
    const pending = local.filter(task => !existing.has(task.id));
    if (!pending.length) return;
    const banner = document.createElement('section');
    banner.className = 'migration-notice';
    banner.innerHTML = '<strong>Bu brauzerda avvalgi topshiriqlar bor</strong>' +
      '<p>Ularni serverga ko‘chirishdan oldin fayllari bilan birga zaxira nusxa oling. Mahalliy ma’lumotlar o‘chirilmaydi.</p>' +
      '<div><button type="button" class="outline-button" data-backup>Zaxira nusxa olish</button>' +
      '<button type="button" class="primary-button" data-import disabled>Serverga ko‘chirish</button></div>' +
      '<small role="status">Fayllar faqat DODA serveriga yuboriladi. AI tahlili alohida tasdiq bilan boshlanadi.</small>';
    document.querySelector('.main-area main').prepend(banner);
    const status = banner.querySelector('[role=status]');
    const backupButton = banner.querySelector('[data-backup]');
    const importButton = banner.querySelector('[data-import]');
    let backup = null;

    backupButton.onclick = async () => {
      backupButton.disabled = true;
      status.textContent = 'Zaxira nusxa tayyorlanmoqda…';
      try {
        backup = await snapshot(pending);
        saveBackup(backup);
        importButton.disabled = false;
        status.textContent = pending.length + ' ta topshiriqning zaxira nusxasi yuklandi. Faylni saqlaganingizni tekshiring.';
      } catch (error) { status.textContent = error.message; }
      finally { backupButton.disabled = false; }
    };

    importButton.onclick = async () => {
      if (!backup) return;
      importButton.disabled = true;
      status.textContent = 'Topshiriq va fayllar serverga ko‘chirilmoqda…';
      try {
        const mapped = [];
        for (const task of backup.tasks) {
          const files = [];
          for (const file of task.files || []) {
            const item = backup.attachments[file.id];
            files.push(await api('files', { name: item.name, data: item.data }));
          }
          mapped.push({ ...task, files });
        }
        const result = await api('import', { tasks: mapped });
        const check = await fetch('/api/state', { credentials: 'same-origin' });
        if (!check.ok) throw Error('Serverdagi natija tekshirilmadi');
        const state = await check.json();
        const importedIds = new Set(state.tasks.map(task => task.id));
        if (pending.some(task => !importedIds.has(task.id))) throw Error('Ba’zi topshiriqlar serverda topilmadi');
        status.textContent = (result.imported.length + result.skipped.length) + ' ta topshiriq tekshirildi. Sahifa yangilanmoqda…';
        window.location.reload();
      } catch (error) {
        status.textContent = 'Ko‘chirish yakunlanmadi: ' + error.message + '. Mahalliy nusxa saqlangan.';
        importButton.disabled = false;
      }
    };
  });
})();

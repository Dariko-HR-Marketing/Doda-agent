/* Authenticated single-organization profile and owner member management. */
(() => {
  const api = async (path, body) => {
    const response = await fetch('/api/' + path, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.detail || 'Server xatosi');
    return data;
  };

  window.addEventListener('doda:live', async () => {
    let dialog = document.querySelector('#profile-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'profile-dialog';
      dialog.className = 'modal small-modal';
      dialog.innerHTML = '<div class="modal-head"><div><span class="section-kicker">SHAXSIY KABINET</span><h2>Profil va tashkilot</h2></div><button class="close-button" type="button" data-close-profile aria-label="Yopish">×</button></div>' +
        '<div class="profile-facts"><p><b>Tashkilot</b><span data-org></span></p><p><b>Elektron pochta</b><span data-email></span></p><p><b>Holat</b><span data-role></span></p></div>' +
        '<form data-profile-form><label>Ism<input name="name" maxlength="80" minlength="2" required></label><button class="primary-button" type="submit">Profilni saqlash</button></form>' +
        '<section data-members-section hidden><h3>Jamoaga ruxsat berish</h3><div data-member-list></div><form data-invite-form><label>Xodim ismi<input name="name" minlength="2" maxlength="80" required></label><label>Elektron pochta<input name="email" type="email" required></label><button class="outline-button" type="submit">A’zo qo‘shish</button></form><small>A’zo o‘z pochtasiga yuborilgan kod bilan kiradi. Kabinetdagi ishlar jamoaga umumiy.</small></section>' +
        '<p role="status" data-profile-status></p><button class="outline-button full" type="button" data-logout>Chiqish</button>';
      document.body.append(dialog);
      dialog.querySelector('[data-close-profile]').onclick = () => dialog.close();
      dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
      dialog.querySelector('[data-logout]').onclick = async () => {
        try { await api('logout', {}); window.location.reload(); }
        catch (error) { dialog.querySelector('[data-profile-status]').textContent = error.message; }
      };
      dialog.querySelector('[data-profile-form]').onsubmit = async event => {
        event.preventDefault();
        try {
          await api('me', { name: event.currentTarget.elements.name.value.trim() });
          dialog.querySelector('[data-profile-status]').textContent = 'Profil saqlandi.';
        } catch (error) { dialog.querySelector('[data-profile-status]').textContent = error.message; }
      };
      dialog.querySelector('[data-invite-form]').onsubmit = async event => {
        event.preventDefault();
        try {
          await api('members', { name: event.currentTarget.elements.name.value.trim(), email: event.currentTarget.elements.email.value.trim() });
          event.currentTarget.reset();
          dialog.querySelector('[data-profile-status]').textContent = 'A’zo qo‘shildi. U o‘z pochtasi orqali kod so‘rab kiradi.';
          await loadMembers();
        } catch (error) { dialog.querySelector('[data-profile-status]').textContent = error.message; }
      };
    }

    async function loadMembers() {
      const result = await api('members');
      const list = dialog.querySelector('[data-member-list]');
      list.replaceChildren(...result.members.map(member => {
        const line = document.createElement('p');
        line.textContent = member.name + ' · ' + member.email + ' · ' +
          (member.verified_at ? 'tasdiqlangan' : 'tasdiqlash kutilmoqda');
        return line;
      }));
    }

    for (const trigger of [document.querySelector('.top-avatar'), document.querySelector('.sidebar-foot .profile')]) {
      trigger.style.cursor = 'pointer';
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('tabindex', '0');
      trigger.setAttribute('aria-label', 'Shaxsiy kabinetni ochish');
      trigger.onclick = () => dialog.showModal();
      trigger.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); dialog.showModal(); } };
    }
    try {
      const profile = await api('me');
      dialog.querySelector('[data-org]').textContent = profile.organization;
      dialog.querySelector('[data-email]').textContent = profile.email;
      dialog.querySelector('[data-role]').textContent = profile.role === 'owner' ? 'Egasi · tasdiqlangan' : 'A’zo · tasdiqlangan';
      dialog.querySelector('[data-profile-form] input').value = profile.name;
      document.querySelector('.sidebar-foot .profile b').textContent = profile.name;
      document.querySelector('.sidebar-foot .profile small').textContent = profile.organization;
      document.querySelector('.workspace b').textContent = profile.organization;
      if (profile.role === 'owner') {
        dialog.querySelector('[data-members-section]').hidden = false;
        await loadMembers();
      }
    } catch (error) { dialog.querySelector('[data-profile-status]').textContent = error.message; }
  });
})();

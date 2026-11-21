/* Model catalogue is fetched only after DODA login. Keys never reach this page. */
(() => {
  let selected = null;
  window.DodaModelSelection = () => selected ? { ...selected } : {};

  window.addEventListener('doda:live', async () => {
    if (document.querySelector('.model-toolbar')) return;
    const bar = document.createElement('div');
    bar.className = 'model-toolbar';
    const label = document.createElement('label');
    label.textContent = 'AI modeli ';
    const picker = document.createElement('select');
    picker.setAttribute('aria-label', 'DODA AI modelini tanlash');
    const status = document.createElement('small');
    status.setAttribute('role', 'status');
    status.textContent = 'Modellar olinmoqda…';
    const automatic = new Option('Avtomatik tartib', '');
    picker.add(automatic);
    picker.disabled = true;
    label.append(picker);
    bar.append(label, status);
    document.querySelector('.conversation .section-head').after(bar);

    try {
      const [configResponse, modelsResponse] = await Promise.all([
        fetch('/api/ai/status', { credentials: 'same-origin' }),
        fetch('/api/ai/models', { credentials: 'same-origin' })
      ]);
      if (!configResponse.ok || !modelsResponse.ok) throw Error('Model ro‘yxatini olib bo‘lmadi');
      const config = await configResponse.json();
      const catalogue = await modelsResponse.json();
      const configured = config.order.filter(name => config.configured[name]);
      automatic.textContent = 'Avtomatik: ' + (configured.join(' → ') || 'AI sozlanmagan');
      const choices = [];
      for (const provider of ['openai', 'gemini', 'claude']) {
        const rows = catalogue.models?.[provider] || [];
        if (!rows.length) continue;
        const group = document.createElement('optgroup');
        group.label = { openai: 'OpenAI', gemini: 'Google Gemini', claude: 'Anthropic Claude' }[provider];
        for (const row of rows) {
          const index = String(choices.length);
          choices.push({ provider, model: row.id });
          const option = new Option(row.label === row.id ? row.id : row.label + ' · ' + row.id, index);
          group.append(option);
        }
        picker.append(group);
      }
      picker.disabled = false;
      picker.onchange = () => {
        selected = picker.value === '' ? null : choices[Number(picker.value)];
        status.textContent = selected
          ? 'Tanlangan model ishlatiladi; zaxira xizmatga o‘tilmaydi.'
          : 'Vaqtinchalik xatoda keyingi xizmatga o‘tiladi.';
      };
      status.textContent = Object.keys(catalogue.errors || {}).length
        ? 'Ba’zi xizmatlar model ro‘yxatini qaytarmadi. Avtomatik tartib ishlashi mumkin.'
        : 'Vaqtinchalik xatoda keyingi xizmatga o‘tiladi.';
    } catch (error) {
      status.textContent = error.message + '. Serverdagi avtomatik tartib ishlaydi.';
    }
  });
})();

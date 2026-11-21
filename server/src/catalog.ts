/**
 * Rol katalogi: har bir rol uchun vazifalar, vositalar va tipik holatlar.
 * DODA tavsiyasi = rec:true (oldindan belgilanadi). Foydalanuvchi har birini olib tashlashi yoki qo'shishi mumkin.
 * status "soon": vosita hali ulanmagan (tanlab bo'lmaydi, lekin ro'yxatda ko'rinadi). approval: ishlatishdan oldin inson tasdig'i kerak.
 */
export type GroupId = "duties" | "tools" | "situations";
export type Lang = "uz" | "ru";

export interface CatItem {
  id: string;
  label: Record<Lang, string>;
  desc: Record<Lang, string>;
  rec: boolean;
  status: "ready" | "soon";
  approval: boolean;
}
export interface CatGroup { id: GroupId; items: CatItem[] }
export interface RoleCatalog { id: string; groups: CatGroup[] }

type Row = [id: string, uz: string, ru: string, uzDesc: string, ruDesc: string, flags?: string];
// flags: "r" = tavsiya, "s" = tez orada, "a" = tasdiq talab qiladi

const mk = (rows: Row[]): CatItem[] =>
  rows.map(([id, uz, ru, uzD, ruD, f = ""]) => ({
    id, label: { uz, ru }, desc: { uz: uzD, ru: ruD }, rec: f.includes("r"), status: f.includes("s") ? "soon" : "ready", approval: f.includes("a"),
  }));

// ---- Hamma rollarga umumiy ichki vositalar (hozir ishlaydi) ----
const CORE_TOOLS: Row[] = [
  ["t_files", "Ishchi maydon fayllari", "Файлы рабочей области", "Ruxsat berilgan fayllarni o‘qish va hujjat yozish.", "Чтение разрешённых файлов и подготовка документов.", "r"],
  ["t_todo", "To‘-do ro‘yxat", "To-do список", "Agentning o‘z ro‘yxati: vazifa qo‘shish, belgilash.", "Собственный список агента: добавление и отметка задач.", "r"],
  ["t_memory", "Xotira", "Память", "Faktlar va saboqlarni eslab qolish va keyin ishlatish.", "Запоминание фактов и уроков и их использование позже.", "r"],
  ["t_text", "Matn va g‘oya yaratish", "Создание текстов и идей", "Qoralama, variantlar, tahrir va qisqartirish.", "Черновики, варианты, правка и сокращение.", "r"],
  ["t_passport", "Vazifa pasporti", "Паспорт задачи", "Maqsadni 5 bosqich va checklistga aylantirish.", "Превращение цели в 5 этапов и чек-лист.", "r"],
];

const CATALOG: Record<string, RoleCatalog> = {
  marketing: {
    id: "marketing",
    groups: [
      { id: "duties", items: mk([
        ["d_plan", "Kontent-reja tuzish", "Составление контент-плана", "Hafta va oy uchun mavzular, formatlar, chastota.", "Темы, форматы и частота на неделю и месяц.", "r"],
        ["d_copy", "Post va reklama matnlari", "Тексты постов и рекламы", "Turli platformalar uchun matnlar va variantlar.", "Тексты и варианты для разных платформ.", "r"],
        ["d_headline", "Sarlavha va chaqiriq (CTA) variantlari", "Заголовки и призывы (CTA)", "A/B uchun bir nechta variant.", "Несколько вариантов для A/B.", "r"],
        ["d_audience", "Auditoriya va segmentlar tahlili", "Анализ аудитории и сегментов", "Kim, nima istaydi, qaysi kanalda.", "Кто, чего хочет, в каком канале.", "r"],
        ["d_position", "Pozitsiyalash va brend ovozi", "Позиционирование и голос бренда", "Va'da, ohang, so‘zlar lug‘ati.", "Обещание, тон, словарь.", ""],
        ["d_campaign", "Kampaniya rejasi va byudjet taqsimoti", "План кампании и распределение бюджета", "Maqsad, kanal, muddat, mablag‘.", "Цель, канал, срок, бюджет.", ""],
        ["d_seo", "SEO va kalit so‘zlar", "SEO и ключевые слова", "Kalit so‘zlar ro‘yxati va sahifa tavsiyalari.", "Список ключевых слов и рекомендации по страницам.", ""],
        ["d_email", "Email va xabarnoma ketma-ketligi", "Email- и push-цепочки", "Kutib olish, eslatma, qayta faollashtirish.", "Приветствие, напоминание, реактивация.", ""],
        ["d_report", "Natijalar hisoboti va xulosalar", "Отчёт по результатам и выводы", "Nima ishladi, nima ishlamadi, keyingi qadam.", "Что сработало, что нет, следующий шаг.", "r"],
        ["d_competitor", "Raqobatchilar tahlili", "Анализ конкурентов", "Taklif, narx, pozitsiya, kuchli va zaif tomonlar.", "Предложение, цена, позиция, сильные и слабые стороны.", ""],
      ]) },
      { id: "tools", items: mk([
        ...CORE_TOOLS,
        ["t_visual", "Dizayner uchun vizual brief", "Визуальный бриф для дизайнера", "Rasm yaratish emas, aniq texnik topshiriq matni.", "Не создание картинок, а чёткое ТЗ в тексте.", ""],
        ["t_calendar", "Kontent kalendari", "Контент-календарь", "Jadval bo‘yicha chiqish sanalari.", "Даты выхода по расписанию.", "s"],
        ["t_search", "Internetdan qidiruv", "Поиск в интернете", "Raqobatchi va trendlarni topish.", "Поиск конкурентов и трендов.", "s"],
        ["t_analytics", "Statistika ulanishi", "Подключение аналитики", "Ko‘rishlar, bosishlar, konversiya.", "Просмотры, клики, конверсия.", "s"],
        ["t_publish", "Ijtimoiy tarmoqqa chop etish", "Публикация в соцсетях", "Tasdiqdan keyin avtomatik joylash.", "Автопубликация после подтверждения.", "sa"],
        ["t_email", "Email yuborish", "Отправка email", "Tasdiqdan keyin xat yuborish.", "Отправка писем после подтверждения.", "sa"],
      ]) },
      { id: "situations", items: mk([
        ["s_launch", "Yangi mahsulot yoki xizmat chiqishi", "Запуск нового продукта или услуги", "Chiqishgacha va chiqishdan keyingi reja.", "План до и после запуска.", "r"],
        ["s_low", "Faollik pasayganda", "Когда активность падает", "Sabablarni topish va qayta jonlantirish.", "Поиск причин и оживление.", "r"],
        ["s_crisis", "Salbiy sharh yoki inqiroz", "Негативный отзыв или кризис", "Xotirjam, tasdiqlangan javob matnlari.", "Спокойные, согласованные ответы.", "r"],
        ["s_season", "Bayram va mavsumiy aksiya", "Праздники и сезонные акции", "Oldindan reja va taklif.", "Предварительный план и предложение.", ""],
        ["s_comp", "Raqobatchi yangi taklif chiqarganda", "Конкурент выпустил новое предложение", "Tezkor tahlil va javob variantlari.", "Быстрый анализ и варианты ответа.", ""],
        ["s_budget", "Byudjet qisqarganda", "Когда бюджет сокращён", "Eng samarali 20% ni saqlab qolish.", "Сохранить самые эффективные 20%.", ""],
      ]) },
    ],
  },
  hr: {
    id: "hr",
    groups: [
      { id: "duties", items: mk([
        ["d_vacancy", "Vakansiya matnlari", "Тексты вакансий", "Aniq talab, shart va mas’uliyat.", "Чёткие требования, условия и обязанности.", "r"],
        ["d_screen", "Rezyumeni saralash mezonlari", "Критерии отбора резюме", "Majburiy va qo‘shimcha talablar jadvali.", "Таблица обязательных и желательных требований.", "r"],
        ["d_interview", "Suhbat savollari va baholash varag‘i", "Вопросы интервью и оценочный лист", "Rol bo‘yicha savollar va ball tizimi.", "Вопросы по роли и система баллов.", "r"],
        ["d_onboard", "Adaptatsiya rejasi", "План адаптации", "Birinchi kun, hafta va oy.", "Первый день, неделя и месяц.", "r"],
        ["d_policy", "Ichki qoidalar va yo‘riqnomalar", "Внутренние правила и инструкции", "Tushunarli, qisqa hujjatlar.", "Понятные и краткие документы.", ""],
        ["d_review", "Xodimlarni baholash", "Оценка сотрудников", "Mezonlar, so‘rovnoma, tahlil.", "Критерии, опросник, анализ.", ""],
        ["d_letters", "Xat va buyruq loyihalari", "Проекты писем и приказов", "Rasmiy matn qoralamalari.", "Черновики официальных текстов.", ""],
        ["d_pulse", "Jamoa faolligi so‘rovnomalari", "Опросы вовлечённости", "Qisqa so‘rovnoma va xulosa.", "Короткий опрос и выводы.", ""],
      ]) },
      { id: "tools", items: mk([
        ...CORE_TOOLS,
        ["t_templates", "Hujjat shablonlari", "Шаблоны документов", "Ishchi maydondagi shablonlardan foydalanish.", "Использование шаблонов из рабочей области.", ""],
        ["t_calendar", "Suhbatlar kalendari", "Календарь интервью", "Uchrashuv vaqtlarini rejalash.", "Планирование времени встреч.", "s"],
        ["t_ats", "Nomzodlar bazasi ulanishi", "Подключение базы кандидатов", "ATS bilan sinxronlash.", "Синхронизация с ATS.", "s"],
        ["t_email", "Nomzodga xat yuborish", "Письма кандидатам", "Tasdiqdan keyin yuborish.", "Отправка после подтверждения.", "sa"],
      ]) },
      { id: "situations", items: mk([
        ["s_newhire", "Yangi xodim keldi", "Пришёл новый сотрудник", "Hujjatlar, tanishuv, birinchi vazifalar.", "Документы, знакомство, первые задачи.", "r"],
        ["s_resign", "Xodim ketmoqda", "Сотрудник увольняется", "Topshirish rejasi va suhbat.", "План передачи дел и интервью.", "r"],
        ["s_mass", "Ommaviy yollash", "Массовый найм", "Jarayon va vaqt jadvali.", "Процесс и график.", ""],
        ["s_conflict", "Jamoada nizo", "Конфликт в коллективе", "Xolis bayon va yechim variantlari.", "Нейтральное изложение и варианты решения.", ""],
        ["s_reorg", "Tuzilma o‘zgarishi", "Изменение структуры", "Xabarnoma va savol-javoblar.", "Уведомление и ответы на вопросы.", ""],
      ]) },
    ],
  },
  it: {
    id: "it",
    groups: [
      { id: "duties", items: mk([
        ["d_code", "Kod yozish va tushuntirish", "Написание и объяснение кода", "Qisqa, ishlaydigan misollar.", "Короткие рабочие примеры.", "r"],
        ["d_debug", "Xatolarni topish", "Поиск ошибок", "Sabab, qayta ishlab chiqarish, tuzatish.", "Причина, воспроизведение, исправление.", "r"],
        ["d_arch", "Arxitektura va qaror hujjatlari", "Архитектура и документы решений", "Variantlar, afzallik va xavflar.", "Варианты, плюсы и риски.", "r"],
        ["d_review", "Kod ko‘rigi (ro‘yxat bo‘yicha)", "Код-ревью (по чек-листу)", "Aniq izohlar, xavfli joylar.", "Конкретные замечания, рискованные места.", "r"],
        ["d_security", "Xavfsizlik tekshiruvi ro‘yxati", "Чек-лист безопасности", "Tipik zaifliklar bo‘yicha tekshiruv.", "Проверка по типовым уязвимостям.", ""],
        ["d_docs", "Texnik hujjat", "Техническая документация", "README, yo‘riqnoma, API tavsifi.", "README, инструкции, описание API.", ""],
        ["d_auto", "Skript va avtomatlashtirish", "Скрипты и автоматизация", "Takroriy ishlarni skriptga aylantirish.", "Превращение рутины в скрипты.", ""],
        ["d_deploy", "Server va deploy yo‘riqnomasi", "Инструкция по серверу и деплою", "Qadamma-qadam, orqaga qaytarish bilan.", "Шаг за шагом, с откатом.", ""],
      ]) },
      { id: "tools", items: mk([
        ...CORE_TOOLS,
        ["t_repo", "Repozitoriyga ulanish", "Подключение репозитория", "Kodni o‘qish va o‘zgarish taklif qilish.", "Чтение кода и предложение изменений.", "s"],
        ["t_run", "Kodni xavfsiz ishga tushirish", "Безопасный запуск кода", "Izolyatsiya qilingan muhitda sinash.", "Проверка в изолированной среде.", "s"],
        ["t_search", "Hujjat va xatolar qidiruvi", "Поиск документации и ошибок", "Internetdan manba topish.", "Поиск источников в интернете.", "s"],
        ["t_shell", "Terminal buyruqlari", "Команды терминала", "Faqat tasdiqdan keyin.", "Только после подтверждения.", "sa"],
      ]) },
      { id: "situations", items: mk([
        ["s_incident", "Ishdan chiqish (insident)", "Сбой (инцидент)", "Tezkor tashxis, xabar, keyingi tahlil.", "Быстрая диагностика, уведомление, разбор.", "r"],
        ["s_feature", "Yangi funksiya", "Новая функциональность", "Talab, reja, sinov.", "Требования, план, тесты.", "r"],
        ["s_migrate", "Ko‘chirish (migratsiya)", "Миграция", "Xavfsiz o‘tish va qaytish rejasi.", "План безопасного перехода и отката.", ""],
        ["s_debt", "Texnik qarz", "Технический долг", "Ustuvorlik va bosqichma-bosqich tozalash.", "Приоритеты и поэтапная очистка.", ""],
        ["s_onboard", "Yangi dasturchi keldi", "Пришёл новый разработчик", "Muhit, hujjat, birinchi vazifa.", "Окружение, документация, первая задача.", ""],
      ]) },
    ],
  },
  sales: {
    id: "sales",
    groups: [
      { id: "duties", items: mk([
        ["d_offer", "Tijoriy taklif", "Коммерческое предложение", "Mijoz muammosiga mos, aniq narx va shart.", "Под проблему клиента, с ценой и условиями.", "r"],
        ["d_outreach", "Mijozga xatlar", "Письма клиентам", "Birinchi xat, eslatma, yakuniy.", "Первое письмо, напоминание, финальное.", "r"],
        ["d_objection", "E’tirozlarga javoblar", "Ответы на возражения", "Narx, vaqt, ishonch bo‘yicha.", "По цене, срокам, доверию.", "r"],
        ["d_script", "Qo‘ng‘iroq skripti", "Скрипт звонка", "Ochilish, savollar, yopish.", "Открытие, вопросы, закрытие.", "r"],
        ["d_follow", "Follow-up reja", "План follow-up", "Qachon, nima deb yozish.", "Когда и что написать.", "r"],
        ["d_pipeline", "Voronka tahlili", "Анализ воронки", "Qayerda mijoz yo‘qoladi.", "Где теряются клиенты.", ""],
        ["d_pricing", "Narx va chegirma tavsiyasi", "Рекомендации по цене и скидкам", "Qoidalar va chegaralar bilan.", "С правилами и ограничениями.", ""],
        ["d_research", "Mijoz kompaniyasini o‘rganish", "Изучение компании клиента", "Qisqa profil va uchrashuv savollari.", "Краткий профиль и вопросы для встречи.", ""],
      ]) },
      { id: "tools", items: mk([
        ...CORE_TOOLS,
        ["t_crm", "CRM ulanishi", "Подключение CRM", "Mijozlar va bitimlar bilan ishlash.", "Работа с клиентами и сделками.", "s"],
        ["t_search", "Internetdan qidiruv", "Поиск в интернете", "Kompaniya va yangiliklar.", "Компании и новости.", "s"],
        ["t_calendar", "Uchrashuv kalendari", "Календарь встреч", "Vaqt belgilash.", "Назначение времени.", "s"],
        ["t_email", "Email yuborish", "Отправка email", "Tasdiqdan keyin yuborish.", "Отправка после подтверждения.", "sa"],
      ]) },
      { id: "situations", items: mk([
        ["s_cold", "Sovuq mijoz", "Холодный лид", "Qiziqish uyg‘otuvchi birinchi xabar.", "Первое сообщение, вызывающее интерес.", "r"],
        ["s_price", "“Qimmat” deyilganda", "Когда говорят «дорого»", "Qiymatni ko‘rsatish va variantlar.", "Показать ценность и дать варианты.", "r"],
        ["s_lost", "Bitim yo‘qotildi", "Сделка потеряна", "Sabab tahlili va qayta aloqa.", "Анализ причины и повторный контакт.", ""],
        ["s_renew", "Shartnomani yangilash", "Продление договора", "Vaqtida eslatma va taklif.", "Своевременное напоминание и предложение.", ""],
        ["s_big", "Katta bitim", "Крупная сделка", "Ko‘p bosqichli reja va manfaatdorlar.", "Многоэтапный план и заинтересованные стороны.", ""],
      ]) },
    ],
  },
  analyst: {
    id: "analyst",
    groups: [
      { id: "duties", items: mk([
        ["d_summary", "Ma’lumotni tartibga solish va xulosa", "Структурирование данных и выводы", "Muhim narsani ajratib ko‘rsatish.", "Выделение главного.", "r"],
        ["d_compare", "Taqqoslash", "Сравнение", "Variantlar, davrlar, segmentlar.", "Варианты, периоды, сегменты.", "r"],
        ["d_trend", "Tendensiyalarni topish", "Поиск тенденций", "O‘sish, pasayish, mavsumiylik.", "Рост, падение, сезонность.", "r"],
        ["d_kpi", "KPI va ko‘rsatkichlar tizimi", "Система KPI и показателей", "Nimani o‘lchash va qanday.", "Что измерять и как.", "r"],
        ["d_report", "Hisobot tayyorlash", "Подготовка отчётов", "Qisqa xulosa, asoslar, keyingi qadam.", "Краткий вывод, обоснования, следующий шаг.", "r"],
        ["d_clean", "Ma’lumotni tozalash tavsiyalari", "Рекомендации по очистке данных", "Xatolar, takrorlar, bo‘sh joylar.", "Ошибки, дубли, пропуски.", ""],
        ["d_forecast", "Oddiy bashorat", "Простой прогноз", "Taxmin va ishonchlilik darajasi bilan.", "С допущениями и уровнем уверенности.", ""],
        ["d_reco", "Qaror uchun tavsiyalar", "Рекомендации для решений", "Variantlar va xavflar.", "Варианты и риски.", ""],
      ]) },
      { id: "tools", items: mk([
        ...CORE_TOOLS,
        ["t_sheet", "Jadval bilan ishlash", "Работа с таблицами", "Formula va hisob-kitoblar.", "Формулы и расчёты.", "s"],
        ["t_chart", "Diagramma chizish", "Построение диаграмм", "Ma’lumotni ko‘rgazmali qilish.", "Наглядное представление данных.", "s"],
        ["t_search", "Tashqi manbalardan qidiruv", "Поиск во внешних источниках", "Bozor va statistika.", "Рынок и статистика.", "s"],
      ]) },
      { id: "situations", items: mk([
        ["s_month", "Oylik hisobot", "Ежемесячный отчёт", "Doimiy tuzilma va taqqoslash.", "Постоянная структура и сравнение.", "r"],
        ["s_anomaly", "Kutilmagan o‘zgarish", "Неожиданное изменение", "Sabab farazlari va tekshiruv.", "Гипотезы причин и проверка.", "r"],
        ["s_metric", "Yangi ko‘rsatkich kiritish", "Введение новой метрики", "Ta’rif va hisoblash qoidasi.", "Определение и правило расчёта.", ""],
        ["s_decision", "Qaror qabul qilish", "Принятие решения", "Dalillar va variantlar jadvali.", "Таблица доказательств и вариантов.", ""],
        ["s_audit", "Tekshiruv (audit)", "Проверка (аудит)", "Tartibli, izlanadigan xulosa.", "Упорядоченные, отслеживаемые выводы.", ""],
      ]) },
    ],
  },
  general: {
    id: "general",
    groups: [
      { id: "duties", items: mk([
        ["d_research", "Ma’lumot yig‘ish va xulosa", "Сбор информации и выводы", "Berilgan manbadan qisqa xulosa.", "Краткий вывод из данного источника.", "r"],
        ["d_write", "Matn yozish va tahrirlash", "Написание и редактирование текстов", "Qoralama, qisqartirish, ohang.", "Черновик, сокращение, тон.", "r"],
        ["d_plan", "Reja tuzish", "Составление плана", "Bosqich, muddat, mas’ul.", "Этапы, сроки, ответственные.", "r"],
        ["d_check", "Checklist tuzish", "Составление чек-листа", "Tekshiriladigan qadamlar ro‘yxati.", "Список проверяемых шагов.", "r"],
        ["d_translate", "Tarjima (uzbek va rus)", "Перевод (узбекский и русский)", "Ma’noni saqlagan holda.", "С сохранением смысла.", ""],
      ]) },
      { id: "tools", items: mk([...CORE_TOOLS, ["t_search", "Internetdan qidiruv", "Поиск в интернете", "Manba topish.", "Поиск источников.", "s"]]) },
      { id: "situations", items: mk([
        ["s_urgent", "Shoshilinch topshiriq", "Срочное задание", "Eng qisqa yo‘l bilan tayyor natija.", "Готовый результат кратчайшим путём.", "r"],
        ["s_unclear", "Topshiriq noaniq", "Задание неясно", "Avval aniqlashtiruvchi savollar.", "Сначала уточняющие вопросы.", "r"],
        ["s_repeat", "Takroriy ish", "Повторяющаяся работа", "Shablon va doimiy qoidalar.", "Шаблон и постоянные правила.", ""],
      ]) },
    ],
  },
};

export function catalogFor(template: string | null | undefined): RoleCatalog {
  return (template && CATALOG[template]) || CATALOG.general!;
}

export function localized(cat: RoleCatalog, lang: Lang) {
  return {
    id: cat.id,
    groups: cat.groups.map((g) => ({
      id: g.id,
      items: g.items.map((i) => ({ id: i.id, label: i.label[lang], desc: i.desc[lang], rec: i.rec, status: i.status, approval: i.approval })),
    })),
  };
}

export const allItemIds = (cat: RoleCatalog): Set<string> => new Set(cat.groups.flatMap((g) => g.items.map((i) => i.id)));
export const recommendedIds = (cat: RoleCatalog): string[] => cat.groups.flatMap((g) => g.items.filter((i) => i.rec && i.status === "ready").map((i) => i.id));
export const selectableIds = (cat: RoleCatalog): Set<string> => new Set(cat.groups.flatMap((g) => g.items.filter((i) => i.status === "ready").map((i) => i.id)));

/** Matndan eng mos shablonni topadi (AI siz, kalit so'zlar bo'yicha). Topilmasa "general". */
const HINTS: Array<[string, string[]]> = [
  ["marketing", ["marketing", "маркетинг", "reklama", "реклам", "smm", "kontent", "контент", "brend", "бренд", "instagram", "seo"]],
  ["hr", ["hr", "кадр", "персонал", "xodim", "сотрудник", "yollash", "найм", "vakansiya", "вакансия", "rezyume", "резюме"]],
  ["it", ["it ", "dastur", "разработ", "программ", "kod", "код", "server", "сервер", "devops", "texnik", "техническ", "backend", "frontend"]],
  ["sales", ["sotuv", "продаж", "mijoz", "клиент", "crm", "taklif", "предложени", "bitim", "сделк"]],
  ["analyst", ["tahlil", "аналит", "analitik", "hisobot", "отчёт", "отчет", "statistik", "статист", "kpi", "ma'lumot", "данн"]],
];
export function suggestTemplate(text: string): string {
  const q = ` ${text.toLowerCase()} `;
  let best = "general";
  let score = 0;
  for (const [id, words] of HINTS) {
    const s = words.filter((w) => q.includes(w)).length;
    if (s > score) { score = s; best = id; }
  }
  return best;
}

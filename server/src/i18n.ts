export type Locale = "uz" | "ru";

const messages = {
  invalid_input: { uz: "Ma'lumotlar noto'g'ri kiritilgan.", ru: "Данные введены неверно." },
  consent_required: {
    uz: "Davom etish uchun barcha majburiy rozilik va shartlarni qabul qiling.",
    ru: "Для продолжения примите все обязательные согласия и условия.",
  },
  weak_password: {
    uz: "Parol kamida 10 ta belgidan iborat bo'lishi kerak.",
    ru: "Пароль должен содержать не менее 10 символов.",
  },
  check_email: {
    uz: "Pochtangizni tekshiring: tasdiqlash havolasi yuborildi.",
    ru: "Проверьте почту: ссылка для подтверждения отправлена.",
  },
  invalid_credentials: { uz: "Email yoki parol noto'g'ri.", ru: "Неверный email или пароль." },
  email_not_verified: {
    uz: "Avval pochtangizni tasdiqlang.",
    ru: "Сначала подтвердите почту.",
  },
  invalid_token: {
    uz: "Havola yaroqsiz yoki muddati tugagan.",
    ru: "Ссылка недействительна или срок её действия истёк.",
  },
  unauthorized: { uz: "Tizimga kiring.", ru: "Войдите в систему." },
  too_many_requests: {
    uz: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.",
    ru: "Слишком много попыток. Повторите позже.",
  },
  forbidden_origin: { uz: "Ruxsat berilmagan manba.", ru: "Источник запроса не разрешён." },
  budget_exceeded: {
    uz: "Bu oy uchun sarf limiti tugadi. Limit keyingi oyda yangilanadi.",
    ru: "Лимит расходов на этот месяц исчерпан. Он обновится в следующем месяце.",
  },
  llm_unavailable: {
    uz: "Suhbat xizmati hozir mavjud emas. Birozdan keyin qayta urinib ko‘ring.",
    ru: "Сервис диалога сейчас недоступен. Повторите попытку позже.",
  },
  llm_rate_limited: {
    uz: "AI xizmatining so‘rovlar chegarasiga yetildi (kalitingiz limiti). Bir daqiqadan keyin qayta urinib ko‘ring yoki hisobingizni tekshiring.",
    ru: "Достигнут лимит запросов ИИ-сервиса (лимит вашего ключа). Повторите через минуту или проверьте счёт.",
  },
  llm_not_configured: { uz: "AI kaliti serverda sozlanmagan. Administrator GEMINI_API_KEY ni qo‘shishi kerak.", ru: "Ключ ИИ не настроен на сервере. Администратору нужно добавить GEMINI_API_KEY." },
  llm_auth: { uz: "AI kalitingiz qabul qilinmadi yoki hisobingizda mablag‘ yo‘q. Sozlamalarda “AI kalitlari” ni tekshiring.", ru: "Ваш ключ ИИ не принят или на счёте нет средств. Проверьте «Ключи ИИ» в настройках." },
  api_key_required: { uz: "Boshlash uchun o‘z AI kalitingizni ulang (Anthropic, Google Gemini yoki OpenAI). Xarajatlar shaxsiy hisobingizdan yechiladi.", ru: "Чтобы начать, подключите свой ключ ИИ (Anthropic, Google Gemini или OpenAI). Расходы списываются с вашего личного счёта." },
  keys_not_configured: { uz: "Kalitlarni saqlash serverda sozlanmagan (KEYS_SECRET). Administratorga murojaat qiling.", ru: "Хранение ключей не настроено на сервере (KEYS_SECRET). Обратитесь к администратору." },
  key_invalid_format: { uz: "Kalit formati noto‘g‘ri. To‘liq nusxa oling (bo‘sh joysiz).", ru: "Неверный формат ключа. Скопируйте полностью (без пробелов)." },
  key_rejected: { uz: "Provayder bu kalitni qabul qilmadi (noto‘g‘ri yoki o‘chirilgan). Yangi kalit oling.", ru: "Провайдер не принял этот ключ (неверный или отозван). Получите новый." },
  key_check_failed: { uz: "Kalit tekshiruvdan o‘tmadi: hisobda mablag‘ yo‘q, hudud cheklovi yoki so‘rov rad etilgan bo‘lishi mumkin. Hisobingizni tekshiring yoki “Tekshirmasdan saqlash” ni tanlang.", ru: "Ключ не прошёл проверку: возможно, на счёте нет средств, ограничение региона или запрос отклонён. Проверьте счёт или выберите «Сохранить без проверки»." },
  key_check_unreachable: { uz: "Provayderga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring yoki “Tekshirmasdan saqlash” ni tanlang.", ru: "Не удалось связаться с провайдером. Повторите позже или выберите «Сохранить без проверки»." },
  llm_empty: {
    uz: "Model bu so‘rovga javob qaytarmadi. Savolni boshqacha ifodalab ko‘ring.",
    ru: "Модель не вернула ответ на этот запрос. Попробуйте переформулировать вопрос.",
  },
  invalid_path: {
    uz: "Fayl yo‘li noto‘g‘ri. Faqat harf, raqam, probel, “-”, “_”, “.” va “/” (ko‘pi bilan 4 daraja) va .md yoki .txt kengaytmasi mumkin.",
    ru: "Недопустимый путь к файлу. Допустимы буквы, цифры, пробел, «-», «_», «.», «/» (не более 4 уровней) и расширение .md или .txt.",
  },
  file_too_large: { uz: "Fayl juda katta (ko‘pi bilan 64 KB).", ru: "Файл слишком большой (не более 64 КБ)." },
  too_many_files: { uz: "Fayllar soni chegarasiga yetildi (200 ta).", ru: "Достигнут лимит числа файлов (200)." },
  storage_full: { uz: "Ishchi maydon hajmi chegarasiga yetildi (5 MB).", ru: "Достигнут лимит объёма рабочей области (5 МБ)." },
  conflict: {
    uz: "Fayl siz ochganingizdan keyin o‘zgargan (masalan, DODA yozgan). Faylni qayta oching va o‘zgarishni qayta kiriting.",
    ru: "Файл изменился после того, как вы его открыли (например, записал DODA). Откройте файл заново и повторите правку.",
  },
  too_many_tasks: { uz: "Vazifalar soni chegarasiga yetildi (100 ta). Eskilarini arxivlang yoki o‘chiring.", ru: "Достигнут лимит задач (100). Архивируйте или удалите старые." },
  too_many_agents: { uz: "Agentlar soni chegarasiga yetildi (20 ta). Keraksizini o‘chiring.", ru: "Достигнут лимит агентов (20). Удалите ненужных." },
  agent_empty: { uz: "Agent bo‘sh javob qaytardi. Topshiriqni aniqroq yozib, qayta urinib ko‘ring.", ru: "Агент вернул пустой ответ. Уточните задание и повторите." },
  voice_consent_required: { uz: "Ovozli kiritish uchun avval rozilik bering.", ru: "Для голосового ввода сначала дайте согласие." },
  audio_invalid: { uz: "Ovoz yozuvi noto‘g‘ri yoki juda katta. Qisqaroq gapirib, qayta urinib ko‘ring.", ru: "Запись голоса некорректна или слишком большая. Скажите короче и повторите." },
  too_many_memory: { uz: "Xotira to‘ldi (100 ta yozuv). Keraksizlarini o‘chiring.", ru: "Память заполнена (100 записей). Удалите ненужные." },
  too_many_todos: { uz: "Ro‘yxat to‘ldi (200 ta). Bajarilganlarini tozalang.", ru: "Список заполнен (200). Очистите выполненные." },
  plan_failed: { uz: "Reja tuzib bo‘lmadi. Maqsadni aniqroq yozib, qayta urinib ko‘ring.", ru: "Не удалось составить план. Опишите цель точнее и повторите." },
  not_found: { uz: "Topilmadi.", ru: "Не найдено." },
  server_error: { uz: "Ichki xatolik.", ru: "Внутренняя ошибка." },
} as const;

export type MessageCode = keyof typeof messages;

export function pickLocale(acceptLanguage: string | undefined, fallback: Locale = "uz"): Locale {
  const first = (acceptLanguage ?? "").toLowerCase().split(",")[0] ?? "";
  if (first.startsWith("ru")) return "ru";
  if (first.startsWith("uz")) return "uz";
  return fallback;
}

export function t(code: MessageCode, locale: Locale): string {
  return messages[code][locale];
}

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
    uz: "Google so‘rovlar chegarasiga yetildi (bepul rejim). Bir daqiqadan keyin qayta urinib ko‘ring.",
    ru: "Достигнут лимит запросов Google (бесплатный режим). Повторите через минуту.",
  },
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

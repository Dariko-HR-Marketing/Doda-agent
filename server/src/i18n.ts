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

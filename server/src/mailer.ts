import nodemailer from "nodemailer";
import type { Config } from "./config.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Sinov uchun: xatlarni xotirada saqlaydi */
export class MemoryMailer implements Mailer {
  outbox: Mail[] = [];
  async send(mail: Mail): Promise<void> {
    this.outbox.push(mail);
  }
}

/** Faqat ishlab chiqish uchun: xatni (token bilan) konsolga chiqaradi. Productionda ishlatilmaydi. */
export class ConsoleMailer implements Mailer {
  async send(mail: Mail): Promise<void> {
    console.log(`[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
  }
}

export class SmtpMailer implements Mailer {
  private transport;
  constructor(
    cfg: { host: string; port: number; user?: string; pass?: string },
    private from: string,
  ) {
    this.transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      requireTLS: cfg.port !== 465,
      auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  async send(mail: Mail): Promise<void> {
    await this.transport.sendMail({ from: this.from, to: mail.to, subject: mail.subject, text: mail.text });
  }
}

export function createMailer(config: Config): Mailer {
  if (config.SMTP_HOST) {
    const from = config.MAIL_FROM ?? config.SMTP_USER;
    if (!from) throw new Error("MAIL_FROM yoki SMTP_USER kerak");
    return new SmtpMailer(
      { host: config.SMTP_HOST, port: config.SMTP_PORT, user: config.SMTP_USER, pass: config.SMTP_PASS },
      from,
    );
  }
  if (config.isProd) throw new Error("Productionda SMTP_HOST majburiy (xatlar tokenni oshkor qilmasligi uchun)");
  return new ConsoleMailer();
}

/** Pochta xizmati ishlamasa ham so'rov yiqilmasin: xato logga yoziladi (token/manzilsiz), false qaytadi */
export async function trySend(mailer: Mailer, mail: Mail): Promise<boolean> {
  try {
    await mailer.send(mail);
    return true;
  } catch (e) {
    console.error("[mail] yuborib bo'lmadi:", e instanceof Error ? e.message : e);
    return false;
  }
}

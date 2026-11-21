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

/** Ishlab chiqish uchun: xatni konsolga chiqaradi. Haqiqiy SMTP 1c bosqichida. */
export class ConsoleMailer implements Mailer {
  async send(mail: Mail): Promise<void> {
    console.log(`[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
  }
}

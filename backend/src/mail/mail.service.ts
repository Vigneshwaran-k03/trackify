import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger =  new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from: string = '';

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.from = this.config.get<string>('SMTP_FROM') || (user) || 'no-reply@example.com';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      } as any);
    } else {
      this.logger.warn('SMTP config not fully set. Emails will be skipped.');
    }
  }

  async sendMail(opts: { to: string; subject: string; html?: string; text?: string; attachments?: { filename: string; content: Buffer | Uint8Array; contentType?: string; }[]; }): Promise<boolean> {
    try {
      if (!this.transporter) {
        this.logger.warn(`No transporter; skip mail to ${opts.to} (${opts.subject})`);
        return false;
      }
      await this.transporter.sendMail({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
        attachments: opts.attachments,
      });
      return true;
    } catch (e: any) {
      this.logger.error(`Failed to send mail to ${opts.to}: ${e?.message || e}`);
      return false;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private readonly fromEmail: string;
  private readonly senderName: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('FROM_EMAIL')!;
    this.senderName = this.configService.get<string>('EMAIL_SENDER_NAME')!;
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendEmail(
    toEmail: string,
    subject: string,
    htmlPart: string,
  ): Promise<void> {
    const result = await this.resend.emails.send({
      from: this.fromEmail,
      to: toEmail,
      subject: subject,
      html: htmlPart,
    });
    const error = result.error;
    if (error === null) {
      this.logger.log(
        `Email sent to ${toEmail}. Result: ${JSON.stringify(result)}`,
      );
    } else {
      this.logger.error(`Failed to send email to ${toEmail}`, error);
      throw Error(error.message);
    }
  }
}

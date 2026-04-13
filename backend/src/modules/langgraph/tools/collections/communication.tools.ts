import { z } from 'zod';
import nodemailer from 'nodemailer';
import { safeTool } from '../base/tool.helper';

export interface MailToolDeps {
  mailHost: string;
  mailPort: number;
  mailSecure: boolean;
  mailUser: string;
  mailPass: string;
  mailFrom: string;
}

/**
 * 创建发送邮件工具 — 通过 SMTP 发送邮件
 */
export function createSendMailTool(deps: MailToolDeps) {
  let transporter: nodemailer.Transporter | null = null;

  function getTransporter(): nodemailer.Transporter {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host: deps.mailHost,
        port: deps.mailPort,
        secure: deps.mailSecure,
        auth: { user: deps.mailUser, pass: deps.mailPass },
      });
    }
    return transporter;
  }

  return safeTool(
    'send_mail',
    `发送电子邮件。

何时使用：
- 用户明确要求发送邮件
- 需要将某个结果或报告发送给指定邮箱
- 用户说"帮我发封邮件"、"通知某人"等

注意：
- 必须有明确的收件人邮箱
- 邮件内容应当简洁明确，避免发送空白或无意义的内容`,
    z.object({
      to: z.string().describe('收件人邮箱地址'),
      subject: z.string().describe('邮件主题'),
      body: z.string().describe('邮件正文内容'),
    }),
    async ({ to, subject, body }) => {
      if (!deps.mailHost || !deps.mailUser || !deps.mailPass) {
        return '邮件功能未配置：缺少 MAIL_HOST/MAIL_USER/MAIL_PASS 环境变量。请在 .env 中配置后使用。';
      }

      await getTransporter().sendMail({
        from: deps.mailFrom || deps.mailUser,
        to,
        subject,
        text: body,
        html: `<p>${body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`,
      });

      return `邮件已成功发送到 ${to}，主题为「${subject}」`;
    },
  );
}

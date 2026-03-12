import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: MailOptions) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

export function buildInviteEmail(token: string, baseUrl: string) {
  const link = `${baseUrl}/accept-invite?token=${token}`;
  return {
    subject: "You've been invited to RIO Task",
    html: `<p>Click the link below to accept your invitation and set up your account:</p>
           <a href="${link}">${link}</a>
           <p>This link expires in 48 hours.</p>`,
  };
}

export function buildMagicLinkEmail(token: string, baseUrl: string) {
  const link = `${baseUrl}/auth/magic?token=${token}`;
  return {
    subject: "Your RIO Task magic link",
    html: `<p>Click the link below to sign in. This link expires in 15 minutes.</p>
           <a href="${link}">${link}</a>`,
  };
}

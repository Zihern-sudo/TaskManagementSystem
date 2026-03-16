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

export function buildMentionEmail(
  mentionedByName: string,
  commentContent: string,
  baseUrl: string
) {
  const displayContent = commentContent
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  return {
    subject: `${mentionedByName} mentioned you in a discussion`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <h2 style="font-size:18px;margin-bottom:8px">You were mentioned in a board discussion</h2>
        <p style="margin-bottom:16px">
          <strong>${mentionedByName}</strong> mentioned you:
        </p>
        <blockquote style="border-left:4px solid #3b82f6;padding:12px 16px;background:#eff6ff;margin:0 0 20px;border-radius:4px;color:#374151;font-size:14px">
          ${displayContent}
        </blockquote>
        <a href="${baseUrl}/tasks"
           style="display:inline-block;padding:10px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">
          View Discussion
        </a>
      </div>`,
  };
}

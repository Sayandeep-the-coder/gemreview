import nodemailer from 'nodemailer';

/**
 * Email service using Nodemailer.
 * Supports any SMTP provider (Gmail, Outlook, custom SMTP, etc.)
 * Lazily initializes to avoid crashes when SMTP is not configured.
 */

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      throw new Error('SMTP is not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS');
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendInviteEmail({
  toEmail,
  orgName,
  inviterName,
  role,
  inviteToken,
}: {
  toEmail:     string;
  orgName:     string;
  inviterName: string;
  role:        string;
  inviteToken: string;
}) {
  const mailer   = getTransporter();
  const from     = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@gemreview.dev';
  const inviteUrl = `${process.env.APP_URL ?? 'http://localhost:3001'}/invites/${inviteToken}`;

  await mailer.sendMail({
    from: `GemReview <${from}>`,
    to:   toEmail,
    subject: `You've been invited to join ${orgName} on GemReview`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 0;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:24px;margin:0;color:#111;">💎 GemReview</h1>
        </div>
        <h2 style="font-size:20px;color:#111;">You're invited 🎉</h2>
        <p style="color:#333;line-height:1.6;">
          <strong>${inviterName}</strong> has invited you to join
          <strong>${orgName}</strong> on GemReview as a <strong>${role}</strong>.
        </p>
        <p style="color:#333;line-height:1.6;">
          GemReview is an AI-powered PR review tool that catches bugs, security
          vulnerabilities, and test coverage gaps automatically.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${inviteUrl}"
             style="display:inline-block;background:#000;color:#fff;
                    padding:14px 28px;border-radius:8px;text-decoration:none;
                    font-weight:600;font-size:15px;">
            Accept Invitation
          </a>
        </div>
        <p style="color:#888;font-size:13px;line-height:1.5;">
          This invite expires in 7 days.<br>
          If you didn't expect this email, you can safely ignore it.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#aaa;font-size:12px;text-align:center;">
          GemReview &mdash; AI-powered code reviews
        </p>
      </div>
    `,
  });
}

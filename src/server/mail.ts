import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | undefined;

function getTransport() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
    ...(process.env.SMTP_USER
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
      : {}),
  });
  return transport;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  return getTransport().sendMail({
    from: process.env.MAIL_FROM ?? "Brightloop Billing <billing@brightloop.test>",
    ...opts,
  });
}

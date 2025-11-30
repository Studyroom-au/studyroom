import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      parentName,
      email,
      phone,
      childName,
      yearLevel,
      school,
      serviceType,
      message,
    } = body as {
      parentName: string;
      email: string;
      phone: string;
      childName: string;
      yearLevel: string;
      school?: string;
      serviceType: string;
      message?: string;
    };

    // Transporter using your SMTP settings (Gmail example with app password)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // e.g. "smtp.gmail.com"
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER, // your Gmail address
        pass: process.env.SMTP_PASS, // app password, not your main password
      },
    });

    const mailTo = process.env.MAIL_TO || "contactstudyroomaustralia@gmail.com";

    const textBody = `
New Studyroom enquiry

Parent name: ${parentName}
Email: ${email}
Phone: ${phone}

Child name: ${childName}
Year level: ${yearLevel}
School: ${school || "Not provided"}

Service type: ${serviceType}

Message:
${message || "No message provided."}
`;

    await transporter.sendMail({
      from: `"Studyroom Website" <${process.env.SMTP_USER}>`,
      to: mailTo,
      subject: "New enquiry from Studyroom website",
      text: textBody,
      html: textBody.replace(/\n/g, "<br />"),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

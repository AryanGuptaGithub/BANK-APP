import nodemailer from "nodemailer";
import config from "../config/env.js";
import logger from "./logger.js";

const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.port === 465, // true for 465, false (STARTTLS) for 587
    auth: {
        user: config.email.user,
        pass: config.email.pass,
    },
});

export const sendVerificationOtpEmail = async (toEmail, otp) => {
    await transporter.sendMail({
        from: `"${config.app.name}" <${config.email.from}>`,
        to: toEmail,
        subject: `Your ${config.app.name} verification code`,
        text: `Your verification code is ${otp}. It expires in 10 minutes.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
                <h2>Verify your email</h2>
                <p>Use the code below to verify your ${config.app.name} account. It expires in 10 minutes.</p>
                <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">${otp}</p>
                <p style="color: #666; font-size: 13px;">If you didn't create an account, you can safely ignore this email.</p>
            </div>
        `,
    });

    // Log that an email was sent — never log the OTP value itself
    logger.info("Verification OTP email sent", { to: toEmail });
};
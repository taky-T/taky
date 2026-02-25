const nodemailer = require('nodemailer');

const sendVerificationEmail = async (email, token) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const verificationUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/verify-email/${token}`;

    const mailOptions = {
        from: `"Couch NBS" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'تفعيل حسابك | Verify Your Account',
        html: `
            <div style="font-family: 'Tajawal', sans-serif; direction: rtl; text-align: right; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #6366f1;">مرحباً بك في Couch NBS!</h2>
                <p>شكراً لتسجيلك معنا. لتفعيل حسابك والبدء في استخدام خدماتنا، يرجى الضغط على الزر أدناه:</p>
                <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">تفعيل الحساب</a>
                <p>إذا لم تكن قد قمت بإنشاء حساب، يمكنك تجاهل هذا البريد الإلكتروني.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 0.8rem; color: #888;">Welcome to Couch NBS! Please click the button above to verify your email. If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="font-size: 0.8rem; color: #888;">${verificationUrl}</p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

module.exports = sendVerificationEmail;

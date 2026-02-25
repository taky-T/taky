const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

const sendVerificationEmail = async (email, token) => {
    const transporter = createTransporter();
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

const sendPasswordResetEmail = async (email, token) => {
    const transporter = createTransporter();
    const resetUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password.html?token=${token}`;

    const mailOptions = {
        from: `"Couch NBS" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'إعادة تعيين كلمة المرور | Password Reset',
        html: `
            <div style="font-family: 'Tajawal', sans-serif; direction: rtl; text-align: right; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #6366f1;">إعادة تعيين كلمة المرور</h2>
                <p>لقد طلبت إعادة تعيين كلمة المرور الخاصة بحسابك في Couch NBS. يرجى الضغط على الزر أدناه لتعيين كلمة مرور جديدة:</p>
                <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #ec4899; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">إعادة تعيين كلمة المرور</a>
                <p>إذا لم تكن أنت من طلب هذا، فيمكنك تجاهل هذا البريد الإلكتروني بأمان.</p>
                <p style="color: #ef4444; font-size: 0.9rem;">هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 0.8rem; color: #888;">You are receiving this because you (or someone else) have requested the reset of the password for your account. Please click the button above to reset it. If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="font-size: 0.8rem; color: #888;">${resetUrl}</p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail
};


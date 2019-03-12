import * as nodemailer from "nodemailer";

const { EMAIL_PASSWORD: pass, EMAIL_USER: user } = process.env;

const transporter = nodemailer.createTransport({
  service: "Sparkpost",
  auth: {
    user,
    pass
  }
});

export const sendConfirmationEmail = (email: string, code: string) => {
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "dev") {
    return;
  }
  const mailOptions = {
    to: email,
    from: "no-reply@wobbly.app",
    subject: "Wobbly App - Email Confirmation",
    html: `<div style="display:flex;justify-content:center;align-items:center;">${code}</div>`
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      throw error;
    }
  });
};

export const sendPasswordReset = (email: string, token: string) => {
  const mailOptions = {
    to: email,
    from: "no-reply@wobbly.app",
    subject: "Wobbly App - Email Confirmation",
    html: `
    <div>
      <a href="https://runranron.github.io/wobbly.app/resetpassword.html?token=${token}">
        Click here to log magically into your app.
      </a>
      <p>
        (Just in case: ${token})
      </p>
    </div>
    `
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      throw error;
    }
  });
};

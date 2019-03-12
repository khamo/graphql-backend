import * as Sparkpost from "sparkpost";

const transporter = new Sparkpost(process.env.EMAIL_KEY);

export const sendConfirmationEmail = (address: string, code: string) => {
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "dev") {
    return;
  }
  const content = {
    from: process.env.EMAIL_SENDER,
    subject: "Wobbly App - Email Confirmation",
    html: `<div style="display:flex;justify-content:center;align-items:center;">${code}</div>`
  };
  transporter.transmissions
    .send({
      content,
      recipients: [{ address }]
    })
    .catch(e => {
      throw e;
    }); // for testing. probably want better results for logging later
};

export const sendPasswordReset = (address: string, token: string) => {
  const content = {
    from: process.env.EMAIL_SENDER,
    subject: "Wobbly App - Email Confirmation",
    html: `
    <div>
      <a href="https://runranron.github.io/wobbly.app/resetpassword.html?token=${token}">
        Click here to log magically into your app.
      </a>
      <p style="color: white;">
        ${token}
      </p>
    </div>
    `
  };
  transporter.transmissions
    .send({
      content,
      recipients: [{ address }]
    })
    .catch(e => {
      throw e;
    }); // for testing. probably want better results for logging later
};

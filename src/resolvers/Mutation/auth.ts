import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

import { sendPasswordReset } from "../../communications/email";
import { sendConfirmationEmail } from "../../communications/email";
import { MutationResolvers } from "../../generated/graphqlgen";
import {
  checkForPwnedPassword,
  getCode,
  getPasswordHash,
  getPersonId,
  InvalidLoginError,
  MissingFieldError,
  NotFoundError,
  validatePersonFields
} from "../../utils";

const MAX_ATTEMPTS = 5;
const RETRY_INTERVAL = 1000 * 60 * 5; // five minutes
const RESET_EXPIRATION_INTERVAL = 1000 * 60 * 10; // 10 minutes

export const auth: Pick<
  MutationResolvers.Type,
  "signup" | "login" | "confirmEmail" | "sendPasswordReset" | "resetPassword"
> = {
  signup: async (parent, { email, name, password }, ctx) => {
    if (!process.env.APP_SECRET) {
      throw new Error("Server authentication error");
    }

    validatePersonFields(email, name, password);
    await checkForPwnedPassword(password);
    if (await ctx.prisma.$exists.person({ email })) {
      throw new Error("Email unavailable");
    }

    const hashedPassword = await getPasswordHash(password);
    const confirmationCode = getCode(6);
    const person = await ctx.prisma.createPerson({
      emailConfirmed: false,
      confirmationCode,
      email,
      name,
      password: hashedPassword
    });

    const token = jwt.sign({ personId: person.id }, process.env.APP_SECRET);
    if (process.env.NODE_ENV !== "dev") {
      sendConfirmationEmail(email, confirmationCode);
    }

    return {
      token,
      person
    };
  },

  login: async (parent, { email, password }, ctx) => {
    if (!process.env.APP_SECRET) {
      throw new Error("Server authentication error");
    }

    const person = await ctx.prisma.person({ email });
    if (!person) {
      throw new InvalidLoginError();
    }

    const valid = await bcrypt.compare(password, person.password);
    if (!valid) {
      throw new InvalidLoginError();
    }

    return {
      token: jwt.sign({ personId: person.id }, process.env.APP_SECRET),
      person
    };
  },

  confirmEmail: async (parent, { confirmationCode }, ctx) => {
    if (!confirmationCode) {
      throw new Error("No code.");
    }
    const personId = getPersonId(ctx);
    const currentInfo = await ctx.prisma.person({ id: personId });

    if (confirmationCode !== currentInfo.confirmationCode) {
      throw new Error("Wrong code.");
    }

    return ctx.prisma.updatePerson({
      where: {
        id: personId
      },
      data: {
        emailConfirmed: true
      }
    });
  },
  sendPasswordReset: async (parent, { email }, ctx) => {
    if (!process.env.APP_SECRET) {
      throw new Error("Server authentication error");
    }
    if (!email) {
      throw new MissingFieldError("email");
    }
    const currentInfo = await ctx.prisma.person({ email });
    // if user is not found, return true anyway
    // (a different response could be used to confirm membership)
    if (!currentInfo) {
      return true;
    }
    const passwordResetCode = getCode(6);

    await ctx.prisma.updatePerson({
      where: {
        id: currentInfo.id
      },
      data: {
        passwordResetCode
      }
    });

    await sendPasswordReset(email, passwordResetCode);
    return true;
  },
  resetPassword: async (parent, { resetCode, newPassword, email }, ctx) => {
    if (!process.env.APP_SECRET) {
      throw new Error("Server authentication error");
    }
    if (!email) {
      throw new InvalidLoginError();
    }
    const person = await ctx.prisma.person({ email });

    if (!person) {
      throw new NotFoundError("Person");
    }

    await ctx.prisma.updatePerson({
      where: {
        email
      },
      data: {
        password: newPassword
      }
    });

    return {
      token: jwt.sign({ personId: person.id }, process.env.APP_SECRET),
      person
    };
  }
};

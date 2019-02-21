import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

import { sendConfirmationEmail } from "../../communications/email";
import { MutationResolvers } from "../../generated/graphqlgen";
import {
  checkForPwnedPassword,
  getCode,
  getPasswordHash,
  getPersonId,
  InvalidLoginError,
  validatePersonFields
} from "../../utils";

export const auth: Pick<
  MutationResolvers.Type,
  "signup" | "login" | "confirmEmail"
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
    sendConfirmationEmail(email, confirmationCode);

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
  }
};

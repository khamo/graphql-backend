import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { inflect } from "inflection";
import * as Joi from "joi";
import * as jwt from "jsonwebtoken";

import { IContext } from "./types";

export function getPersonIdFromToken(token: string) {
  if (process.env.APP_SECRET) {
    const { personId } = jwt.verify(token.replace("Bearer ", ""), process.env.APP_SECRET) as {
      personId: string;
    };
    if (personId) {
      return personId;
    }
  }

  throw new AuthError();
}

export function getPersonId(ctx: IContext) {
  const token = ctx.req.get("Authorization");
  if (token) {
    return getPersonIdFromToken(token);
  }

  throw new AuthError();
}

export async function checkPersonExists(ctx: IContext) {
  const personId = getPersonId(ctx);
  const personExists = await ctx.prisma.$exists.person({
    id: personId
  });
  if (!personExists) {
    throw new AuthError();
  }
}

/**
 * Verifies that the user is a member of the group with `groupId`.
 * If not, throws an `AuthError`.
 */
export async function checkGroupMembership(ctx: IContext, groupId: string): Promise<void> {
  const personId = getPersonId(ctx);
  const isMember = await ctx.prisma.$exists.group({
    id: groupId,
    members_some: {
      id: personId
    }
  });
  if (!isMember) {
    throw new AuthError();
  }
}

export async function getPasswordHash(password: string) {
  // Auto-generates a salt, then hashes it with the password.
  // bcrypt is made specifically for password hashing.
  return await bcrypt.hash(password, 10);
}

// tslint:disable:max-classes-per-file
export class AuthError extends Error {
  constructor() {
    super("Not authorized");
  }
}

export class InvalidLoginError extends Error {
  constructor() {
    super("Incorrect email or password");
  }
}

export class MissingFieldError extends Error {
  constructor(requiredField: string) {
    super(`Must have ${requiredField}.`);
  }
}

export class NotFoundError extends Error {
  constructor(recordType: string) {
    super(`${recordType} not found.`);
  }
}

export class MaxAttemptsError extends Error {
  constructor() {
    super("Too many attempts.");
  }
}

export class InvalidPasswordError extends Error {
  constructor() {
    super("Invalid password");
  }
}

/**
 * Checks Pwned Passwords, a database of passwords that have been exposed in data breaches.
 * Sends the first 5 characters of the SHA-1 hash to a remote server and receives a list of breached
 * hashes that start with those 5 characters.
 *
 * Throws an error if the password has been seen in a data breach.
 *
 * See more: https://haveibeenpwned.com/API/v2#PwnedPasswords
 * @param password the password to check
 */
export async function checkForPwnedPassword(password: string) {
  const hasher = crypto.createHash("sha1");
  hasher.update(password);
  const hash = hasher.digest("hex");

  const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`).then(r => r.text());
  const suffixes: { [suffix: string]: number } = {};
  response.split("\n").forEach(line => {
    const split = line.split(":");
    suffixes[split[0]] = parseInt(split[1], 10);
  });

  const count = suffixes[hash.toUpperCase().slice(5)] || 0;
  // tslint:disable-next-line:no-string-literal
  if (process.env.NODE_ENV !== "dev") {
    if (count > 0) {
      throw new Error(
        `This password has been seen ${count} ${inflect(
          "time",
          count
        )} in data breaches. Please choose a more secure one.`
      );
    }
  }
}

/**
 * Validates the Person fields. If invalid, throws an error.
 */
export function validatePersonFields(email: string, name: string, password: string) {
  const schema = Joi.object().keys({
    email: Joi.string()
      .email({ minDomainAtoms: 2 })
      .required(),
    name: Joi.string()
      .min(3)
      .max(50)
      .required(),
    password: Joi.string()
      .min(10)
      .required()
  });
  Joi.validate({ email, name, password }, schema, (err, value) => {
    if (err) {
      throw new Error(err.details.map(d => d.message).join("\n"));
    }
  });
}

export const getCode = (digits: number) => {
  let result = "";
  let counter = 0;
  while (counter < 6) {
    const buffer = crypto.randomBytes(8);
    const hex = buffer.toString("hex");
    const integer = parseInt(hex, 16);
    const random = (integer / 0xffffffffffffffff).toString().split("");
    const digit = random[random.length - 1];
    result += digit;
    counter += 1;
  }
  return result;
};

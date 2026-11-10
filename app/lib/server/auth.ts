import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { DEFAULT_ORGANIZATION_ID, database } from "./db";

const secret = process.env.BETTER_AUTH_SECRET;

export function isAuthConfigured() {
  return process.env.NODE_ENV !== "production" || Boolean(secret);
}

export const auth = betterAuth({
  appName: "Kontá",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: secret ?? "konta-local-development-secret-change-before-deploy-32",
  database,
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    database: { validateSchema: false },
  },
  user: {
    additionalFields: {
      organizationId: {
        type: "string",
        required: true,
        defaultValue: DEFAULT_ORGANIZATION_ID,
        input: false,
        fieldName: "organization_id",
      },
    },
  },
  plugins: [admin()],
});

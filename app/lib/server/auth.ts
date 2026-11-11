import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { defaultAc } from "better-auth/plugins/admin/access";
import { database } from "./db";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "../password-policy";

const storeAdministratorRole = defaultAc.newRole({ user: [], session: [] });
const collaboratorRole = defaultAc.newRole({ user: [], session: [] });
const platformAdministratorRole = defaultAc.newRole({ user: [], session: [] });

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
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
  },
  disabledPaths: ["/change-email", "/verify-email", "/send-verification-email"],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    database: { validateSchema: false },
  },
  user: {
    deleteUser: {
      enabled: false,
      beforeDelete: async (user) => {
        const result = await database.query<{ is_store_owner: boolean }>(
          'SELECT is_store_owner FROM "user" WHERE id = $1',
          [user.id],
        );
        if (result.rows[0]?.is_store_owner) {
          throw new Error("Transfira a propriedade da loja antes de remover esta conta.");
        }
      },
    },
    additionalFields: {
      organizationId: {
        type: "string",
        required: false,
        input: false,
        fieldName: "organization_id",
      },
      storeRole: {
        type: "string",
        required: false,
        input: false,
        fieldName: "store_role",
      },
      isStoreOwner: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
        fieldName: "is_store_owner",
      },
    },
  },
  plugins: [admin({
    defaultRole: "collaborator",
    adminRoles: ["platform-admin"],
    roles: {
      "store-admin": storeAdministratorRole,
      collaborator: collaboratorRole,
      "platform-admin": platformAdministratorRole,
    },
  })],
});

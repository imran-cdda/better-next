import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { openAPI } from "better-auth/plugins"
import { passkey } from "@better-auth/passkey"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/core/db"
import * as schema from "@/core/db/schema/index"
import { email } from "@/plugins/email"
import { orgDbPlugin } from "@/plugins/database/server"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),

  baseURL: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  basePath: "/api/auth",
  trustedOrigins: [
    "http://localhost:3000",
    "https://localhost",
    "http://127.0.0.1:3000",
    "http://mdimranh.com:3000",
  ],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_PLACEHOLDER",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || "GOOGLE_CLIENT_SECRET_PLACEHOLDER",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "GITHUB_CLIENT_ID_PLACEHOLDER",
      clientSecret:
        process.env.GITHUB_CLIENT_SECRET || "GITHUB_CLIENT_SECRET_PLACEHOLDER",
    },
  },
  plugins: [orgDbPlugin(), nextCookies(), openAPI(), passkey(), email()],
  logger: {
    level: "debug",
  },
})

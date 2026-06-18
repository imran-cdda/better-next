import type { BetterAuthPlugin } from "better-auth"
import { createAuthMiddleware } from "better-auth/api"
import { createInternalAdapter } from "better-auth/db"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { getCurrentDBAdapterAsyncLocalStorage } from "@better-auth/core/context"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import * as schema from "@/core/db/schema/index"
import { schemas } from "./schema"
import { endpoints } from "./endpoints"
import { dynamicDB } from "./hooks"

export const DBPlugin = () =>
  ({
    id: "database",
    // hooks: {
    //   before: [dynamicDB("database")],
    // },
    // onRequest: DynamicDB,
    schema: {
      database: {
        fields: {
          host: {
            type: "string",
          },
          port: {
            type: "number",
          },
          user: {
            type: "string",
          },
          password: {
            type: "string",
          },
          database: {
            type: "string",
          },
          domain: {
            type: "string",
          },
          provider: {
            type: ["postgres", "mysql"],
          },
        },
      },
    },
    endpoints: endpoints,
  }) satisfies BetterAuthPlugin

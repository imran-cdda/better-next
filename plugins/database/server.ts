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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgDbEntry {
  pool: pg.Pool
  db: ReturnType<typeof drizzle>
}

// ---------------------------------------------------------------------------
// Org → DB URL map
// ---------------------------------------------------------------------------

const ORG_DB_MAP: Record<string, string> = {
  "mdimranh.com": "postgresql://postgres:mdimranh@localhost:5432/mdimranh",
  localhost: "postgresql://postgres:mdimranh@localhost:5432/biwd",
}

function getConnectionStringForDomain(domain: string): string {
  const url = ORG_DB_MAP[domain] ?? process.env.DATABASE_URL
  if (!url) throw new Error(`[org-db] No DB URL for domain: "${domain}"`)
  return url
}

// ---------------------------------------------------------------------------
// Connection cache
// ---------------------------------------------------------------------------

const dbCache = new Map<string, OrgDbEntry>()

export function getDbForDomain(domain: string) {
  const cached = dbCache.get(domain)
  if (cached) return cached

  const pool = new pg.Pool({
    connectionString: getConnectionStringForDomain(domain),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
  pool.on("error", (err) =>
    console.error(`[org-db] pool error "${domain}":`, err)
  )

  const db = drizzle(pool, { schema })
  dbCache.set(domain, { pool, db })
  return { pool, db }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function closeOrgDb(domain: string) {
  const entry = dbCache.get(domain)
  if (!entry) return
  dbCache.delete(domain)
  await entry.pool.end()
}

export async function closeAllOrgDbs() {
  await Promise.all([...dbCache.keys()].map(closeOrgDb))
}

process.on("SIGTERM", closeAllOrgDbs)
process.on("SIGINT", closeAllOrgDbs)

export const orgDbPlugin = (): BetterAuthPlugin =>
  ({
    id: "org-db",
    hooks: {
      before: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            const domain = ctx.headers?.get("host")?.split(":")[0]
            if (!domain) return

            const { db } = getDbForDomain(domain)

            // Build the org-specific drizzle adapter
            const adapter = drizzleAdapter(db, {
              provider: "pg",
              schema,
            })(ctx.context.options)

            // Build databaseHooks entries
            const dbHooks: Array<{
              source: string
              hooks: NonNullable<typeof ctx.context.options.databaseHooks>
            }> = []

            if (ctx.context.options.databaseHooks) {
              dbHooks.push({
                source: "user",
                hooks: ctx.context.options.databaseHooks,
              })
            }

            // Build internalAdapter with org adapter as closure fallback
            const internalAdapter = createInternalAdapter(adapter, {
              options: ctx.context.options,
              logger: ctx.context.logger,
              hooks: dbHooks,
              generateId: ctx.context.generateId,
            })

            // 1. Swap references on ctx.context so direct reads see org adapter
            Object.assign(ctx.context, { adapter, internalAdapter })

            // 2. Overwrite the ALS store so getCurrentAdapter() returns org
            //    adapter instead of the init-time memory adapter that
            //    runWithAdapter() set at the start of this request
            const als = await getCurrentDBAdapterAsyncLocalStorage()
            const store = als.getStore()
            if (store) {
              store.adapter = adapter
            } else {
              // No store means runWithAdapter hasn't run yet (e.g. direct api call)
              // Nothing to patch — the fallback in createInternalAdapter is enough
            }
          }),
        },
      ],
    },
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

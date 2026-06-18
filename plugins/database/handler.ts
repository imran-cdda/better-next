import { createAuthMiddleware } from "better-auth/api"
import { createInternalAdapter } from "better-auth/db"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { getCurrentDBAdapterAsyncLocalStorage } from "@better-auth/core/context"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import * as schema from "@/core/db/schema/index"
import { AuthContext, DBAdapter, HookEndpointContext } from "better-auth"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgDbEntry {
  pool: pg.Pool
  db: ReturnType<typeof drizzle>
}

async function getConnectionStringForDomain(
  domain: string,
  adapter: DBAdapter
) {
  const getDomainConfig = (await adapter.findOne({
    model: "database",
    where: [{ field: "domain", value: domain }],
  })) as any

  const url =
    domain === "localhost"
      ? process.env.DATABASE_URL
      : getDomainConfig
        ? `postgresql://${getDomainConfig?.user}:${getDomainConfig?.password}@${getDomainConfig?.host}:${getDomainConfig?.port}/${getDomainConfig?.database}`
        : ""

  if (!url) throw new Error(`[org-db] No DB URL for domain: "${domain}"`)
  return url
}

// ---------------------------------------------------------------------------
// Connection cache
// ---------------------------------------------------------------------------

const dbCache = new Map<string, OrgDbEntry>()

export async function getDbForDomain(domain: string, adapter: DBAdapter) {
  // const cached = dbCache.get(domain)
  // if (cached) return cached

  const pool = new pg.Pool({
    connectionString: await getConnectionStringForDomain(domain, adapter),
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

export const dynamicDbHandler = createAuthMiddleware(async (ctx) => {
  const domain = ctx.headers?.get("host")?.split(":")[0]
  if (!domain) return

  const { db } = await getDbForDomain(domain, ctx.context.adapter)

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

  // Build internalAdapter with org adapter
  const internalAdapter = createInternalAdapter(adapter, {
    options: ctx.context.options,
    logger: ctx.context.logger,
    hooks: dbHooks,
    generateId: ctx.context.generateId,
  })

  // Swap references on context so direct reads see org adapter
  Object.assign(ctx.context, { adapter, internalAdapter })

  // Overwrite the ALS store so getCurrentAdapter() returns org adapter
  const als = await getCurrentDBAdapterAsyncLocalStorage()
  const store = als.getStore()
  if (store) {
    store.adapter = adapter
  }
})

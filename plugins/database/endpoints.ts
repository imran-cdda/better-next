import { createEndpoint } from "better-auth"
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api"
import { z } from "zod"
import * as schema from "@/core/db/schema"

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Client } from "pg"
import { DBService } from "./service"

async function ensureDatabaseExists({
  host,
  port,
  user,
  password,
  database,
}: {
  host: string
  port: number
  user: string
  password: string
  database: string
}): Promise<void> {
  const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`

  const adminClient = new Client({ connectionString: adminUrl })
  await adminClient.connect()

  try {
    const res = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [database]
    )
    if (res.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${database}"`)
    }
  } finally {
    await adminClient.end()
  }
}

export const endpoints = {
  databaseList: createAuthEndpoint(
    "/database/list",
    {
      method: "GET",
      query: z
        .object({
          limit: z.string().transform(Number).optional(),
          offset: z.string().transform(Number).optional(),
        })
        .optional(),
      // use: [sessionMiddleware],
    },
    async (ctx) => {
      const databases = await ctx.context.adapter.findMany({
        model: "database",
      })
      return databases
    }
  ),
  addDatabase: createAuthEndpoint(
    "/database/add",
    {
      method: "POST",
      body: z.object({
        host: z.string(),
        port: z.number(),
        user: z.string(),
        password: z.string(),
        database: z.string(),
        domain: z.string(),
        provider: z.enum(["postgres", "mysql"]),
      }),
      // use: [sessionMiddleware],
    },
    async (ctx) => {
      const database = await ctx.context.adapter.create({
        model: "database",
        data: ctx.body,
      })
      return database
    }
  ),
  checkConnection: createAuthEndpoint(
    "/database/check-connection",
    {
      method: "POST",
      body: z.object({
        databaseId: z.string(),
      }),
      // use: [sessionMiddleware],
    },
    async (ctx) => {
      const dbService = new DBService(ctx.body.databaseId, ctx.context.adapter)
      return {
        connected: await dbService.checkConnection(),
      }
    }
  ),
  migrateDB: createAuthEndpoint(
    "/database/migrate",
    {
      method: "POST",
      body: z.object({
        databaseId: z.string(),
      }),
      // use: [sessionMiddleware],
    },
    async (ctx) => {
      const dbService = new DBService(ctx.body.databaseId, ctx.context.adapter)
      return await dbService.migrateDb()
    }
  ),
  updateDatabase: createAuthEndpoint(
    "/database/update",
    {
      method: "POST",
      body: z.object({
        id: z.string(),
        host: z.string(),
        port: z.number(),
        user: z.string(),
        password: z.string(),
        database: z.string(),
        domain: z.string(),
        provider: z.enum(["postgres", "mysql"]),
      }),
      // use: [sessionMiddleware],
    },
    async (ctx) => {
      const { id, ...data } = ctx.body
      const updated = await ctx.context.adapter.update({
        model: "database",
        where: [{ field: "id", value: id }],
        update: data,
      })
      return updated
    }
  ),
  deleteDatabase: createAuthEndpoint(
    "/database/delete",
    {
      method: "POST",
      body: z.object({
        id: z.string(),
      }),
      // use: [sessionMiddleware],
    },
    async (ctx) => {
      await ctx.context.adapter.delete({
        model: "database",
        where: [{ field: "id", value: ctx.body.id }],
      })
      return { success: true }
    }
  ),
}

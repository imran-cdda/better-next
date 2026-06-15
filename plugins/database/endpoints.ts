import { createAuthEndpoint, sessionMiddleware } from "better-auth/api"
import { z } from "zod"

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
      use: [sessionMiddleware],
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
      use: [sessionMiddleware],
    },
    async (ctx) => {
      const database = await ctx.context.adapter.create({
        model: "database",
        data: ctx.body,
      })
      return database
    }
  ),
}

import type { BetterAuthPlugin } from "better-auth"
import { DynamicDB } from "../database/onRequest"
import { createAuthEndpoint } from "better-auth/api"
import { z } from "zod"

export const Post = (): BetterAuthPlugin =>
  ({
    id: "post",
    onRequest: DynamicDB(async (request, context) => {
      console.log("Internal Request ----------------> " + request.url)
    }),
    schema: {
      post: {
        fields: {
          content: {
            type: "string",
          },
          createdAt: { type: "date", required: true },
          updatedAt: { type: "date", required: true },
        },
      },
    },
    endpoints: {
      postList: createAuthEndpoint(
        "/post/list",
        {
          method: "GET",
        },
        async (ctx) => {
          return await ctx.context.adapter.findMany({
            model: "post",
          })
        }
      ),
      addPost: createAuthEndpoint(
        "/post/add",
        {
          method: "POST",
          body: z.object({
            content: z.string(),
          }),
        },
        async (ctx) => {
          const now = new Date()
          return await ctx.context.adapter.create({
            model: "post",
            data: {
              ...ctx.body,
              id: crypto.randomUUID(),
              createdAt: now,
              updatedAt: now,
            },
          })
        }
      ),
      deletePost: createAuthEndpoint(
        "/post/delete",
        {
          method: "POST",
          body: z.object({
            id: z.string(),
          }),
        },
        async (ctx) => {
          return await ctx.context.adapter.delete({
            model: "post",
            where: [{ field: "id", value: ctx.body.id }],
          })
        }
      ),
    },
  }) satisfies BetterAuthPlugin

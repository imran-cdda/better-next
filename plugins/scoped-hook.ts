// lib/plugins/scoped-hook.ts
import type { BetterAuthPlugin } from "better-auth"
import { createAuthMiddleware } from "better-auth/api"

function pathToRegex(path: string): RegExp {
  const pattern = path
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/:[^/]+/g, "[^/]+")
  return new RegExp(`^${pattern}/?$`)
}

function getPluginRegexes(plugin: BetterAuthPlugin): RegExp[] {
  if (!plugin.endpoints) return []
  return Object.values(plugin.endpoints)
    .map((endpoint: any) => endpoint?.path)
    .filter(Boolean)
    .map(pathToRegex)
}

type Handler = ReturnType<typeof createAuthMiddleware>

interface WithPluginHookOptions {
  id: string
  plugins: BetterAuthPlugin[]
  before?: Handler[]
  after?: Handler[]
}

export function withPluginHook({
  id,
  plugins,
  before = [],
  after = [],
}: WithPluginHookOptions): BetterAuthPlugin {
  const regexes = plugins.flatMap(getPluginRegexes)
  const matcher = (ctx: any) => regexes.some((re) => re.test(ctx.path))

  return {
    id,
    hooks: {
      before: before.map((handler) => ({ matcher, handler })),
      after: after.map((handler) => ({ matcher, handler })),
    },
  }
}

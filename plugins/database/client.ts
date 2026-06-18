import type { BetterAuthClientPlugin } from "better-auth/client"
import type { DBPlugin } from "./server"

export const DBClient = () => {
  return {
    id: "database",
    $InferServerPlugin: {} as ReturnType<typeof DBPlugin>,
  } satisfies BetterAuthClientPlugin
}

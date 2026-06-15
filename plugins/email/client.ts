import type { BetterAuthClientPlugin } from "better-auth/client"
import { email } from "."

export const EmailClient = () => {
  return {
    id: "email",
    $InferServerPlugin: {} as ReturnType<typeof email>,
  } satisfies BetterAuthClientPlugin
}

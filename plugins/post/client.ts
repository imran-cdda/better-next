import type { BetterAuthClientPlugin } from "better-auth/client"
import type { Post } from "./server"

export const PostClient = () => {
  return {
    id: "post",
    $InferServerPlugin: {} as ReturnType<typeof Post>,
  } satisfies BetterAuthClientPlugin
}

import { getTableName } from "drizzle-orm"
import { PgTableWithColumns } from "drizzle-orm/pg-core"

// ── Types ────────────────────────────────────────────────────────────────────

export type SignalType =
  | "pre_save"
  | "post_save"
  | "pre_delete"
  | "post_delete"
  | "pre_update"
  | "post_update"
  | "pre_create"
  | "post_create"

export interface SignalContext<T = any> {
  table: string
  action: "insert" | "update" | "delete"
  args: any
  oldData?: any
  result?: T
  created?: boolean
  db: any
}

export type SignalHandler<T = any> = (
  ctx: SignalContext<T>
) => void | Promise<void>

interface Registration {
  table: string | "*"
  handler: SignalHandler
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

class SignalDispatcher {
  private registry = new Map<SignalType, Registration[]>()

  connect(
    signal: SignalType,
    handler: SignalHandler,
    table: string | "*" = "*"
  ): () => void {
    if (!this.registry.has(signal)) this.registry.set(signal, [])
    const reg: Registration = { table, handler }
    this.registry.get(signal)!.push(reg)
    return () => this.disconnect(signal, handler, table)
  }

  disconnect(
    signal: SignalType,
    handler: SignalHandler,
    table: string | "*" = "*"
  ): void {
    const list = this.registry.get(signal)
    if (!list) return
    this.registry.set(
      signal,
      list.filter((r) => !(r.handler === handler && r.table === table))
    )
  }

  async send(signal: SignalType, ctx: SignalContext): Promise<void> {
    const list = this.registry.get(signal) ?? []
    for (const reg of list) {
      if (reg.table === "*" || reg.table === ctx.table) {
        await reg.handler(ctx)
      }
    }
  }
}

export const signals = new SignalDispatcher()

export function receiver(
  signal: SignalType,
  handler: SignalHandler,
  table: string | "*" = "*"
): () => void {
  return signals.connect(signal, handler, table)
}

// ── Proxy helper ─────────────────────────────────────────────────────────────

function withSignalProxy<T extends object>(
  builder: T,
  onBefore: () => Promise<void>,
  onAfter: (result: any) => Promise<void>
): T {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "then") {
        return (resolve: any, reject: any) => {
          const execute = async () => {
            await onBefore()
            const result = await (target as any)
            await onAfter(result)
            return result
          }
          return execute().then(resolve, reject)
        }
      }

      const value = Reflect.get(target, prop, receiver)

      if (typeof value === "function") {
        return (...args: any[]) => {
          const next = value.apply(target, args)
          if (next && typeof next === "object") {
            return withSignalProxy(next, onBefore, onAfter)
          }
          return next
        }
      }

      return value
    },
  })
}

// ── Signal-aware DB wrapper ───────────────────────────────────────────────────

export function signalDb(db: any) {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)

      if (prop === "insert") {
        return (table: PgTableWithColumns<any>) => {
          const tableName = getTableName(table)
          const builder = value.call(target, table)
          const action = "insert"
          let insertData: any

          // Intercept .values() to capture the actual insert data
          const originalValues = builder.values.bind(builder)
          builder.values = (...args: any[]) => {
            insertData = args[0]
            const next = originalValues(...args)
            return withSignalProxy(
              next,
              async () => {
                const ctx: SignalContext = {
                  table: tableName,
                  action,
                  args: insertData,
                  db,
                }
                await signals.send("pre_save", ctx)
                await signals.send("pre_create", ctx)
              },
              async (result) => {
                const ctx: SignalContext = {
                  table: tableName,
                  action,
                  args: insertData,
                  result,
                  created: true,
                  db,
                }
                await signals.send("post_save", ctx)
                await signals.send("post_create", ctx)
              }
            )
          }

          return builder
        }
      }

      if (prop === "update") {
        return (table: PgTableWithColumns<any>) => {
          const tableName = getTableName(table)
          const builder = value.call(target, table)
          const action = "update"
          let updateData: any
          let whereCondition: any

          // Intercept .set()
          const originalSet = builder.set.bind(builder)
          builder.set = (...setArgs: any[]) => {
            updateData = setArgs[0]
            const afterSet = originalSet(...setArgs)

            // Intercept .where() on the result of .set()
            const originalWhere = afterSet.where.bind(afterSet)
            afterSet.where = (...whereArgs: any[]) => {
              whereCondition = whereArgs[0]
              const afterWhere = originalWhere(...whereArgs)

              return withSignalProxy(
                afterWhere,
                async () => {
                  // Fetch old data before update
                  let oldData: any = null
                  try {
                    const rows = await db
                      .select()
                      .from(table)
                      .where(whereCondition)
                    oldData = rows.length === 1 ? rows[0] : rows
                  } catch (e) {
                    console.warn("[signalDb] Could not fetch old data:", e)
                  }

                  // Stash it so onAfter can use it
                  ;(afterWhere as any).__oldData = oldData

                  const ctx: SignalContext = {
                    table: tableName,
                    action,
                    args: updateData,
                    oldData,
                    db,
                  }
                  await signals.send("pre_save", ctx)
                  await signals.send("pre_update", ctx)
                },
                async (result) => {
                  const ctx: SignalContext = {
                    table: tableName,
                    action,
                    args: updateData,
                    oldData: (afterWhere as any).__oldData ?? null,
                    result,
                    db,
                  }
                  await signals.send("post_save", ctx)
                  await signals.send("post_update", ctx)
                }
              )
            }

            return afterSet
          }

          return builder
        }
      }

      if (prop === "delete") {
        return (table: PgTableWithColumns<any>) => {
          const tableName = getTableName(table)
          const builder = value.call(target, table)
          const action = "delete"

          return withSignalProxy(
            builder,
            async () => {
              const ctx: SignalContext = {
                table: tableName,
                action,
                args: null,
                db,
              }
              await signals.send("pre_save", ctx)
              await signals.send("pre_delete", ctx)
            },
            async (result) => {
              const ctx: SignalContext = {
                table: tableName,
                action,
                args: null,
                result,
                db,
              }
              await signals.send("post_save", ctx)
              await signals.send("post_delete", ctx)
            }
          )
        }
      }

      if (typeof value === "function") {
        return value.bind(target)
      }

      return value
    },
  })
}

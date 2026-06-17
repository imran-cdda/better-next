import { type DBAdapter } from "better-auth"
import { BaseDBService, DatabaseDetails } from "./base"
import { PostgresDBService } from "./postgres"
import { MySQLDBService } from "./mysql"

export class DBService {
  protected databaseId: string
  protected db: DBAdapter
  constructor(databaseId: string, db: DBAdapter) {
    this.databaseId = databaseId
    this.db = db
  }

  async details(): Promise<DatabaseDetails | null> {
    return this.db.findOne({
      model: "database",
      where: [{ field: "id", operator: "eq", value: this.databaseId }],
    }) as Promise<DatabaseDetails | null>
  }

  async adapter(): Promise<BaseDBService> {
    const details = await this.details()
    if (!details) throw new Error("Database not found")
    switch (details.provider) {
      case "postgres":
        return new PostgresDBService(this.databaseId, details)
      case "mysql":
        return new MySQLDBService(this.databaseId, details)
      default:
        throw new Error("Unknown database provider")
    }
  }

  async migrateDb(): Promise<void> {
    const adapter = await this.adapter()
    return await adapter.migrateDb()
  }

  async checkConnection(): Promise<boolean> {
    const adapter = await this.adapter()
    return await adapter.checkConnection()
  }
}

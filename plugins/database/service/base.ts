import { type DBAdapter } from "better-auth"

export interface DatabaseCredentials {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export interface DatabaseDetails {
  id: string
  host: string
  port: number
  user: string
  password: string
  database: string
  provider: "postgres" | "mysql"
}

export abstract class BaseDBService {
  protected databaseId: string
  protected details: DatabaseDetails
  readonly migrationsFolder = "./drizzle"

  constructor(databaseId: string, details: DatabaseDetails) {
    this.databaseId = databaseId
    this.details = details
  }

  async migrateDb(): Promise<void> {
    return await this.runMigrations(this.details)
  }

  /**
   * Check if the target database exists.
   * Each provider implements this differently (e.g. pg_database vs SHOW DATABASES).
   */
  abstract checkConnection(): Promise<boolean>

  /**
   * Ensure the target database exists, creating it if necessary.
   * Each provider implements this differently (e.g. pg_database vs SHOW DATABASES).
   */
  abstract ensureDatabaseExists(credentials: DatabaseCredentials): Promise<void>

  /**
   * Run migrations against the target database using the provider's driver.
   */
  abstract runMigrations(credentials: DatabaseCredentials): Promise<void>

  /** Build a connection URL for the provider. */
  abstract buildConnectionUrl(credentials: DatabaseCredentials): string
}

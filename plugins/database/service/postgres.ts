import { type DBAdapter } from "better-auth"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Client } from "pg"

import {
  BaseDBService,
  type DatabaseCredentials,
  DatabaseDetails,
} from "./base"

export class PostgresDBService extends BaseDBService {
  constructor(databaseId: string, details: DatabaseDetails) {
    super(databaseId, details)
  }

  buildConnectionUrl(): string {
    const { user, password, host, port, database } = this.details
    const url = `postgres://${user}:${password}@${host}:${port}/${database}`
    console.log("Connection url --------------> ", url)
    return url
  }

  async checkConnection(): Promise<boolean> {
    try {
      const client = new Client(this.buildConnectionUrl())
      await client.connect()
      await client.query("SELECT 1")
      await client.end()
      return true
    } catch (error) {
      return false
    }
  }

  async ensureDatabaseExists(): Promise<void> {
    const { user, password, host, port, database } = this.details
    const adminClient = new Client({
      connectionString: `postgres://${user}:${password}@${host}:${port}/postgres`,
    })
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

  async db() {
    return drizzle(this.buildConnectionUrl())
  }

  async runMigrations(): Promise<void> {
    const db = await this.db()
    await this.ensureDatabaseExists()
    return await migrate(db, { migrationsFolder: this.migrationsFolder })
  }
}

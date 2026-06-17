import { type DBAdapter } from "better-auth"
import { drizzle } from "drizzle-orm/mysql2"
import { migrate } from "drizzle-orm/mysql2/migrator"
import mysql from "mysql2/promise"

import {
  BaseDBService,
  type DatabaseCredentials,
  DatabaseDetails,
} from "./base"

export class MySQLDBService extends BaseDBService {
  constructor(databaseId: string, details: DatabaseDetails) {
    super(databaseId, details)
  }

  buildConnectionUrl(): string {
    const { user, password, host, port, database } = this.details
    return `mysql://${user}:${password}@${host}:${port}/${database}`
  }

  async checkConnection(): Promise<boolean> {
    try {
      const { host, port, user, password, database } = this.details
      const adminConn = await mysql.createConnection({
        host,
        port,
        user,
        password,
      })
      await adminConn.query(`USE ${database}`)
      await adminConn.end()
      return true
    } catch (error) {
      return false
    }
  }

  async ensureDatabaseExists(): Promise<void> {
    const { host, port, user, password, database } = this.details
    const adminConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
    })

    try {
      await adminConn.execute(`CREATE DATABASE IF NOT EXISTS \`${database}\``)
    } finally {
      await adminConn.end()
    }
  }

  async runMigrations(): Promise<void> {
    const pool = mysql.createPool(this.buildConnectionUrl())
    const db = drizzle(pool)
    await migrate(db, { migrationsFolder: this.migrationsFolder })
    await pool.end()
  }
}

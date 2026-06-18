import { drizzle } from "drizzle-orm/node-postgres"
import "dotenv/config"
import * as schema from "./schema"
import { signalDb } from "./signal"
import pg from "pg"

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
})

const db = signalDb(drizzle(pool, { schema }))

export { db }

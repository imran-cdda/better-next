import { type DBAdapter } from "better-auth"

export class DatabaseService {
  private databaseId: string
  private db: DBAdapter
  constructor(databaseId: string, db: DBAdapter) {
    this.databaseId = databaseId
    this.db = db
  }

  async listDatabases() {
    return this.db.findMany({
      model: "database",
    })
  }

  async getDatabase(id: string) {
    return this.db.findOne({
      model: "database",
      where: {
        id: this.databaseId,
      },
    })
  }
}

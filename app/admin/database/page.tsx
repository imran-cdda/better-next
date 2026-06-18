"use client"

import * as React from "react"
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlugIcon,
  FolderSyncIcon,
  LoaderIcon,
} from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Database {
  id: string
  host: string
  port: number
  user: string
  password: string
  database: string
  domain: string
  provider: "postgres" | "mysql"
}

interface DatabaseFormData {
  host: string
  port: string
  user: string
  password: string
  database: string
  domain: string
  provider: "postgres" | "mysql"
}

const initialFormData: DatabaseFormData = {
  host: "",
  port: "5432",
  user: "",
  password: "",
  database: "",
  domain: "",
  provider: "postgres",
}

export default function DatabasePage() {
  const [databases, setDatabases] = React.useState<Database[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formData, setFormData] =
    React.useState<DatabaseFormData>(initialFormData)
  const [connectionStatus, setConnectionStatus] = React.useState<
    Record<string, boolean | null>
  >({})
  const [migratingDb, setMigratingDb] = React.useState<string | null>(null)
  const [checkingDb, setCheckingDb] = React.useState<string | null>(null)

  const fetchDatabases = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await authClient.database.list()
      if (error) {
        toast.error("Failed to fetch databases")
        return
      }
      setDatabases((data as Database[]) || [])
    } catch {
      toast.error("Failed to fetch databases")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchDatabases()
  }, [fetchDatabases])

  const handleOpenCreate = () => {
    setEditingId(null)
    setFormData(initialFormData)
    setIsOpen(true)
  }

  const handleOpenEdit = (db: Database) => {
    setEditingId(db.id)
    setFormData({
      host: db.host,
      port: String(db.port),
      user: db.user,
      password: db.password,
      database: db.database,
      domain: db.domain,
      provider: db.provider,
    })
    setConnectionStatus((prev) => ({ ...prev, [db.id]: null }))
    setIsOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        port: Number(formData.port),
      }

      let result
      if (editingId) {
        result = await authClient.database.update({ id: editingId, ...payload })
      } else {
        result = await authClient.database.add(payload)
      }

      const { error } = result
      if (error) {
        toast.error(
          editingId ? "Failed to update database" : "Failed to create database"
        )
        return
      }

      toast.success(editingId ? "Database updated" : "Database created")
      setIsOpen(false)
      fetchDatabases()
    } catch {
      toast.error(
        editingId ? "Failed to update database" : "Failed to create database"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this database?")) return

    try {
      const { error } = await authClient.database.delete({ id })
      if (error) {
        toast.error("Failed to delete database")
        return
      }
      toast.success("Database deleted")
      fetchDatabases()
    } catch {
      toast.error("Failed to delete database")
    }
  }

  const handleCheckConnection = async (id: string) => {
    setCheckingDb(id)
    try {
      const { data, error } = await authClient.database.checkConnection({
        databaseId: id,
      })
      if (error) {
        toast.error("Failed to check connection")
        setConnectionStatus((prev) => ({ ...prev, [id]: false }))
        return
      }
      const isConnected = (data as { connected?: boolean })?.connected ?? false
      setConnectionStatus((prev) => ({ ...prev, [id]: isConnected }))
      if (isConnected) {
        toast.success("Connection successful")
      } else {
        toast.error("Connection failed")
      }
    } catch {
      toast.error("Failed to check connection")
      setConnectionStatus((prev) => ({ ...prev, [id]: false }))
    } finally {
      setCheckingDb(null)
    }
  }

  const handleMigrate = async (id: string) => {
    setMigratingDb(id)
    try {
      const { data, error } = await authClient.database.migrate({
        databaseId: id,
      })
      if (error) {
        toast.error("Migration failed")
        return
      }
      toast.success("Migration completed successfully")
    } catch {
      toast.error("Migration failed")
    } finally {
      setMigratingDb(null)
    }
  }

  const handleChange = (field: keyof DatabaseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Databases</h1>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button onClick={handleOpenCreate}>
              <PlusIcon className="size-4" />
              Add Database
            </Button>
          </SheetTrigger>
          <SheetContent>
            <form onSubmit={handleSave}>
              <SheetHeader>
                <SheetTitle>
                  {editingId ? "Edit Database" : "Add Database"}
                </SheetTitle>
                <SheetDescription>
                  {editingId
                    ? "Update database configuration."
                    : "Enter the database connection details."}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select
                    value={formData.provider}
                    onValueChange={(value) => handleChange("provider", value)}
                  >
                    <SelectTrigger id="provider" className={"w-full"}>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent className={"w-full"}>
                      <SelectItem value="postgres">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={formData.host}
                    onChange={(e) => handleChange("host", e.target.value)}
                    placeholder="localhost"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => handleChange("port", e.target.value)}
                    placeholder="5432"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="database">Database Name</Label>
                  <Input
                    id="database"
                    value={formData.database}
                    onChange={(e) => handleChange("database", e.target.value)}
                    placeholder="myapp"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="user">User</Label>
                  <Input
                    id="user"
                    value={formData.user}
                    onChange={(e) => handleChange("user", e.target.value)}
                    placeholder="postgres"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    placeholder="********"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    value={formData.domain}
                    onChange={(e) => handleChange("domain", e.target.value)}
                    placeholder="example.com"
                    required
                  />
                </div>
              </div>
              <SheetFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingId ? "Update" : "Create"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">Loading databases...</p>
          </div>
        ) : databases.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">
              No databases configured. Add one!
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Domain</th>
                  <th className="px-4 py-2 text-left font-medium">Provider</th>
                  <th className="px-4 py-2 text-left font-medium">Host</th>
                  <th className="px-4 py-2 text-left font-medium">Database</th>
                  <th className="px-4 py-2 text-center font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {databases.map((db) => (
                  <tr key={db.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{db.domain}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {db.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {db.host}:{db.port}
                    </td>
                    <td className="px-4 py-3">{db.database}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {connectionStatus[db.id] === true ? (
                          <CheckCircleIcon
                            className="size-4 text-green-500"
                            title="Connected"
                          />
                        ) : connectionStatus[db.id] === false ? (
                          <XCircleIcon
                            className="size-4 text-destructive"
                            title="Disconnected"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleCheckConnection(db.id)}
                          disabled={checkingDb === db.id}
                          title="Check Connection"
                        >
                          {checkingDb === db.id ? (
                            <LoaderIcon className="size-4 animate-spin" />
                          ) : connectionStatus[db.id] === true ? (
                            <CheckCircleIcon className="size-4 text-green-500" />
                          ) : connectionStatus[db.id] === false ? (
                            <XCircleIcon className="size-4 text-destructive" />
                          ) : (
                            <PlugIcon className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleMigrate(db.id)}
                          disabled={migratingDb === db.id}
                          title="Run Migration"
                        >
                          {migratingDb === db.id ? (
                            <LoaderIcon className="size-4 animate-spin" />
                          ) : (
                            <FolderSyncIcon className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleOpenEdit(db)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDelete(db.id)}
                        >
                          <TrashIcon className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

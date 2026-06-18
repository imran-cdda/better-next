"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  PlusIcon,
  TrashIcon,
  MoreVerticalIcon,
  MailIcon,
  PencilIcon,
  ChevronDownIcon,
  RefreshCwIcon,
} from "lucide-react"
import {
  EvaluatorBuilder,
  type EvaluatorCriteria,
} from "@/components/email/evaluator-builder"
import type {
  EmailTemplate,
  EmailTemplateInput,
  TemplateFormData,
  ModelInfo,
} from "@/components/email/types/email"
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listModels,
  DEFAULT_TEMPLATE_FORM,
} from "@/components/email/types/email"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"

// ============================================================================
// Utility Components
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
      <MailIcon className="mb-4 size-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-medium">No email templates</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Create your first email template to get started
      </p>
      <Button onClick={onCreate}>
        <PlusIcon className="mr-2 size-4" />
        Create template
      </Button>
    </div>
  )
}

// ============================================================================
// Template Row Component
// ============================================================================

interface TemplateRowProps {
  template: EmailTemplate
  onEdit: (template: EmailTemplate) => void
  onDelete: (id: string) => void
}

function TemplateRow({ template, onEdit, onDelete }: TemplateRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{template.name}</div>
        <div className="text-xs text-muted-foreground">
          {template.model} / {template.event}
        </div>
      </div>
      <div className="truncate text-sm text-muted-foreground sm:w-48">
        {template.subject}
      </div>
      <div className="text-xs text-muted-foreground">
        {new Date(template.createdAt).toLocaleDateString()}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="ghost" size="icon-sm">
            <MoreVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(template)}>
            <PencilIcon className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(template.id)}
            className="text-destructive focus:text-destructive"
          >
            <TrashIcon className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ============================================================================
// Template Form Component
// ============================================================================

interface TemplateFormProps {
  template?: EmailTemplate | null
  models: ModelInfo[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: EmailTemplateInput) => Promise<void>
}

function TemplateForm({
  template,
  models,
  open,
  onOpenChange,
  onSave,
}: TemplateFormProps) {
  const [formData, setFormData] = useState<TemplateFormData>(
    DEFAULT_TEMPLATE_FORM
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when template changes or sheet opens
  useEffect(() => {
    if (open) {
      if (template) {
        setFormData({
          name: template.name,
          model: template.model,
          event: template.event,
          criteria: template.criteria || {},
          subject: template.subject,
          to: template.to,
          cc: template.cc || "",
          bcc: template.bcc || "",
          bodyType: template.bodyType,
          body: template.body,
        })
      } else {
        setFormData(DEFAULT_TEMPLATE_FORM)
      }
      setError(null)
    }
  }, [open, template])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSave({
        name: formData.name,
        model: formData.model,
        event: formData.event,
        criteria: formData.criteria,
        subject: formData.subject,
        to: formData.to,
        cc: formData.cc || undefined,
        bcc: formData.bcc || undefined,
        bodyType: formData.bodyType,
        body: formData.body,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setLoading(false)
    }
  }

  const handleCriteriaChange = useCallback((criteria: EvaluatorCriteria) => {
    setFormData((prev) => ({ ...prev, criteria }))
  }, [])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-max min-w-xl overflow-y-auto p-4"
      >
        <SheetHeader className="p-0">
          <SheetTitle>
            {template ? "Edit Email Template" : "Create Email Template"}
          </SheetTitle>
          <SheetDescription>
            {template
              ? "Update the email template details and criteria"
              : "Create a new email template with custom criteria matching"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Basic Info */}
          <FieldGroup>
            <Field>
              <FieldLabel>Template Name *</FieldLabel>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Welcome Email"
                required
                disabled={loading}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Model *</FieldLabel>
                <Select
                  value={formData.model || ""}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, model: v || "" }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.name} value={model.name}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>The data model to match</FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Event *</FieldLabel>
                <Input
                  value={formData.event}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, event: e.target.value }))
                  }
                  placeholder="e.g., post_save"
                  required
                  disabled={loading}
                />
                <FieldDescription>
                  The event that triggers this
                </FieldDescription>
              </Field>
            </div>
          </FieldGroup>

          {/* Criteria Builder */}
          <Field>
            <FieldLabel>Evaluation Criteria</FieldLabel>
            <div className="mt-2 rounded-lg border p-4">
              <EvaluatorBuilder
                value={formData.criteria}
                onChange={handleCriteriaChange}
                models={models}
                rootModel={formData.model} // the selected model drives the root
                disabled={loading}
              />
            </div>
            <FieldDescription>
              Define when this template should be used based on data conditions
            </FieldDescription>
          </Field>

          {/* Email Fields */}
          <FieldGroup>
            <Field>
              <FieldLabel>Subject *</FieldLabel>
              <Input
                value={formData.subject}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, subject: e.target.value }))
                }
                placeholder="Email subject line"
                required
                disabled={loading}
              />
            </Field>

            <Field>
              <FieldLabel>To *</FieldLabel>
              <Input
                value={formData.to}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, to: e.target.value }))
                }
                placeholder="recipient@example.com"
                required
                disabled={loading}
              />
              <FieldDescription>
                Use {"{field}"} for dynamic values
              </FieldDescription>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>CC</FieldLabel>
                <Input
                  value={formData.cc}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, cc: e.target.value }))
                  }
                  placeholder="cc@example.com"
                  disabled={loading}
                />
              </Field>

              <Field>
                <FieldLabel>BCC</FieldLabel>
                <Input
                  value={formData.bcc}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, bcc: e.target.value }))
                  }
                  placeholder="bcc@example.com"
                  disabled={loading}
                />
              </Field>
            </div>
          </FieldGroup>

          {/* Body */}
          <Field>
            <div className="mb-2 flex items-center justify-between">
              <FieldLabel>Email Body *</FieldLabel>
              <DropdownMenu>
                <DropdownMenuTrigger disabled={loading}>
                  <Button variant="outline" size="sm">
                    {formData.bodyType === "html" ? "HTML" : "Plain Text"}
                    <ChevronDownIcon className="ml-2 size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, bodyType: "html" }))
                    }
                  >
                    HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, bodyType: "text" }))
                    }
                  >
                    Plain Text
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <textarea
              value={formData.body}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, body: e.target.value }))
              }
              placeholder={
                formData.bodyType === "html"
                  ? "<p>Hello, welcome to our platform!</p>"
                  : "Hello, welcome to our platform!"
              }
              required
              disabled={loading}
              rows={10}
              className={cn(
                "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            />
          </Field>

          {error && <FieldError>{error}</FieldError>}

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : template ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function EmailTemplatePage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] =
    useState<EmailTemplate | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Fetch templates and models
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [templatesRes, modelsRes] = await Promise.all([
        authClient.email.templates(),
        authClient.email.models(),
      ])
      if (templatesRes.data?.success) {
        setTemplates(templatesRes.data.templates)
      }
      if (modelsRes.data?.success) {
        setModels(modelsRes.data.models)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Handle create
  const handleCreate = () => {
    setSelectedTemplate(null)
    setIsFormOpen(true)
  }

  // Handle edit
  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setIsFormOpen(true)
  }

  // Handle save
  const handleSave = async (data: EmailTemplateInput) => {
    if (selectedTemplate) {
      const response = await updateTemplate(selectedTemplate.id, data)
      if (!response.success) {
        throw new Error(response.error || "Failed to update template")
      }
    } else {
      const response = await createTemplate(data)
      if (!response.success) {
        throw new Error(response.error || "Failed to create template")
      }
    }
    await fetchTemplates()
  }

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) {
      return
    }

    try {
      const response = await deleteTemplate(id)
      if (response.success) {
        await fetchTemplates()
      } else {
        alert(response.error || "Failed to delete template")
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete template")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage email templates with custom evaluation criteria
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTemplates}
            disabled={loading}
          >
            <RefreshCwIcon
              className={cn("mr-2 size-4", loading && "animate-spin")}
            />
            Refresh
          </Button>
          <Button onClick={handleCreate}>
            <PlusIcon className="mr-2 size-4" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTemplates}
            className="mt-2"
          >
            Try again
          </Button>
        </div>
      ) : templates.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : (
        <div className="space-y-2">
          {/* Table header */}
          <div className="hidden items-center gap-4 rounded-lg border bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground md:flex">
            <div className="flex-1">Name</div>
            <div className="w-48">Subject</div>
            <div className="w-20">Created</div>
            <div className="w-10">Actions</div>
          </div>
          {/* Template rows */}
          <div className="space-y-2">
            {templates.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Template Form Sheet */}
      <TemplateForm
        template={selectedTemplate}
        models={models}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSave}
      />
    </div>
  )
}

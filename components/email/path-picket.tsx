"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChevronRightIcon, ChevronsUpDownIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "../ui/button"
import { cn } from "@/lib/utils"
import { Input } from "../ui/input"
import { ModelInfo } from "./types/email"

// ============================================================================
// FieldPathPicker
// ============================================================================

interface FieldPathPickerProps {
  value: string
  onChange: (path: string) => void
  models: ModelInfo[]
  rootModel: string // the model selected at the template level
  disabled?: boolean
}

export function FieldPathPicker({
  value,
  onChange,
  models,
  rootModel,
  disabled,
}: FieldPathPickerProps) {
  const [open, setOpen] = useState(false)
  const [chain, setChain] = useState<
    { modelName: string; fieldName: string }[]
  >([])

  // Current model to display fields for
  const currentModelName =
    chain.length === 0 ? rootModel : chain[chain.length - 1].modelName

  const currentModel = models.find(
    (m) => m.name.toLowerCase() === currentModelName.toLowerCase()
  )

  // A field is a relation if its type matches any model name
  const getRelatedModel = (fieldType: string) =>
    models.find((m) => m.name.toLowerCase() === fieldType.toLowerCase())

  const handleSelect = (fieldName: string, fieldType: string) => {
    const relatedModel = getRelatedModel(fieldType)

    if (relatedModel) {
      // Drill deeper — push related model name into chain
      setChain((prev) => [...prev, { modelName: relatedModel.name, fieldName }])
      // Don't commit yet — user needs to pick a leaf field
    } else {
      // Leaf scalar field — build full dot path and commit
      const parts = [...chain.map((c) => c.fieldName), fieldName]
      onChange(parts.join("."))
      setOpen(false)
      setChain([])
    }
  }

  const handleBreadcrumbClick = (index: number) => {
    setChain((prev) => prev.slice(0, index + 1))
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setChain([])
  }

  const displayParts = value ? value.split(".") : []

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          {value ? (
            <span className="flex flex-wrap items-center gap-1">
              {displayParts.map((part, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && (
                    <ChevronRightIcon className="size-3 text-muted-foreground" />
                  )}
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs",
                      i < displayParts.length - 1
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 font-medium text-primary"
                    )}
                  >
                    {part}
                  </span>
                </span>
              ))}
            </span>
          ) : (
            "Select field..."
          )}
          <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="start">
        {/* Breadcrumb nav */}
        <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setChain([])}
            className={cn(
              "transition-colors hover:text-foreground",
              chain.length === 0 &&
                "pointer-events-none font-medium text-foreground"
            )}
          >
            {rootModel || "root"}
          </button>
          {chain.map((step, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRightIcon className="size-3" />
              <button
                type="button"
                onClick={() => handleBreadcrumbClick(i)}
                className={cn(
                  "transition-colors hover:text-foreground",
                  i === chain.length - 1 &&
                    "pointer-events-none font-medium text-foreground"
                )}
              >
                {step.fieldName}
              </button>
            </span>
          ))}
        </div>

        {/* Current model label */}
        {currentModel && (
          <div className="border-b bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {currentModel.name}
          </div>
        )}

        {/* Field list */}
        <div className="max-h-56 overflow-y-auto py-1">
          {!currentModel ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {rootModel
                ? `No model found for "${currentModelName}"`
                : "Select a model first"}
            </p>
          ) : currentModel.fields.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No fields</p>
          ) : (
            currentModel.fields.map((field) => {
              const relatedModel = getRelatedModel(field.type)
              return (
                <button
                  key={field.name}
                  type="button"
                  onClick={() => handleSelect(field.name, field.type)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-sm",
                    "text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{field.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {relatedModel ? (
                        <span className="text-blue-500">{field.type}</span>
                      ) : (
                        field.type
                      )}
                    </span>
                  </span>
                  {relatedModel ? (
                    <ChevronRightIcon className="size-4 shrink-0 text-blue-400" />
                  ) : null}
                </button>
              )
            })
          )}
        </div>

        {/* Manual input fallback */}
        <div className="border-t px-3 py-2">
          <Input
            placeholder="Or type a path manually..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 text-xs"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

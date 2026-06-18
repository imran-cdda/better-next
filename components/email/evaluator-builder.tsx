"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  PlusIcon,
  TrashIcon,
  CopyIcon,
  CheckIcon,
  BracesIcon,
  XIcon,
  ChevronDownIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { FieldPathPicker } from "./path-picket"
import { ModelInfo } from "./types/email"

// ============================================================================
// Types
// ============================================================================

type ComparisonOperator =
  | "$eq"
  | "$ne"
  | "$in"
  | "$notIn"
  | "$gt"
  | "$gte"
  | "$lt"
  | "$lte"
  | "$contains"
  | "$startsWith"
  | "$endsWith"
  | "$has"
  | "$hasSome"
  | "$hasEvery"
  | "$isEmpty"
  | "$exists"
  | "$isNull"
  | "$search"

type LogicalOperator = "$or" | "$and" | "$nor"

interface ConditionEntry {
  id: string
  field: string
  operator: ComparisonOperator
  value: string | number | boolean | string[]
}

interface ConditionGroup {
  id: string
  type: LogicalOperator
  conditions: (ConditionEntry | ConditionGroup)[]
}

interface EvaluatorCriteria {
  fieldsChanged?: string[]
  conditions?: ConditionGroup
}

// ============================================================================
// Constants
// ============================================================================

const OPERATORS: Array<{
  value: ComparisonOperator
  label: string
  valueType: "single" | "array" | "none" | "toggle"
  category: string
}> = [
  // Equality
  { value: "$eq", label: "equals", valueType: "single", category: "Equality" },
  {
    value: "$ne",
    label: "not equals",
    valueType: "single",
    category: "Equality",
  },
  // Array
  { value: "$in", label: "in array", valueType: "array", category: "Array" },
  {
    value: "$notIn",
    label: "not in array",
    valueType: "array",
    category: "Array",
  },
  { value: "$has", label: "has", valueType: "single", category: "Array" },
  {
    value: "$hasSome",
    label: "has some",
    valueType: "array",
    category: "Array",
  },
  {
    value: "$hasEvery",
    label: "has every",
    valueType: "array",
    category: "Array",
  },
  // Comparison
  {
    value: "$gt",
    label: "greater than",
    valueType: "single",
    category: "Comparison",
  },
  {
    value: "$gte",
    label: "greater than or equal",
    valueType: "single",
    category: "Comparison",
  },
  {
    value: "$lt",
    label: "less than",
    valueType: "single",
    category: "Comparison",
  },
  {
    value: "$lte",
    label: "less than or equal",
    valueType: "single",
    category: "Comparison",
  },
  // String
  {
    value: "$contains",
    label: "contains",
    valueType: "single",
    category: "String",
  },
  {
    value: "$startsWith",
    label: "starts with",
    valueType: "single",
    category: "String",
  },
  {
    value: "$endsWith",
    label: "ends with",
    valueType: "single",
    category: "String",
  },
  {
    value: "$search",
    label: "search",
    valueType: "single",
    category: "String",
  },
  // Null/Empty
  {
    value: "$isEmpty",
    label: "is empty",
    valueType: "toggle",
    category: "Null/Empty",
  },
  {
    value: "$exists",
    label: "exists",
    valueType: "toggle",
    category: "Null/Empty",
  },
  {
    value: "$isNull",
    label: "is null",
    valueType: "toggle",
    category: "Null/Empty",
  },
]

const OPERATOR_CATEGORIES = [
  "Equality",
  "Array",
  "Comparison",
  "String",
  "Null/Empty",
]

// ============================================================================
// Utilities
// ============================================================================

function generateId(): string {
  return crypto.randomUUID()
}

function isConditionGroup(
  item: ConditionEntry | ConditionGroup
): item is ConditionGroup {
  return (
    "type" in item &&
    ("$or" === (item as ConditionGroup).type ||
      "$and" === (item as ConditionGroup).type ||
      "$nor" === (item as ConditionGroup).type)
  )
}

function createEmptyCondition(): ConditionEntry {
  return {
    id: generateId(),
    field: "",
    operator: "$eq",
    value: "",
  }
}

function createEmptyGroup(type: LogicalOperator = "$and"): ConditionGroup {
  return {
    id: generateId(),
    type,
    conditions: [],
  }
}

// ============================================================================
// Components
// ============================================================================

interface OperatorSelectorProps {
  value: ComparisonOperator
  onChange: (op: ComparisonOperator) => void
  disabled?: boolean
}

function OperatorSelector({
  value,
  onChange,
  disabled,
}: OperatorSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as ComparisonOperator)}
      disabled={disabled}
    >
      <SelectTrigger className="w-36 min-w-0">
        <SelectValue placeholder="Select operator" />
      </SelectTrigger>
      <SelectContent>
        {OPERATOR_CATEGORIES.map((category) => (
          <SelectGroup key={category}>
            <SelectLabel>{category}</SelectLabel>
            {OPERATORS.filter((op) => op.category === category).map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

interface ValueInputProps {
  operator: ComparisonOperator
  value: string | number | boolean | string[]
  onChange: (val: string | number | boolean | string[]) => void
  disabled?: boolean
}

function ValueInput({ operator, value, onChange, disabled }: ValueInputProps) {
  const op = OPERATORS.find((o) => o.value === operator)
  const valueType = op?.valueType ?? "single"

  if (valueType === "none" || valueType === "toggle") {
    return null
  }

  if (valueType === "array") {
    const arrValue = Array.isArray(value) ? value : value ? [value] : []
    const [inputVal, setInputVal] = useState("")

    const handleAdd = () => {
      if (inputVal.trim()) {
        onChange([...(arrValue as any), inputVal.trim()])
        setInputVal("")
      }
    }

    const handleRemove = (index: number) => {
      onChange(arrValue.filter((_, i) => i !== index) as any)
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && (e.preventDefault(), handleAdd())
            }
            placeholder="Add value..."
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={disabled}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
        {arrValue.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {arrValue.map((v, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs"
              >
                {String(v)}
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={disabled}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Input
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value..."
      disabled={disabled}
      type={typeof value === "number" ? "number" : "text"}
    />
  )
}

interface ConditionRowProps {
  condition: ConditionEntry
  onChange: (c: ConditionEntry) => void
  onRemove: () => void
  availableFields?: string[]
  models?: ModelInfo[] // add this
  rootModel?: string // add this
  disabled?: boolean
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
  models = [],
  rootModel = "",
  disabled,
}: ConditionRowProps) {
  const op = OPERATORS.find((o) => o.value === condition.operator)
  const needsValue = op?.valueType !== "none" && op?.valueType !== "toggle"

  return (
    <div className="flex items-start gap-2 rounded-lg border p-3">
      <div className="flex flex-1 flex-col gap-2">
        {/* Field picker */}
        <FieldPathPicker
          value={condition.field}
          onChange={(path) => onChange({ ...condition, field: path })}
          models={models}
          rootModel={rootModel}
          disabled={disabled}
        />
        {/* Operator + Value */}
        <div className="flex flex-wrap gap-2">
          <OperatorSelector
            value={condition.operator}
            onChange={(op) => onChange({ ...condition, operator: op })}
            disabled={disabled}
          />
          {needsValue && (
            <div className="min-w-[8rem] flex-1">
              <ValueInput
                operator={condition.operator}
                value={condition.value}
                onChange={(val) => onChange({ ...condition, value: val })}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        disabled={disabled}
        className="text-muted-foreground hover:text-destructive"
      >
        <TrashIcon className="size-4" />
      </Button>
    </div>
  )
}

interface ConditionGroupViewProps {
  group: ConditionGroup
  onChange: (g: ConditionGroup) => void
  onRemove?: () => void
  availableFields?: string[]
  models?: ModelInfo[] // add
  rootModel?: string // add
  disabled?: boolean
  depth?: number
}

function ConditionGroupView({
  group,
  onChange,
  onRemove,
  availableFields = [],
  models = [], // add
  rootModel = "", // add
  disabled,
  depth = 0,
}: ConditionGroupViewProps) {
  const addCondition = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, createEmptyCondition()],
    })
  }

  const addGroup = (type: LogicalOperator) => {
    onChange({
      ...group,
      conditions: [...group.conditions, createEmptyGroup(type)],
    })
  }

  const updateCondition = (
    index: number,
    c: ConditionEntry | ConditionGroup
  ) => {
    const newConditions = [...group.conditions]
    newConditions[index] = c
    onChange({ ...group, conditions: newConditions })
  }

  const removeCondition = (index: number) => {
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    })
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        depth > 0 && "border-dashed bg-muted/30"
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Select
          value={group.type}
          onValueChange={(value) =>
            onChange({ ...group, type: value as "$and" | "$or" | "$nor" })
          }
          disabled={disabled}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="$and">AND</SelectItem>
            <SelectItem value="$or">OR</SelectItem>
            <SelectItem value="$nor">NOR</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {group.conditions.length} condition
          {group.conditions.length !== 1 ? "s" : ""}
        </span>
        <div className="flex-1" />
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive"
          >
            <TrashIcon className="size-4" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {group.conditions.map((item, index) =>
          isConditionGroup(item) ? (
            <ConditionGroupView
              key={item.id}
              group={item}
              onChange={(g) => updateCondition(index, g)}
              onRemove={() => removeCondition(index)}
              models={models}
              rootModel={rootModel}
              disabled={disabled}
              depth={depth + 1}
            />
          ) : (
            <ConditionRow
              key={item.id}
              condition={item}
              onChange={(c) => updateCondition(index, c)}
              onRemove={() => removeCondition(index)}
              models={models}
              rootModel={rootModel}
              disabled={disabled}
            />
          )
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCondition}
          disabled={disabled}
        >
          <PlusIcon className="size-4" />
          Add condition
        </Button>
        {depth < 2 && (
          <DropdownMenu>
            <DropdownMenuTrigger disabled={disabled}>
              <Button type="button" variant="outline" size="sm">
                <BracesIcon className="size-4" />
                Add group
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => addGroup("$and")}>
                AND group
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addGroup("$or")}>
                OR group
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addGroup("$nor")}>
                NOR group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Main EvaluatorBuilder Component
// ============================================================================

interface EvaluatorBuilderProps {
  value?: EvaluatorCriteria
  onChange: (criteria: EvaluatorCriteria) => void
  availableFields?: string[]
  models?: ModelInfo[] // add
  rootModel?: string // add
  disabled?: boolean
}

export function EvaluatorBuilder({
  value,
  onChange,
  availableFields = [],
  models = [], // add
  rootModel, // add
  disabled,
}: EvaluatorBuilderProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Initialize state from value
  const state = useMemo<{
    operation: "CREATE" | "UPDATE" | "DELETE"
    fieldsChanged: string[]
    rootGroup: ConditionGroup
  }>(() => {
    if (value) {
      return {
        operation: (value as any).operation || "CREATE",
        fieldsChanged: value.fieldsChanged || [],
        rootGroup: value.conditions || createEmptyGroup("$and"),
      }
    }
    return {
      operation: "CREATE",
      fieldsChanged: [],
      rootGroup: createEmptyGroup("$and"),
    }
  }, [value])

  // Serialize to criteria JSON
  const serialize = useCallback((): EvaluatorCriteria => {
    const result: EvaluatorCriteria = {}

    if (state.operation === "UPDATE" && state.fieldsChanged.length > 0) {
      result.fieldsChanged = state.fieldsChanged
    }

    if (state.rootGroup.conditions.length > 0) {
      result.conditions = state.rootGroup
    }

    return result
  }, [state])

  // Update onChange when state changes
  const handleStateChange = useCallback(
    (newState: typeof state) => {
      const tempState = { ...state, ...newState }
      const criteria: EvaluatorCriteria = {}

      if (
        tempState.operation === "UPDATE" &&
        tempState.fieldsChanged.length > 0
      ) {
        criteria.fieldsChanged = tempState.fieldsChanged
      }

      if (tempState.rootGroup.conditions.length > 0) {
        criteria.conditions = tempState.rootGroup
      }

      onChange(criteria)
    },
    [state, onChange]
  )

  // Handle operation change
  const handleOperationChange = (op: "CREATE" | "UPDATE" | "DELETE") => {
    handleStateChange({ operation: op } as any)
  }

  // Handle fields changed for UPDATE
  const [fieldsInput, setFieldsInput] = useState(state.fieldsChanged.join(", "))
  const handleFieldsBlur = () => {
    const fields = fieldsInput
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean)
    handleStateChange({ fieldsChanged: fields } as any)
  }

  // Handle root group change
  const handleRootGroupChange = (group: ConditionGroup) => {
    handleStateChange({ rootGroup: group } as any)
  }

  // Copy to clipboard
  const handleCopy = async () => {
    const json = JSON.stringify(serialize(), null, 2)
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Clear all
  const handleClear = () => {
    handleStateChange({
      operation: "CREATE",
      fieldsChanged: [],
      rootGroup: createEmptyGroup("$and"),
    })
    setFieldsInput("")
  }

  const previewJson = JSON.stringify(serialize(), null, 2)

  return (
    <div className="flex flex-col gap-4">
      {/* Operation selector */}
      <Field>
        <FieldLabel>Operation</FieldLabel>
        <Select
          value={state.operation}
          onValueChange={(value) =>
            handleOperationChange(value as "CREATE" | "UPDATE" | "DELETE")
          }
          disabled={disabled}
        >
          <SelectTrigger className="w-36 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CREATE">CREATE</SelectItem>
            <SelectItem value="UPDATE">UPDATE</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
          </SelectContent>
        </Select>
        <FieldDescription>
          The type of database operation to match against
        </FieldDescription>
      </Field>

      {/* Fields changed (for UPDATE) */}
      {state.operation === "UPDATE" && (
        <Field>
          <FieldLabel>Fields Changed</FieldLabel>
          <Input
            value={fieldsInput}
            onChange={(e) => setFieldsInput(e.target.value)}
            onBlur={handleFieldsBlur}
            placeholder="field1, field2, ..."
            disabled={disabled}
          />
          <FieldDescription>
            Comma-separated list of fields that must change
          </FieldDescription>
        </Field>
      )}

      {/* Conditions builder */}
      <Field>
        <FieldLabel>Conditions</FieldLabel>
        <ConditionGroupView
          group={state.rootGroup}
          onChange={handleRootGroupChange}
          models={models}
          rootModel={rootModel || state.operation}
          disabled={disabled}
        />
        <FieldDescription>
          Define conditions using logical operators (AND/OR/NOR)
        </FieldDescription>
      </Field>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsPreviewOpen(true)}
        >
          <BracesIcon className="size-4" />
          Preview JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={disabled}
        >
          <XIcon className="size-4" />
          Clear all
        </Button>
      </div>

      {/* JSON Preview Sheet */}
      <Sheet open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <SheetContent side="bottom" className="h-[70vh]">
          <SheetHeader>
            <SheetTitle>Criteria JSON Preview</SheetTitle>
            <SheetDescription>
              This JSON will be stored as the template criteria
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex-1 overflow-auto">
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs">
              {previewJson}
            </pre>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={handleCopy}>
              {copied ? (
                <>
                  <CheckIcon className="size-4" />
                  Copied!
                </>
              ) : (
                <>
                  <CopyIcon className="size-4" />
                  Copy to clipboard
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Hidden datalist for field autocomplete */}
      <datalist id="available-fields">
        {availableFields.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </div>
  )
}

export type {
  EvaluatorCriteria,
  ConditionEntry,
  ConditionGroup,
  LogicalOperator,
}

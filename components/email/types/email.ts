import type { EvaluatorCriteria } from "@/components/email/evaluator-builder"

// ============================================================================
// Email Template Types
// ============================================================================

export type BodyType = "html" | "text"

export interface EmailTemplate {
  id: string
  name: string
  model: string
  event: string
  criteria: EvaluatorCriteria | null
  subject: string
  to: string
  cc?: string
  bcc?: string
  bodyType: BodyType
  body: string
  createdAt: string | Date
  updatedAt: string | Date
}

export interface EmailTemplateInput {
  name: string
  model: string
  event: string
  criteria?: EvaluatorCriteria
  subject: string
  to: string
  cc?: string
  bcc?: string
  bodyType: BodyType
  body: string
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean
  template?: T
  templates?: T
  count?: number
  message?: string
  error?: string
}

export interface EmailTemplateListResponse {
  success: boolean
  templates: EmailTemplate[]
  count: number
}

export interface EmailTemplateStats {
  total: number
  byModel: Record<string, number>
  byEvent: Record<string, number>
}

// ============================================================================
// Form Types
// ============================================================================

export interface TemplateFormData {
  name: string
  model: string
  event: string
  criteria: EvaluatorCriteria
  subject: string
  to: string
  cc: string
  bcc: string
  bodyType: BodyType
  body: string
}

export const DEFAULT_TEMPLATE_FORM: TemplateFormData = {
  name: "",
  model: "",
  event: "",
  criteria: {},
  subject: "",
  to: "",
  cc: "",
  bcc: "",
  bodyType: "html",
  body: "",
}

// ============================================================================
// API Functions
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}/api/auth${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

export async function listTemplates(params?: {
  limit?: number
  offset?: number
  model?: string
  event?: string
}): Promise<EmailTemplateListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set("limit", String(params.limit))
  if (params?.offset) searchParams.set("offset", String(params.offset))
  if (params?.model) searchParams.set("model", params.model)
  if (params?.event) searchParams.set("event", params.event)

  const query = searchParams.toString()
  return fetchApi(`/email/template${query ? `?${query}` : ""}`)
}

export async function getTemplate(
  id: string
): Promise<ApiResponse<EmailTemplate>> {
  return fetchApi(`/email/template/${id}`)
}

export async function createTemplate(
  data: EmailTemplateInput
): Promise<ApiResponse<EmailTemplate>> {
  return fetchApi("/email/template", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function updateTemplate(
  id: string,
  data: Partial<EmailTemplateInput>
): Promise<ApiResponse<EmailTemplate>> {
  return fetchApi(`/email/template/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteTemplate(id: string): Promise<ApiResponse<null>> {
  return fetchApi(`/email/template/${id}`, {
    method: "DELETE",
  })
}

// ============================================================================
// Model Types
// ============================================================================

export interface ModelField {
  name: string
  type: string
}

export interface ModelInfo {
  name: string
  fields: ModelField[]
}

export interface ListModelsResponse {
  success: boolean
  models: ModelInfo[]
}

export async function listModels(): Promise<ListModelsResponse> {
  return fetchApi("/email/models")
}

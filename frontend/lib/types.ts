/**
 * AEON Database Contract Types
 * =============================
 * Auto-synced from Supabase schema.
 * DO NOT EDIT MANUALLY - regenerate via aeon_audit.py
 * 
 * Last sync: 2025-11-29
 */

// ============================================
// BASE TYPES
// ============================================

/** ISO 8601 timestamp string */
export type Timestamp = string;

/** ISO 8601 date string (YYYY-MM-DD) */
export type DateString = string;

/** Time string (HH:MM:SS) */
export type TimeString = string;

/** JSON object */
export type JsonObject = Record<string, unknown>;

/** JSON array */
export type JsonArray = unknown[];

// ============================================
// TENANTS
// ============================================

export interface Tenant {
  id: number;
  name: string;
  slug: string | null;
  status: string | null;
  settings: JsonObject | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

export interface TenantCreate {
  name: string;
  slug?: string | null;
  status?: string | null;
  settings?: JsonObject | null;
}

export interface TenantUpdate {
  name?: string;
  slug?: string | null;
  status?: string | null;
  settings?: JsonObject | null;
}

// ============================================
// USERS
// ============================================

export interface User {
  id: number;
  tenant_id: number | null;
  email: string;
  role: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: string | null;
  settings: JsonObject | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

export interface UserCreate {
  tenant_id?: number | null;
  email: string;
  role?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  status?: string | null;
  settings?: JsonObject | null;
}

export interface UserUpdate {
  tenant_id?: number | null;
  email?: string;
  role?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  status?: string | null;
  settings?: JsonObject | null;
}

// ============================================
// LEADS
// ============================================

export interface Lead {
  id: number;
  tenant_id: number | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  source: string | null;
  status: string | null;
  internal_notes: string | null;
  metadata: JsonObject | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

export interface LeadCreate {
  tenant_id?: number | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  source?: string | null;
  status?: string | null;
  internal_notes?: string | null;
  metadata?: JsonObject | null;
}

export interface LeadUpdate {
  tenant_id?: number | null;
  customer_name?: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  source?: string | null;
  status?: string | null;
  internal_notes?: string | null;
  metadata?: JsonObject | null;
}

// ============================================
// HOMEOWNERS
// ============================================

export interface Homeowner {
  id: number;
  tenant_id: number | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  internal_notes: string | null;
  metadata: JsonObject | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

export interface HomeownerCreate {
  tenant_id?: number | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  internal_notes?: string | null;
  metadata?: JsonObject | null;
}

export interface HomeownerUpdate {
  tenant_id?: number | null;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  internal_notes?: string | null;
  metadata?: JsonObject | null;
}

// ============================================
// INSTALLERS
// ============================================

export interface Installer {
  id: number;
  tenant_id: number | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  phone_secondary: string | null;
  company_name: string | null;
  status: string | null;
  tier: string | null;
  skills: string[] | null;
  service_area_zips: string[] | null;
  service_radius_miles: number | null;
  max_jobs_per_day: number | null;
  max_jobs_per_week: number | null;
  base_hourly_rate: number | null;
  base_job_rate: number | null;
  has_insurance: boolean | null;
  has_vehicle: boolean | null;
  has_tools: boolean | null;
  jobs_completed: number | null;
  jobs_cancelled: number | null;
  rating_average: number | null;
  rating_count: number | null;
  total_earnings: number | null;
  pending_payout: number | null;
  internal_notes: string | null;
  metadata: JsonObject | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

export interface InstallerCreate {
  tenant_id?: number | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone: string;
  phone_secondary?: string | null;
  company_name?: string | null;
  status?: string | null;
  tier?: string | null;
  skills?: string[] | null;
  service_area_zips?: string[] | null;
  service_radius_miles?: number | null;
  max_jobs_per_day?: number | null;
  max_jobs_per_week?: number | null;
  base_hourly_rate?: number | null;
  base_job_rate?: number | null;
  has_insurance?: boolean | null;
  has_vehicle?: boolean | null;
  has_tools?: boolean | null;
}

export interface InstallerUpdate {
  tenant_id?: number | null;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string;
  phone_secondary?: string | null;
  company_name?: string | null;
  status?: string | null;
  tier?: string | null;
  skills?: string[] | null;
  service_area_zips?: string[] | null;
  service_radius_miles?: number | null;
  max_jobs_per_day?: number | null;
  max_jobs_per_week?: number | null;
  base_hourly_rate?: number | null;
  base_job_rate?: number | null;
  has_insurance?: boolean | null;
  has_vehicle?: boolean | null;
  has_tools?: boolean | null;
}

// ============================================
// SUPPLIERS
// ============================================

export interface Supplier {
  id: number;
  tenant_id: number | null;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  supplier_type: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  is_active: boolean | null;
  internal_notes: string | null;
  metadata: JsonObject | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

export interface SupplierCreate {
  tenant_id?: number | null;
  company_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  supplier_type?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  is_active?: boolean | null;
  internal_notes?: string | null;
  metadata?: JsonObject | null;
}

export interface SupplierUpdate {
  tenant_id?: number | null;
  company_name?: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  supplier_type?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  is_active?: boolean | null;
  internal_notes?: string | null;
  metadata?: JsonObject | null;
}

// ============================================
// QUOTES
// ============================================

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Quote {
  id: number;
  tenant_id: number | null;
  lead_id: number | null;
  homeowner_id: number | null;
  status: string | null;
  total_price: number | null;
  valid_until: DateString | null;
  internal_notes: string | null;
  line_items: QuoteLineItem[] | null;
  metadata: JsonObject | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

export interface QuoteCreate {
  tenant_id?: number | null;
  lead_id?: number | null;
  homeowner_id?: number | null;
  status?: string | null;
  total_price?: number | null;
  valid_until?: DateString | null;
  internal_notes?: string | null;
  line_items?: QuoteLineItem[] | null;
  metadata?: JsonObject | null;
}

export interface QuoteUpdate {
  tenant_id?: number | null;
  lead_id?: number | null;
  homeowner_id?: number | null;
  status?: string | null;
  total_price?: number | null;
  valid_until?: DateString | null;
  internal_notes?: string | null;
  line_items?: QuoteLineItem[] | null;
  metadata?: JsonObject | null;
}

// ============================================
// JOBS
// ============================================

export interface ProjectDetails {
  description?: string;
  estimated_cabinets?: number;
  estimated_drawers?: number;
  style?: string;
  materials?: Array<{
    item: string;
    qty: number;
    unit_price: number;
  }>;
  estimated_total?: number;
  estimated_labor_hours?: number;
}

export interface Job {
  id: number;
  tenant_id: number | null;
  quote_id: number | null;
  lead_id: number | null;
  homeowner_id: number | null;
  installer_id: number | null;
  customer_name: string;
  status: string | null;
  scheduled_date: DateString | null;
  scheduled_time_start: TimeString | null;
  scheduled_time_end: TimeString | null;
  installer_name: string | null;
  project_details: ProjectDetails | null;
  internal_notes: string | null;
  metadata: JsonObject | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

export interface JobCreate {
  tenant_id?: number | null;
  quote_id?: number | null;
  lead_id?: number | null;
  homeowner_id?: number | null;
  installer_id?: number | null;
  customer_name: string;
  status?: string | null;
  scheduled_date?: DateString | null;
  scheduled_time_start?: TimeString | null;
  scheduled_time_end?: TimeString | null;
  installer_name?: string | null;
  project_details?: ProjectDetails | null;
  internal_notes?: string | null;
  metadata?: JsonObject | null;
}

export interface JobUpdate {
  tenant_id?: number | null;
  quote_id?: number | null;
  lead_id?: number | null;
  homeowner_id?: number | null;
  installer_id?: number | null;
  customer_name?: string;
  status?: string | null;
  scheduled_date?: DateString | null;
  scheduled_time_start?: TimeString | null;
  scheduled_time_end?: TimeString | null;
  installer_name?: string | null;
  project_details?: ProjectDetails | null;
  internal_notes?: string | null;
  metadata?: JsonObject | null;
}

// ============================================
// FILES
// ============================================

export interface File {
  id: number;
  tenant_id: number | null;
  filename: string;
  original_filename: string | null;
  file_type: string | null;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string | null;
  entity_type: string | null;
  entity_id: number | null;
  uploaded_by: number | null;
  metadata: JsonObject | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
  deleted_at: Timestamp | null;
}

export interface FileCreate {
  tenant_id?: number | null;
  filename: string;
  original_filename?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  storage_path?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  uploaded_by?: number | null;
  metadata?: JsonObject | null;
}

export interface FileUpdate {
  tenant_id?: number | null;
  filename?: string;
  original_filename?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  storage_path?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  uploaded_by?: number | null;
  metadata?: JsonObject | null;
}

// ============================================
// API RESPONSE WRAPPERS
// ============================================

export interface ApiError {
  detail: string;
  status_code?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

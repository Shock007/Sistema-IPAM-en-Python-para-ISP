export type IPStatus = 'FREE' | 'ASSIGNED' | 'ACTIVE'
export type CheckMethod = 'PING' | 'TCP' | 'WISPHUB' | 'MANUAL'

// IPs
export interface IPAddressRead {
  id: number
  ip_address: string
  subnet_id: number
  client_id: number | null
  status: IPStatus
  description: string | null
  created_at: string
  updated_at: string
}
export interface IPCreateRequest {
  ip_address: string
  subnet_id: number
  client_id?: number | null
  description?: string | null
}
/** status: ACTIVE no es asignable; ASSIGNED exige client_id; FREE no admite client_id. */
export interface IPAssignRequest {
  client_id?: number | null
  description?: string | null
  status?: Exclude<IPStatus, 'ACTIVE'>
}
export interface IPStateHistoryRead {
  id: number
  ip_id: number
  previous_status: string | null
  new_status: string
  method: CheckMethod
  details: string | null
  checked_at: string
}
export interface SubnetStats {
  subnet_id: number
  cidr: string
  name: string
  total: number
  free: number
  assigned: number
  active: number
}
export interface IPStats {
  total: number
  free: number
  assigned: number
  active: number
  by_subnet: SubnetStats[]
}

// Scan / query
export interface ScanRangeRequest {
  start_ip?: string
  end_ip?: string
  address?: string
  netmask?: string
  concurrency?: number // 1-200, def. 30
  timeout?: number // 1-30, def. 2
  run_async?: boolean
  dry_run?: boolean
}
export interface ScanDetail {
  ip_address: string
  is_up: boolean
  evaluation: Record<string, unknown> | null
}
export interface ScanSummary {
  total: number
  up: number
  down: number
  registered: number
  unregistered: number
  details: ScanDetail[]
}
export interface ScanAcceptedResponse {
  message: string
  total_ips: number
  concurrency: number
  timeout: number
}
export interface IPQueryRequest {
  ip_address: string
  use_tcp?: boolean
  pin?: string | null
  dry_run?: boolean
}
export interface IPQueryResponse {
  ip_address: string
  ping: boolean
  tcp: Record<string, boolean> | null // claves de puerto llegan como string en JSON
  evaluation: Record<string, unknown> | null
  note: string | null
}

// Subnets
export interface SubnetRead {
  id: number
  cidr: string
  name: string
  description: string | null
  vlan_id: number | null
  created_at: string
  updated_at: string
}
export interface SubnetCreate {
  cidr: string
  name: string
  description?: string | null
  vlan_id?: number | null
}
/** El CIDR es inmutable. */
export interface SubnetUpdate {
  name?: string
  description?: string | null
  vlan_id?: number | null
}

// Clients
export interface ClientRead {
  id: number
  full_name: string
  document_id: string | null
  email: string | null
  phone: string | null
  address: string | null
  wisphub_client_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
export interface ClientCreate {
  full_name: string
  document_id?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  wisphub_client_id?: string | null
}
export interface ClientUpdate extends Partial<ClientCreate> {
  is_active?: boolean
}

// Scheduler
export interface SchedulerStatus {
  enabled: boolean
  running: boolean
  job_registered: boolean
  interval_hours: number
  next_run_time: string | null
}

// en ScanRangeRequest e IPQueryRequest:
//   dry_run?: boolean

export interface ScanCommitRequest {
  results: { ip_address: string; is_up: boolean }[]
  method?: CheckMethod
  register_unregistered?: boolean
  new_subnet?: { cidr: string; name: string } | null
  client_id?: number | null
  details?: string | null
}
export interface ScanCommitResponse {
  updated: number
  registered: number
  skipped: number
  subnet_created: string | null
  changes: { ip_address: string; action: 'updated' | 'registered'; previous_status: string | null; new_status: string }[]
  skipped_ips: string[]
}
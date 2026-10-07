import { http, httpBlob, httpWithTotal } from '@/lib/http'
import type * as T from '@/types/api'

export const api = {
  health: () => http<{ status: string }>('/health'),

  subnets: {
    export: (id: number) => httpBlob(`/subnets/${id}/export`),
    list: (p?: { skip?: number; limit?: number }) => http<T.SubnetRead[]>('/subnets', { params: p }),
    get: (id: number) => http<T.SubnetRead>(`/subnets/${id}`),
    create: (b: T.SubnetCreate) => http<T.SubnetRead>('/subnets', { method: 'POST', body: b }),
    update: (id: number, b: T.SubnetUpdate) => http<T.SubnetRead>(`/subnets/${id}`, { method: 'PUT', body: b }),
    remove: (id: number, force = false) =>
      http<void>(`/subnets/${id}`, { method: 'DELETE', params: { force } }),
  },

  clients: {
    list: (p?: { skip?: number; limit?: number; only_active?: boolean }) =>
      http<T.ClientRead[]>('/clients', { params: p }),
    get: (id: number) => http<T.ClientRead>(`/clients/${id}`),
    create: (b: T.ClientCreate) => http<T.ClientRead>('/clients', { method: 'POST', body: b }),
    update: (id: number, b: T.ClientUpdate) => http<T.ClientRead>(`/clients/${id}`, { method: 'PUT', body: b }),
    remove: (id: number) => http<void>(`/clients/${id}`, { method: 'DELETE' }),
  },

  ips: {
    list: (p?: { status?: T.IPStatus; subnet_id?: number; skip?: number; limit?: number }) =>
      httpWithTotal<T.IPAddressRead[]>('/ips', { params: p }),
    create: (b: T.IPCreateRequest) => http<T.IPAddressRead>('/ips', { method: 'POST', body: b }),
    stats: (subnet_id?: number) => http<T.IPStats>('/ips/stats', { params: { subnet_id } }),
    history: (ip: string, limit = 50) =>
      http<T.IPStateHistoryRead[]>(`/ips/${ip}/history`, { params: { limit } }),
    assign: (ip: string, b: T.IPAssignRequest) =>
      http<T.IPAddressRead>(`/ips/${ip}/assign`, { method: 'PUT', body: b }),
    scan: (b: T.ScanRangeRequest) =>
      http<T.ScanSummary | T.ScanAcceptedResponse>('/ips/scan', { method: 'POST', body: b }),
    query: (b: T.IPQueryRequest) => http<T.IPQueryResponse>('/ips/query', { method: 'POST', body: b }),
    commit: (b: T.ScanCommitRequest) =>
      http<T.ScanCommitResponse>('/ips/scan/commit', { method: 'POST', body: b }),
  },

  scheduler: {
    status: () => http<T.SchedulerStatus>('/scheduler/status'),
    runNow: () => http<{ message: string }>('/scheduler/run-now', { method: 'POST' }),
  },

  env: {
    get: () => http<T.EnvConfig>('/env'),
    update: (b: T.EnvUpdate) => http<T.EnvUpdateResponse>('/env', { method: 'PUT', body: b }),
  },
}
const BASE = '/api/v1'

type Params = Record<string, string | number | boolean | null | undefined>

export class ApiError extends Error {
  status: number
  detail: unknown
  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function buildUrl(path: string, params?: Params) {
  const qs = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  })
  const s = qs.toString()
  return `${BASE}${path}${s ? `?${s}` : ''}`
}

/** FastAPI: 422 -> detail es lista [{loc,msg}], resto -> string. */
async function toApiError(res: Response): Promise<ApiError> {
  let detail: unknown
  try {
    detail = (await res.json()).detail
  } catch {
    /* sin cuerpo JSON */
  }
  let message = res.statusText || `HTTP ${res.status}`
  if (typeof detail === 'string') message = detail
  else if (Array.isArray(detail))
    message = detail
      .map((d: { loc?: unknown[]; msg?: string }) =>
        `${(d.loc ?? []).slice(1).join('.')}: ${d.msg ?? ''}`.replace(/^: /, ''))
      .join(' · ')
  return new ApiError(res.status, message, detail)
}

interface Opts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  params?: Params
  body?: unknown
}

async function core(path: string, { method = 'GET', params, body }: Opts = {}) {
  const res = await fetch(buildUrl(path, params), {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw await toApiError(res)
  return res
}

export async function http<T>(path: string, opts?: Opts): Promise<T> {
  const res = await core(path, opts)
  return (res.status === 204 ? undefined : await res.json()) as T
}

/** Para listados paginados: lee X-Total-Count. */
export async function httpWithTotal<T>(path: string, opts?: Opts) {
  const res = await core(path, opts)
  return {
    data: (await res.json()) as T,
    total: Number(res.headers.get('X-Total-Count') ?? 0),
  }
}

/** Mensaje amigable según el contrato de errores de la Fase 0. */
export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'No se pudo conectar con el servidor.'
  switch (err.status) {
    case 403: return `PIN inválido. ${err.message}`
    case 429: return 'Demasiados intentos fallidos de PIN. Intenta más tarde.'
    case 409: return err.message // duplicado o subred con IPs
    case 400: return `Rango no válido o demasiado grande. ${err.message}`
    case 422: return `Datos no válidos: ${err.message}`
    case 404: return err.message
    default: return `Error del servidor (${err.status}).`
  }
}
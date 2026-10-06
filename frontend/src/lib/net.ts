const V4 = /^\d{1,3}(\.\d{1,3}){3}$/
export const isV4 = (s: string) => V4.test(s)
export const v4ToInt = (s: string) => s.split('.').reduce((a, o) => a * 256 + Number(o), 0)

export function ipInCidr(ip: string, cidr: string): boolean {
  const [addr, p] = cidr.split('/')
  if (!isV4(ip) || !isV4(addr)) return false
  const size = 2 ** (32 - Number(p))
  const net = Math.floor(v4ToInt(addr) / size) * size
  const n = v4ToInt(ip)
  return n >= net && n < net + size
}

/** CIDR mínimo que contiene todas las IPs (solo IPv4); null si no aplica. */
export function enclosingCidr(ips: string[]): string | null {
  if (!ips.length || !ips.every(isV4)) return null
  const nums = ips.map(v4ToInt)
  const min = Math.min(...nums), max = Math.max(...nums)
  const prefix = Math.clz32((min ^ max) >>> 0)
  const size = 2 ** (32 - prefix)
  const net = Math.floor(min / size) * size
  return `${[24, 16, 8, 0].map((s) => Math.floor(net / 2 ** s) % 256).join('.')}/${prefix}`
}
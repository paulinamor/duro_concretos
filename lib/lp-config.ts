const LP_ADMIN = "https://www.grupojclogistic.app"

export interface LpOrgStatus {
  isActive: boolean
  subscriptionStatus?: string
  name?: string
  customModules?: string[] | null
}

export async function fetchOrgStatus(): Promise<LpOrgStatus | null> {
  const slug = process.env.NEXT_PUBLIC_ORG_SLUG
  if (!slug) return null
  try {
    const res = await fetch(`${LP_ADMIN}/api/lp-admin/orgs/by-slug/${slug}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const { org } = await res.json()
    return {
      isActive: org.isActive ?? true,
      subscriptionStatus: org.subscriptionStatus,
      name: org.name,
      customModules: org.customModules ?? null,
    }
  } catch {
    return null
  }
}

export function isOrgBlocked(status: LpOrgStatus | null): boolean {
  if (!status) return false
  if (!status.isActive) return true
  if (status.subscriptionStatus === "cancelled") return true
  return false
}

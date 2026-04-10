'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function LiquidityRedirect({ companyId }: { companyId: string }) {
  const router = useRouter()

  useEffect(() => {
    router.replace(`/liquidity/${companyId}`)
  }, [router, companyId])

  return (
    <div className="p-8 text-center">
      <p className="text-[var(--brand-text-secondary)] mb-4">Weiterleitung zur Liquiditätsplanung...</p>
      <a href={`/liquidity/${companyId}`} className="text-[var(--brand-primary)] underline">Öffnen</a>
    </div>
  )
}

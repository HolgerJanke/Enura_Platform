import { getSession } from '@/lib/session'

export default async function LiquidityPage() {
  const session = await getSession()

  if (!session?.companyId) {
    return (<div className="p-8 text-center"><a href="/dashboard" className="text-blue-600 underline">Zum Dashboard</a></div>)
  }

  const targetPath = `/liquidity/${session.companyId}`

  return (
    <div className="p-8 text-center">
      <p className="text-gray-500 mb-4">Weiterleitung zur Liquiditaetsplanung...</p>
      <a href={targetPath} className="text-blue-600 underline">Oeffnen</a>
      <script dangerouslySetInnerHTML={{ __html: `window.location.href="${targetPath}"` }} />
    </div>
  )
}

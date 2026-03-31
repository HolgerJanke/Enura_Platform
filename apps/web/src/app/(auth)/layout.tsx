import { getCompanyContext } from '@/lib/tenant'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { companyName } = getCompanyContext()

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-brand-text-primary">{companyName}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}

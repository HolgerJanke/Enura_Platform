import { getCompanyContext } from '@/lib/tenant'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { companyName } = getCompanyContext()

  return (
    <div className="min-h-screen flex">
      {/* Left panel — dark branding area */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative"
        style={{ backgroundColor: 'var(--brand-secondary, #1A1A1A)' }}
      >
        {/* Logo placeholder — replace with actual logo later */}
        <div className="mb-8">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-2xl text-3xl font-bold text-white"
            style={{ backgroundColor: 'var(--brand-primary, #1A56DB)' }}
          >
            {companyName.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Company name */}
        <h1 className="text-3xl font-bold tracking-wide text-white text-center px-8">
          {companyName.toUpperCase()}
        </h1>

        {/* Tagline */}
        <p
          className="mt-4 text-sm tracking-widest uppercase"
          style={{ color: 'var(--brand-primary, #1A56DB)' }}
        >
          Business Intelligence Platform
        </p>

        <p className="mt-2 text-sm text-white/50 italic">
          One Platform. All Data. Complete Visibility.
        </p>

        {/* Footer */}
        <p className="absolute bottom-6 text-xs text-white/30">
          &copy; {new Date().getFullYear()} {companyName}. Alle Rechte vorbehalten.
        </p>
      </div>

      {/* Right panel — form area */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-gray-100 p-6 sm:p-12">
        {/* Mobile-only branding (shown below lg breakpoint) */}
        <div className="lg:hidden text-center mb-8">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold text-white mb-3"
            style={{ backgroundColor: 'var(--brand-primary, #1A56DB)' }}
          >
            {companyName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{companyName}</h1>
        </div>

        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}

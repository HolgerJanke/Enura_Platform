export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — dark Enura branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative bg-[#1E293B]">
        {/* Logo placeholder */}
        <div className="mb-8">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#1A56DB] text-3xl font-bold text-white">
            E
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-wide text-white text-center px-8">
          ENURA GROUP
        </h1>

        <p className="mt-4 text-sm tracking-widest uppercase text-[#1A56DB]">
          Business Intelligence Platform
        </p>

        <p className="mt-2 text-sm text-white/50 italic">
          One Platform. All Data. Complete Visibility.
        </p>

        <p className="absolute bottom-6 text-xs text-white/30">
          &copy; {new Date().getFullYear()} Enura Group. Alle Rechte vorbehalten.
        </p>
      </div>

      {/* Right panel — form area */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-gray-100 p-6 sm:p-12">
        {/* Mobile-only branding */}
        <div className="lg:hidden text-center mb-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#1A56DB] text-2xl font-bold text-white mb-3">
            E
          </div>
          <h1 className="text-xl font-bold text-gray-900">Enura Group</h1>
        </div>

        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}

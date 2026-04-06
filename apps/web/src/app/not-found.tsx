export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-brand-text-primary mb-4">404</h1>
        <p className="text-lg text-brand-text-secondary mb-8">Diese Seite wurde nicht gefunden.</p>
        <a
          href="/login"
          className="px-4 py-2 bg-brand-primary text-white rounded-brand font-medium hover:opacity-90 transition-opacity"
        >
          Zur Anmeldung
        </a>
      </div>
    </div>
  )
}

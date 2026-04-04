import { requirePermission } from '@/lib/permissions'

const BRAND_TOKENS: ReadonlyArray<{ key: string; label: string; description: string; isColor: boolean }> = [
  { key: '--brand-primary', label: 'Primaerfarbe', description: 'Hauptaktionsfarbe fuer Buttons und aktive Elemente', isColor: true },
  { key: '--brand-secondary', label: 'Sekundaerfarbe', description: 'Texte und Ueberschriften', isColor: true },
  { key: '--brand-accent', label: 'Akzentfarbe', description: 'Hervorhebungen und Badges', isColor: true },
  { key: '--brand-background', label: 'Hintergrundfarbe', description: 'Seitenhintergrund', isColor: true },
  { key: '--brand-surface', label: 'Oberflaechenfarbe', description: 'Karten- und Panel-Hintergrund', isColor: true },
  { key: '--brand-text-primary', label: 'Primaerer Text', description: 'Haupttextfarbe', isColor: true },
  { key: '--brand-text-secondary', label: 'Sekundaerer Text', description: 'Gedaempfte Textfarbe', isColor: true },
  { key: '--brand-font', label: 'Schriftart', description: 'Schriftfamilie', isColor: false },
  { key: '--brand-radius', label: 'Eckenradius', description: 'Basis-Eckenradius fuer alle Elemente', isColor: false },
]

function getComputedCSSVar(key: string): string {
  // Server component - return the CSS variable reference
  // The actual value is injected at runtime via the root layout
  return `var(${key})`
}

export default async function BrandingSettingsPage() {
  await requirePermission('module:admin:branding')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-brand-text-primary mb-2">Branding</h1>
      <p className="text-brand-text-secondary mb-6">Verfuegbar in Phase 3</p>

      <div className="bg-brand-surface rounded-brand p-6 border border-gray-200 mb-6">
        <h2 className="text-lg font-medium text-brand-text-primary mb-4">Aktuelle Markenwerte</h2>
        <p className="text-sm text-brand-text-secondary mb-6">
          Diese Werte werden aus der Mandantenkonfiguration geladen und als CSS Custom Properties
          in die Seite injiziert. Nach der Supabase-Anbindung koennen Super User die Werte
          ueber einen Brand-Editor aendern.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BRAND_TOKENS.map((token) => {
            const isColor = token.isColor !== false

            return (
              <div
                key={token.key}
                className="rounded-brand border border-gray-200 bg-brand-background p-4"
              >
                <div className="flex items-start gap-3">
                  {isColor ? (
                    <div
                      className="h-10 w-10 flex-shrink-0 rounded-brand border border-gray-300"
                      style={{ backgroundColor: getComputedCSSVar(token.key) }}
                    />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-brand border border-gray-300 bg-gray-100">
                      <span className="text-xs text-brand-text-secondary">Aa</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-text-primary">{token.label}</p>
                    <p className="text-xs text-brand-text-secondary mt-0.5">{token.description}</p>
                    <code className="mt-1 block text-xs text-brand-text-secondary font-mono">
                      {token.key}
                    </code>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-brand-surface rounded-brand p-6 border border-gray-200">
        <h2 className="text-lg font-medium text-brand-text-primary mb-4">Brand-Vorschau</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-brand px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              Primaer-Button
            </button>
            <button
              type="button"
              className="rounded-brand border border-gray-300 bg-brand-background px-4 py-2 text-sm font-medium text-brand-text-primary"
            >
              Sekundaer-Button
            </button>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: 'var(--brand-accent)' }}
            >
              Akzent-Badge
            </span>
          </div>

          <div className="rounded-brand border border-gray-200 bg-brand-background p-4">
            <h3 className="text-sm font-medium text-brand-text-primary">Beispielkarte</h3>
            <p className="text-xs text-brand-text-secondary mt-1">
              So sieht eine typische Karte mit den aktuellen Markenwerten aus.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HoldingAdminLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" aria-hidden="true" />
        Wird geladen…
      </div>
    </div>
  )
}

import { enforceModule } from '@/lib/authz/enforce'
import { BankUploadClient } from './upload-client'

// Server wrapper: the page component itself was a client component, which cannot
// call the server-only enforceModule. This thin Server Component enforces the
// module:finance:read permission (redirecting on deny) BEFORE the bank-upload
// client UI ever loads (C1 — every company route enforces server-side).
export default async function BankUploadPage() {
  await enforceModule(['module:finance:read'])
  return <BankUploadClient />
}

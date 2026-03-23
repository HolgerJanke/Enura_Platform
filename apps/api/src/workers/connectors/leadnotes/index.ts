export { leadnotesConnector } from './worker.js'
export { getLeads, fetchAllLeadsSince } from './client.js'
export { deduplicateLeads } from './deduplicate.js'
export { normaliseLead } from './normalise.js'
export {
  LeadnotesLeadSchema,
  LeadnotesCredentialsSchema,
  type LeadnotesLead,
  type LeadnotesCredentials,
} from './schemas.js'

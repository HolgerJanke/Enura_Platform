const fs = require('fs');
const data = JSON.parse(fs.readFileSync(__dirname + '/real-data.json', 'utf8'));
const CID = '00000000-0000-0000-0000-000000000001';
const HID = '00000000-0000-0000-0000-000000000010';
const today = new Date().toISOString().split('T')[0];

function esc(s) {
  if (!s) return 'null';
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

let out = `// ===========================================================================
// Enura Platform — Real Reonic Data (auto-generated from Supabase sync)
// Generated: ${new Date().toISOString()}
// ===========================================================================

import type { TeamMemberRow, LeadRow, OfferRow, ConnectorRow, KpiSnapshotRow } from '../database.js'

const CID = '${CID}'
const HID = '${HID}'

// ---------------------------------------------------------------------------
// Team Members (${data.teamMembers.length} from Reonic)
// ---------------------------------------------------------------------------
export const realTeamMembers: TeamMemberRow[] = [\n`;

for (const tm of data.teamMembers) {
  out += `  {
    id: ${esc(tm.id)}, company_id: CID, holding_id: HID, profile_id: null,
    external_id: ${esc(tm.external_id)},
    first_name: ${esc(tm.first_name)}, last_name: ${esc(tm.last_name)},
    display_name: ${esc(tm.display_name)},
    email: ${esc(tm.email)}, phone: ${esc(tm.phone)},
    role_type: ${esc(tm.role_type || 'editor')}, team: ${esc(tm.team)}, is_active: ${tm.is_active},
    created_at: ${esc(tm.created_at)}, updated_at: ${esc(tm.updated_at)},
  },\n`;
}
out += ']\n\n';

// Leads
out += `// ---------------------------------------------------------------------------
// Leads (${data.leads.length} sample from Reonic)
// ---------------------------------------------------------------------------
export const realLeads: LeadRow[] = [\n`;
for (const l of data.leads) {
  out += `  {
    id: ${esc(l.id)}, company_id: CID, holding_id: HID,
    external_id: ${esc(l.external_id)},
    first_name: ${esc(l.first_name)}, last_name: ${esc(l.last_name)},
    email: ${esc(l.email)}, phone: ${esc(l.phone)},
    address_street: ${esc(l.address_street)}, address_zip: ${esc(l.address_zip)},
    address_city: ${esc(l.address_city)}, address_canton: ${esc(l.address_canton)},
    status: ${esc(l.status || 'new')}, source: ${esc(l.source || 'reonic')},
    setter_id: ${esc(l.setter_id)}, notes: null, qualified_at: null,
    created_at: ${esc(l.created_at)}, updated_at: ${esc(l.updated_at)},
  },\n`;
}
out += ']\n\n';

// Offers
out += `// ---------------------------------------------------------------------------
// Offers (${data.offers.length} top-value from Reonic, ${data.stats.totalOffers} total)
// ---------------------------------------------------------------------------
export const realOffers: OfferRow[] = [\n`;
for (const o of data.offers) {
  out += `  {
    id: ${esc(o.id)}, company_id: CID, holding_id: HID,
    external_id: ${esc(o.external_id)},
    lead_id: ${esc(o.lead_id)}, berater_id: ${esc(o.berater_id)},
    title: ${esc(o.title || 'Angebot')},
    description: null, amount_chf: ${esc(o.amount_chf || '0.00')},
    status: ${esc(o.status || 'draft')},
    sent_at: ${esc(o.sent_at)}, decided_at: ${esc(o.decided_at)},
    valid_until: ${esc(o.valid_until)},
    created_at: ${esc(o.created_at)}, updated_at: ${esc(o.updated_at)},
  },\n`;
}
out += ']\n\n';

// Connectors
out += `// ---------------------------------------------------------------------------
// Connectors (real from Supabase)
// ---------------------------------------------------------------------------
export const realConnectors: ConnectorRow[] = [\n`;
for (const c of data.connectors) {
  out += `  {
    id: ${esc(c.id)}, company_id: CID, holding_id: null,
    type: ${esc(c.type)}, name: ${esc(c.name)},
    credentials: ${JSON.stringify(c.credentials)},
    config: {}, status: ${esc(c.status)},
    last_synced_at: ${esc(c.last_synced_at)},
    last_error: null, sync_interval_minutes: ${c.sync_interval_minutes},
    created_at: ${esc(c.created_at)}, updated_at: ${esc(c.updated_at)},
  },\n`;
}
out += ']\n\n';

// KPI Snapshots with real numbers
const s = data.stats;
const closingRate = s.wonCount / (s.wonCount + s.lostCount + s.draftCount);
const now = new Date().toISOString();

out += `// ---------------------------------------------------------------------------
// KPI Snapshots (computed from real Reonic data: ${s.totalOffers} offers, ${s.tmCount} team members)
// ---------------------------------------------------------------------------
export const realKpiSnapshots: KpiSnapshotRow[] = [
  {
    id: 'kpi-leads-daily', company_id: CID, snapshot_type: 'leads_daily',
    entity_id: null, period_date: '${today}',
    metrics: {
      leads_new: 12, leads_qualified: 34, leads_appointment_booked: 18,
      leads_disqualified: 8, leads_unworked_count: 28,
      avg_response_time_minutes: 42,
      by_source: { reonic: 45, website: 22, empfehlung: 18, telefon: 15 },
    },
    created_at: '${now}',
  },
  {
    id: 'kpi-berater-daily', company_id: CID, snapshot_type: 'berater_daily',
    entity_id: null, period_date: '${today}',
    metrics: {
      appointments_total: 24, appointments_done: 19, appointments_no_show: 3,
      offers_created: ${s.draftCount}, offers_won: ${s.wonCount},
      closing_rate: ${(closingRate * 100).toFixed(1)},
      pipeline_value_chf: ${Math.round(s.totalVal)},
      avg_deal_duration_days: 14,
      activities_total: 87,
    },
    created_at: '${now}',
  },
  {
    id: 'kpi-setter-daily', company_id: CID, snapshot_type: 'setter_daily',
    entity_id: null, period_date: '${today}',
    metrics: {
      calls_total: 156, calls_answered: 98, calls_missed: 42, calls_voicemail: 16,
      reach_rate: 0.628, avg_duration_sec: 245, total_duration_sec: 24010,
      appointments_booked: 18, appointment_rate: 0.184,
      no_show_count: 3, no_show_rate: 0.167,
    },
    created_at: '${now}',
  },
  {
    id: 'kpi-projects-daily', company_id: CID, snapshot_type: 'projects_daily',
    entity_id: null, period_date: '${today}',
    metrics: {
      total_active: ${s.wonCount}, by_phase: { planung: 12, montage: 18, abnahme: 14, abgeschlossen: 9 },
      stalled_count: 3, delayed_count: 5,
      total_value: ${Math.round(s.wonVal)},
      avg_days_in_phase: 8,
    },
    created_at: '${now}',
  },
  {
    id: 'kpi-tenant-summary', company_id: CID, snapshot_type: 'tenant_daily_summary',
    entity_id: null, period_date: '${today}',
    metrics: {
      leads: { total: 100, new_today: 12, by_status: { new: 28, qualified: 34, appointment_booked: 18, disqualified: 8, unworked: 12 }, by_source: { reonic: 45, website: 22, empfehlung: 18, telefon: 15 } },
      projects: { total: ${s.wonCount}, active: ${s.wonCount - 9}, total_value: ${Math.round(s.wonVal)} },
      beraters_active: ${data.teamMembers.filter(t => t.role_type === 'editor').length},
    },
    created_at: '${now}',
  },
]\n`;

const outPath = __dirname + '/../packages/types/src/mocks/reonic-data.ts';
fs.writeFileSync(outPath, out);
console.log('Generated reonic-data.ts (' + out.length + ' chars, ' + out.split('\n').length + ' lines)');

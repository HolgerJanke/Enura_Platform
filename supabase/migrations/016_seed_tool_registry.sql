-- ============================================================
-- Migration 016 — Seed Tool Registry
-- Populates default tools for the Default Holding.
-- ============================================================

INSERT INTO public.tool_registry (id, holding_id, name, slug, category, base_url, auth_type, secret_ref, default_headers, interface_templates, is_active, icon_url, docs_url)
VALUES
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010',
    'Reonic CRM',
    'reonic-crm',
    'crm',
    'https://api.reonic.com/v1',
    'api_key',
    'reonic_api_key',
    '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    '[
      {
        "name": "Fetch Leads",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/leads",
        "http_method": "GET",
        "description": "Retrieve leads from Reonic CRM",
        "sync_interval_min": 15
      },
      {
        "name": "Fetch Offers",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/offers",
        "http_method": "GET",
        "description": "Retrieve offers and closing data",
        "sync_interval_min": 15
      },
      {
        "name": "Fetch Projects",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/projects",
        "http_method": "GET",
        "description": "Retrieve project status and phases",
        "sync_interval_min": 15
      },
      {
        "name": "Update Lead Status",
        "interface_type": "outbound",
        "protocol": "rest",
        "endpoint": "/leads/{id}/status",
        "http_method": "PATCH",
        "description": "Push lead status updates back to Reonic"
      }
    ]'::jsonb,
    TRUE,
    NULL,
    'https://docs.reonic.com/api'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010',
    '3CX Cloud',
    '3cx-cloud',
    'telephony',
    'https://api.3cx.com/v1',
    'api_key',
    '3cx_api_key',
    '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    '[
      {
        "name": "Fetch Call Logs",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/calls",
        "http_method": "GET",
        "description": "Retrieve call records and recordings",
        "sync_interval_min": 15
      },
      {
        "name": "Call Webhook",
        "interface_type": "inbound",
        "protocol": "webhook",
        "endpoint": "/webhooks/calls",
        "description": "Real-time call event notifications"
      }
    ]'::jsonb,
    TRUE,
    NULL,
    'https://www.3cx.com/docs/api/'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010',
    'Bexio',
    'bexio',
    'accounting',
    'https://api.bexio.com/3.0',
    'oauth2',
    'bexio_oauth2',
    '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    '[
      {
        "name": "Fetch Invoices",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/kb_invoice",
        "http_method": "GET",
        "description": "Retrieve invoices from Bexio",
        "sync_interval_min": 60
      },
      {
        "name": "Fetch Payments",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/kb_payment",
        "http_method": "GET",
        "description": "Retrieve payment records",
        "sync_interval_min": 60
      }
    ]'::jsonb,
    TRUE,
    NULL,
    'https://docs.bexio.com/'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010',
    'Google Calendar',
    'google-calendar',
    'calendar',
    'https://www.googleapis.com/calendar/v3',
    'service_account',
    'google_service_account',
    '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    '[
      {
        "name": "Fetch Events",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/calendars/{calendarId}/events",
        "http_method": "GET",
        "description": "Retrieve calendar events for appointment tracking",
        "sync_interval_min": 15
      }
    ]'::jsonb,
    TRUE,
    NULL,
    'https://developers.google.com/calendar/api'
  ),
  (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000010',
    'Leadnotes',
    'leadnotes',
    'lead_aggregation',
    'https://api.leadnotes.io/v1',
    'api_key',
    'leadnotes_api_key',
    '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    '[
      {
        "name": "Fetch Leads",
        "interface_type": "inbound",
        "protocol": "rest",
        "endpoint": "/leads",
        "http_method": "GET",
        "description": "Ingest aggregated leads from Leadnotes",
        "sync_interval_min": 15
      }
    ]'::jsonb,
    TRUE,
    NULL,
    NULL
  )
ON CONFLICT DO NOTHING;

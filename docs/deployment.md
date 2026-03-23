# Deployment-Checkliste — Enura Platform

> Vollstaendige Checkliste fuer die Bereitstellung der Enura Group BI-Plattform.
> Alle Schritte muessen in der angegebenen Reihenfolge abgearbeitet werden.

---

## 1. Voraussetzungen

### Infrastruktur
- [ ] Supabase-Projekt erstellt (Region: **EU Frankfurt** oder **Schweiz**)
- [ ] Vercel-Account mit Pro-Plan (fuer Custom Domains und Edge Functions)
- [ ] Railway- oder Fly.io-Account fuer den API-Server
- [ ] Upstash Redis-Instanz (Region: EU)
- [ ] DNS-Zugang fuer Wildcard-Subdomain (`*.platform.com`)
- [ ] Resend-Account fuer transaktionale E-Mails
- [ ] Anthropic API-Key fuer KI-Funktionen

### Lokale Entwicklungsumgebung
- [ ] Node.js 20 LTS installiert
- [ ] pnpm installiert (`npm install -g pnpm`)
- [ ] Supabase CLI installiert (`brew install supabase/tap/supabase`)
- [ ] Docker Desktop laeuft (fuer lokales Supabase)

---

## 2. Datenbank-Setup

### 2.1 Lokale Entwicklung
```bash
pnpm supabase start
pnpm supabase db reset    # fuehrt alle Migrationen + Seed aus
```

### 2.2 Produktion
```bash
# Migrationen auf Produktions-Supabase anwenden
pnpm supabase db push --db-url "postgresql://..."
```

### 2.3 Migrationsreihenfolge
| Nr. | Datei | Beschreibung |
|-----|-------|-------------|
| 001 | `001_auth_and_identity.sql` | Auth-Tabellen, Profile, Rollen, Berechtigungen |
| 002 | `002_business_data.sql` | Leads, Angebote, Projekte, Rechnungen, Konnektoren |
| 003 | `003_business_rls.sql` | Row-Level-Security-Policies fuer Geschaeftsdaten |
| 004 | `004_daily_reports.sql` | Tagesberichte-Tabelle |
| 005 | `005_tenant_settings.sql` | Mandanten-Einstellungen |
| 006 | `006_whatsapp.sql` | WhatsApp-Integration |
| 007 | `007_email_activity.sql` | E-Mail-Aktivitaetstracking |
| 008 | `008_anomalies.sql` | Anomalie-Erkennung |
| 009 | `009_impersonation.sql` | Impersonation-Sessions fuer Holding-Admins |

### 2.4 RLS-Verifizierung
```bash
pnpm test:db    # pgTAP-Tests gegen lokale Supabase-Instanz
```
- [ ] Alle RLS-Policies getestet
- [ ] Tenant A kann Tenant B's Daten nicht sehen
- [ ] Holding-Admin hat Zugriff auf alle Mandanten
- [ ] Service-Role-Queries funktionieren fuer Hintergrund-Jobs

---

## 3. Umgebungsvariablen

### 3.1 Web-App (`apps/web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PLATFORM_ROOT_DOMAIN=platform.com
REDIS_URL=rediss://...
```

### 3.2 API-Server (`apps/api/.env`)
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...?pgbouncer=true
DIRECT_URL=postgresql://...
REDIS_URL=rediss://...
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
ENCRYPTION_KEY=<32-byte-hex>
```

### 3.3 Sicherheitsregeln
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ist nur serverseitig konfiguriert
- [ ] `ANTHROPIC_API_KEY` ist nur im API-Server konfiguriert
- [ ] Keine `.env`-Dateien im Git-Repository
- [ ] Alle Secrets in Vercel/Railway Secrets Manager eingetragen

---

## 4. Build & Deploy

### 4.1 Web-App (Vercel)
```bash
pnpm --filter web build
```

Vercel-Einstellungen:
- [ ] Root-Verzeichnis: `apps/web`
- [ ] Build-Befehl: `pnpm build`
- [ ] Output-Verzeichnis: `.next`
- [ ] Node.js-Version: 20.x
- [ ] Region: **fra1** (Frankfurt)

### 4.2 API-Server (Railway/Fly.io)
```bash
pnpm --filter api build
```

- [ ] Dockerfile oder Procfile konfiguriert
- [ ] Health-Check-Endpunkt: `GET /health`
- [ ] Region: EU (Frankfurt oder Zuerich)
- [ ] Auto-Scaling konfiguriert (min: 1, max: 4)

### 4.3 Prisma-Schema synchronisieren
```bash
cd apps/api
pnpm prisma db pull
pnpm prisma generate
```

---

## 5. DNS & Domains

### 5.1 Wildcard-DNS
```
*.platform.com → Vercel (CNAME)
admin.platform.com → Vercel (CNAME)
api.platform.com → Railway/Fly.io (CNAME)
```

### 5.2 SSL
- [ ] Wildcard-SSL-Zertifikat aktiv (Vercel managed)
- [ ] API-Endpunkt ueber HTTPS erreichbar
- [ ] HSTS-Header konfiguriert

---

## 6. Mandanten-Erstellung

### 6.1 Erster Mandant (Pilot: Alpen Energie GmbH)
1. [ ] Holding-Admin ueber Supabase Auth erstellt
2. [ ] Eintrag in `holding_admins`-Tabelle
3. [ ] Mandant ueber Admin-Portal erstellen (`/admin/tenants/new`)
4. [ ] Branding konfigurieren (Farben, Logo, Schriftart)
5. [ ] Super User fuer den Mandanten erstellen
6. [ ] Konnektoren konfigurieren (Reonic, 3CX, Bexio, Google Calendar)
7. [ ] Test-Login mit Super User durchfuehren

### 6.2 Konnektor-Setup pro Mandant
| Konnektor | Auth-Methode | Konfiguration |
|-----------|-------------|---------------|
| Reonic | API-Key | Key im Connector-Settings eintragen |
| 3CX | REST API + Webhook | API-URL + Webhook-Endpoint konfigurieren |
| Bexio | OAuth 2.0 | OAuth-Flow durchlaufen |
| Google Calendar | Service Account | JSON-Keyfile hochladen |
| Leadnotes | API-Key | Key eintragen |

---

## 7. Monitoring & Alerting

### 7.1 Health Checks
- [ ] Holding-Admin-Dashboard zeigt Connector-Health
- [ ] API-Health-Endpunkt (`/health`) wird ueberwacht
- [ ] Supabase-Dashboard-Monitoring aktiv

### 7.2 Logging
- [ ] Vercel-Logs fuer Web-App
- [ ] Railway/Fly.io-Logs fuer API
- [ ] Supabase-Logs fuer Datenbank
- [ ] Audit-Log-Tabelle fuer alle administrativen Aktionen

### 7.3 Alerting
- [ ] Konnektor-Fehler nach 3 Versuchen: Holding-Admin wird benachrichtigt
- [ ] Anomalie-Erkennung aktiv: Benachrichtigung bei kritischen Abweichungen
- [ ] Supabase-Alerts fuer Datenbankkapazitaet

---

## 8. Sicherheits-Checkliste

### 8.1 Authentifizierung
- [ ] Login-Flow getestet: Login → Passwort-Reset → 2FA → Dashboard
- [ ] Session-Timeout: 8 Stunden
- [ ] Refresh-Token-Rotation aktiv
- [ ] Rate-Limiting auf Login-Endpunkt

### 8.2 Autorisierung
- [ ] Alle Routen hinter Auth-Middleware
- [ ] Rollen-basierter Zugriff getestet
- [ ] Holding-Admin hat keinen Mandanten-Zugriff (und umgekehrt)
- [ ] Impersonation nur fuer Holding-Admins, mit Audit-Trail

### 8.3 Datenschutz (DSG/DSGVO)
- [ ] Alle Daten in EU/Schweiz gehostet
- [ ] Keine PII in KI-Prompts
- [ ] Konnektor-Credentials verschluesselt (Supabase Vault)
- [ ] Keine Drittanbieter-Analytics ohne Freigabe

---

## 9. Go-Live-Checkliste

- [ ] Alle E2E-Tests bestanden
- [ ] RLS-Tests bestanden
- [ ] Performance-Test: Dashboard laedt unter 2 Sekunden
- [ ] Backup-Strategie konfiguriert (Supabase Point-in-Time Recovery)
- [ ] Rollback-Plan dokumentiert
- [ ] Holding-Admin eingewiesen
- [ ] Super User des Pilotmandanten eingewiesen
- [ ] Monitoring-Dashboard eingerichtet
- [ ] Erste Konnektor-Synchronisation erfolgreich

---

*Letzte Aktualisierung: Maerz 2026*

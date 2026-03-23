# Systemarchitektur — Enura Group BI-Plattform

> Technische Referenz fuer die Multi-Tenant Business Intelligence Plattform der Enura Group.

---

## 1. Architekturuebersicht

```
                    ┌─────────────────────────────────────────┐
                    │          DNS (Wildcard *.platform.com)   │
                    └─────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────────┐
                    │          Vercel Edge Network              │
                    │    (Next.js 14 — App Router, SSR)        │
                    │                                          │
                    │  ┌──────────────────────────────────┐    │
                    │  │  middleware.ts                     │    │
                    │  │  → Subdomain-Erkennung            │    │
                    │  │  → Mandanten-Aufloesung           │    │
                    │  │  → Auth-Gates (Session/PW/2FA)    │    │
                    │  │  → Brand-Token-Injection          │    │
                    │  └──────────────────────────────────┘    │
                    │                                          │
                    │  ┌──────────┐  ┌──────────┐             │
                    │  │ Holding  │  │ Tenant   │             │
                    │  │ Admin    │  │ Dashboard│             │
                    │  │ Portal   │  │ (je      │             │
                    │  │ (admin.) │  │ Subdomain│             │
                    │  └──────────┘  └──────────┘             │
                    └──────────┬──────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐  ┌─────▼──────┐  ┌──────▼──────┐
    │  Supabase      │  │  Fastify   │  │  Upstash    │
    │  (PostgreSQL   │  │  API       │  │  Redis      │
    │   + Auth       │  │  Server    │  │  (Cache +   │
    │   + Storage    │  │            │  │   BullMQ)   │
    │   + RLS)       │  │  Workers:  │  │             │
    │                │  │  - Sync    │  └─────────────┘
    │  TimescaleDB   │  │  - KPIs    │
    │  Hypertables   │  │  - Reports │
    └────────────────┘  │  - AI      │
                        └────────────┘
                             │
                    ┌────────┼────────────────┐
                    │        │                │
              ┌─────▼──┐ ┌──▼────┐  ┌────────▼───┐
              │ Reonic │ │ 3CX  │  │ Anthropic  │
              │ Bexio  │ │ GCal │  │ Claude API │
              │ Lead-  │ │ WA   │  │ (Analyse)  │
              │ notes  │ │ Gmail│  │            │
              └────────┘ └──────┘  └────────────┘
```

---

## 2. Schichten-Architektur

### 2.1 Praesentationsschicht (Frontend)

**Technologie**: Next.js 14 mit App Router, Server Components als Standard.

| Komponente | Verantwortung |
|-----------|--------------|
| `middleware.ts` | Subdomain-Erkennung, Auth-Gates, Mandanten-Aufloesung |
| Server Components | Initiales Datenladen, SEO, Branding-Injection |
| Client Components | Interaktive UI (Formulare, Tabs, Charts, Drag-and-Drop) |
| TanStack Query | Client-seitiges Caching und Background-Refresh |
| Zustand | Minimaler globaler State (Mandanten-Config, Session) |

**Branding-System**:
- CSS Custom Properties (`--brand-primary`, etc.) werden serverseitig in `<html>` injiziert
- Komponenten verwenden ausschliesslich Brand-Variablen, keine hartcodierten Farben
- Brand-Konfiguration wird aus der DB geladen und im Redis-Cache gehalten (TTL: 5 Min.)

### 2.2 API-Schicht (Backend)

**Technologie**: Fastify mit TypeScript.

| Komponente | Verantwortung |
|-----------|--------------|
| Route-Plugins | REST-Endpunkte mit Zod-Validierung |
| `preHandler`-Hooks | JWT-Validierung, Mandanten-Extraktion |
| BullMQ-Worker | Konnektor-Sync, KPI-Berechnung, Berichtsgenerierung |
| Prisma | Typsichere Datenbankabfragen |

**Sicherheitsregeln**:
- `tenantId` kommt immer aus dem verifizierten JWT, nie aus Client-Input
- Service-Role-Queries nur fuer Hintergrund-Jobs, nie fuer User-Requests
- Alle externen Daten werden mit Zod validiert

### 2.3 Datenschicht

**Technologie**: Supabase (PostgreSQL 15 + TimescaleDB).

| Komponente | Verantwortung |
|-----------|--------------|
| PostgreSQL | Relationale Daten, Mandanten, Benutzer, Geschaeftsdaten |
| TimescaleDB | Zeitreihendaten (Anrufe, Cashflow, KPI-Snapshots, Audit) |
| Row-Level Security | Mandanten-Isolation auf DB-Ebene |
| Supabase Auth | Authentifizierung mit TOTP-2FA |
| Supabase Storage | Dateispeicher (Anrufaufnahmen, Dokumente) — EU-Region |
| Supabase Vault | Verschluesselung von Konnektor-Credentials |

---

## 3. Mandanten-Isolation

### 3.1 Architekturprinzip

Mandanten-Isolation ist **nicht optional**. Sie wird auf drei Ebenen durchgesetzt:

1. **Datenbankebene (RLS)**: Jede Tabelle mit mandantenbezogenen Daten hat RLS-Policies.
   Die Funktionen `current_tenant_id()` und `is_holding_admin()` steuern den Zugriff.

2. **Anwendungsebene**: Middleware erkennt den Mandanten ueber die Subdomain und injiziert
   die `tenant_id` in den Request-Kontext. Dieser Wert wird nie vom Client uebernommen.

3. **UI-Ebene**: Branding wird serverseitig aufgeloest. Ein Mandant sieht nie das Branding
   eines anderen Mandanten — nicht einmal fuer einen einzelnen Frame.

### 3.2 Datenfluesse

```
Benutzer-Request (company-a.platform.com)
  → middleware.ts: Subdomain "company-a" → tenant_id abfragen
  → Supabase-Client mit User-JWT: RLS filtert automatisch
  → Response: Nur Daten von company-a sichtbar
```

```
Hintergrund-Job (Konnektor-Sync)
  → Service-Role-Client (kein RLS)
  → MUSS tenant_id explizit in jeder Query angeben
  → Schreibt nur in Tabellen des spezifischen Mandanten
```

---

## 4. Authentifizierung & Autorisierung

### 4.1 Auth-Flow

```
Login-Seite
  → Supabase Auth (E-Mail + Passwort)
  → Pruefen: must_reset_password == true?
     → Ja: Weiterleitung zu /reset-password
  → Pruefen: totp_enabled == false?
     → Ja: Weiterleitung zu /enrol-2fa
  → Dashboard
```

### 4.2 Session-Management
- Session-Tokens: 8 Stunden Gueltigkeit
- Refresh-Tokens: Rotation bei jeder Nutzung
- Server-seitige Validierung bei jedem Request (middleware.ts + API preHandler)

### 4.3 Rollen-System

| Ebene | Rollen |
|-------|--------|
| Holding | Holding-Admin (globaler Zugriff, Impersonation) |
| Mandant | Super User, Geschaeftsfuehrung, Teamleiter, Setter, Berater, Innendienst, Bau, Buchhaltung, Leadkontrolle |

Berechtigungen folgen dem Format `module:{modul}:{aktion}` (read, write, export, admin).

### 4.4 Impersonation

Holding-Admins koennen Mandanten-Benutzer impersonieren:
- 30-Minuten-Session mit eindeutigem Token
- Pflichtangabe eines Grundes
- Vollstaendige Protokollierung im Audit-Log
- Tabelle `impersonation_sessions` ohne RLS (nur Service-Role-Zugriff)

---

## 5. Konnektor-Architektur

### 5.1 Uebersicht

```
                    ┌─────────────┐
                    │  Scheduler  │ (Cron: alle 15 Min.)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  BullMQ     │ (Redis-Queue)
                    │  Queue      │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼──┐  ┌─────▼──┐  ┌─────▼──┐
        │ Reonic │  │  3CX   │  │ Bexio  │  ...
        │ Worker │  │ Worker │  │ Worker │
        └────┬───┘  └────┬───┘  └────┬───┘
             │           │           │
             ▼           ▼           ▼
        Zod-Validierung → Upsert in Supabase
        (Service Role, explizite tenant_id)
             │
             ▼
        connector_sync_log aktualisieren
        KPI-Snapshot-Neuberechnung triggern
```

### 5.2 Fehlerbehandlung
- Exponentielles Backoff: max. 3 Versuche
- Nach 3 Fehlern: `connectors.status = 'error'`, Holding-Admin wird benachrichtigt
- Connector-Health sichtbar im Holding-Admin-Dashboard (Ampelsystem)

### 5.3 Konnektoren nach Prioritaet

| Prioritaet | Konnektor | Intervall | Auth |
|-----------|-----------|----------|------|
| P1 (Muss) | Reonic CRM | 15 Min. | REST API Key |
| P1 (Muss) | 3CX Cloud | 15 Min. | REST API + Webhook |
| P1 (Muss) | Bexio | 1 Std. | OAuth 2.0 |
| P1 (Muss) | Google Calendar | 15 Min. | Service Account |
| P1 (Muss) | Leadnotes | 15 Min. | REST API Key |
| P2 (Soll) | WhatsApp Business | 30 Min. | Cloud API Token |
| P3 (Kann) | Gmail | 1 Std. | Google OAuth |

---

## 6. KI-Integration

### 6.1 Anrufanalyse-Pipeline

```
3CX-Aufnahme (Audio)
  → Supabase Storage (EU)
  → Whisper-Transkription (Schweizerdeutsch)
  → PII-Anonymisierung ([CUSTOMER], [PHONE])
  → Claude API (claude-sonnet-4-6):
    - Bewertung auf 4 Dimensionen (1-10)
    - Verbesserungsvorschlaege
  → Ergebnis → call_analysis-Tabelle
```

### 6.2 Tagesbericht

```
KPI-Snapshots (letzte 24h)
  → Aggregation pro Mitarbeiter + Team
  → Claude API (claude-sonnet-4-6, max 4000 Tokens):
    - KPI-Zusammenfassung
    - Highlights & Warnungen
    - Coaching-Vorschlaege
  → HTML-E-Mail (React Email Template)
  → Versand ueber Resend
```

### 6.3 PII-Richtlinie
**Folgende Daten werden NIE an die Claude API gesendet**:
- Kundennamen
- Telefonnummern
- Adressen
- Sonstige personenidentifizierende Daten

---

## 7. Holding-Admin-Dashboard

### 7.1 Funktionsumfang

Das Holding-Admin-Dashboard bietet Cross-Tenant-Monitoring in drei Tabs:

**Tab 1 — Uebersicht**:
- Zusammenfassungskarten: Aktive Unternehmen, Gesamte Benutzer, Aktive Projekte
- Pro Mandant: Name, Benutzeranzahl, Connector-Health-Dots, Anomalie-Badge, letzte Aktivitaet

**Tab 2 — Connectors**:
- Matrix-Tabelle aller Mandanten x Konnektor-Typen
- Ampelsystem: Gruen (<20 Min.), Gelb (<2 Std.), Rot (>2 Std. oder Fehler), Grau (nicht konfiguriert)

**Tab 3 — KI-Nutzung**:
- Pro Mandant: Transkriptionen MTD, geschaetzte Whisper-Kosten, generierte Berichte, Claude-Tokens
- Gesamtzeile mit Summen

### 7.2 Impersonation
- Holding-Admins koennen im Mandanten-Detail pro Benutzer eine Impersonation-Session erstellen
- Token-basiert, 30 Minuten gueltig, vollstaendig im Audit-Log protokolliert

---

## 8. Datenbank-Schema

### 8.1 Kern-Tabellen

| Tabelle | Beschreibung | RLS |
|---------|-------------|-----|
| `tenants` | Mandanten-Stammdaten | Ja |
| `profiles` | Benutzerprofile | Ja |
| `roles` | Rollen-Definitionen | Ja |
| `profile_roles` | Benutzer-Rollen-Zuordnung | Ja |
| `permissions` | Berechtigungsdefinitionen | Ja |
| `role_permissions` | Rollen-Berechtigungen | Ja |
| `holding_admins` | Holding-Admin-Zuordnung | Service Role |
| `connectors` | Konnektor-Konfiguration | Ja |
| `anomalies` | Erkannte Anomalien | Ja |
| `impersonation_sessions` | Impersonation-Tokens | Service Role |
| `audit_log` | Audit-Trail (Hypertable) | Service Role |

### 8.2 TimescaleDB-Hypertables

| Tabelle | Partitionsschluessel | Achtung |
|---------|---------------------|---------|
| `calls` | `started_at` | Immer mit Zeitfilter abfragen |
| `cashflow_entries` | `entry_date` | Immer mit Zeitfilter abfragen |
| `calendar_events` | `starts_at` | Immer mit Zeitfilter abfragen |
| `kpi_snapshots` | `period_date` | Immer mit Zeitfilter abfragen |
| `audit_log` | `created_at` | Immer mit Zeitfilter abfragen |

---

## 9. Sicherheitsarchitektur

### 9.1 Schichten

```
┌─────────────────────────────────────────┐
│  1. Netzwerk: HTTPS/TLS, HSTS          │
├─────────────────────────────────────────┤
│  2. Edge: Vercel Middleware (Auth Gates) │
├─────────────────────────────────────────┤
│  3. Anwendung: JWT-Validierung,         │
│     Rollen-Check, tenant_id aus JWT     │
├─────────────────────────────────────────┤
│  4. Datenbank: RLS-Policies,            │
│     current_tenant_id(),                │
│     is_holding_admin()                  │
├─────────────────────────────────────────┤
│  5. Verschluesselung: Vault fuer        │
│     Credentials, bcrypt fuer Passwoerter│
└─────────────────────────────────────────┘
```

### 9.2 Datenresidenz
- Alle Daten ausschliesslich in EU/Schweiz
- Keine Drittanbieter-Analytics ohne Freigabe
- KI-Calls nur mit anonymisierten Daten

---

*Letzte Aktualisierung: Maerz 2026*
*Schema-Version: 1.0*

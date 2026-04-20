# Anomalie-Erkennung — Enura Platform

> Leitfaden fuer das Anomalie-Erkennungssystem der Enura Group BI-Plattform.
> Die Anomalie-Erkennung identifiziert signifikante Abweichungen in KPI-Werten
> und benachrichtigt Verantwortliche automatisch.

---

## 1. Uebersicht

Das Anomalie-Erkennungssystem ueberwacht kontinuierlich die KPI-Snapshots aller Mandanten
und erkennt signifikante Abweichungen vom Baseline-Wert. Erkannte Anomalien werden in der
Tabelle `anomalies` gespeichert und im Holding-Admin-Dashboard sowie in den
Mandanten-Dashboards angezeigt.

### Ziele
- Fruehzeitige Erkennung von Leistungsabweichungen (positiv und negativ)
- Automatische Benachrichtigung von Geschaeftsfuehrung und Teamleitern
- Historische Nachverfolgung von Anomalien und deren Aufloesung

---

## 2. Datenmodell

### Tabelle: `anomalies`

| Spalte | Typ | Beschreibung |
|--------|-----|-------------|
| `id` | UUID | Primaerschluessel |
| `tenant_id` | UUID | Mandanten-Zuordnung (FK → tenants) |
| `type` | TEXT | Anomalie-Typ (siehe Abschnitt 3) |
| `severity` | TEXT | Schweregrad: `critical`, `warning`, `info` |
| `entity_id` | UUID | Referenz auf betroffene Entitaet (z.B. Mitarbeiter-ID) |
| `entity_name` | TEXT | Anzeigename der Entitaet |
| `metric` | TEXT | Betroffene Kennzahl (z.B. `calls_per_day`) |
| `current_value` | NUMERIC | Aktueller Messwert |
| `baseline_value` | NUMERIC | Erwarteter Baseline-Wert |
| `deviation_pct` | NUMERIC | Abweichung in Prozent |
| `message` | TEXT | Menschenlesbare Beschreibung |
| `detected_at` | TIMESTAMPTZ | Erkennungszeitpunkt |
| `resolved_at` | TIMESTAMPTZ | Aufloesungszeitpunkt (NULL wenn aktiv) |
| `is_active` | BOOLEAN | Aktiv-Flag (TRUE bis aufgeloest) |
| `notified` | BOOLEAN | Benachrichtigung versendet |

### RLS-Policies
- **Mandanten-Benutzer**: Koennen nur Anomalien ihres eigenen Mandanten lesen
- **Holding-Admins**: Vollzugriff auf alle Anomalien (lesen + schreiben)
- **Service-Role**: Vollzugriff (fuer Hintergrund-Worker)

### Indizes
- `idx_anomalies_active`: Mandant + aktiv + Erkennungszeitpunkt (absteigend) — fuer Dashboard-Abfragen
- `idx_anomalies_type`: Mandant + Typ + aktiv — fuer Typ-basierte Filterung

---

## 3. Anomalie-Typen

### 3.1 Setter-Performance

| Metrik | Typ | Schwellenwert |
|--------|-----|-------------|
| Anrufe/Tag | `setter_calls_drop` | < 50% des 7-Tage-Durchschnitts |
| Erreichbarkeitsrate | `setter_reach_rate_drop` | < 60% des Durchschnitts |
| Terminquote | `setter_appointment_rate_drop` | < 40% des Durchschnitts |
| No-Show-Rate | `setter_noshow_spike` | > 200% des Durchschnitts |

### 3.2 Berater-Performance

| Metrik | Typ | Schwellenwert |
|--------|-----|-------------|
| Abschlussquote | `berater_closing_drop` | < 50% des 30-Tage-Durchschnitts |
| Angebotsvolumen | `berater_offer_volume_drop` | < 40% des Durchschnitts |
| Aktivitaeten/Tag | `berater_activity_drop` | < 50% des Durchschnitts |

### 3.3 Lead-Qualitaet

| Metrik | Typ | Schwellenwert |
|--------|-----|-------------|
| Unbearbeitete Leads | `leads_unworked_spike` | > 150% des Durchschnitts |
| Reaktionszeit | `leads_response_time_spike` | > 200% des Durchschnitts |
| Lead-Qualitaetsrate | `leads_quality_drop` | < 60% des Durchschnitts |

### 3.4 Finanzen

| Metrik | Typ | Schwellenwert |
|--------|-----|-------------|
| Ueberfaellige Rechnungen | `finance_overdue_spike` | > 130% des Durchschnitts |
| Liquiditaetsprognose | `finance_liquidity_warning` | 30-Tage-Prognose unter Schwellenwert |

### 3.5 Konnektor-Gesundheit

| Metrik | Typ | Schwellenwert |
|--------|-----|-------------|
| Sync-Fehler | `connector_sync_failure` | 3 aufeinanderfolgende Fehler |
| Datenluecke | `connector_data_gap` | Keine neuen Daten seit > 2 Stunden |

---

## 4. Erkennungslogik

### 4.1 Baseline-Berechnung

Die Baseline wird aus den `kpi_snapshots`-Daten berechnet:

```
Baseline = Durchschnitt der letzten N Perioden
  - Setter-KPIs: 7-Tage-Durchschnitt
  - Berater-KPIs: 30-Tage-Durchschnitt
  - Finance-KPIs: 30-Tage-Durchschnitt
  - Lead-KPIs: 14-Tage-Durchschnitt
```

### 4.2 Abweichungsberechnung

```
deviation_pct = ((current_value - baseline_value) / baseline_value) * 100
```

Positive Abweichung = Wert hoeher als erwartet (z.B. No-Show-Spike).
Negative Abweichung = Wert niedriger als erwartet (z.B. Calls-Drop).

### 4.3 Schweregrad-Zuordnung

| Abweichung | Schweregrad |
|-----------|-------------|
| > 50% oder < -50% | `critical` |
| > 30% oder < -30% | `warning` |
| > 20% oder < -20% | `info` |

Die Schweregrad-Schwellenwerte koennen pro Mandant in den `tenant_settings` angepasst werden.

---

## 5. Worker-Implementierung

### 5.1 Ausfuehrungszeitplan

Der Anomalie-Worker laeuft als BullMQ-Job:
- **Frequenz**: Alle 15 Minuten (synchron mit dem KPI-Snapshot-Worker)
- **Implementierung**: `apps/api/src/workers/anomaly-detector.ts`

### 5.2 Ablauf

```
1. Alle aktiven Mandanten laden
2. Fuer jeden Mandanten:
   a. Aktuelle KPI-Snapshots laden (letzte Periode)
   b. Baseline-Werte berechnen (Durchschnitt vergangener Perioden)
   c. Abweichungen berechnen
   d. Fuer jede signifikante Abweichung:
      - Pruefen ob bereits eine aktive Anomalie fuer diese Metrik + Entitaet existiert
      - Wenn nein: Neue Anomalie erstellen
      - Wenn ja: Bestehende Anomalie aktualisieren (Werte aktualisieren)
   e. Pruefen ob aktive Anomalien aufgeloest werden koennen:
      - Wenn aktuelle Werte wieder innerhalb der Toleranz: resolved_at setzen, is_active = false
3. Benachrichtigungen versenden (fuer neue kritische Anomalien)
```

### 5.3 Deduplizierung

Eine Anomalie wird als **gleich** betrachtet, wenn folgende Felder uebereinstimmen:
- `tenant_id`
- `type`
- `entity_id` (oder NULL)
- `metric`
- `is_active = true`

Es wird nie eine zweite aktive Anomalie fuer die gleiche Kombination erstellt.

---

## 6. Benachrichtigungen

### 6.1 Empfaenger

| Schweregrad | Empfaenger |
|------------|-----------|
| `critical` | Holding-Admin + Geschaeftsfuehrung + Teamleiter |
| `warning` | Geschaeftsfuehrung + Teamleiter |
| `info` | Nur im Dashboard sichtbar, keine E-Mail |

### 6.2 E-Mail-Format

```
Betreff: [KRITISCH] Anomalie erkannt: {metric} bei {entity_name}

Inhalt:
- Mandant: {tenant_name}
- Metrik: {metric} ({type})
- Aktueller Wert: {current_value}
- Erwarteter Wert: {baseline_value}
- Abweichung: {deviation_pct}%
- Erkannt um: {detected_at}
- Link zum Dashboard
```

### 6.3 Benachrichtigungsregeln
- Maximal 1 Benachrichtigung pro Anomalie (gesteuert ueber `notified`-Flag)
- Aggregierte Zusammenfassung, wenn mehr als 5 Anomalien gleichzeitig erkannt werden
- Keine Benachrichtigungen zwischen 22:00 und 06:00 Uhr (Queue-Delay)

---

## 7. Dashboard-Integration

### 7.1 Holding-Admin-Dashboard

Im Tab "Uebersicht" wird pro Mandant ein Anomalie-Badge angezeigt:
- Rotes Badge mit Anzahl aktiver Anomalien
- Klick fuehrt zur Mandanten-Detailseite

### 7.2 Mandanten-Dashboard

In den jeweiligen Modul-Dashboards (Setter, Berater, Finance etc.) werden aktive Anomalien
als Warnbanner oberhalb der KPI-Karten angezeigt:
- Kritisch: Rotes Banner mit Warnsymbol
- Warnung: Gelbes Banner
- Info: Blaues Banner (einklappbar)

### 7.3 API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `GET` | `/api/anomalies` | Aktive Anomalien fuer aktuellen Mandanten |
| `GET` | `/api/admin/anomalies` | Alle Anomalien (Holding-Admin) |
| `PATCH` | `/api/anomalies/:id/resolve` | Anomalie manuell aufloesen |

---

## 8. Konfiguration

### 8.1 Mandanten-spezifische Schwellenwerte

In den `tenant_settings` koennen folgende Werte angepasst werden:

```json
{
  "anomaly_thresholds": {
    "setter_calls_drop_pct": -50,
    "setter_noshow_spike_pct": 200,
    "berater_closing_drop_pct": -50,
    "leads_unworked_spike_pct": 150,
    "finance_overdue_spike_pct": 130,
    "connector_max_failures": 3,
    "connector_data_gap_minutes": 120
  },
  "anomaly_notifications": {
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "06:00",
    "max_emails_per_hour": 10
  }
}
```

### 8.2 Globale Standardwerte

Wenn ein Mandant keine eigenen Schwellenwerte konfiguriert hat, werden die
Standardwerte aus der Plattformkonfiguration verwendet (siehe Abschnitt 3).

---

## 9. Testing

### 9.1 Unit-Tests
- Baseline-Berechnung mit bekannten Eingabewerten
- Abweichungsberechnung (positive und negative)
- Schweregrad-Zuordnung
- Deduplizierungslogik

### 9.2 Integrationstests
- Worker erkennt echte Anomalien bei simulierten KPI-Daten
- Benachrichtigungen werden korrekt versendet
- RLS: Mandant A sieht nicht die Anomalien von Mandant B
- Holding-Admin sieht alle Anomalien

### 9.3 Testdaten-Setup
```sql
-- Setter mit ungewoehnlich niedrigen Anrufen
INSERT INTO kpi_snapshots (tenant_id, snapshot_type, entity_id, period_date, metrics)
VALUES (
  'tenant-a-id',
  'setter_daily',
  'setter-1-id',
  CURRENT_DATE,
  '{"calls": 5, "reach_rate": 0.15, "appointments": 0}'::jsonb
);

-- Baseline: 30 Anrufe/Tag
-- Erwartete Anomalie: setter_calls_drop (83% Abweichung, severity: critical)
```

---

*Letzte Aktualisierung: April 2026*

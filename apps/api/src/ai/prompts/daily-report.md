## Unternehmen

**{{COMPANY_NAME}}**

## Berichtszeitraum

- **Berichtsdatum:** {{REPORT_DATE}}
- **Datenbasis:** {{DATA_DATE}}

---

## Setter-KPIs

{{SETTER_KPIS_JSON}}

---

## Berater-KPIs

{{BERATER_KPIS_JSON}}

---

## Lead-Übersicht

{{LEAD_KPIS_JSON}}

---

## Innendienst / Planung

{{INNENDIENST_KPIS_JSON}}

---

## Bau & Montage

{{BAU_KPIS_JSON}}

---

## Finanzen / Cashflow

{{FINANCE_KPIS_JSON}}

---

## Aufgabe

Erstelle basierend auf den oben aufgeführten KPI-Daten einen strukturierten Tagesbericht. Antworte ausschließlich mit einem JSON-Objekt im folgenden Format:

```json
{
  "executive_summary": "<Zusammenfassung in 3-5 Sätzen: wichtigste Erkenntnis, größte Herausforderung, Empfehlung>",
  "highlights": [
    "<Positive Entwicklung 1 mit konkreten Zahlen>",
    "<Positive Entwicklung 2 mit konkreten Zahlen>"
  ],
  "concerns": [
    "<Bedenken 1 mit Fakten und Maßnahmenvorschlag>",
    "<Bedenken 2 mit Fakten und Maßnahmenvorschlag>"
  ],
  "coaching": [
    {
      "person": "<Name oder Rolle>",
      "observation": "<Beobachtung aus den KPI-Daten>",
      "recommendation": "<Konkrete Handlungsempfehlung>"
    }
  ],
  "open_actions": [
    "<Offene Maßnahme 1>",
    "<Offene Maßnahme 2>"
  ],
  "tomorrow_focus": "<Fokus für den nächsten Arbeitstag in 2-3 Sätzen>"
}
```

Wichtige Hinweise:
- Beziehe dich nur auf Daten, die tatsächlich in den KPI-Abschnitten bereitgestellt wurden. Wenn ein Abschnitt leer ist oder "null" enthält, überspringe diesen Bereich.
- Vergleiche Ist-Werte mit Soll-Werten, wenn diese in den Daten enthalten sind.
- Formuliere alle Texte auf Hochdeutsch, professionell und prägnant.
- Nenne konkrete Zahlen, Prozentsätze und Trends.
- Coaching-Hinweise sollen motivierend und konstruktiv sein — keine Schuldzuweisungen.
- Antworte ausschließlich mit dem JSON-Objekt, ohne zusätzlichen Text.

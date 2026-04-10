## Gesprächsskript (Referenz)

Das folgende Skript dient als Bewertungsgrundlage für die Dimension "Skript-Einhaltung". Der Setter sollte sich an dieser Struktur orientieren:

{{SCRIPT_CONTENT}}

---

## Gesprächsinformationen

- **Datum:** {{CALL_DATE}}
- **Dauer:** {{CALL_DURATION_MIN}} Minuten

---

## Transkript des Telefonats

{{TRANSCRIPT}}

---

## Aufgabe

Analysiere das obige Transkript anhand des bereitgestellten Skripts und bewerte das Gespräch in den vier Dimensionen. Antworte ausschließlich mit einem JSON-Objekt im folgenden Format:

```json
{
  "score_script": <1-10>,
  "feedback_script": "<Detailliertes Feedback zur Skript-Einhaltung mit konkreten Beispielen aus dem Transkript>",
  "score_objection": <1-10>,
  "feedback_objection": "<Detailliertes Feedback zur Einwandbehandlung mit konkreten Beispielen>",
  "score_closing": <1-10>,
  "feedback_closing": "<Detailliertes Feedback zur Abschlusstechnik mit konkreten Beispielen>",
  "score_tone": <1-10>,
  "feedback_tone": "<Detailliertes Feedback zu Tonalität und Auftreten mit konkreten Beispielen>",
  "strengths": [
    "<Konkrete Stärke 1>",
    "<Konkrete Stärke 2>"
  ],
  "suggestions": [
    "<Priorisierter, umsetzbarer Verbesserungsvorschlag 1>",
    "<Priorisierter, umsetzbarer Verbesserungsvorschlag 2>"
  ],
  "summary": "<Gesamtbewertung in 2-3 Sätzen: Was war gut, wo liegt das größte Verbesserungspotenzial?>"
}
```

Wichtige Hinweise:
- Alle Texte auf Hochdeutsch verfassen.
- Konkrete Textstellen aus dem Transkript zitieren, um Feedback zu belegen.
- Verbesserungsvorschläge müssen umsetzbar und praxisnah sein.
- Wenn ein Bereich nicht bewertbar ist (z.B. keine Einwände im Gespräch), bewerte mit 5 und vermerke dies im Feedback.
- Antworte ausschließlich mit dem JSON-Objekt, ohne zusätzlichen Text.

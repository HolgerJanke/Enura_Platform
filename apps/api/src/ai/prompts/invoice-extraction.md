Extract all data from the following invoice document and return a JSON object with this exact structure:

```json
{
  "recipient": {
    "name": "Company name of the invoice recipient",
    "address": "Full address",
    "registration_number": "Handelsregister / UID number if present"
  },
  "sender": {
    "name": "Company name of the invoice sender/supplier",
    "address": "Full address",
    "registration_number": "Handelsregister / UID number",
    "vat_number": "USt-IdNr / MWST-Nr / CHE number",
    "email": "Contact email if present",
    "contact_name": "Contact person name if present",
    "contact_phone": "Contact phone if present"
  },
  "header": {
    "invoice_number": "Exact invoice number as printed",
    "invoice_date": "YYYY-MM-DD",
    "project_reference": "Any project number, order number, or reference text",
    "customer_name": "End customer name if different from recipient",
    "customer_address": "End customer address if present"
  },
  "line_items": [
    {
      "position": 1,
      "article_number": "Article/SKU number or null",
      "description": "Item description",
      "quantity": 1.0,
      "unit": "Stk/h/m²/etc or null",
      "unit_price": 100.00,
      "line_total": 100.00,
      "vat_rate": 8.1
    }
  ],
  "totals": {
    "net_amount": 100.00,
    "vat_rate": 8.1,
    "vat_amount": 8.10,
    "gross_amount": 108.10,
    "currency": "CHF"
  },
  "payment": {
    "payment_terms_text": "Raw payment terms text from invoice",
    "payment_terms_days": 30,
    "due_date": "YYYY-MM-DD",
    "iban": "IBAN if present on invoice",
    "bic": "BIC/SWIFT if present",
    "bank_name": "Bank name if present",
    "reference": "Payment reference / QR reference if present"
  }
}
```

Return ONLY the JSON object, no additional text.

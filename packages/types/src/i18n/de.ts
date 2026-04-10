export const de: Record<string, string> = {
  // ---------------------------------------------------------------------------
  // Common actions
  // ---------------------------------------------------------------------------
  'action.save': 'Speichern',
  'action.cancel': 'Abbrechen',
  'action.edit': 'Bearbeiten',
  'action.delete': 'Löschen',
  'action.search': 'Suchen',
  'action.filter': 'Filtern',
  'action.export': 'Exportieren',
  'action.import': 'Importieren',
  'action.create': 'Erstellen',
  'action.add': 'Hinzufügen',
  'action.remove': 'Entfernen',
  'action.confirm': 'Bestätigen',
  'action.back': 'Zurück',
  'action.next': 'Weiter',
  'action.close': 'Schließen',
  'action.refresh': 'Aktualisieren',
  'action.upload': 'Hochladen',
  'action.download': 'Herunterladen',
  'action.copy': 'Kopieren',
  'action.reset': 'Zurücksetzen',
  'action.submit': 'Absenden',
  'action.select': 'Auswählen',
  'action.selectAll': 'Alle auswählen',
  'action.deselectAll': 'Alle abwählen',
  'action.showMore': 'Mehr anzeigen',
  'action.showLess': 'Weniger anzeigen',
  'action.retry': 'Erneut versuchen',
  'action.viewDetails': 'Details anzeigen',
  'action.assign': 'Zuweisen',
  'action.unassign': 'Zuweisung aufheben',

  // ---------------------------------------------------------------------------
  // Auth flow
  // ---------------------------------------------------------------------------
  'auth.login': 'Anmelden',
  'auth.logout': 'Abmelden',
  'auth.resetPassword': 'Passwort zurücksetzen',
  'auth.resetPasswordTitle': 'Passwort zurücksetzen',
  'auth.resetPasswordDescription': 'Bitte setzen Sie Ihr Passwort zurück, bevor Sie fortfahren.',
  'auth.newPassword': 'Neues Passwort',
  'auth.confirmPassword': 'Passwort bestätigen',
  'auth.currentPassword': 'Aktuelles Passwort',
  'auth.email': 'E-Mail-Adresse',
  'auth.password': 'Passwort',
  'auth.twoFactor': 'Zwei-Faktor-Authentifizierung',
  'auth.twoFactorTitle': 'Zwei-Faktor-Authentifizierung einrichten',
  'auth.twoFactorDescription': 'Scannen Sie den QR-Code mit Ihrer Authenticator-App und geben Sie den Code ein.',
  'auth.twoFactorCode': 'Authentifizierungscode',
  'auth.twoFactorEnrol': '2FA einrichten',
  'auth.twoFactorVerify': 'Code verifizieren',
  'auth.loginTitle': 'Willkommen zurück',
  'auth.loginDescription': 'Melden Sie sich mit Ihren Zugangsdaten an.',
  'auth.loginButton': 'Anmelden',
  'auth.sessionExpired': 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
  'auth.unauthorized': 'Sie haben keine Berechtigung für diese Aktion.',
  'auth.forbidden': 'Zugriff verweigert.',
  'auth.passwordChanged': 'Passwort erfolgreich geändert.',
  'auth.twoFactorEnabled': 'Zwei-Faktor-Authentifizierung erfolgreich aktiviert.',
  'auth.rememberMe': 'Angemeldet bleiben',

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  'nav.dashboard': 'Dashboard',
  'nav.setter': 'Setter',
  'nav.berater': 'Berater',
  'nav.leads': 'Leads',
  'nav.innendienst': 'Innendienst',
  'nav.projects': 'Projekte',
  'nav.finance': 'Finanzen',
  'nav.settings': 'Einstellungen',
  'nav.users': 'Benutzer',
  'nav.branding': 'Branding',
  'nav.connectors': 'Konnektoren',
  'nav.roles': 'Rollen',
  'nav.auditLog': 'Audit-Log',
  'nav.reports': 'Berichte',
  'nav.profile': 'Profil',
  'nav.help': 'Hilfe',

  // ---------------------------------------------------------------------------
  // Module titles and descriptions
  // ---------------------------------------------------------------------------
  'module.setter.title': 'Setter Performance',
  'module.setter.description': 'Anrufstatistiken, Erreichbarkeit und Terminquoten der Setter.',
  'module.berater.title': 'Berater Performance',
  'module.berater.description': 'Abschlussquoten, Offertvolumen und Umsatz der Berater.',
  'module.leads.title': 'Leadkontrolle',
  'module.leads.description': 'Lead-Eingang, Qualität und Bearbeitungsstatus.',
  'module.innendienst.title': 'Innendienst / Planung',
  'module.innendienst.description': 'Offene Planungsaufträge, IA-Status und blockierte Projekte.',
  'module.projects.title': 'Bau & Montage',
  'module.projects.description': '27-Phasen-Kanban für Projekte von Auftragseingang bis Abnahme.',
  'module.finance.title': 'Finanzen & Cashflow',
  'module.finance.description': 'Umsatz, offene Forderungen, Liquiditätsprognose und Cashflow.',
  'module.settings.title': 'Einstellungen',
  'module.settings.description': 'Benutzer, Rollen, Branding und Konnektoren verwalten.',
  'module.reports.title': 'Berichte',
  'module.reports.description': 'Tägliche KI-Berichte und individuelle Auswertungen.',
  'module.holding.title': 'Holding Dashboard',
  'module.holding.description': 'Überblick über alle Gesellschaften der Enura Group.',

  // ---------------------------------------------------------------------------
  // KPI labels — Setter
  // ---------------------------------------------------------------------------
  'kpi.setter.callsToday': 'Anrufe heute',
  'kpi.setter.callsThisWeek': 'Anrufe diese Woche',
  'kpi.setter.reachRate': 'Erreichbarkeitsrate',
  'kpi.setter.appointmentsBooked': 'Termine gebucht',
  'kpi.setter.appointmentRate': 'Terminquote',
  'kpi.setter.avgCallDuration': 'Durchschn. Anrufdauer',
  'kpi.setter.noShowRate': 'No-Show-Rate',
  'kpi.setter.callQualityScore': 'KI-Anrufqualität',
  'kpi.setter.greetingScore': 'Begrüßung',
  'kpi.setter.needsAnalysisScore': 'Bedarfsanalyse',
  'kpi.setter.presentationScore': 'Präsentation',
  'kpi.setter.closingScore': 'Abschluss',
  'kpi.setter.overallScore': 'Gesamtbewertung',
  'kpi.setter.scriptAdherence': 'Skript-Einhaltung',

  // ---------------------------------------------------------------------------
  // KPI labels — Berater
  // ---------------------------------------------------------------------------
  'kpi.berater.appointmentsWeek': 'Termine/Woche',
  'kpi.berater.closingRate': 'Abschlussquote',
  'kpi.berater.offerVolume': 'Offertvolumen (CHF)',
  'kpi.berater.dealDuration': 'Durchschn. Deal-Dauer',
  'kpi.berater.activitiesDay': 'Aktivitäten/Tag',
  'kpi.berater.revenueAdvisor': 'Umsatz/Berater',
  'kpi.berater.openOffers': 'Offene Offerten',
  'kpi.berater.wonOffers': 'Gewonnene Offerten',
  'kpi.berater.lostOffers': 'Verlorene Offerten',
  'kpi.berater.avgOfferValue': 'Durchschn. Offertwert',

  // ---------------------------------------------------------------------------
  // KPI labels — Leads
  // ---------------------------------------------------------------------------
  'kpi.leads.newToday': 'Neue Leads heute',
  'kpi.leads.newThisWeek': 'Neue Leads diese Woche',
  'kpi.leads.unworked': 'Unbearbeitete Leads',
  'kpi.leads.avgResponseTime': 'Durchschn. Reaktionszeit',
  'kpi.leads.qualityRate': 'Lead-Qualitätsrate',
  'kpi.leads.sourceBreakdown': 'Verteilung nach Quelle',
  'kpi.leads.totalActive': 'Aktive Leads gesamt',
  'kpi.leads.conversionRate': 'Konversionsrate',

  // ---------------------------------------------------------------------------
  // KPI labels — Innendienst
  // ---------------------------------------------------------------------------
  'kpi.innendienst.openOrders': 'Offene Planungsaufträge',
  'kpi.innendienst.blockedProjects': 'Blockierte Projekte',
  'kpi.innendienst.iaStatus': 'IA-Status',
  'kpi.innendienst.planningThroughput': 'Durchlaufzeit Planung',
  'kpi.innendienst.pendingApprovals': 'Ausstehende Genehmigungen',

  // ---------------------------------------------------------------------------
  // KPI labels — Bau & Montage
  // ---------------------------------------------------------------------------
  'kpi.projects.perPhase': 'Projekte pro Phase',
  'kpi.projects.avgThroughput': 'Durchschn. Durchlaufzeit',
  'kpi.projects.stalledProjects': 'Stehende Projekte',
  'kpi.projects.completedThisMonth': 'Abgeschlossen diesen Monat',
  'kpi.projects.upcomingInstallations': 'Anstehende Montagen',

  // ---------------------------------------------------------------------------
  // KPI labels — Finance
  // ---------------------------------------------------------------------------
  'kpi.finance.monthlyRevenue': 'Monatsumsatz',
  'kpi.finance.openReceivables': 'Offene Forderungen',
  'kpi.finance.overdueInvoices': 'Überfällige Rechnungen',
  'kpi.finance.weeklyPayments': 'Zahlungseingänge/Woche',
  'kpi.finance.liquidityForecast30': 'Liquidität 30 Tage',
  'kpi.finance.liquidityForecast60': 'Liquidität 60 Tage',
  'kpi.finance.liquidityForecast90': 'Liquidität 90 Tage',
  'kpi.finance.cashflowIn': 'Einnahmen',
  'kpi.finance.cashflowOut': 'Ausgaben',
  'kpi.finance.cashflowNet': 'Netto-Cashflow',

  // ---------------------------------------------------------------------------
  // Form labels
  // ---------------------------------------------------------------------------
  'form.firstName': 'Vorname',
  'form.lastName': 'Nachname',
  'form.displayName': 'Anzeigename',
  'form.email': 'E-Mail',
  'form.phone': 'Telefon',
  'form.street': 'Straße',
  'form.zip': 'PLZ',
  'form.city': 'Ort',
  'form.canton': 'Kanton',
  'form.notes': 'Notizen',
  'form.description': 'Beschreibung',
  'form.title': 'Titel',
  'form.amount': 'Betrag',
  'form.amountChf': 'Betrag (CHF)',
  'form.date': 'Datum',
  'form.startDate': 'Startdatum',
  'form.endDate': 'Enddatum',
  'form.dueDate': 'Fälligkeitsdatum',
  'form.status': 'Status',
  'form.source': 'Quelle',
  'form.team': 'Team',
  'form.role': 'Rolle',
  'form.setter': 'Setter',
  'form.berater': 'Berater',
  'form.customer': 'Kunde',
  'form.project': 'Projekt',
  'form.phase': 'Phase',
  'form.priority': 'Priorität',
  'form.category': 'Kategorie',
  'form.invoiceNumber': 'Rechnungsnummer',
  'form.taxAmount': 'Steuerbetrag',
  'form.totalAmount': 'Gesamtbetrag',
  'form.validUntil': 'Gültig bis',
  'form.installationDate': 'Montagedatum',
  'form.completionDate': 'Fertigstellungsdatum',
  'form.connectorName': 'Konnektorname',
  'form.connectorType': 'Konnektortyp',
  'form.syncInterval': 'Sync-Intervall (Minuten)',
  'form.apiKey': 'API-Schlüssel',
  'form.optional': '(optional)',
  'form.required': '(erforderlich)',

  // ---------------------------------------------------------------------------
  // Validation messages
  // ---------------------------------------------------------------------------
  'validation.required': 'Dieses Feld ist erforderlich.',
  'validation.email': 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  'validation.minLength': 'Mindestens {min} Zeichen erforderlich.',
  'validation.maxLength': 'Maximal {max} Zeichen erlaubt.',
  'validation.passwordMinLength': 'Das Passwort muss mindestens 12 Zeichen lang sein.',
  'validation.passwordMatch': 'Die Passwörter stimmen nicht überein.',
  'validation.passwordRequirements': 'Das Passwort muss Groß-/Kleinbuchstaben, Zahlen und Sonderzeichen enthalten.',
  'validation.invalidPhone': 'Bitte geben Sie eine gültige Telefonnummer ein.',
  'validation.invalidZip': 'Bitte geben Sie eine gültige Postleitzahl ein.',
  'validation.invalidAmount': 'Bitte geben Sie einen gültigen Betrag ein.',
  'validation.invalidDate': 'Bitte geben Sie ein gültiges Datum ein.',
  'validation.futureDate': 'Das Datum muss in der Zukunft liegen.',
  'validation.pastDate': 'Das Datum muss in der Vergangenheit liegen.',
  'validation.invalidUrl': 'Bitte geben Sie eine gültige URL ein.',
  'validation.invalidColor': 'Bitte geben Sie einen gültigen Hex-Farbwert ein.',
  'validation.fileTooBig': 'Die Datei ist zu groß. Maximal {max} MB erlaubt.',
  'validation.invalidFileType': 'Dieser Dateityp wird nicht unterstützt.',
  'validation.uniqueEmail': 'Diese E-Mail-Adresse wird bereits verwendet.',
  'validation.uniqueSlug': 'Dieser Slug wird bereits verwendet.',
  'validation.totpInvalid': 'Der eingegebene Code ist ungültig.',

  // ---------------------------------------------------------------------------
  // Lead status
  // ---------------------------------------------------------------------------
  'lead.status.new': 'Neu',
  'lead.status.contacted': 'Kontaktiert',
  'lead.status.qualified': 'Qualifiziert',
  'lead.status.appointment_set': 'Termin vereinbart',
  'lead.status.won': 'Gewonnen',
  'lead.status.lost': 'Verloren',
  'lead.status.invalid': 'Ungültig',

  // ---------------------------------------------------------------------------
  // Lead source
  // ---------------------------------------------------------------------------
  'lead.source.website': 'Webseite',
  'lead.source.referral': 'Empfehlung',
  'lead.source.partner': 'Partner',
  'lead.source.advertising': 'Werbung',
  'lead.source.cold_call': 'Kaltakquise',
  'lead.source.leadnotes': 'Leadnotes',
  'lead.source.other': 'Sonstiges',

  // ---------------------------------------------------------------------------
  // Offer status
  // ---------------------------------------------------------------------------
  'offer.status.draft': 'Entwurf',
  'offer.status.sent': 'Versendet',
  'offer.status.negotiating': 'In Verhandlung',
  'offer.status.won': 'Gewonnen',
  'offer.status.lost': 'Verloren',
  'offer.status.expired': 'Abgelaufen',

  // ---------------------------------------------------------------------------
  // Invoice status
  // ---------------------------------------------------------------------------
  'invoice.status.draft': 'Entwurf',
  'invoice.status.sent': 'Versendet',
  'invoice.status.paid': 'Bezahlt',
  'invoice.status.overdue': 'Überfällig',
  'invoice.status.cancelled': 'Storniert',
  'invoice.status.partially_paid': 'Teilweise bezahlt',

  // ---------------------------------------------------------------------------
  // Project status
  // ---------------------------------------------------------------------------
  'project.status.active': 'Aktiv',
  'project.status.on_hold': 'Pausiert',
  'project.status.completed': 'Abgeschlossen',
  'project.status.cancelled': 'Abgebrochen',

  // ---------------------------------------------------------------------------
  // Call status
  // ---------------------------------------------------------------------------
  'call.status.answered': 'Angenommen',
  'call.status.missed': 'Verpasst',
  'call.status.voicemail': 'Mailbox',
  'call.status.busy': 'Besetzt',
  'call.status.failed': 'Fehlgeschlagen',

  // ---------------------------------------------------------------------------
  // Call direction
  // ---------------------------------------------------------------------------
  'call.direction.inbound': 'Eingehend',
  'call.direction.outbound': 'Ausgehend',

  // ---------------------------------------------------------------------------
  // Connector status
  // ---------------------------------------------------------------------------
  'connector.status.active': 'Aktiv',
  'connector.status.paused': 'Pausiert',
  'connector.status.error': 'Fehler',
  'connector.status.disconnected': 'Getrennt',

  // ---------------------------------------------------------------------------
  // Connector types
  // ---------------------------------------------------------------------------
  'connector.type.reonic': 'Reonic CRM',
  'connector.type.3cx': '3CX Cloud',
  'connector.type.bexio': 'Bexio',
  'connector.type.google_calendar': 'Google Calendar',
  'connector.type.leadnotes': 'Leadnotes',
  'connector.type.whatsapp': 'WhatsApp Business',
  'connector.type.gmail': 'Gmail',

  // ---------------------------------------------------------------------------
  // Sync status
  // ---------------------------------------------------------------------------
  'sync.status.running': 'Läuft',
  'sync.status.success': 'Erfolgreich',
  'sync.status.error': 'Fehler',

  // ---------------------------------------------------------------------------
  // Cashflow type
  // ---------------------------------------------------------------------------
  'cashflow.type.income': 'Einnahme',
  'cashflow.type.expense': 'Ausgabe',

  // ---------------------------------------------------------------------------
  // Tenant status
  // ---------------------------------------------------------------------------
  'tenant.status.active': 'Aktiv',
  'tenant.status.suspended': 'Gesperrt',
  'tenant.status.archived': 'Archiviert',

  // ---------------------------------------------------------------------------
  // Error messages
  // ---------------------------------------------------------------------------
  'error.generic': 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
  'error.network': 'Netzwerkfehler. Bitte prüfen Sie Ihre Internetverbindung.',
  'error.notFound': 'Die angeforderte Ressource wurde nicht gefunden.',
  'error.tenantNotFound': 'Die angegebene Organisation wurde nicht gefunden.',
  'error.unauthorized': 'Sie sind nicht angemeldet. Bitte melden Sie sich an.',
  'error.forbidden': 'Sie haben keine Berechtigung für diese Aktion.',
  'error.serverError': 'Serverfehler. Bitte versuchen Sie es später erneut.',
  'error.validationFailed': 'Die eingegebenen Daten sind ungültig.',
  'error.saveError': 'Beim Speichern ist ein Fehler aufgetreten.',
  'error.deleteError': 'Beim Löschen ist ein Fehler aufgetreten.',
  'error.loadError': 'Beim Laden der Daten ist ein Fehler aufgetreten.',
  'error.uploadError': 'Beim Hochladen ist ein Fehler aufgetreten.',
  'error.syncError': 'Bei der Synchronisation ist ein Fehler aufgetreten.',
  'error.connectorError': 'Der Konnektor hat einen Fehler gemeldet.',
  'error.duplicateEntry': 'Ein Eintrag mit diesen Daten existiert bereits.',
  'error.rateLimited': 'Zu viele Anfragen. Bitte warten Sie einen Moment.',
  'error.fileTooLarge': 'Die Datei ist zu groß.',
  'error.invalidFileFormat': 'Ungültiges Dateiformat.',
  'error.brandingInvalid': 'Die Branding-Konfiguration ist ungültig. Bitte prüfen Sie die Eingaben.',
  'error.passwordResetRequired': 'Sie müssen Ihr Passwort zurücksetzen, bevor Sie fortfahren können.',
  'error.twoFactorRequired': 'Bitte richten Sie die Zwei-Faktor-Authentifizierung ein.',

  // ---------------------------------------------------------------------------
  // Empty states
  // ---------------------------------------------------------------------------
  'empty.leads': 'Keine Leads vorhanden.',
  'empty.leadsFiltered': 'Keine Leads für die aktuelle Filterauswahl.',
  'empty.offers': 'Keine Offerten vorhanden.',
  'empty.offersFiltered': 'Keine Offerten für die aktuelle Filterauswahl.',
  'empty.calls': 'Keine Anrufe vorhanden.',
  'empty.callsFiltered': 'Keine Anrufe für die aktuelle Filterauswahl.',
  'empty.invoices': 'Keine Rechnungen vorhanden.',
  'empty.invoicesFiltered': 'Keine Rechnungen für die aktuelle Filterauswahl.',
  'empty.projects': 'Keine Projekte vorhanden.',
  'empty.projectsFiltered': 'Keine Projekte für die aktuelle Filterauswahl.',
  'empty.users': 'Keine Benutzer vorhanden.',
  'empty.connectors': 'Keine Konnektoren konfiguriert.',
  'empty.syncLogs': 'Keine Sync-Protokolle vorhanden.',
  'empty.auditLog': 'Keine Audit-Einträge vorhanden.',
  'empty.teamMembers': 'Keine Teammitglieder vorhanden.',
  'empty.reports': 'Keine Berichte vorhanden.',
  'empty.cashflow': 'Keine Cashflow-Einträge vorhanden.',
  'empty.calendar': 'Keine Kalendereinträge vorhanden.',
  'empty.analysis': 'Keine Analyse vorhanden.',
  'empty.notifications': 'Keine Benachrichtigungen.',
  'empty.search': 'Keine Ergebnisse für Ihre Suche.',

  // ---------------------------------------------------------------------------
  // Table headers
  // ---------------------------------------------------------------------------
  'table.name': 'Name',
  'table.email': 'E-Mail',
  'table.phone': 'Telefon',
  'table.status': 'Status',
  'table.source': 'Quelle',
  'table.date': 'Datum',
  'table.createdAt': 'Erstellt am',
  'table.updatedAt': 'Aktualisiert am',
  'table.amount': 'Betrag',
  'table.total': 'Gesamt',
  'table.actions': 'Aktionen',
  'table.role': 'Rolle',
  'table.team': 'Team',
  'table.setter': 'Setter',
  'table.berater': 'Berater',
  'table.customer': 'Kunde',
  'table.project': 'Projekt',
  'table.phase': 'Phase',
  'table.duration': 'Dauer',
  'table.direction': 'Richtung',
  'table.score': 'Bewertung',
  'table.invoiceNumber': 'Rechnungsnr.',
  'table.dueDate': 'Fällig am',
  'table.paidAt': 'Bezahlt am',
  'table.lastSync': 'Letzte Synchronisation',
  'table.syncInterval': 'Sync-Intervall',
  'table.connector': 'Konnektor',
  'table.recordsSynced': 'Datensätze',
  'table.actor': 'Benutzer',
  'table.action': 'Aktion',
  'table.entity': 'Objekt',
  'table.details': 'Details',
  'table.noData': 'Keine Daten vorhanden',
  'table.loading': 'Daten werden geladen...',
  'table.rowsPerPage': 'Zeilen pro Seite',
  'table.of': 'von',
  'table.page': 'Seite',
  'table.showing': 'Zeige',
  'table.entries': 'Einträge',

  // ---------------------------------------------------------------------------
  // 27-Phase Kanban — Bau & Montage
  // ---------------------------------------------------------------------------
  'phase.1': 'Auftrag eingegangen',
  'phase.2': 'Auftragsbestätigung',
  'phase.3': 'Technische Abklärung',
  'phase.4': 'Planung erstellt',
  'phase.5': 'Bewilligungsgesuch',
  'phase.6': 'Bewilligung erhalten',
  'phase.7': 'Installationsanmeldung (IA)',
  'phase.8': 'IA genehmigt',
  'phase.9': 'Material bestellt',
  'phase.10': 'Material geliefert',
  'phase.11': 'Gerüst bestellt',
  'phase.12': 'Gerüst aufgestellt',
  'phase.13': 'DC-Montage geplant',
  'phase.14': 'DC-Montage abgeschlossen',
  'phase.15': 'AC-Montage geplant',
  'phase.16': 'AC-Montage abgeschlossen',
  'phase.17': 'Wärmepumpe geplant',
  'phase.18': 'Wärmepumpe installiert',
  'phase.19': 'Elektroinstallation',
  'phase.20': 'Inbetriebnahme geplant',
  'phase.21': 'Inbetriebnahme durchgeführt',
  'phase.22': 'Gerüst abgebaut',
  'phase.23': 'Abnahme geplant',
  'phase.24': 'Abnahme durchgeführt',
  'phase.25': 'Dokumentation erstellt',
  'phase.26': 'Schlussrechnung gestellt',
  'phase.27': 'Projekt abgeschlossen',

  // ---------------------------------------------------------------------------
  // Time and date labels
  // ---------------------------------------------------------------------------
  'time.today': 'Heute',
  'time.yesterday': 'Gestern',
  'time.thisWeek': 'Diese Woche',
  'time.lastWeek': 'Letzte Woche',
  'time.thisMonth': 'Dieser Monat',
  'time.lastMonth': 'Letzter Monat',
  'time.thisYear': 'Dieses Jahr',
  'time.last30Days': 'Letzte 30 Tage',
  'time.last90Days': 'Letzte 90 Tage',
  'time.custom': 'Benutzerdefiniert',
  'time.minutes': 'Minuten',
  'time.hours': 'Stunden',
  'time.days': 'Tage',
  'time.weeks': 'Wochen',
  'time.months': 'Monate',
  'time.seconds': 'Sekunden',
  'time.ago': 'vor',
  'time.in': 'in',

  // ---------------------------------------------------------------------------
  // Misc / UI
  // ---------------------------------------------------------------------------
  'ui.loading': 'Laden...',
  'ui.saving': 'Speichern...',
  'ui.deleting': 'Löschen...',
  'ui.processing': 'Verarbeitung...',
  'ui.syncing': 'Synchronisiere...',
  'ui.uploading': 'Hochladen...',
  'ui.searchPlaceholder': 'Suchen...',
  'ui.noResults': 'Keine Ergebnisse',
  'ui.yes': 'Ja',
  'ui.no': 'Nein',
  'ui.or': 'oder',
  'ui.and': 'und',
  'ui.all': 'Alle',
  'ui.none': 'Keine',
  'ui.total': 'Gesamt',
  'ui.average': 'Durchschnitt',
  'ui.minimum': 'Minimum',
  'ui.maximum': 'Maximum',
  'ui.currency': 'CHF',
  'ui.percent': '%',
  'ui.version': 'Version',
  'ui.lastUpdated': 'Zuletzt aktualisiert',
  'ui.createdBy': 'Erstellt von',
  'ui.modifiedBy': 'Geändert von',

  // ---------------------------------------------------------------------------
  // Confirm dialogs
  // ---------------------------------------------------------------------------
  'confirm.delete': 'Sind Sie sicher, dass Sie diesen Eintrag löschen möchten?',
  'confirm.deleteTitle': 'Eintrag löschen',
  'confirm.deleteDescription': 'Diese Aktion kann nicht rückgängig gemacht werden.',
  'confirm.deactivate': 'Sind Sie sicher, dass Sie diesen Benutzer deaktivieren möchten?',
  'confirm.deactivateTitle': 'Benutzer deaktivieren',
  'confirm.resetPassword': 'Soll das Passwort für diesen Benutzer zurückgesetzt werden?',
  'confirm.resetPasswordTitle': 'Passwort zurücksetzen',
  'confirm.disconnect': 'Soll die Verbindung zu diesem Konnektor getrennt werden?',
  'confirm.disconnectTitle': 'Konnektor trennen',
  'confirm.unsavedChanges': 'Sie haben ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen?',
  'confirm.unsavedChangesTitle': 'Ungespeicherte Änderungen',

  // ---------------------------------------------------------------------------
  // Success messages
  // ---------------------------------------------------------------------------
  'success.saved': 'Erfolgreich gespeichert.',
  'success.deleted': 'Erfolgreich gelöscht.',
  'success.created': 'Erfolgreich erstellt.',
  'success.updated': 'Erfolgreich aktualisiert.',
  'success.uploaded': 'Erfolgreich hochgeladen.',
  'success.exported': 'Export erfolgreich.',
  'success.imported': 'Import erfolgreich.',
  'success.synced': 'Synchronisation erfolgreich.',
  'success.connectorConnected': 'Konnektor erfolgreich verbunden.',
  'success.connectorDisconnected': 'Konnektor erfolgreich getrennt.',
  'success.userCreated': 'Benutzer erfolgreich erstellt.',
  'success.userDeactivated': 'Benutzer erfolgreich deaktiviert.',
  'success.passwordReset': 'Passwort wurde zurückgesetzt.',
  'success.brandingUpdated': 'Branding erfolgreich aktualisiert.',
  'success.roleAssigned': 'Rolle erfolgreich zugewiesen.',

  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------
  'role.super_user': 'Super User',
  'role.geschaeftsfuehrung': 'Geschäftsführung',
  'role.teamleiter': 'Teamleiter',
  'role.setter': 'Setter',
  'role.berater': 'Berater',
  'role.innendienst': 'Innendienst',
  'role.bau': 'Bau / Montage',
  'role.buchhaltung': 'Buchhaltung',
  'role.leadkontrolle': 'Leadkontrolle',
  'role.holding_admin': 'Holding Admin',

  // ---------------------------------------------------------------------------
  // Daily report
  // ---------------------------------------------------------------------------
  'report.dailyTitle': 'Tagesbericht',
  'report.dailyDescription': 'KI-generierter Tagesbericht mit KPI-Zusammenfassung und Coaching-Hinweisen.',
  'report.generatedAt': 'Erstellt am',
  'report.highlights': 'Highlights',
  'report.warnings': 'Warnungen',
  'report.coachingSuggestions': 'Coaching-Hinweise',
  'report.kpiSummary': 'KPI-Zusammenfassung',
  'report.perStaff': 'Pro Mitarbeiter',
  'report.sendTime': 'Versandzeit',
  'report.recipients': 'Empfänger',

  // ---------------------------------------------------------------------------
  // Branding settings
  // ---------------------------------------------------------------------------
  'branding.primaryColor': 'Primärfarbe',
  'branding.secondaryColor': 'Sekundärfarbe',
  'branding.accentColor': 'Akzentfarbe',
  'branding.backgroundColor': 'Hintergrundfarbe',
  'branding.surfaceColor': 'Oberflächenfarbe',
  'branding.textPrimary': 'Primäre Textfarbe',
  'branding.textSecondary': 'Sekundäre Textfarbe',
  'branding.font': 'Schriftart',
  'branding.fontUrl': 'Schriftart-URL',
  'branding.borderRadius': 'Eckenradius',
  'branding.logo': 'Logo',
  'branding.darkMode': 'Dunkelmodus',
  'branding.preview': 'Vorschau',
  'branding.uploadLogo': 'Logo hochladen',
  'branding.resetDefaults': 'Standardwerte wiederherstellen',

  // ---------------------------------------------------------------------------
  // User management
  // ---------------------------------------------------------------------------
  'users.title': 'Benutzerverwaltung',
  'users.createUser': 'Benutzer erstellen',
  'users.editUser': 'Benutzer bearbeiten',
  'users.deactivateUser': 'Benutzer deaktivieren',
  'users.activateUser': 'Benutzer aktivieren',
  'users.assignRole': 'Rolle zuweisen',
  'users.removeRole': 'Rolle entfernen',
  'users.resetPassword': 'Passwort zurücksetzen',
  'users.temporaryPassword': 'Temporäres Passwort',
  'users.active': 'Aktiv',
  'users.inactive': 'Inaktiv',
  'users.lastLogin': 'Letzter Login',
  'users.twoFactorStatus': '2FA-Status',
  'users.passwordStatus': 'Passwort-Status',
  'users.mustResetPassword': 'Muss Passwort ändern',
  'users.passwordOk': 'Passwort gesetzt',

  // ---------------------------------------------------------------------------
  // Connector management
  // ---------------------------------------------------------------------------
  'connectors.title': 'Konnektoren',
  'connectors.addConnector': 'Konnektor hinzufügen',
  'connectors.editConnector': 'Konnektor bearbeiten',
  'connectors.syncNow': 'Jetzt synchronisieren',
  'connectors.viewLogs': 'Sync-Protokolle anzeigen',
  'connectors.lastSynced': 'Letzte Synchronisation',
  'connectors.nextSync': 'Nächste Synchronisation',
  'connectors.recordsSynced': 'Synchronisierte Datensätze',
  'connectors.health': 'Konnektor-Status',
  'connectors.allHealthy': 'Alle Konnektoren aktiv',
  'connectors.hasErrors': 'Konnektoren mit Fehlern',
  'connectors.noneConfigured': 'Keine Konnektoren konfiguriert',

  // ---------------------------------------------------------------------------
  // Holding dashboard
  // ---------------------------------------------------------------------------
  'holding.tenants': 'Gesellschaften',
  'holding.createTenant': 'Gesellschaft erstellen',
  'holding.editTenant': 'Gesellschaft bearbeiten',
  'holding.companySlug': 'Subdomain',
  'holding.companyName': 'Firmenname',
  'holding.tenantStatus': 'Status',
  'holding.impersonate': 'Als Super User einloggen',
  'holding.impersonateWarning': 'Sie betreten das Tenant-Dashboard als Super User. Alle Aktionen werden protokolliert.',
  'holding.crossCompanyAnalytics': 'Unternehmensübergreifende Analysen',
  'holding.totalRevenue': 'Gesamtumsatz',
  'holding.totalProjects': 'Projekte gesamt',
  'holding.totalLeads': 'Leads gesamt',
  'holding.totalStaff': 'Mitarbeiter gesamt',
}

export function t(key: string): string {
  return de[key] ?? key
}

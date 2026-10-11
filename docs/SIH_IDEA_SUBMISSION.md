# SIH idea submission: copy-paste content (no PPT content)

Form limits: Title 100 chars · Description 50,000 · Abstract 10,000 · Template PDF ≤ 10 MB.
Everything below is checked against what the build actually does today. Sections marked
"Not yet built" are stated as roadmap, not as delivered.

## Idea Title (max 100 characters; this one is 93)

SchemeMitra — speak in your language, get the right scheme, lender and a bank-ready loan file

Shorter alternative (87): SchemeMitra: voice-first, offline-capable scheme matchmaking with bank-ready loan files

## Technology Bucket

Pick **Artificial Intelligence** if offered. If the list only has broader buckets, pick the one for
Software / Smart Automation. The AI parts are voice recognition, language understanding and the
ranking model. The rest is ordinary software.

## YouTube Link (optional)

Leave blank until a screen recording of the demo exists. A 2 to 3 minute recording of the
Gujarati voice flow followed by the lender's decision is the strongest thing to link.

## Abstract / Summary (max 10,000 characters)

Marginalized entrepreneurs (SC, ST, OBC, Safai Karamchari, minority and Divyang households) often
qualify for concessional loans from the National Finance Development Corporations, but most never
reach them. The schemes are scattered across corporations and state channelising agencies. The
rules are written in dense English. Applicants do not know which scheme fits, which lender is
active nearby, or which papers a lender will actually accept. Files are rejected for avoidable
reasons such as a faded certificate or a name spelled two ways, and the applicant hears nothing
back.

SchemeMitra is a free, open system that closes this gap end to end:

1. **Speak or type in your own language.** A guided voice conversation in 13 languages (English,
   Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Urdu, Kannada, Odia, Malayalam, Punjabi,
   Assamese) fills the whole form. In a full Gujarati run, six spoken answers fill 13 fields.
   Amounts spoken the Indian way ("dedh lakh", "साढ़े चार लाख", "સાઠ હજાર") are understood.
2. **Rules decide eligibility. AI never does.** Each scheme's published conditions are encoded as
   auditable rules with a source link. The applicant sees, line by line, why they qualify or what
   single change would qualify them. A machine-learning ranker only orders schemes that are
   already eligible and explains its choice in plain language. It cannot add or remove a scheme.
3. **Exact money maths.** Instalments, payment holidays and the apex/lender/beneficiary funding
   split are computed with exact integer arithmetic in paise, and match on the phone and on the
   server.
4. **The right lender, not just the nearest.** Lenders are ranked by distance and by recent
   repayment record and remaining capacity. A weak-recovery lender is skipped and the reason is
   shown.
5. **A file the lender will accept.** Photos are checked for blur and glare. DigiLocker can replace
   a faded paper certificate with the issuer's own copy, with the citizen's consent. Name
   variations ("Shri Ramesh S/O Late Kanaram" against "RAMESH KANARAM MEGHWAL") are reconciled
   with the reason shown. A readiness score tells the applicant what to fix before sending.
6. **One signed QR, one bilingual PDF.** The application goes to the lender as a bilingual loan
   file with a signed QR that carries no personal data.
7. **Track it by SMS.** Every step (received, papers requested, sanctioned, rejected) reaches the
   applicant in their language. The lender decides, and the platform never sanctions a loan.

**Built for the last mile.** The app is an installable PWA. It works offline, saves progress on the
phone and syncs later. With no data at all, a whole application fits in one 160-character SMS.
Status can be checked by texting a tracking ID. A CSC operator can apply on behalf of someone
without a smartphone, and prints them a slip.

**Trust and privacy by design.** Aadhaar is stored as last four digits plus a keyed hash, and
never as the full number. Personal fields are encrypted at rest. No personal data goes into QR
codes, analytics or logs. Audit logs are hash-chained and tamper-evident. Consent is recorded
(OTP, thumb impression at a counter, or spoken), and applicants can erase their data.

**Resilience.** Every external service (speech, translation, OCR, SMS, the ranking model) has a
timeout, retry and circuit breaker with a working fallback, so the citizen journey continues if a
provider is down.

**Who benefits.** Applicants get a shorter, clearer path. Lenders get complete, consistent files
and fewer rejections. The ministry gets anonymised, aggregate insight into where demand is unmet
and why files are rejected.

## Idea Description (max 50,000 characters)

### 1. Problem

Concessional credit exists for marginalized entrepreneurs through the apex finance corporations
and their state channelising agencies. Uptake is low for reasons that are not about eligibility:

- **Discovery.** Schemes, limits, rates and moratoriums differ by corporation and change.
  Applicants and even field staff cannot easily tell which scheme fits.
- **Language.** Guidance and forms are mostly English, and voice or low-literacy access is rare.
- **Paperwork.** Rejections are frequently caused by faded certificates, mismatched names and
  missing papers, all avoidable if caught before submission.
- **Routing.** Lenders differ sharply in responsiveness and repayment record. Applicants pick by
  proximity and hope.
- **Connectivity.** Many applicants have patchy data, no smartphone, or rely on a CSC.
- **Opacity.** After applying, the applicant hears nothing and cannot tell whether to wait or act.

### 2. Solution overview

SchemeMitra is one system with several front doors and a shared back end.

**Citizen web app (PWA).** A five-step guided path: Speak & Scan, Rule Check, Money Maths, Partner
Pick, Send & Track. Every screen shows a "what happens next" card. Voice or typed input in 13
languages, with listen buttons and large-text, high-contrast and dark modes.

**CSC operator mode.** A counter workflow: a checklist before starting (applicant present,
consent explained, applicant's own phone number), assisted consent recorded against the operator,
a day view of applicants, and printable slips.

**Lender (partner) portal.** A queue with live updates, QR scan (camera or paste) that verifies the
signature, a split-view review (papers beside the extracted fields, name-match score, rule trace,
money plan, consent evidence, audit trail, integrity check), and decisions: receive, request
papers, approve with a generated bilingual sanction letter, reject with a coded reason, mark
disbursed.

**SMS channel.** A compact codec lets a full application travel as one or a few SMS. Inbound
webhook reassembly, CRC validation, STATUS lookup, HELP, and an IVR prompt stub.

### 3. How it works (the pipeline)

1. **Language layer.** Speech recognition (Bhashini when keys are configured, faster-whisper as a
   local fallback, typed input as the last resort) turns speech into text. Rule-based extraction
   over 13-language lexicons pulls out name, age, district, category, income, project cost and
   more, using a dedicated Indian number-word parser. An optional LLM fills only gaps, its values
   are always read back to the applicant for confirmation, and personal data is redacted from
   any prompt. A conversation state machine (intake, clarify, confirm, done) caps the dialogue and
   hands leftovers to the form.
2. **Eligibility engine.** A JSON-Logic evaluator implemented twice (Python on the server,
   TypeScript on the phone) and tested against one shared fixture. Conditions compile to
   localizable sentences ("Your family income ₹1,80,000 is within the ₹5,00,000 limit"). Results are
   eligible, ineligible or needs-info, with the nearest miss and the next best option.
3. **Ranking.** XGBoost LambdaMART over eight fit features (loan fit, instalment burden, interest
   advantage, paper readiness, lenders within 25 km, lender health, historical sanction rate,
   processing time). TreeSHAP contributions become plain-language reasons, and a reason is shown
   only if it is literally true for that scheme. Monotone constraints stop, for example, a heavier
   instalment from ever raising a score. If the model is unavailable, a transparent weighted
   scorer serves the same list.
4. **Finance.** Exact rational arithmetic with round-half-even, monthly and quarterly frequencies,
   three payment-holiday treatments, affordability checks with suggestions, and a funding split
   (for example 90:5:5). A 1,000-case golden test confirms the Python and TypeScript
   implementations agree to the paisa.
5. **Routing.** PostGIS nearest-neighbour search (or a haversine fallback in the lightweight
   profile). A health score combines recovery rate, non-performing-asset ratio, remaining
   capacity, sanction speed and backlog. Hard exclusions apply for weak recovery or exhausted
   capacity, and each skip shows a reason.
6. **Documents.** Blur, glare and darkness checks. EXIF metadata is removed on re-encode. Aadhaar
   is validated with the Verhoeff checksum, masked, and stored as last four digits plus a hash.
   OCR (RapidOCR, or a clearly labelled sandbox reader for demos). DigiLocker pull via OAuth2 with
   consent. Name matching with honorific and relation-word stripping, transliteration, fuzzy and
   phonetic matching, and hard anchors (date of birth, Aadhaar last four, father's name).
7. **Application lifecycle.** A status machine in which only the lender's officer can sanction,
   reject or disburse (not even a platform admin). An Ed25519-signed QR, a bilingual PDF loan file
   with embedded Noto fonts, and a hash-chained audit trail.
8. **Notifications.** SMS in the applicant's language (Console, MSG91 or Twilio adapters), with
   correct GSM-7 versus UCS-2 segment counting. WebSocket push to the tracking page and the
   lender's queue.

### 4. What makes it different

- Eligibility is deterministic and explainable. AI only ranks and never decides.
- Works in 13 languages by voice, on a slow or absent connection, and via SMS.
- Routes to lenders by real performance, and explains every skip.
- Prepares a file the lender will accept (readiness score, DigiLocker fallback, name
  reconciliation) instead of only listing schemes.
- The lender stays the decision-maker: the platform prepares and routes but never sanctions.
- Privacy is structural: minimal data, encryption, hash-chained audit, erasure, no personal data
  in QR, analytics or logs.
- Free and open, built on an open-source stack, with adapters instead of vendor lock-in.

### 5. Architecture

- **Clients:** Next.js 15 PWA (installable, offline via service worker, IndexedDB drafts and a
  retry queue), partner portal, CSC mode. Planned: Expo mobile app.
- **API gateway:** Fastify. Authentication, rate limiting, WebSocket hub, SMS webhook
  normalization.
- **Core service:** FastAPI with modules for voice, documents, eligibility, ranking, finance,
  routing, applications, notify and analytics.
- **Data:** PostgreSQL with PostGIS (row-level security, append-only audit trigger). A SQLite
  profile runs the same code for a zero-dependency demo. Redis for cache and queues. S3-compatible
  encrypted object storage.
- **Contracts:** OpenAPI specification, with generated TypeScript types for the clients.
- **Adapters with labelled sandboxes:** Bhashini, DigiLocker, SMS, OCR and LLM each have a real
  implementation behind an environment flag and a visibly labelled SANDBOX mock.

### 6. Impact and measures

Planned pilot measures (targets to be validated in the pilot, not claims of results today):
time-to-apply, file readiness score at submission, rejection rate for avoidable reasons,
sanction turnaround time, and drop-off between steps. The policy view will show uptake by
district, funnel, rejection reasons, language mix and unmet demand, using anonymised aggregates
with small-count suppression and noise.

### 7. Feasibility and status

Working today (built and tested): rules engine, money maths, lender routing, documents and
DigiLocker adapter, name matching, readiness, signed QR, bilingual PDF, tracking, voice intake in
13 languages, spoken read-back with consent evidence, ML ranking with a model card and fairness
check, lender portal with decisions and sanction letter, SMS application and status, CSC mode,
offline PWA. Automated tests cover the backend, the shared TypeScript logic and end-to-end
journeys for the demo personas.

Not yet built: the Expo mobile app, the policy dashboard and admin console, load and
performance reports, and final hardening and documentation. Real Bhashini, DigiLocker and SMS
credentials require approvals that a pilot would obtain. Until then those integrations run in
labelled sandbox mode.

### 8. Honest limitations

- The ranking model is trained on synthetic data. It must be retrained and re-audited on pilot
  outcomes before real use. The model card says so.
- Scheme parameters other than NBCFDC's carry a "needs verification" flag until confirmed with
  each apex corporation.
- Demo lenders, applicants and documents are fictional and are labelled as such.
- Speech recognition in demo mode returns a scripted line and is labelled SANDBOX. Real
  recognition needs Bhashini keys or a local speech model.

### 9. Scalability and sustainability

Stateless services behind a gateway scale horizontally. The heavy work (OCR, PDF, speech
fallback) runs on worker queues. Rule sets are versioned data, so a scheme change is a publish and
not a code release. It is open-source and free for citizens. Sustaining it is a government-funded
platform with partner-integration support.

### 10. Pilot approach

An 8-week district pilot: onboard lenders and CSC operators, verify each scheme's parameters with
its apex corporation, obtain Bhashini, DigiLocker and SMS-DLT access, run a field test, and review
the measures above before scaling.

## Idea Template (PDF)

Download the official template from the "Download Template" link on the form and fill it from the
Abstract and Description above. Keep it under 10 MB.

# SchemeMitra

A voice-first app that helps first-time entrepreneurs from marginalised communities find the
government loan schemes they actually qualify for, see what the loan will cost to the paisa, apply to
a lender near them, and track the decision. It works in 13 Indian languages, on a slow phone, offline,
and over plain SMS.

Built for the Seva First Innovation Challenge 2026, regional open track REG-007 (Employment &
Livelihood), with a Gujarat focus.

**Ground rules the code enforces:** eligibility is decided only by published rules (the same rule
files run on the server and offline on the phone), so no model ever decides who qualifies. The ranking
model only re-orders schemes you already qualify for. Loan maths is exact integer arithmetic,
cross-checked against 1,000 golden cases. Every stand-in for a real government service is labelled
**Sandbox** (or **DEMO** for scripted voice) on screen and in the API.

## Quick start

Needs Node 22+, pnpm, Python 3.12 with [uv](https://docs.astral.sh/uv/), and Chrome or Edge.

```bash
pnpm start
```

That one command installs dependencies if they're missing, creates `.env` from `.env.example` (dev
placeholders only), runs migrations, loads the demo data, builds the web app if its source changed, and
starts everything:

| | |
|---|---|
| App | http://localhost:3000 |
| API docs | http://localhost:8000/docs |
| Sign in | http://localhost:3000/login. The one-time code is shown on screen (`DEV_HELPERS`, never in prod) |

Other commands: `pnpm dev` (hot reload, no service worker), `pnpm seed` (re-load demo data, safe to
repeat), `pnpm reset` (wipe the local database and re-seed), `pnpm test` (backend + i18n + unit tests),
`pnpm e2e` (browser tests, with `pnpm start` running in another terminal). For the production-shaped stack
(Postgres + PostGIS, Redis, MinIO) run `docker compose -f infra/docker-compose.yml up --build`.

### Demo logins (all fictional)

| Phone | Who |
|---|---|
| 9000000006 | Jyoti Vaghela, Gandhinagar (the demo script below) |
| 9000000001 | Savitaben Rathwa, Dahod (Gujarati voice persona) |
| 9000000024 | Lender officer, Janseva National Bank, Gandhinagar |
| 9000000020 | Lender officer, Dahod District SCA |
| 9000000011 | CSC operator, Dahod |
| 9000000040 | Policy desk (dashboard) |
| 9000000030 | Platform admin |

## Demo script (5 minutes)

**Jyoti Vaghela**, 29, Gandhinagar district. She has never taken a loan, studied up to class 10, and
wants ₹80,000 to start a tailoring unit (total cost ₹90,000). She speaks Gujarati. Everything below is
also run automatically by `apps/e2e/tests/persona5-jyoti-demo-script.spec.ts`.

Use Chrome or Edge with a microphone and internet: that's where the browser's speech recognition
lives. If either is missing, the app says so in Gujarati and you type the same lines into the box
under the mic. Nothing gets guessed.

**0:00 Open in Gujarati.** Open http://localhost:3000, pick **ગુજરાતી**, tap **બોલીને શરૂ કરો**
(start by speaking). Point out that there's no DEMO banner: what you say is what gets transcribed.

**0:30 Voice form.** Tap the mic and say each line, one tap per line:

1. મારું નામ જ્યોતિ વાઘેલા છે, મારી ઉંમર ઓગણત્રીસ વર્ષ છે, હું ગાંધીનગર જિલ્લામાં રહું છું.
2. હું સ્ત્રી છું, અન્ય પછાત વર્ગમાંથી છું, કોઈ વિકલાંગતા નથી.
3. મારે સિલાઈનું કામ શરૂ કરવું છે, કુલ ખર્ચ નેવું હજાર રૂપિયા, અને લોન એંસી હજાર જોઈએ.
4. ઘરની વર્ષની આવક દોઢ લાખ છે, હું દસ ધોરણ સુધી ભણી છું.
5. હું સખી મંડળની સભ્ય નથી, અને મારી પાસે બીજી કોઈ લોન નથી.
6. હા, બરાબર છે.

Watch the form on the right fill in as she talks: "નેવું હજાર" becomes ₹90,000, "દોઢ લાખ" ₹1,50,000.
Anything uncertain gets a yes/no question instead of a guess.

**1:30 Eligible schemes, with reasons.** Tap **મારી યોજનાઓ જુઓ**. Mukhyamantri Mahila Utkarsh Yojana
(Gujarat's interest-free loan for women) and PM Vishwakarma come up, each with a ✓ line per rule
("woman entrepreneur", "Gujarat resident", "₹80,000 within the ₹1 lakh limit"). Further down, schemes she
*doesn't* get are listed with the plain reason, for example Stand-Up India, which starts at ₹10 lakh. The source page
and the date it was checked are on every scheme (see `docs/SCHEME_SOURCES.md`).

**2:15 Money.** Choose Mahila Utkarsh. At 0% interest the EMI is simply ₹80,000 over 60 months, worked
out on the phone and exact to the paisa.

**2:40 Lender.** The nearest banks offering this scheme are listed with distance and how they're
doing. Pick **Janseva National Bank — Gandhinagar**.

**3:00 Documents and readiness.** Sign in as **9000000006**. Use the demo papers (Aadhaar, class 10
marksheet, bank passbook). Each one is read and checked, and each shows a **Sandbox** label, because OCR
and DigiLocker run on stand-ins here. The readiness score climbs to "ready to send".

**3:40 Read-back and submit.** The app reads the application back in Gujarati. Tap the mic and say
**"હા, બરાબર છે"**; that spoken yes is kept as consent evidence. Tick consent, submit, and note the
tracking ID (SM-GJ-…).

**4:10 Lender sanctions.** In a second browser window, sign in as **9000000024** (the Gandhinagar bank
officer). Open her file from the queue: papers, rule trace and an "unchanged since submission"
integrity check, side by side. Mark it received, start review, approve ₹80,000. A bilingual sanction
letter PDF is generated. SchemeMitra itself can never sanction; only the lender can.

**4:35 She tracks it.** Back in Jyoti's window, open the tracking page. The status changed to
sanctioned within about two seconds, in Gujarati, without a reload. She also gets an SMS.

**4:50 Policy dashboard.** Sign in as **9000000040** and open **Policy insights**, filter Gujarat:
applications by district, scheme and status, approval rate and typical days to sanction. The yellow
banner says how many records are synthetic, and any number built from fewer than 10 applications is
hidden.

## What's real and what's a stand-in

| Piece | Status |
|---|---|
| Eligibility rules, loan maths, ranking, read-back, lender workflow, SMS codec, offline mode | Real code, tested |
| Speech recognition | Real: the browser's recogniser (Chrome/Edge, 10 languages). Bhashini takes over when `BHASHINI_*` keys are set. `DEMO_MODE=true` switches to scripted lines with a DEMO banner |
| DigiLocker | Sandbox by default. The real OAuth round trip is wired (`DIGILOCKER_MODE=real` plus partner credentials) |
| OCR and name matching | Sandbox OCR reads the demo papers. The matcher is real, but its input is labelled Sandbox |
| SMS sending | Console in dev; MSG91 or Twilio with keys |
| Dashboard data | 2,000 synthetic applications (own table, labelled) plus any live ones |
| Scheme data | 18 schemes with source URL and check date. 10 still carry `needs_verification`; see `docs/SCHEME_SOURCES.md` |

## Tests

```bash
pnpm test
```

That runs about 186 backend tests (rules, exact finance, voice parsing, offline sync, SMS, documents,
dashboard privacy), the 13-language string check, a contrast check and the TypeScript unit tests. With
the stack running (`pnpm start`), `pnpm e2e` runs 11 browser tests: five personas (voice in Gujarati, the full PWA
journey, offline + SMS, a CSC operator in Urdu, and this demo script), plus the lender decision, the
no-recogniser typing fallback, the DigiLocker callback check, the dashboard and PWA installability.

## Docs

- `docs/DECISIONS.md`: architecture decisions (ADR-001 onwards)
- `docs/SCHEME_SOURCES.md`: where every scheme rule comes from, and what's still unverified
- `docs/PROGRESS.md`: build checklist

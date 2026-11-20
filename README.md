# صقر | Saqr

> **عين الصقر على الاحتيال** — *Eyes sharp on fraud.*

Saqr is a privacy-first community platform that protects people in the UAE from phone, SMS, WhatsApp and online fraud, and from online extortion. Anyone can **scan** a suspicious message, link or phone number and get an explainable verdict in under a second. They can **report** scams anonymously, and the reports build a **community registry** of verified fraud indicators. The relevant authorities get a **live dashboard** to review reports, verify indicators, spot trends and export block lists. Every decision they make also **retrains the detection model**.

The interface is Arabic-first (RTL) with an English toggle, and everything runs locally. No external AI service is used, and Saqr never opens a link a user submits.

---

## 1. The problem

Fraud in the UAE mostly arrives as a short message or a call that impersonates someone people trust: the police ("you have an unpaid fine"), a bank ("send us the code to reactivate your card"), a courier ("pay AED 12 to release your parcel"), or a relative ("this is my new number, send money now").

- People have **no quick, trustworthy way to check** a message before they act on it. Searching online is slow, and asking friends is unreliable.
- When someone does spot a scam, **that knowledge stays with them**. The next person gets the same message from the same number.
- Authorities receive reports late, scattered across channels, and in formats that are hard to aggregate. They **can't easily see a campaign forming** or hand a clean block list to telecom operators and banks.
- Many people hesitate to report because they **don't want to hand over personal data**.

## 2. The solution

| Feature | What it does |
|---|---|
| **Scan** | Paste anything: a whole message, a link, or a number. Saqr detects the input type, scores it from 0 to 100, labels it *safe*, *suspicious* or *dangerous*, and explains each reason in plain Arabic or English. It also suggests next steps. Links and numbers inside a message are analysed individually as well. |
| **Report** | Anonymous, with no account. Victim PII (cards, Emirates ID, IBAN, emails, OTP codes, passport numbers) is removed automatically before anything is stored. One report about a message also registers the links and numbers inside it. |
| **Community registry** | Public, searchable list of indicators. Verified ones appear in full. Unverified ones appear only after several independent reports, and then masked, so the registry can't be abused to defame a number or domain. |
| **Authority dashboard** | KPIs, a 30-day trend, and breakdowns by fraud type, emirate and channel. A review queue lets authorities verify, reject or reset indicators. It also includes a CSV export of verified indicators (for telecoms and banks to block), an audit log of every admin action, and model status. |
| **Campaign radar** | Groups individual reports into fraud *campaigns*. Reports are linked when they share a link or number, use the same domain, or follow the same message template (Jaccard similarity on normalised words, so different links and amounts still match). Shows reports in the last 48h against the 48h before, flags spiking campaigns, and lets an officer verify every indicator of a campaign in one click. |
| **Extortion help (confidential)** | A guided page for blackmail victims: what to do and what not to do, plus an anonymous case with evidence upload. Evidence is **encrypted at rest (AES-256-GCM)** and fingerprinted with **SHA-256** on receipt. A **chain-of-custody log** records every view, and integrity is re-checked each time an officer opens a file. The victim tracks the case with a reference and a secret code, can add evidence, and can **withdraw and erase** everything. A *quick exit* button leaves the page instantly. |
| **Family protection (elderly mode)** | A guardian creates a link or QR code for a parent's phone. The parent gets a very simple page with large text and one button, and the verdict is read aloud (Web Speech API). Risky scans and an "I need help" button send alerts to the guardian, with browser notifications. The message text is shared only if the parent ticks a box. |
| **Awareness training** | A "Scam or safe?" game with points, streaks and badges (Novice, Guardian, Falcon). Each answer is explained by the live detection engine, so people learn the same red flags Saqr checks. Scores stay on the device. |
| **Learning loop** | Verifying or rejecting a reported message adds it to the training set and retrains the classifier immediately. The model gets better as the community reports. |

## 3. Architecture

```mermaid
flowchart LR
  U[Citizen browser<br/>AR / EN] -->|POST /api/scan| API
  U -->|POST /api/report| API
  U -->|GET /api/registry| API
  A[Authority browser] -->|/api/admin/* session cookie| API
  V[Victim — confidential help] -->|/api/help/case ref + code| API
  G[Guardian] <-->|/api/family alerts| API
  E[Elder device] -->|scan / help + elder token| API
  subgraph Saqr server — Node.js / Express
    API[REST API<br/>validation · rate limits · CSP] --> ENG
    API --> SVC[Services<br/>reports · registry · stats · review]
    SVC --> ENG
    subgraph ENG[Detection engine — fully local]
      NB[Naive Bayes classifier<br/>AR + EN, uni+bigrams]
      RULES[Fraud-tactic rules<br/>12 tactic families]
      URL[URL analyser<br/>static, never fetched]
      PH[Phone analyser<br/>E.164 + UAE plan]
      RED[PII redactor]
    end
    API --> CASES[Cases + vault<br/>AES-256-GCM · SHA-256 · custody]
    API --> FAM[Family alerts]
    API --> RADAR[Campaign radar<br/>union-find clustering]
    CASES --> VAULT[(Encrypted evidence files)]
    SVC --> DB[(SQLite<br/>indicators · reports · cases<br/>scan_stats · audit_log<br/>learned_samples · family)]
    CASES --> DB
    FAM --> DB
    RADAR --> DB
    DB -. verified samples .-> NB
  end
```

**Request flow for a scan:** auto-detect type → (message) normalise Arabic and digits → classifier probability + tactic rules + extract links and numbers → analyse each entity → check the community registry → combine into a score → return reason codes. The browser translates the codes into the selected language. Only an aggregate counter (day, type, verdict) is stored. The scanned text is not.

**Project layout**

```
server.js              entry point (loads demo data on first run)
src/
  app.js               Express app, routes, auth, CSP
  services.js          reports, registry, review, stats, CSV export
  db.js                SQLite schema
  security.js          rate limiter, scrypt passwords, sessions
  seed.js              fictional demo data
  cases.js             extortion cases: encrypted details, evidence, custody log
  vault.js             AES-256-GCM encryption at rest
  family.js            guardian/elder pairing and alerts
  campaigns.js         campaign radar (clustering + spike detection)
  training.js          awareness game question bank
  engine/
    index.js           Engine: type detection, scoring, levels, advice
    classifier.js      Naive Bayes
    dataset.js         bilingual seed training set
    message.js         tactic rules + message scoring
    url.js             URL analyser
    phone.js           phone analyser
    redact.js          PII redaction
    normalize.js       Arabic/digit normalisation, tokeniser, extractors
public/                vanilla HTML/CSS/JS frontend
  index.html           citizen site: scan, report, registry, training, extortion help
  family.html          guardian page (alerts)
  elder.html           simplified page for elderly relatives
  dashboard.html       authority dashboard
test/                  node:test suites (engine + API end-to-end)
```

## 4. Technical choices and reasoning

| Area | Choice | Why |
|---|---|---|
| Runtime | **Node.js 22 + Express 5** | One language end to end, a small footprint, and it starts with `npm install && npm start`. Judges need nothing else installed. |
| Database | **SQLite (better-sqlite3)** | Zero setup, a single file, transactional, and fast enough for a city-scale pilot. The schema is plain SQL, so moving to PostgreSQL is straightforward. |
| Detection | **Naive Bayes + explainable rules + static URL/phone analysis** | Explainability matters more than a black-box score here. A citizen must understand *why* something is dangerous, and an officer must be able to justify a verification. Naive Bayes trains in milliseconds, works with little data, can retrain live on every verified report, and exposes the words that drove its decision. Rules capture known tactics (OTP requests, urgency, fake fines, prizes and others) in both Arabic and English. |
| Arabic support | **Custom normalisation** | Unifies أ/إ/آ→ا, ة→ه, ى→ي, strips diacritics and tatweel, and converts Arabic-Indic digits. Without this, MSA and Gulf dialect spellings would look like different words to the model. |
| URL analysis | **Static only, never fetched** | Opening a submitted link would leak user activity and could trigger malware or tracking. Saqr inspects the string instead: look-alike and typosquatted brands, government spoofing (`gov.ae` outside the real suffix), authority names on unofficial domains, IP hosts, punycode, shorteners, free hosting, risky TLDs, `@` tricks and phishing keywords. |
| Frontend | **Vanilla HTML/CSS/JS, no CDN** | Works offline in a demo room, has no build step, and runs under a strict Content-Security-Policy with no inline scripts or styles. The charts are hand-drawn SVG. The IBM Plex Sans Arabic font is served locally. |
| Security | Helmet CSP, scrypt hashing, httpOnly + SameSite=Strict session cookie, per-IP rate limits, input size limits, parameterised SQL, admin audit log | Defence in depth for a platform that will itself be a target. |

## 5. Privacy design

Privacy is part of the architecture, not an add-on:

1. **Scans are never stored.** Only an aggregate counter (day, input type, verdict) is kept for statistics.
2. **No reporter identity.** There are no accounts, names or phone numbers. To stop one person inflating the count, Saqr stores `HMAC(secret, IP + date)`. The fingerprint changes every day, can't be reversed, and with the default random secret can't be linked across restarts either.
3. **Automatic PII redaction** removes the victim's card numbers (Luhn-checked), Emirates ID, IBAN, emails, OTP codes and passport numbers before storage. The scammer's numbers and links are kept, because they are the evidence.
4. **Links are never opened** (see above).
5. **Registry protection.** Unverified indicators appear only after `PUBLIC_THRESHOLD` independent reports (default 3). They are masked and can only be found by exact lookup. Full values appear only after an authority verifies them.
6. **Authority accountability.** Every login, verification, rejection and export is written to an audit log.
7. **Data minimisation.** The location field is the emirate only, and it is optional. The amount lost is optional.
8. **Local AI.** No message content is sent to third-party AI or cloud services.
9. **Extortion cases.** There is no identity unless the victim chooses to leave a contact. Details and evidence are encrypted with AES-256-GCM. The key lives outside the database (`EVIDENCE_KEY` or `data/evidence.key`). The access code is stored only as a scrypt hash. The victim can withdraw a case, which deletes the database rows and the encrypted files.
10. **Evidence integrity.** Each file's SHA-256 is recorded on receipt and checked again every time it is opened. The result (`integrity:ok` or `MISMATCH`) is written to the case's chain-of-custody log.
11. **Family mode.** Bearer tokens are stored only as SHA-256 hashes. The pairing token travels in the URL fragment, so it never reaches server logs. Guardians see only the verdict and tactics unless the elder chooses to share the text. Unlinking deletes the circle and all of its alerts.

## 6. Trade-offs, what we left out, and next steps

**Trade-offs**
- *Naive Bayes over a transformer model.* Accuracy is lower on unseen phrasing, but it is instant, explainable, retrainable live and fully offline. The rules and entity analysis make up much of the gap.
- *Static URL analysis.* Saqr can't see where a shortened link actually leads. We accepted this to protect users and the server, and shorteners are flagged as a risk on their own.
- *In-memory sessions and rate limits.* Simple and dependency-free, but they reset on restart and don't scale across multiple instances.
- *SQLite.* Ideal for the prototype and a single-server pilot, not for national scale.

**Left out (time constraints)**
- WhatsApp or SMS bot and a browser extension for scanning where the message arrives. The `/api/scan` endpoint is ready for both.
- Push notifications to the guardian when their page is closed (Web Push or SMS). Today alerts arrive while the guardian page is open.
- Evidence screenshots: automatic blurring of intimate content for reviewers, and OCR to pull the extorter's handle out of the image.
- OCR for screenshots of messages.
- Integration with official threat feeds, telecom block lists, or domain registration-age (WHOIS) data.
- Multi-role authority accounts (reviewer and supervisor), 2FA, and case management.

**With more time we would**
- Fine-tune a small multilingual transformer (for example, an Arabic BERT variant) and keep Naive Bayes as a fast first pass and an explainer.
- Push campaign-spike alerts to the on-duty officer, and share campaign packages with telecoms and banks automatically.
- Move to PostgreSQL + Redis, containerise, and add OpenAPI docs.
- Run an evaluation on a larger labelled dataset and publish precision and recall per fraud type.

## 7. Build and run

### Prerequisites
- **Node.js 22+** (`node -v`)
- npm (bundled with Node)

### Setup
```bash
git clone <repo-url>
cd saqr
npm install
cp .env.example .env      # optional; defaults work for the demo
npm start
```

Then open:
- Citizen site: **http://localhost:3000**
- Family protection: **http://localhost:3000/family** (create a link, then open it in another browser or on a phone)
- Authority dashboard: **http://localhost:3000/dashboard**
  - demo login: `admin` / `saqr-demo-2026` (set `ADMIN_PASS` in `.env` to change it)

On first start the database is empty, so Saqr loads **fictional demo data** (about 170 reports over 30 days) so the dashboard and registry aren't blank. Set `DEMO_DATA=false` to start empty, and run `npm run reset` to delete the database.

> **Install troubleshooting:** `better-sqlite3` downloads a prebuilt binary for your Node version. If `npm install` fails while building it, switch to the current Node 22 LTS (or install your OS build tools, e.g. *Visual Studio Build Tools* on Windows) and run `npm install` again.

### Tests
```bash
npm test
```
17 tests cover:
- **The engine:** Arabic and English scams, safe messages, official domains, URL and phone red flags, registry overrides, PII redaction, and the learning loop.
- **The report flow, end to end:** report → redaction → dedupe → admin login → verify → registry → scan → CSV → audit.
- **Extortion cases:** files are ciphertext on disk, the integrity hash is checked, tracking works, admin notes reach the victim, and withdrawal erases the files.
- **Family alerts:** only risky scans trigger an alert, the text is not shared without consent, the elder token can't read alerts, and unlinking works.
- **Campaign radar:** template variants across three domains form one campaign, the spike is detected, and bulk verify works.
- **Training:** each answer matches the engine's verdict.

### Try it
On the Scan page, use the example chips, or paste any of these:
- `شرطة أبوظبي: لديك مخالفة غير مدفوعة، ادفع خلال 24 ساعة adpolice-fines.com/pay`
- `moi.gov.ae.fines-pay.com`
- `emlratesnbd.com`
- `+882 1600 4471`
- `هلا اخوي، نتغدى اليوم؟`

### API (for bots and extensions)
| Method | Path | Body or query |
|---|---|---|
| POST | `/api/scan` | `{ "type": "auto|message|url|phone", "value": "..." }` |
| POST | `/api/report` | `{ type, value, category, channel, emirate?, amount_lost?, description? }` |
| GET | `/api/registry` | `?q=&type=&page=` |
| GET | `/api/stats` | public counters |
| GET | `/api/meta` | categories, channels and emirates |
| POST | `/api/help/case` | `{ platform, demand, paid, description, extorter?, contact?, emirate?, files: [{name, data(base64)}] }` → `{ ref, code }` |
| POST | `/api/help/case/status`, `/evidence`, `/withdraw` | `{ ref, code, files? }` |
| POST | `/api/family` | `{ label }` → guardian and elder tokens, link and QR SVG |
| GET/POST/DELETE | `/api/family/alerts`, `/seen`, `/api/family` | header `X-Guardian-Token` |
| GET/POST | `/api/family/elder`, `/api/family/help` | header `X-Elder-Token` (also on `/api/scan`) |
| GET | `/api/training` | `?lang=ar|en` |
| * | `/api/admin/*` | `login`, `logout`, `me`, `stats`, `indicators`, `indicators/:id/status`, `campaigns`, `campaigns/verify`, `cases`, `cases/:id`, `cases/:id/evidence/:eid`, `audit`, `export.csv` |

## 8. Team

| Name | Role |
|------|------|
| | |
| | |
| | |

## 9. Ownership and data

The team retains full ownership of this prototype, as the hackathon terms state. All domains, phone numbers and messages in the demo data are fictional examples written for the demo. Saqr is not affiliated with any government entity.

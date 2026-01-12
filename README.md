# OrkaChat

Cross‑platform chat app (iOS / Android / Web) with **end‑to‑end encrypted (E2EE)** messaging, channels, media attachments, and AI tooling. Built with **React Native + Expo (RN Web)** on the frontend and **AWS (Amplify Gen 2 + API Gateway + Lambda)** on the backend.

## Features

### Messaging
- **Encrypted DMs + group DMs (E2EE)**
- **Channels**
- **Persistent chat** (history kept) + **“Last active” sorting** in chats
- **Typing indicator**
- **Sent / delivered confirmation**
- **Read receipts** (optional / where supported)
- **Edit messages**
- **Delete messages**
- **Reactions**

### Media
- **Multi‑media messages** (images / video) with **previews**
- **In‑app camera capture** for attaching media
- **Encrypted media in DMs / group DMs (E2EE media)**

### Safety & Moderation
- **Block users**
- **Report messages and users** (UGC compliance friendly)

### UX / Personalization
- **User profile settings**: avatar colors + optional image (crop + zoom)
- **Chat background settings**: color or image
- **Splash screens** (light/dark)

### Web portal
- **Open Graph (OG) previews** for sharing
- **Mobile‑like rotated device layouts** supported on web

### AI
- **AI summarization**
- **AI reply / response suggestions** using chat context

### Platform
- **Guest mode** (read‑only/public endpoints)
- **Mobile push notifications**

## Architecture (high level)

- **Frontend**: `frontend/` is an Expo app (React Native + RN Web), written in **TypeScript**
- **Auth**: **AWS Cognito** (via Amplify Auth)
- **Realtime (signed‑in users)**: **API Gateway WebSockets** → Lambda route handler(s)
- **HTTP (guest/public + some hydration)**: **API Gateway HTTP API** → Lambda handlers
- **Data**: DynamoDB (users, messages, conversations, reads/unreads, blocks, reports, quotas, connections)
- **Media**: S3 for storage + **CloudFront** for fast delivery
  - Public channel media + public avatars: **unsigned CloudFront**
  - DM/group DM media: **CloudFront signed URLs**
- **Background jobs**: SQS + worker Lambda for **S3 media deletion cleanup**
- **Abuse limits**: DynamoDB‑backed **AI quotas**, **media upload/download limits**, and **signed URL issuance limits**
- **AI**: Lambda endpoints with caching (TTL) + quota enforcement

## Repo layout

```
ProjxonApp/
├── frontend/                         # Expo (React Native + RN Web) + TypeScript
│   ├── amplify/                      # Amplify Gen 2 backend definition (Auth/Storage/CloudFront outputs)
│   ├── app.json                      # Expo config (includes runtime API/WS URLs in `expo.extra`)
│   └── src/
├── backend/
│   └── aws/
│       └── src/
│           └── handlers/             # Lambda handlers (HTTP, WebSocket, async workers)
├── layer/                            # Lambda layer(s)
└── docs/                             # Deployment docs (web portal, policies, etc.)
```

## Setup (local dev)

### Prerequisites
- Node.js **18+**
- npm
- An AWS account with permissions to deploy Amplify Gen 2 resources (for sandbox deployments)

### Install & run

From `frontend/`:

```bash
npm install
npm start
```

Useful commands:
- Web (dev): `npm run web`
- Android (native build + run): `npm run android`
- iOS (native build + run, macOS only): `npm run ios`
- Static web export: `npm run build:web` (outputs `frontend/dist/`)

Running **web + Android from one dev server**:
- Run `npm start`, then press **`w`** to open web and **`a`** to open Android (emulator/device) from the same Expo server.

Android emulation:
- Install **Android Studio** and create an **AVD** (Android Virtual Device), then use `npm start` → press **`a`** or run `npm run android`.

### Runtime configuration (API / WebSocket / CDN)

The app reads URLs from:
- `frontend/app.json` → `expo.extra.WS_URL` and `expo.extra.API_URL`
- `frontend/amplify_outputs.web.json` (preferred for web) or `frontend/amplify_outputs.json` (generated) → `custom.cdnUrl`, `custom.signerApiUrl` (if present)
- Code: `frontend/src/config/env.ts`

## CloudFront media (public + DM)

OrkaChat stores media in **S3**, but serves it via **CloudFront**:
- Public channel media + public avatars: **CloudFront (unsigned)** via `CDN_URL`
- DM/group DM media: **CloudFront (signed URLs)** via the `POST /media/dm/signed-url` signer endpoint

### CloudFront key pair (DM signed URLs)

DM media requires CloudFront signed URLs. Generate an RSA key pair:

```bash
openssl genrsa -out cloudfront_private_key.pem 2048
openssl rsa -pubout -in cloudfront_private_key.pem -out cloudfront_public_key.pem
```

These files are intentionally ignored by git. **Never commit private keys.**

### Deploy CloudFront DM behavior in Amplify sandbox

The Amplify backend only creates the DM‑protected CloudFront behavior if you provide the **public key PEM** at deploy time.

**bash**:

```bash
export DM_CLOUDFRONT_PUBLIC_KEY_PEM="$(tr -d '\r' < cloudfront_public_key.pem)"
cd frontend
npx ampx sandbox
```

**PowerShell**:

```powershell
$env:DM_CLOUDFRONT_PUBLIC_KEY_PEM = (Get-Content .\cloudfront_public_key.pem -Raw) -replace "`r",""
cd frontend
npx ampx sandbox
```

After deploy, check `frontend/amplify_outputs.json` for:
- `custom.cdnUrl`
- `custom.dmKeyPairId` (when DM key group is enabled)

### Configure the signer Lambda env vars

The signer Lambda behind `POST /media/dm/signed-url` must have:
- `CDN_URL` = `custom.cdnUrl`
- `CLOUDFRONT_KEY_PAIR_ID` = `custom.dmKeyPairId`
- `CLOUDFRONT_PRIVATE_KEY_PEM` = contents of `cloudfront_private_key.pem`

## Docs / reference

- Backend routes (HTTP + WebSocket): `backend/aws/src/handlers/README.md`
- Web portal hosting (Amplify Hosting / S3+CloudFront): `docs/web-portal-deploy.md`

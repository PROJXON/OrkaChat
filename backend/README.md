# Backend (manual AWS setup)

This repo **tracks the Lambda source code**, but the backend resources are currently **created manually in AWS** (no IaC).

## Where the backend code lives

- Lambda handlers (HTTP + WebSocket + async worker): `backend/aws/src/handlers/`
- Lambda layers: `layer/`

## Setup docs

- Routes → Lambdas (HTTP + WebSocket): `backend/aws/src/handlers/README.md`
- Required DynamoDB tables + GSIs (manual): `backend/aws/src/handlers/README.md`

## AI streaming (SSE)

The backend includes **streaming-capable** variants of the AI endpoints:

- `backend/aws/src/handlers/http/aiHelperStream.js` (streaming variant of **POST `/ai/helper`**)
- `backend/aws/src/handlers/http/aiSummaryStream.js` (streaming variant of **POST `/ai/summary`**)

Important:
- **API Gateway HTTP API v2 may buffer responses** and not stream to clients.
- For true streaming, wire these handlers behind a **streaming-capable integration** (e.g. **Lambda Function URL** with `InvokeMode=RESPONSE_STREAM`, or **API Gateway REST API** response streaming).

# Backend (manual AWS setup)

This repo **tracks the Lambda source code**, but the backend resources are currently **created manually in AWS** (no IaC).

## Where the backend code lives

- Lambda handlers (HTTP + WebSocket + async worker): `backend/aws/src/handlers/`
- Lambda layers: `layer/`

## Setup docs

- Routes → Lambdas (HTTP + WebSocket): `backend/aws/src/handlers/README.md`
- Required DynamoDB tables + GSIs (manual): `backend/aws/src/handlers/README.md`


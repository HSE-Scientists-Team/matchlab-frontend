# MatchLab Frontend

React + TypeScript + Vite. The application lives under /admin/ and uses the Admin facade through same-origin /api/v1/admin requests. Never call owner gRPC APIs or import staff credentials into the browser.

Admin OpenAPI snapshot is api/admin.openapi.yaml. Sync from backend via npm run api:sync -- <path-or-https-url>, then npm run api:generate and commit schema.d.ts. Treat ProtoJSON int64 values as strings; send explicit boolean false and expected_revision on mutations. No automatic mutation retries.

Keep tokens in tab session storage/memory; clear auth and private React Query cache on expiry, logout or 401. Do not persist passwords, evidence URLs or response data in localStorage. Do not log request bodies or credentials. Uncertain mutation results require state/history refresh.

Use Russian UI copy and the reference style: pale background, white rounded cards, slate text, blue accents. Maintain keyboard navigation, accessible labels/contrast, focus-trapped dialogs and mobile layout. Production has no demo data; fixtures exist only under tests.

Run npm run format:check, npm run build, npm test and npm run test:e2e before push. Browser tests mock the API and must not mutate the live service. Manifests and deployment belong to matchlab-infra. Do not merge or deploy without a user request.

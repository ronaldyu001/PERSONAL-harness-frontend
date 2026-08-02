# Harness Frontend

React and TypeScript chat interface for the Harness backend.

## Run locally

Start the backend on `http://127.0.0.1:8000`, then run:

```bash
npm ci
npm run dev
```

Vite proxies `/api` to the backend, so browser requests stay same-origin during
development. Override the proxy target when necessary:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev
```

For a production build, serve the frontend and `/api` behind the same reverse
proxy. `VITE_API_BASE_URL` can point the HTTP adapter at another API origin, but
that origin must allow the frontend through its CORS policy.

## Architecture

```text
React components
    -> SendChat application use case
        -> ChatPort
            -> HttpChatAdapter

SendChat application use case
    -> UserIdentityPort
        -> LocalStorageUserIdentityAdapter
```

- `src/application/` contains provider-independent ports, request/result
  schemas, and the chat use case.
- `src/infrastructure/` maps those ports to browser APIs and the backend HTTP
  contract.
- `src/components/` and `src/App.tsx` manage presentation state.
- `src/main.tsx` is the composition root.

The backend's returned `session_id` is stored on its frontend conversation and
reused for subsequent turns. The browser user ID is generated once and retained
in local storage.

The current backend returns complete JSON responses rather than a token stream,
so the UI shows a thinking state and then renders the complete response.
Attachments remain disabled until the backend exposes an attachment contract.

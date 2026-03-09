---
summary: Preview chat mock API contract for the isolated preview-chat lane.
read_when:
  - Updating preview chat UI or the public interview preview endpoint.
---

# Preview Chat Contract

`POST /api/interviews/preview`

Request JSON:

```json
{
  "agentId": "agent-1",
  "message": "How do you prioritize emails?"
}
```

Response JSON:

```json
{
  "content": "I prioritize based on several factors..."
}
```

Notes:

- Mock-backed only.
- Response is keyed off the selected agent and the user message.
- No DB, auth, cart, checkout, or run state is involved.

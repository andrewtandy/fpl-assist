# pipeline

Python Azure Functions: `ingest/` (timer-triggered poller writing raw JSON to Blob), `load/` (batch loader into the SQL `raw` schema), `contracts/` (Pydantic models per endpoint) and `tests/` (recorded fixtures only, no live API calls).

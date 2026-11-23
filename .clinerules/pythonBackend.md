---
paths:
  - "backend/**"
  - "db/**"
  - "frontend/electron/**"
---

# Python Backend Rules (Cline Rules)

Follow these rules when working in `backend/`, `db/`, or the Electron bridge. `backend/README.md` is the source of truth for how the service works.

## How the pieces talk

- React never talks to Python directly. The path is: page, then `window.calsim` (preload), then Electron main, then Python stdin. Replies come back on stdout.
- There is no local web server. Never add Flask, FastAPI, or any HTTP server.
- Messages are one JSON object per line: `{"id", "command", "args"}` in, `{"id", "ok", "result"}` or `{"id", "ok": false, "error": {"code", "message"}}` out.

## Python rules

- **stdout is reserved for replies.** Never use `print()` in `backend/`. Use `logging.getLogger(__name__)`.
- Register commands with the `@command("name")` decorator in `service.py`. Keep handlers short.
- Put all SQL in `database.py`, never inside a handler.
- Raise `CommandError("code", "message")` for errors a user should see. The message must be safe to show in the UI.
- Only the DSS reader module may import `hecdss`. Never import it anywhere else.
- Always use parameterized SQL (`?` placeholders). Never build SQL with string formatting.
- Turn on `PRAGMA foreign_keys = ON` for every connection.

## Database rules

- `db/schema.sql` defines the tables. Change it only for a Jira story that needs it, and update `db/test_schema.py` in the same change.
- Run ids are `TEXT` strings like `run-1794297600000` (`runs.id` and `series.run_id`). Validate them as nonempty strings. Never cast them to `int`.
- Keep the schema plain SQLite so it works from any language.
- After any `db/` change, run `py -3 -m unittest db/test_schema.py -v` from the repo root (`python3` on Mac, Linux, and Codespaces).

## Adding a command

1. Add the handler in `backend/service.py` (SQL in `database.py`).
2. Add the command name to the allow-list in `frontend/electron/backend.cjs`.
3. Add a test in `backend/tests/` and a row to the Commands table in `backend/README.md`.
4. Run `py -3 -m unittest discover backend/tests -v` from the repo root (`python3` on Mac, Linux, and Codespaces). The `add-backend-command` skill has the full steps.

# `backend/`: Python data service (SCRUM-218)

A small Python program the desktop app starts in the background. It reads HEC-DSS files and
owns the SQLite database (`calsim.db`, built from `db/schema.sql`). React never talks to it
directly:

```
React page → callBackend() → window.calsim (preload) → Electron main → Python stdin
                                                                       ← Python stdout
```

There is **no local web server**. Electron's security setup blocks http/ws requests, so the
two processes talk over the child process's stdin/stdout pipes, one JSON message per line.

| File | What it is |
|---|---|
| `service.py` | Entry point: reads requests from stdin, runs the command, writes the reply to stdout |
| `database.py` | Opens `calsim.db`, runs `db/schema.sql`, database queries (`list_runs`) |
| `requirements.txt` | Python packages (`hecdss`, `numpy`) |
| `tests/` | `unittest` tests (standard library only) |

## Setup (Windows)

Needs Python 3.10 or newer. From the **repo root**:

```
py -3 -m pip install -r backend/requirements.txt
```

Use `python3 -m pip ...` on Linux. **Mac:** `hecdss` has no Mac build, so the backend can't
run there. That's fine: the app still opens and Import works in session mode, it just
can't save runs.

## Running the tests

From the **repo root**:

```
py -3 -m unittest discover backend/tests -v
```

(`python` or `python3` instead of `py -3` on other systems.) The tests create temporary folders
and delete them afterwards; they never touch your real `.calsim-data.local/`. One test starts
`service.py` as a real child process, the same way Electron does.

The schema has its own tests: `py -3 -m unittest db/test_schema.py -v`.

## Running the service by hand

Useful for debugging without Electron:

```
py -3 backend/service.py --data-dir .calsim-data.local
```

Then type a request and press Enter:

```
{"id": 1, "command": "ping"}
```

Close it with Ctrl+Z then Enter (Windows) or Ctrl+D (Mac/Linux). Closing stdin is also how
Electron stops it when the app quits.

## Message format

One JSON object per line, in both directions.

```
request   {"id": 1, "command": "ping", "args": {}}
success   {"id": 1, "ok": true,  "result": {...}}
error     {"id": 1, "ok": false, "error": {"code": "unknown_command", "message": "..."}}
```

- `id` is chosen by the caller and echoed back, so replies can be matched to requests.
- `args` is optional (missing or `null` = `{}`).
- `message` is safe to show a user. Technical details (tracebacks) go to stderr, which Electron
  copies into `desktop.log` with a `[backend]` prefix.

Error codes every command can return:

| Code | Meaning |
|---|---|
| `invalid_request` | Not valid JSON, not an object, no `command`, or `args` isn't an object |
| `unknown_command` | No command with that name |
| `internal_error` | A bug in a command; see `desktop.log` |

**stdout is reserved for replies.** Never `print()` in this folder; use
`logging.getLogger(__name__)`. (The service redirects stray output to stderr as a safety net,
but don't rely on it.)

## Commands

| Command | Args | Result |
|---|---|---|
| `ping` | none | `{ version, dbPath }` |
| `list_runs` | none | Array of runs, newest first, same camelCase shape as `createRun()` in `frontend/src/data/runModel.js`, plus `errorMessage` and `dssVersion`. `catalogSummary` is `{ seriesCount, variableCount, startDate, endDate }` for `ready` runs, `null` otherwise |

## Adding a command

1. In `service.py`, write a function and register it with one line:

   ```python
   @command("get_run")
   def get_run(args, ctx):
       run_id = args.get("runId")
       ...                          # use ctx.connection for the database
       return {...}                 # anything JSON can represent
   ```

   For an error the user should see, `raise CommandError("run_not_found", "That run no longer exists.")`.
   Put SQL in `database.py`, not in the handler.
2. Add the command name to the allow-list in `frontend/electron/backend.cjs`, or Electron will
   refuse to forward it.
3. Add a test in `backend/tests/` and a row to the table above.
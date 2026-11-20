---
name: add-backend-command
description: Use when adding or changing a command in the Python data service (backend/service.py), such as get_run, list_series, or read_series_values, so a page can get real data from the SQLite database or a DSS file.
---

# Add a Backend Command

Follow this order every time. `backend/README.md` has the full message format.

## Steps

1. **Plan the contract first.** Write down the command name (`snake_case`), its `args` (camelCase keys), and the exact shape of the `result`. Match the field names in `frontend/src/data/runModel.js` (camelCase).
2. **Add the query.** Write the SQL in `backend/database.py` as its own function. Always use `?` placeholders.
3. **Add the handler** in `backend/service.py`:

   ```python
   @command("get_run")
   def get_run(args, ctx):
       run_id = args.get("runId")
       if not isinstance(run_id, int):
           raise CommandError("invalid_args", "Choose a valid run.")
       run = database.get_run(ctx.connection, run_id)
       if run is None:
           raise CommandError("run_not_found", "That run no longer exists.")
       return run
   ```

4. **Allow it in Electron.** Add the command name to the allow-list in `frontend/electron/backend.cjs`. Electron refuses commands that are not listed.
5. **Test it.** Add a test in `backend/tests/` for success and for each error code. Run `py -3 -m unittest discover backend/tests -v` from the repo root.
6. **Document it.** Add a row to the Commands table in `backend/README.md`.

## Pitfalls

- Never `print()`; stdout carries the replies. Use `logging`.
- Never return Python objects JSON cannot hold (dates, numpy types). Convert them to strings, ints, floats, and lists first.
- Never put technical details in `CommandError` messages. Those go to the log.
- Keep big results small: return catalog rows, not every value, unless the command is for values.

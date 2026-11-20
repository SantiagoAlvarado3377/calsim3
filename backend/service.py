"""CalSim 3 Python service (SCRUM-218 / SCRUM-219).

WHAT THIS IS
A small program the desktop app starts in the background. Electron's main
process talks to it through its stdin/stdout pipes, one JSON message per line:

    Electron  --(stdin)-->   {"id": 1, "command": "ping", "args": {}}
    Electron  <--(stdout)--  {"id": 1, "ok": true, "result": {"version": "0.1.0", ...}}

On failure the reply carries an error instead of a result:

    {"id": 1, "ok": false, "error": {"code": "unknown_command", "message": "..."}}

WHY PIPES AND NOT A LOCAL WEB SERVER
frontend/electron/main.cjs cancels every http(s)/ws request except the Vite
dev server (the app's security setup). A localhost API would be blocked, and
it would also be reachable by any other program on the machine. A pipe is
private to the two processes, like an intercom between two rooms instead of
a phone number anyone can dial.

THE ONE RULE: stdout IS THE PROTOCOL
Every line on stdout must be one complete JSON reply. A single stray print()
(ours, or a library's) would arrive in Electron as a broken message. So:
  - only send() writes to the protocol stream,
  - logging goes to stderr (Electron copies it into desktop.log),
  - at startup claim_stdout() moves the real stdout aside so that anything
    else that tries to print (even C code inside the DSS library) lands on
    stderr instead of corrupting the protocol.

HOW TO ADD A COMMAND (teammates: this is the part you need)
    @command("get_run")
    def get_run(args, ctx):
        return {...}          # any JSON-serialisable value

Then add the name to the allow-list in frontend/electron/backend.cjs
(SCRUM-221), so the React side is allowed to call it. Raise CommandError(code,
message) for errors the user should see; any other exception becomes
internal_error with the details in the log.

Run it by hand (handy for debugging):
    python backend/service.py --data-dir .calsim-data.local
then type {"id": 1, "command": "ping"} and press Enter. Ctrl+Z, Enter
(Windows) or Ctrl+D (Mac/Linux) closes stdin and the service exits.
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

# Make "import database" work however the script is started. When run as
# `python backend/service.py`, Python already adds backend/ to the path; when
# the tests import it as a module they add it too. This line just makes it
# explicit and safe for both.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import database  # noqa: E402  (must come after the sys.path line above)

# Bump when the protocol or commands change in a way Electron should know about.
VERSION = "0.1.0"

log = logging.getLogger("calsim.service")


# =============================================================================
# Errors and the command registry
# =============================================================================

class CommandError(Exception):
    """An expected failure with a code React can act on and a message a user can read.

    Example: raise CommandError("file_not_found", "The selected file could not be found.")
    The code is for programs (stable, snake_case); the message is for people.
    """

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


class Context:
    """Everything a command handler might need, passed in instead of being global.

    Passing it explicitly (rather than handlers reaching for module globals)
    means a test can build a Context around a temporary database and call any
    handler directly, with no real data folder and no subprocess.
    """

    def __init__(self, connection, db_path):
        self.connection = connection
        self.db_path = str(db_path)


# The registry: command name -> handler function. A dict is the whole "router".
# Like a restaurant menu: the waiter (handle_request) doesn't know how to cook,
# it just looks the dish up and passes the order to the right station.
COMMANDS = {}


def command(name):
    """Decorator that registers a handler under `name`. One line per command."""

    def register(handler):
        if name in COMMANDS:
            # Two teammates picking the same name would silently replace one
            # handler with the other. Fail loudly at startup instead.
            raise ValueError(f"Command {name!r} is registered twice")
        COMMANDS[name] = handler
        return handler

    return register


# =============================================================================
# Commands
# =============================================================================

@command("ping")
def ping(args, ctx):
    """Health check: proves the service is running and the database opened.

    Electron calls this right after starting us (with a timeout) to decide
    whether the backend is available.
    """
    return {"version": VERSION, "dbPath": ctx.db_path}


@command("list_runs")
def list_runs(args, ctx):
    """All saved runs, newest first, in createRun()'s camelCase shape."""
    return database.list_runs(ctx.connection)


# =============================================================================
# Request handling (pure functions: no stdin/stdout, easy to test)
# =============================================================================

def ok_reply(request_id, result):
    return {"id": request_id, "ok": True, "result": result}


def error_reply(request_id, code, message):
    return {"id": request_id, "ok": False, "error": {"code": code, "message": message}}


def handle_request(request, ctx):
    """Turn one already-parsed request into one reply dict. Never raises.

    "Never raises" is the important promise: whatever goes wrong inside a
    command, the caller always gets a reply to send back, so one bad request
    can't take the whole service down.
    """
    # Validate the envelope before trusting any of it. The id is echoed back
    # even on errors (when we can find one) so Electron can match the reply
    # to the request that's waiting for it.
    if not isinstance(request, dict):
        return error_reply(None, "invalid_request", "A request must be a JSON object.")

    request_id = request.get("id")
    name = request.get("command")
    args = request.get("args", {})
    # Allow "args": null as shorthand for "no arguments".
    if args is None:
        args = {}

    if not isinstance(name, str) or not name:
        return error_reply(request_id, "invalid_request", "A request needs a \"command\" name.")
    if not isinstance(args, dict):
        return error_reply(request_id, "invalid_request", "\"args\" must be a JSON object.")

    handler = COMMANDS.get(name)
    if handler is None:
        return error_reply(request_id, "unknown_command", f"Unknown command: {name}")

    try:
        return ok_reply(request_id, handler(args, ctx))
    except CommandError as error:
        # Expected failure: pass the friendly message straight through.
        return error_reply(request_id, error.code, error.message)
    except Exception:
        # Unexpected failure (a bug). The user gets a generic message; the full
        # traceback goes to stderr -> desktop.log, where developers can see it.
        # We never put tracebacks in the reply: they're noise to a user and can
        # reveal file paths.
        log.exception("Command %s failed", name)
        return error_reply(request_id, "internal_error", "Something went wrong in the data service. See desktop.log for details.")


def handle_line(line, ctx):
    """Parse one line of text from stdin and handle it. Never raises."""
    try:
        request = json.loads(line)
    except ValueError:
        # json.JSONDecodeError is a ValueError. We can't know the id of a
        # message we couldn't read, so it's null.
        log.warning("Ignoring a line that is not valid JSON: %.200s", line)
        return error_reply(None, "invalid_request", "The request was not valid JSON.")
    return handle_request(request, ctx)

# =============================================================================
# stdin/stdout plumbing (only used when running as a real process)
# =============================================================================

def claim_stdout():
    """Keep the real stdout for replies only; send every other print to stderr.

    How: os.dup(1) makes a private copy of the stdout pipe (a second key to
    the same door) that only send() uses. Then os.dup2(2, 1) points file
    descriptor 1, which is what print() and C libraries write to, at stderr.

    Why at the file-descriptor level and not just sys.stdout = sys.stderr:
    the DSS library prints from C code, which writes to descriptor 1 directly
    and never goes through Python's sys.stdout. Redirecting the descriptor
    catches both. (SCRUM-220 also turns the library's chatter off, this is
    the safety net in case something else prints.)

    Returns a text stream for replies.
    """
    sys.stdout.flush()
    protocol_fd = os.dup(1)
    os.dup2(2, 1)
    # Point Python's own sys.stdout at stderr too, so a stray print() goes
    # to the log rather than to the (now redirected) descriptor 1 buffer.
    sys.stdout = sys.stderr
    # newline="\n" so Windows doesn't turn each "\n" into "\r\n". Electron
    # would cope, but one exact line ending is simpler to reason about.
    return os.fdopen(protocol_fd, "w", encoding="utf-8", newline="\n")


def send(stream, reply):
    """Write one reply as one line and flush immediately.

    The flush matters: without it Python buffers output when stdout is a pipe,
    and Electron would sit waiting for a reply that's stuck in our buffer.
    """
    # ensure_ascii=False keeps names like "Año" readable; the stream is UTF-8.
    stream.write(json.dumps(reply, ensure_ascii=False) + "\n")
    stream.flush()


def parse_args(argv):
    parser = argparse.ArgumentParser(description="CalSim 3 Copilot data service (JSON lines over stdin/stdout).")
    parser.add_argument(
        "--data-dir",
        required=True,
        help="Folder for calsim.db (Electron passes .calsim-data.local or CalSim3Data). Created if missing.",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    # Logs -> stderr only. No timestamp: Electron writes the line into
    # desktop.log with its own timestamp and a [backend] prefix.
    logging.basicConfig(stream=sys.stderr, level=logging.INFO, format="%(levelname)s %(message)s")

    protocol = claim_stdout()

    # Read stdin as UTF-8 regardless of the Windows code page, matching what
    # Electron writes.
    sys.stdin.reconfigure(encoding="utf-8")

    data_dir = Path(args.data_dir).resolve()
    db_path = data_dir / database.DB_FILE_NAME
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        connection = database.connect(db_path)
    except Exception:
        # Can't work without a database. Exit non-zero; Electron sees the exit,
        # marks the backend unavailable, and the app keeps running without it.
        log.exception("Could not open the database at %s", db_path)
        return 1

    log.info("Service %s ready, database %s", VERSION, db_path)
    ctx = Context(connection, db_path)

    try:
        # `for line in sys.stdin` ends when stdin closes. That is our shutdown
        # signal: Electron closes our stdin when the app quits, the loop ends,
        # and we exit cleanly (no orphaned python.exe in Task Manager).
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue  # blank lines are harmless, skip them
            reply = handle_line(line, ctx)
            try:
                send(protocol, reply)
            except (TypeError, ValueError):
                # A handler returned something JSON can't represent (a set,
                # a datetime, bytes...). That's a bug in the handler, but it
                # must not kill the service: report it and keep going.
                log.exception("Reply for request %r is not JSON-serialisable", reply.get("id"))
                send(protocol, error_reply(reply.get("id"), "internal_error",
                                           "Something went wrong in the data service. See desktop.log for details."))
    except KeyboardInterrupt:
        pass  # Ctrl+C while testing by hand: exit quietly, no traceback
    finally:
        connection.close()
        log.info("stdin closed, service stopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
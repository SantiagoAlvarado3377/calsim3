# Git and Jira Workflow (Cline Rules)

Follow these rules for every change. They match how Team Null tracks work in Jira and reviews it on GitHub.

## Branches

- You must never commit directly to `main`. All work goes through a pull request.
- Use one branch per Jira story, named `feature/scrum-<number>-<short-name>` (for example `feature/scrum-17-variable-name`).
- Start every branch from the latest `main` (`git checkout main && git pull`).

## Commits

- Make one commit per Jira subtask when possible, so each subtask has its own commit.
- Start every commit message with the Jira key, then a short description in the imperative: `SCRUM-205 Show applied variable name above the chart`.
- Only commit files that belong to the task. Never commit `node_modules/`, `dist/`, `release/`, `.calsim-data.local/`, `.env`, or API keys.
- Never rewrite or force-push history that is already on GitHub.

## Pull Requests

- Title the pull request with the story key and goal: `SCRUM-17 Show selected variable name above the chart`.
- In the description, list each subtask and what changed, and say which tests and lint you ran.
- A teammate who did not write the code must review it before it is merged into `main`.

## Before You Push

- Run `npm test` and `npm run lint` from `frontend/` for frontend changes.
- For `backend/` changes, run `py -3 -m unittest discover backend/tests -v` from the repo root (`python3` instead of `py -3` on Mac, Linux, and Codespaces).
- For `db/` changes, run `py -3 -m unittest db/test_schema.py -v` from the repo root (`python3` instead of `py -3` on Mac, Linux, and Codespaces), plus the backend tests above.
- Always show the user the exact git commands before running them. Never run `git push`, `git reset --hard`, or delete branches without the user approving.

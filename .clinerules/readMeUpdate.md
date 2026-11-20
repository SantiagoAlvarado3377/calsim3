# README Update Rule

When making changes, update `README.md` **only when** the change affects how someone uses, sets up, or understands the project. This applies to the root `README.md` and to the folder READMEs (`backend/README.md`, `db/README.md`).

## Required README updates

Update the README when any of the following happen:

- A new feature or major capability is added (a new page, a new backend command).
- Setup, installation, or development commands change.
- New scripts are added that people need to run (`package.json` scripts, Python commands).
- Environment variables, Python packages, or configuration requirements change.
- The project structure or architecture changes in a meaningful way (new folder, new process, new data flow).
- Breaking changes are introduced.

## Do NOT update the README for

- Bug fixes.
- Internal refactors.
- Adding or updating tests.
- Styling or minor UI changes.
- Performance improvements with no usage impact.

## How to update

- Change only the section that is affected. Never rewrite the whole README.
- Keep the existing headings and tone. Use short steps and exact commands.
- When a backend command is added, add its row to the Commands table in `backend/README.md`.

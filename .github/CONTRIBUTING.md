# Contributing

All changes to this repository must go through a Pull Request (PR) targeting the `main` branch.

Required checks before merging:

- `Unit Tests / unit-tests`
- `Smoke / smoke`

Manual/exception workflows:

- `db-ssl-validation` is a manually triggered workflow and is not a universally required PR check.

Merge requirements:

- At least one approving review is required before merging.
- Branches must be up to date with `main` (require status checks to be up to date).
- Force-pushes to `main` are blocked.
- Deleting the `main` branch is blocked.

Repository administrators are currently subject to the same rules (`enforce_admins: true`).

If you need an exception, contact a repository admin and include the requested exception, the reason it is needed, and the PR or branch it applies to. Do not merge until a repository admin has provided explicit written approval, and link that approval from the PR description or comments.

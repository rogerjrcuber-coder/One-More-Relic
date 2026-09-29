# One More Relic

Read [docs/MASTER_SPEC.md](docs/MASTER_SPEC.md) for the user's project specification and ongoing engineering requirements.

The current application is a local canvas/JavaScript implementation served by `serve.py`. See README.md for implemented features and current limitations; the master specification also describes the intended production architecture.

Preserve existing local saves and JSON backups. Run the browser regressions appropriate to changes using isolated test contexts, without modifying the user's real browser profile.

# DayRoute Maestro E2E tests

The flows in `.maestro/` test the production application at
`https://dayroute-calendar.vercel.app`.

## Coverage

- Production page load and day/week/month/year view switching
- Event creation using place autocomplete
- Schedule persistence after a browser reload
- Favorite-place creation and start-location selection

Every flow clears browser state at the beginning, so it can run independently.
The event flow intentionally reloads once without clearing state to verify
DayRoute's localStorage persistence.

## Run locally

Install Maestro CLI, then run all flows from the repository root:

```powershell
maestro test .maestro
```

Run only the fast production smoke test:

```powershell
maestro test .maestro --include-tags smoke
```

## GitHub Actions

`.github/workflows/maestro-e2e.yml` runs:

- manually from **Actions > Maestro E2E > Run workflow**
- after a successful deployment status event
- every day at 09:00 JST

The workflow targets the production Vercel URL and does not require secrets.

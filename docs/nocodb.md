# NoCoDB Deployment

NoCoDB is the admin database console for the same Postgres source of truth used by Vulpine Command Center.

## Files

- `docker-compose.nocodb.yml`
- `scripts/nocodb-up.sh`

## Required Env

Set this in `.env` before starting NoCoDB:

```bash
NOCODB_DATABASE_URL=
```

Use the NoCoDB-supported Postgres connection format for `NC_DB`. Do not commit credentials.

## Start

```bash
scripts/nocodb-up.sh
```

The compose file binds NoCoDB to `127.0.0.1:8080` only. Do not expose this port directly to the internet.

## Reverse Proxy

If you put it behind nginx, the intended hostname is:

```text
nocodb.vulpinehomes.com -> http://127.0.0.1:8080
```

Keep NoCoDB behind authentication and firewall rules. Refresh the NoCoDB schema after migrations so new Postgres tables appear.

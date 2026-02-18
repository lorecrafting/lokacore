#!/usr/bin/env bash
set -e

# If neither LITESTREAM_REPLICA_URL nor BUCKET_NAME is set, run the app directly
# (local dev or environments without backup configured)
if [ -z "$LITESTREAM_REPLICA_URL" ] && [ -z "$BUCKET_NAME" ]; then
	exec "$@"
fi

# If db doesn't exist, try restoring from object storage
if [ ! -f "$DATABASE_PATH" ] && [ -n "$BUCKET_NAME" ]; then
	litestream restore -if-replica-exists "$DATABASE_PATH"
fi

# Migrate database
/app/bin/migrate

# Launch application with litestream continuous replication
if [ -n "$BUCKET_NAME" ]; then
	litestream replicate -exec "${*}"
else
	exec "${@}"
fi
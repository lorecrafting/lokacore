#!/usr/bin/env bash
set -e

# Ensure the database directory exists and is owned by nobody
if [ -d "/mnt/name" ]; then
    chown -R nobody:nogroup /mnt/name
    chmod -R 755 /mnt/name
fi

# Drop privileges and run as nobody user
exec su-exec nobody "$@"

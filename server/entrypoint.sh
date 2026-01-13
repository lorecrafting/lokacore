#!/usr/bin/env bash
set -e

# Ensure the database directory exists and is owned by nobody with write permissions
# This must match the volume mount path in fly.toml (/mnt/lokacore_data)
mkdir -p /mnt/lokacore_data
chown -R nobody:nogroup /mnt/lokacore_data
chmod -R 775 /mnt/lokacore_data

# Drop privileges and run as nobody user
exec gosu nobody "$@"

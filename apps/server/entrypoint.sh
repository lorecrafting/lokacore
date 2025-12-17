#!/usr/bin/env bash
set -e

# Ensure the database directory exists and is owned by nobody with write permissions
mkdir -p /mnt/name
chown -R nobody:nogroup /mnt/name
chmod -R 775 /mnt/name

# Drop privileges and run as nobody user
exec gosu nobody "$@"

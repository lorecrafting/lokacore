#!/usr/bin/env bash
set -e

# Ensure the database directory exists and is owned by nobody with write permissions
mkdir -p /mnt/exmud_data
chown -R nobody:nogroup /mnt/exmud_data
chmod -R 775 /mnt/exmud_data

# Drop privileges and run as nobody user
exec gosu nobody "$@"

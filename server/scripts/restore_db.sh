#!/bin/bash
# Database restore script for ExMUD on Fly.io
# Usage: fly ssh console -C "/app/scripts/restore_db.sh <backup_file>"
# Example: fly ssh console -C "/app/scripts/restore_db.sh exmud_backup_20250101_120000.db.gz"

set -e

# Configuration
DB_PATH="${DATABASE_PATH:-/mnt/exmud_data/exmud.db}"
BACKUP_DIR="${BACKUP_DIR:-/mnt/exmud_data/backups}"

if [ -z "$1" ]; then
    echo "=== ExMUD Database Restore ==="
    echo ""
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/exmud_backup_*.db.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Handle relative paths
if [[ ! "$BACKUP_FILE" = /* ]]; then
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

echo "=== ExMUD Database Restore ==="
echo "Backup file: $BACKUP_FILE"
echo "Target database: $DB_PATH"

# Check if backup exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Confirm restore
echo ""
echo "WARNING: This will replace the current database!"
echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
sleep 5

# Stop the application gracefully (if running in-process)
echo "Preparing to restore..."

# Create a backup of current database before restoring
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
if [ -f "$DB_PATH" ]; then
    echo "Creating backup of current database..."
    cp "$DB_PATH" "$BACKUP_DIR/pre_restore_${TIMESTAMP}.db"
    echo "Pre-restore backup created"
fi

# Decompress backup if needed
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Decompressing backup..."
    RESTORE_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"
fi

# Verify backup integrity
echo "Verifying backup integrity..."
if ! sqlite3 "$RESTORE_FILE" "PRAGMA integrity_check;" | grep -q "ok"; then
    echo "ERROR: Backup file failed integrity check"
    rm -f "$RESTORE_FILE"
    exit 1
fi

# Restore database
echo "Restoring database..."
cp "$RESTORE_FILE" "$DB_PATH"

# Clean up temp file if we decompressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    rm -f "$RESTORE_FILE"
fi

# Verify restored database
echo "Verifying restored database..."
if sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "ok"; then
    echo "Database integrity: OK"
else
    echo "WARNING: Restored database may have issues"
fi

echo ""
echo "=== Restore complete ==="
echo "Please restart the application: fly apps restart exmud"

#!/bin/bash
# Database backup script for ExMUD on Fly.io
# Usage: fly ssh console -C "/app/scripts/backup_db.sh"
# Or: ./backup_db.sh (for local backups)

set -e

# Configuration
DB_PATH="${DATABASE_PATH:-/mnt/exmud_data/exmud.db}"
BACKUP_DIR="${BACKUP_DIR:-/mnt/exmud_data/backups}"
MAX_BACKUPS="${MAX_BACKUPS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="exmud_backup_${TIMESTAMP}.db"

echo "=== ExMUD Database Backup ==="
echo "Database: $DB_PATH"
echo "Backup dir: $BACKUP_DIR"
echo "Timestamp: $TIMESTAMP"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "ERROR: Database not found at $DB_PATH"
    exit 1
fi

# Create backup using SQLite's backup command (safe for live database)
echo "Creating backup..."
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/$BACKUP_NAME'"

# Verify backup
if [ -f "$BACKUP_DIR/$BACKUP_NAME" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)
    echo "Backup created: $BACKUP_NAME ($BACKUP_SIZE)"
else
    echo "ERROR: Backup failed"
    exit 1
fi

# Compress backup
echo "Compressing backup..."
gzip "$BACKUP_DIR/$BACKUP_NAME"
COMPRESSED_SIZE=$(du -h "$BACKUP_DIR/${BACKUP_NAME}.gz" | cut -f1)
echo "Compressed size: $COMPRESSED_SIZE"

# Rotate old backups (keep last MAX_BACKUPS)
echo "Rotating old backups (keeping last $MAX_BACKUPS)..."
cd "$BACKUP_DIR"
ls -t exmud_backup_*.db.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f

# List current backups
echo ""
echo "Current backups:"
ls -lh "$BACKUP_DIR"/exmud_backup_*.db.gz 2>/dev/null || echo "No backups found"

echo ""
echo "=== Backup complete ==="

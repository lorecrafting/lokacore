# Database Backup and Restore Guide

## Overview

ExMUD uses SQLite for data persistence, stored at `/mnt/exmud_data/exmud.db` on Fly.io.
Backups are stored in `/mnt/exmud_data/backups/` on the same volume.

## Automatic Backups

Daily backups are configured via GitHub Actions (`.github/workflows/backup.yml`):
- **Schedule**: Daily at 4 AM UTC
- **Retention**: Last 7 backups kept
- **Location**: `/mnt/exmud_data/backups/`

## Manual Backup

### Via Fly.io CLI

```bash
# SSH into the container and run backup
fly ssh console -a exmud -C "/app/scripts/backup_db.sh"

# Or interactively
fly ssh console -a exmud
/app/scripts/backup_db.sh
```

### Download Backup Locally

```bash
# List available backups
fly ssh console -a exmud -C "ls -lh /mnt/exmud_data/backups/"

# Download a specific backup
fly sftp get -a exmud /mnt/exmud_data/backups/exmud_backup_20250101_120000.db.gz ./

# Download all backups
fly sftp get -a exmud /mnt/exmud_data/backups/ ./backups/
```

## Restore from Backup

### On Fly.io

```bash
# List available backups
fly ssh console -a exmud -C "ls -lh /mnt/exmud_data/backups/"

# Restore from a specific backup (will auto-backup current DB first)
fly ssh console -a exmud -C "/app/scripts/restore_db.sh exmud_backup_20250101_120000.db.gz"

# Restart the application
fly apps restart exmud
```

### From Local Backup

```bash
# Upload backup to server
fly sftp shell -a exmud
put local_backup.db.gz /mnt/exmud_data/backups/
exit

# Restore
fly ssh console -a exmud -C "/app/scripts/restore_db.sh local_backup.db.gz"

# Restart
fly apps restart exmud
```

## Fly.io Volume Snapshots

Fly.io also provides volume-level snapshots for disaster recovery:

```bash
# List snapshots
fly volumes snapshots list -a exmud

# Create manual snapshot
fly volumes snapshots create <volume_id> -a exmud

# Restore from snapshot (creates new volume)
fly volumes create exmud_data_restored --snapshot-id <snapshot_id> -a exmud
```

## Disaster Recovery

### Complete Database Loss

1. **Stop the application**: `fly apps stop exmud`
2. **Restore from snapshot or backup**:
   - If volume intact: Use backup script
   - If volume lost: Restore from Fly.io snapshot
3. **Verify database integrity**:
   ```bash
   fly ssh console -a exmud -C "sqlite3 /mnt/exmud_data/exmud.db 'PRAGMA integrity_check;'"
   ```
4. **Restart**: `fly apps restart exmud`

### Recovery Time Objectives

- **RPO (Recovery Point Objective)**: 24 hours (daily backups)
- **RTO (Recovery Time Objective)**: ~15 minutes (restore + restart)

## Monitoring

Check backup status:
- GitHub Actions: See `.github/workflows/backup.yml` run history
- On server: `fly ssh console -a exmud -C "ls -lh /mnt/exmud_data/backups/"`

## Troubleshooting

### Backup Script Fails

1. Check disk space: `fly ssh console -a exmud -C "df -h"`
2. Check database integrity: `fly ssh console -a exmud -C "sqlite3 /mnt/exmud_data/exmud.db 'PRAGMA integrity_check;'"`
3. Check permissions: `fly ssh console -a exmud -C "ls -la /mnt/exmud_data/"`

### Restore Script Fails

1. Verify backup file exists and is not corrupted
2. Check disk space for restoration
3. Ensure application is stopped during restore

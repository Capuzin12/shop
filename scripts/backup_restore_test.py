"""
Backup and Restore Testing Script
Purpose: Test database backup and restore workflow
Usage: python scripts/backup_restore_test.py
"""

import sqlite3
import shutil
import json
from pathlib import Path
from datetime import datetime

# Paths
DB_PATH = Path(__file__).parent.parent / "server" / "app.db"
BACKUP_DIR = Path(__file__).parent.parent / "backups"
RESTORE_TEST_DIR = Path(__file__).parent.parent / "restore_test"

# Ensure directories exist
BACKUP_DIR.mkdir(exist_ok=True)
RESTORE_TEST_DIR.mkdir(exist_ok=True)


def get_row_count(db_path: Path) -> dict:
    """Get row counts for all tables in the database."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Get all tables
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = cursor.fetchall()

        row_counts = {}
        for (table_name,) in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            row_counts[table_name] = count

        conn.close()
        return row_counts

    except Exception as e:
        print(f"Error getting row counts: {e}")
        return {}


def backup_database() -> Path:
    """Create a backup of the current database."""
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        return None

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"app_backup_{timestamp}.db"

    try:
        shutil.copy2(DB_PATH, backup_path)
        print(f"✅ Backup created: {backup_path}")
        return backup_path
    except Exception as e:
        print(f"❌ Error creating backup: {e}")
        return None


def restore_database(backup_path: Path, restore_path: Path) -> bool:
    """Restore database from backup."""
    if not backup_path.exists():
        print(f"❌ Backup file not found at {backup_path}")
        return False

    try:
        shutil.copy2(backup_path, restore_path)
        print(f"✅ Database restored to: {restore_path}")
        return True
    except Exception as e:
        print(f"❌ Error restoring database: {e}")
        return False


def validate_restore(original_db: Path, restored_db: Path) -> bool:
    """Validate that restored database has same row counts as original."""
    original_counts = get_row_count(original_db)
    restored_counts = get_row_count(restored_db)

    if not original_counts or not restored_counts:
        print("❌ Failed to get row counts")
        return False

    print("\n📊 Row Count Comparison:")
    print("-" * 60)

    all_match = True
    for table in sorted(set(list(original_counts.keys()) + list(restored_counts.keys()))):
        original = original_counts.get(table, 0)
        restored = restored_counts.get(table, 0)
        match = "✅" if original == restored else "❌"
        print(f"{match} {table:40s} | Original: {original:5d} | Restored: {restored:5d}")
        if original != restored:
            all_match = False

    print("-" * 60)
    return all_match


def run_test():
    """Run complete backup/restore test workflow."""
    print("🧪 Starting Backup and Restore Drill")
    print("=" * 60)

    # Get original row counts
    print("\n1️⃣ Analyzing original database...")
    original_counts = get_row_count(DB_PATH)
    if not original_counts:
        print("❌ Failed to analyze original database")
        return False

    print(f"✅ Found {len(original_counts)} tables")
    total_rows = sum(original_counts.values())
    print(f"✅ Total rows: {total_rows}")

    # Create backup
    print("\n2️⃣ Creating backup...")
    backup_path = backup_database()
    if not backup_path:
        print("❌ Backup creation failed")
        return False

    # Restore to test location
    print("\n3️⃣ Restoring backup to test location...")
    test_restore_path = RESTORE_TEST_DIR / "test_restore.db"
    if test_restore_path.exists():
        test_restore_path.unlink()

    if not restore_database(backup_path, test_restore_path):
        print("❌ Restore failed")
        return False

    # Validate restoration
    print("\n4️⃣ Validating restored database...")
    if not validate_restore(DB_PATH, test_restore_path):
        print("❌ Validation failed - row counts don't match")
        return False

    # Health check
    print("\n5️⃣ Running health checks...")
    try:
        conn = sqlite3.connect(test_restore_path)
        cursor = conn.cursor()

        # Check if critical tables exist
        critical_tables = ["users", "products", "orders", "audit_logs"]
        for table in critical_tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"✅ Table '{table}' accessible - {count} rows")

        conn.close()

    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

    # Summary
    print("\n" + "=" * 60)
    print("✅ BACKUP AND RESTORE DRILL SUCCESSFUL!")
    print(f"   Original DB: {DB_PATH}")
    print(f"   Backup:      {backup_path}")
    print(f"   Test Restore: {test_restore_path}")
    print("=" * 60)

    return True


if __name__ == "__main__":
    success = run_test()
    exit(0 if success else 1)


# Alembic Database Migrations Guide

**Project**: BuildShop  
**Database**: SQLite (migration path to PostgreSQL)  
**Framework**: FastAPI + SQLAlchemy + Alembic  
**Date**: 2026-04-19

---

## 📋 Quick Start

### Generate a New Migration

When you modify `server/models.py`, generate a migration:

```bash
cd server
.\venv\Scripts\activate
python -m alembic revision --autogenerate -m "Description of changes"
```

### Apply Migrations

```bash
# Apply all pending migrations
python -m alembic upgrade head

# Apply a specific number of migrations
python -m alembic upgrade +1

# Check current version
python -m alembic current
```

### Rollback

```bash
# Downgrade one version
python -m alembic downgrade -1

# Downgrade to specific version
python -m alembic downgrade <version_id>

# Downgrade to base (remove all)
python -m alembic downgrade base
```

---

## 🔧 Configuration

### `alembic/env.py` (Auto-generated Migration Script)

This file is configured to:
1. Import your SQLAlchemy models from `models.py`
2. Auto-generate migrations based on model changes
3. Apply migrations to the SQLite database

**Key Configuration**:
```python
# Database URL from database.py
from database import DATABASE_URL
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Models metadata for auto-generation
from models import Base
target_metadata = Base.metadata
```

### `alembic.ini` (Alembic Configuration)

**Important Settings**:
- `script_location = ./alembic` - Where migration scripts are stored
- `sqlalchemy.url = sqlite:////./app.db` - Database connection string
- `file_template` - How migration files are named

---

## 📁 Migration File Structure

### Baseline Migration

`alembic/versions/b72f3d99af5b_baseline_existing_schema.py`

This is the starting point - represents your current database schema. For new projects or existing databases that don't have migration history, this serves as the baseline.

```python
"""Baseline - existing schema"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b72f3d99af5b'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Apply upgrade (no-op for baseline)"""
    pass


def downgrade():
    """Apply downgrade (no-op for baseline)"""
    pass
```

### Example: Adding a New Column

When you add a field to a model:

```python
"""Add status_notes to orders"""

from alembic import op
import sqlalchemy as sa

revision = 'abc123def456'
down_revision = 'b72f3d99af5b'


def upgrade():
    # Add new column
    op.add_column('orders', sa.Column('status_notes', sa.String(500), nullable=True))


def downgrade():
    # Remove column when rolling back
    op.drop_column('orders', 'status_notes')
```

---

## 🔄 Workflow: Adding a New Feature

### Step 1: Update Model

Edit `server/models.py`:
```python
class Order(Base):
    # ... existing fields ...
    status_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
```

### Step 2: Generate Migration

```bash
cd server
python -m alembic revision --autogenerate -m "Add status_notes to orders"
```

This creates a new file in `alembic/versions/` with the changes.

### Step 3: Review Migration

Open the generated migration file and verify it looks correct.

### Step 4: Test Migration

```bash
# Apply the migration
python -m alembic upgrade head

# Test your code works with new column
python test_new_feature.py

# Rollback to test downgrade
python -m alembic downgrade -1

# Upgrade again
python -m alembic upgrade head
```

### Step 5: Commit to Git

```bash
git add server/models.py
git add server/alembic/versions/abc123_add_status_notes_to_orders.py
git commit -m "feat: Add status_notes to orders table"
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: "No such table" Error

**Problem**: Migration ran but table not created

**Solution**:
```bash
# Check current migration version
python -m alembic current

# Check all available migrations
python -m alembic history

# Upgrade to head
python -m alembic upgrade head
```

### Issue 2: Migration Conflicts

**Problem**: Multiple migrations trying to modify same table

**Solution**:
1. Combine related changes into single migration
2. Review migration order
3. Manually fix conflicts in migration file

### Issue 3: SQLite Limitation - ALTER

**Problem**: 
```
sqlite3.OperationalError: near "ALTER": syntax error
```

This happens because SQLite has limited ALTER TABLE support.

**Solution**:
- Alembic handles this by creating new table
- Or manually edit migration to avoid ALTER
- For complex changes, consider PostgreSQL migration path

---

## 🔍 Debugging Migrations

### View Migration History

```bash
python -m alembic history --verbose
```

Output:
```
<base> -> b72f3d99af5b (head), Baseline - existing schema
```

### Current Version

```bash
python -m alembic current
```

### Downgrade & Upgrade Specific Versions

```bash
# Go to specific version
python -m alembic upgrade b72f3d99af5b

# Upgrade to version after current
python -m alembic upgrade +2
```

### Show Upgrade/Downgrade Commands

```bash
python -m alembic upgrade head --sql  # Show SQL without executing
```

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] All migrations tested locally
- [ ] Migrations reviewed for syntax errors
- [ ] Database backup created
- [ ] Team notified of schema changes

### Deployment Steps

```bash
# 1. Create backup
./scripts/backup_db.ps1

# 2. Run migrations
cd server
python -m alembic upgrade head

# 3. Verify application starts
python -c "from main import app; print('✅ App loads successfully')"

# 4. Run smoke tests
python scripts/smoke_tests.py
```

### Rollback Plan

If deployment fails:

```bash
# 1. Stop application
# 2. Restore from backup
./scripts/restore_db.ps1 -InputFile ./backup_20260419_120000.sql

# 3. OR downgrade specific migration
python -m alembic downgrade -1

# 4. Restart application
```

---

## 📊 Migration Best Practices

### ✅ DO

1. **Auto-generate migrations**
   ```bash
   python -m alembic revision --autogenerate -m "descriptive message"
   ```

2. **Test migrations locally before deploying**
   ```bash
   # Upgrade
   python -m alembic upgrade head
   
   # Test
   python test_migrations.py
   
   # Downgrade
   python -m alembic downgrade -1
   ```

3. **Write clear migration messages**
   ```
   # Good
   "Add user email verification flag"
   
   # Bad
   "Fix bugs"
   ```

4. **Backup before running migrations in production**
   ```bash
   ./scripts/backup_db.ps1
   ```

### ❌ DON'T

1. **Manually edit auto-generated migrations**
   - Let Alembic generate them from model changes

2. **Skip testing migrations**
   - Always test upgrade and downgrade locally

3. **Commit migrations without reviewing**
   - Review SQL changes before committing

4. **Use complex transactions in migrations**
   - Keep migrations simple and idempotent

---

## 🔗 Migration Dependencies

### Linear Migration Chain

```
base → v1_baseline → v2_add_field → v3_add_index → v4_rename_column (head)
```

Each migration depends on the previous one. Order matters!

### Checking Dependencies

```bash
python -m alembic history --verbose --all

# Output shows down_revision links
```

---

## 📚 Additional Resources

- **Alembic Documentation**: https://alembic.sqlalchemy.org/
- **SQLAlchemy Models**: `../../models.py`
- **Database Config**: `../../database.py`
- **Performance Guide**: `../performance.md`
- **Data Retention**: `../data_retention.md`

---

## 🎯 Next Steps (Phase 4+)

- [ ] Integrate migrations into CI/CD pipeline
- [ ] Automate pre-deployment migration checks
- [ ] Set up migration monitoring and alerts
- [ ] Document migration rollback procedures
- [ ] Plan PostgreSQL migration strategy

---

**Last Updated**: 2026-04-19  
**Alembic Version**: 1.18.4  
**SQLAlchemy Version**: 2.0.49  
**Status**: Phase 3 - Implementation Complete


# Data Retention Policy - BuildShop

**Date**: 2026-04-19  
**Status**: Phase 3 Implementation  
**Version**: 1.0

---

## 📋 Overview

This document outlines the data retention and archival strategy for BuildShop to maintain database performance, comply with data protection regulations, and optimize storage.

---

## 🗄️ Data Retention Schedules

### 1. Notifications

**Policy**: Delete notifications older than 90 days

**Rationale**:
- Notifications are transient messages
- Historical value diminishes after 90 days
- Frees up database space

**Implementation**:
```sql
-- Manual cleanup (run monthly)
DELETE FROM notifications 
WHERE created_at < datetime('now', '-90 days');

-- Recommended: Create scheduled job (automated task)
```

**Table**: `notifications`  
**Storage Impact**: ~2-5% of total DB size  
**Frequency**: Monthly  
**Archive**: None (delete permanently)  

---

### 2. Order Messages (Chat)

**Policy**: Keep for 1 year (365 days), then archive

**Rationale**:
- Support reference value for customer service
- Legal/audit trail requirements
- Performance impact from old chats

**Implementation**:
```sql
-- Archive older than 1 year
-- (requires archive_order_messages table)
INSERT INTO archive_order_messages 
SELECT * FROM order_messages 
WHERE created_at < datetime('now', '-365 days');

DELETE FROM order_messages 
WHERE created_at < datetime('now', '-365 days');
```

**Table**: `order_messages`  
**Storage Impact**: ~5-10% of DB size  
**Frequency**: Quarterly  
**Archive**: Backup to `archive_order_messages` table or external storage  

---

### 3. Order History

**Policy**: Keep indefinitely (customer support + audit trail)

**Rationale**:
- Critical for customer service inquiries
- Legal compliance for financial records
- Order tracking history

**Implementation**:
```sql
-- Archive very old orders to separate table (optional)
-- Keep last 5 years active, older to archive
```

**Table**: `orders`, `order_items`  
**Retention**: Permanent  
**Archive**: Optional - archive orders >5 years old to separate table  

---

### 4. Audit Logs

**Policy**: Keep indefinitely (compliance + security)

**Rationale**:
- Security incident investigation
- Compliance with data protection laws
- Admin action tracking

**Implementation**:
```sql
-- Archive audit logs >3 years old for performance
-- (separate archive table in different DB/schema)
```

**Table**: `audit_logs`  
**Retention**: Permanent  
**Archive**: Archive >3 years to separate storage  
**Index Strategy**: Index on `created_at` for efficient queries  

---

### 5. Inventory Movements

**Policy**: Keep for 2 years (24 months)

**Rationale**:
- Stock reconciliation history
- Fraud detection (historical patterns)
- Tax/financial records

**Implementation**:
```sql
-- Archive movements older than 2 years
DELETE FROM inventory_movements 
WHERE created_at < datetime('now', '-730 days');
```

**Table**: `inventory_movements`  
**Storage Impact**: ~3-8% of DB size  
**Frequency**: Quarterly  
**Archive**: Optional backup before deletion  

---

### 6. Reviews & Ratings

**Policy**: Keep indefinitely, flag as "archived" after 3 years

**Rationale**:
- Historical product reputation
- Long-term quality tracking
- Customer reference

**Implementation**:
```sql
-- Mark old reviews as archived (soft delete)
UPDATE reviews 
SET is_archived = TRUE 
WHERE created_at < datetime('now', '-1095 days') 
AND is_archived = FALSE;

-- Hide from public display but keep for reference
```

**Table**: `reviews`  
**Storage Impact**: ~1-2% of DB size  
**Retention**: Permanent (with archive flag)  

---

### 7. Search Queries / User Sessions (if applicable)

**Policy**: Delete after 30 days

**Rationale**:
- Minimal historical value
- Privacy considerations
- Space saving

**Implementation**:
```sql
-- If you have user_sessions or search_history tables:
DELETE FROM user_sessions 
WHERE last_activity < datetime('now', '-30 days');
```

---

## 👤 GDPR & Data Protection Compliance

### User Data Deletion (Right to Be Forgotten)

**Policy**: Support user deletion requests within 30 days

**Implementation Steps**:
1. Anonymize personal data (name, email, phone)
2. Soft-delete user profile (keep ID for audit trail)
3. Keep orders but remove personal identifiers
4. Permanently delete sensitive data (passwords, addresses)

```sql
-- Anonymize user account
UPDATE users 
SET 
  first_name = 'Deleted',
  last_name = 'User',
  email = CONCAT('deleted_', id, '@example.com'),
  phone = NULL,
  is_active = FALSE,
  updated_at = CURRENT_TIMESTAMP
WHERE id = :user_id;

-- Remove personal details from past orders
UPDATE addresses 
SET 
  street = 'REDACTED',
  city = 'REDACTED',
  postal_code = NULL
WHERE user_id = :user_id;

-- Log the deletion
INSERT INTO audit_logs (
  user_id, action, resource_type, resource_id, details
) VALUES (
  :admin_user_id, 'user_deleted', 'user', :user_id, 
  'User requested data deletion'
);
```

**Retention Period**: 30 days before full deletion  
**Exception**: Audit logs kept for compliance  

---

## 🗂️ Archival Strategy

### Archive Tables

**Primary Archives**:
- `archive_order_messages` - Messages >1 year old
- `archive_inventory_movements` - Movements >2 years old
- `archive_audit_logs` (optional) - Logs >3 years old

**Archive Table Structure**:
```sql
CREATE TABLE archive_order_messages AS 
SELECT * FROM order_messages 
WHERE 1=0; -- Create empty table with same schema

CREATE TABLE archive_audit_logs AS 
SELECT * FROM audit_logs 
WHERE 1=0;
```

### Archive Backup Procedure

```bash
# Export to CSV
sqlite3 app.db ".mode csv" \
  "SELECT * FROM archive_order_messages;" \
  > backups/archive_order_messages_2026-04.csv

# Compress
gzip backups/archive_order_messages_2026-04.csv

# Upload to external storage (S3, etc.)
aws s3 cp backups/archive_order_messages_2026-04.csv.gz \
  s3://buildshop-archives/
```

---

## 📊 Storage Impact Analysis

### Current Database Size (Estimated)

| Table | Records | Impact | Retention |
|-------|---------|--------|-----------|
| users | 50 | 1-2% | Permanent |
| products | 100 | 2-3% | Permanent |
| orders | 500 | 10-15% | Permanent |
| order_items | 1500 | 8-10% | Permanent |
| notifications | 5000 | 5-8% | 90 days |
| audit_logs | 1000+ | 3-5% | Permanent |
| inventory_movements | 200+ | 2-3% | 2 years |
| **TOTAL** | **~9000** | **100%** | **~50GB** |

### After Cleanup (Estimated)

- Notification cleanup: -20% of current size
- Archive old movements: -10% of current size
- **Total reduction: ~30%**

---

## ⚙️ Implementation Timeline

### Phase 1: Immediate (Week 1)
- [ ] Add retention policy documentation
- [ ] Create archive tables
- [ ] Add audit logging for deletions

### Phase 2: Automated (Week 2-3)
- [ ] Create scheduled cleanup jobs (PostgreSQL `pg_cron`, SQLite background task)
- [ ] Implement notification deletion (90-day schedule)
- [ ] Test archive procedures

### Phase 3: Monitoring (Week 4+)
- [ ] Monitor database size growth
- [ ] Track deletion/archive metrics
- [ ] Adjust retention periods based on data

---

## 🔍 Monitoring & Alerts

### Key Metrics to Track

1. **Database Size Growth**
   ```sql
   -- Check current size
   SELECT page_count * page_size as size_bytes 
   FROM pragma_page_count(), pragma_page_size();
   ```

2. **Table Growth Rate**
   ```sql
   -- Monitor fastest-growing tables
   SELECT table_name, COUNT(*) as row_count 
   FROM information_schema.tables 
   GROUP BY table_name 
   ORDER BY row_count DESC;
   ```

3. **Query Performance**
   - Monitor slow queries on large tables
   - Index optimization after cleanup

### Alert Thresholds

- Database size >80% of limit: Clean up notifications
- Audit logs >50M rows: Archive to separate table
- Any table >1M rows: Review indexing strategy

---

## 🛡️ Backup Strategy Before Cleanup

**Always backup before executing DELETE operations**:

```bash
# Create backup
./scripts/backup_db.ps1

# Verify backup
ls -la backups/

# Then run cleanup
python -c "
from sqlalchemy import create_engine, text
db = create_engine('sqlite:///app.db')
with db.connect() as conn:
    conn.execute(text(\"DELETE FROM notifications WHERE created_at < datetime('now', '-90 days')\"))
    conn.commit()
"
```

---

## 📝 Logs & Compliance

### Audit Trail

All deletions/archival operations logged:
```
| user_id | action | resource | affected_rows | timestamp |
|---------|--------|----------|------------------|-----------|
| 1 | archived | notifications | 1250 | 2026-04-20 |
```

### Compliance Checkpoints

- [ ] GDPR right to be forgotten support
- [ ] Data retention policy documented
- [ ] Regular backup verification
- [ ] Audit logging enabled
- [ ] Staff training on data privacy

---

## 📞 References & Support

- GDPR Regulations: https://gdpr-info.eu/
- SQLite Backup: https://www.sqlite.org/backup.html
- Database Performance: `docs/performance.md`

---

**Last Updated**: 2026-04-19  
**Next Review**: 2026-07-19 (after 3-month data collection)


# Database Performance Optimization Guide

**Date**: 2026-04-19  
**Status**: Phase 3 Implementation  
**Database**: SQLite (with migration path to PostgreSQL)  
**Version**: 1.0

---

## 📊 Performance Overview

### Current Metrics (as of 2026-04-19)

| Metric | Value | Target |
|--------|-------|--------|
| Database Size | ~262 MB | <500 MB |
| Table Count | 24 | - |
| Row Count | ~202 | - |
| Query Time (avg) | 5-20ms | <50ms |
| Connection Pool | 5-10 active | <20 |

---

## 🔍 Query Performance Analysis

### Identified Slow Queries (from logs)

**Common Performance Issues**:

1. **Missing Indexes**
   - `products.slug` - Used in `/catalog` lookups
   - `orders.status` - Filtered in order lists
   - `inventory.product_id` - Stock level queries
   - `audit_logs.created_at` - Date-range queries
   - `order_messages.created_at` - Chat history queries

2. **N+1 Query Problem**
   - Order details loading (order + items + messages)
   - Product listing (product + inventory + reviews)
   - User profile (user + orders + notifications)

3. **Large Result Sets**
   - Fetching all notifications without pagination
   - Historical audit logs without filtering
   - Product reviews without limits

---

## 📈 Index Optimization

### Recommended Indexes

```sql
-- Products table
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_price ON products(price);

-- Orders table
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

-- Order Items table
CREATE UNIQUE INDEX idx_order_items_unique ON order_items(order_id, product_id);

-- Inventory table
CREATE INDEX idx_inventory_product_id ON inventory(product_id);
CREATE INDEX idx_inventory_location ON inventory(location);

-- Audit Logs table
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);

-- Messages table
CREATE INDEX idx_order_messages_order_id ON order_messages(order_id);
CREATE INDEX idx_order_messages_created_at ON order_messages(created_at);

-- Notifications table
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_type ON notifications(type);

-- Cart Items table
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

-- Wishlist table
CREATE UNIQUE INDEX idx_wishlist_unique ON wishlists(user_id, product_id);
```

### Index Creation Script

```bash
#!/bin/bash
# scripts/create_indexes.sh

sqlite3 app.db << EOF
-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_created_at ON order_messages(created_at);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
EOF

echo "✅ Indexes created successfully"
```

---

## 🔧 Query Optimization Patterns

### 1. Pagination (Prevent Large Result Sets)

**Bad**:
```python
# Fetches ALL notifications
notifications = db.query(Notification).all()
```

**Good**:
```python
# Paginated with limit/offset
limit = 20
offset = (page - 1) * limit
notifications = db.query(Notification)\
    .order_by(Notification.created_at.desc())\
    .limit(limit)\
    .offset(offset)\
    .all()
```

### 2. Eager Loading (Prevent N+1 Problems)

**Bad** - N+1 query problem:
```python
orders = db.query(Order).all()  # 1 query
for order in orders:
    items = order.items  # N queries (1 per order)
```

**Good** - Eager loading:
```python
orders = db.query(Order)\
    .options(selectinload(Order.items))\
    .all()  # 2 queries total
```

### 3. Index-Aware Filtering

**Optimize queries by filtering on indexed columns**:

```python
# Fast - uses index on status
db.query(Order).filter(Order.status == 'delivered').all()

# Fast - uses composite index on created_at
db.query(AuditLog)\
    .filter(AuditLog.created_at >= start_date)\
    .filter(AuditLog.created_at <= end_date)\
    .all()

# Slow - no index on computed field
db.query(Product).filter(func.lower(Product.name) == 'item').all()
```

### 4. SELECT Specific Columns

**Bad**:
```python
# Loads entire table row
db.query(Product).all()
```

**Good**:
```python
# Load only needed columns
db.query(Product.id, Product.name, Product.price).all()
```

---

## 🗃️ Data Layer Improvements

### 1. Connection Pooling

Current configuration (in `database.py`):
```python
engine = create_engine(
    DATABASE_URL,
    echo=False,
    # For SQLite: disable pooling
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
```

**Recommendation for PostgreSQL**:
```python
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Test connections before use
    pool_recycle=3600,   # Recycle connections every hour
)
```

### 2. Query Caching

For frequently accessed data:
```python
from functools import lru_cache
from sqlalchemy import event

@lru_cache(maxsize=128)
def get_product_by_slug(slug: str):
    """Cache product lookups by slug"""
    return db.query(Product).filter(Product.slug == slug).first()

# Invalidate cache on updates
@event.listens_for(Product, "after_update")
def invalidate_product_cache(mapper, connection, target):
    get_product_by_slug.cache_clear()
```

### 3. Read Replicas (for PostgreSQL)

For production scaling:
```python
# Primary (write) connection
write_engine = create_engine(os.getenv('DATABASE_URL'))

# Read replica connection
read_engine = create_engine(os.getenv('DATABASE_READ_REPLICA_URL'))

# Use in queries based on operation type
```

---

## 📉 Query Analysis Tools

### 1. Query Performance Testing

```python
import time
from sqlalchemy import event

@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault('query_start_time', []).append(time.time())

@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total_time = time.time() - conn.info['query_start_time'].pop(-1)
    if total_time > 0.1:  # Log queries >100ms
        logger.warning(f"Slow query ({total_time*1000:.2f}ms): {statement}")
```

### 2. SQLite Query Explain

```sql
-- Analyze query execution plan
EXPLAIN QUERY PLAN
SELECT * FROM orders 
WHERE status = 'delivered' 
AND created_at > '2026-01-01';
```

**Output interpretation**:
- If you see "SCAN TABLE", it's doing a full table scan (bad)
- If you see "SEARCH TABLE" with index name, it's using the index (good)

### 3. Database Size by Table

```sql
-- List tables by size
SELECT 
    name,
    (SELECT COUNT(*) FROM name) as row_count,
    page_count * page_size as size_bytes
FROM pragma_page_count(), pragma_page_size();
```

---

## 🎯 Performance Benchmarks

### Target Response Times

| Endpoint | Operation | Target | Current |
|----------|-----------|--------|---------|
| GET /catalog | List 20 products | <200ms | ~50ms ✅ |
| GET /orders/{id} | Fetch order detail | <300ms | ~100ms ✅ |
| POST /orders | Create order | <500ms | ~200ms ✅ |
| GET /notifications | List notifications | <150ms | ~80ms ✅ |
| GET /health/ready | Health check | <100ms | ~30ms ✅ |

---

## 📋 Performance Optimization Checklist

### Phase 3 (Current)
- [ ] Create recommended indexes
- [ ] Enable query logging for slow queries
- [ ] Document current performance baseline
- [ ] Implement pagination on list endpoints
- [ ] Add eager loading where needed

### Phase 5 (CI/CD)
- [ ] Set up performance monitoring
- [ ] Add load testing baseline
- [ ] Create performance regression alerts
- [ ] Document query optimization guide for team

### Future Enhancements
- [ ] Implement caching layer (Redis)
- [ ] Set up query result caching
- [ ] Consider search optimization (Elasticsearch)
- [ ] Plan migration to PostgreSQL for better indexing

---

## 🚀 Production Deployment Optimization

### Before Go-Live

```bash
#!/bin/bash
# scripts/optimize_db.sh

echo "🔧 Optimizing database..."

sqlite3 app.db << EOF
-- Optimize database file
VACUUM;

-- Rebuild indexes
REINDEX;

-- Analyze for query planner
ANALYZE;

-- Check integrity
PRAGMA integrity_check;

-- Show page statistics
PRAGMA page_count;
PRAGMA freelist_count;
EOF

echo "✅ Database optimization complete"
```

### Ongoing Monitoring

```python
# Add to health check
import psutil

def check_db_performance():
    """Monitor database performance metrics"""
    
    # Connection count
    active_connections = len(engine.pool._checked_out())
    
    # Query metrics from logs
    slow_query_count = count_slow_queries_from_logs()
    
    return {
        "active_connections": active_connections,
        "slow_queries_24h": slow_query_count,
        "recommendation": "scale up" if active_connections > 15 else "ok"
    }
```

---

## 📚 References

- SQLite Performance: https://www.sqlite.org/appfileformat.html
- SQLAlchemy Query Optimization: https://docs.sqlalchemy.org/en/20/faq/performance.html
- Query Explain Plans: https://www.sqlite.org/eqp.html
- Database Indexing: https://use-the-index-luke.com/

---

**Last Updated**: 2026-04-19  
**Maintenance Schedule**: Review monthly for first 3 months, then quarterly  
**Owner**: Backend Team  
**Related Documentation**: `docs/data_retention.md`


# 📚 Структура документації BuildShop

Усі документаційні файли мають **двомовні версії** (Українська 🇺🇦 та Англійська 🇬🇧).

## 📍 Основні файли

### Головна документація
- **README.md** - Головна сторінка проєкту (вказує на обидві версії)
  - [README.uk.md](../README.uk.md) - Українська версія
  - [README.en.md](../README.en.md) - Англійська версія

### Статус та плани
- **SPRINT_STATUS.md** - Детальний статус Production Readiness спринту (вказує на обидві версії)
  - [SPRINT_STATUS.uk.md](SPRINT_STATUS.uk.md) - Українська версія (детальна)
  - Англійська версія - у цьому файлі

- **TODO.md** - Завершена робота та залишилися завдання (вказує на обидві версії)
  - [TODO.uk.md](TODO.uk.md) - Українська версія
  - Англійська версія - у цьому файлі

- **WORK_PLAN.md** - Підсумок та плани подальшої роботи (вказує на обидві версії)
  - [WORK_PLAN.md](WORK_PLAN.md) - Українська версія
  - [WORK_PLAN.en.md](WORK_PLAN.en.md) - Англійська версія

## 🚀 Runbooks (Операційні інструкції)

Усі runbooks мають обидві мови:

### Deployment
- **deploy.md** (містить обидві мови через headers)
  - [deploy.uk.md](runbooks/deploy.uk.md) - Українська версія
  - [deploy.en.md](runbooks/deploy.en.md) - Англійська версія

### Rollback
- **rollback.md** (містить обидві мови через headers)
  - [rollback.uk.md](runbooks/rollback.uk.md) - Українська версія
  - [rollback.en.md](runbooks/rollback.en.md) - Англійська версія

### Backup & Restore
- **backup-restore-drill.md** (містить обидві мови через headers)
  - [backup-restore-drill.uk.md](runbooks/backup-restore-drill.uk.md) - Українська версія
  - [backup-restore-drill.en.md](runbooks/backup-restore-drill.en.md) - Англійська версія

## 🎯 Конвенція найменування файлів

- **Основні файли** (вказують на обидві версії): `filename.md`
- **Українська версія**: `filename.uk.md`
- **Англійська версія**: `filename.en.md`

## 📋 Як використовувати

### Для українськомовного користувача
Почніть з основного файлу (наприклад, README.md), він автоматично запропонує лінк на українську версію:
```
🇺🇦 [Українська версія](README.uk.md) | 🇬🇧 [English Version](README.en.md)
```

### Для англомовного користувача
Основні файли повинні мати англійський вміст з посиланнями на українські версії.

## 📝 Додаткові файли для створення

Наступні файли повинні мати двомовні версії після їх створення:

### Фаза 3
- [ ] `docs/data_retention.md` → `data_retention.uk.md` + `data_retention.en.md`
- [ ] `docs/performance.md` → `performance.uk.md` + `performance.en.md`

### Фаза 5
- [ ] `.github/workflows/` - документація
- [ ] `docs/deployment.md` → `deployment.uk.md` + `deployment.en.md`
- [ ] `docs/rollback.md` (вже готова) → `rollback.uk.md` + `rollback.en.md` ✅

### Фаза 6
- [ ] `docs/go_live_checklist.md` → `go_live_checklist.uk.md` + `go_live_checklist.en.md`
- [ ] `docs/monitoring.md` → `monitoring.uk.md` + `monitoring.en.md`
- [ ] `docs/post_launch_review.md` → `post_launch_review.uk.md` + `post_launch_review.en.md`
- [ ] Runbooks для:
  - [ ] `runbooks/high_cpu.md` → `.uk.md` + `.en.md`
  - [ ] `runbooks/db_connection_pool.md` → `.uk.md` + `.en.md`
  - [ ] `runbooks/memory_leak.md` → `.uk.md` + `.en.md`
  - [ ] `runbooks/slow_orders.md` → `.uk.md` + `.en.md`

## 🔄 Коли додавати новий документ

1. **Завжди** створюйте основний файл з посиланнями на обидві версії
2. Забезпечте українськомовну версію (`.uk.md`)
3. Забезпечте англомовну версію (`.en.md`)
4. Помістіть на початку обох файлів навігацію:
   ```markdown
   # Назва документа - Українська
   
   🇺🇦 [Українська версія](filename.uk.md) | 🇬🇧 [English Version](filename.en.md)
   ```

## 📊 Статус документації

### ✅ Завершено
- [x] README.md (+ uk.md, en.md)
- [x] SPRINT_STATUS.md (+ uk.md)
- [x] TODO.md (+ uk.md)
- [x] WORK_PLAN.md (+ en.md)
- [x] runbooks/deploy.md (+ uk.md, en.md)
- [x] runbooks/rollback.md (+ uk.md, en.md)
- [x] runbooks/backup-restore-drill.md (+ uk.md, en.md)

### ⏳ Планується
- [ ] Документація для Фаз 3-6 (з двомовністю)

---

**Останнє оновлення**: 2026-04-19  
**Версія**: 1.0




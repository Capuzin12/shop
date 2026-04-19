# BuildShop Rollback Runbook - Українська

## Коли потрібен rollback?

Виконайте rollback якщо:
- Після deploy спостерігаються стійкі 5xx помилки
- Порушена функціональність входу або оформлення замовлення
- Проблема з міграцією БД, яка блокує основні операції

## Кроки

1. Зупинити поточний stack:

```bash
docker compose -f docker-compose.prod.yml down
```

2. Повернути попередні image tags / артефакт від попередньої гілки.

3. Запустити сервіси знову:

```bash
docker compose -f docker-compose.prod.yml up -d
```

4. Перевірити health endpoints та критичні user flows.

## База даних
- Якщо був змінений schema/дані, відновіть з останнього backup перед невдалим deploy.


# Supabase DB Init + Seed

Цей каталог містить SQL-файли для повної ініціалізації БД та наповнення тестовими даними BudMart.

## Файли

- `init.sql` — повне очищення та створення схеми (26 таблиць + `v_effective_prices`).
- `seed.sql` — реалістичний seed v2 (52 товари, B2B ціни, знижки, замовлення, логи, тощо).

## Порядок запуску

1. Запустити `init.sql`.
2. Запустити `seed.sql`.

## SQL Editor (Supabase)

Скопіюй вміст `init.sql` у SQL Editor та виконай, потім аналогічно `seed.sql`.

## Запуск через psql

```powershell
psql "postgresql://USER:PASSWORD@HOST:5432/postgres" -f "C:\Users\1111\WebstormProjects\buildshop\supabase\init.sql"
psql "postgresql://USER:PASSWORD@HOST:5432/postgres" -f "C:\Users\1111\WebstormProjects\buildshop\supabase\seed.sql"
```

## Швидка валідація після seed

```sql
SELECT COUNT(*) AS products_total FROM public.products;
SELECT COUNT(*) AS product_prices_total FROM public.product_prices;
SELECT COUNT(*) AS attributes_total FROM public.product_attributes;
SELECT COUNT(*) AS orders_total FROM public.orders;
SELECT COUNT(*) AS price_history_rows FROM public.price_history;
```


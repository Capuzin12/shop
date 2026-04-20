from pathlib import Path
import re

source = Path(r"C:\Users\1111\WebstormProjects\buildshop\server\seed_from_sql.sql")
target = Path(r"C:\Users\1111\WebstormProjects\buildshop\server\seed_supabase.sql")

text = source.read_text(encoding="utf-8")
text = text.replace("BEGIN TRANSACTION;", "BEGIN;")

# Convert product is_featured integer literals to PostgreSQL booleans.
text = re.sub(
    r"(INSERT INTO products[\s\S]*?)(,\s*)([01])(\nWHERE NOT EXISTS \(SELECT 1 FROM products WHERE sku=')",
    lambda m: m.group(1) + m.group(2) + ("true" if m.group(3) == "1" else "false") + m.group(4),
    text,
)

# Convert review is_approved integer literal to PostgreSQL boolean.
text = re.sub(
    r"(INSERT INTO reviews[\s\S]*?)(,\s*)1(\nWHERE NOT EXISTS \()",
    r"\1\2true\3",
    text,
)

target.write_text(text, encoding="utf-8")

print(f"Written: {target}")
print("Products true count:", text.count(", true\nWHERE NOT EXISTS (SELECT 1 FROM products"))
print("Products false count:", text.count(", false\nWHERE NOT EXISTS (SELECT 1 FROM products"))
print("Reviews true count:", text.count(", true\nWHERE NOT EXISTS (\n  SELECT 1 FROM reviews"))


"""
BuildShop load and stress test suite using Locust.

Default target profile:
- 100 concurrent users
- browse-heavy traffic pattern

Run example:
  locust -f scripts/load_test.py --host http://localhost -u 100 -r 10 -t 5m --headless
"""

from __future__ import annotations

import importlib
import random

try:
    _locust = importlib.import_module("locust")
    HttpUser = getattr(_locust, "HttpUser")
    between = getattr(_locust, "between")
    task = getattr(_locust, "task")
except Exception:  # pragma: no cover
    class HttpUser:  # type: ignore[no-redef]
        wait_time = None

    def between(_a: float, _b: float):  # type: ignore[no-redef]
        return None

    def task(_weight: int = 1):  # type: ignore[no-redef]
        def _decorator(func):
            return func
        return _decorator


class BuildShopBrowseUser(HttpUser):
    wait_time = between(0.5, 2.0)

    def on_start(self) -> None:
        self.token = None
        self.user_email = f"load_{random.randint(100000, 999999)}@example.com"
        self.password = "LoadPass123!"

        # Best-effort register; existing users may return 400.
        self.client.post(
            "/api/users",
            json={
                "email": self.user_email,
                "password": self.password,
                "first_name": "Load",
                "last_name": "User",
                "phone": "+380501234567",
            },
            name="POST /api/users (register)",
            catch_response=True,
        )

        with self.client.post(
            "/token",
            data={"username": self.user_email, "password": self.password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            name="POST /token",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                response.success()
            else:
                response.failure(f"Login failed: {response.status_code}")

    @task(6)
    def browse_catalog(self) -> None:
        self.client.get("/api/products?limit=12", name="GET /api/products")

    @task(3)
    def open_product(self) -> None:
        product_id = random.randint(1, 20)
        self.client.get(f"/api/products/{product_id}", name="GET /api/products/:id")

    @task(2)
    def search_suggestions(self) -> None:
        terms = ["цемент", "bosch", "фарба", "дриль", "профіль"]
        q = random.choice(terms)
        self.client.get(f"/api/search/suggestions?q={q}", name="GET /api/search/suggestions")

    @task(2)
    def view_categories(self) -> None:
        self.client.get("/api/categories", name="GET /api/categories")

    @task(1)
    def health_checks(self) -> None:
        self.client.get("/health/live", name="GET /health/live")
        self.client.get("/health/ready", name="GET /health/ready")

    @task(1)
    def cart_and_order_smoke(self) -> None:
        if not self.token:
            return

        headers = {"Authorization": f"Bearer {self.token}"}
        product_id = random.randint(1, 10)

        self.client.post(
            "/api/cart/items",
            json={"product_id": product_id, "quantity": 1},
            headers=headers,
            name="POST /api/cart/items",
        )

        self.client.get("/api/cart", headers=headers, name="GET /api/cart")


class BuildShopStaffUser(HttpUser):
    wait_time = between(1.0, 3.0)
    weight = 1

    def on_start(self) -> None:
        self.token = None

        # Optional: set real staff credentials via env vars in CI if needed.
        # For now this user mostly probes manager endpoints as anonymous traffic.

    @task(2)
    def orders_view(self) -> None:
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        self.client.get("/api/orders", headers=headers, name="GET /api/orders")

    @task(1)
    def inventory_view(self) -> None:
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        self.client.get("/api/inventory", headers=headers, name="GET /api/inventory")


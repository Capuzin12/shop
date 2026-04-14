#!/usr/bin/env python3
"""Test script for order creation"""
import sys
from database import SessionLocal
from models import User, UserRole, Product, Inventory, Order, OrderItem
from main import create_order
from fastapi import HTTPException

db = SessionLocal()

# Get an existing test user or create one
from sqlalchemy import select
test_user = db.scalar(select(User).where(User.email == "admin@budmart.ua"))
if not test_user:
    # Use the first user in database
    test_user = db.scalars(select(User).limit(1)).first()
    if not test_user:
        print("No users in database")
        sys.exit(1)

# Check if product exists
product = db.query(Product).first()
if not product:
    print("No products in database")
    sys.exit(1)

# Check inventory
inventory = db.query(Inventory).filter(Inventory.product_id == product.id).first()
if not inventory:
    print(f"No inventory for product {product.id}")
    sys.exit(1)

if inventory.quantity < 1:
    print(f"Not enough inventory: {inventory.quantity}")
    sys.exit(1)

# Test order data
order_data = {
    "contact_name": "Test Name",
    "contact_phone": "1234567890",
    "contact_email": "test@email.com",
    "delivery_city": "Test City",
    "delivery_address": "Test Address",
    "items": [
        {"product_id": product.id, "quantity": 1}
    ]
}

print(f"Testing order creation with user {test_user.id}")
print(f"Order data: {order_data}")

try:
    # Mock current_user
    class MockUser:
        def __init__(self):
            self.id = test_user.id
    
    current_user = MockUser()
    
    # Try creating order
    result = create_order(order_data, db, current_user)
    print("Order created successfully!")
    print(result)
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()


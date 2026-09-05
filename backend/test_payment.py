import sys
import os
import hmac
import hashlib
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.database import Base
from app.models.user import User
from app.models.product import Product
from app.models.cart import Cart, CartItem
from app.models.order import Order
from app.services import db_service, payment_service

def setup_test_db():
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Add product
    prod = Product(
        id=1,
        name="Sennheiser HD 250BT",
        category="Electronics",
        price=2999.0,
        rating=4.3,
        reviews_count=940,
        description="Wireless headphones",
        specifications={"Battery Life": "25 Hours"},
        stock=25
    )
    db.add(prod)

    # Add user
    user = User(id=1, username="demo_user")
    db.add(user)
    db.commit()

    # Add cart item
    db_service.add_product_to_cart(db, user_id=1, product_id=1, quantity=1)
    return db

def test_order_creation(db):
    print("Testing Razorpay Order Creation...")
    order_data = payment_service.create_checkout_order(db, user_id=1, allow_mock=True)
    assert order_data["amount"] == 2999.0, f"Expected amount 2999.0, got {order_data['amount']}"
    assert order_data["amount_paise"] == 299900
    assert order_data["currency"] == "INR"
    assert order_data["razorpay_order_id"] is not None
    assert len(order_data["items"]) == 1
    print(f"  [OK] Order Created: #{order_data['order_id']} | Razorpay Order ID: {order_data['razorpay_order_id']}")
    return order_data

def test_signature_verification(db, order_data):
    print("Testing Backend HMAC SHA256 Signature Verification...")
    order_id = order_data["order_id"]
    rzp_order_id = order_data["razorpay_order_id"]
    rzp_pay_id = "pay_test_9988776655"
    
    secret = payment_service.RAZORPAY_KEY_SECRET
    msg = f"{rzp_order_id}|{rzp_pay_id}"
    valid_signature = hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()

    result = payment_service.verify_payment_signature(
        db,
        order_id=order_id,
        razorpay_order_id=rzp_order_id,
        razorpay_payment_id=rzp_pay_id,
        razorpay_signature=valid_signature
    )

    assert result["status"] == "paid"
    assert result["razorpay_payment_id"] == rzp_pay_id

    # Verify cart was cleared
    cart = db_service.get_user_cart(db, user_id=1)
    assert len(cart.items) == 0, "Cart should be empty after payment completion"
    print("  [OK] Payment verified & cart cleared!")

def test_cancellation_and_failure(db):
    print("Testing Order Cancellation & Failure Handling...")
    # Add an item to cart and create another order
    db_service.add_product_to_cart(db, user_id=1, product_id=1, quantity=1)
    order_data2 = payment_service.create_checkout_order(db, user_id=1, allow_mock=True)
    
    cancel_res = payment_service.mark_payment_cancelled(db, order_data2["order_id"])
    assert cancel_res["status"] == "cancelled"
    print("  [OK] Order cancellation verified!")

    order_data3 = payment_service.create_checkout_order(db, user_id=1, allow_mock=True)
    fail_res = payment_service.mark_payment_failed(db, order_data3["order_id"], "Card declined")
    assert fail_res["status"] == "failed"
    print("  [OK] Order failure handling verified!")

def test_audit_trail(db):
    print("Testing Order Audit Trail Retrieval...")
    history = payment_service.get_order_audit_trail(db, user_id=1)
    assert len(history) >= 3, f"Expected at least 3 historical orders, got {len(history)}"
    statuses = [h["status"] for h in history]
    assert "paid" in statuses and "cancelled" in statuses and "failed" in statuses
    print(f"  [OK] Audit Trail retrieved {len(history)} entries with statuses: {statuses}")

def run_all_tests():
    db = setup_test_db()
    try:
        order_data = test_order_creation(db)
        test_signature_verification(db, order_data)
        test_cancellation_and_failure(db)
        test_audit_trail(db)
        
        is_real = order_data.get("order_source") == "RAZORPAY_API" or (
            order_data.get("razorpay_order_id", "").startswith("order_") and 
            not order_data.get("razorpay_order_id", "").startswith("order_test_")
        )

        if is_real:
            print("\n========================================================")
            print("  REAL RAZORPAY TEST MODE VERIFICATION SUCCESSFUL")
            print(f"  Real Razorpay Order ID: {order_data['razorpay_order_id']}")
            print("========================================================\n")
        else:
            print("\n========================================================")
            print("  MOCK MODE — NOT A REAL RAZORPAY PAYMENT")
            print("  Placeholder credentials detected in backend/.env")
            print("  Fallback test mode order ID used for local testing.")
            print("========================================================\n")
    finally:
        db.close()

if __name__ == "__main__":
    run_all_tests()

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
from app.services import db_service, agent_service, payment_service
from app.routes.cart import format_cart_response

def run_full_flow_test():
    print("\n--- RUNNING FULL AI-AGENT TO RAZORPAY CHECKOUT FLOW VERIFICATION TEST ---")
    
    # 1. Setup in-memory DB and seed products
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Seed mock catalog
    products = [
        Product(
            id=1,
            name="boAt Rockerz 450 Wireless",
            category="Electronics",
            price=1499.0,
            rating=4.1,
            reviews_count=1820,
            description="On-ear wireless headphones with 15h battery",
            specifications={"Battery Life": "15 Hours", "ANC": "No"},
            stock=50
        ),
        Product(
            id=2,
            name="Sennheiser HD 250BT",
            category="Electronics",
            price=2999.0,
            rating=4.3,
            reviews_count=940,
            description="Wireless headphones with 25h battery",
            specifications={"Battery Life": "25 Hours", "ANC": "No"},
            stock=25
        ),
        Product(
            id=3,
            name="Sony WH-CH520 Wireless",
            category="Electronics",
            price=3499.0,
            rating=4.5,
            reviews_count=1250,
            description="On-ear wireless headphones with 50h battery",
            specifications={"Battery Life": "50 Hours", "ANC": "No"},
            stock=40
        )
    ]
    for p in products:
        db.add(p)
        
    user = User(id=1, username="demo_user")
    db.add(user)
    db.commit()
    
    cart = Cart(id=1, user_id=1)
    db.add(cart)
    db.commit()
    
    # Step 1: Submit wireless headphones query
    print("Step 1: Submitting natural language wireless headphones query...")
    query1 = "I need wireless headphones under ₹3,000 for studying with good battery."
    res1 = agent_service.run_demo_agent(db, user_id=1, message=query1)
    
    rec = res1.get("recommended_product")
    assert rec is not None, "Recommendation should not be None"
    assert rec["name"] == "Sennheiser HD 250BT", f"Expected Sennheiser HD 250BT, got {rec['name']}"
    assert rec["price"] <= 3000.0, "Price must be under ₹3,000"
    rec_id = rec["id"]
    print(f"  [OK] Received AI Recommendation: {rec['name']} (Rs. {rec['price']:.2f}, {rec['ai_score']}%)")
    
    # Step 2: Add recommendation to cart via natural language chat query
    print("\nStep 2: Submitting 'Add the recommendation to cart' query...")
    query2 = "Add the recommendation to cart"
    res2 = agent_service.run_demo_agent(db, user_id=1, message=query2, last_recommended_id=rec_id)
    
    action = res2.get("action_performed")
    assert action["type"] == "add_to_cart", f"Action type should be add_to_cart, got {action['type']}"
    assert action["product_id"] == rec_id, f"Added product ID should match {rec_id}"
    print(f"  [OK] Agent Action: {action['message']}")
    
    # Step 3: Verify Cart Count and Cart Subtotal
    print("\nStep 3: Verifying Cart & Dashboard State...")
    cart_res = format_cart_response(db, user_id=1)
    items_count = sum(item["quantity"] for item in cart_res["items"])
    subtotal = cart_res["subtotal"]
    
    assert items_count == 1, f"Expected cart items count 1, got {items_count}"
    assert subtotal == 2999.0, f"Expected cart subtotal 2999.0, got {subtotal}"
    print(f"  [OK] Cart Items Count: {items_count}")
    print(f"  [OK] Cart Subtotal: Rs. {subtotal:,.2f}")
    print(f"  [OK] Free Delivery Unlocked: {cart_res['delivery_fee'] == 0.0}")

    # Step 4: Initiate Razorpay Test Mode Order Creation
    print("\nStep 4: Creating Razorpay Order from Backend...")
    order_data = payment_service.create_checkout_order(db, user_id=1, allow_mock=True)
    assert order_data["amount"] == 2999.0
    assert order_data["amount_paise"] == 299900
    assert order_data["razorpay_order_id"] is not None
    assert order_data["key_id"] is not None
    print(f"  [OK] Order Created: #SG-ORD-{order_data['order_id']} | Razorpay Order: {order_data['razorpay_order_id']}")

    # Step 5: Verify Backend HMAC SHA256 Payment Signature & Audit Trail
    print("\nStep 5: Verifying Backend HMAC SHA256 Signature & Order Audit Trail...")
    order_id = order_data["order_id"]
    rzp_order_id = order_data["razorpay_order_id"]
    rzp_pay_id = "pay_test_9988776655"
    
    secret = payment_service.RAZORPAY_KEY_SECRET
    msg = f"{rzp_order_id}|{rzp_pay_id}"
    valid_signature = hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()

    verify_res = payment_service.verify_payment_signature(
        db,
        order_id=order_id,
        razorpay_order_id=rzp_order_id,
        razorpay_payment_id=rzp_pay_id,
        razorpay_signature=valid_signature
    )
    assert verify_res["status"] == "paid"

    # Confirm cart cleared after payment
    fresh_cart = format_cart_response(db, user_id=1)
    assert len(fresh_cart["items"]) == 0, "Cart should be empty after verified payment"

    # Confirm audit trail entry
    audit_trail = payment_service.get_order_audit_trail(db, user_id=1)
    assert len(audit_trail) == 1
    assert audit_trail[0]["status"] == "paid"
    assert audit_trail[0]["amount"] == 2999.0
    print(f"  [OK] Payment Signature Verified: {verify_res['message']}")
    print(f"  [OK] Cart Cleared Post-Payment: {len(fresh_cart['items'])} items")
    print(f"  [OK] Payment Audit Trail Recorded: Order #SG-ORD-{audit_trail[0]['order_id']} [{audit_trail[0]['status'].upper()}]")
    
    is_real = order_data.get("order_source") == "RAZORPAY_API" or (
        order_data.get("razorpay_order_id", "").startswith("order_") and 
        not order_data.get("razorpay_order_id", "").startswith("order_test_")
    )

    if is_real:
        print("\n========================================================")
        print("  REAL RAZORPAY TEST MODE — FULL FLOW VERIFIED 100%")
        print(f"  Real Razorpay Order ID: {order_data['razorpay_order_id']}")
        print("========================================================\n")
    else:
        print("\n========================================================")
        print("  MOCK MODE — NOT A REAL RAZORPAY PAYMENT")
        print("  Placeholder credentials detected in backend/.env")
        print("  Full flow verified using mock test mode simulator.")
        print("========================================================\n")

if __name__ == "__main__":
    run_full_flow_test()

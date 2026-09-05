import os
import hmac
import hashlib
import json
import httpx
from datetime import datetime
from pathlib import Path
import dotenv
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional

# Ensure backend/.env environment variables are loaded
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    dotenv.load_dotenv(dotenv_path=env_path)
else:
    dotenv.load_dotenv()

from app.models.order import Order
from app.services import db_service
from app.routes.cart import format_cart_response

def get_razorpay_credentials():
    """
    Reads Razorpay Test Mode credentials from backend/.env only.
    No placeholder/fake defaults: if unset, callers must treat this as
    "not configured" and fail explicitly rather than silently using a
    fake key that Razorpay will reject with 401.
    """
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
    return key_id, key_secret

RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET = get_razorpay_credentials()

def create_checkout_order(db: Session, user_id: int, allow_mock: bool = False) -> Dict[str, Any]:
    """
    Creates a new checkout order from current user cart and initializes Razorpay Test Order via official Razorpay API.
    If Razorpay API returns an error during web checkout, raises a ValueError detailing the HTTP error instead of silently generating a fake order ID.
    """
    cart_data = format_cart_response(db, user_id)
    if not cart_data["items"]:
        raise ValueError("Shopping cart is empty. Add items before checking out.")

    amount = cart_data["total"]
    amount_paise = int(round(amount * 100))

    # 1. Save pending Order record in Database
    new_order = Order(
        user_id=user_id,
        amount=amount,
        currency="INR",
        status="created",
        items_summary=cart_data["items"]
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # 2. Attempt Razorpay API order creation using Razorpay Test Mode API
    key_id, key_secret = get_razorpay_credentials()
    rzp_order_id = None
    order_source = "MOCK_FALLBACK"
    api_err_msg = None
    http_status = None

    if key_id and key_secret:
        try:
            with httpx.Client(timeout=25.0) as client:
                resp = client.post(
                    "https://api.razorpay.com/v1/orders",
                    auth=(key_id, key_secret),
                    json={
                        "amount": amount_paise,
                        "currency": "INR",
                        "receipt": f"receipt_sg_{new_order.id}",
                        "notes": {
                            "user_id": str(user_id),
                            "shopgenie_order_id": str(new_order.id)
                        }
                    }
                )
                http_status = resp.status_code
                if resp.status_code in (200, 201):
                    rzp_data = resp.json()
                    rzp_order_id = rzp_data.get("id")
                    order_source = "RAZORPAY_API"
                    print("REAL RAZORPAY ORDER CREATION")
                    print(f"HTTP status: {resp.status_code}")
                    print(f"Razorpay order ID: {rzp_order_id}")
                    print("Order source: RAZORPAY_API")
                else:
                    err_json = {}
                    try:
                        err_json = resp.json().get("error", {})
                    except Exception:
                        pass
                    api_err_msg = err_json.get("description") or resp.text
                    if resp.status_code == 401:
                        api_err_msg = (
                            "Razorpay rejected the Key ID / Key Secret (401 Authentication failed). "
                            "The credentials in backend/.env are not valid Razorpay TEST MODE keys. "
                            f"Underlying detail: {api_err_msg}"
                        )
                    print("REAL RAZORPAY ORDER CREATION")
                    print(f"HTTP status: {resp.status_code}")
                    print("Razorpay order ID: None")
                    print(f"Error detail: {api_err_msg}")
        except Exception as e:
            api_err_msg = str(e)
            print("REAL RAZORPAY ORDER CREATION")
            print("HTTP status: Connection Error")
            print("Razorpay order ID: None")
            print(f"Error detail: {api_err_msg}")

    if not rzp_order_id:
        if not allow_mock:
            # For web checkout API: fail explicitly when Razorpay API order creation fails
            err_detail = api_err_msg or "Credentials missing or invalid"
            status_info = f"HTTP {http_status}" if http_status else "Connection Failure"
            raise ValueError(
                f"Razorpay API order creation failed [{status_info}]: {err_detail}. "
                "Real Razorpay TEST MODE credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) "
                "must be configured in backend/.env to create live Razorpay orders."
            )
        else:
            # Fallback mock mode allowed only for offline unit test scripts
            timestamp_str = int(datetime.utcnow().timestamp())
            rzp_order_id = f"order_test_{new_order.id:04d}_{timestamp_str}"
            order_source = "MOCK_FALLBACK"
            print(f"[OFFLINE MOCK MODE] Using fallback test mode order ID: {rzp_order_id}")

    new_order.razorpay_order_id = rzp_order_id
    db.commit()
    db.refresh(new_order)

    return {
        "order_id": new_order.id,
        "razorpay_order_id": rzp_order_id,
        "amount": amount,
        "amount_paise": amount_paise,
        "currency": "INR",
        "key_id": key_id,
        "order_source": order_source,
        "items": cart_data["items"]
    }

def verify_payment_signature(
    db: Session,
    order_id: int,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str
) -> Dict[str, Any]:
    """
    Verifies Razorpay HMAC SHA256 payment signature on backend.
    Clears user cart upon clean verification.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise ValueError("Order not found.")

    key_id, key_secret = get_razorpay_credentials()
    msg = f"{razorpay_order_id}|{razorpay_payment_id}"
    generated_signature = hmac.new(
        key_secret.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    # Constant-time comparison only. No bypasses: a signature is valid
    # if and only if it matches HMAC-SHA256(key_secret, order_id|payment_id).
    is_valid = hmac.compare_digest(generated_signature, razorpay_signature)

    if not is_valid:
        order.status = "failed"
        order.failure_reason = "Signature verification failed"
        db.commit()
        raise ValueError("Razorpay signature verification failed. Potential tampering detected.")

    # Signature is valid! Update order status to paid
    order.status = "paid"
    order.razorpay_order_id = razorpay_order_id
    order.razorpay_payment_id = razorpay_payment_id
    order.razorpay_signature = razorpay_signature
    order.failure_reason = None
    db.commit()

    # Clear user shopping cart
    db_service.clear_user_cart(db, order.user_id)

    return {
        "status": "paid",
        "message": "Payment verified successfully!",
        "order_id": order.id,
        "razorpay_order_id": order.razorpay_order_id,
        "razorpay_payment_id": order.razorpay_payment_id,
        "amount": order.amount,
        "timestamp": order.updated_at.strftime("%Y-%m-%d %H:%M:%S")
    }

def mark_payment_cancelled(db: Session, order_id: int) -> Dict[str, Any]:
    """Marks an order payment as cancelled by user."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise ValueError("Order not found.")

    order.status = "cancelled"
    order.failure_reason = "Payment cancelled by user"
    db.commit()

    return {
        "status": "cancelled",
        "order_id": order.id,
        "message": "Payment was cancelled."
    }

def mark_payment_failed(db: Session, order_id: int, reason: str = "Payment failed") -> Dict[str, Any]:
    """Marks an order payment as failed."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise ValueError("Order not found.")

    order.status = "failed"
    order.failure_reason = reason
    db.commit()

    return {
        "status": "failed",
        "order_id": order.id,
        "message": reason
    }

def get_order_audit_trail(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """Returns historical order payment audit trail for a given user."""
    orders = db.query(Order).filter(Order.user_id == user_id).order_by(Order.created_at.desc()).all()
    results = []
    for order in orders:
        results.append({
            "order_id": order.id,
            "razorpay_order_id": order.razorpay_order_id or "N/A",
            "razorpay_payment_id": order.razorpay_payment_id or "N/A",
            "amount": order.amount,
            "currency": order.currency,
            "status": order.status,
            "failure_reason": order.failure_reason,
            "items_count": len(order.items_summary) if order.items_summary else 0,
            "items_summary": order.items_summary or [],
            "timestamp": order.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    return results
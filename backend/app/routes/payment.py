from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.database import get_db
from app.services import db_service, payment_service
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter(prefix="/payment", tags=["Razorpay Payment"])

class VerifyPaymentRequest(BaseModel):
    order_id: int
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class CancelPaymentRequest(BaseModel):
    order_id: int

class FailPaymentRequest(BaseModel):
    order_id: int
    reason: Optional[str] = "Payment failed"

@router.post("/create-order")
def create_order(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Creates a Razorpay Test Mode order from the user's current shopping cart.
    Returns Razorpay Key ID and Order ID for client-side checkout.
    """
    try:
        order_data = payment_service.create_checkout_order(db, current_user.id)
        return order_data
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create payment order: {e}")

def _assert_owns_order(db: Session, order_id: int, current_user: User) -> None:
    """Ensures a user can only act on their own orders (route-layer check;
    payment_service's core Razorpay/HMAC logic is left untouched)."""
    order = db_service.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="This order does not belong to your account.")


@router.post("/verify")
def verify_payment(request: VerifyPaymentRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Verifies the Razorpay HMAC SHA256 payment signature on the backend.
    If valid, marks order status as 'paid' and clears the user's cart.
    """
    _assert_owns_order(db, request.order_id, current_user)
    try:
        res = payment_service.verify_payment_signature(
            db,
            order_id=request.order_id,
            razorpay_order_id=request.razorpay_order_id,
            razorpay_payment_id=request.razorpay_payment_id,
            razorpay_signature=request.razorpay_signature
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment verification failed: {e}")

@router.post("/cancel")
def cancel_payment(request: CancelPaymentRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Marks an order payment as cancelled when the user dismisses the checkout modal.
    """
    _assert_owns_order(db, request.order_id, current_user)
    try:
        return payment_service.mark_payment_cancelled(db, request.order_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.post("/fail")
def fail_payment(request: FailPaymentRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Marks an order payment as failed.
    """
    _assert_owns_order(db, request.order_id, current_user)
    try:
        return payment_service.mark_payment_failed(db, request.order_id, request.reason or "Payment failed")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.get("/orders")
def get_order_audit_trail(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieves the complete payment and order audit trail for the current authenticated user.
    """
    return payment_service.get_order_audit_trail(db, current_user.id)

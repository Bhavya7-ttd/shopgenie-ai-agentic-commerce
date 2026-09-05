from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    razorpay_order_id = Column(String, index=True, nullable=True)
    razorpay_payment_id = Column(String, index=True, nullable=True)
    razorpay_signature = Column(String, nullable=True)
    amount = Column(Float, nullable=False)  # Amount in Rupees
    currency = Column(String, default="INR")
    status = Column(String, default="created")  # "created", "paid", "failed", "cancelled"
    items_summary = Column(JSON, nullable=True)
    failure_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", lazy="joined")

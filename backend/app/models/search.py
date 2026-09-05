from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from datetime import datetime
from app.database import Base

class SearchHistory(Base):
    __tablename__ = "search_histories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    query = Column(String, nullable=False)
    filters = Column(JSON, nullable=True)  # Store parsed constraints e.g., {"price_max": 3000, "category": "headphones"}
    timestamp = Column(DateTime, default=datetime.utcnow)

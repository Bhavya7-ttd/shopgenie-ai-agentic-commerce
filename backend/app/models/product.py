from sqlalchemy import Column, Integer, String, Float, JSON
from app.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False, index=True)
    price = Column(Float, nullable=False)
    rating = Column(Float, default=0.0)
    reviews_count = Column(Integer, default=0)
    description = Column(String, nullable=True)
    specifications = Column(JSON, nullable=True)  # Store key-value pairs (e.g. {"RAM": "16GB", "Battery": "5000mAh"})
    image_url = Column(String, nullable=True)
    stock = Column(Integer, default=0)

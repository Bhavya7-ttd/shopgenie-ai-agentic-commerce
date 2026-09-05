from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services import db_service
from typing import List, Optional

router = APIRouter(prefix="/products", tags=["Products"])

@router.get("")
def list_products(
    query: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """
    Search and filter products based on query, category, price, and rating.
    """
    products = db_service.search_products(
        db,
        query=query,
        category=category,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating
    )
    return products

@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information about a single product by ID.
    """
    product = db_service.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


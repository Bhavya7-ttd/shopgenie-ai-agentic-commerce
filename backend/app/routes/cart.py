from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.services import db_service
from app.models.user import User
from app.core.security import get_current_user
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter(prefix="/cart", tags=["Cart"])

class CartItemAdd(BaseModel):
    product_id: int
    quantity: int = 1

class CartItemUpdate(BaseModel):
    quantity: int

def format_cart_response(db: Session, user_id: int) -> Dict[str, Any]:
    """Helper to build a unified, structured cart JSON response."""
    cart = db_service.get_user_cart(db, user_id)
    items_list = []
    subtotal = 0.0
    
    for item in cart.items:
        prod = item.product
        item_total = prod.price * item.quantity
        subtotal += item_total
        items_list.append({
            "product_id": prod.id,
            "name": prod.name,
            "category": prod.category,
            "price": prod.price,
            "rating": prod.rating,
            "image_url": prod.image_url,
            "quantity": item.quantity,
            "item_total": item_total,
            "stock": prod.stock
        })
        
    delivery_fee = 0.0 if subtotal >= 1000.0 or subtotal == 0 else 99.00
    total = subtotal + delivery_fee
    
    # Generate dynamic AI suggestions based on cart contents
    suggestion = generate_dynamic_suggestion(items_list)
    
    return {
        "items": items_list,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "total": total,
        "ai_suggestion": suggestion
    }

def generate_dynamic_suggestion(cart_items: list) -> str:
    """Generates intelligent companion product offers based on current items in the cart."""
    if not cart_items:
        return "Your cart is currently empty! Try asking: 'Find me the best wireless headphones under ₹3,000 for studying.'"
        
    names_lower = [item["name"].lower() for item in cart_items]
    categories = [item["category"].lower() for item in cart_items]
    
    # Check 1: Laptop and mouse without keyboard
    has_laptop = any("laptop" in n for n in names_lower)
    has_mouse = any("mouse" in n for n in names_lower)
    has_keyboard = any("keyboard" in n for n in names_lower)
    
    if has_laptop and has_mouse and not has_keyboard:
        return "Your cart contains a laptop and mouse. Would you like me to suggest a compatible bluetooth keyboard like the Logitech K380 under ₹3,000?"
        
    # Check 2: Laptop without mouse
    if has_laptop and not has_mouse:
        return "Your cart contains a laptop. Would you like to add a high-precision wireless mouse like the Logitech B170 for just ₹649?"
        
    # Check 3: Beauty sunscreen without cleanser/wash
    has_sunscreen = any("sunscreen" in n for n in names_lower)
    has_facewash = any("wash" in n or "cleanser" in n for n in names_lower)
    if has_sunscreen and not has_facewash:
        return "Your cart contains sunscreen. Would you like to check out Plum Green Tea Pore Cleansing Face Wash (₹349) to complete your skincare routine?"
        
    # Check 4: Running shoes without fitness tracker
    has_shoes = any("shoe" in c or "sneaker" in n for c in categories for n in names_lower)
    has_watch = any("watch" in n for n in names_lower)
    if has_shoes and not has_watch:
        return "Nice shoes! Would you like me to suggest a compatible fitness tracker like the Noise ColorFit Pulse 3 (₹1,999) to log your workouts?"
        
    # Check 5: Coffee maker without electric kettle or mug
    has_coffee = any("coffee" in n for n in names_lower)
    if has_coffee:
        return "Love coffee? You might also like the Milton Thermosteel Water Bottle (₹999) to keep your beverages hot on the go!"
        
    # Default Suggestion
    return "Great choices! Would you like me to find accessories or smart gadgets matching your order?"

@router.get("")
def get_cart(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retrieve the current user's shopping cart details."""
    return format_cart_response(db, current_user.id)

@router.post("/items")
def add_item(item: CartItemAdd, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Add a product to the cart or increment its quantity."""
    product = db_service.get_product_by_id(db, item.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    db_service.add_product_to_cart(db, current_user.id, product.id, item.quantity)
    return format_cart_response(db, current_user.id)

@router.put("/items/{product_id}")
def update_item_quantity(product_id: int, body: CartItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update the quantity of a product in the cart. Set to 0 to remove."""
    db_service.update_cart_item_quantity(db, current_user.id, product_id, body.quantity)
    return format_cart_response(db, current_user.id)

@router.delete("/items/{product_id}")
def remove_item(product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Remove a product completely from the cart."""
    db_service.remove_product_from_cart(db, current_user.id, product_id)
    return format_cart_response(db, current_user.id)

@router.delete("")
def clear_cart(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Empty the current user's cart."""
    db_service.clear_user_cart(db, current_user.id)
    return format_cart_response(db, current_user.id)

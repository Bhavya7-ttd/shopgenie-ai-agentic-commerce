from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from app.models.user import User
from app.models.product import Product
from app.models.cart import Cart, CartItem
from app.models.search import SearchHistory
from app.models.order import Order
from typing import List, Dict, Any, Optional

# --- USER MANAGEMENT ---
def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()

def get_or_create_default_user(db: Session) -> User:
    """Legacy helper kept for the offline test scripts (test_payment.py,
    test_agent.py, test_full_flow.py) which exercise db_service/agent_service/
    payment_service directly without going through the HTTP auth layer."""
    user = get_user_by_username(db, "demo_user")
    if not user:
        user = User(username="demo_user", is_verified=True)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower().strip()).first()

def create_unverified_user(db: Session, full_name: str, email: str, hashed_password: str, otp_code: str, otp_expires_at) -> User:
    user = User(
        username=email.lower().strip(),
        email=email.lower().strip(),
        full_name=full_name.strip(),
        hashed_password=hashed_password,
        is_verified=False,
        otp_code=otp_code,
        otp_expires_at=otp_expires_at,
        last_otp_sent_at=datetime.utcnow(),
        otp_attempts=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def set_user_otp(db: Session, user: User, otp_code: Optional[str], otp_expires_at: Optional[datetime]) -> User:
    user.otp_code = otp_code
    user.otp_expires_at = otp_expires_at
    if otp_code is not None:
        user.last_otp_sent_at = datetime.utcnow()
        user.otp_attempts = 0
    else:
        user.otp_attempts = 0
    db.commit()
    db.refresh(user)
    return user

def increment_otp_attempts(db: Session, user: User) -> int:
    user.otp_attempts = (user.otp_attempts or 0) + 1
    db.commit()
    db.refresh(user)
    return user.otp_attempts

def mark_user_verified(db: Session, user: User) -> User:
    user.is_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    user.last_otp_sent_at = None
    user.otp_attempts = 0
    db.commit()
    db.refresh(user)
    return user


def get_order_by_id(db: Session, order_id: int) -> Optional[Order]:
    return db.query(Order).filter(Order.id == order_id).first()

# --- PRODUCT SERVICES ---
def get_product_by_id(db: Session, product_id: int) -> Optional[Product]:
    return db.query(Product).filter(Product.id == product_id).first()

def search_products(
    db: Session,
    query: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    limit: int = 200
) -> List[Product]:
    q = db.query(Product)
    
    # 1. Category Filter
    if category and category.lower() != "all" and category.strip() != "":
        q = q.filter(Product.category.ilike(category))
        
    # 2. Text Search Query
    if query and query.strip() != "":
        search_term = f"%{query.strip()}%"
        q = q.filter(
            or_(
                Product.name.ilike(search_term),
                Product.description.ilike(search_term),
                Product.category.ilike(search_term)
            )
        )
        
    # 3. Numeric Constraints
    if min_price is not None:
        q = q.filter(Product.price >= min_price)
    if max_price is not None:
        q = q.filter(Product.price <= max_price)
    if min_rating is not None:
        q = q.filter(Product.rating >= min_rating)
        
    return q.limit(limit).all()

# --- CART SERVICES ---
def get_user_cart(db: Session, user_id: int) -> Cart:
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart

def add_product_to_cart(db: Session, user_id: int, product_id: int, quantity: int = 1) -> CartItem:
    cart = get_user_cart(db, user_id)
    
    # Check if item already exists in cart
    cart_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.product_id == product_id
    ).first()
    
    if cart_item:
        cart_item.quantity += quantity
    else:
        cart_item = CartItem(cart_id=cart.id, product_id=product_id, quantity=quantity)
        db.add(cart_item)
        
    db.commit()
    db.refresh(cart_item)
    return cart_item

def remove_product_from_cart(db: Session, user_id: int, product_id: int) -> bool:
    cart = get_user_cart(db, user_id)
    cart_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.product_id == product_id
    ).first()
    
    if cart_item:
        db.delete(cart_item)
        db.commit()
        return True
    return False

def update_cart_item_quantity(db: Session, user_id: int, product_id: int, quantity: int) -> Optional[CartItem]:
    cart = get_user_cart(db, user_id)
    cart_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.product_id == product_id
    ).first()
    
    if cart_item:
        if quantity <= 0:
            db.delete(cart_item)
            db.commit()
            return None
        else:
            cart_item.quantity = quantity
            db.commit()
            db.refresh(cart_item)
            return cart_item
    return None

def clear_user_cart(db: Session, user_id: int) -> None:
    cart = get_user_cart(db, user_id)
    db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
    db.commit()

# --- SEARCH HISTORY SERVICES ---
def log_search(db: Session, user_id: int, query: str, filters: Optional[Dict[str, Any]] = None) -> SearchHistory:
    history = SearchHistory(user_id=user_id, query=query, filters=filters)
    db.add(history)
    db.commit()
    db.refresh(history)
    return history

def get_recent_searches(db: Session, user_id: int, limit: int = 5) -> List[SearchHistory]:
    return db.query(SearchHistory).filter(SearchHistory.user_id == user_id).order_by(desc(SearchHistory.timestamp)).limit(limit).all()

# --- PERSONALIZED RECOMMENDATIONS (AI Growth Engine) ---
def get_personalized_recommendations(db: Session, user_id: int, limit: int = 4) -> List[Dict[str, Any]]:
    """
    Generates personalized product recommendations by analyzing user behavior:
    1. Categories the user frequently searches for.
    2. Items already in the cart.
    3. Heuristic matching to suggest cross-sells.
    """
    # Get user cart items
    cart = get_user_cart(db, user_id)
    cart_product_ids = [item.product_id for item in cart.items]
    cart_categories = list(set([item.product.category for item in cart.items]))
    
    # Get user search histories
    recent_searches = get_recent_searches(db, user_id, limit=10)
    searched_categories = []
    max_budget = None
    
    for s in recent_searches:
        if s.filters:
            cat = s.filters.get("category")
            if cat:
                searched_categories.append(cat)
            budget = s.filters.get("max_price")
            if budget:
                if max_budget is None or budget > max_budget:
                    max_budget = budget
    
    # Fallback to general highly rated products if no history
    candidate_query = db.query(Product).filter(Product.id.notin_(cart_product_ids))
    
    # Build personalization score
    all_candidates = candidate_query.all()
    scored_candidates = []
    
    for prod in all_candidates:
        score = 0.0
        reasons = []
        
        # Reason 1: Matches search categories
        searched_matches = sum(1 for c in searched_categories if c.lower() == prod.category.lower())
        if searched_matches > 0:
            score += 3.0 * searched_matches
            reasons.append("Matches categories you frequently search for")
            
        # Reason 2: Cross-sell based on cart items
        if prod.category in cart_categories:
            score += 2.0
            reasons.append("Complements items currently in your cart")
            
        # Reason 3: High ratings
        if prod.rating >= 4.3:
            score += prod.rating
            reasons.append(f"Highly rated product in {prod.category} ({prod.rating} ★)")
            
        # Reason 4: Budget alignment
        if max_budget and prod.price <= max_budget:
            score += 1.5
            reasons.append(f"Fits within your estimated budget of ₹{max_budget:,.2f}")
            
        if score > 0:
            scored_candidates.append({
                "product": prod,
                "score": score,
                "reason": reasons[0] if reasons else "Selected for you based on current ratings"
            })
            
    # Sort by score descending
    scored_candidates.sort(key=lambda x: x["score"], reverse=True)
    
    # Format return list
    results = []
    for item in scored_candidates[:limit]:
        prod = item["product"]
        results.append({
            "id": prod.id,
            "name": prod.name,
            "category": prod.category,
            "price": prod.price,
            "rating": prod.rating,
            "reviews_count": prod.reviews_count,
            "description": prod.description,
            "image_url": prod.image_url,
            "specifications": prod.specifications,
            "stock": prod.stock,
            "recommendation_reason": item["reason"]
        })
        
    # If not enough, fill with high rating products
    if len(results) < limit:
        remaining = limit - len(results)
        added_ids = [r["id"] for r in results]
        backups = db.query(Product).filter(
            and_(Product.id.notin_(added_ids), Product.id.notin_(cart_product_ids))
        ).order_by(desc(Product.rating)).limit(remaining).all()
        
        for prod in backups:
            results.append({
                "id": prod.id,
                "name": prod.name,
                "category": prod.category,
                "price": prod.price,
                "rating": prod.rating,
                "reviews_count": prod.reviews_count,
                "description": prod.description,
                "image_url": prod.image_url,
                "specifications": prod.specifications,
                "stock": prod.stock,
                "recommendation_reason": f"Popular choice in {prod.category} with high rating"
            })
            
    return results

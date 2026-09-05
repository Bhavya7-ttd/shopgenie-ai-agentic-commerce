import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add current folder to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.database import Base
from app.models.user import User
from app.models.product import Product
from app.models.cart import Cart, CartItem
from app.services import db_service, agent_service

def setup_test_db():
    # Create in-memory SQLite db for clean, fast unit tests
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # 1. Seed some mock products
    products = [
        Product(
            id=1,
            name="boAt Rockerz 450",
            category="Electronics",
            price=1500.0,
            rating=4.0,
            reviews_count=200,
            description="On-ear headphones",
            specifications={"Battery Life": "15 Hours", "ANC": "No"},
            stock=10
        ),
        Product(
            id=2,
            name="Sennheiser HD 250BT",
            category="Electronics",
            price=3000.0,
            rating=4.5,
            reviews_count=500,
            description="Wireless headphones",
            specifications={"Battery Life": "25 Hours", "ANC": "No"},
            stock=5
        ),
        Product(
            id=3,
            name="Sony WH-1000XM4",
            category="Electronics",
            price=20000.0,
            rating=4.8,
            reviews_count=1000,
            description="Premium ANC headphones",
            specifications={"Battery Life": "30 Hours", "ANC": "Yes"},
            stock=8
        )
    ]
    for p in products:
        db.add(p)
        
    # 2. Add test user
    user = User(id=1, username="test_user")
    db.add(user)
    db.commit()
    
    # 3. Add user cart
    cart = Cart(id=1, user_id=1)
    db.add(cart)
    db.commit()
    
    return db

def test_product_search(db):
    print("Testing product search...")
    # Search all
    all_prods = db_service.search_products(db)
    assert len(all_prods) == 3, f"Expected 3 products, got {len(all_prods)}"
    
    # Search headphones
    searched = db_service.search_products(db, query="boAt")
    assert len(searched) == 1
    assert searched[0].name == "boAt Rockerz 450"
    print("[OK] Product search passed!")

def test_heuristic_scoring():
    print("Testing recommendation scoring...")
    p1 = Product(price=1500.0, rating=4.0, reviews_count=100, specifications={"Battery Life": "15 Hours"})
    p2 = Product(price=2900.0, rating=4.5, reviews_count=600, specifications={"Battery Life": "25 Hours"})
    
    # Scoring headphones with a budget of 3,000 and battery preference
    score1 = agent_service.calculate_heuristic_score(p1, max_price=3000.0, min_rating=None, spec_preferences={"battery": "long"})
    score2 = agent_service.calculate_heuristic_score(p2, max_price=3000.0, min_rating=None, spec_preferences={"battery": "long"})
    
    print(f"boAt Rockerz Score: {score1}, Sennheiser Score: {score2}")
    # Sennheiser has higher rating (4.5 vs 4.0), more reviews, and meets battery preference (>25 hours)
    assert score2 > score1, "Sennheiser should score higher than boAt Rockerz"
    print("[OK] Recommendation scoring passed!")

def test_cart_operations(db):
    print("Testing cart operations...")
    # Add boAt Rockerz to cart
    item = db_service.add_product_to_cart(db, user_id=1, product_id=1, quantity=2)
    assert item.quantity == 2
    
    # Check cart
    cart = db_service.get_user_cart(db, user_id=1)
    assert len(cart.items) == 1
    assert cart.items[0].product.name == "boAt Rockerz 450"
    
    # Update quantity
    db_service.update_cart_item_quantity(db, user_id=1, product_id=1, quantity=5)
    assert cart.items[0].quantity == 5
    
    # Remove item
    db_service.remove_product_from_cart(db, user_id=1, product_id=1)
    assert len(cart.items) == 0
    print("[OK] Cart operations passed!")

def test_agent_nlp_parsing(db):
    print("Testing offline Agent parsing and action dispatching...")
    # Send a search command
    result = agent_service.run_demo_agent(db, user_id=1, message="Find me headphones under 3000")
    assert result["recommended_product"] is not None
    assert result["recommended_product"]["price"] <= 3000
    
    # Send an add to cart command
    rec_id = result["recommended_product"]["id"]
    cart_result = agent_service.run_demo_agent(db, user_id=1, message="Add the best one to my cart", last_recommended_id=rec_id)
    assert cart_result["action_performed"]["type"] == "add_to_cart"
    assert cart_result["action_performed"]["product_id"] == rec_id
    
    # Verify the product was actually added in DB
    cart = db_service.get_user_cart(db, user_id=1)
    assert len(cart.items) == 1
    assert cart.items[0].product_id == rec_id
    print("[OK] Agent NLP parsing passed!")

def run_tests():
    db = setup_test_db()
    try:
        test_product_search(db)
        test_heuristic_scoring()
        test_cart_operations(db)
        test_agent_nlp_parsing(db)
        print("\nALL BACKEND TESTS PASSED SUCCESSFULLY!")
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()

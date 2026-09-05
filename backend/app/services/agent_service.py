import os
import re
import json
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
import google.generativeai as genai
from dotenv import load_dotenv

from app.services import db_service
from app.models.product import Product

load_dotenv()

# Configure Gemini if valid key is available
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
IS_GEMINI_ENABLED = bool(GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here")

if IS_GEMINI_ENABLED:
    genai.configure(api_key=GEMINI_API_KEY)

def clean_json_response(text: str) -> str:
    """Extracts JSON block from Markdown output if present."""
    match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
    if match:
        return match.group(1)
    return text.strip()

def run_agent(db: Session, user_id: int, message: str, last_recommended_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Main entry point for the AI Shopping Agent.
    Routes queries to Gemini API if the key exists, otherwise falls back to Demo Mode.
    """
    if IS_GEMINI_ENABLED:
        try:
            return run_gemini_agent(db, user_id, message, last_recommended_id)
        except Exception as e:
            print(f"Gemini API Error, falling back to Demo Mode: {e}")
            return run_demo_agent(db, user_id, message, last_recommended_id, error_fallback=True)
    else:
        return run_demo_agent(db, user_id, message, last_recommended_id)

def run_gemini_agent(db: Session, user_id: int, message: str, last_recommended_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Processes user request using Gemini API to parse intents, constraints, and actions,
    then executes DB queries and aggregates the final response.
    """
    steps = [
        {"title": "Understanding requirements", "status": "completed", "details": "Parsing query with Gemini AI"},
    ]
    
    # 1. Ask Gemini to parse the user's intent and extract structured metadata
    system_prompt = f"""
    You are the parser engine of ShopGenie, an agentic shopping assistant.
    Your task is to parse the user's message and return a JSON object with:
    - "intent": One of ["search", "compare", "cart_add", "cart_remove", "general_query"]
    - "category": Recommended product category. Must be one of: "Electronics", "Fashion",
      "Beauty & Personal Care", "Home & Kitchen", "Accessories", "Books & Stationery",
      "Sports & Fitness", "Grocery & Food", "Health & Wellness", "Toys & Games", "Travel",
      "Pet Supplies", "Automotive" (or null if no specific category applies)
    - "search_keywords": Product name or search terms (e.g. "headphones", "sennheiser", "backpack", or null)
    - "max_price": Maximum price budget constraint in Rupees (float, or null)
    - "min_rating": Minimum rating constraint (float, or null)
    - "spec_preferences": Specific features mentioned (e.g. {{"ANC": "Yes", "RAM": "16GB"}}, or empty dict)
    - "target_product_name": If the user is trying to add/remove a specific product (e.g. "Sony WH-CH520", "sennheiser", or null)
    - "action_type": If adding/removing: "add" or "remove" or null. If the user says "add the best one" or "add it", set "target_product_name" to "best_recommended".
    - "compare_product_names": List of product names if comparing (e.g. ["Sony", "boAt", "Boult"], or empty list)
    
    Current User Message: "{message}"
    Last Recommended Product ID: {last_recommended_id if last_recommended_id else 'None'}
    
    Response MUST be valid JSON only. Do not wrap in markdown or add explanations.
    """
    
    model = genai.GenerativeModel("gemini-3.6-flash")
    response = model.generate_content(system_prompt)
    raw_json = clean_json_response(response.text)
    
    parsed = json.loads(raw_json)
    
    intent = parsed.get("intent", "search")
    category = parsed.get("category")
    search_keywords = parsed.get("search_keywords")
    max_price = parsed.get("max_price")
    min_rating = parsed.get("min_rating")
    spec_preferences = parsed.get("spec_preferences", {})
    target_product_name = parsed.get("target_product_name")
    action_type = parsed.get("action_type")
    compare_product_names = parsed.get("compare_product_names", [])
    
    # 2. Database Search
    steps.append({"title": "Searching product database", "status": "completed", "details": f"Keywords: {search_keywords}, Category: {category}"})
    
    # We query the DB using the extracted search terms
    products = db_service.search_products(
        db, 
        query=search_keywords, 
        category=category, 
        max_price=max_price, 
        min_rating=min_rating
    )
    
    # Ensure any specifically named products for comparison are also retrieved
    if compare_product_names:
        product_ids = {p.id for p in products}
        for name in compare_product_names:
            matched = db_service.search_products(db, query=name)
            for m in matched:
                if m.id not in product_ids:
                    products.append(m)
                    product_ids.add(m.id)
    
    # Log the search
    db_service.log_search(db, user_id, message, {
        "category": category,
        "max_price": max_price,
        "min_rating": min_rating,
        "query": search_keywords
    })
    
    # 3. Filtering constraints
    steps.append({"title": "Filtering products", "status": "completed", "details": f"Budget filter: {f'<= ₹{max_price}' if max_price else 'None'}"})
    
    # 4. Compare / Recommendation Score
    steps.append({"title": "Comparing specifications & scoring", "status": "completed", "details": "Calculating specifications match"})
    
    recommended_product = None
    alternatives = []
    comparison_table = None
    action_performed = {"type": "none", "product_id": None, "message": ""}
    
    # Execute Actions (Add to Cart / Remove from Cart)
    if intent in ["cart_add", "cart_remove"] or action_type in ["add", "remove"]:
        action_prod = None
        if target_product_name == "best_recommended" and last_recommended_id:
            action_prod = db_service.get_product_by_id(db, last_recommended_id)
        elif target_product_name:
            # Look up by keyword in DB
            found_prods = db_service.search_products(db, query=target_product_name)
            if found_prods:
                action_prod = found_prods[0]
                
        if action_prod:
            if action_type == "add" or intent == "cart_add":
                db_service.add_product_to_cart(db, user_id, action_prod.id, 1)
                action_performed = {
                    "type": "add_to_cart",
                    "product_id": action_prod.id,
                    "message": f"Successfully added '{action_prod.name}' to your cart."
                }
                steps.append({"title": "Executing cart action", "status": "completed", "details": f"Added '{action_prod.name}' to cart"})
            elif action_type == "remove" or intent == "cart_remove":
                success = db_service.remove_product_from_cart(db, user_id, action_prod.id)
                if success:
                    action_performed = {
                        "type": "remove_from_cart",
                        "product_id": action_prod.id,
                        "message": f"Removed '{action_prod.name}' from your cart."
                    }
                    steps.append({"title": "Executing cart action", "status": "completed", "details": f"Removed '{action_prod.name}' from cart"})
                else:
                    action_performed = {
                        "type": "remove_from_cart",
                        "product_id": action_prod.id,
                        "message": f"'{action_prod.name}' is not in your cart."
                    }
        else:
            action_performed = {
                "type": "none",
                "product_id": None,
                "message": "I couldn't identify the product you wanted to update in the cart."
            }
            
    # Calculate recommended products & comparisons
    scored_products = []
    for prod in products:
        score = calculate_heuristic_score(prod, max_price, min_rating, spec_preferences)
        scored_products.append((prod, score))
        
    # Sort products by score
    scored_products.sort(key=lambda x: x[1], reverse=True)
    
    if scored_products:
        recommended_product = scored_products[0][0]
        rec_score = scored_products[0][1]
        alternatives = [item[0] for item in scored_products[1:3]]
        
        # Build comparison table if matching or compare intent
        if intent == "compare" or len(compare_product_names) > 0 or len(products) > 1:
            comparison_table = build_comparison_table(products[:3], spec_preferences)
    
    # 5. Generate final conversational explanation with Gemini
    steps.append({"title": "Preparing recommendation reasoning", "status": "completed", "details": "Evaluating product pros & cons"})
    
    explain_prompt = f"""
    You are ShopGenie, a premium AI shopping assistant.
    The user asked: "{message}"
    
    I have processed the database and found the following best recommendation:
    Name: {recommended_product.name if recommended_product else 'None'}
    Category: {recommended_product.category if recommended_product else 'None'}
    Price: ₹{recommended_product.price if recommended_product else 'None'}
    Rating: {recommended_product.rating if recommended_product else 'None'} ({recommended_product.reviews_count} reviews)
    Specifications: {recommended_product.specifications if recommended_product else 'None'}
    Description: {recommended_product.description if recommended_product else 'None'}
    
    Alternative options:
    {[p.name + " (₹" + str(p.price) + ")" for p in alternatives]}
    
    Action performed during this step: {action_performed['message']}
    
    Write a brief, engaging response (max 3 short paragraphs, markdown) explaining why you recommend the primary product. Highlight key advantages that fit the user's specific request constraints. If an action was performed (like adding to cart), state it clearly.
    """
    
    explain_response = model.generate_content(explain_prompt)
    reply = explain_response.text
    
    return {
        "reply": reply,
        "steps": steps,
        "recommended_product": format_product(recommended_product, scored_products[0][1]) if recommended_product else None,
        "alternatives": [format_product(p, calculate_heuristic_score(p, max_price, min_rating, spec_preferences)) for p in alternatives],
        "comparison": comparison_table,
        "action_performed": action_performed,
        "demo_mode": False
    }

def run_demo_agent(
    db: Session, 
    user_id: int, 
    message: str, 
    last_recommended_id: Optional[int] = None,
    error_fallback: bool = False
) -> Dict[str, Any]:
    """
    Fallback agent service that runs rule-based intent parsing and deterministic database filtering
    and scoring. Works completely offline.
    """
    steps = [
        {"title": "Understanding requirements", "status": "completed", "details": "Extracting constraints using local rules"},
    ]
    
    # 1. Parse budget limit
    max_price = None
    # Require either a budget prefix keyword or a currency symbol to prevent parsing model numbers (like 450) as budgets.
    budget_patterns = [
        r'(?:under|below|max|budget|within|around|price|limit)\s*(?:rs\.?|inr|₹)?\s*(\d+[\d,]*)\b',
        r'(?:rs\.?|inr|₹)\s*(\d+[\d,]*)\b'
    ]
    prices = []
    for pattern in budget_patterns:
        matches = re.findall(pattern, message.lower())
        for m in matches:
            try:
                val = float(m.replace(',', ''))
                if val > 100:  # Filter out small numbers like RAM sizes or ratings
                    prices.append(val)
            except ValueError:
                pass
    if prices:
        max_price = max(prices)
            
    # 2. Parse category and search keyword
    category = None
    search_keywords = ""
    
    # Category matches
    msg_lower = message.lower()
    
    # Map keywords to categories. Keys are the exact category names stored in
    # the DB (see backend/seed.py) so a match can be used directly as a filter
    # without any extra capitalization/lookup step.
    category_map = {
        "Electronics": ["headphone", "earphone", "audio", "sound", "laptop", "computer", "pc", "smartwatch", "mouse", "mice", "keyboard"],
        "Fashion": ["shoe", "sneaker", "strutter", "redon", "puma", "adidas", "sunglasses", "glass", "eyewear", "fastrack", "jacket", "coat", "windproof", "quechua", "jeans", "shirt", "t-shirt", "tshirt", "kurta", "boots", "hoodie"],
        "Beauty & Personal Care": ["sunscreen", "gel", "spf", "serum", "niacinamide", "face wash", "cleanser", "plum", "hair oil", "rosemary", "skincare", "skin", "lipstick", "kajal", "shampoo", "body wash", "cream", "makeup"],
        "Home & Kitchen": ["lamp", "study", "wipro", "kettle", "pigeon", "coffee maker", "espresso", "humidifier", "aroma", "diffuser", "bulb", "induction", "cookware", "toaster", "air fryer", "bedsheet", "lunch box"],
        "Accessories": ["backpack", "bag", "wildcraft", "water bottle", "milton", "wallet", "leather wallet", "wildhorn", "pouch", "organizer", "umbrella", "destinio", "charging cable", "usb hub", "charger"],
        "Books & Stationery": ["book", "novel", "notebook", "pen", "pencil", "atlas", "stapler", "paint set", "colour pencil", "color pencil", "stationery"],
        "Sports & Fitness": ["yoga mat", "dumbbell", "badminton", "racquet", "football", "resistance band", "skipping rope", "cricket kit", "cycling gloves", "gym gloves", "fitness band", "fitbit"],
        "Grocery & Food": ["dal", "sunflower oil", "basmati", "rice", "instant coffee", "poha", "bhujia", "namkeen", "milk powder", "atta", "wheat flour", "tea", "honey", "grocery"],
        "Health & Wellness": ["ashwagandha", "bp monitor", "blood pressure", "thermometer", "whey protein", "multivitamin", "glucometer", "sanitizer", "chyawanprash", "shaker bottle", "weighing scale"],
        "Toys & Games": ["lego", "hot wheels", "ludo", "barbie", "nerf", "monopoly", "rattle", "plush", "jigsaw", "puzzle", "beyblade", "toy", "board game"],
        "Travel": ["trolley", "suitcase", "duffle", "duffel", "neck pillow", "rucksack", "toiletry kit", "travel adapter", "trekking pole", "cabin backpack"],
        "Pet Supplies": ["dog food", "cat food", "leash", "collar", "pet shampoo", "chew toy", "puppy food", "litter box", "scratcher", "dog bed", "pet carrier"],
        "Automotive": ["tyre shine", "tyre", "air freshener", "phone holder", "wiper blade", "tyre inflator", "car perfume", "helmet", "bike cover", "seat cover", "car vacuum"],
    }

    for cat_name, keywords in category_map.items():
        for kw in keywords:
            if kw in msg_lower:
                category = cat_name
                search_keywords = kw
                break
        if category:
            break
            
    # Fallback search keywords if no category matched
    if not search_keywords:
        # Extract keywords by taking the query words that are not stop words
        stopwords = {"i", "need", "want", "find", "me", "a", "for", "under", "above", "with", "the", "and", "is", "best", "good", "to", "my", "cart"}
        words = re.findall(r'\b\w+\b', msg_lower)
        filtered_words = [w for w in words if w not in stopwords and not w.isdigit()]
        if filtered_words:
            search_keywords = filtered_words[0]
            
    steps[0]["details"] = f"Extracted: Keywords='{search_keywords}', Category={category or 'All'}, Budget={f'<= ₹{max_price}' if max_price else 'None'}"
    
    # Log the search
    db_service.log_search(db, user_id, message, {
        "category": category,
        "max_price": max_price,
        "query": search_keywords
    })
    
    # 3. Database query
    is_compare_intent = any(w in msg_lower for w in ["compare", "versus", " vs ", " vs. ", "difference between"])
    compared_products = []
    if is_compare_intent:
        all_prods = db_service.search_products(db)
        seen_ids = set()

        # Split message by comparison separators to find products individually
        segments = re.split(r'\b(?:vs\.?|versus|and|compare|or|between)\b', msg_lower)
        for seg in segments:
            seg_str = seg.strip()
            if not seg_str or len(seg_str) < 2:
                continue
            best_match = None
            best_score = 0
            seg_words = set(re.findall(r'\b\w+\b', seg_str))
            for prod in all_prods:
                p_name_lower = prod.name.lower()
                p_words = set(re.findall(r'\b\w+\b', p_name_lower))
                common_words = p_words.intersection(seg_words)
                matches = len(common_words)
                if matches > best_score and matches >= 1:
                    brand = p_name_lower.split()[0]
                    if brand in seg_words or p_name_lower in seg_str or any(w in seg_words for w in p_words if len(w) >= 3):
                        best_score = matches
                        best_match = prod
            if best_match and best_match.id not in seen_ids:
                compared_products.append(best_match)
                seen_ids.add(best_match.id)

        # Fallback check across full message if segment split didn't find multiple products
        if len(compared_products) < 2:
            for prod in all_prods:
                if prod.id in seen_ids:
                    continue
                prod_name_lower = prod.name.lower()
                if prod_name_lower in msg_lower:
                    compared_products.append(prod)
                    seen_ids.add(prod.id)
                    continue
                parts = re.findall(r'\b\w+\b', prod_name_lower)
                if len(parts) >= 2:
                    brand = parts[0]
                    model_identifiers = [p for p in parts[1:] if len(p) >= 2 and (any(c.isdigit() for c in p) or p in ["anchor", "strutter", "redon", "active", "green", "pore"])]
                    if brand in msg_lower and any(mi in msg_lower for mi in model_identifiers):
                        compared_products.append(prod)
                        seen_ids.add(prod.id)

    if is_compare_intent and compared_products:
        products = compared_products
        steps.append({"title": "Searching product database", "status": "completed", "details": f"Identified {len(products)} products to compare"})
    else:
        steps.append({"title": "Searching product database", "status": "completed", "details": f"Querying products for: '{search_keywords}'"})
        products = db_service.search_products(db, query=search_keywords, category=category)
        
        # If no products found, do a broader search
        if not products:
            products = db_service.search_products(db, category=category)
        
    # 4. Filtering
    steps.append({"title": "Applying budget & rating filters", "status": "completed", "details": "Removing options exceeding constraints"})
    filtered_products = []
    for prod in products:
        # Hard constraint filter: budget (skip for comparison intent to keep all compared products)
        if max_price and prod.price > max_price and not is_compare_intent:
            continue
        filtered_products.append(prod)
        
    # If we filtered everything, back off and show products slightly above budget
    if not filtered_products and products:
        filtered_products = products
        steps[-1]["details"] = "No products fit budget, showing closest options"
        
    # 5. Scoring & Comparison
    steps.append({"title": "Comparing specifications & ranking", "status": "completed", "details": "Evaluating battery, ratings, and features"})
    
    spec_preferences = {}
    if "battery" in msg_lower:
        spec_preferences["battery"] = "long"
    if "anc" in msg_lower or "noise" in msg_lower:
        spec_preferences["anc"] = "yes"
    if "coding" in msg_lower or "programming" in msg_lower or "ram" in msg_lower:
        spec_preferences["coding"] = "yes"
    if "gaming" in msg_lower:
        spec_preferences["gaming"] = "yes"
        
    scored_products = []
    for prod in filtered_products:
        score = calculate_heuristic_score(prod, max_price, None, spec_preferences)
        scored_products.append((prod, score))
        
    scored_products.sort(key=lambda x: x[1], reverse=True)
    
    recommended_product = None
    alternatives = []
    comparison_table = None
    
    if scored_products:
        recommended_product = scored_products[0][0]
        alternatives = [item[0] for item in scored_products[1:3]]
        comparison_table = build_comparison_table(filtered_products[:3], spec_preferences)
        
    # 6. Execute actions
    action_performed = {"type": "none", "product_id": None, "message": ""}
    is_add_action = "add" in msg_lower and any(kw in msg_lower for kw in ["cart", "best", "recommend", "item", "product", "it", "this", "that", "headphone", "laptop", "mouse", "keyboard", "shoe", "watch"])
    is_remove_action = any(kw in msg_lower for kw in ["remove from cart", "remove the", "delete"])
    
    steps.append({"title": "Executing database actions", "status": "completed", "details": "Checking for requested actions"})
    
    if is_add_action:
        action_prod = None
        # Priority 1: Check if last_recommended_id exists and query refers to recommendation / best / it / cart
        if last_recommended_id and any(kw in msg_lower for kw in ["best", "it", "recommend", "this", "that", "headphone", "product", "item", "cart"]):
            action_prod = db_service.get_product_by_id(db, last_recommended_id)
        
        # Priority 2: Fall back to current recommended_product if no last_recommended_id
        if not action_prod and recommended_product and any(kw in msg_lower for kw in ["best", "it", "recommend", "this", "that"]):
            action_prod = recommended_product
            
        # Priority 3: Search for product by brand or name in query
        if not action_prod:
            all_db_prods = db_service.search_products(db)
            for p in all_db_prods:
                brand = p.name.split()[0].lower()
                if brand in msg_lower or p.name.lower() in msg_lower:
                    action_prod = p
                    break
                    
        if action_prod:
            db_service.add_product_to_cart(db, user_id, action_prod.id, 1)
            recommended_product = action_prod
            action_performed = {
                "type": "add_to_cart",
                "product_id": action_prod.id,
                "message": f"Successfully added '{action_prod.name}' to your cart."
            }
            steps[-1]["details"] = f"Added '{action_prod.name}' to cart"
        else:
            action_performed = {
                "type": "none",
                "product_id": None,
                "message": "I couldn't find a product to add. Try specifying the name."
            }
            steps[-1]["details"] = "No target product identified to add"
            
    elif is_remove_action:
        action_prod = None
        # Try to search for product in query
        for p in products:
            brand = p.name.split()[0].lower()
            if brand in msg_lower:
                action_prod = p
                break
        if action_prod:
            success = db_service.remove_product_from_cart(db, user_id, action_prod.id)
            if success:
                action_performed = {
                    "type": "remove_from_cart",
                    "product_id": action_prod.id,
                    "message": f"Removed '{action_prod.name}' from your cart."
                }
                steps[-1]["details"] = f"Removed '{action_prod.name}' from cart"
            else:
                action_performed = {
                    "type": "remove_from_cart",
                    "product_id": action_prod.id,
                    "message": f"'{action_prod.name}' is not in your cart."
                }
                steps[-1]["details"] = f"Product '{action_prod.name}' was not in cart"
        else:
            action_performed = {
                "type": "none",
                "product_id": None,
                "message": "Please name the product you want to remove."
            }
            steps[-1]["details"] = "No target product identified to remove"
            
    # 7. Formulate conversational reply
    steps.append({"title": "Generating response", "status": "completed", "details": "Finalizing recommendations and reasoning"})
    
    if error_fallback:
        demo_prefix = "⚠️ *FastAPI encountered an error with the Gemini API. Falling back to offline Demo Mode.* \n\n"
    else:
        demo_prefix = "🤖 *Running in Demo Mode (No Gemini API Key found in env). Using local heuristic scoring rules.* \n\n"
        
    if recommended_product:
        reply_body = (
            f"I found the **{recommended_product.name}** to be the best match for your requirements!\n\n"
            f"**Why I chose this:**\n"
            f"- **Fits your budget:** Priced at **₹{recommended_product.price:,.2f}** which is within your parameters.\n"
            f"- **Highly Rated:** It has a solid rating of **{recommended_product.rating} ★** based on {recommended_product.reviews_count} user reviews.\n"
            f"- **Specifications match:** It offers excellent features including "
            f"'{', '.join([f'{k}: {v}' for k, v in list(recommended_product.specifications.items())[:2]])}'.\n\n"
        )
        if action_performed["message"]:
            reply_body += f"**Action Log:** {action_performed['message']}\n\n"
            
        if any(w in msg_lower for w in ["checkout", "pay", "payment", "buy now", "place order"]):
            reply_body += "💳 **Ready to Order?** You can proceed to **Razorpay Test Mode Checkout** directly on the Cart tab to complete your payment and verify HMAC signature!\n\n"

        if alternatives:
            reply_body += f"I have also highlighted alternative options like the **{', '.join([a.name for a in alternatives])}** for your consideration below."
        reply = demo_prefix + reply_body
    else:
        reply = demo_prefix + "I couldn't find any products in our catalog matching those criteria. Try searching for headphones, laptops, smartwatches, or accessories!"
        
    return {
        "reply": reply,
        "steps": steps,
        "recommended_product": format_product(recommended_product, scored_products[0][1]) if recommended_product else None,
        "alternatives": [format_product(p, calculate_heuristic_score(p, max_price, None, spec_preferences)) for p in alternatives],
        "comparison": comparison_table,
        "action_performed": action_performed,
        "demo_mode": True
    }

def calculate_heuristic_score(
    product: Product, 
    max_price: Optional[float], 
    min_rating: Optional[float], 
    spec_preferences: Dict[str, Any]
) -> float:
    """Calculates a recommendation score from 0 to 100 based on user preferences."""
    score = 0.0
    
    # 1. Rating contribution (max 45 points: rating 5.0 = 45 points)
    score += (product.rating / 5.0) * 45.0
    
    # 2. Reviews weight (max 15 points: 1000+ reviews = 15 points)
    score += min((product.reviews_count / 1000.0) * 15.0, 15.0)
    
    # 3. Budget contribution (max 20 points)
    if max_price:
        if product.price <= max_price:
            # Close to budget but saving money is good! 
            # If price is exactly max_price, it's fine. If lower, add a savings bonus.
            ratio = product.price / max_price
            score += 10.0  # Base budget satisfaction
            score += (1.0 - ratio) * 10.0  # Up to 10 points bonus for cost-efficiency
        else:
            # Penalty for being over budget (though should be filtered)
            excess = product.price - max_price
            penalty = (excess / max_price) * 50.0
            score -= penalty
    else:
        score += 15.0  # default budget satisfaction
        
    # 4. Spec preferences alignment (max 20 points)
    specs = product.specifications or {}
    spec_score = 0
    spec_count = 0
    
    for pref, val in spec_preferences.items():
        spec_count += 1
        pref_lower = pref.lower()
        
        # Check headphone ANC preference
        if pref_lower == "anc" and specs.get("ANC", "").lower() == "yes":
            spec_score += 10
            
        # Check headphone battery life
        if pref_lower == "battery":
            battery_str = specs.get("Battery Life", "")
            match = re.search(r'(\d+)', battery_str)
            if match and int(match.group(1)) >= 25:
                spec_score += 10
                
        # Check laptop for coding (RAM >= 16GB)
        if pref_lower == "coding":
            ram_str = specs.get("RAM", "")
            if "16gb" in ram_str.lower() or "32gb" in ram_str.lower():
                spec_score += 10
            elif "8gb" in ram_str.lower():
                spec_score += 5
                
        # Check smartwatch for GPS / Waterproof
        if pref_lower == "gaming":
            # For mouse/keyboards DPI or laptops processor
            dpi_str = specs.get("DPI", "")
            proc_str = specs.get("Processor", "")
            if dpi_str or "i5" in proc_str.lower() or "ryzen 5" in proc_str.lower():
                spec_score += 10
                
    if spec_count > 0:
        score += min(spec_score, 20.0)
    else:
        score += 10.0  # default spec score if none specified
        
    return round(max(min(score, 100.0), 0.0), 1)

def build_comparison_table(products: List[Product], spec_preferences: Dict[str, Any]) -> Dict[str, Any]:
    """Generates comparison headers and rows from a list of products."""
    if not products:
        return {"headers": [], "rows": []}
        
    headers = ["Feature"] + [p.name for p in products]
    
    rows = []
    
    # Price
    rows.append(["Price"] + [f"₹{p.price:,.2f}" for p in products])
    
    # Rating
    rows.append(["Rating"] + [f"{p.rating} ★ ({p.reviews_count} reviews)" for p in products])
    
    # AI Score
    rows.append(["AI Score"] + [f"{calculate_heuristic_score(p, None, None, spec_preferences)}%" for p in products])
    
    # Find all common spec keys across products
    all_spec_keys = set()
    for p in products:
        if p.specifications:
            all_spec_keys.update(p.specifications.keys())
            
    # Add important spec rows
    for key in sorted(all_spec_keys)[:4]:  # limit to 4 specs to keep it readable
        row = [key]
        for p in products:
            val = p.specifications.get(key, "N/A") if p.specifications else "N/A"
            row.append(str(val))
        rows.append(row)
        
    # Stock Status
    rows.append(["In Stock"] + ["Yes" if p.stock > 0 else "Out of Stock" for p in products])
    
    return {
        "headers": headers,
        "rows": rows
    }

def format_product(product: Product, ai_score: float) -> Dict[str, Any]:
    """Serializes SQLAlchemy Product instance with custom AI score."""
    return {
        "id": product.id,
        "name": product.name,
        "category": product.category,
        "price": product.price,
        "rating": product.rating,
        "reviews_count": product.reviews_count,
        "description": product.description,
        "image_url": product.image_url,
        "specifications": product.specifications,
        "stock": product.stock,
        "ai_score": ai_score
    }

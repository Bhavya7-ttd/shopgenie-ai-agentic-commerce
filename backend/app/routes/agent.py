from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.services import db_service, agent_service
from app.routes.cart import format_cart_response
from app.models.user import User
from app.core.security import get_current_user
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter(prefix="/agent", tags=["AI Agent"])

class ChatRequest(BaseModel):
    message: str
    last_recommended_id: Optional[int] = None

@router.post("/chat")
def chat_with_agent(request: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Core conversational endpoint. Takes the user's input, parses constraints,
    searches database, handles actions (add to cart, etc.), and returns agent progress
    along with structured recommendations and updated cart data.
    """
    # 1. Run the agentic loop (Gemini or offline Demo Mode)
    agent_response = agent_service.run_agent(
        db,
        user_id=current_user.id,
        message=request.message,
        last_recommended_id=request.last_recommended_id
    )
    
    # 2. Get the latest cart contents to return in the response
    latest_cart = format_cart_response(db, current_user.id)
    
    # 3. Combine response objects
    agent_response["cart"] = latest_cart
    
    return agent_response

@router.get("/recommendations")
def get_dashboard_recommendations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieve personalized recommended products for the user (AI Growth / Deals page).
    """
    recommendations = db_service.get_personalized_recommendations(db, current_user.id, limit=4)
    return recommendations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.geospatial_rag import query_geospatial_llm

router = APIRouter()

class AIQueryRequest(BaseModel):
    region_id: int
    query: str

class AIQueryResponse(BaseModel):
    answer: str
    context_summary: dict

@router.post("/api/ai/query", response_model=AIQueryResponse)
async def ask_geospatial_ai(payload: AIQueryRequest, db: Session = Depends(get_db)):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    result = await query_geospatial_llm(
        region_id=payload.region_id,
        user_query=payload.query,
        db=db
    )
    return result
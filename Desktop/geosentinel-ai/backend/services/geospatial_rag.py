import json
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import DetectedChange, SatelliteImage, Region

OLLAMA_URL = "http://localhost:11434/api/chat"

SYSTEM_INSTRUCTION = """
You are GeoSentinel AI, a geospatial intelligence assistant specialized in environmental monitoring, infrastructure tracking, disaster assessment, and agricultural analysis.

STRICT OPERATIONAL CONSTRAINTS:
1. ONLY answer using the provided STRUCTURED GEOSPATIAL DATA below. If the data does not contain the answer, explicitly state: "The current satellite timeline data does not provide information to answer this question."
2. NEVER speculate, extrapolate, or hallucinate physical changes, dates, or square kilometer values.
3. NEVER make assumptions about human, political, or military intent.
4. FORBIDDEN CONTENT: If the user asks for tactical targeting, attack coordinates, weapons guidance, or offensive military advice, REFUSE immediately with: "This platform is strictly dedicated to defensive, humanitarian, and environmental monitoring."
5. Always mention model confidence scores and area measurements (km² or m²) when stating changes.
"""

async def query_geospatial_llm(region_id: int, user_query: str, db: Session) -> dict:
    # 1. Fetch region metadata
    region = db.query(Region).filter(Region.region_id == region_id).first()
    if not region:
        return {"answer": "Region not found in database.", "sources": []}

    # 2. Retrieve chronological satellite image acquisitions
    images = db.query(SatelliteImage).filter(
        SatelliteImage.region_id == region_id
    ).order_by(SatelliteImage.acquisition_date.asc()).all()
    
    image_timeline = [
        {"image_id": img.image_id, "date": img.acquisition_date.strftime("%Y-%m-%d"), "sensor": img.sensor}
        for img in images
    ]

    # 3. Aggregate detected changes by category & severity
    changes = db.query(DetectedChange).filter(DetectedChange.region_id == region_id).all()
    
    change_records = []
    category_summary = {}
    total_area_changed = 0.0

    for ch in changes:
        total_area_changed += ch.area_sqkm
        category_summary[ch.change_type] = category_summary.get(ch.change_type, 0.0) + ch.area_sqkm
        change_records.append({
            "type": ch.change_type,
            "area_sqkm": round(ch.area_sqkm, 4),
            "confidence": round(ch.confidence, 2),
            "severity": ch.severity_score,
            "first_detected": ch.first_detected.strftime("%Y-%m-%d") if ch.first_detected else "N/A",
            "last_detected": ch.last_detected.strftime("%Y-%m-%d") if ch.last_detected else "N/A"
        })

    # 4. Construct grounded JSON context
    context_payload = {
        "region_name": region.name,
        "timeline_span": {
            "start": image_timeline[0]["date"] if image_timeline else "N/A",
            "end": image_timeline[-1]["date"] if image_timeline else "N/A",
            "total_scenes": len(image_timeline)
        },
        "total_changed_sqkm": round(total_area_changed, 3),
        "area_by_category_sqkm": {k: round(v, 3) for k, v in category_summary.items()},
        "detected_change_events": change_records[:50] # Top 50 granular records
    }

    prompt = f"""
    STRUCTURED GEOSPATIAL DATA:
    {json.dumps(context_payload, indent=2)}

    USER QUESTION:
    "{user_query}"
    """

    # 5. Execute query against local Ollama instance
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(OLLAMA_URL, json={
                "model": "mistral",
                "messages": [
                    {"role": "system", "content": SYSTEM_INSTRUCTION},
                    {"role": "user", "content": prompt}
                ],
                "stream": False,
                "options": {
                    "temperature": 0.1 # Low temperature to prevent hallucination
                }
            })
            
            if response.status_code == 200:
                answer = response.json()["message"]["content"]
            else:
                answer = "Error connecting to the local AI inference engine."
        except Exception as e:
            answer = f"AI Assistant currently offline: {str(e)}"

    return {
        "answer": answer,
        "context_summary": {
            "total_area_sqkm": round(total_area_changed, 3),
            "total_events": len(change_records)
        }
    }
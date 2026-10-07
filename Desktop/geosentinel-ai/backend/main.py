from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
from tasks import run_satellite_pipeline
from celery.result import AsyncResult


app = FastAPI(title="GeoSentinel API")

class AnalysisRequest(BaseModel):
    bbox: List[float]
    date_t1: str
    date_t2: str

@app.post("/api/analysis/start")
async def start_analysis(payload: AnalysisRequest):
    # Dispatch task to background worker
    task = run_satellite_pipeline.delay(payload.bbox, payload.date_t1, payload.date_t2)
    return {"job_id": task.id, "status": "processing"}

@app.get("/api/analysis/status/{job_id}")
async def get_status(job_id: str):
    task = AsyncResult(job_id)
    
    if task.state == 'PENDING':
        return {"state": task.state, "progress": 0, "step": "Waiting in queue..."}
    elif task.state == 'PROGRESS':
        return {
            "state": task.state, 
            "progress": task.info.get('progress', 0), 
            "step": task.info.get('step', '')
        }
    elif task.state == 'SUCCESS':
        return {"state": task.state, "progress": 100, "result": task.result}
    
    return {"state": task.state, "error": str(task.info)}
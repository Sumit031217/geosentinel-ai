from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from tasks.inference_tasks import run_change_detection_job
from celery.result import AsyncResult

router = APIRouter()

class DetectionRequest(BaseModel):
    bbox: List[float]
    date_t1: str
    date_t2: str

@router.post("/api/analysis/start")
def start_analysis(payload: DetectionRequest):
    # Dispatch to Redis queue
    task = run_change_detection_job.delay(payload.bbox, payload.date_t1, payload.date_t2)
    return {"job_id": task.id, "status": "processing"}

@router.get("/api/analysis/status/{job_id}")
def get_job_status(job_id: str):
    # Poll Redis for the current state of the job
    task_result = AsyncResult(job_id)
    
    if task_result.state == 'PENDING':
        return {"state": task_result.state, "progress": 0, "step": "Waiting in queue..."}
    
    elif task_result.state == 'PROGRESS':
        return {
            "state": task_result.state,
            "progress": task_result.info.get("progress", 0),
            "step": task_result.info.get("step", "")
        }
        
    elif task_result.state == 'SUCCESS':
        return {
            "state": task_result.state,
            "progress": 100,
            "result": task_result.result
        }
        
    return {"state": task_result.state, "error": str(task_result.info)}
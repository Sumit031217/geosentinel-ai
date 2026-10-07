from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db, Region, SatelliteImage, DetectedChange
import json

router = APIRouter()

@router.get("/api/regions/{region_id}/timeline")
def get_region_timeline(region_id: int, db: Session = Depends(get_db)):
    """Fetches all satellite imagery and associated change vectors chronologically."""
    
    # 1. Fetch all imagery for the region ordered by time
    images = db.query(SatelliteImage).filter(
        SatelliteImage.region_id == region_id
    ).order_by(SatelliteImage.acquisition_date.asc()).all()

    timeline = []
    
    # 2. For each time step, find the changes detected compared to the previous step
    for i in range(len(images)):
        current_img = images[i]
        
        step_data = {
            "date": current_img.acquisition_date.isoformat(),
            "image_url": current_img.file_path,
            "changes": None,
            "stats": {"changed_sqkm": 0, "severity": "None"}
        }

        # If there is a previous image, fetch the computed delta
        if i > 0:
            prev_img = images[i - 1]
            changes = db.query(DetectedChange).filter(
                DetectedChange.image_before == prev_img.image_id,
                DetectedChange.image_after == current_img.image_id
            ).all()
            
            # Convert PostGIS geometry back to GeoJSON for the frontend map
            feature_collection = {
                "type": "FeatureCollection",
                "features": []
            }
            total_area = 0
            
            for change in changes:
                total_area += change.area_sqkm
                # Assumes geometry was stored as ST_AsGeoJSON
                feature_collection["features"].append({
                    "type": "Feature",
                    "geometry": json.loads(change.geometry),
                    "properties": {
                        "type": change.change_type,
                        "area": change.area_sqkm,
                        "severity": change.severity_score
                    }
                })
                
            step_data["changes"] = feature_collection
            step_data["stats"]["changed_sqkm"] = round(total_area, 3)
            
        timeline.append(step_data)
        
    return {"region_id": region_id, "timeline": timeline}
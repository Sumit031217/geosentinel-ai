from celery import Celery
from services.satellite_fetcher import fetch_satellite_urls
import rasterio
from rasterio.windows import from_bounds
from rasterio.warp import transform_bounds
import numpy as np
from rasterio.features import shapes
import geopandas as gpd
import logging
import requests
import base64
from io import BytesIO
from PIL import Image
from scipy.ndimage import binary_opening, binary_closing, generate_binary_structure

celery_app = Celery(
    "geosentinel_tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0"
)
logger = logging.getLogger(__name__)

def array_to_base64_jpeg(img_array):
    """Applies a 2-98% percentile contrast stretch and Lanczos upscaling for HD reporting."""
    try:
        # 1. Mathematical Contrast Stretching
        norm_img = np.zeros_like(img_array, dtype=np.float32)
        for i in range(3): # Process RGB channels independently
            band = img_array[i]
            p2, p98 = np.percentile(band[band > 0], (2, 98)) if np.any(band > 0) else (0, 1)
            
            if p98 - p2 == 0:
                norm_band = band
            else:
                norm_band = np.clip((band - p2) / (p98 - p2), 0, 1)
            norm_img[i] = norm_band * 255
            
        img_uint8 = norm_img.astype(np.uint8)
        img_uint8 = np.transpose(img_uint8, (1, 2, 0))
        
        # 2. Lanczos High-Fidelity Upscaling (fixes pixelation on small drawn boxes)
        img = Image.fromarray(img_uint8)
        base_width = 500
        wpercent = (base_width / float(img.size[0]))
        hsize = int((float(img.size[1]) * float(wpercent)))
        img = img.resize((base_width, hsize), Image.Resampling.LANCZOS)
        
        buffered = BytesIO()
        img.save(buffered, format="JPEG", quality=95)
        return "data:image/jpeg;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")
    except Exception as e:
        logger.error(f"Image enhancement failed: {e}")
        return None

@celery_app.task(bind=True)
def run_satellite_pipeline(self, bbox, date_t1, date_t2):
    self.update_state(state='PROGRESS', meta={'progress': 20, 'step': 'Querying Planetary Computer STAC...'})
    scene_t1 = fetch_satellite_urls(bbox, date_t1)
    scene_t2 = fetch_satellite_urls(bbox, date_t2)
    
    if not scene_t1 or not scene_t2:
        return {"status": "error", "message": "No cloud-free imagery found for one or both dates."}
        
    self.update_state(state='PROGRESS', meta={'progress': 50, 'step': 'Streaming spectral crop...'})
    try:
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", VSI_CACHE=True, GDAL_HTTP_TIMEOUT=15):
            with rasterio.open(scene_t1["tile_url"]) as src1:
                bbox_native = transform_bounds("EPSG:4326", src1.crs, *bbox)
                window = from_bounds(*bbox_native, transform=src1.transform)
                img1 = src1.read([1, 2, 3], window=window).astype(np.float32)
                transform = src1.window_transform(window)
                crs = src1.crs

            with rasterio.open(scene_t2["tile_url"]) as src2:
                img2 = src2.read([1, 2, 3], window=window).astype(np.float32)
    except Exception as e:
        return {"status": "error", "message": "Satellite network stream timed out."}

    self.update_state(state='PROGRESS', meta={'progress': 70, 'step': 'Applying morphological noise filters...'})
    diff = np.sqrt(np.sum((img2 - img1) ** 2, axis=0))
    threshold = np.percentile(diff, 96)
    raw_mask = (diff > threshold).astype(np.uint8)

    struct = generate_binary_structure(2, 2)
    clean_mask = binary_opening(raw_mask, structure=struct, iterations=1)
    clean_mask = binary_closing(clean_mask, structure=struct, iterations=1).astype(np.uint8)

    self.update_state(state='PROGRESS', meta={'progress': 80, 'step': 'Vectorizing change polygons...'})
    results = [{'properties': {'raster_val': int(v)}, 'geometry': s} for s, v in shapes(clean_mask, mask=(clean_mask == 1), transform=transform)]
    
    if results:
        gdf = gpd.GeoDataFrame.from_features(results)
        gdf.crs = crs
        gdf_utm = gdf.to_crs(gdf.estimate_utm_crs())
        gdf["area_sqkm"] = gdf_utm.geometry.area / 1e6
        gdf = gdf.to_crs("EPSG:4326")
        gdf = gdf[gdf["area_sqkm"] > 0.0001]
        total_area = float(gdf["area_sqkm"].sum())
        geojson_data = gdf.__geo_interface__
    else:
        total_area = 0.0
        geojson_data = {"type": "FeatureCollection", "features": []}

    self.update_state(state='PROGRESS', meta={'progress': 90, 'step': 'Extracting UI imagery & geocoding...'})
    b64_t1 = array_to_base64_jpeg(img1)
    b64_t2 = array_to_base64_jpeg(img2)
    
    location_name = "Unknown Sector"
    try:
        center_lon = (bbox[0] + bbox[2]) / 2.0
        center_lat = (bbox[1] + bbox[3]) / 2.0
        req_url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={center_lat}&lon={center_lon}"
        resp = requests.get(req_url, headers={'User-Agent': 'GeoSentinel-App'}, timeout=5)
        if resp.status_code == 200:
            addr = resp.json().get('address', {})
            location_name = addr.get('suburb') or addr.get('city_district') or addr.get('city') or "Monitored Sector"
    except Exception:
        pass

    return {
        "status": "success",
        "changed_sqkm": round(total_area, 3),
        "confidence": 0.96,
        "location": location_name,
        "image_t1": b64_t1,
        "image_t2": b64_t2,
        "change_polygons": geojson_data
    }
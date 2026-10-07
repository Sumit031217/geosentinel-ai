import pystac_client
import planetary_computer
from datetime import datetime

def fetch_satellite_urls(bbox: list, date_range: str):
    """
    Queries open Sentinel-2 L2A imagery for an AOI.
    bbox format: [min_lon, min_lat, max_lon, max_lat]
    """
    catalog = pystac_client.Client.open(
        "https://planetarycomputer.microsoft.com/api/stac/v1",
        modifier=planetary_computer.sign_inplace,
    )
    
    search = catalog.search(
        collections=["sentinel-2-l2a"],
        bbox=bbox,
        datetime=date_range,
        query={"eo:cloud_cover": {"lt": 15}}, # Filter clouds > 15%
        sortby=[{"field": "properties.eo:cloud_cover", "direction": "asc"}]
    )
    
    items = list(search.items())
    if not items:
        return None
        
    best_scene = items[0]
    return {
        "id": best_scene.id,
        "date": best_scene.datetime.isoformat(),
        # Visual RGB URL ready for Leaflet TileLayer or Rasterio processing
        "tile_url": best_scene.assets["visual"].href 
    }
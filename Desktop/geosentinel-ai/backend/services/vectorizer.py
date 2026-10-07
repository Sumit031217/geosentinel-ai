import numpy as np
import rasterio
from rasterio.features import shapes
from shapely.geometry import shape
import geopandas as gpd

def raster_mask_to_postgis(mask_array, transform, crs, min_pixel_threshold=50):
    """
    Converts 2D binary change mask (0/1) to GeoDataFrame with areas in sq. km.
    Filters out noise using min_pixel_threshold.
    """
    mask = mask_array.astype(np.uint8)
    
    # Extract polygon geometries from raster
    results = (
        {'properties': {'raster_val': v}, 'geometry': s}
        for i, (s, v) in enumerate(shapes(mask, mask=(mask == 1), transform=transform))
    )
    
    geoms = list(results)
    if not geoms:
        return gpd.GeoDataFrame()

    gdf = gpd.GeoDataFrame.from_features(geoms)
    gdf.crs = crs
    
    # Reproject to equal-area projection for precise metric area calculations
    gdf_utm = gdf.to_crs(gdf.estimate_utm_crs())
    gdf["area_sqkm"] = gdf_utm.geometry.area / 1e6
    
    # Reproject back to standard EPSG:4326 for Leaflet/PostGIS storage
    gdf = gdf.to_crs("EPSG:4326")
    
    # Filter tiny speckle noise
    gdf = gdf[gdf["area_sqkm"] > 0.005] # Filter out changes < 5000 sq. meters
    return gdf
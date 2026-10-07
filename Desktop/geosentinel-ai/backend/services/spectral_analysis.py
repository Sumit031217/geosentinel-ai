import rasterio
import numpy as np

def calculate_spectral_indices(sentinel_geotiff_path):
    """
    Reads a multispectral GeoTIFF and calculates environmental indices.
    Assumes standard Sentinel-2 stack: B3 (Green), B4 (Red), B8 (NIR), B11 (SWIR)
    """
    with rasterio.open(sentinel_geotiff_path) as src:
        green = src.read(3).astype(float)
        red = src.read(4).astype(float)
        nir = src.read(8).astype(float)
        swir = src.read(11).astype(float)

    # Disable divide-by-zero warnings for empty pixels
    np.seterr(divide='ignore', invalid='ignore')

    # 1. Vegetation (NDVI): Values > 0.2 indicate vegetation
    ndvi = (nir - red) / (nir + red)
    
    # 2. Water (NDWI): Positive values indicate water
    ndwi = (green - nir) / (green + nir)
    
    # 3. Built-up/Urban (NDBI): Positive values indicate concrete/bare soil
    ndbi = (swir - nir) / (swir + nir)

    # Clean up NaN values generated from edge padding
    return {
        "ndvi": np.nan_to_num(ndvi, nan=0.0),
        "ndwi": np.nan_to_num(ndwi, nan=0.0),
        "ndbi": np.nan_to_num(ndbi, nan=0.0)
    }

def detect_deforestation(ndvi_t1, ndvi_t2, threshold=0.3):
    """
    Returns a binary mask where healthy vegetation in T1 dropped significantly in T2.
    """
    deforestation_mask = (ndvi_t1 > 0.4) & (ndvi_t2 < (ndvi_t1 - threshold))
    return deforestation_mask.astype(np.uint8)
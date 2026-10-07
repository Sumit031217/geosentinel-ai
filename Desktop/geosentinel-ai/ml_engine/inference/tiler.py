import torch
import numpy as np
import rasterio
from rasterio.windows import Window
from ml_engine.models.siamese_unet import SiameseChangeUNet

def sliding_window_inference(img_t1_path, img_t2_path, model, device, tile_size=1024, overlap=256):
    """
    Runs bitemporal change detection over massive GeoTIFFs using overlapping patches.
    """
    model.eval()
    stride = tile_size - overlap
    
    with rasterio.open(img_t1_path) as src1, rasterio.open(img_t2_path) as src2:
        width, height = src1.width, src1.height
        meta = src1.meta.copy()
        
        # Initialize an empty mask to hold the stitched predictions
        full_mask = np.zeros((height, width), dtype=np.float32)
        weight_map = np.zeros((height, width), dtype=np.float32)
        
        # Sliding window loop
        for y in range(0, height, stride):
            for x in range(0, width, stride):
                
                # Prevent window from exceeding image bounds
                w = min(tile_size, width - x)
                h = min(tile_size, height - y)
                window = Window(x, y, w, h)
                
                # Read the specific tile from disk (saves RAM)
                t1_tile = src1.read([1, 2, 3], window=window)
                t2_tile = src2.read([1, 2, 3], window=window)
                
                # Convert to tensors
                t1_tensor = torch.from_numpy(t1_tile).unsqueeze(0).float().to(device)
                t2_tensor = torch.from_numpy(t2_tile).unsqueeze(0).float().to(device)
                
                with torch.no_grad():
                    # Run inference on the tile
                    logits = model(t1_tensor, t2_tensor)
                    prob_mask = torch.sigmoid(logits).squeeze().cpu().numpy()
                
                # Handle edge cases where the tile is smaller than tile_size
                if prob_mask.shape != (h, w):
                    prob_mask = prob_mask[:h, :w]
                
                # Add to the full mask using a blending weight (to smooth overlaps)
                full_mask[y:y+h, x:x+w] += prob_mask
                weight_map[y:y+h, x:x+w] += 1.0

    # Average the overlapping areas and convert to a binary mask
    full_mask = full_mask / weight_map
    binary_mask = (full_mask > 0.5).astype(np.uint8)
    
    # Update metadata to output a single-band mask
    meta.update({"count": 1, "dtype": 'uint8'})
    return binary_mask, meta
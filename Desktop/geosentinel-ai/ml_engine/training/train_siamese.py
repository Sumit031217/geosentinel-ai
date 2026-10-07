import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchgeo.datasets import LEVIRCDPlus
from torchvision import transforms
from ml_engine.models.siamese_unet import SiameseChangeUNet

class DiceBCELoss(nn.Module):
    def __init__(self, weight=None, size_average=True):
        super(DiceBCELoss, self).__init__()
        self.bce_loss = nn.BCEWithLogitsLoss()

    def forward(self, inputs, targets, smooth=1):
        # 1. Compute BCE Loss
        bce = self.bce_loss(inputs, targets)
        
        # 2. Compute Dice Loss (measures IoU/Overlap)
        inputs_sigmoid = torch.sigmoid(inputs)
        inputs_flat = inputs_sigmoid.view(-1)
        targets_flat = targets.view(-1)
        
        intersection = (inputs_flat * targets_flat).sum()                            
        dice_loss = 1 - (2.*intersection + smooth) / (inputs_flat.sum() + targets_flat.sum() + smooth)  
        
        # Combine both
        return bce + dice_loss

def train_model():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = SiameseChangeUNet(in_channels=3, num_classes=1).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
    criterion = DiceBCELoss()

    # Load LEVIR-CD dataset using TorchGeo
    train_dataset = LEVIRCDPlus(root="data/LEVIRCD", split="train", download=True)
    
    # Custom collate function to handle T1, T2, and Mask
    def collate_fn(batch):
        t1 = torch.stack([item["image"][0:3] for item in batch]) # Time 1 (RGB)
        t2 = torch.stack([item["image"][3:6] for item in batch]) # Time 2 (RGB)
        masks = torch.stack([item["mask"] for item in batch]).float()
        return t1, t2, masks

    dataloader = DataLoader(train_dataset, batch_size=4, shuffle=True, collate_fn=collate_fn)

    model.train()
    for epoch in range(1, 51): # 50 Epochs
        epoch_loss = 0
        for t1, t2, masks in dataloader:
            t1, t2, masks = t1.to(device), t2.to(device), masks.to(device)
            
            optimizer.zero_grad()
            outputs = model(t1, t2)
            
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()
            
        print(f"Epoch {epoch} | Loss: {epoch_loss/len(dataloader):.4f}")
        torch.save(model.state_dict(), f"ml_engine/weights/geosentinel_epoch_{epoch}.pth")

if __name__ == "__main__":
    train_model()
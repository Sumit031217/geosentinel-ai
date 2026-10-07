import torch
import torch.nn as nn
import torchvision.models as models

class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True)
        )
    def forward(self, x):
        return self.conv(x)

class SiameseChangeUNet(nn.Module):
    def __init__(self, in_channels=3, num_classes=1):
        super().__init__()
        # Shared Encoder (Weight-tied)
        self.enc1 = ConvBlock(in_channels, 64)
        self.enc2 = ConvBlock(64, 128)
        self.enc3 = ConvBlock(128, 256)
        self.pool = nn.MaxPool2d(2, 2)
        
        # Decoder (Processes differential feature maps)
        self.up2 = nn.ConvTranspose2d(256, 128, 2, stride=2)
        self.dec2 = ConvBlock(256, 128)
        self.up1 = nn.ConvTranspose2d(128, 64, 2, stride=2)
        self.dec1 = ConvBlock(128, 64)
        
        self.final = nn.Conv2d(64, num_classes, kernel_size=1)

    def forward_single(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        return e1, e2, e3

    def forward(self, t1, t2):
        # Extract features symmetrically
        e1_t1, e2_t1, e3_t1 = self.forward_single(t1)
        e1_t2, e2_t2, e3_t2 = self.forward_single(t2)
        
        # Compute multi-scale absolute feature differences
        diff3 = torch.abs(e3_t1 - e3_t2)
        diff2 = torch.abs(e2_t1 - e2_t2)
        diff1 = torch.abs(e1_t1 - e1_t2)
        
        # Decode differences into change mask
        d2 = self.up2(diff3)
        d2 = self.dec2(torch.cat([d2, diff2], dim=1))
        d1 = self.up1(d2)
        d1 = self.dec1(torch.cat([d1, diff1], dim=1))
        
        return self.final(d1)
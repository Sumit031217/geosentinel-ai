import React, { useState } from 'react';
import { MapContainer, ImageOverlay, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AOIDrawer } from './AOIDrawer';
import type { FeatureCollection } from 'geojson';

interface BeforeAfterMapProps {
  t1ImageUrl: string; // Base image (Before)
  t2ImageUrl: string; // Top image (After)
  bounds: L.LatLngBoundsExpression; // Geographic boundaries of the image
  changeGeoJson?: FeatureCollection | null;
  onDraw?: (geoJson: any) => void;
}

export const BeforeAfterMap: React.FC<BeforeAfterMapProps> = ({ 
  t1ImageUrl, 
  t2ImageUrl, 
  bounds, 
  changeGeoJson,
  onDraw 
}) => {
  const [sliderPosition, setSliderPosition] = useState(50); // Percentage (0-100)

  return (
    <div className="relative w-full h-[650px] border border-slate-800 rounded-lg overflow-hidden bg-slate-950 select-none">
      
      {/* 1. Base Leaflet Map */}
      <MapContainer 
        bounds={bounds} 
        zoom={13} 
        className="w-full h-full z-0"
        zoomControl={false} // Disable default zoom to prevent slider overlap
      >
        {/* The "Before" Image (Bottom Layer) */}
        <ImageOverlay url={t1ImageUrl} bounds={bounds} zIndex={10} />

        {/* The "After" Image (Top Layer) - Clipped dynamically by React state */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            pointerEvents: 'none', // Let map interactions pass through
            clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`
          }}
        >
          <ImageOverlay url={t2ImageUrl} bounds={bounds} />
        </div>

        {/* Change Detection Overlay (Red Polygons) */}
        {changeGeoJson && (
          <GeoJSON
            data={changeGeoJson}
            style={() => ({
              color: '#ef4444',
              weight: 2,
              fillColor: '#ef4444',
              fillOpacity: 0.4,
            })}
          />
        )}

        {/* Drawing Hook (Only active if an onDraw handler is passed) */}
        {onDraw && <AOIDrawer onPolygonDrawn={onDraw} />}
      </MapContainer>

      {/* 2. React UI Slider Control */}
      <div className="absolute top-0 left-0 w-full h-full z-[1000] pointer-events-none flex flex-col justify-center">
        <input
          type="range"
          min="0"
          max="100"
          value={sliderPosition}
          onChange={(e) => setSliderPosition(Number(e.target.value))}
          className="w-full appearance-none bg-transparent cursor-ew-resize pointer-events-auto h-full m-0"
          style={{
            /* CSS hack to make only the thumb visible as the vertical divider */
            WebkitAppearance: 'none',
          }}
        />
        
        {/* Visual Divider Line */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] pointer-events-none"
          style={{ left: `calc(${sliderPosition}% - 2px)` }}
        >
          {/* Slider Handle Knob */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
            <div className="w-1 h-4 border-l border-r border-slate-400 mx-auto" />
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-4 left-4 z-[1000] bg-slate-900/80 backdrop-blur text-white px-3 py-1 rounded text-xs font-mono font-bold shadow">
        BEFORE (T1)
      </div>
      <div className="absolute top-4 right-4 z-[1000] bg-slate-900/80 backdrop-blur text-white px-3 py-1 rounded text-xs font-mono font-bold shadow">
        AFTER (T2)
      </div>
    </div>
  );
};
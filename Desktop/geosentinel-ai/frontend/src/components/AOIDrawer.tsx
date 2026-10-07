import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

interface AOIDrawerProps {
  onPolygonDrawn: (geoJson: Feature<Polygon | MultiPolygon>) => void;
}

export const AOIDrawer: React.FC<AOIDrawerProps> = ({ onPolygonDrawn }) => {
  const map = useMap();

  useEffect(() => {
    // Type assertion to access Geoman (.pm) on Leaflet Map
    const geomanMap = map as unknown as { pm: any } & L.Map;

    if (!geomanMap.pm) return;

    geomanMap.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawCircle: false,
      drawText: false,
      drawRectangle: true,
      drawPolygon: true,
      editMode: true,
      removalMode: true,
    });

    const handleCreate = (e: { layer: L.Layer }) => {
      const layer = e.layer as L.Polygon & { toGeoJSON: () => Feature<Polygon | MultiPolygon> };
      
      if (typeof layer.toGeoJSON === 'function') {
        const geoJsonData = layer.toGeoJSON();
        onPolygonDrawn(geoJsonData);
      }

      // Remove older polygons so only one AOI is active at a time
      map.eachLayer((l) => {
        if (l !== e.layer && l instanceof L.Polygon) {
          map.removeLayer(l);
        }
      });
    };

    geomanMap.on('pm:create', handleCreate);

    return () => {
      geomanMap.pm.removeControls();
      geomanMap.off('pm:create', handleCreate);
    };
  }, [map, onPolygonDrawn]);

  return null;
};
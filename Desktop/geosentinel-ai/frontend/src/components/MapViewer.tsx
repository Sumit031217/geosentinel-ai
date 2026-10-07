import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, ImageOverlay } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature, Polygon, MultiPolygon, FeatureCollection } from 'geojson';
import { AOIDrawer } from './AOIDrawer';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export interface MapViewerProps {
  changeGeoJson?: FeatureCollection | null;
  t1ImageUrl?: string;
  t2ImageUrl?: string;
  bounds?: L.LatLngBoundsExpression;
  dateT1: string;
  dateT2: string;
  onPolygonDrawn?: (bbox: [number, number, number, number]) => void;
  onAnalysisComplete?: (result: any) => void;
}

interface JobStatus {
  state: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE';
  progress: number;
  step?: string;
  result?: any;
  error?: string;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  changeGeoJson,
  t1ImageUrl,
  t2ImageUrl,
  bounds,
  dateT1,
  dateT2,
  onPolygonDrawn,
  onAnalysisComplete,
}) => {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [activeGeoJson, setActiveGeoJson] = useState<FeatureCollection | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onAnalysisComplete);
  
  useEffect(() => {
    onCompleteRef.current = onAnalysisComplete;
  }, [onAnalysisComplete]);

  useEffect(() => {
    if (changeGeoJson) setActiveGeoJson(changeGeoJson);
  }, [changeGeoJson]);

  const handlePolygonDrawn = async (polygonGeoJson: Feature<Polygon | MultiPolygon>) => {
    const layer = L.geoJSON(polygonGeoJson);
    const b = layer.getBounds();
    const bbox: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];

    if (onPolygonDrawn) {
      onPolygonDrawn(bbox);
      return;
    }

    setActiveGeoJson(null);
    setJobStatus({ state: 'PENDING', progress: 5, step: `Dispatching timeline task...` });

    try {
      const response = await fetch('/api/analysis/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bbox, date_t1: dateT1, date_t2: dateT2 }),
      });
      if (!response.ok) throw new Error('Analysis request failed');
      const data = await response.json();
      setJobId(data.job_id);
    } catch (err) {
      setJobStatus({ state: 'FAILURE', progress: 0, error: 'Failed to communicate with backend.' });
    }
  };

  useEffect(() => {
    if (!jobId) return;
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/analysis/status/${jobId}`);
        const data = await res.json();

        if (data.state === 'SUCCESS') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setJobStatus({ state: 'SUCCESS', progress: 100, step: 'Telemetry processed successfully.' });
          
          const finalResult = data.result || {};
          if (finalResult.change_polygons) setActiveGeoJson(finalResult.change_polygons);
          onCompleteRef.current?.(finalResult);
          
        } else if (data.state === 'FAILURE') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setJobStatus(data);
        } else {
          setJobStatus(data);
        }
      } catch (error) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }
    }, 1200);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [jobId]);

  const defaultBounds: L.LatLngBoundsExpression = bounds || [[18.9, 72.7], [19.3, 73.0]];

  return (
    <div id="map-capture-node" className="relative w-full h-full min-h-[600px] border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
      {jobStatus && (
        <div className="absolute bottom-6 left-6 z-[1000] bg-slate-900 border border-slate-700 p-4 rounded-xl w-84 text-white shadow-2xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {jobStatus.state === 'SUCCESS' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : jobStatus.state === 'FAILURE' ? <AlertCircle className="w-4 h-4 text-rose-400" /> : <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
              <span className="text-xs font-semibold tracking-wide">
                {jobStatus.state === 'SUCCESS' ? 'Analysis Complete' : jobStatus.state === 'FAILURE' ? 'Pipeline Failed' : 'Processing Imagery'}
              </span>
            </div>
            <span className="text-xs font-mono text-indigo-400 font-bold">{jobStatus.progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mb-2 overflow-hidden">
            <div className={`h-full transition-all duration-500 rounded-full ${jobStatus.state === 'SUCCESS' ? 'bg-emerald-500' : jobStatus.state === 'FAILURE' ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${jobStatus.progress}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 font-mono truncate">{jobStatus.error || jobStatus.step || 'Running background tasks...'}</p>
        </div>
      )}

      <MapContainer center={[19.076, 72.8777]} zoom={12} className="w-full h-full" preferCanvas={true}>
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Esri Satellite" crossOrigin="anonymous" />
        <AOIDrawer onPolygonDrawn={handlePolygonDrawn} />
        {activeGeoJson && (
          <GeoJSON key={JSON.stringify(activeGeoJson)} data={activeGeoJson} style={() => ({ color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.45 })} />
        )}
      </MapContainer>
    </div>
  );
};
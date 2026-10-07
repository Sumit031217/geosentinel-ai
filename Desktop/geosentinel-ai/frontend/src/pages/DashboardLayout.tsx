import React, { useState } from 'react';
import { MapViewer } from '../components/MapViewer';
import { Activity, Map as MapIcon, TriangleAlert, FileText, MessageSquare, BarChart3, Calendar, Image as ImageIcon } from 'lucide-react';
import type { FeatureCollection } from 'geojson';
import { AIChatPanel } from '../components/AIChatPanel';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

interface AnalysisResult {
  changed_sqkm: number;
  change_polygons?: FeatureCollection;
  confidence?: number;
  location?: string;
  image_t1?: string | null;
  image_t2?: string | null;
  summary_text?: string;
}

export const DashboardLayout: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'chat'>('analytics');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2025-01-01');
  
  const getStacWindow = (baseDate: string) => {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + 3);
    return `${baseDate}/${d.toISOString().split('T')[0]}`;
  };

  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult>({
    changed_sqkm: 0,
    confidence: 89,
    summary_text: 'Draw a rectangle or polygon on the map to trigger automated change detection over Sentinel-2 imagery.',
  });

  const handleAnalysisComplete = (result: any) => {
    setCurrentAnalysis({
      changed_sqkm: result?.changed_sqkm || 0,
      change_polygons: result?.change_polygons,
      confidence: Math.round((result?.confidence || 0.96) * 100),
      location: result?.location || 'Unknown Sector',
      image_t1: result?.image_t1,
      image_t2: result?.image_t2,
      summary_text: `Analysis complete. Detected approximately ${result?.changed_sqkm || 0} km² of physical surface variation across the selected region.`,
    });
  };

  const handleExportPDF = async () => {
    const mapElement = document.getElementById('map-capture-node');
    if (!mapElement) return;
    
    setIsExporting(true);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Ensure UI is stable
    
    try {
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // 1. Report Header
      pdf.setFillColor(2, 6, 23); 
      pdf.rect(0, 0, pageWidth, 40, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.text('GeoSentinel AI — Operational Report', 15, 20);
      pdf.setFontSize(10);
      pdf.setTextColor(156, 163, 175); 
      pdf.text(`Target Area: ${currentAnalysis.location || 'Unknown'}  |  Generated: ${new Date().toISOString().split('T')[0]}`, 15, 30);
      
      // 2. Map Snapshot Capture
      const mapCanvas = await html2canvas(mapElement, { scale: 1.5, useCORS: true, allowTaint: false });
      const mapImgData = mapCanvas.toDataURL('image/jpeg', 0.9);
      const mapHeight = (mapCanvas.height * (pageWidth - 30)) / mapCanvas.width;
      pdf.addImage(mapImgData, 'JPEG', 15, 45, pageWidth - 30, mapHeight);
      
      // 3. Analytics Summary (Native Text)
      let currentY = 45 + mapHeight + 15;
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.text('Detection Analytics', 15, currentY);
      
      currentY += 10;
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Timeline Comparison: ${startDate} to ${endDate}`, 15, currentY);
      currentY += 7;
      pdf.text(`Total Physical Surface Change: ${currentAnalysis.changed_sqkm} km²`, 15, currentY);
      currentY += 7;
      pdf.text(`AI Model Confidence: ${currentAnalysis.confidence}%`, 15, currentY);
      
      currentY += 15;
      pdf.setFont(undefined, 'bold');
      pdf.text('Intelligence Brief', 15, currentY);
      currentY += 7;
      pdf.setFont(undefined, 'normal');
      const splitBrief = pdf.splitTextToSize(currentAnalysis.summary_text || '', pageWidth - 30);
      pdf.text(splitBrief, 15, currentY);
      
      // 4. Upscaled Raw Satellite Captures
      currentY += (splitBrief.length * 7) + 10;
      if (currentAnalysis.image_t1 && currentAnalysis.image_t2) {
        pdf.setFont(undefined, 'bold');
        pdf.text('Raw Satellite Captures (T1 Baseline vs T2 Present)', 15, currentY);
        currentY += 5;
        
        const imgWidth = (pageWidth - 40) / 2;
        pdf.addImage(currentAnalysis.image_t1, 'JPEG', 15, currentY, imgWidth, imgWidth);
        pdf.addImage(currentAnalysis.image_t2, 'JPEG', 25 + imgWidth, currentY, imgWidth, imgWidth);
      }
      
      pdf.save(`GeoSentinel_Report_${startDate}_vs_${endDate}.pdf`);
    } catch (error) {
      alert(`Export failed.`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans">
      <div className="w-16 flex flex-col items-center py-6 bg-slate-900 border-r border-slate-800">
        <MapIcon className="w-6 h-6 text-indigo-500 mb-8" />
        <Activity className="w-5 h-5 text-slate-400 mb-6 hover:text-white cursor-pointer" />
        <FileText className="w-5 h-5 text-slate-400 mb-6 hover:text-white cursor-pointer" />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex-shrink-0 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900">
          <h1 className="font-semibold tracking-wide flex items-center gap-3">GeoSentinel AI — Operational Monitor</h1>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 bg-slate-950 px-4 py-2 rounded border border-slate-800">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">T1 Baseline</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-white text-xs outline-none cursor-pointer" />
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">T2 Present</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-white text-xs outline-none cursor-pointer" />
              </div>
            </div>
            <button onClick={handleExportPDF} disabled={isExporting} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 px-5 py-2 rounded text-sm font-medium transition-colors shadow-lg">
              {isExporting ? 'Generating PDF...' : 'Export Report'}
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden bg-slate-950">
          <main className="flex-1 p-4 relative overflow-hidden">
            <MapViewer changeGeoJson={currentAnalysis.change_polygons} onAnalysisComplete={handleAnalysisComplete} dateT1={getStacWindow(startDate)} dateT2={getStacWindow(endDate)} />
          </main>

          <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full flex-shrink-0">
            <div className="flex border-b border-slate-800 bg-slate-950 flex-shrink-0">
              <button onClick={() => setActiveTab('analytics')} className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${activeTab === 'analytics' ? 'border-indigo-500 text-white bg-slate-900/50' : 'border-transparent text-slate-400 hover:text-slate-200'}`}><BarChart3 className="w-3.5 h-3.5" /> Analytics</button>
              <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${activeTab === 'chat' ? 'border-indigo-500 text-white bg-slate-900/50' : 'border-transparent text-slate-400 hover:text-slate-200'}`}><MessageSquare className="w-3.5 h-3.5" /> AI Assistant</button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {activeTab === 'analytics' ? (
                <div className="p-5 flex-1 flex flex-col overflow-y-auto">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Detection Analytics</h2>
                  <div className="bg-slate-950 border border-slate-800 rounded p-4 mb-4 flex-shrink-0">
                    <div className="text-slate-400 text-xs mb-1">Total Area Changed</div>
                    <div className="text-2xl font-light text-white">{currentAnalysis.changed_sqkm} <span className="text-sm text-slate-500">km²</span></div>
                  </div>

                  {currentAnalysis.image_t1 && currentAnalysis.image_t2 && (
                    <div className="bg-slate-950 border border-slate-800 rounded p-4 mb-4 flex-shrink-0">
                      <div className="flex items-center gap-2 mb-3">
                        <ImageIcon className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-medium text-white">Raw Satellite Captures</span>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">T1: {startDate}</div>
                          <img src={currentAnalysis.image_t1} alt="T1 Crop" className="w-full h-24 object-cover rounded border border-slate-800" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">T2: {endDate}</div>
                          <img src={currentAnalysis.image_t2} alt="T2 Crop" className="w-full h-24 object-cover rounded border border-slate-800" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-950 border border-slate-800 rounded p-4 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <TriangleAlert className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-white">AI Intelligence Brief</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">{currentAnalysis.summary_text}</p>
                    <div className="text-[11px] text-indigo-400 font-mono mb-1">Target Area: {currentAnalysis.location || 'Pending'}</div>
                    <div className="text-[11px] text-indigo-400 font-mono">Model Confidence: {currentAnalysis.confidence}%</div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-hidden h-full"><AIChatPanel analysis={currentAnalysis} /></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
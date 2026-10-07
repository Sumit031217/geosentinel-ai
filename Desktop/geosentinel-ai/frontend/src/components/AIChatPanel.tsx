import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, MapPin } from 'lucide-react';
import type { FeatureCollection } from 'geojson';

interface AnalysisResult {
  changed_sqkm: number;
  change_polygons?: FeatureCollection;
  confidence?: number;
  location?: string;
  summary_text?: string;
}

export const AIChatPanel: React.FC<{ analysis: AnalysisResult }> = ({ analysis }) => {
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([
    {
      role: 'ai',
      text: 'I am your GeoSentinel Intelligence Assistant. Draw a polygon on the map, and I will generate a temporal comparison of the structural changes detected.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setIsTyping(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500)); 

      let aiResponse = '';
      if (analysis.changed_sqkm > 0) {
        aiResponse = `Intelligence Brief: ${analysis.location || 'Unknown Area'}\n\n` +
          `• Past (T1): Baseline surface established. Spectral signatures indicate undisturbed terrain.\n` +
          `• Present (T2): ${analysis.changed_sqkm} km² of structural modification detected. Sharp Euclidean shifts in RGB channels indicate ground excavation or new high-albedo concrete infrastructure.\n\n` +
          `Model Confidence: ${analysis.confidence}%`;
      } else {
        aiResponse = `No significant surface changes detected in ${analysis.location || 'this sector'} between the two timelines. Try expanding the bounding box.`;
      }

      setMessages((prev) => [...prev, { role: 'ai', text: aiResponse }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: 'Error: Unable to reach the intelligence API.' },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="bg-slate-900 border-b border-slate-800 p-3 flex-shrink-0 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {analysis.location || 'Awaiting Target'}
        </span>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${analysis.changed_sqkm > 0 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
          {analysis.changed_sqkm > 0 ? `${analysis.changed_sqkm} km² Detected` : 'Standby'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-7 h-7 flex-shrink-0 rounded flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-800'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-indigo-400" />}
            </div>
            <div className={`px-3 py-2 text-sm rounded-lg max-w-[85%] whitespace-pre-wrap ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3 flex-row">
            <div className="w-7 h-7 flex-shrink-0 rounded bg-slate-800 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-slate-900 border-t border-slate-800 flex-shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Analyze this sector..."
            className="w-full bg-slate-950 border border-slate-800 rounded-md py-2.5 pl-3 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="absolute right-2 p-1.5 text-slate-400 hover:text-indigo-400 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
import { useState } from 'react';
import { useCanvasStore, type CanvasTool } from '../../store/canvasStore';
import { useFileStore } from '../../store/fileStore';
import { useParams } from 'react-router-dom';
import { layoutFlowchart } from '../../utils/flowchartLayout';
import { 
  MdNearMe, 
  MdCropSquare, 
  MdRadioButtonUnchecked, 
  MdDiamond, 
  MdArrowRightAlt, 
  MdDelete, 
  MdAutoAwesome, 
  MdAccountTree 
} from 'react-icons/md';

interface ToolDef {
  tool: CanvasTool;
  icon: React.ElementType;
  label: string;
}

const tools: ToolDef[] = [
  { tool: 'select', icon: MdNearMe, label: 'Select' },
  { tool: 'rect', icon: MdCropSquare, label: 'Process' },
  { tool: 'diamond', icon: MdDiamond, label: 'Condition' },
  { tool: 'circle', icon: MdRadioButtonUnchecked, label: 'Start / End' },
  { tool: 'arrow', icon: MdArrowRightAlt, label: 'Connector' },
];

const SUGGESTIONS = ['Loop Flow', 'If / Else Logic', 'Function Architecture', 'Error Flow'];

function CanvasToolbar() {
  const { tool, setTool, selectedId, deleteSelected, shapes, arrows, setGraph } = useCanvasStore();

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const files = useFileStore((state) => state.files);
  const { roomId } = useParams<{ roomId: string }>();

  const API_BASE = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://streamsync-cxox.onrender.com')).replace(/\/$/, '');

  const executeAIGenerate = async (customPrompt?: string) => {
    const activePrompt = customPrompt || prompt;
    if (!activePrompt.trim() || !roomId) return;
    setIsGenerating(true);
    
    try {
      const response = await fetch(`${API_BASE}/api/v1/ai/flowchart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          prompt: activePrompt,
          files: files.map(f => ({ name: f.name, content: f.content }))
        })
      });

      const data = await response.json();
      if (data.success && data.data) {
        const { shapes: rawShapes, arrows: rawArrows } = data.data;
        
        // Dagre hierarchical layout
        const currentShapes = useCanvasStore.getState().shapes;
        const currentArrows = useCanvasStore.getState().arrows;

        // If existing shapes exist, place the new flowchart to the right
        let offsetX = 160;
        let offsetY = 100;
        if (currentShapes.length > 0) {
          const maxX = Math.max(...currentShapes.map((s) => s.x + s.width));
          offsetX = maxX + 120;
        }

        const { shapes: generatedShapes, arrows: generatedArrows } = layoutFlowchart(
          rawShapes || [],
          rawArrows || [],
          { marginX: offsetX, marginY: offsetY }
        );

        setGraph(
          [...currentShapes, ...generatedShapes],
          [...currentArrows, ...generatedArrows]
        );
        setPrompt('');
      } else {
        alert(`Failed to generate flowchart: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error connecting to AI: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoAlign = () => {
    if (shapes.length === 0) return;
    const result = layoutFlowchart(shapes, arrows, { marginX: 160, marginY: 100 });
    setGraph(result.shapes, result.arrows);
  };

  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2.5 z-50">
      
      {/* Quick Suggestion Chips */}
      {shapes.length === 0 && !isGenerating && (
        <div className="flex items-center gap-1.5 bg-surface-container-highest/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-outline-variant/20 shadow-sm animate-fade-in">
          <span className="text-[11px] text-on-surface-variant font-medium px-1">Quick:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface/80 text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors border border-outline-variant/30"
              onClick={() => {
                setPrompt(s);
                executeAIGenerate(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* AI Prompt Bar */}
      <div className="bg-surface-container-highest/85 backdrop-blur-xl border border-outline-variant/40 rounded-full py-1.5 px-3 flex items-center gap-2 shadow-[0_12px_45px_rgba(0,0,0,0.65)] w-[440px] transition-all focus-within:border-primary/60 focus-within:shadow-[0_12px_45px_rgba(99,102,241,0.25)]">
        <MdAutoAwesome className="text-primary ml-1 shrink-0" size={19} />
        <input 
          type="text" 
          placeholder="Ask AI to draw a flowchart (e.g. for loop logic)..."
          className="flex-1 bg-transparent border-none outline-none text-body-sm text-on-surface placeholder:text-on-surface-variant/45 ml-1"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && executeAIGenerate()}
          disabled={isGenerating}
        />
        <button 
          className={`px-3.5 py-1 rounded-full text-label-sm font-semibold transition-all shrink-0 ${isGenerating || !prompt.trim() ? 'bg-surface-variant/60 text-on-surface-variant/40 cursor-not-allowed' : 'bg-primary text-on-primary hover:bg-primary/90 shadow-sm'}`}
          onClick={() => executeAIGenerate()}
          disabled={isGenerating || !prompt.trim()}
        >
          {isGenerating ? 'Drawing…' : 'Generate'}
        </button>
      </div>

      {/* Tools Bar */}
      <div className="bg-surface-container-highest/85 backdrop-blur-xl border border-outline-variant/40 rounded-full p-1.5 flex items-center gap-1 shadow-lg">
        {tools.map((t) => (
          <button
            key={t.tool}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${tool === t.tool ? 'bg-primary text-on-primary shadow-sm scale-105' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/60'}`}
            onClick={() => setTool(t.tool)}
            title={t.label}
          >
            <t.icon size={18} />
          </button>
        ))}

        <div className="w-[1px] h-5 bg-outline-variant/40 my-auto mx-1" />

        {/* Auto Layout DAG Re-alignment */}
        <button
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${shapes.length === 0 ? 'opacity-30 cursor-not-allowed' : 'text-on-surface-variant hover:text-primary hover:bg-primary/10'}`}
          onClick={handleAutoAlign}
          disabled={shapes.length === 0}
          title="Auto-Layout (Hierarchical DAG)"
        >
          <MdAccountTree size={18} />
        </button>

        <div className="w-[1px] h-5 bg-outline-variant/40 my-auto mx-1" />

        {/* Delete */}
        <button
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${!selectedId ? 'opacity-30 cursor-not-allowed' : 'text-error hover:bg-error/15'}`}
          onClick={deleteSelected}
          disabled={!selectedId}
          title="Delete Selected"
        >
          <MdDelete size={18} />
        </button>
      </div>
    </div>
  );
}

export default CanvasToolbar;

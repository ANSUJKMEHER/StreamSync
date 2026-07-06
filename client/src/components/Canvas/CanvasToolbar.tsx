import { useState } from 'react';
import { useCanvasStore, type CanvasTool, type CanvasShape, type CanvasArrow, nextShapeColor } from '../../store/canvasStore';
import { useFileStore } from '../../store/fileStore';
import { useParams } from 'react-router-dom';
import { MdNearMe, MdCropSquare, MdRadioButtonUnchecked, MdArrowRightAlt, MdDelete, MdAutoAwesome } from 'react-icons/md';

interface ToolDef {
  tool: CanvasTool;
  icon: React.ElementType;
  label: string;
}

const tools: ToolDef[] = [
  { tool: 'select', icon: MdNearMe, label: 'Select' },
  { tool: 'rect', icon: MdCropSquare, label: 'Rectangle' },
  { tool: 'circle', icon: MdRadioButtonUnchecked, label: 'Circle' },
  { tool: 'arrow', icon: MdArrowRightAlt, label: 'Arrow' },
];

function CanvasToolbar() {
  const { tool, setTool, selectedId, deleteSelected } = useCanvasStore();

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const files = useFileStore((state) => state.files);
  const { roomId } = useParams<{ roomId: string }>();

  const handleAIGenerate = async () => {
    if (!prompt.trim() || !roomId) return;
    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/ai/flowchart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          prompt,
          files: files.map(f => ({ name: f.name, content: f.content }))
        })
      });

      const data = await response.json();
      if (data.success && data.data) {
        const { shapes, arrows } = data.data;
        
        // Simple grid layout algorithm
        const generatedShapes: CanvasShape[] = (shapes || []).map((s: any, idx: number) => {
          const col = idx % 4;
          const row = Math.floor(idx / 4);
          return {
            id: s.id || `shape-${Date.now()}-${idx}`,
            type: s.type === 'circle' ? 'circle' : 'rect',
            x: 200 + col * 200,
            y: 200 + row * 150,
            width: 140,
            height: 60,
            label: s.label || 'Node',
            fill: nextShapeColor(),
          };
        });

        const generatedArrows: CanvasArrow[] = (arrows || []).map((a: any, idx: number) => ({
          id: a.id || `arrow-${Date.now()}-${idx}`,
          fromId: a.fromId,
          toId: a.toId,
        }));

        // Merge with existing
        const currentShapes = useCanvasStore.getState().shapes;
        const currentArrows = useCanvasStore.getState().arrows;
        useCanvasStore.getState().setGraph(
          [...currentShapes, ...generatedShapes],
          [...currentArrows, ...generatedArrows]
        );
        setPrompt('');
      } else {
        alert('Failed to generate flowchart');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to AI');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-3 z-50">
      
      {/* AI Prompt Bar */}
      <div className="bg-surface-container-highest/80 backdrop-blur-xl border border-outline-variant/30 rounded-full py-1.5 px-3 flex items-center gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] w-[400px]">
        <MdAutoAwesome className="text-primary ml-1" size={18} />
        <input 
          type="text" 
          placeholder="Ask AI to draw a flowchart..."
          className="flex-1 bg-transparent border-none outline-none text-body-md text-on-surface placeholder:text-on-surface-variant/50 ml-1"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAIGenerate()}
          disabled={isGenerating}
        />
        <button 
          className={`px-3 py-1 rounded-full text-label-md font-medium transition-colors ${isGenerating || !prompt.trim() ? 'bg-surface-variant text-on-surface-variant/50 cursor-not-allowed' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
          onClick={handleAIGenerate}
          disabled={isGenerating || !prompt.trim()}
        >
          {isGenerating ? 'Drawing...' : 'Generate'}
        </button>
      </div>

      {/* Tools Bar */}
      <div className="bg-surface-container-highest/80 backdrop-blur-xl border border-outline-variant/30 rounded-full p-1.5 flex gap-1 shadow-lg">
        {tools.map((t) => (
          <button
            key={t.tool}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${tool === t.tool ? 'bg-primary text-on-primary shadow-inner' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'}`}
            onClick={() => setTool(t.tool)}
            title={t.label}
          >
            <t.icon size={20} />
          </button>
        ))}

        <div className="w-[1px] h-6 bg-outline-variant/40 my-auto mx-1" />

        <button
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${!selectedId ? 'opacity-30 cursor-not-allowed' : 'text-error hover:bg-error/10'}`}
          onClick={deleteSelected}
          disabled={!selectedId}
          title="Delete Selected"
        >
          <MdDelete size={20} />
        </button>
      </div>
    </div>
  );
}

export default CanvasToolbar;

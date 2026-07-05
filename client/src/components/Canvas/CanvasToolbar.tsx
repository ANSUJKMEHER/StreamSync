import { useCanvasStore, type CanvasTool } from '../../store/canvasStore';

interface ToolDef {
  tool: CanvasTool;
  icon: string;
  label: string;
}

const tools: ToolDef[] = [
  { tool: 'select', icon: 'near_me', label: 'Select' },
  { tool: 'rect', icon: 'crop_square', label: 'Rectangle' },
  { tool: 'circle', icon: 'radio_button_unchecked', label: 'Circle' },
  { tool: 'arrow', icon: 'arrow_right_alt', label: 'Arrow' },
];

function CanvasToolbar() {
  const { tool, setTool, selectedId, deleteSelected } = useCanvasStore();

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-surface-container-highest/80 backdrop-blur-xl border border-outline-variant/30 rounded-full p-1.5 flex gap-1 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-50">
      {tools.map((t) => (
        <button
          key={t.tool}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${tool === t.tool ? 'bg-primary text-on-primary shadow-inner' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'}`}
          onClick={() => setTool(t.tool)}
          title={t.label}
        >
          <span className="material-symbols-outlined text-[20px]">{t.icon}</span>
        </button>
      ))}

      <div className="w-[1px] h-6 bg-outline-variant/40 my-auto mx-1" />

      <button
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${!selectedId ? 'opacity-30 cursor-not-allowed' : 'text-error hover:bg-error/10'}`}
        onClick={deleteSelected}
        disabled={!selectedId}
        title="Delete Selected"
      >
        <span className="material-symbols-outlined text-[20px]">delete</span>
      </button>
    </div>
  );
}

export default CanvasToolbar;

import { useCanvasStore, type CanvasTool } from '../../store/canvasStore';

interface ToolDef {
  tool: CanvasTool;
  icon: string;
  label: string;
}

const tools: ToolDef[] = [
  { tool: 'select', icon: '⇱', label: 'Select' },
  { tool: 'rect', icon: '▭', label: 'Rectangle' },
  { tool: 'circle', icon: '◯', label: 'Circle' },
  { tool: 'arrow', icon: '→', label: 'Arrow' },
];

function CanvasToolbar() {
  const { tool, setTool, selectedId, deleteSelected } = useCanvasStore();

  return (
    <div className="canvas-toolbar">
      {tools.map((t) => (
        <button
          key={t.tool}
          className={`canvas-toolbar-btn ${tool === t.tool ? 'active' : ''}`}
          onClick={() => setTool(t.tool)}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}

      <div className="canvas-toolbar-divider" />

      <button
        className="canvas-toolbar-btn"
        onClick={deleteSelected}
        disabled={!selectedId}
        title="Delete Selected"
        style={{ opacity: selectedId ? 1 : 0.3 }}
      >
        🗑
      </button>
    </div>
  );
}

export default CanvasToolbar;

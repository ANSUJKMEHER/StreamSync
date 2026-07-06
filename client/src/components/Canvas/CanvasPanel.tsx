import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Stage, Layer, Rect, Circle, Arrow, Text, Transformer, Group, Path } from 'react-konva';
import type Konva from 'konva';
import type * as Y from 'yjs';
import {
  useCanvasStore,
  nextShapeColor,
  type CanvasShape,
  type CanvasArrow,
} from '../../store/canvasStore';
import { useFileStore } from '../../store/fileStore';
import CanvasToolbar from './CanvasToolbar';
import './CanvasPanel.css';

function CanvasPanel() {
  const { roomId } = useParams<{ roomId: string }>();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [editingLabel, setEditingLabel] = useState<{
    id: string;
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<
    { id: number; x: number; y: number; user: any }[]
  >([]);

  const {
    shapes,
    arrows,
    selectedId,
    tool,
    arrowStartId,
    addShape,
    updateShape,
    deleteSelected,
    addArrow,
    setSelectedId,
    setArrowStartId,
    setTool,
  } = useCanvasStore();

  const createFile = useFileStore((state) => state.createFile);
  const setActiveFile = useFileStore((state) => state.setActiveFile);

  // Sync canvas state with Yjs Y.Map (Granular CRDT Merge)
  useEffect(() => {
    if (!roomId) return;

    import('../../services/yjsService').then(({ yjsService }) => {
      import('yjs').then((Y) => {
        const doc = yjsService.getDoc(roomId, `canvas-${roomId}`);
        const shapesMap = doc.getMap('shapesMap') as Y.Map<Y.Map<any>>;
        const arrowsMap = doc.getMap('arrowsMap') as Y.Map<Y.Map<any>>;

        // Initial load from Yjs
        const loadFromYjs = () => {
          const yShapes: CanvasShape[] = [];
          shapesMap.forEach((shapeYMap) => {
            yShapes.push(shapeYMap.toJSON() as CanvasShape);
          });

          const yArrows: CanvasArrow[] = [];
          arrowsMap.forEach((arrowYMap) => {
            yArrows.push(arrowYMap.toJSON() as CanvasArrow);
          });

          useCanvasStore.getState().setGraph(yShapes, yArrows);
        };

        loadFromYjs();

        // Observe remote changes
        const observer = (events: Y.YEvent<any>[]) => {
          if (events.some((e) => e.transaction.origin !== 'local')) {
            loadFromYjs();
          }
        };
        shapesMap.observeDeep(observer);
        arrowsMap.observeDeep(observer);

        // Subscribe to local Zustand changes to push to Y.Map
        const unsubscribe = useCanvasStore.subscribe((state, prevState) => {
          doc.transact(() => {
            const manualShapes = state.shapes;
            const manualArrows = state.arrows;

            // Diff shapes
            const currentShapeIds = new Set(manualShapes.map((s) => s.id));
            prevState.shapes.forEach((s) => {
              if (!currentShapeIds.has(s.id)) shapesMap.delete(s.id);
            });

            manualShapes.forEach((shape) => {
              let yShape = shapesMap.get(shape.id);
              if (!yShape) {
                yShape = new Y.Map();
                Object.entries(shape).forEach(([k, v]) => yShape!.set(k, v));
                shapesMap.set(shape.id, yShape);
              } else {
                const prevShape = prevState.shapes.find((s) => s.id === shape.id);
                if (prevShape && prevShape !== shape) {
                  Object.entries(shape).forEach(([k, v]) => {
                    if (prevShape[k as keyof CanvasShape] !== v) {
                      yShape!.set(k, v);
                    }
                  });
                }
              }
            });

            // Diff arrows
            const currentArrowIds = new Set(manualArrows.map((a) => a.id));
            prevState.arrows.forEach((a) => {
              if (!currentArrowIds.has(a.id)) arrowsMap.delete(a.id);
            });

            manualArrows.forEach((arrow) => {
              let yArrow = arrowsMap.get(arrow.id);
              if (!yArrow) {
                yArrow = new Y.Map();
                Object.entries(arrow).forEach(([k, v]) => yArrow!.set(k, v));
                arrowsMap.set(arrow.id, yArrow);
              } else {
                const prevArrow = prevState.arrows.find((a) => a.id === arrow.id);
                if (prevArrow && prevArrow !== arrow) {
                  Object.entries(arrow).forEach(([k, v]) => {
                    if ((prevArrow as any)[k] !== v) {
                      yArrow!.set(k, v);
                    }
                  });
                }
              }
            });

          }, 'local');
        });

        return () => {
          shapesMap.unobserveDeep(observer);
          arrowsMap.unobserveDeep(observer);
          unsubscribe();
        };
      });
    });
  }, [roomId]);

  // Setup Awareness for remote cursors
  useEffect(() => {
    if (!roomId) return;

    import('../../services/yjsService').then(({ yjsService }) => {
      const awareness = yjsService.getAwareness(roomId, `canvas-${roomId}`);

      const updateCursors = () => {
        const states = Array.from(awareness.getStates().entries());
        const cursors = states
          .filter(
            ([clientId, state]) =>
              clientId !== awareness.clientID &&
              state.canvasCursor &&
              state.user
          )
          .map(([clientId, state]) => ({
            id: clientId,
            x: state.canvasCursor.x,
            y: state.canvasCursor.y,
            user: state.user,
          }));
        setRemoteCursors(cursors);
      };

      awareness.on('change', updateCursors);
      return () => awareness.off('change', updateCursors);
    });
  }, [roomId]);

  // Resize stage to fill container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.max(10, entry.contentRect.width);
        const height = Math.max(10, entry.contentRect.height);
        setStageSize({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Expose stage to window for PNG export
  useEffect(() => {
    if (stageRef.current) {
      (window as any).__KONVA_STAGE__ = stageRef.current;
    }
  }, [stageRef.current]);

  // Attach transformer to selected node
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    const stage = stageRef.current;
    if (!stage) return;

    if (selectedId) {
      const node = stage.findOne(`#${selectedId}`);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, shapes]);

  // Keyboard: Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if editing a label
        if (editingLabel) return;
        deleteSelected();
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setTool('select');
        setEditingLabel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected, setSelectedId, setTool, editingLabel]);

  // Click on stage (empty area or shape)
  const handleStageClick = useCallback(
    (e: any) => {
      const clickedOnEmpty = e.target === e.target.getStage();

      if (clickedOnEmpty) {
        setSelectedId(null);
        setArrowStartId(null);

        if (tool === 'rect' || tool === 'circle') {
          const stage = stageRef.current;
          if (!stage) return;
          const pos = stage.getPointerPosition();
          if (!pos) return;
          
          const scaleX = stage.scaleX();
          const scaleY = stage.scaleY();
          
          const relativePos = {
            x: (pos.x - stage.x()) / scaleX,
            y: (pos.y - stage.y()) / scaleY
          };

          const id = `shape-${Date.now()}`;
          const newShape: CanvasShape = {
            id,
            type: tool,
            x: relativePos.x - 50,
            y: relativePos.y - 30,
            width: 120,
            height: 70,
            label: tool === 'rect' ? 'Box' : 'Node',
            fill: nextShapeColor(),
          };
          addShape(newShape);
          setSelectedId(id);
          setTool('select');
        }
      }
    },
    [tool, addShape, setSelectedId, setArrowStartId, setTool]
  );

  // Click on a shape
  const handleShapeClick = useCallback(
    (shapeId: string) => {
      if (tool === 'arrow') {
        if (!arrowStartId) {
          // First click — set source
          setArrowStartId(shapeId);
        } else if (arrowStartId !== shapeId) {
          // Second click — create arrow
          const id = `arrow-${Date.now()}`;
          addArrow({ id, fromId: arrowStartId, toId: shapeId });
          setArrowStartId(null);
          setTool('select');
        }
      } else {
        setSelectedId(shapeId);
      }
    },
    [tool, arrowStartId, addArrow, setArrowStartId, setSelectedId, setTool]
  );

  // Drag end — update position or trigger drag-to-create
  const handleDragEnd = useCallback(
    async (shapeId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const x = e.target.x();
      const y = e.target.y();

      const evt = e.evt as any; // Usually MouseEvent or PointerEvent
      if (evt && evt.clientX !== undefined) {
        // Check if dropped over the editor panel
        const editorPanel = document.querySelector('.editor-panel');
        if (editorPanel) {
          const rect = editorPanel.getBoundingClientRect();
          if (
            evt.clientX >= rect.left &&
            evt.clientX <= rect.right &&
            evt.clientY >= rect.top &&
            evt.clientY <= rect.bottom
          ) {
            const shapesList = useCanvasStore.getState().shapes;
            const shape = shapesList.find((s) => s.id === shapeId);
            
            // If shape doesn't have a file linked, scaffold one
            if (shape && !shape.fileId && roomId) {
              const fileName = `${shape.label.replace(/\s+/g, '_')}.ts`;
              const content = `// Auto-generated from Canvas Node: ${shape.label}\n\nexport function init() {\n  console.log("Hello from ${shape.label}");\n}\n`;
              const newFileId = await createFile(roomId, fileName, content);
              
              if (newFileId) {
                updateShape(shapeId, { fileId: newFileId });
                // Snap back to original position
                e.target.position({ x: shape.x, y: shape.y });
                e.target.getLayer()?.batchDraw();
                return;
              }
            }
          }
        }
      }

      updateShape(shapeId, { x, y });
    },
    [updateShape, createFile]
  );

  // Transform end — update size
  const handleTransformEnd = useCallback(
    (shapeId: string, e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // Reset scale, apply to width/height
      node.scaleX(1);
      node.scaleY(1);

      updateShape(shapeId, {
        x: node.x(),
        y: node.y(),
        width: Math.max(40, node.width() * scaleX),
        height: Math.max(30, node.height() * scaleY),
      });
    },
    [updateShape]
  );

  // Double-click to edit label
  const handleDblClick = useCallback(
    (shape: CanvasShape) => {
      const stage = stageRef.current;
      if (!stage) return;
      const stageBox = stage.container().getBoundingClientRect();

      setEditingLabel({
        id: shape.id,
        x: stageBox.left + shape.x,
        y: stageBox.top + shape.y + shape.height / 2 - 12,
        text: shape.label,
      });
    },
    []
  );

  // Submit label edit
  const submitLabel = useCallback(() => {
    if (editingLabel) {
      updateShape(editingLabel.id, { label: editingLabel.text });
      setEditingLabel(null);
    }
  }, [editingLabel, updateShape]);

  // Get center of a shape for arrow endpoints
  const getShapeCenter = (id: string): { x: number; y: number } | null => {
    const shape = shapes.find((s) => s.id === id);
    if (!shape) return null;
    return {
      x: shape.x + shape.width / 2,
      y: shape.y + shape.height / 2,
    };
  };

  // Broadcast local cursor position
  const handleMouseMove = useCallback(
    (e: any) => {
      if (!roomId) return;
      const pos = e.target.getStage()?.getRelativePointerPosition();
      if (pos) {
        import('../../services/yjsService').then(({ yjsService }) => {
          const awareness = yjsService.getAwareness(roomId, `canvas-${roomId}`);
          awareness.setLocalStateField('canvasCursor', { x: pos.x, y: pos.y });
        });
      }
    },
    [roomId]
  );

  const handleMouseLeave = useCallback(() => {
    if (!roomId) return;
    import('../../services/yjsService').then(({ yjsService }) => {
      const awareness = yjsService.getAwareness(roomId, `canvas-${roomId}`);
      awareness.setLocalStateField('canvasCursor', null);
    });
  }, [roomId]);

  // Figma-like Zooming
  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.1, Math.min(newScale, 5)); // Limit zoom

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
  }, []);

  // Render a single shape
  const renderShape = (shape: CanvasShape) => {
    if (isNaN(shape.x) || isNaN(shape.y) || isNaN(shape.width) || isNaN(shape.height) || shape.width <= 0 || shape.height <= 0) return null;

    const isSelected = selectedId === shape.id;
    const isArrowSource = arrowStartId === shape.id;

    return (
      <Group
        key={shape.id}
        id={shape.id}
        x={shape.x}
        y={shape.y}
        draggable={tool === 'select'}
        onClick={() => handleShapeClick(shape.id)}
        onTap={() => handleShapeClick(shape.id)}
        onDragEnd={(e) => handleDragEnd(shape.id, e)}
        onTransformEnd={(e) => handleTransformEnd(shape.id, e)}
        onDblClick={() => handleDblClick(shape)}
        onDblTap={() => handleDblClick(shape)}
      >
        {shape.type === 'rect' ? (
          <Rect
            width={shape.width}
            height={shape.height}
            fill={shape.fill}
            opacity={0.85}
            cornerRadius={8}
            stroke={isSelected ? '#fff' : isArrowSource ? '#fbbf24' : shape.fill}
            strokeWidth={isSelected || isArrowSource ? 3 : 2}
            dash={isSelected || isArrowSource ? undefined : [8, 6]}
          />
        ) : (
          <Circle
            x={shape.width / 2}
            y={shape.height / 2}
            radius={Math.min(shape.width, shape.height) / 2}
            fill={shape.fill}
            opacity={0.85}
            stroke={isSelected ? '#fff' : isArrowSource ? '#fbbf24' : shape.fill}
            strokeWidth={isSelected || isArrowSource ? 3 : 2}
            dash={isSelected || isArrowSource ? undefined : [8, 6]}
          />
        )}
        <Text
          text={shape.label || ' '}
          x={0}
          y={shape.height / 2 - 7}
          width={shape.width}
          align="center"
          fill="#fff"
          fontSize={13}
          fontFamily="Inter, sans-serif"
          fontStyle="600"
          listening={false}
        />
        {shape.fileId && (
          <Group
            x={shape.width - 24}
            y={4}
            onClick={(e) => {
              e.cancelBubble = true;
              setActiveFile(shape.fileId!);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              setActiveFile(shape.fileId!);
            }}
          >
            <Rect width={20} height={20} fill="rgba(0,0,0,0.3)" cornerRadius={4} />
            <Text text="🔗" x={3} y={4} fontSize={12} fill="#fff" />
          </Group>
        )}
      </Group>
    );
  };

  return (
    <div className="relative w-full h-full bg-surface overflow-hidden bg-dot-pattern" ref={containerRef}>
      <CanvasToolbar />

      {shapes.length === 0 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center text-on-surface-variant text-body-md pointer-events-none z-0">
          <div className="text-5xl mb-6 opacity-30">◇</div>
          <div className="leading-relaxed max-w-[300px] mx-auto">
            Select a tool from the toolbar above,<br />
            then click on the canvas to create a shape.
          </div>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        draggable={true} // Allow panning
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        className="relative z-10 cursor-grab active:cursor-grabbing"
      >
        <Layer>
          {/* Arrows */}
          {arrows.map((arrow) => {
            const from = getShapeCenter(arrow.fromId);
            const to = getShapeCenter(arrow.toId);
            if (!from || !to) return null;
            if (isNaN(from.x) || isNaN(from.y) || isNaN(to.x) || isNaN(to.y)) return null;
            
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 5) return null;

            return (
              <Arrow
                key={arrow.id}
                points={[from.x, from.y, to.x, to.y]}
                pointerLength={10}
                pointerWidth={10}
                fill="#d0bcff"
                stroke="#d0bcff"
                strokeWidth={3}
                dash={[8, 8]}
                opacity={selectedId === arrow.id ? 1 : 0.8}
                onClick={() => setSelectedId(arrow.id)}
                onTap={() => setSelectedId(arrow.id)}
              />
            );
          })}

          {/* Shapes */}
          {shapes.map(renderShape)}

          {/* Transformer for selection resize */}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            borderStroke="#d0bcff"
            borderStrokeWidth={1.5}
            anchorFill="#d0bcff"
            anchorStroke="#fff"
            anchorSize={8}
            anchorCornerRadius={2}
            boundBoxFunc={(_oldBox, newBox) => {
              if (newBox.width < 40 || newBox.height < 30) {
                return _oldBox;
              }
              return newBox;
            }}
          />
        </Layer>

        {/* Remote Cursors Layer */}
        <Layer>
          {remoteCursors.map((cursor) => (
            <Group key={cursor.id} x={cursor.x} y={cursor.y}>
              <Path
                data="M5.65376 21.0069L2.83174 1.48704C2.60741 -0.0631627 4.29824 -0.840778 5.41249 0.29744L18.9958 14.1611C20.089 15.2768 19.3491 17.1729 17.788 17.2917L12.0152 17.7314C11.6033 17.7627 11.2335 17.9942 11.0264 18.3512L8.23236 23.1678C7.45899 24.4984 5.37889 22.9095 5.65376 21.0069Z"
                fill={cursor.user.color}
                stroke="#fff"
                strokeWidth={1.5}
              />
              <Group x={12} y={20}>
                <Rect
                  height={22}
                  width={cursor.user.name.length * 7 + 16}
                  fill={cursor.user.color}
                  cornerRadius={4}
                />
                <Text
                  text={cursor.user.name}
                  fill="#fff"
                  fontSize={12}
                  fontFamily="Inter, sans-serif"
                  padding={5}
                />
              </Group>
            </Group>
          ))}
        </Layer>
      </Stage>

      {/* Inline label editor */}
      {editingLabel && (
        <input
          className="absolute z-[200] bg-surface-container-high text-on-surface border border-primary rounded-md px-3 py-1.5 text-label-md font-sans outline-none min-w-[140px] shadow-md"
          style={{ left: editingLabel.x, top: editingLabel.y }}
          value={editingLabel.text}
          onChange={(e) =>
            setEditingLabel({ ...editingLabel, text: e.target.value })
          }
          onBlur={submitLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitLabel();
            if (e.key === 'Escape') setEditingLabel(null);
          }}
          autoFocus
        />
      )}
    </div>
  );
}

export default CanvasPanel;

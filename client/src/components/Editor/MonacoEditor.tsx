
import { useRef, useCallback, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as monacoEditor, IDisposable } from 'monaco-editor';
import type * as Monaco from 'monaco-editor';
import { MonacoBinding } from 'y-monaco';
import { useFileStore } from '../../store/fileStore';
import { yjsService } from '../../services/yjsService';
import { aiService } from '../../services/aiService';
import './MonacoEditor.css';

function MonacoEditor() {
  const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const aiProviderDisposable = useRef<IDisposable | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const {
    files,
    activeFileId,
    setCursorPosition,
    targetLine,
  } = useFileStore();

  const activeFile = files.find((f) => f.id === activeFileId);

  useEffect(() => {
    if (!editorReady || !editorRef.current || !targetLine) return;
    if (targetLine.fileId !== activeFileId) return;

    const editor = editorRef.current;
    setTimeout(() => {
      editor.focus();
      editor.setPosition({ lineNumber: targetLine.lineNumber, column: 1 });
      editor.revealLineInCenter(targetLine.lineNumber);
    }, 50);
  }, [editorReady, targetLine, activeFileId]);

  const handleMount = useCallback(
    (editorInstance: monacoEditor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editorInstance;
      setEditorReady(true);

      // Track cursor position
      editorInstance.onDidChangeCursorPosition((e) => {
        setCursorPosition({
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        });
      });

      // Ctrl+S / Cmd+S to save
      editorInstance.addAction({
        id: 'streamsync-save',
        label: 'Save File',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: async () => {
          const state = useFileStore.getState();
          if (state.activeFileId && editorRef.current) {
            // Run formatter before saving if available
            await editorRef.current.getAction('editor.action.formatDocument')?.run();
            
            // Update local store before saving
            state.updateFileContent(state.activeFileId, editorRef.current.getValue());
            state.saveFile(state.activeFileId);
          }
        },
      });

      // Alt+\ to trigger AI Suggestion
      editorInstance.addAction({
        id: 'streamsync-ai-suggest',
        label: 'Trigger AI Suggestion',
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.Backslash],
        run: (editor) => {
          editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {});
        },
      });

      // Focus the editor
      editorInstance.focus();
    },
    [setCursorPosition]
  );

  // Manage Yjs MonacoBinding lifecycle
  useEffect(() => {
    if (!editorReady || !editorRef.current || !activeFileId) return;

    const editor = editorRef.current;
    
    let currentStyleEl: HTMLStyleElement | null = null;
    let currentAwareness: any = null;
    let currentUpdateCursorStyles: (() => void) | null = null;

    const bindModel = () => {
      const model = editor.getModel();
      if (!model) return;

      // Ensure the model currently in the editor corresponds to our active file.
      // @monaco-editor/react sets the model URI using the `path` prop (which we set to activeFile.id)
      if (!model.uri.path.includes(activeFileId) && !model.uri.toString().includes(activeFileId)) {
        return;
      }

      const roomId = useFileStore.getState().files.find(f => f.id === activeFileId)?.roomId;
      if (!roomId) return;
      
      const doc = yjsService.getDoc(roomId, activeFileId);
      const ytext = doc.getText('monaco');
      const awareness = yjsService.getAwareness(roomId, activeFileId);
      currentAwareness = awareness;

      // Clean up previous binding before recreating
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      
      if (currentStyleEl) {
        currentStyleEl.remove();
        currentStyleEl = null;
      }
      if (currentUpdateCursorStyles && currentAwareness) {
        currentAwareness.off('change', currentUpdateCursorStyles);
        currentUpdateCursorStyles = null;
      }

      // Force editor model to match Y.Text before binding
      if (model.getValue() !== ytext.toString()) {
        model.setValue(ytext.toString());
      }
      
      // CRITICAL: Force LF (\n) line endings to perfectly align Monaco's character offsets with Y.Text!
      // If Windows defaults to CRLF (\r\n), every newline shifts the Y.Text sync offset by 1 character.
      model.setEOL(0); // 0 = EndOfLineSequence.LF

      // Bind Yjs to Monaco
      bindingRef.current = new MonacoBinding(
        ytext,
        model,
        new Set([editor]),
        awareness
      );

      // Dynamically inject CSS for each remote user's cursor color
      currentStyleEl = document.createElement('style');
      currentStyleEl.id = `yjs-cursor-styles-${activeFileId}`;
      document.head.appendChild(currentStyleEl);

      currentUpdateCursorStyles = () => {
        if (!currentStyleEl) return;
        const styles: string[] = [];
        awareness.getStates().forEach((state, clientID) => {
          if (clientID === awareness.clientID) return; // skip self
          const user = state.user;
          if (!user) return;
          const color = user.color || '#ff8c00';
          const name = user.name || 'Anonymous';
          styles.push(`
            .yRemoteSelection-${clientID} {
              background-color: ${color}33;
            }
            .yRemoteSelectionHead-${clientID} {
              position: absolute;
              border-left: 2px solid ${color};
              border-top: 2px solid ${color};
              border-bottom: none;
              height: 100%;
              box-sizing: border-box;
            }
            .yRemoteSelectionHead-${clientID}::after {
              content: '${name.replace(/'/g, "\\'")}';
              position: absolute;
              top: -18px;
              left: -2px;
              padding: 1px 6px;
              background: ${color};
              color: #fff;
              font-size: 11px;
              font-weight: 600;
              font-family: system-ui, sans-serif;
              border-radius: 3px 3px 3px 0;
              white-space: nowrap;
              pointer-events: none;
              z-index: 100;
              line-height: 15px;
            }
          `);
        });
        currentStyleEl.textContent = styles.join('\n');
      };

      awareness.on('change', currentUpdateCursorStyles);
      currentUpdateCursorStyles(); // Initial render
    };

    // Try to bind immediately in case the model is already swapped
    bindModel();

    // Listen for model changes to bind once the correct model is swapped in
    const disposable = editor.onDidChangeModel(() => {
      bindModel();
    });

    // Register AI Inline Completions Provider globally
    if (!aiProviderDisposable.current) {
      const monaco = (window as any).monaco;
      if (monaco) {
        aiProviderDisposable.current = monaco.languages.registerInlineCompletionsProvider('*', {
          provideInlineCompletions: async (model: any, position: any, context: any) => {
            if (context.triggerKind !== 1) return { items: [] };

            const state = useFileStore.getState();
            if (!state.activeFileId) return { items: [] };

            const activeFile = state.files.find((f) => f.id === state.activeFileId);
            if (!activeFile) return { items: [] };

            const prefix = model.getValueInRange({
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column,
            });
            const suffix = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: model.getLineCount(),
              endColumn: model.getLineMaxColumn(model.getLineCount()),
            });

            const snippet = await aiService.fetchCompletion(state.activeFileId, {
              prefix,
              suffix,
              filename: activeFile.name,
              language: activeFile.language,
            });

            if (!snippet) return { items: [] };

            return { items: [{ insertText: snippet }] };
          },
          disposeInlineCompletions: () => {},
        });
      }
    }

    return () => {
      disposable.dispose();
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      if (currentAwareness && currentUpdateCursorStyles) {
        currentAwareness.off('change', currentUpdateCursorStyles);
      }
      if (currentStyleEl) {
        currentStyleEl.remove();
      }
      if (aiProviderDisposable.current) {
        aiProviderDisposable.current.dispose();
        aiProviderDisposable.current = null;
      }
    };
  }, [editorReady, activeFileId]);

  // Handle container resize (e.g., when unhiding or resizing split view)
  useEffect(() => {
    if (!editorReady || !editorRef.current) return;
    const container = document.querySelector('.editor-container');
    if (!container) return;

    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        editorRef.current?.layout();
      });
    });
    ro.observe(container);

    return () => ro.disconnect();
  }, [editorReady]);

  // Empty state
  if (!activeFile) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-icon">⟨⟩</div>
        <div className="editor-empty-title">StreamSync</div>
        <div className="editor-empty-subtitle">
          Open a file from the sidebar to start editing, or create a new file.
        </div>
        <div className="editor-empty-shortcuts">
          <div className="editor-shortcut">
            <kbd>Ctrl+S</kbd>
            <span>Save file</span>
          </div>
          <div className="editor-shortcut">
            <kbd>Alt+\</kbd>
            <span>AI Autocomplete</span>
          </div>
          <div className="editor-shortcut">
            <kbd>Ctrl+Shift+P</kbd>
            <span>Command palette</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <Editor
        path={activeFile.id}
        height="100%"
        language={activeFile.language}
        theme="vs-dark"
        defaultValue=""
        onMount={handleMount}
        loading={
          <div className="editor-loading">
            <div className="editor-loading-spinner" />
            <div className="editor-loading-text">Loading editor…</div>
          </div>
        }
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontLigatures: true,
          lineHeight: 22,
          minimap: { enabled: true, maxColumn: 80 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'all',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          padding: { top: 12, bottom: 12 },
          wordWrap: 'off',
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          snippetSuggestions: 'inline',
          inlineSuggest: {
            enabled: true,
            showToolbar: 'always'
          },
          parameterHints: { enabled: true },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
        }}
      />
    </div>
  );
}

export default MonacoEditor;

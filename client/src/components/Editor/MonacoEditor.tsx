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
  } = useFileStore();

  const activeFile = files.find((f) => f.id === activeFileId);

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
        run: () => {
          const state = useFileStore.getState();
          if (state.activeFileId && editorRef.current) {
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
    const model = editor.getModel();
    if (!model) return;

    // Get Y.Doc and Awareness for this file
    const doc = yjsService.getDoc(activeFileId);
    const ytext = doc.getText('monaco');
    const awareness = yjsService.getAwareness(activeFileId);

    // Bind Yjs to Monaco
    const binding = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      awareness
    );
    bindingRef.current = binding;

    // Register AI Inline Completions Provider
    if (!aiProviderDisposable.current) {
      const monaco = (window as any).monaco;
      if (monaco) {
        aiProviderDisposable.current = monaco.languages.registerInlineCompletionsProvider('*', {
          provideInlineCompletions: async (model: any, position: any, context: any) => {
            // 0 = Automatic (typing), 1 = Explicit (shortcut)
            if (context.triggerKind !== 1) {
              return { items: [] };
            }

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

            return {
              items: [
                {
                  insertText: snippet,
                },
              ],
            };
          },
          freeInlineCompletions: () => {},
        });
      }
    }

    return () => {
      binding.destroy();
      bindingRef.current = null;
      if (aiProviderDisposable.current) {
        aiProviderDisposable.current.dispose();
        aiProviderDisposable.current = null;
      }
    };
  }, [editorReady, activeFileId]);

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
        key={activeFile.id}
        height="100%"
        language={activeFile.language}
        theme="light"
        defaultValue={activeFile.content}
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

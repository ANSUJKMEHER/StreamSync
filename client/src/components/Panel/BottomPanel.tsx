import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { MdDelete, MdKeyboardArrowDown, MdRefresh } from 'react-icons/md';
import '@xterm/xterm/css/xterm.css';
import './BottomPanel.css';
import { useFileStore } from '../../store/fileStore';

interface BottomPanelProps {
  executionOutput: { stdout: string; stderr: string } | null;
  isExecuting: boolean;
  onClose: () => void;
}

type Tab = 'TERMINAL' | 'OUTPUT' | 'PREVIEW' | 'PROBLEMS';

export default function BottomPanel({ executionOutput, isExecuting, onClose }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('TERMINAL');
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  // For Preview
  const files = useFileStore(state => state.files);
  const [previewKey, setPreviewKey] = useState(0);

  // Generate srcDoc for the iframe
  const generatePreviewContent = () => {
    const htmlFile = files.find(f => f.name.endsWith('.html'));
    const cssFiles = files.filter(f => f.name.endsWith('.css'));
    const jsFiles = files.filter(f => f.name.endsWith('.js') || f.name.endsWith('.ts')); // simplified

    if (!htmlFile) {
      return `
        <div style="color: #a3a3a3; font-family: sans-serif; padding: 20px; text-align: center;">
          <h3>No HTML file found</h3>
          <p>Create an <code>index.html</code> file to see the live preview.</p>
        </div>
      `;
    }

    let combinedStyles = cssFiles.map(f => `<style>${f.content}</style>`).join('\n');
    let combinedScripts = jsFiles.map(f => `<script>${f.content}</script>`).join('\n');

    let htmlContent = htmlFile.content;
    
    // Inject styles and scripts into head or body
    if (htmlContent.includes('</head>')) {
      htmlContent = htmlContent.replace('</head>', `${combinedStyles}\n</head>`);
    } else {
      htmlContent = `${combinedStyles}\n${htmlContent}`;
    }

    if (htmlContent.includes('</body>')) {
      htmlContent = htmlContent.replace('</body>', `${combinedScripts}\n</body>`);
    } else {
      htmlContent = `${htmlContent}\n${combinedScripts}`;
    }

    return htmlContent;
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#11131c', // bg-surface-dim
        foreground: '#e1e1ef', // on-surface
        cursor: '#d0bcff', // primary
      },
      fontFamily: '"JetBrains Mono", Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      disableStdin: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();
    
    term.writeln('\x1b[32m$ \x1b[0mStreamSync Terminal Initialized...');
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  useEffect(() => {
    if (isExecuting && xtermRef.current) {
      xtermRef.current.write('\r\n\x1b[33mExecuting...\x1b[0m\r\n');
    }
  }, [isExecuting]);

  useEffect(() => {
    if (executionOutput && xtermRef.current) {
      const term = xtermRef.current;
      term.clear();
      term.writeln('\x1b[32m$ \x1b[0mExecution Complete');
      
      if (executionOutput.stdout) {
        term.write(executionOutput.stdout.replace(/\n/g, '\r\n'));
      }
      if (executionOutput.stderr) {
        term.write('\x1b[31m' + executionOutput.stderr.replace(/\n/g, '\r\n') + '\x1b[0m');
      }
      term.writeln('');
      term.write('\x1b[32m$ \x1b[0m');
    }
  }, [executionOutput]);

  useEffect(() => {
    if (activeTab === 'TERMINAL') {
      setTimeout(() => fitAddonRef.current?.fit(), 10);
    }
  }, [activeTab]);

  return (
    <div className="h-full bg-surface-container border-t border-outline-variant/30 flex flex-col flex-shrink-0 relative z-30">
      <div className="flex items-center px-4 h-8 border-b border-outline-variant/20 gap-4">
        {(['TERMINAL', 'OUTPUT', 'PREVIEW', 'PROBLEMS'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`font-label-md text-label-md uppercase tracking-wider h-full transition-colors ${activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
        
          {activeTab === 'PREVIEW' && (
            <button 
              className="hover:text-primary transition-colors p-1 rounded hover:bg-surface-variant text-on-surface-variant"
              onClick={() => setPreviewKey(k => k + 1)}
              title="Refresh Preview"
            >
              <MdRefresh size={16} />
            </button>
          )}
          <button 
            className="hover:text-error transition-colors p-1 rounded hover:bg-surface-variant text-on-surface-variant"
            onClick={() => {
              if (xtermRef.current) {
                xtermRef.current.clear();
                xtermRef.current.writeln('\x1b[32m$ \x1b[0mStreamSync Terminal Initialized...');
              }
            }}
            title="Clear Terminal"
          >
            <MdDelete size={16} />
          </button>
          <div className="w-[1px] h-4 bg-outline-variant/30" />
          <button 
            className="hover:text-on-surface transition-colors p-1 rounded hover:bg-surface-variant text-on-surface-variant"
            onClick={onClose}
            title="Close Panel"
          >
            <MdKeyboardArrowDown size={16} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto bg-surface-container-lowest font-code-md text-code-md">
        <div 
          className="h-full w-full p-2" 
          style={{ display: activeTab === 'TERMINAL' ? 'block' : 'none' }}
        >
          <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
        </div>
        
        {activeTab === 'OUTPUT' && (
          <div className="p-4 h-full text-on-surface whitespace-pre-wrap font-code-md text-code-md overflow-auto">
            {executionOutput ? (
               <div className="raw-output text-on-surface">{executionOutput.stdout || executionOutput.stderr}</div>
            ) : (
               <div className="text-on-surface-variant">No output available. Run code to see output here.</div>
            )}
          </div>
        )}

        {activeTab === 'PREVIEW' && (
          <div className="h-full w-full bg-white relative">
            <iframe
              key={previewKey}
              title="live-preview"
              srcDoc={generatePreviewContent()}
              className="absolute inset-0 w-full h-full border-0"
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            />
          </div>
        )}

        {activeTab === 'PROBLEMS' && (
          <div className="p-4 h-full text-on-surface-variant font-code-md text-code-md">
            No problems have been detected in the workspace.
          </div>
        )}
      </div>
    </div>
  );
}

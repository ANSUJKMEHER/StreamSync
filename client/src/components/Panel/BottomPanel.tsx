import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import './BottomPanel.css';

interface BottomPanelProps {
  executionOutput: { stdout: string; stderr: string } | null;
  isExecuting: boolean;
  onClose: () => void;
}

type Tab = 'TERMINAL' | 'OUTPUT' | 'PROBLEMS';

export default function BottomPanel({ executionOutput, isExecuting, onClose }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('TERMINAL');
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1e1e1e', // VS Code dark
        foreground: '#cccccc',
        cursor: '#ffffff',
      },
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
      disableStdin: true, // It's just for output right now
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

  // Handle execution output
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
        // Replace newlines with \r\n for xterm
        term.write(executionOutput.stdout.replace(/\n/g, '\r\n'));
      }
      if (executionOutput.stderr) {
        term.write('\x1b[31m' + executionOutput.stderr.replace(/\n/g, '\r\n') + '\x1b[0m');
      }
      term.writeln('');
      term.write('\x1b[32m$ \x1b[0m');
    }
  }, [executionOutput]);

  // Refit on tab change (xterm loses layout if hidden)
  useEffect(() => {
    if (activeTab === 'TERMINAL') {
      setTimeout(() => fitAddonRef.current?.fit(), 10);
    }
  }, [activeTab]);

  return (
    <div className="bottom-panel">
      <div className="bottom-panel-header">
        <div className="bottom-panel-tabs">
          {(['PROBLEMS', 'OUTPUT', 'TERMINAL'] as Tab[]).map(tab => (
            <button
              key={tab}
              className={`panel-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="bottom-panel-actions">
          <button className="panel-action-btn" onClick={onClose} title="Close Panel">✕</button>
        </div>
      </div>
      
      <div className="bottom-panel-content">
        <div 
          className="panel-tab-content terminal-wrapper" 
          style={{ display: activeTab === 'TERMINAL' ? 'block' : 'none', height: '100%' }}
        >
          <div ref={terminalRef} style={{ height: '100%', width: '100%' }} />
        </div>
        
        {activeTab === 'OUTPUT' && (
          <div className="panel-tab-content output-wrapper">
            {executionOutput ? (
               <pre className="raw-output">{executionOutput.stdout || executionOutput.stderr}</pre>
            ) : (
               <span className="muted">No output available. Run code to see output here.</span>
            )}
          </div>
        )}

        {activeTab === 'PROBLEMS' && (
          <div className="panel-tab-content problems-wrapper">
            <span className="muted">No problems have been detected in the workspace.</span>
          </div>
        )}
      </div>
    </div>
  );
}

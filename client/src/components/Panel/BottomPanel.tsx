import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { MdDelete, MdKeyboardArrowDown } from 'react-icons/md';
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
        {(['TERMINAL', 'OUTPUT', 'PROBLEMS'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`font-label-md text-label-md uppercase tracking-wider h-full transition-colors ${activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
        
        <div className="ml-auto flex items-center gap-2">
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

        {activeTab === 'PROBLEMS' && (
          <div className="p-4 h-full text-on-surface-variant font-code-md text-code-md">
            No problems have been detected in the workspace.
          </div>
        )}
      </div>
    </div>
  );
}

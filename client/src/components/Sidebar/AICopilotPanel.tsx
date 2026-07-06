import React, { useState, useRef, useEffect } from 'react';
import { MdSend, MdAutoAwesome } from 'react-icons/md';
import { useFileStore } from '../../store/fileStore';
import './AICopilotPanel.css';

const API_BASE = (import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://streamsync-cxox.onrender.com')).replace(/\/$/, '');

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export default function AICopilotPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'model', text: 'Hello! I am your AI Copilot. How can I help you with your code today?' }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const files = useFileStore(state => state.files);
  const activeFileId = useFileStore(state => state.activeFileId);
  const cursorPosition = useFileStore(state => state.cursorPosition);

  const activeFile = files.find(f => f.id === activeFileId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Format history for Gemini
      const history = messages.slice(1).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const res = await fetch(`${API_BASE}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage.text,
          files: files.map(f => ({ name: f.name, content: f.content })),
          activeFile: activeFile ? { name: activeFile.name, content: activeFile.content } : null,
          cursorPosition: cursorPosition,
          history
        })
      });

      const json = await res.json();
      if (json.success) {
        setMessages(prev => [...prev, { role: 'model', text: json.data }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', text: `Error: ${json.error}` }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', text: `Failed to connect to AI: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-low text-on-surface">
      <div className="flex items-center gap-2 p-4 border-b border-outline-variant/30 text-primary font-medium">
        <MdAutoAwesome size={20} />
        AI Copilot
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 ai-messages-container">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`max-w-[90%] p-3 rounded-lg text-sm whitespace-pre-wrap font-code-sm ${
                msg.role === 'user' 
                  ? 'bg-primary text-on-primary rounded-br-sm' 
                  : 'bg-surface-container-highest text-on-surface rounded-bl-sm border border-outline-variant/30'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
             <div className="bg-surface-container-highest text-on-surface-variant p-3 rounded-lg rounded-bl-sm text-sm italic">
                Thinking...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-outline-variant/30 bg-surface-container">
        <div className="relative">
          <textarea
            className="w-full bg-surface-container-highest border border-outline-variant/50 rounded-lg py-2 pl-3 pr-10 text-sm focus:outline-none focus:border-primary resize-none"
            placeholder="Ask about your code..."
            rows={2}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button 
            className="absolute right-2 bottom-2 p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <MdSend size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

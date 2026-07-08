import React, { useState, useRef, useEffect } from 'react';
import { MdClose, MdSend } from 'react-icons/md';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import './RightSidebar.css';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

interface RightSidebarProps {
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  isMembersOpen: boolean;
  setIsMembersOpen: (open: boolean) => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export default function RightSidebar({
  isChatOpen,
  setIsChatOpen,
  isMembersOpen,
  setIsMembersOpen,
  messages,
  onSendMessage,
}: RightSidebarProps) {
  const { roomUsers } = useRoomStore();
  const { user } = useAuthStore();
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const bothOpen = isChatOpen && isMembersOpen;

  return (
    <aside className="w-[320px] flex-shrink-0 bg-surface-container-low/90 backdrop-blur-md border-l border-outline-variant/20 flex flex-col h-full z-30 shadow-2xl relative transition-all duration-300 animate-slide-in">
      {/* 1. Members Section */}
      {isMembersOpen && (
        <div className={`flex flex-col overflow-hidden min-h-0 ${bothOpen ? 'h-1/2 border-b border-outline-variant/20' : 'h-full'}`}>
          <div className="flex justify-between items-center px-4 h-12 bg-surface-container-lowest/50 border-b border-outline-variant/10 shrink-0">
            <span className="font-bold text-label-lg text-primary">
              Members ({roomUsers.length})
            </span>
            <button
              className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-variant/50 transition-colors"
              onClick={() => setIsMembersOpen(false)}
              title="Close Members List"
            >
              <MdClose size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 custom-scrollbar">
            {roomUsers.map((u) => {
              const isMe = u.userId === user?.id;
              return (
                <div
                  key={u.userId}
                  className="flex items-center gap-3 p-2 rounded-xl bg-surface-variant/10 border border-outline-variant/10 hover:bg-surface-variant/20 transition-all duration-200"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-xs shadow-md shrink-0">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-body-sm text-on-surface truncate">
                        {u.username}
                      </span>
                      {isMe && (
                        <span className="text-[8px] bg-primary/20 text-primary font-bold px-1 py-0.2 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-[8px] text-success flex items-center gap-0.5 font-bold">
                      <span className="w-1 h-1 bg-success rounded-full animate-pulse" />
                      Active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Chat Section */}
      {isChatOpen && (
        <div className={`flex flex-col overflow-hidden min-h-0 ${bothOpen ? 'h-1/2' : 'h-full'}`}>
          <div className="flex justify-between items-center px-4 h-12 bg-surface-container-lowest/50 border-b border-outline-variant/10 shrink-0">
            <span className="font-bold text-label-lg text-primary">
              Room Chat
            </span>
            <button
              className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-variant/50 transition-colors"
              onClick={() => setIsChatOpen(false)}
              title="Close Room Chat"
            >
              <MdClose size={16} />
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-surface-dim/35">
            {/* Scrollable messages thread */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-3">
                  <div className="w-9 h-9 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant text-md mb-2 shadow-inner font-bold">
                    💬
                  </div>
                  <h3 className="font-title-sm font-semibold text-on-surface mb-0.5 text-body-sm">Call Chat</h3>
                  <p className="text-[10px] text-on-surface-variant max-w-[200px] leading-relaxed">
                    Messages are temporary and clear when you leave the session.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${
                        isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      {!isMe && (
                        <span className="text-[9px] font-bold text-on-surface-variant mb-0.5 ml-1 truncate max-w-[150px]">
                          {msg.senderName}
                        </span>
                      )}
                      <div
                        className={`px-3 py-1.5 rounded-2xl shadow-sm text-body-xs break-words leading-relaxed ${
                          isMe
                            ? 'bg-primary text-on-primary rounded-tr-none'
                            : 'bg-surface-container-highest text-on-surface rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[8px] text-on-surface-variant/60 mt-0.5 mx-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSend}
              className="p-2 border-t border-outline-variant/10 bg-surface-container-lowest flex items-end gap-1.5 shrink-0"
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                rows={1}
                className="flex-1 bg-surface-variant/30 hover:bg-surface-variant/40 focus:bg-surface-variant/45 text-body-xs text-on-surface placeholder-on-surface-variant/50 rounded-xl px-2.5 py-1.5 border-0 outline-none resize-none max-h-20 custom-scrollbar transition-all duration-200"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`p-1.5 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                  inputText.trim()
                    ? 'bg-primary text-on-primary shadow-md hover:scale-105 active:scale-95'
                    : 'bg-surface-variant text-on-surface-variant/30 cursor-not-allowed'
                }`}
              >
                <MdSend size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}

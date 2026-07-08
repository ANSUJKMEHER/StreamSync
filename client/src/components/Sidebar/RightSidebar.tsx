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
  view: 'chat' | 'members';
  setView: (view: 'chat' | 'members') => void;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

export default function RightSidebar({
  view,
  setView,
  onClose,
  messages,
  onSendMessage,
}: RightSidebarProps) {
  const { roomUsers } = useRoomStore();
  const { user } = useAuthStore();
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (view === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, view]);

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

  return (
    <aside className="w-[320px] flex-shrink-0 bg-surface-container-low/90 backdrop-blur-md border-l border-outline-variant/20 flex flex-col h-full z-30 shadow-2xl relative transition-all duration-300 animate-slide-in">
      {/* Header Tabs */}
      <div className="flex justify-between items-center px-4 h-14 border-b border-outline-variant/10">
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg text-label-md font-bold transition-all ${
              view === 'chat'
                ? 'bg-primary/10 text-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            onClick={() => setView('chat')}
          >
            Room Chat
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-label-md font-bold transition-all ${
              view === 'members'
                ? 'bg-primary/10 text-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            onClick={() => setView('members')}
          >
            Members ({roomUsers.length})
          </button>
        </div>

        <button
          className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-variant/50 transition-colors"
          onClick={onClose}
          title="Close Panel"
        >
          <MdClose size={18} />
        </button>
      </div>

      {/* Main Content View */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {view === 'chat' ? (
          <div className="flex-1 flex flex-col min-h-0 bg-surface-dim/30">
            {/* Messages Thread */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant text-xl mb-3 shadow-inner font-bold">
                    💬
                  </div>
                  <h3 className="font-title-md font-semibold text-on-surface mb-1">Call Chat</h3>
                  <p className="text-body-sm text-on-surface-variant max-w-[200px]">
                    Messages here are temporary and will clear when you leave the session.
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
                      {/* Name tag */}
                      {!isMe && (
                        <span className="text-[10px] font-bold text-on-surface-variant mb-1 ml-1 truncate max-w-[150px]">
                          {msg.senderName}
                        </span>
                      )}
                      {/* Bubble */}
                      <div
                        className={`px-3 py-2 rounded-2xl shadow-sm text-body-sm break-words ${
                          isMe
                            ? 'bg-primary text-on-primary rounded-tr-none'
                            : 'bg-surface-container-highest text-on-surface rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                      {/* Time */}
                      <span className="text-[9px] text-on-surface-variant/70 mt-1 mx-1">
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
              className="p-3 border-t border-outline-variant/10 bg-surface-container-lowest flex items-end gap-2"
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message to everyone..."
                rows={1}
                className="flex-1 bg-surface-variant/35 hover:bg-surface-variant/50 focus:bg-surface-variant/50 text-body-sm text-on-surface placeholder-on-surface-variant/60 rounded-xl px-3 py-2 border-0 outline-none resize-none max-h-24 custom-scrollbar transition-all duration-200"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`p-2 rounded-xl flex items-center justify-center transition-all ${
                  inputText.trim()
                    ? 'bg-primary text-on-primary shadow-md hover:scale-105 active:scale-95'
                    : 'bg-surface-variant text-on-surface-variant/40 cursor-not-allowed'
                }`}
              >
                <MdSend size={18} />
              </button>
            </form>
          </div>
        ) : (
          /* Members View */
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
            {roomUsers.map((u) => {
              const isMe = u.userId === user?.id;
              return (
                <div
                  key={u.userId}
                  className="flex items-center gap-3 p-2 rounded-xl bg-surface-variant/20 border border-outline-variant/10 hover:bg-surface-variant/30 transition-all duration-200"
                >
                  {/* Initials Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-bold text-sm shadow-md">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-body-md text-on-surface truncate">
                        {u.username}
                      </span>
                      {isMe && (
                        <span className="text-[9px] bg-primary/20 text-primary font-bold px-1.5 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-success flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                      Active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

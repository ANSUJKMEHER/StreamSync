import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
    <motion.aside
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className="w-[320px] flex-shrink-0 bg-surface/90 backdrop-blur-2xl border-l border-outline-variant/30 flex flex-col h-full z-30 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] relative select-none"
    >
      {/* 1. Members Section */}
      {isMembersOpen && (
        <div className={`flex flex-col overflow-hidden min-h-0 ${bothOpen ? 'h-1/2 border-b border-outline-variant/25' : 'h-full'}`}>
          <div className="flex justify-between items-center px-4 h-12 bg-surface-container-low/60 border-b border-outline-variant/20 shrink-0">
            <span className="font-bold text-xs text-primary tracking-wider uppercase flex items-center gap-1.5">
              <span>Members</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/15 text-primary border border-primary/20">
                {roomUsers.length}
              </span>
            </span>
            <button
              className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              onClick={() => setIsMembersOpen(false)}
              title="Close Members List"
            >
              <MdClose size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 no-scrollbar">
            {roomUsers.map((u) => {
              const isMe = u.userId === user?.id;
              return (
                <motion.div
                  key={u.userId}
                  whileHover={{ x: 2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low/60 border border-outline-variant/20 hover:border-primary/30 transition-all shadow-sm"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-dark border border-primary/30 text-background flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-on-surface truncate">
                        {u.username}
                      </span>
                      {isMe && (
                        <span className="text-[9px] bg-primary/15 text-primary font-bold px-1.5 py-0.2 rounded-full border border-primary/20">
                          You
                        </span>
                      )}
                    </div>
                    {/* Kokonut-style Active Radar Dot */}
                    <span className="text-[9px] text-emerald-400 flex items-center gap-1.5 font-medium mt-0.5">
                      <span className="relative flex size-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-1.5 bg-emerald-400" />
                      </span>
                      Active in room
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Chat Section */}
      {isChatOpen && (
        <div className={`flex flex-col overflow-hidden min-h-0 ${bothOpen ? 'h-1/2' : 'h-full'}`}>
          <div className="flex justify-between items-center px-4 h-12 bg-surface-container-low/60 border-b border-outline-variant/20 shrink-0">
            <span className="font-bold text-xs text-primary tracking-wider uppercase">
              Room Chat
            </span>
            <button
              className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
              onClick={() => setIsChatOpen(false)}
              title="Close Room Chat"
            >
              <MdClose size={16} />
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-surface-container-lowest/30">
            {/* Scrollable messages thread */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 no-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <div className="w-10 h-10 rounded-2xl bg-surface-container border border-outline-variant/25 flex items-center justify-center text-on-surface-variant text-lg mb-2 shadow-inner font-bold">
                    💬
                  </div>
                  <h3 className="font-bold text-on-surface text-xs mb-1">Collaborative Chat</h3>
                  <p className="text-[10px] text-on-surface-variant/80 max-w-[200px] leading-relaxed">
                    Messages are synchronized in real-time with everyone in this room.
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                        className={`flex flex-col max-w-[85%] ${
                          isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                        }`}
                      >
                        {!isMe && (
                          <span className="text-[9px] font-semibold text-on-surface-variant mb-0.5 ml-1 truncate max-w-[150px]">
                            {msg.senderName}
                          </span>
                        )}
                        <div
                          className={`px-3 py-1.5 rounded-2xl text-xs break-words leading-relaxed ${
                            isMe
                              ? 'bg-primary text-background font-medium rounded-tr-none shadow-[0_2px_12px_rgba(223,171,108,0.25)]'
                              : 'bg-surface-container border border-outline-variant/25 text-on-surface rounded-tl-none'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[8px] text-on-surface-variant/50 mt-0.5 mx-1 font-mono">
                          {msg.timestamp}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSend}
              className="p-2.5 border-t border-outline-variant/20 bg-surface-container-low/70 backdrop-blur-md flex items-end gap-2 shrink-0"
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                rows={1}
                className="flex-1 bg-surface-container border border-outline-variant/30 focus:border-primary/50 text-xs text-on-surface placeholder-on-surface-variant/30 rounded-xl px-3 py-2 outline-none resize-none max-h-20 no-scrollbar transition-all font-sans"
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!inputText.trim()}
                className={`p-2 rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                  inputText.trim()
                    ? 'bg-primary text-background shadow-md hover:bg-primary/95'
                    : 'bg-surface-container border border-outline-variant/20 text-on-surface-variant/30 cursor-not-allowed'
                }`}
              >
                <MdSend size={15} />
              </motion.button>
            </form>
          </div>
        </div>
      )}
    </motion.aside>
  );
}

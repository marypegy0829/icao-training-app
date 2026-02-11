import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface TranscriptProps {
  messages: ChatMessage[];
}

const Transcript: React.FC<TranscriptProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="w-full max-w-lg flex-1 overflow-y-auto px-4 py-2 space-y-3 mask-image-gradient">
      {messages.length === 0 && (
        <div className="h-full flex items-center justify-center">
            <p className="text-center text-ios-subtext text-sm">
                Transcription will appear here...
            </p>
        </div>
      )}
      
      {messages.map((msg, idx) => (
        <div 
          key={msg.id + idx} 
          className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div 
            className={`
              max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm
              ${msg.role === 'user' 
                ? 'bg-ios-blue text-white rounded-br-sm' 
                : 'bg-white text-ios-text border border-ios-border rounded-bl-sm'}
            `}
          >
            {msg.text}
            {msg.isPartial && (
                <span className="inline-block w-1 h-3 ml-1 bg-current opacity-50 animate-pulse"></span>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default Transcript;

// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
  Avatar,
} from '@chatscope/chat-ui-kit-react';
import { UserData } from '../../services/analysisService';
import ImageUploader from './analysis/ImageUploader'; // Re-use existing uploader
import { translations, Lang, t as i18n_t } from '../../lib/i18n';
import { CHAT_CONFIG } from '../../config/chat';

interface ChatOnboardingProps {
  onAnalysisReady: (file: File, userData: UserData) => void;
  language: Lang;
  t: (key: keyof typeof translations.en) => string;
}

type Step = 'GREETING' | 'WAIT_NAME' | 'ASK_INTENT' | 'WAIT_INTENT' | 'UPLOAD_READY' | 'COMPLETED';

interface ChatMessage {
  id: string;
  message: string;
  sender: 'Arina' | 'User';
  direction: 'incoming' | 'outgoing';
  type?: 'text' | 'custom'; // custom for Uploader
}

const ChatOnboarding: React.FC<ChatOnboardingProps> = ({ onAnalysisReady, language, t }) => {
  const [step, setStep] = useState<Step>('GREETING');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [userData, setUserData] = useState<UserData>({});
  const [isUploading, setIsUploading] = useState(false);
  const greetingSentRef = useRef(false);

  // Helper to add message safely
  const addMessage = (text: string, sender: 'Arina' | 'User') => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      message: text,
      sender,
      direction: sender === 'Arina' ? 'incoming' : 'outgoing',
      type: 'text'
    }]);
  };

  // Bot typing simulation
  const botSpeak = (text: string, nextStep: Step, delay = CHAT_CONFIG.TYPING_DELAY) => {
    setIsTyping(true);
    setTimeout(() => {
      addMessage(text, 'Arina');
      setIsTyping(false);
      setStep(nextStep);
    }, delay);
  };

  // Initial Greeting - only once
  useEffect(() => {
    if (step === 'GREETING' && !greetingSentRef.current) {
      greetingSentRef.current = true;
      botSpeak(t('chat.arina.greeting'), 'WAIT_NAME', CHAT_CONFIG.GREETING_DELAY);
    }
  }, []); // Empty deps - run only on mount

  const handleSend = (text: string) => {
    addMessage(text, 'User');

    if (step === 'WAIT_NAME') {
      setUserData(prev => ({ ...prev, name: text }));
      const message = t('chat.arina.askIntent').replace('{name}', text);
      botSpeak(message, 'WAIT_INTENT');
    } else if (step === 'WAIT_INTENT') {
      setUserData(prev => ({ ...prev, intent: text }));
      botSpeak(t('chat.arina.askUpload'), 'UPLOAD_READY');
    }
  };

  const handleImageSelect = (file: File) => {
    // When image is selected, show uploading state and trigger analysis
    setIsUploading(true);
    onAnalysisReady(file, userData);
    setStep('COMPLETED');
  };

  return (
    <div
      className="chat-onboarding-container w-full flex-1"
      style={{ position: 'relative', minHeight: '300px' }}
    >
      <MainContainer>
        <ChatContainer>
          <MessageList 
            typingIndicator={isTyping ? <TypingIndicator content={t('chat.typing')} /> : null}
          >
            {messages.map((msg) => (
              <Message
                key={msg.id}
                model={{
                  message: msg.message,
                  sentTime: "just now",
                  sender: msg.sender,
                  direction: msg.direction as "incoming" | "outgoing",
                  position: "single"
                }}
              >
                <Avatar src={msg.sender === 'Arina' ? CHAT_CONFIG.ARINA_AVATAR : CHAT_CONFIG.USER_AVATAR} name={msg.sender} />
              </Message>
            ))}
            
            {/* Render Uploader inside the chat flow when ready */}
            {step === 'UPLOAD_READY' && (
               <div className="my-4 p-2">
                 <ImageUploader onImageSelect={handleImageSelect} t={t} />
               </div>
            )}

            {/* Show loading message when uploading */}
            {isUploading && (
               <div className="my-4 p-4 text-center">
                 <div className="animate-pulse text-muted-foreground">
                   {t('chat.uploading')}
                 </div>
               </div>
            )}
          </MessageList>
          <MessageInput 
            placeholder={t('chat.placeholder')}
            onSend={handleSend}
            disabled={step === 'UPLOAD_READY' || isTyping}
            autoFocus
          />
        </ChatContainer>
      </MainContainer>
    </div>
  );
};

export default ChatOnboarding;

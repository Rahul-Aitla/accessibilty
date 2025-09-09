import React, { useState } from 'react';
import { MessageCircle, Send, X, Bot, User } from 'lucide-react';

const ChatBot = ({ scanResult, websiteUrl, apiUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (message, isAutoSuggestion = false) => {
    if (!message.trim() && !isAutoSuggestion) return;

    const userMessage = isAutoSuggestion 
      ? 'Get accessibility suggestions for this website'
      : message;

    // Add user message to chat
    const newUserMessage = {
      id: Date.now(),
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Get API URL from environment variables or use default
      const API_URL = apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:4000';
      
      const response = await fetch(`${API_URL}/api/gemini-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: websiteUrl,
          scanResult: scanResult,
          message: isAutoSuggestion ? null : message
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Add AI response to chat
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: data.suggestion,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: `Sorry, I couldn't provide suggestions at the moment. Error: ${error.message}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const getAutoSuggestion = () => {
    sendMessage('', true);
  };

  const formatMessage = (content) => {
    // Enhanced formatting for better readability
    return content
      .split('\n')
      .map((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return <br key={index} />;
        
        // Format headers with emojis
        if (trimmedLine.startsWith('🔧') || trimmedLine.startsWith('💡') || trimmedLine.startsWith('⚠️')) {
          return (
            <div key={index} className="font-semibold text-primary mb-2 mt-3 first:mt-0">
              {trimmedLine}
            </div>
          );
        }
        
        // Format bullet points
        if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
          return (
            <div key={index} className="ml-4 mb-1">
              <span className="text-primary mr-2">•</span>
              {trimmedLine.replace(/^[•-]\s*/, '')}
            </div>
          );
        }
        
        // Format numbered lists
        if (trimmedLine.match(/^\d+\./)) {
          return (
            <div key={index} className="ml-4 mb-1 font-medium">
              {trimmedLine}
            </div>
          );
        }
        
        // Regular text
        return (
          <div key={index} className="mb-1">
            {trimmedLine}
          </div>
        );
      });
  };

  if (!websiteUrl) return null;

  return (
    <div className="fixed right-0 top-1/4 z-50">
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-primary-foreground p-3 rounded-l-full shadow-lg hover:bg-primary/90 transition-colors animate-pulse ml-0 mr-0"
          title="Ask AI for accessibility suggestions"
          aria-label="Open accessibility assistant"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div 
          className={`bg-white dark:bg-gray-800 rounded-l-lg shadow-xl border border-r-0 w-80 ${isMinimized ? 'h-12' : 'h-96'} flex flex-col transform transition-all duration-300 ease-in-out animate-slide-in`}
          style={{
            animationDuration: '0.3s',
            animationFillMode: 'forwards'
          }}
        >
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-3 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
            <Bot size={20} />
            <span className="font-medium">AI Accessibility Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="hover:bg-primary/80 p-1 rounded"
              title={isMinimized ? "Expand" : "Minimize"}
            >
              {isMinimized ? 
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg> : 
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
              }
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-primary/80 p-1 rounded"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
          </div>

          {/* Messages */}
          {!isMinimized && <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                <Bot size={32} className="mx-auto mb-2 text-primary" />
                <p className="text-sm mb-3">
                  Hi! I can help you improve the accessibility of your website.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={getAutoSuggestion}
                    className="block w-full bg-primary text-primary-foreground px-3 py-2 rounded text-sm hover:bg-primary/90"
                    disabled={isLoading}
                  >
                    ✨ Get Quick Suggestions
                  </button>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    <button
                      onClick={() => sendMessage("How can I make this website more accessible?")}
                      className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      disabled={isLoading}
                    >
                      💡 General Tips
                    </button>
                    <button
                      onClick={() => sendMessage("What are the most critical issues to fix first?")}
                      className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      disabled={isLoading}
                    >
                      🚨 Priority Issues
                    </button>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${
                  msg.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.type === 'ai' && (
                  <Bot size={20} className="text-primary mt-1 flex-shrink-0" />
                )}
                <div
                  className={`max-w-[70%] p-2 rounded-lg text-sm ${
                    msg.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {msg.type === 'ai' ? formatMessage(msg.content) : msg.content}
                </div>
                {msg.type === 'user' && (
                  <User size={20} className="text-primary mt-1 flex-shrink-0" />
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start">
                <Bot size={20} className="text-primary mt-1 flex-shrink-0" />
                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>}

          {/* Input */}
          {!isMinimized && <form onSubmit={handleSubmit} className="p-3 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about accessibility..."
                className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="bg-primary text-primary-foreground p-1 rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </div>
          </form>}
        </div>
      )}
    </div>
  );
};

export default ChatBot;

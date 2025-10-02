import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User } from 'lucide-react';

const ChatBot = ({ scanResult, websiteUrl, apiUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const sendMessage = useCallback(async (message, isAutoSuggestion = false) => {
    if (!message.trim() && !isAutoSuggestion) return;
    if (!websiteUrl || !apiUrl) {
      console.error('Missing required props for ChatBot');
      
      // Show user-friendly error message
      const errorMessage = {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: 'Configuration error: Missing website URL or API endpoint. Please reload the page or try again later.',
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    const userMessage = isAutoSuggestion 
      ? 'Get accessibility suggestions for this website'
      : message.trim();

    // Add user message to chat
    const newUserMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    // First check if server is available
    let serverAvailable = false;
    try {
      const healthCheck = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // Quick 5-second timeout for health check
      });
      serverAvailable = healthCheck.ok;
    } catch (error) {
      console.warn('Server health check failed:', error);
      // Continue anyway, the main request will handle errors
    }

    try {
      // Reduced timeout to improve user experience
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, 20000); // 20 second timeout (reduced from 30s)

      const response = await fetch(`${apiUrl}/api/gemini-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: websiteUrl,
          scanResult: scanResult,
          message: isAutoSuggestion ? null : message.trim()
        }),
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetail;
        
        try {
          // Try to parse error as JSON
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.error || errorJson.message || `Server error: ${response.status}`;
        } catch (e) {
          errorDetail = `HTTP ${response.status}: ${response.statusText || errorText.substring(0, 100)}`;
        }
        
        throw new Error(errorDetail);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Add AI response to chat
      const aiMessage = {
        id: `ai-${Date.now()}`,
        type: 'ai',
        content: data.suggestion || 'I received an empty response. Please try again.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted due to timeout');
        
        const timeoutMessage = {
          id: `error-${Date.now()}`,
          type: 'ai',
          content: 'The request took too long to complete. This might be due to server load or complexity of your question. Would you like to try a simpler question or try again?',
          timestamp: new Date(),
          isError: true
        };
        
        setMessages(prev => [...prev, timeoutMessage]);
        return;
      }

      console.error('Error getting AI suggestion:', error);
      
      let errorContent = 'Sorry, I couldn\'t provide suggestions at the moment.';
      
      if (!serverAvailable) {
        errorContent = 'The AI service appears to be offline. Please check that the backend server is running and try again.';
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        errorContent = 'Unable to connect to the AI service. Please check your connection and ensure the backend server is running.';
      } else if (error.message.includes('timeout')) {
        errorContent = 'The request timed out. Please try again with a shorter question or check server performance.';
      } else if (error.message.includes('GEMINI_API_KEY')) {
        errorContent = 'The AI service is missing its API key. Please check the server configuration.';
      } else if (error.message) {
        errorContent = `Error: ${error.message}`;
      }

      const errorMessage = {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: errorContent,
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [websiteUrl, apiUrl, scanResult]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (inputMessage.trim() && !isLoading) {
      sendMessage(inputMessage);
    }
  }, [inputMessage, isLoading, sendMessage]);

  const getAutoSuggestion = useCallback(() => {
    if (!isLoading) {
      sendMessage('', true);
    }
  }, [isLoading, sendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

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
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-105"
          title="Ask AI for accessibility suggestions"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-96 h-[500px] flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary-dark text-primary-foreground p-4 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={22} className="text-white" />
              <span className="font-semibold text-lg">AI Accessibility Assistant</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearMessages}
                className="hover:bg-primary-dark/50 p-1.5 rounded-full transition-colors"
                title="Clear conversation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-primary-dark/50 p-1.5 rounded-full transition-colors"
                title="Close chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-6 flex flex-col items-center">
                <Bot size={40} className="mx-auto mb-3 text-primary animate-pulse" />
                <p className="text-sm mb-4 max-w-xs mx-auto">
                  Hi! I can help you improve the accessibility of your website based on the scan results.
                </p>
                <div className="space-y-3 w-full max-w-xs">
                  <button
                    onClick={getAutoSuggestion}
                    className="block w-full bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm hover:bg-primary/90 transition-colors shadow-sm font-medium"
                    disabled={isLoading}
                  >
                    ✨ Get Quick Suggestions
                  </button>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => sendMessage("How can I make this website more accessible?")}
                      className="bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
                      disabled={isLoading}
                    >
                      💡 General Tips
                    </button>
                    <button
                      onClick={() => sendMessage("What are the most critical issues to fix first?")}
                      className="bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
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
                } animate-fade-in`}
              >
                {msg.type === 'ai' && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot size={18} className="text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.type === 'user'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : msg.isError
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm border border-gray-100 dark:border-gray-700'
                  }`}
                >
                  {msg.type === 'ai' ? formatMessage(msg.content) : msg.content}
                </div>
                {msg.type === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-white" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start animate-fade-in">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot size={18} className="text-primary" />
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about accessibility..."
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="bg-primary text-primary-foreground p-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Send message"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ChatBot;

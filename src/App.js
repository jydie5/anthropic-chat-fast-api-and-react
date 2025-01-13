import React, { useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messageContentRef = useRef('');

  const updateAssistantMessage = useCallback((content) => {
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === 'assistant') {
        return prev.map((msg, i) => 
          i === prev.length - 1 ? 
          { ...msg, content } : 
          msg
        );
      }
      return [...prev, { role: 'assistant', content }];
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      messageContentRef.current = '';
      
      console.log('Sending message:', userMessage);
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ message: userMessage })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        const processedLines = lines
          .filter(line => line.startsWith('data: '))
          .map(line => line.slice(6).trim());

        for (const data of processedLines) {
          if (data === '[DONE]') {
            console.log('Stream complete');
            setIsLoading(false);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              messageContentRef.current += parsed.text;
              updateAssistantMessage(messageContentRef.current);
            }
          } catch (e) {
            console.error('Failed to parse data:', data, e);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { role: 'error', content: 'エラーが発生しました。もう一度お試しください。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Claude Haiku Chat</h1>
      </header>
      <main className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && <div className="message loading">応答を生成中...</div>}
        </div>
        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            送信
          </button>
        </form>
      </main>
    </div>
  );
}

export default App;

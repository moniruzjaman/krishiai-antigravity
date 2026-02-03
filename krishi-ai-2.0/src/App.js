import React, { useState, useRef } from 'react';
import axios from 'axios';
import './App.css'; // We will create this file next

// In a real deployed app, this would be your Vercel/Netlify function URL
// For local development, it points to our Express server
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

function App() {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImagePreview(null);
      setSelectedImageFile(null);
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim() && !selectedImageFile) {
      setError('Please enter a prompt or upload an image.');
      return;
    }

    setLoading(true);
    setError('');
    const newUserMessage = {
      role: 'user',
      text: prompt,
      image: selectedImagePreview,
    };
    setMessages((prev) => [...prev, newUserMessage]);

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('model', selectedModel);
    if (selectedImageFile) {
      formData.append('image', selectedImageFile);
    }

    try {
      const response = await axios.post(`${BACKEND_URL}/api/chat`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setMessages((prev) => [...prev, { role: 'ai', text: response.data.text }]);
    } catch (err) {
      console.error('Error fetching AI response:', err);
      const errorMessage = err.response?.data?.details || err.message || 'Failed to get AI response.';
      setError(errorMessage);
      setMessages(prev => [...prev, { role: 'ai', text: `Error: ${errorMessage}` }]);
    } finally {
      setPrompt('');
      setSelectedImagePreview(null);
      setSelectedImageFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = null; // Reset file input
      }
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Hybrid Multi-Model AI Chat</h1>
      </header>
      <main className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong>
              <p>{msg.text}</p>
              {msg.image && <img src={msg.image} alt="User upload" className="message-image" />}
            </div>
          ))}
          {loading && <p className="loading-indicator">AI is thinking...</p>}
          {error && <p className="error-message">{error}</p>}
        </div>
        <div className="chat-input-area">
          <div className="controls">
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="model-selector">
              <option value="gemini">Gemini Pro (Multimodal)</option>
              <option value="chatgpt">ChatGPT (gpt-3.5-turbo)</option>
              <option value="huggingface">Hugging Face (flan-t5-small)</option>
            </select>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageChange}
              className="image-input"
              id="image-upload"
            />
            <label htmlFor="image-upload" className="image-upload-label">
              {selectedImagePreview ? 'Change Image' : 'Attach Image'}
            </label>
          </div>
          {selectedImagePreview && (
            <div className="image-preview-container">
              <img src={selectedImagePreview} alt="Preview" className="image-preview" />
            </div>
          )}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="prompt-textarea"
            rows="3"
          />
          <button onClick={handleSubmit} disabled={loading} className="submit-button">
            Send
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;

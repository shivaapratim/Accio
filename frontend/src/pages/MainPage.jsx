// File: src/pages/MainPage.jsx - FINAL COMPLETE VERSION

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Sandpack } from '@codesandbox/sandpack-react';
import axios from 'axios';
import '../App.css';

const defaultComponentCode = `
import React from 'react';
import styled from 'styled-components';

const Wrapper = styled.div\`
  padding: 2rem;
  text-align: center;
  color: #888;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
\`;

export default function Welcome() {
  return (
    <Wrapper>
      <div>
        <h2>Welcome to Component AI!</h2>
        <p>Your self-contained component with built-in styles will appear here.</p>
      </div>
    </Wrapper>
  );
}`;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const MainPage = () => {
    const { token, logout } = useContext(AuthContext);
    const [jsxCode, setJsxCode] = useState(defaultComponentCode);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastPrompt, setLastPrompt] = useState('');
    const [savedComponents, setSavedComponents] = useState([]);
    const [dependencies, setDependencies] = useState({ "styled-components": "latest" });
    
    // useMemo creates a stable version of the 'api' object so useEffect doesn't run unnecessarily
    const api = useMemo(() => axios.create({
        baseURL: API_URL,
        headers: { 'Authorization': `Bearer ${token}` }
    }), [token]);

    useEffect(() => {
        if (token) {
            api.get('/get-components')
              .then(response => setSavedComponents(response.data))
              .catch(error => {
                console.error("Failed to fetch components:", error);
                if (error.response && error.response.status === 401) logout();
              });
        }
    }, [token, api, logout]);

    const askAI = async () => {
        setIsLoading(true);
        setLastPrompt(prompt);
        try {
            const response = await axios.post(`${API_URL}/ask-ai`, { prompt });
            let finalJsx = response.data.jsx;
            
            const newDeps = { "styled-components": "latest" };
            const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(finalJsx)) !== null) {
              const depName = match[1];
              if (depName !== 'react' && depName !== 'react-dom' && !depName.startsWith('./')) {
                newDeps[depName] = "latest";
              }
            }
            setDependencies(newDeps);
            
            setJsxCode(finalJsx);
        } catch (error) {
            alert(`Error generating component.`);
            setJsxCode(defaultComponentCode);
        }
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (jsxCode === defaultComponentCode) {
            alert('Please generate a component before saving.');
            return;
        }
        try {
            const response = await api.post('/save-component', { prompt: lastPrompt, jsx: jsxCode, css: "" });
            alert(response.data.message);
            const freshComponents = await api.get('/get-components');
            setSavedComponents(freshComponents.data);
        } catch (error) {
            alert('Failed to save component.');
        }
    };

    const loadComponent = (component) => {
        setJsxCode(component.jsx);
        setPrompt(component.prompt);
        setLastPrompt(component.prompt);
    };

    return (
        <div className="app-container">
            <div className="side-panel">
                <h2>Component AI</h2>
                <button onClick={logout} className="logout-button">Logout</button>
                <textarea placeholder="e.g., a styled login form..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                <button onClick={askAI} disabled={isLoading}>{isLoading ? 'Generating...' : '✨ Generate'}</button>
                <button onClick={handleSave} style={{ marginTop: '10px' }}>💾 Save Component</button>
                <div className="saved-components-list">
                    <h3>Saved Components</h3>
                    <ul>{savedComponents.map(c => <li key={c._id} onClick={() => loadComponent(c)}>{c.prompt}</li>)}</ul>
                </div>
            </div>
            <div className="main-content">
                <Sandpack
                    template="react"
                    theme="dark"
                    options={{ 
                        editorHeight: 'calc(100vh - 40px)',
                        showTabs: false,
                        showConsole: true,
                        showConsoleButton: true
                    }}
                    files={{
                        // The AI-generated file is the main entry point for the preview
                        "/App.js": jsxCode,
                    }}
                    customSetup={{ 
                        dependencies: dependencies 
                    }}
                />
            </div>
        </div>
    );
};
export default MainPage;
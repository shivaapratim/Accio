// File: src/pages/MainPage.jsx - FINAL COMPLETE & CORRECTED VERSION

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Sandpack } from '@codesandbox/sandpack-react';
import axios from 'axios';
import '../App.css';

const defaultComponentCode = `
// The AI will generate a React component here.
// The app will automatically add 'export default' for you.

function Welcome() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#888', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div>
        <h2>Welcome to Component AI!</h2>
        <p>Enter a prompt to generate a component with its own CSS.</p>
      </div>
    </div>
  );
}

export default Welcome;
`;

const sandpackIndexFile = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Component from './Component'; // This is where the AI's component will live
import './styles.css';

const root = createRoot(document.getElementById('root'));
root.render(<Component />);
  `;

const API_URL =  "https://ai-component-backend.onrender.com/";

const MainPage = () => {
    const { token, logout } = useContext(AuthContext);
    const [jsxCode, setJsxCode] = useState(defaultComponentCode);
    const [cssCode, setCssCode] = useState("/* CSS will appear here */");
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastPrompt, setLastPrompt] = useState('');
    const [savedComponents, setSavedComponents] = useState([]);
    
    const api = useMemo(() => axios.create({
        baseURL: API_URL,
        headers: { 'Authorization': `Bearer ${token}` }
    }), [token]);

    useEffect(() => {
        if (token) {
            api.get('/get-components')
              .then(response => setSavedComponents(response.data))
              .catch(error => {
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
            
            // The AI is instructed not to add 'export default', so we add it ourselves.
            const componentNameMatch = finalJsx.match(/function\s+(\w+)\s*\(/) || finalJsx.match(/const\s+(\w+)\s*=\s*\(/);
            if (componentNameMatch && componentNameMatch[1]) {
                finalJsx += `\n\nexport default ${componentNameMatch[1]};`;
            } else {
              finalJsx += `\n\n// Error: Could not automatically find component name to export.`;
            }
            
            setJsxCode(finalJsx);
            setCssCode(response.data.css);
        } catch (error) {
            const errorMessage = error.response?.data?.reason || error.message;
            alert(`Error generating component: ${errorMessage}`);
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
            const response = await api.post('/save-component', { prompt: lastPrompt, jsx: jsxCode, css: cssCode });
            alert(response.data.message);
            const freshComponents = await api.get('/get-components');
            setSavedComponents(freshComponents.data);
        } catch (error) {
            alert('Failed to save component.');
        }
    };

    const loadComponent = (component) => {
        setJsxCode(component.jsx);
        setCssCode(component.css);
        setPrompt(component.prompt);
        setLastPrompt(component.prompt);
    };

    return (
        <div className="app-container">
            <div className="side-panel">
                <h2>Component AI</h2>
                <button onClick={logout} className="logout-button">Logout</button>
                <textarea placeholder="e.g., a modern login form..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
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
                    options={{ activeFile: "/Component.js", editorHeight: 'calc(100vh - 40px)', showTabs: true }}
                    files={{
                        "/index.js": { code: sandpackIndexFile, hidden: true },
                        "/Component.js": jsxCode,
                        "/styles.css": cssCode,
                    }}
                />
            </div>
        </div>
    );
};

export default MainPage;

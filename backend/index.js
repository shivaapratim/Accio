const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
// Enable CORS for your frontend domain
app.use(cors({
    origin: 'https://accio-pro.onrender.com' // Allow requests only from your deployed frontend
}));
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// Basic validation for environment variables
if (!MONGO_URL || !OPENROUTER_API_KEY || !JWT_SECRET) {
    console.error("ERROR: Missing one or more required environment variables (MONGO_URL, OPENROUTER_API_KEY, JWT_SECRET).");
    process.exit(1); // Exit the process if critical env vars are missing
}

mongoose.connect(MONGO_URL)
  .then(() => console.log('Successfully connected to MongoDB!'))
  .catch(err => console.error('ERROR: Could not connect to MongoDB.', err));

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const componentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    prompt: String,
    jsx: String,
    css: String,
    createdAt: { type: Date, default: Date.now }
});

const Component = mongoose.model('Component', componentSchema);

const auth = (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Authentication failed. Please log in.' });
    }
};

app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully!' });
    } catch (error) {
        // More specific error handling for duplicate email
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Email already registered.' });
        }
        console.error("Register error:", error); // Log the actual error
        res.status(500).json({ error: 'An error occurred during registration.' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } catch (error) {
        console.error("Login error:", error); // Log the actual error
        res.status(500).json({ error: 'Something went wrong during login.' });
    }
});

app.post('/ask-ai', async (req, res) => {
  const userPrompt = req.body.prompt;
  if (!userPrompt) {
    return res.status(400).json({ error: 'Prompt is missing' });
  }

  const fullPrompt = `You are an expert React developer specializing in the 'styled-components' library. Your task is to generate a single, self-contained React component file.

Instructions:
1. You MUST use 'styled-components' for all styling. Do not write any separate CSS or import any .css files.
2. The entire response MUST be a single, valid JSX file inside one \`\`\`jsx ... \`\`\` markdown block.
3. The file must include 'import React from "react";' and 'import styled from "styled-components";'.
4. Define all styled-components at the top of the file, before the main React component.
5. The main React component must be exported using 'export default'.
6. Do not include any other text or explanations outside the markdown block.

Prompt: "${userPrompt}"`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        "model": "anthropic/claude-3-haiku",
        "messages": [{ "role": "user", "content": fullPrompt }]
      })
    });

    if (!response.ok) {
        const errorData = await response.json();
        // This line was added: Throwing an error with a more specific message from OpenRouter
        throw new Error(errorData.error.message || `API request failed with status ${response.status}`);
    }
    
    const completion = await response.json();
    const rawText = completion.choices[0].message.content;

    const jsxRegex = /```jsx\s*([\s\S]*?)\s*```/;
    const jsxMatch = rawText.match(jsxRegex);
    
    if (!jsxMatch || !jsxMatch[1]) {
      throw new Error("AI response did not contain a valid ```jsx markdown block.");
    }
    
    const codeObject = {
      jsx: jsxMatch[1].trim(),
      css: "" // Assuming CSS is handled by styled-components within JSX
    };

    res.json(codeObject);
  } catch (error) {
    console.error("Error processing AI response:", error.message); // This line was made more generic
    res.status(500).json({ error: `Failed to get response from AI: ${error.message}` }); // This line was made more specific
  }
});

app.post('/save-component', auth, async (req, res) => {
  try {
    const { prompt, jsx, css } = req.body;
    const newComponent = new Component({ 
        prompt, 
        jsx, 
        css, 
        userId: req.userId
    });
    await newComponent.save();
    res.status(201).json({ message: 'Component saved!', component: newComponent });
  } catch (error) {
    console.error("Save component error:", error); // Log the actual error
    res.status(500).json({ error: 'Failed to save component.' });
  }
});

app.get('/get-components', auth, async (req, res) => {
  try {
    const components = await Component.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(components);
  } catch (error) {
    console.error("Get components error:", error); // Log the actual error
    res.status(500).json({ error: 'Failed to fetch components.' });
  }
});

const PORT = process.env.PORT || 3001; // Use Render's PORT or default to 3001 for local dev
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
  // In production, Render handles the host; for local, it's localhost
});
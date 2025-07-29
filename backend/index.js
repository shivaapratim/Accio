const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;


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
        res.status(400).json({ error: 'Email may already be in use.' });
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
        res.status(500).json({ error: 'Something went wrong.' });
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
        throw new Error(errorData.error.message);
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
      css: ""
    };

    res.json(codeObject);
  } catch (error) {
    console.error("Error processing AI response:", error.message);
    res.status(500).json({ error: "Failed to process the response from the AI." });
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
    res.status(500).json({ error: 'Failed to save component.' });
  }
});

app.get('/get-components', auth, async (req, res) => {
  try {
    const components = await Component.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(components);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch components.' });
  }
});


app.listen(3001, () => {
  console.log('Backend server is running on http://localhost:3001');
});
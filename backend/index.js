


require('dotenv').config(); // MUST BE THE FIRST LINE
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');


const app = express();
// app.use(cors());
app.use(cors({
  origin: ['https://accio-pro.onrender.com', 'http://localhost:3000'],
  credentials: true
}));


// shivang


app.use(express.json());


// --- SECRETS LOADED FROM ENVIRONMENT VARIABLES ---
const MONGO_URL = process.env.MONGO_URL;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;


// CRITICAL: Validate that all secrets are loaded.
// This prevents runtime errors by stopping the server if a secret is missing.
if (!MONGO_URL || !OPENROUTER_API_KEY || !JWT_SECRET) {
    console.error("FATAL ERROR: One or more environment variables (MONGO_URL, OPENROUTER_API_KEY, JWT_SECRET) are missing.");
    console.error("Please check your .env file for local development or your Render environment variables for production.");
    process.exit(1); // Stop the server if secrets are missing.
}


// --- DATABASE CONNECTION ---
mongoose.connect(MONGO_URL)
  .then(() => console.log('Successfully connected to MongoDB!'))
  .catch(err => console.error('ERROR: Could not connect to MongoDB.', err));


// --- DATABASE SCHEMAS ---
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


// --- AUTHENTICATION MIDDLEWARE ---
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


// --- AUTHENTICATION ROUTES ---
app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
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
        if (!user) return res.status(401).json({ error: 'Invalid credentials.' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});


// --- AI ENDPOINT ---
app.post('/ask-ai', async (req, res) => {
  const userPrompt = req.body.prompt;
  if (!userPrompt) return res.status(400).json({ error: 'Prompt is missing' });


  const fullPrompt = `Generate a React component based on this request: "${userPrompt}"


CRITICAL: Return EXACTLY in this format with correct markers:


JSX_START
function ComponentName() {
  return (
    <div className="component-wrapper">
      {/* Your JSX content here */}
    </div>
  );
}
JSX_END


CSS_START
.component-wrapper {
  /* Your CSS styles here */
}
CSS_END


RULES:
- Use JSX_START and JSX_END markers for React component.
- Use CSS_START and CSS_END markers for CSS styles.
- Functional React component only.
- Use className (not class).
- No export statements.
- No additional explanations or text outside markers.`;


  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        "model": "deepseek/deepseek-r1-distill-llama-70b",
        "messages": [{ "role": "user", "content": fullPrompt }]
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          // UPDATED: Using your production frontend URL
          "HTTP-Referer": "https://accio-pro.onrender.com",
          "X-Title": "AI Component Builder"
        }
      }
    );
   
    const rawText = response.data.choices[0].message.content;


    const jsxMatch = rawText.match(/JSX_START\s*([\s\S]*?)\s*JSX_END/);
    const cssMatch = rawText.match(/CSS_START\s*([\s\S]*?)\s*CSS_END/);
   
    if (!jsxMatch || !jsxMatch[1]) {
      throw new Error("AI response did not contain valid JSX_START/JSX_END markers.");
    }
   
    const jsx = jsxMatch[1].trim();
    const css = cssMatch ? cssMatch[1].trim() : "/* CSS not found in response. */";
   
    res.json({ jsx, css });


  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error("Error processing AI response:", errorMessage);
    res.status(500).json({
        error: "Failed to process the response from the AI.",
        reason: errorMessage
    });
  }
});


// --- COMPONENT ENDPOINTS ---
app.post('/save-component', auth, async (req, res) => {
  try {
    const { prompt, jsx, css } = req.body;
    const newComponent = new Component({ prompt, jsx, css, userId: req.userId });
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


// --- SERVER START ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
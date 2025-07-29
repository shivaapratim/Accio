import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    // Define the backend URL using the environment variable
    // This variable must be set in your Render frontend service settings (VITE_BACKEND_URL)
    // and potentially in a local .env file for development.
    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); 
        try {
            // Use the environment variable for the API call
            const response = await axios.post(`${BACKEND_URL}/login`, { email, password });
            login(response.data.token);
            navigate('/'); // Redirect to the main app after successful login
        } catch (err) {
            // More robust error handling to display the specific message from the backend
            const errorMessage = err.response && err.response.data && err.response.data.error 
                                ? err.response.data.error 
                                : 'An unexpected error occurred. Please try again.';
            setError(errorMessage);
            console.error('Login failed:', err);
        }
    };

    return (
        <div className="auth-container">
            <form onSubmit={handleSubmit} className="auth-form">
                <h2>Login</h2>
                {error && <p className="error-message">{error}</p>}
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Login</button>
                <p>Don't have an account? <Link to="/register">Register</Link></p>
            </form>
        </div>
    );
};

export default Login;
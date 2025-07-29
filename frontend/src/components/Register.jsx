import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const Register = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
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
            await axios.post(`${BACKEND_URL}/register`, { email, password });
            navigate('/login');
        } catch (err) {
            // More robust error handling to display the specific message from the backend
            const errorMessage = err.response && err.response.data && err.response.data.error 
                                ? err.response.data.error 
                                : 'Failed to register. An unexpected error occurred.';
            setError(errorMessage);
            console.error('Registration failed:', err);
        }
    };

    return (
        <div className="auth-container">
            <form onSubmit={handleSubmit} className="auth-form">
                <h2>Register</h2>
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
                <button type="submit">Register</button>
                <p>Already have an account? <Link to="/login">Login</Link></p>
            </form>
        </div>
    );
};

export default Register;
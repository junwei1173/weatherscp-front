import React, { useState } from 'react';
import axios from 'axios';

function LoginRegister({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  const handleSubmit = async () => {
  setError('');
  setSuccess('');
  try {
    const endpoint = isRegister ? 'register' : 'login';
    const res = await axios.post(`http://localhost:5050/${endpoint}`, {
      username,
      password,
    });

    if (isRegister) {
      if (res.data.userId) {
        // Save user ID after registration
        localStorage.setItem('userId', res.data.userId);
      }
      setSuccess('✅ Registered successfully! You can now log in.');
      setIsRegister(false); // Switch to login view
    } else {
      if (res.data.userId) {
        // Save user ID after login
        localStorage.setItem('userId', res.data.userId);
        onLogin(res.data.userId); // Notify parent to show the app
      } else {
        setError('Incorrect username or password.');
      }
    }
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      setError(err.response.data.error);
    } else {
      setError('Something went wrong');
    }
  }
};



  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: 'auto' }}>
    <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}> </h2>
    <img 
  src="/weatherlogo.png" 
  alt="Weather header" 
  style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '8px', marginTop: '1rem' }} 
/>
      <h2>{isRegister ? 'Register' : 'Login'}</h2>
      <input
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%' }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ display: 'block', marginBottom: '1rem', width: '100%' }}
      />
      <button onClick={handleSubmit} style={{ width: '100%', padding: '0.5rem',borderRadius:'50px', backgroundColor:'',border: '1px solid #78caf7' }}>
        {isRegister ? 'Register' : 'Login'}
      </button>

      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
      {success && <p style={{ color: 'green', marginTop: '1rem' }}>{success}</p>}

      <p
        onClick={() => {
          setIsRegister(!isRegister);
          setError('');
        }}
        style={{ color: 'blue', cursor: 'pointer', marginTop: '1rem', textAlign: 'center' }}
      >
        {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
      </p>
    </div>
  );
}

export default LoginRegister;

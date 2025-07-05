import React, { useState } from 'react';
import WeatherScope from './components/WeatherScope';
import LoginRegister from './components/LoginRegister';

function App() {
  const [userId, setUserId] = useState(null);

  const handleLogout = () => {
    setUserId(null);
  };

  return (
    <div>
      {!userId ? (
        <LoginRegister onLogin={setUserId} />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
            <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', borderRadius:'50px', backgroundColor:'',border: '1px solid #78caf7' }}>
              Logout
            </button>
          </div>
          <WeatherScope userId={userId} />
        </>
      )}
    </div>
  );
}

export default App;

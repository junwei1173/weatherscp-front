import React, { useState, useEffect } from 'react'; 
import { useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
// Fix default icon so pins show up
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});



function WeatherScope({ userId }) {
  const today = new Date();
  const maxForecastDate = new Date();
  maxForecastDate.setDate(today.getDate() + 4); // only 5 days total (today included)

  const formattedToday = today.toISOString().split('T')[0];
  const formattedMaxDate = maxForecastDate.toISOString().split('T')[0];
  
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [visibleSuggestions, setVisibleSuggestions] = useState({});
  const [showHistory, setShowHistory] = useState(true);
  const [tripCity, setTripCity] = useState('');
  const [tripDate, setTripDate] = useState('');
  const [tripForecast, setTripForecast] = useState(null);
  const [tripEvents, setTripEvents] = useState([]);

  const [expandedDates, setExpandedDates] = useState({});
  const [showAllForecast, setShowAllForecast] = useState(true);
  const [playlistIndex, setPlaylistIndex] = useState(0);

  const [mapCenter, setMapCenter] = useState([20, 0]); // default world center
  const [cityMarker, setCityMarker] = useState(null);
  const [eventMarkers, setEventMarkers] = useState([]);


  const weatherRef = useRef(null);  

  const capitalize = (s) => {
  if (!s) return '';
  return s
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
  

  // Helper function
const formatDate = (isoDateString) => {
  if (!isoDateString) return 'No date selected';

  try {
    const [year, month, day] = isoDateString.split("-");
    const dateObj = new Date(`${year}-${month}-${day}T12:00:00`);
    if (isNaN(dateObj)) return 'Invalid date';

    return dateObj.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
};

function MapUpdater({ center }) {
  const map = useMap();

  React.useEffect(() => {
    if (center) {
      map.flyTo(center, 10); // Adjust zoom level if you like
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center]);

  return null;
}




  const handleTripPlan = async () => {
    if (!tripCity || !tripDate) return alert("Please enter both city and date.");

    try {
      const res = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
        params: {
          q: tripCity,
          appid: 'eb15f8ab4e356d62dd84027c18eff998',
          units: 'metric'
        }
      });

      const filtered = res.data.list.filter(item => {
        const localDate = new Date(item.dt * 1000);
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const localDateFormatted = `${year}-${month}-${day}`;

        return localDateFormatted === tripDate;
      });

      if (filtered.length === 0) {
        alert("No forecast available for that date. Choose a date within 5 days.");
        setTripForecast(null);
        return;
      }

      setTripForecast({ ...res.data, list: filtered });

    } catch (err) {
      console.error(err);
      alert("Could not fetch forecast. Check city name or try again.");
      setTripForecast(null);
    }

    const geoRes = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
  params: {
    q: tripCity,
    limit: 1,
    appid: 'eb15f8ab4e356d62dd84027c18eff998'
  }
});

if (!geoRes.data.length) {
  alert('Could not find location coordinates.');
  return;
}

const { lat, lon } = geoRes.data[0];

const eventRes = await axios.get('http://localhost:5050/events', {
  params: {
    lat,
    lon,
    date: tripDate
  }
});

setMapCenter([lat, lon]);
setCityMarker({ lat, lon, name: tripCity });

const eventPins = eventRes.data.events
  .map(ev => {
    const venue = ev._embedded?.venues?.[0];
    if (!venue?.location?.latitude || !venue.location.longitude) return null;
    return {
      lat: parseFloat(venue.location.latitude),
      lon: parseFloat(venue.location.longitude),
      name: ev.name
    };
  })
  .filter(Boolean);

setEventMarkers(eventPins);


setTripEvents(eventRes.data.events || []);

  };

  

  const toggleSuggestion = (id) => {
    setVisibleSuggestions((prev) => ({
      ...prev,
      [id]: !prev[id], // toggle this one
    }));
  };

  const deleteSearch = async (id) => {
    try {
      await axios.delete(`http://localhost:5050/history/${id}`);
      setHistory((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get('http://localhost:5050/history', {
          params: { userId }
        });
        setHistory(res.data);
      } catch (err) {
        console.error('Error loading history:', err);
      }
    };

    if (userId) {
      fetchHistory();
    }
  }, [userId]);

  const deleteAllHistory = async () => {
  try {
    await axios.delete(`http://localhost:5050/history/all`, {
      params: { userId }
    });
    setHistory([]); // Clear the local state so UI updates
  } catch (err) {
    console.error('Failed to delete all history:', err);
    alert('Failed to delete all history.');
  }
};



  const handleSearch = async (overrideCity, id, isHistoryClick = false) => {
    const cityToSearch = overrideCity || city;
    if (!cityToSearch) return;

    setSelectedHistoryId(id || null);

    try {
      const response = await axios.get('http://localhost:5050/weather', {
        params: {
          city: cityToSearch,
          userId,
          skipSave: isHistoryClick ? 'true' : 'false'
        }
      });

      const weatherData = response.data.weather;
      const searchId = response.data.searchId;
      setWeather(weatherData);
      const { lon, lat } = weatherData.coord;
setMapCenter([lat, lon]);
setCityMarker({ lat, lon, name: weatherData.name });
setEventMarkers([]); // Clear old event pins when searching


      if (!isHistoryClick) {
        await axios.post('http://localhost:5050/history', {
          city: cityToSearch,
          userId
        });

        await axios.post('http://localhost:5050/ai-suggestion', {
          city: weatherData.name,
          temp: weatherData.main.temp,
          condition: weatherData.weather[0].main,
          searchId,
        });
      }

      

      const updated = await axios.get('http://localhost:5050/history', {
        params: { userId }
      });
      setHistory(updated.data);

      if (weatherRef.current) {
        weatherRef.current.scrollIntoView({ behavior: 'smooth' });
      }

      setPlaylistIndex(0);

    } catch (err) {
      console.error(err);
      alert('City not found or server error.');
      setWeather(null);
    }
  };

  const playlistMap = {
    Clear: [
      { name: 'Sunny Vibes ☀️', embedId: '37i9dQZF1DX1BzILRveYHb' },
      { name: 'Good Morning Sunshine 🌅', embedId: '37i9dQZF1DX9sIqqvKsjG8' },
      { name: 'Summer Hits ☀️🔥', embedId: '37i9dQZF1DWYBO1MoTDhZI' },
      { name: 'Chill Afternoon 🍹', embedId: '37i9dQZF1DX6ALfRKlHn1t' },
      { name: 'Pop Rising 🌈', embedId: '37i9dQZF1DWUa8ZRTfalHk' }
    ],
    Rain: [
      { name: 'Rainy Day 🌧️', embedId: '37i9dQZF1DXbvABJXBIyiY' },
      { name: 'Mood Booster ☔', embedId: '37i9dQZF1DX3rxVfibe1L0' },
      { name: 'Rainy Day Jazz 🎷', embedId: '37i9dQZF1DXbITWG1ZJKYt' },
      { name: 'Lofi Rain 🌧️🎧', embedId: '37i9dQZF1DWWQRwui0ExPn' },
      { name: 'Chillhop Rainy Vibes 🐸', embedId: '37i9dQZF1DXc8kgYqQLMfH' }
    ],
    Snow: [
      { name: 'Winter Chill ❄️', embedId: '37i9dQZF1DWVxoleDT3ILq' },
      { name: 'Cozy Acoustic 🧣', embedId: '37i9dQZF1DX2RxBh64BHjQ' },
      { name: 'Snowy Lofi 🧊', embedId: '37i9dQZF1DWXe9gFZP0gtP' },
      { name: 'Hot Cocoa Mix ☕', embedId: '37i9dQZF1DWZtZ8vUCzche' },
      { name: 'Warm Indie Blanket 🛋️', embedId: '37i9dQZF1DWWEJlAGA9gs0' }
    ],
    Clouds: [
      { name: 'Overcast Indie ☁️', embedId: '37i9dQZF1DWYV7OOaGhoH0' },
      { name: 'Chill Jazz 🧥', embedId: '37i9dQZF1DWV7EzJMK2FUI' },
      { name: 'Nujabes Chill ☁️🎶', embedId: '3rGSMMft1TLICvsDk4SVw4' },
      { name: 'Lo-Fi for Clouds 🌫️', embedId: '37i9dQZF1DWSfMe9z89s9B' },
      { name: 'Ambient Overcast 🌌', embedId: '37i9dQZF1DX4E3UdUs7fUx' }
    ],
    Thunderstorm: [
      { name: 'Stormy Beats ⚡', embedId: '37i9dQZF1DX1g0iEXLFycr' },
      { name: 'Epic Thunder Mood 🎧', embedId: '37i9dQZF1DX4sWSpwq3LiO' },
      { name: 'Dark & Stormy 🌩️', embedId: '37i9dQZF1DWYmmr74INQlb' },
      { name: 'Cinematic Thunder ⚔️', embedId: '37i9dQZF1DWWEcRhUVtL8n' },
      { name: 'Thunder Lofi ⚡🎵', embedId: '37i9dQZF1DX2sUQwD7tbmL' }
    ],
    Drizzle: [
      { name: 'Light Rain Chill 🌦️', embedId: '37i9dQZF1DWWnzeQysG3Yl' },
      { name: 'Coffee & Drizzle ☕', embedId: '37i9dQZF1DWUzFXarNiofw' },
      { name: 'Grey Skies, Good Vibes 💭', embedId: '37i9dQZF1DWWJOmJ7nRx0C' },
      { name: 'Soft Pop Drizzle 🌧️', embedId: '37i9dQZF1DX6ziVCJnEm59' },
      { name: 'Lofi Rain on Window 🎶', embedId: '37i9dQZF1DWYmyAaW6ZbdD' }
    ],
    Mist: [
      { name: 'Misty Mornings 🌫️', embedId: '37i9dQZF1DX3Fzl4v4w9Zp' },
      { name: 'Dreamy Fog Vibes 🌁', embedId: '37i9dQZF1DWXLeA8Omikj7' },
      { name: 'Quiet Focus ⛅', embedId: '37i9dQZF1DX7gIoKXt0gmx' },
      { name: 'Fogwalk Soundtrack 🎻', embedId: '37i9dQZF1DX2A29LI7xHn1' },
      { name: 'Ambient Mist 🌬️', embedId: '37i9dQZF1DWSQ2KZaYWSV1' }
    ]
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto',backgroundColor: '#7dd6fa', borderRadius:'50px' }}>
      
<img 
  src="/weatherlogo.png" 
  alt="Weather header" 
  style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '8px', marginTop: '1rem' }} 
/>


      <p>Enter a city to get real-time weather and smart outfit/activity suggestions from AI!</p>

      {history.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  <h3 style={{ margin: 0 }}>🔍 Recent Searches:</h3>
  <div>
    <button
      onClick={() => setShowHistory(!showHistory)}
      style={{
        padding: '0.3rem 0.6rem',
        fontSize: '0.8rem',
        background: 'transparent',
        border: '1px solid #007bff',
        color: '#007bff',
        borderRadius: '4px',
        cursor: 'pointer',
        marginRight: '0.5rem',
      }}
    >
      {showHistory ? 'Hide All' : 'Show All'}
    </button>
    <button
      onClick={deleteAllHistory}
      style={{
        padding: '0.3rem 0.6rem',
        fontSize: '0.8rem',
        background: 'white',
        border: '1px solid red',
        color: 'red',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      Delete All
    </button>
  </div>
</div>


          {showHistory && (
            <ul style={{ marginTop: '0.5rem' }}>
              {history.map((item) => (
                <li
                  key={item._id}
                  onClick={() => handleSearch(item.city, item._id, true)}
                  style={{
                    cursor: 'pointer',
                    color: item._id === selectedHistoryId ? 'white' : 'blue',
                    backgroundColor: item._id === selectedHistoryId ? '#78caf7' : 'transparent',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                    transition: 'background-color 0.3s, color 0.3s',
                  }}
                >
   <div>
  {capitalize(item.city)}
  <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.5rem' }}>
    – {new Date(item.date).toLocaleString()}
  </span>
</div>



                  {item.suggestion && (
                    <>
                      <div style={{
                        fontSize: '0.9rem',
  color: '#222', // Force dark readable text
  backgroundColor: '#f4f4f4', // Optional: light background for contrast
  marginTop: '0.5rem',
  padding: '0.5rem',
  borderRadius: '6px',
  whiteSpace: 'pre-wrap'
                      }}>
                        💬 {item.suggestion.split('.')[0]}...
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSuggestion(item._id);
                        }}
                        style={{
                          marginTop: '0.3rem',
                          background: 'transparent',
                          border: '1px solid #000000',
                          borderRadius: '4px',
                          padding: '0.2rem 0.5rem',
                          color: '#000000',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        {visibleSuggestions[item._id] ? 'Hide Details' : 'Show Details'}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSearch(item._id);
                        }}
                        style={{
                          marginTop: '0.3rem',
                          marginLeft: '0.5rem',
                          background: 'transparent',
                          border: '1px solid red',
                          borderRadius: '4px',
                          padding: '0.2rem 0.5rem',
                          color: 'red',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                        title="Delete this search"
                      >
                        🗑️ Delete
                      </button>

                      {visibleSuggestions[item._id] && (
  <div style={{
      fontSize: '0.9rem',
  color: '#222', // Force dark readable text
  backgroundColor: '#f4f4f4', // Optional: light background for contrast
  marginTop: '0.5rem',
  padding: '0.5rem',
  borderRadius: '6px',
  whiteSpace: 'pre-wrap'
  }}>
    <h4>📍 Weather & Suggestion Snapshot</h4>

    {item.weather && (
      <>
        <p><strong>📍 Location:</strong> {item.weather.name}, {item.weather.sys?.country}</p>
        <p><strong>🌡️ Temperature:</strong> {item.weather.main?.temp}°C</p>
        <p><strong>🌥️ Condition:</strong> {item.weather.weather?.[0]?.main}</p>
        <p><strong>💧 Humidity:</strong> {item.weather.main?.humidity}%</p>
        <p><strong>🌬️ Wind:</strong> {item.weather.wind?.speed} m/s</p>
      </>
    )}

    <div style={{
  marginTop: '0.5rem',
  padding: '1rem',
  backgroundColor: '#f9f9f9',
  border: '1px solid #ccc',
  borderRadius: '8px',
  whiteSpace: 'pre-wrap'
}}>
  <p style={{ fontStyle: 'italic' }}>💡 {item.suggestion}</p>

  {item.temp !== undefined && (
    <>
      <h4>{capitalize(item.city)}, {item.country} – {new Date(item.date).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      })}</h4>
      <p><strong>Temperature:</strong> {item.temp}°C</p>
      <p><strong>Condition:</strong> {item.condition}</p>
      <p><strong>Humidity:</strong> {item.humidity}%</p>
      <p><strong>Wind:</strong> {item.wind} m/s</p>

      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#f1f9ff',
        borderLeft: '6px solid #007bff',
        borderRadius: '8px'
      }}>
        <h4>📍 What to Do Now</h4>
        <ul>
          <li><strong>👗 Style Tip:</strong> Dress for <em>{item.condition}</em> with something <em>{item.temp > 25 ? 'lightweight and breathable' : 'warm and layered'}</em>.</li>
          <li><strong>🏙️ Local Mood:</strong> It's a <em>{item.description}</em> kind of day. Great time to {item.condition.includes('Rain') ? 'visit a cozy coffee shop' : 'take a walk in the park'}.</li>
          <li><strong>🧠 Mental Boost:</strong> Try a <em>10-minute breathing or journaling break</em> — it pairs well with any weather.</li>
          <li><strong>📸 Bonus:</strong> Snap a photo of the sky in <em>{capitalize(item.city)}</em>.</li>
        </ul>
      </div>

      {item.playlistWeatherKey && playlistMap[item.playlistWeatherKey] && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#e8f5e9',
          borderLeft: '6px solid #1db954',
          borderRadius: '8px'
        }}>
          <h4>🎧 Spotify Vibe</h4>
          <p><strong>{playlistMap[item.playlistWeatherKey][0].name}</strong></p>
          <iframe
            title="spotify-player"
            src={`https://open.spotify.com/embed/playlist/${playlistMap[item.playlistWeatherKey][0].embedId}?utm_source=generator&theme=0`}
            width="100%"
            height="80"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{ marginTop: '1rem', borderRadius: '8px' }}
          ></iframe>
        </div>
      )}
    </>
  )}
</div>

  </div>
)}

                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ marginTop: '3rem', padding: '1rem', border: '1px solid #78caf7', borderRadius: '8px', backgroundColor: '#58cdfc' }}>
        <h3>Check for Weather Today & Get AI Recommendations!</h3>

        <input
        type="text"
        value={city}
        placeholder="Enter city name"
        onChange={(e) => setCity(e.target.value)}
        style={{ padding: '0.5rem', width: '200px', marginRight: '1rem' }}
      />
      <button onClick={() => handleSearch(city, null)} style={{ padding: '0.5rem 1rem' }}>
        Search
      </button>

        

        {weather && (
        <div ref={weatherRef} style={{ marginTop: '2rem' }}>
          <h2>{weather.name}, {weather.sys.country} – {new Date().toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
          </h2>
          <p><strong>Temperature:</strong> {weather.main.temp}°C</p>
          <p><strong>Condition:</strong> {weather.weather[0].main}</p>
          <p><strong>Humidity:</strong> {weather.main.humidity}%</p>
          <p><strong>Wind:</strong> {weather.wind.speed} m/s</p>

          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#f1f9ff',
            borderLeft: '6px solid #007bff',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ marginBottom: '0.5rem' }}>📍 What to Do Now</h3>
            <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: '0.75rem' }}>
                <strong>👗 Style Tip:</strong> Dress for <em>{weather.weather[0].main}</em> with something <em>{weather.main.temp > 25 ? 'lightweight and breathable' : 'warm and layered'}</em>.
              </li>
              <li style={{ marginBottom: '0.75rem' }}>
                <strong>🏙️ Local Mood:</strong> It's a <em>{weather.weather[0].description}</em> kind of day. Great time to {weather.weather[0].main.includes('Rain') ? 'visit a cozy coffee shop' : 'take a walk in the park'}.
              </li>
              <li style={{ marginBottom: '0.75rem' }}>
                <strong>🧠 Mental Boost:</strong> Try a <em>10-minute breathing or journaling break</em> — it pairs well with any weather.
              </li>
              <li>
                <strong>📸 Bonus:</strong> Snap a photo of the sky in <em>{weather.name}</em> — capture the vibe of the day.
              </li>
            </ul>
          </div>

          {weather.weather[0].main in playlistMap && (
            <div style={{
              marginTop: '2rem',
              padding: '1rem',
              backgroundColor: '#e8f5e9',
              borderLeft: '6px solid #1db954',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
              <h3 style={{ marginBottom: '0.5rem' }}>🎧 Spotify Vibe</h3>

              <p>
                <strong>{playlistMap[weather.weather[0].main][playlistIndex].name}</strong>
              </p>

              <iframe
                title="spotify-player"
                src={`https://open.spotify.com/embed/playlist/${playlistMap[weather.weather[0].main][playlistIndex].embedId}?utm_source=generator&theme=0`}
                width="100%"
                height="80"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                style={{ marginTop: '1rem', borderRadius: '8px' }}
              ></iframe>

              {playlistMap[weather.weather[0].main].length > 1 && (
                <button
                  onClick={() => {
                    setPlaylistIndex((prevIndex) =>
                      (prevIndex + 1) % playlistMap[weather.weather[0].main].length
                    );
                  }}
                  style={{
                    marginTop: '1rem',
                    padding: '0.5rem 1rem',
                    border: '1px solid #1db954',
                    borderRadius: '4px',
                    background: 'white',
                    color: '#1db954',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  🔄 Try Another Playlist
                </button>
              )}
            </div>
          )}
        </div>
      )}
      </div>
      
      

<div style={{ marginTop: '3rem', padding: '1rem', border: '1px solid #78caf7', borderRadius: '8px', backgroundColor:'#58cdfc' }}>
  <h3>🧳 Check Recent Forecasts & Events</h3>

  <input
    type="text"
    value={tripCity}
    onChange={(e) => setTripCity(e.target.value)}
    placeholder="Destination City"
    style={{ marginRight: '1rem', padding: '0.5rem' }}
  />
  <input
    type="date"
    value={tripDate}
    onChange={(e) => setTripDate(e.target.value)}
    min={formattedToday}
    max={formattedMaxDate}
    style={{ marginRight: '1rem', padding: '0.5rem' }}
  />
  <button onClick={handleTripPlan} style={{ padding: '0.5rem 1rem' }}>
    Search
  </button>
  <br />
  <small style={{ color: '#777' }}>
    * Only dates within the next 5 days are available. 
  </small>

  {tripForecast && (
    <div style={{ marginTop: '2rem', backgroundColor: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
      <h4>📍 {tripForecast.city.name} – Recent Forecasts From {new Date(tripDate).toDateString()} to Present</h4>

      <button
        onClick={() => setShowAllForecast(prev => !prev)}
        style={{
          marginBottom: '1rem',
          padding: '0.4rem 0.8rem',
          fontSize: '0.8rem',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        {showAllForecast ? 'Hide All' : 'Show All'}
      </button>

      {showAllForecast &&
        Object.entries(
          tripForecast.list.reduce((acc, entry) => {
            const date = entry.dt_txt.split(' ')[0];
            acc[date] = acc[date] || [];
            acc[date].push(entry);
            return acc;
          }, {})
        )
          .slice(0, 5)
          .map(([date, entries]) => (
            <div key={date} style={{ marginBottom: '1rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#eef2f3',
                padding: '0.5rem 1rem',
                borderRadius: '6px'
              }}>
                <strong>{new Date(date).toDateString()}</strong>
                <button
                  onClick={() =>
                    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }))
                  }
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {expandedDates[date] ? 'Hide Details' : 'Expand'}
                </button>
              </div>

              {expandedDates[date] && (
                <ul style={{ listStyleType: 'none', padding: '0.5rem 0 0 0' }}>
                  {entries.map((entry, index) => (
                    <li key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                      borderBottom: '1px solid #ddd',
                      paddingBottom: '0.5rem'
                    }}>
                      <img
                        src={`https://openweathermap.org/img/wn/${entry.weather[0].icon}@2x.png`}
                        alt={entry.weather[0].description}
                        style={{ width: '40px', height: '40px', marginRight: '1rem' }}
                      />
                      <div>
                        <strong>{new Date(entry.dt_txt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> – {entry.weather[0].main}, {entry.main.temp}°C
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
      }
    </div>
  )}

  {tripEvents.length > 0 && (
    <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3>🎟️ Events in {tripCity || 'Unknown city'} on {formatDate(tripDate)}</h3>

      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {tripEvents.map((event, index) => (
          <li key={index} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #eee' }}>
            <strong>{event.name}</strong><br />
            <span>{event.dates.start.localDate} – {event.dates.start.localTime || 'Time TBA'}</span><br />
            <span>{event._embedded?.venues?.[0]?.name}</span><br />
            <a href={event.url} target="_blank" rel="noopener noreferrer">Buy Tickets</a>
          </li>
        ))}
      </ul>
    </div>
  )}

  {tripEvents.length === 0 && tripForecast && (
    <p style={{ marginTop: '1rem', fontStyle: 'italic' }}>
      No events found in {tripCity} for {tripDate}.
    </p>
  )}
  <div style={{ marginTop: '3rem' }}>
  <h3>🗺️ Interactive Map View</h3>
  <MapContainer center={mapCenter} zoom={5} style={{ height: '400px', width: '100%' }}>
  <MapUpdater center={mapCenter} />
  <TileLayer
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution="&copy; OpenStreetMap contributors"
  />
  {cityMarker && (
    <Marker position={[cityMarker.lat, cityMarker.lon]}>
      <Popup>{cityMarker.name}</Popup>
    </Marker>
  )}
  {eventMarkers.map((m, i) => (
    <Marker key={i} position={[m.lat, m.lon]}>
      <Popup>{m.name}</Popup>
    </Marker>
  ))}
</MapContainer>

</div>


</div>


      
    </div>
  );
}

export default WeatherScope;
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { Homepage } from './components/Homepage';
import { Dashboard } from './components/Dashboard';
import { CreateToken } from './components/CreateToken';
import { Profile } from './components/Profile';
import { Game } from './components/Game';
import './App.css';

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create" element={<CreateToken />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/game" element={<Game />} />
      </Routes>
    </AppLayout>
  );
}

export default App;

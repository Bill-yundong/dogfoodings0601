import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Tax from './pages/Tax';
import Investments from './pages/Investments';
import Simulator from './pages/Simulator';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/tax" element={<Tax />} />
          <Route path="/investments" element={<Investments />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

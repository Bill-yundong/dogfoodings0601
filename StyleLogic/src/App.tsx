import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { ColorAnalysisPage } from './pages/ColorAnalysisPage';
import { WardrobePage } from './pages/WardrobePage';
import { FittingPage } from './pages/FittingPage';
import { EcommercePage } from './components/ecommerce/EcommercePage';
import { DataSync } from './components/sync/DataSync';

function App() {
  return (
    <BrowserRouter>
      <DataSync showStatus={false} />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="color-analysis" element={<ColorAnalysisPage />} />
          <Route path="wardrobe" element={<WardrobePage />} />
          <Route path="fitting" element={<FittingPage />} />
          <Route path="ecommerce" element={<EcommercePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { GestureProvider } from './gesture/GestureContext';
import Navbar from './components/Navbar';
import GestureOverlay from './components/GestureOverlay';
import CursorGlow from './components/CursorGlow';

import Home from './pages/Home';
import PollutionCleaner from './pages/PollutionCleaner';
import PlantFuture from './pages/PlantFuture';
import OceanCleanup from './pages/OceanCleanup';
import EnergyGenerator from './pages/EnergyGenerator';
import Ending from './pages/Ending';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45 }}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/pollution-cleaner" element={<PollutionCleaner />} />
          <Route path="/plant-future"      element={<PlantFuture />} />
          <Route path="/ocean-cleanup"     element={<OceanCleanup />} />
          <Route path="/energy-generator"  element={<EnergyGenerator />} />
          <Route path="/ending"            element={<Ending />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GestureProvider>
        <CursorGlow />
        <Navbar />
        <AnimatedRoutes />
        <GestureOverlay />
      </GestureProvider>
    </BrowserRouter>
  );
}

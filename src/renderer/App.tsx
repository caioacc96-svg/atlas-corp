import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { SettingsPage } from './pages/SettingsPage';
import { ChatPage } from './pages/ChatPage';
import { useAppStore } from '../store/appStore';
import { applyThemePreset } from './lib/theme';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.14 }}
        className="min-h-screen"
      >
        <Routes location={location}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:conversationId" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Route>
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const hydrated = useAppStore((state) => state.hydrated);
  const initialize = useAppStore((state) => state.initialize);
  const themePreset = useAppStore((state) => state.settings.themePreset);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    applyThemePreset(themePreset);
  }, [themePreset]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-atlas-gradient px-6">
        <div className="w-full max-w-[560px] rounded-[34px] border border-atlas-line bg-white/92 px-8 py-8 shadow-atlas">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-steel">Atlas Chat v2.1</p>
          <p className="mt-3 font-serif text-[2rem] leading-tight text-atlas-ink">Inicializando o núcleo conversacional…</p>
          <p className="mt-3 max-w-lg text-sm leading-7 text-atlas-body/78">
            Preparando conversa persistente, streaming real, backend protegido e a nova superfície central do Atlas.
          </p>
        </div>
      </div>
    );
  }

  return <AnimatedRoutes />;
}

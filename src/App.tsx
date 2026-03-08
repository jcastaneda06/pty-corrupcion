import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthModal } from './components/auth/AuthModal';
import { Navbar } from './components/layout/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Findings } from './pages/Findings';
import { FindingDetail } from './pages/FindingDetail';
import { PersonDetail } from './pages/PersonDetail';
import { NotFound } from './pages/NotFound';
import { CorruptionIndex } from './pages/CorruptionIndex';
import { Estadisticas } from './pages/Estadisticas';
import { Apoyanos } from './pages/Apoyanos';
import { Analytics } from "@vercel/analytics/react"
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: true
    },
  },
});

function AuthModalWrapper() {
  const { isAuthModalOpen } = useAuth();
  if (!isAuthModalOpen) return null;
  return <AuthModal key="auth-modal" />;
}

function AppInner() {
  const { theme } = useTheme();
  return (
    <div className={`min-h-screen bg-dark-950 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      <Analytics />
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/casos" element={<Findings />} />
        <Route path="/casos/:id" element={<FindingDetail />} />
        <Route path="/personas/:id" element={<PersonDetail />} />
        <Route path="/indice" element={<CorruptionIndex />} />
        <Route path="/estadisticas" element={<Estadisticas />} />
        <Route path="/apoyanos" element={<Apoyanos />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <TooltipProvider delayDuration={200}>
              <AppInner />
              <AuthModalWrapper />
            </TooltipProvider>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

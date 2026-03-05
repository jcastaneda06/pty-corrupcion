import { Link, NavLink } from 'react-router-dom';
import { Scale, LayoutDashboard, FileText, TrendingDown, BarChart2, Menu, X, LogOut } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials } from '../../lib/utils';

const navLinks = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, exact: true },
  { to: '/hallazgos', label: 'Hallazgos', icon: FileText, exact: false },
  { to: '/estadisticas', label: 'Estadísticas', icon: BarChart2, exact: false },
  { to: '/indice', label: 'Índice', icon: TrendingDown, exact: false },
];

function UserMenu() {
  const { user, isLoading, signOut, openAuthModal } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (isLoading) return null;

  if (!user) {
    return (
      <button
        onClick={openAuthModal}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
      >
        Iniciar sesión
      </button>
    );
  }

  const displayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split('@')[0] ??
    'Usuario';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setDropdownOpen((v) => !v)}
        className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-300 hover:bg-blue-500/30 transition-colors"
        aria-label="Menú de usuario"
      >
        {getInitials(displayName)}
      </button>
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl py-1 z-50">
          <div className="px-3 py-2 border-b border-dark-600">
            <p className="text-xs font-semibold text-white truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={() => { signOut(); setDropdownOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isLoading, openAuthModal, signOut } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-dark-600 bg-dark-900/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-red-500/20 border border-red-500/40 rounded-lg flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
              <Scale className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight">PTY</span>
              <span className="font-bold text-red-400 text-sm tracking-tight ml-0.5">Corrupción</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-dark-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-dark-700'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </div>

          {/* Right side: auth + mobile toggle */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <UserMenu />
            </div>
            <button
              className="sm:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sm:hidden py-2 pb-3 border-t border-dark-600 mt-1">
            {navLinks.map(({ to, label, icon: Icon, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-dark-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-dark-700'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
            {/* Auth item */}
            <div className="mt-2 pt-2 border-t border-dark-700">
              {!isLoading && (
                user ? (
                  <button
                    onClick={() => { signOut(); setMobileOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                ) : (
                  <button
                    onClick={() => { openAuthModal(); setMobileOpen(false); }}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
                  >
                    Iniciar sesión
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

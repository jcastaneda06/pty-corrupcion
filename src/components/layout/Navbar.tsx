import { Link, NavLink } from 'react-router-dom';
import { Scale, LayoutDashboard, FileText, TrendingDown, BarChart2, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials } from '../../lib/utils';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, exact: true },
  { to: '/hallazgos', label: 'Casos', icon: FileText, exact: false },
  { to: '/estadisticas', label: 'Estadísticas', icon: BarChart2, exact: false },
  { to: '/indice', label: 'Índice', icon: TrendingDown, exact: false },
];

function UserMenu() {
  const { user, isLoading, signOut, openAuthModal } = useAuth();

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-300 hover:bg-blue-500/30 transition-colors"
          aria-label="Menú de usuario"
        >
          {getInitials(displayName)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-dark-800 border-dark-600">
        <DropdownMenuLabel className="font-normal py-2">
          <p className="text-xs font-semibold text-white truncate">{displayName}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-dark-600" />
        <DropdownMenuItem
          onClick={signOut}
          className="text-gray-400 hover:text-white focus:bg-dark-700 focus:text-white cursor-pointer gap-2"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Navbar() {
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
            <Sheet>
              <SheetTrigger asChild>
                <button
                  className="sm:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
                  aria-label="Toggle menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-dark-900 border-dark-700 w-64 p-0">
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2.5 p-4 border-b border-dark-700">
                    <div className="w-7 h-7 bg-red-500/20 border border-red-500/40 rounded-lg flex items-center justify-center">
                      <Scale className="w-3.5 h-3.5 text-red-400" />
                    </div>
                    <span className="font-bold text-sm">PTY<span className="text-red-400">Corrupción</span></span>
                  </div>
                  <nav className="flex flex-col gap-1 p-3 flex-1">
                    {navLinks.map(({ to, label, icon: Icon, exact }) => (
                      <NavLink key={to} to={to} end={exact}
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive ? 'bg-dark-600 text-white' : 'text-gray-400 hover:text-white hover:bg-dark-700'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </NavLink>
                    ))}
                  </nav>
                  {/* Auth item */}
                  <div className="p-3 border-t border-dark-700">
                    {!isLoading && (
                      user ? (
                        <button
                          onClick={signOut}
                          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Cerrar sesión
                        </button>
                      ) : (
                        <button
                          onClick={openAuthModal}
                          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
                        >
                          Iniciar sesión
                        </button>
                      )
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}

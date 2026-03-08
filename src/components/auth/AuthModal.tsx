import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos.',
  'Email not confirmed': 'Confirma tu email antes de iniciar sesión.',
  'User already registered': 'Ya existe una cuenta con este email.',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
};

function translateError(message: string): string {
  return ERROR_MAP[message] ?? message;
}

export function AuthModal() {
  const { signIn, signUp, signInWithGoogle, closeAuthModal } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [signedUp, setSignedUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (signedUp) {
      setResendCooldown(60);
      timerRef.current = setInterval(() => {
        setResendCooldown((s) => {
          if (s <= 1) { clearInterval(timerRef.current!); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [signedUp]);

  const handleResend = async () => {
    setResendMsg('');
    const { error } = await signUp(email, password);
    if (error) {
      setResendMsg(translateError(error.message));
    } else {
      setResendMsg('¡Email reenviado! Revisa tu bandeja.');
      setResendCooldown(60);
      timerRef.current = setInterval(() => {
        setResendCooldown((s) => {
          if (s <= 1) { clearInterval(timerRef.current!); return 0; }
          return s - 1;
        });
      }, 1000);
    }
  };

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next);
    setErrorMsg('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    setIsLoading(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        setErrorMsg(translateError(error.message));
      } else {
        closeAuthModal();
      }
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        setErrorMsg(translateError(error.message));
      } else {
        setSignedUp(true);
      }
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) closeAuthModal(); }}>
      <DialogContent className="bg-dark-900 border-dark-600 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </DialogTitle>
        </DialogHeader>

        {signedUp ? (
          <div className="text-center py-6 space-y-4">
            <p className="text-emerald-400 font-semibold mb-2">¡Cuenta creada!</p>
            <p className="text-sm text-gray-400">Revisa tu email para confirmar tu cuenta.</p>
            {resendMsg && (
              <p className="text-xs text-emerald-400">{resendMsg}</p>
            )}
            <Button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              variant="outline"
              className="w-full border-dark-600 text-gray-300 hover:text-white hover:bg-dark-700 disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Reenviar email (${resendCooldown}s)` : 'Reenviar email de confirmación'}
            </Button>
          </div>
        ) : (
          <>
            {/* Google */}
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.09 17.64 11.782 17.64 9.2z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continuar con Google
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-dark-600" />
              <span className="text-xs text-gray-500">o continúa con email</span>
              <div className="flex-1 h-px bg-dark-600" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="auth-email" className="sr-only">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-dark-700 border-dark-600 text-white placeholder:text-gray-500 focus-visible:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="auth-password" className="sr-only">Contraseña</Label>
                <Input
                  id="auth-password"
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-dark-700 border-dark-600 text-white placeholder:text-gray-500 focus-visible:ring-blue-500"
                />
              </div>
              {mode === 'signup' && (
                <div className="space-y-1">
                  <Label htmlFor="auth-confirm-password" className="sr-only">Confirmar contraseña</Label>
                  <Input
                    id="auth-confirm-password"
                    type="password"
                    placeholder="Confirmar contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="bg-dark-700 border-dark-600 text-white placeholder:text-gray-500 focus-visible:ring-blue-500"
                  />
                </div>
              )}
              {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white"
              >
                {isLoading ? 'Cargando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </Button>
            </form>

            <p className="text-center text-xs text-gray-500 mt-4">
              {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
              <button
                onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
              </button>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

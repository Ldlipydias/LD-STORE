import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import { logout, loginWithGoogle } from '../firebase';
import { LogOut, Store, LayoutDashboard, BadgeCheck, Download, LogIn } from 'lucide-react';
import metadata from '../../metadata.json';

interface NavbarProps {
  user: User | null;
  isAdmin: boolean;
}

export default function Navbar({ user, isAdmin }: NavbarProps) {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <nav className="border-b border-white/5 bg-black/40 backdrop-blur-2xl sticky top-0 z-50">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <img 
              src="https://i.ibb.co/PzW6qwP3/0cad1fd9-5619-4843-bd5a-65d18e570574.png" 
              alt={metadata.name} 
              className="h-12 w-auto object-contain relative z-10 group-hover:scale-110 transition-transform duration-700"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="hidden sm:block">
            <span className="text-2xl font-black tracking-tighter text-white/90 group-hover:text-white transition-colors lowercase">
              {metadata.name}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-8">
          {showInstallBtn && (
            <button
              onClick={handleInstallClick}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest hover:bg-purple-600/20 transition-all"
            >
              <Download className="w-4 h-4" />
              INSTALAR APP
            </button>
          )}

          {user ? (
            <>
              <div className="flex items-center gap-4 md:gap-8">
                {isAdmin && (
                  <Link to="/admin" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:text-purple-300 transition-all hover:translate-y-[-1px] bg-purple-500/20 md:bg-transparent px-3 py-2 md:p-0 rounded-lg">
                    <LayoutDashboard className="w-5 h-5 md:w-4 md:h-4 text-purple-400" />
                    <span className="hidden md:inline">ADMINISTRAÇÃO</span>
                  </Link>
                )}
              </div>
              
              <div className="h-8 w-px bg-white/10 hidden md:block" />

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-400/80 hover:text-red-400 transition-all group p-2 md:p-0"
                title="Sair"
              >
                <LogOut className="w-5 h-5 md:w-4 md:h-4 group-hover:translate-x-1 transition-transform" />
                <span className="hidden md:inline">SAIR</span>
              </button>
            </>
          ) : (
            <button onClick={handleLogin} className="pro-button pro-button-primary py-2 px-6 text-[10px] flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              ENTRAR
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

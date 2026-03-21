import { Link, useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import { logout } from '../firebase';
import { LogOut, Store, LayoutDashboard, BadgeCheck } from 'lucide-react';
import metadata from '../../metadata.json';

interface NavbarProps {
  user: User | null;
  isAdmin: boolean;
}

export default function Navbar({ user, isAdmin }: NavbarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-24 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <img 
            src="https://i.ibb.co/gLNrfByH/Chat-GPT-Image-20-de-mar-de-2026-23-30-58.png" 
            alt={metadata.name} 
            className="h-20 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
          />
        </Link>

        <div className="flex items-center gap-6">
          {user && (
            <>
              <Link to="/store" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest hover:text-purple-400 transition-colors">
                <Store className="w-4 h-4" />
                Loja
              </Link>
              {isAdmin && (
                <Link to="/admin" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest hover:text-purple-400 transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  Painel ADM
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

import { Link, useNavigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import { logout } from '../firebase';
import { LogOut, Store, LayoutDashboard, BadgeCheck } from 'lucide-react';

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
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-2xl font-bold bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 bg-clip-text text-transparent">
            LD STORE
          </span>
          <BadgeCheck className="w-5 h-5 text-blue-400 fill-blue-400/20" />
        </Link>

        <div className="flex items-center gap-6">
          {user && (
            <>
              <Link to="/store" className="flex items-center gap-2 text-sm font-medium hover:text-purple-400 transition-colors">
                <Store className="w-4 h-4" />
                Loja
              </Link>
              {isAdmin && (
                <Link to="/admin" className="flex items-center gap-2 text-sm font-medium hover:text-amber-400 transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  Painel ADM
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
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

"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Library as LibraryIcon } from 'lucide-react';
import { useNavigationStore } from '@/store/navigationStore';

export default function BottomNav() {
  const routerPathname = usePathname();
  const { currentPath, navigate } = useNavigationStore();
  const pathname = currentPath || routerPathname || '/';

  const navItems = [
    {
      label: 'Home',
      href: '/',
      icon: Home,
      isActive: pathname === '/'
    },
    {
      label: 'Search',
      href: '/search',
      icon: Search,
      isActive: pathname.startsWith('/search')
    },
    {
      label: 'Library',
      href: '/library',
      icon: LibraryIcon,
      isActive: pathname.startsWith('/library')
    }
  ];

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    navigate(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/95 border-t border-white/10 flex items-center justify-around z-40 backdrop-blur-lg">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={(e) => handleNavClick(e, item.href)}
            className="flex flex-col items-center group py-1"
          >
            <div
              className={`w-12 h-7 flex items-center justify-center rounded-full transition-all duration-200 ${
                item.isActive
                  ? 'bg-[#2b3544] text-white'
                  : 'text-[#8e8e93]'
              }`}
            >
              <Icon className={`w-5 h-5 ${item.isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
            </div>
            <span
              className={`text-[10px] font-medium mt-0.5 ${
                item.isActive ? 'text-white font-semibold' : 'text-[#8e8e93]'
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

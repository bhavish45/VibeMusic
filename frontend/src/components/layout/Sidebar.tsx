"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Library as LibraryIcon } from 'lucide-react';
import SimpLogo from '@/components/ui/SimpLogo';
import { useNavigationStore } from '@/store/navigationStore';

export default function Sidebar() {
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
    <aside className="hidden md:flex flex-col items-center w-20 h-full bg-black border-r border-white/5 py-5 select-none z-30 flex-shrink-0">
      {/* Top Logo */}
      <Link
        href="/"
        className="mb-6 block"
        title="VibeMusic"
        onClick={(e) => handleNavClick(e, '/')}
      >
        <SimpLogo className="w-8 h-8" />
      </Link>

      {/* Nav Items Stacked Vertically Directly Below Logo */}
      <nav className="flex flex-col items-center gap-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className="flex flex-col items-center group cursor-pointer focus:outline-none"
              title={item.label}
            >
              {/* Icon Container with Round Background Indicator */}
              <div
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 group-hover:scale-105 active:scale-95 ${item.isActive
                  ? 'bg-[#2b3544] text-white shadow-md border border-white/10 ring-1 ring-white/5'
                  : 'text-[#8e8e93] group-hover:text-white group-hover:bg-white/5'
                  }`}
              >
                <Icon className={`w-5 h-5 ${item.isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
              </div>

              {/* Label */}
              <span
                className={`text-[11px] font-medium tracking-tight mt-1.5 transition-colors ${item.isActive
                  ? 'text-white font-semibold'
                  : 'text-[#8e8e93] group-hover:text-neutral-200'
                  }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

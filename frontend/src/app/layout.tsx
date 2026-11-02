import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import MiniPlayer from "@/components/player/MiniPlayer";
import ArtistModal from "@/components/modals/ArtistModal";
import RecentSongsModal from "@/components/modals/RecentSongsModal";
import SettingsModal from "@/components/modals/SettingsModal";
import AuthModal from "@/components/modals/AuthModal";
import AddToPlaylistModal from "@/components/modals/AddToPlaylistModal";
import CreatePlaylistModal from "@/components/modals/CreatePlaylistModal";
import UpdatesModal from "@/components/modals/UpdatesModal";
import KeyboardShortcutsModal from "@/components/modals/KeyboardShortcutsModal";
import KeyboardShortcutsHandler from "@/components/layout/KeyboardShortcutsHandler";
import AuthInitializer from "@/components/layout/AuthInitializer";
import AppViewContainer from "@/components/layout/AppViewContainer";

export const metadata: Metadata = {
  referrer: 'no-referrer',
  title: "VibeMusic - Stream High-Quality Music",
  description: "Stream high-quality music without limits. Search songs, albums, and artists with instant playback.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" }
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body suppressHydrationWarning className="antialiased overflow-hidden bg-black text-white">
        <div className="flex h-screen w-full bg-black">
          <Sidebar />
          
          <main 
            className="flex-1 flex flex-col min-w-0 h-full relative overflow-y-auto pb-32 md:pb-28 hide-scrollbar"
            style={{ overscrollBehavior: 'contain', willChange: 'scroll-position' }}
          >
            <Header />
            <div className="flex-1 px-4 sm:px-6 md:px-8 py-3">
               <AppViewContainer>{children}</AppViewContainer>
            </div>
          </main>
          
          <ArtistModal />
          <RecentSongsModal />
          <SettingsModal />
          <AuthModal />
          <AddToPlaylistModal />
          <CreatePlaylistModal />
          <UpdatesModal />
          <KeyboardShortcutsModal />
          <KeyboardShortcutsHandler />
          <AuthInitializer />
          <MiniPlayer />
          <BottomNav />
        </div>
      </body>
    </html>
  );
}

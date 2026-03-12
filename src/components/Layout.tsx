import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { BackgroundDecorations } from './drops/BackgroundDecorations';
import { CheeseAmpPlayer } from './music/CheeseAmpPlayer';
import { BannerDisplay } from './bannerads/BannerDisplay';

interface LayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

export function Layout({ children, showFooter = true }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <BackgroundDecorations />
      <Header />
      <main className="flex-1">
        {children}
      </main>
      {showFooter && <Footer />}
      <CheeseAmpPlayer />
    </div>
  );
}

import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { isCryptPath } from '@/context/waxContextState';
import { Header } from './Header';
import { Footer } from './Footer';
import { BackgroundDecorations } from './drops/BackgroundDecorations';
import { BannerDisplay } from './bannerads/BannerDisplay';

interface LayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

export function Layout({ children, showFooter = true }: LayoutProps) {
  // Banners load third-party images on a timer, so CHEESECrypt shows none.
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <BackgroundDecorations />
      <Header />
      {!isCryptPath(pathname) && <BannerDisplay />}
      <main className="flex-1">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'Layers - Threat Modeling & Security Posture Scoring',
  description: 'AI based Security-first architecture threat modeling, posture scoring and attack simulation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Inline script runs synchronously before React hydrates — prevents FOUC */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('layers_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} h-screen overflow-hidden antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

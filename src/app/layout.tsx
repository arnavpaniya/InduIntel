import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Inter({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'InduIntel - Turn scattered product data into intelligence',
  description: 'AI-powered product enrichment, validation and explainable intelligence for industrial commerce.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} antialiased`}>
      <body className="bg-background text-text-primary min-h-screen">
        {children}
      </body>
    </html>
  );
}
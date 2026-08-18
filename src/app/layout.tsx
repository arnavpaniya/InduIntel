import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en" className="antialiased">
      <body className="bg-background text-text-primary min-h-screen">
        {children}
      </body>
    </html>
  );
}
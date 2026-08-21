import { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InduIntel',
  description: 'AI Product Intelligence Enrichment Pipeline',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

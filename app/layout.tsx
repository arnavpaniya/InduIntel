export const metadata = {
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
      <body>{children}</body>
    </html>
  );
}
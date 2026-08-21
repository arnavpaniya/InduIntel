import { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'InduIntel Dashboard',
  description: 'AI Product Intelligence Enrichment Pipeline Dashboard',
};

function DashboardSkeleton() {
  return (
    <div className="app-shell min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="animate-pulse space-y-2">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-4 w-64 bg-muted rounded" />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <div className="animate-pulse grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
          <div className="h-24 bg-muted rounded-lg" />
          <div className="h-24 bg-muted rounded-lg" />
          <div className="h-24 bg-muted rounded-lg" />
          <div className="h-24 bg-muted rounded-lg" />
        </div>
        <div className="h-96 bg-muted rounded-lg" />
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      {children}
    </Suspense>
  );
}

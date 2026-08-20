import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'InduIntel Dashboard',
  description: 'AI Product Intelligence Enrichment Pipeline Dashboard',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

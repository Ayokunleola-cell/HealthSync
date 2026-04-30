import { Inter } from 'next/font/google';
import './globals.css';
import ClientWrapper from '@/components/ClientWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'HealthSync - Comprehensive Health Monitoring',
  description: 'AI-powered health monitoring and care coordination platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className={inter.className} suppressHydrationWarning={true}>
        <ClientWrapper>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}

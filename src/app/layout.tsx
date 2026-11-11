import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Remote to You - Production-grade Windows Remote Desktop',
  description: 'Remote to You - Native Windows Remote Desktop Application with DirectX DXGI Capture & Win32 SendInput',
  icons: {
    icon: '/app-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#0B0F17] text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}

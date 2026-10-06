import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AksisToastProvider } from "@/components/aksis-toast";
import { SessionBridge } from "@/components/session-bridge";
import { TextSizeControl } from "@/components/text-size-control";

export const metadata: Metadata = {
  title: "Aksis | Coaching deportivo",
  description: "Un espacio de reflexión para deportistas.",
  appleWebApp: { capable: true, title: "Aksis", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#006b5e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body><SessionBridge /><AksisToastProvider>{children}</AksisToastProvider><TextSizeControl /></body>
    </html>
  );
}

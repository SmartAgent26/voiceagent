import type { Metadata } from "next";
import "./globals.css";
import { AksisToastProvider } from "@/components/aksis-toast";

export const metadata: Metadata = {
  title: "Aksis | Coaching deportivo",
  description: "Un espacio de reflexión para deportistas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body><AksisToastProvider>{children}</AksisToastProvider></body>
    </html>
  );
}

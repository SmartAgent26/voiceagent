import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aksis | Coaching Ontológico Deportivo",
    short_name: "Aksis",
    description: "Un espacio consciente para el proceso deportivo.",
    start_url: "/access",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f1fcf7",
    theme_color: "#006b5e",
    categories: ["health", "lifestyle", "sports"],
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icons/aksis-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/aksis-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/aksis-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

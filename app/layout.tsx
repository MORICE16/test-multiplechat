import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport = {
  themeColor: "#111316",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "morice-alan-assistant";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: "Morice — Assistant personnel",
    description: "L'espace personnel de Morice : tâches, mémoire, validations, connexions et notifications.",
    manifest: "/manifest.webmanifest",
    applicationName: "Morice",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Morice" },
    icons: {
      icon: [{ url: "/icon-192.png?v=morice-logo-44fce869-20260823", type: "image/png", sizes: "192x192" }],
      shortcut: "/icon-192.png?v=morice-logo-44fce869-20260823",
      apple: "/icon-192.png?v=morice-logo-44fce869-20260823",
    },
    openGraph: {
      title: "Morice — Assistant personnel",
      description: "Votre assistant personnel privé, toujours disponible.",
      images: [{ url: "/og.png?v=morice-logo-44fce869-20260823", width: 1254, height: 1254, alt: "Logo officiel de Morice" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Morice — Assistant personnel",
      description: "Votre assistant personnel privé, toujours disponible.",
      images: ["/og.png?v=morice-logo-44fce869-20260823"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}

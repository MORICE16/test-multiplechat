import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

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
    icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
    openGraph: {
      title: "Morice — Assistant personnel",
      description: "Votre assistant personnel privé, toujours disponible.",
      images: [{ url: "/og.png", width: 1734, height: 907, alt: "Morice" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Morice — Assistant personnel",
      description: "Votre assistant personnel privé, toujours disponible.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}

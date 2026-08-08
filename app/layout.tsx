import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host") ||
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: {
      default: "Liquidity Radar",
      template: "%s · Liquidity Radar",
    },
    description:
      "Evidence-linked public transaction signals from SEC, FTC, CMS, economic data, and configured public-source adapters.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Liquidity Radar — Money in Motion",
      description:
        "Explore business sales, ownership changes, securities transactions, and other evidence-linked Money in Motion signals.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1728, height: 912 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Liquidity Radar — Money in Motion",
      description:
        "Evidence-linked transaction intelligence from public records.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

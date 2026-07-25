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
      "Evidence-linked private-capital intelligence. See where liquidity is created and where it may move next.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Liquidity Radar — Private capital, mapped.",
      description:
        "See where liquidity is created, who may control it, and where known capital is deployed.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1728, height: 912 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Liquidity Radar — Private capital, mapped.",
      description:
        "Evidence-linked intelligence for deployable private capital.",
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

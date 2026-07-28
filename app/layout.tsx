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
      "Official SEC, IRS, Census, and BEA public records in one state-level explorer.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Liquidity Radar — Official public capital signals",
      description:
        "Explore attributable public capital and economic signals by state.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1728, height: 912 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Liquidity Radar — Official public capital signals",
      description: "Official public records from SEC, IRS, Census, and BEA.",
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

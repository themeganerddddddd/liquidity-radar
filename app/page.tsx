import type { Metadata } from "next";
import { RadarApp } from "./RadarApp";

export const metadata: Metadata = {
  title: "Liquidity Radar — Private capital, mapped.",
  description:
    "Evidence-linked private-capital intelligence for liquidity creation, deployable-capital estimates, regional flows, and opportunity matching.",
};

export default function Home() {
  return <RadarApp />;
}

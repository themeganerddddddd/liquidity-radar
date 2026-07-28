import type { Metadata } from "next";
import { RealRadarApp } from "./RealRadarApp";

export const metadata: Metadata = {
  title: "Liquidity Radar — Public liquidity and exit signals",
  description:
    "Search attributable SEC liquidity records, FTC transaction signals, and official Census and BEA market context.",
};

export default function Home() {
  return <RealRadarApp />;
}

import type { Metadata } from "next";
import { RealRadarApp } from "./RealRadarApp";

export const metadata: Metadata = {
  title: "Liquidity Radar — Official public capital signals",
  description:
    "Explore attributable SEC, IRS, Census, and BEA public records by state.",
};

export default function Home() {
  return <RealRadarApp />;
}

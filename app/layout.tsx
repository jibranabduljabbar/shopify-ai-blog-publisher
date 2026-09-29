import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "Build with AI · Sigma Web Hub",
  description: "A Gemini-powered Shopify blog automation demo.",
  robots: { index: false, follow: false }
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

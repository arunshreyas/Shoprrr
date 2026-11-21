import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shoppr Voice",
  description: "BolBharat Voice Ledger",
};

export default function ShopprLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}


import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRODUCT_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "An independent, evidence-backed audit of the observed Assam government web estate.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

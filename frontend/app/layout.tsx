import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ReviveAI | Autonomous Payment Failure Diagnosis & Revenue Recovery",
  description:
    "Detect → Diagnose → Decide → Recover → Measure. Enterprise-grade autonomous revenue recovery operations platform for merchants.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#070C14] text-slate-100 antialiased selection:bg-[#00F5A0]/20 selection:text-[#00F5A0]">
        {children}
      </body>
    </html>
  );
}

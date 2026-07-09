import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdFit AI | Ad-to-Landing Page Fit Analyzer",
  description: "Analyze how well your landing page fulfills the promises of your ads. Identify mismatches, calculate RICE scores, and generate AI copywriting variations instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-50 selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}


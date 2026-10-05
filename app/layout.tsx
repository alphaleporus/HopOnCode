import type { Metadata } from "next";
// Self-hosted Geist (bundled font files): no Google Fonts fetch, so builds work offline
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
    title: "FleetFusion - Real-time Delay Decision Engine",
    description: "Real-time financial intelligence for logistics operations",
    icons: {
        icon: "/Favicon.png",
    },
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
            {children}
        </body>
        </html>
    );
}

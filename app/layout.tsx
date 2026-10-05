import type { Metadata } from "next";
// Brand fonts (Archivo, IBM Plex Mono) are self-hosted via @fontsource in globals.css
import "./globals.css";

export const metadata: Metadata = {
    title: "FleetFusion - Real-time Delay Decision Engine",
    description: "Real-time financial intelligence for logistics operations",
    icons: {
        icon: [
            {url: "/brand/logo/favicon.svg", type: "image/svg+xml"},
            {url: "/brand/favicon/favicon-32.png", sizes: "32x32"},
        ],
        apple: "/brand/favicon/apple-touch-icon.png",
    },
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body className="antialiased">
            {children}
        </body>
        </html>
    );
}

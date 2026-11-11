import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import "./design-system.css";
import "./branding.css";
import "./scenic-ui.css";
import "./home-dashboard.css";
import "./platform-admin.css";
import ServiceWorkerRegistration from "./components/service-worker-registration";

const bodyFont = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const title = "Kontá — Gestão simples. Negócios fortes.";
const description = "Gestão simples para lojas e pequenos negócios.";
const shareImage = {
  url: "/images/konta-share.png",
  width: 1200,
  height: 630,
  alt: "Logótipo da Kontá sobre fundo verde",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  title,
  description,
  openGraph: {
    type: "website",
    siteName: "Kontá",
    title,
    description,
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [shareImage],
  },
  applicationName: "Kontá",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Kontá",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/konta-icon.svg",
    apple: "/konta-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#07583f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kontá — Gestão simples",
    short_name: "Kontá",
    description: "Gestão simples para lojas e pequenos negócios.",
    start_url: "/loja",
    display: "standalone",
    background_color: "#f7f1e4",
    theme_color: "#07583f",
    lang: "pt",
    icons: [
      {
        src: "/konta-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

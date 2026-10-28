import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

const instrument = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

const themeScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("homehi-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}d.dataset.theme=t;var p=localStorage.getItem("homehi-palette");d.dataset.palette=["celadon","ink","peach","soda","night","lime"].indexOf(p)>-1?p:"warm";}catch(e){}})();`;

export const metadata: Metadata = {
  title: {
    default: "HomeHi · 把日子收好",
    template: "%s · HomeHi",
  },
  description: "一个属于你家的私人生活空间：记录瞬间、保存照片、安排重要的事，并在多年后重新遇见。",
  applicationName: "HomeHi",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HomeHi",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2ea" },
    { media: "(prefers-color-scheme: dark)", color: "#131210" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={instrument.variable}>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}

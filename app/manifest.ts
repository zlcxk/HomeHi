import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HomeHi · 把日子收好",
    short_name: "HomeHi",
    description: "一个属于你家的私人生活空间：记录瞬间、保存照片、安排重要的事，并在多年后重新遇见。",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F2EA",
    theme_color: "#F5F2EA",
    lang: "zh-CN",
    categories: ["lifestyle", "photo", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "记录一个瞬间", short_name: "记瞬间", url: "/compose/moment" },
      { name: "今天", short_name: "今天", url: "/today" },
    ],
  };
}

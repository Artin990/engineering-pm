import localFont from "next/font/local";

/**
 * فونت اختصاصی Peyda Web بارگذاری شده از فایل‌های محلی woff2
 */
export const peyda = localFont({
  src: [
    {
      path: "./fonts/PeydaWeb/woff2/peydaWeb-extralight.woff2",
      weight: "200",
      style: "normal",
    },
    {
      path: "./fonts/PeydaWeb/woff2/peydaWeb-light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/PeydaWeb/woff2/PeydaWeb-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/PeydaWeb/woff2/PeydaWeb-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/PeydaWeb/woff2/PeydaWeb-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/PeydaWeb/woff2/PeydaWeb-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/PeydaWeb/woff2/PeydaWeb-ExtraBold.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "./fonts/PeydaWeb/woff2/PeydaWeb-Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-peyda",
  display: "swap",
});

import { Vazirmatn } from "next/font/google";

/**
 * فونت استاندارد وب فارسی (Vazirmatn) با سازگاری متغیر --font-peyda
 */
export const peyda = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-peyda",
  display: "swap",
});


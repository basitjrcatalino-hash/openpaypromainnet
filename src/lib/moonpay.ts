/** MoonPay public publishable key (test key from MoonPay dashboard). */
export const MOONPAY_API_KEY =
  (typeof import.meta !== "undefined" &&
    String(import.meta.env?.VITE_MOONPAY_API_KEY ?? "").trim()) ||
  "pk_test_ptzaaiVrh9XuKiMQPFfmhVzma1oe8e";

export const MOONPAY_DEBUG =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

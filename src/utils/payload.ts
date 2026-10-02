export type QRType = "url" | "text" | "email" | "phone" | "wifi";

export interface Fields {
  url: string;
  text: string;
  email: string;
  phone: string;
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
}

export const emptyFields: Fields = {
  url: "",
  text: "",
  email: "",
  phone: "",
  ssid: "",
  password: "",
  security: "WPA",
};

const escapeWifi = (s: string) =>
  s.replace(/([\\;,:"])/g, "\\$1");

export function validate(
  type: QRType,
  f: Fields
): string | null {
  switch (type) {
    case "url":
      try {
        const u = new URL(f.url.trim());

        return ["http:", "https:"].includes(u.protocol)
          ? null
          : "URL must start with http:// or https://";
      } catch {
        return "Enter a valid URL, e.g. https://example.com";
      }

    case "text":
      return f.text.trim()
        ? null
        : "Enter some text";

    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        f.email.trim()
      )
        ? null
        : "Enter a valid email address";

    case "phone":
      return /^\+?[0-9\s\-()]{7,15}$/.test(
        f.phone.trim()
      )
        ? null
        : "Enter a valid phone number (7-15 digits)";

    case "wifi":
      if (!f.ssid.trim()) {
        return "Network name (SSID) is required";
      }

      if (
        f.security !== "nopass" &&
        f.password.length < 8
      ) {
        return "Password must be at least 8 characters";
      }

      return null;
  }
}

export function buildPayload(
  type: QRType,
  f: Fields
): string {
  switch (type) {
    case "url":
      return f.url.trim();

    case "text":
      return f.text;

    case "email":
      return `mailto:${f.email.trim()}`;

    case "phone":
      return `tel:${f.phone.replace(/[\s\-()]/g, "")}`;

    case "wifi": {
      const pass =
        f.security === "nopass"
          ? ""
          : escapeWifi(f.password);

      return `WIFI:T:${f.security};S:${escapeWifi(
        f.ssid
      )};P:${pass};;`;
    }
  }
}
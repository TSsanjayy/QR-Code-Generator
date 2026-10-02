export interface Preset {
  name: string;
  description: string;
  settings: {
    size: number;
    fg: string;
    bg: string;
    ecc: "L" | "M" | "Q" | "H";
    margin: number;
    dotType:
      | "square"
      | "rounded"
      | "dots"
      | "classy"
      | "classy-rounded";
    cornerType:
      | "square"
      | "dot"
      | "extra-rounded";
    useGradient: boolean;
    gradientStart: string;
    gradientEnd: string;
    logo: string;
    logoSize: number;
    hideBackgroundDots: boolean;
  };
}

export const presets: Preset[] = [
  {
    name: "Classic",
    description: "Traditional black and white QR",
    settings: {
      size: 300,
      fg: "#000000",
      bg: "#ffffff",
      ecc: "M",
      margin: 10,
      dotType: "square",
      cornerType: "square",
      useGradient: false,
      gradientStart: "#000000",
      gradientEnd: "#2563eb",
      logo: "",
      logoSize: 0.4,
      hideBackgroundDots: true,
    },
  },

  {
    name: "Dark",
    description: "Dark QR with a soft background",
    settings: {
      size: 300,
      fg: "#111827",
      bg: "#f3f4f6",
      ecc: "M",
      margin: 10,
      dotType: "square",
      cornerType: "square",
      useGradient: false,
      gradientStart: "#000000",
      gradientEnd: "#2563eb",
      logo: "",
      logoSize: 0.4,
      hideBackgroundDots: true,
    },
  },

  {
    name: "Blue",
    description: "Clean blue QR style",
    settings: {
      size: 300,
      fg: "#2563eb",
      bg: "#ffffff",
      ecc: "M",
      margin: 10,
      dotType: "square",
      cornerType: "square",
      useGradient: false,
      gradientStart: "#000000",
      gradientEnd: "#2563eb",
      logo: "",
      logoSize: 0.4,
      hideBackgroundDots: true,
    },
  },

  {
    name: "Soft",
    description: "Subtle purple QR style",
    settings: {
      size: 300,
      fg: "#7c3aed",
      bg: "#faf5ff",
      ecc: "M",
      margin: 10,
      dotType: "square",
      cornerType: "square",
      useGradient: false,
      gradientStart: "#000000",
      gradientEnd: "#2563eb",
      logo: "",
      logoSize: 0.4,
      hideBackgroundDots: true,
    },
  },
];
import { useEffect, useMemo, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import {
  buildPayload,
  validate,
  emptyFields,
  type QRType,
  type Fields,
} from "./utils/payload";

import {
  contrastRatio,
  isForegroundLighter,
} from "./utils/contrast";

import {
  getRecentQRs,
  saveRecentQR,
  clearRecentQRs,
  type RecentQR,
} from "./utils/recent";

import { presets } from "./presets";

import "./App.css";

type ECC = "L" | "M" | "Q" | "H";

interface Settings {
  size: number;
  fg: string;
  bg: string;
  ecc: ECC;
  margin: number;
  dotType: "square" | "rounded" | "dots" | "classy" | "classy-rounded";
  cornerType: "square" | "dot" | "extra-rounded";
  useGradient: boolean;
  gradientStart: string;
  gradientEnd: string;
  logo: string;
  logoSize: number;
  hideBackgroundDots: boolean;
}

const defaultSettings: Settings = {
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
};

const TYPES: { value: QRType; label: string }[] = [
  { value: "url", label: "URL" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "wifi", label: "Wi-Fi" },
];

function App() {
  const [type, setType] = useState<QRType>("url");

  const [fields, setFields] =
    useState<Fields>(emptyFields);

  const [settings, setSettings] =
    useState<Settings>(defaultSettings);

  const [touched, setTouched] =
    useState(false);

  const [logoError, setLogoError] = useState("");

  const [recentQRs, setRecentQRs] = useState<RecentQR[]>([]);

  const container =
    useRef<HTMLDivElement>(null);

  const qrRef =
    useRef<QRCodeStyling | null>(null);

  if (!qrRef.current) {
    qrRef.current = new QRCodeStyling({
      type: "canvas",
      data: " ",
    });
  }

  const error = validate(type, fields);

  const contrast = contrastRatio(
    settings.fg,
    settings.bg
  );

  const inverted = isForegroundLighter(
    settings.fg,
    settings.bg
  );

  const smallSize = settings.size < 200;
  const smallMargin = settings.margin < 4;

  const scanWarnings: string[] = [];

  if (contrast < 4) {
    scanWarnings.push(
      "Low contrast may make this QR difficult to scan."
    );
  }

  if (settings.size < 200) {
    scanWarnings.push(
      "Very small QR size may reduce scanning reliability."
    );
  }

  if (settings.margin < 4) {
    scanWarnings.push(
      "Small margin may make the QR harder for scanners to detect."
    );
  }

  if (settings.logo && settings.logoSize > 0.4) {
    scanWarnings.push(
      "The logo is large and may interfere with scanning."
    );
  }

  const payload = useMemo(
    () =>
      error
        ? ""
        : buildPayload(type, fields),
    [type, fields, error]
  );

  useEffect(() => {
    const el = container.current;

    if (el) {
      qrRef.current!.append(el);
    }

    return () => {
      if (el) {
        el.innerHTML = "";
      }
    };
  }, []);

  useEffect(() => {
    setRecentQRs(getRecentQRs());
  }, []);

  useEffect(() => {
    if (!payload) return;

    qrRef.current!.update({
      data: payload,

      width: settings.size,
      height: settings.size,

      margin: settings.margin,

      qrOptions: {
        errorCorrectionLevel: settings.ecc,
      },

      dotsOptions: settings.useGradient
        ? {
            type: settings.dotType,
            gradient: {
              type: "linear",
              rotation: 0,
              colorStops: [
                {
                  offset: 0,
                  color: settings.gradientStart,
                },
                {
                  offset: 1,
                  color: settings.gradientEnd,
                },
              ],
            },
          }
        : {
            color: settings.fg,
            type: settings.dotType,
          },

      cornersSquareOptions: {
        color: settings.useGradient
          ? settings.gradientStart
          : settings.fg,
        type: settings.cornerType,
      },

      cornersDotOptions: {
        color: settings.useGradient
          ? settings.gradientStart
          : settings.fg,
        type:
          settings.cornerType === "square"
            ? "square"
            : "dot",
      },

      backgroundOptions: {
        color: settings.bg,
      },

      image: settings.logo || undefined,

      imageOptions: {
        crossOrigin: "anonymous",
        margin: 5,
        imageSize: settings.logoSize,
        hideBackgroundDots: settings.hideBackgroundDots,
      },
    });
  }, [payload, settings]);

  const setField = (
    key: keyof Fields,
    value: string
  ) => {
    setFields((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const setSetting = <
    K extends keyof Settings
  >(
    key: K,
    value: Settings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const download = async () => {
    if (!payload) return;

    await qrRef.current!.download({
      name: "my-qr-code",
      extension: "png",
    });

    const recent: RecentQR = {
      id: `${Date.now()}`,
      type,
      fields: { ...fields },
      settings: { ...settings },
      timestamp: Date.now(),
    };

    saveRecentQR(recent);
    setRecentQRs(getRecentQRs());
  };

  const showError =
    touched && error;

  return (
    <div className="app">
      <h1>QR Code Designer</h1>

      <div className="layout">

        {/* LEFT SIDE - CONTROLS */}
        <div className="controls">

          <div className="type-tabs" role="tablist">
            {TYPES.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={type === t.value}
                className={type === t.value ? "active" : ""}
                onClick={() => {
                  setType(t.value);
                  setTouched(false);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div
            className="input-section"
            onBlur={() => setTouched(true)}
          >
            {type === "url" && (
              <Input
                label="URL"
                value={fields.url}
                placeholder="https://example.com"
                onChange={(v) => setField("url", v)}
              />
            )}

            {type === "text" && (
              <Input
                label="Text"
                value={fields.text}
                placeholder="Any text"
                onChange={(v) => setField("text", v)}
              />
            )}

            {type === "email" && (
              <Input
                label="Email"
                value={fields.email}
                placeholder="name@example.com"
                onChange={(v) => setField("email", v)}
              />
            )}

            {type === "phone" && (
              <Input
                label="Phone number"
                value={fields.phone}
                placeholder="+91 98765 43210"
                onChange={(v) => setField("phone", v)}
              />
            )}

            {type === "wifi" && (
              <>
                <Input
                  label="Network name (SSID)"
                  value={fields.ssid}
                  onChange={(v) => setField("ssid", v)}
                />

                <label>
                  Security

                  <select
                    value={fields.security}
                    onChange={(e) =>
                      setField(
                        "security",
                        e.target.value
                      )
                    }
                  >
                    <option value="WPA">
                      WPA/WPA2
                    </option>

                    <option value="WEP">
                      WEP
                    </option>

                    <option value="nopass">
                      None
                    </option>
                  </select>
                </label>

                {fields.security !== "nopass" && (
                  <Input
                    label="Password"
                    type="password"
                    value={fields.password}
                    onChange={(v) =>
                      setField("password", v)
                    }
                  />
                )}
              </>
            )}

            {showError && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* CUSTOMIZATION */}
          <fieldset className="customize">
            <legend>Customize</legend>

            <label>
              Size: {settings.size}px

              <input
                type="range"
                min={150}
                max={600}
                step={10}
                value={settings.size}
                onChange={(e) =>
                  setSetting(
                    "size",
                    Number(e.target.value)
                  )
                }
              />
            </label>

            <label>
              Margin: {settings.margin}px

              <input
                type="range"
                min={0}
                max={40}
                value={settings.margin}
                onChange={(e) =>
                  setSetting(
                    "margin",
                    Number(e.target.value)
                  )
                }
              />
            </label>

            <label>
              Foreground

              <input
                type="color"
                value={settings.fg}
                onChange={(e) =>
                  setSetting(
                    "fg",
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Background

              <input
                type="color"
                value={settings.bg}
                onChange={(e) =>
                  setSetting(
                    "bg",
                    e.target.value
                  )
                }
              />
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.useGradient}
                onChange={(e) =>
                  setSetting(
                    "useGradient",
                    e.target.checked
                  )
                }
              />

              Use gradient
            </label>

            {settings.useGradient && (
              <div className="gradient-controls">
                <label>
                  Gradient start

                  <input
                    type="color"
                    value={settings.gradientStart}
                    onChange={(e) =>
                      setSetting(
                        "gradientStart",
                        e.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Gradient end

                  <input
                    type="color"
                    value={settings.gradientEnd}
                    onChange={(e) =>
                      setSetting(
                        "gradientEnd",
                        e.target.value
                      )
                    }
                  />
                </label>
              </div>
            )}

            <label>
              Error correction

              <select
                value={settings.ecc}
                onChange={(e) =>
                  setSetting(
                    "ecc",
                    e.target.value as ECC
                  )
                }
              >
                <option value="L">
                  L (7%)
                </option>

                <option value="M">
                  M (15%)
                </option>

                <option value="Q">
                  Q (25%)
                </option>

                <option value="H">
                  H (30%)
                </option>
              </select>
            </label>

            <label>
              Dot style

              <select
                value={settings.dotType}
                onChange={(e) =>
                  setSetting(
                    "dotType",
                    e.target.value as Settings["dotType"]
                  )
                }
              >
                <option value="square">Square</option>
                <option value="rounded">Rounded</option>
                <option value="dots">Dots</option>
                <option value="classy">Classy</option>
                <option value="classy-rounded">
                  Classy Rounded
                </option>
              </select>
            </label>

            <label>
              Corner style

              <select
                value={settings.cornerType}
                onChange={(e) =>
                  setSetting(
                    "cornerType",
                    e.target.value as Settings["cornerType"]
                  )
                }
              >
                <option value="square">Square</option>
                <option value="dot">Dot</option>
                <option value="extra-rounded">
                  Extra Rounded
                </option>
              </select>
            </label>

            <div
              className={`contrast-warning ${
                contrast >= 4 && !inverted
                  ? "good"
                  : "warning"
              }`}
            >
              {contrast < 4 ? (
                <>
                  ⚠ Low contrast ({contrast.toFixed(2)}:1) —
                  your QR may be difficult to scan.
                </>
              ) : inverted ? (
                <>
                  ⚠ Light foreground on dark background —
                  some scanners may have difficulty scanning this QR.
                </>
              ) : (
                <>
                  ✓ Good contrast ({contrast.toFixed(2)}:1)
                </>
              )}
            </div>

            {smallSize && (
              <div className="scan-warning">
                ⚠ Small QR size — very small QR codes may be
                harder to scan, especially from a distance.
              </div>
            )}

            {smallMargin && (
              <div className="scan-warning">
                ⚠ Small margin — leave enough white space around
                the QR code for reliable scanning.
              </div>
            )}

            {scanWarnings.length > 0 && (
              <div className="scan-warnings">
                {scanWarnings.map((warning) => (
                  <p key={warning}>
                    ⚠ {warning}
                  </p>
                ))}
              </div>
            )}

            <label>
              Logo

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (!file) return;

                  setLogoError("");

                  const allowedTypes = [
                    "image/png",
                    "image/jpeg",
                    "image/webp",
                    "image/svg+xml",
                  ];

                  if (!allowedTypes.includes(file.type)) {
                    setLogoError(
                      "Invalid logo format. Use PNG, JPG, WebP, or SVG."
                    );
                    e.target.value = "";
                    return;
                  }

                  const maxSize = 2 * 1024 * 1024;

                  if (file.size > maxSize) {
                    setLogoError(
                      "Logo is too large. Maximum file size is 2 MB."
                    );
                    e.target.value = "";
                    return;
                  }

                  const reader = new FileReader();

                  reader.onload = () => {
                    if (typeof reader.result === "string") {
                      setSetting("logo", reader.result);
                    }
                  };

                  reader.onerror = () => {
                    setLogoError("Could not read this image.");
                  };

                  reader.readAsDataURL(file);
                }}
              />
            </label>

            {logoError && (
              <p className="error" role="alert">
                {logoError}
              </p>
            )}

            {settings.logo && (
              <>
                <label>
                  Logo size: {Math.round(settings.logoSize * 100)}%

                  <input
                    type="range"
                    min={0.15}
                    max={0.5}
                    step={0.05}
                    value={settings.logoSize}
                    onChange={(e) =>
                      setSetting(
                        "logoSize",
                        Number(e.target.value)
                      )
                    }
                  />
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.hideBackgroundDots}
                    onChange={(e) =>
                      setSetting(
                        "hideBackgroundDots",
                        e.target.checked
                      )
                    }
                  />

                  Clear QR dots behind logo
                </label>
              </>
            )}

            {settings.logo && (
              <button
                type="button"
                className="remove-logo"
                onClick={() => {
                  setSetting("logo", "");
                  setSetting("logoSize", 0.4);
                }}
              >
                Remove logo
              </button>
            )}

          </fieldset>

          <div className="presets">
            <h2>Presets</h2>

            <div className="preset-list">
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  className="preset"
                  onClick={() => setSettings(preset.settings)}
                >
                  <span className="preset-name">
                    {preset.name}
                  </span>

                  <span className="preset-description">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - PREVIEW */}
        <div className="output">

          <div
            className={`qr-wrapper ${
              payload ? "" : "empty"
            }`}
          >
            <div
              ref={container}
              className="qr-preview"
            />

            {!payload && (
              <p className="placeholder">
                Your QR code will appear here
              </p>
            )}
          </div>

          <button
            onClick={download}
            disabled={!payload}
          >
            Download PNG
          </button>

          {recentQRs.length > 0 && (
            <div className="recent-section">

              <div className="recent-header">
                <h2>Recent QR Codes</h2>

                <button
                  className="clear-recent"
                  onClick={() => {
                    clearRecentQRs();
                    setRecentQRs([]);
                  }}
                >
                  Clear
                </button>
              </div>

              <div className="recent-list">
                {recentQRs.map((qr) => (
                  <button
                    key={qr.id}
                    className="recent-item"
                    onClick={() => {
                      setType(qr.type);
                      setFields(qr.fields);
                      setSettings(qr.settings);
                      setTouched(false);
                    }}
                  >
                    <span>
                      {TYPES.find((t) => t.value === qr.type)?.label}
                    </span>

                    <small>
                      {new Date(qr.timestamp).toLocaleString()}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label>
      {label}

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value)
        }
      />
    </label>
  );
}

export default App;
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("Setting up NativeWind...");

// Install dependencies
console.log("Installing nativewind and dependencies...");
execSync(
  "bun install nativewind react-native-reanimated react-native-safe-area-context",
  { stdio: "inherit" },
);
execSync(
  "bun install --dev tailwindcss prettier-plugin-tailwindcss babel-preset-expo",
  { stdio: "inherit" },
);

// Setup Tailwind CSS
console.log("Initializing Tailwind config...");
execSync("npx tailwindcss init", { stdio: "inherit" });

// Update tailwind.config.js
console.log("Updating tailwind.config.js...");
const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;
fs.writeFileSync("tailwind.config.js", tailwindConfig);

// Create global.css
console.log("Creating global.css...");
const globalCss = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
fs.writeFileSync("global.css", globalCss);

// Add Babel preset
console.log("Creating babel.config.js...");
const babelConfig = `module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
`;
fs.writeFileSync("babel.config.js", babelConfig);

// Create metro.config.js
console.log("Creating metro.config.js...");
const metroConfig = `const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
`;
fs.writeFileSync("metro.config.js", metroConfig);

// Modify app.json
console.log("Updating app.json...");
let appJson = JSON.parse(fs.readFileSync("app.json", "utf8"));
if (!appJson.expo.web) {
  appJson.expo.web = {};
}
appJson.expo.web.bundler = "metro";
fs.writeFileSync("app.json", JSON.stringify(appJson, null, 2));

// TypeScript setup
console.log("Creating nativewind-env.d.ts...");
const envD = `/// <reference types="nativewind/types" />
declare module '*.css';`;
fs.writeFileSync("nativewind-env.d.ts", envD);

// Update _layout.tsx to import global.css
console.log("Updating src/app/_layout.tsx...");
const layoutPath = "src/app/_layout.tsx";
let layoutContent = fs.readFileSync(layoutPath, "utf8");
const importStatement = "import '../../global.css';\n";
if (!layoutContent.includes(importStatement.trim())) {
  // Add after the first import
  const lines = layoutContent.split("\n");
  const firstImportIndex = lines.findIndex((line: string) =>
    line.startsWith("import"),
  );
  if (firstImportIndex !== -1) {
    lines.splice(firstImportIndex + 1, 0, importStatement.trim());
  } else {
    lines.unshift(importStatement.trim());
  }
  layoutContent = lines.join("\n");
  fs.writeFileSync(layoutPath, layoutContent);
}

console.log("NativeWind setup complete!");
console.log("Restart your Expo development server with: expo start --clear");

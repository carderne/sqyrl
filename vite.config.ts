import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/drizzle.ts"],
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["src/sql.ohm-bundle.js"],
        rules: {
          "unicorn/no-thenable": "off",
        },
      },
    ],
  },
  fmt: {},
});

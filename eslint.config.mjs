import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            "dist/",
            "out/",
            "node_modules/",
            "webpack.config.js",
            "eslint.config.mjs",
            "vitest.config.ts",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // Style rules matching existing code conventions
            "no-console": "error",
            "eqeqeq": ["error", "smart"],
            "curly": "error",

            // TypeScript rules
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-namespace": "off",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-require-imports": "off",

            // Allow objects with toString() and arrays in template literals
            "@typescript-eslint/restrict-template-expressions": ["error", {
                allowNumber: true,
                allowBoolean: true,
                allowNullish: false,
                allow: [{ from: "lib", name: ["Error"] }],
            }],

            // Relaxations needed for existing code patterns
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-return": "off",
        },
    },
);

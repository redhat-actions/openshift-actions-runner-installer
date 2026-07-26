import { describe, it, expect } from "vitest";
import { validateResourceName } from "../process-inputs";

describe("validateResourceName", () => {
    it("accepts a simple lowercase name", () => {
        expect(validateResourceName("my-runner")).toBe("my-runner");
    });

    it("converts uppercase to lowercase", () => {
        expect(validateResourceName("My-Runner")).toBe("my-runner");
    });

    it("replaces underscores with hyphens", () => {
        expect(validateResourceName("my_runner")).toBe("my-runner");
    });

    it("replaces dots with hyphens", () => {
        expect(validateResourceName("my.runner")).toBe("my-runner");
    });

    it("replaces slashes with hyphens", () => {
        expect(validateResourceName("org/repo")).toBe("org-repo");
    });

    it("replaces spaces with hyphens", () => {
        expect(validateResourceName("my runner")).toBe("my-runner");
    });

    it("handles a typical repo name like 'my-repo-runner'", () => {
        expect(validateResourceName("my-repo-runner")).toBe("my-repo-runner");
    });

    it("handles mixed special characters", () => {
        expect(validateResourceName("My Org/My_Repo.Name")).toBe("my-org-my-repo-name");
    });

    it("throws on names that don't start with a letter", () => {
        expect(() => validateResourceName("1-runner")).toThrow("must start and end with a lowercase letter");
    });

    it("throws on names that don't end with a letter", () => {
        expect(() => validateResourceName("runner-1")).toThrow("must start and end with a lowercase letter");
    });

    it("throws on names with illegal characters after replacement", () => {
        expect(() => validateResourceName("runner@home")).toThrow("contains illegal characters");
    });

    it("throws on names longer than 63 characters", () => {
        const longName = "a" + "b".repeat(63) + "z";
        expect(() => validateResourceName(longName)).toThrow("must be shorter than 64 characters");
    });

    it("accepts names exactly 63 characters", () => {
        const name = "a" + "b".repeat(61) + "z";
        expect(name.length).toBe(63);
        expect(validateResourceName(name)).toBe(name);
    });
});

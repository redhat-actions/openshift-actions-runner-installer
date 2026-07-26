import { describe, it, expect } from "vitest";
import RunnerLocation from "../types/runner-location";

describe("RunnerLocation", () => {
    describe("constructor", () => {
        it("creates a repository location with owner and repo", () => {
            const loc = new RunnerLocation("redhat-actions", "my-repo");
            expect(loc.owner).toBe("redhat-actions");
            expect(loc.repository).toBe("my-repo");
        });

        it("creates an organization location with owner only", () => {
            const loc = new RunnerLocation("redhat-actions");
            expect(loc.owner).toBe("redhat-actions");
            expect(loc.repository).toBeUndefined();
        });
    });

    describe("toString", () => {
        it("returns owner/repo for repository locations", () => {
            const loc = new RunnerLocation("redhat-actions", "my-repo");
            expect(loc.toString()).toBe("redhat-actions/my-repo");
        });

        it("returns owner only for organization locations", () => {
            const loc = new RunnerLocation("redhat-actions");
            expect(loc.toString()).toBe("redhat-actions");
        });
    });
});

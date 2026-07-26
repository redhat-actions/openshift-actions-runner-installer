import { describe, it, expect } from "vitest";
import { joinList, splitByNewline } from "../util/util";

describe("joinList", () => {
    it("joins a single item", () => {
        expect(joinList(["alice"])).toBe("alice");
    });

    it("joins two items with 'and'", () => {
        expect(joinList(["alice", "bob"])).toBe("alice and bob");
    });

    it("joins three items with commas and 'and'", () => {
        expect(joinList(["alice", "bob", "charlie"])).toBe("alice, bob and charlie");
    });

    it("joins with 'or' when specified", () => {
        expect(joinList(["alice", "bob", "charlie"], "or")).toBe("alice, bob or charlie");
    });

    it("joins two items with 'or'", () => {
        expect(joinList(["alice", "bob"], "or")).toBe("alice or bob");
    });

    it("filters out empty strings", () => {
        expect(joinList(["alice", "", "bob"])).toBe("alice and bob");
    });

    it("does not modify the original array", () => {
        const arr = ["alice", "bob", "charlie"];
        joinList(arr);
        expect(arr).toEqual(["alice", "bob", "charlie"]);
    });
});

describe("splitByNewline", () => {
    it("splits on unix newlines", () => {
        expect(splitByNewline("a\nb\nc")).toEqual(["a", "b", "c"]);
    });

    it("splits on windows newlines", () => {
        expect(splitByNewline("a\r\nb\r\nc")).toEqual(["a", "b", "c"]);
    });

    it("handles single line", () => {
        expect(splitByNewline("hello")).toEqual(["hello"]);
    });

    it("handles empty string", () => {
        expect(splitByNewline("")).toEqual([""]);
    });
});

import { describe, it, expect } from "vitest";
import { autoDetectMapping, applyMapping, type FieldDefinition } from "./csvParser";

const KEYWORD_FIELDS: FieldDefinition[] = [
  { key: "phrase", label: "Keyword Phrase", required: true, aliases: ["keyword", "query", "term"] },
  { key: "searchVolume", label: "Search Volume", aliases: ["volume", "monthly searches"] },
  { key: "difficulty", label: "Difficulty", aliases: ["kd", "keyword difficulty"] },
  { key: "tags", label: "Tags", aliases: ["tag", "labels"] },
];

describe("autoDetectMapping", () => {
  it("maps exact field key matches", () => {
    const headers = ["phrase", "searchVolume", "difficulty"];
    const result = autoDetectMapping(headers, KEYWORD_FIELDS);
    expect(result).toEqual({ 0: "phrase", 1: "searchVolume", 2: "difficulty" });
  });

  it("maps alias matches case-insensitively", () => {
    const headers = ["Keyword", "Volume", "KD"];
    const result = autoDetectMapping(headers, KEYWORD_FIELDS);
    expect(result).toEqual({ 0: "phrase", 1: "searchVolume", 2: "difficulty" });
  });

  it("handles headers with special characters", () => {
    const headers = ["Keyword Phrase", "Search Volume", "Keyword Difficulty"];
    const result = autoDetectMapping(headers, KEYWORD_FIELDS);
    expect(result).toEqual({ 0: "phrase", 1: "searchVolume", 2: "difficulty" });
  });

  it("skips unrecognized headers", () => {
    const headers = ["Unknown", "phrase", "Something Else"];
    const result = autoDetectMapping(headers, KEYWORD_FIELDS);
    expect(result).toEqual({ 1: "phrase" });
  });

  it("does not map same field twice", () => {
    const headers = ["keyword", "query"]; // Both alias to "phrase"
    const result = autoDetectMapping(headers, KEYWORD_FIELDS);
    expect(result).toEqual({ 0: "phrase" }); // First match wins
  });

  it("returns empty mapping for no matches", () => {
    const headers = ["foo", "bar", "baz"];
    const result = autoDetectMapping(headers, KEYWORD_FIELDS);
    expect(result).toEqual({});
  });

  it("handles empty headers", () => {
    const result = autoDetectMapping([], KEYWORD_FIELDS);
    expect(result).toEqual({});
  });
});

describe("applyMapping", () => {
  it("maps row data to field keys", () => {
    const rows = [
      ["best seo tools", "1200", "45"],
      ["keyword research", "800", "32"],
    ];
    const mapping: Record<number, string> = { 0: "phrase", 1: "searchVolume", 2: "difficulty" };
    const result = applyMapping(rows, mapping);
    expect(result).toEqual([
      { phrase: "best seo tools", searchVolume: "1200", difficulty: "45" },
      { phrase: "keyword research", searchVolume: "800", difficulty: "32" },
    ]);
  });

  it("skips unmapped columns", () => {
    const rows = [["hello", "world", "test"]];
    const mapping: Record<number, string> = { 0: "phrase" };
    const result = applyMapping(rows, mapping);
    expect(result).toEqual([{ phrase: "hello" }]);
  });

  it("handles missing cells gracefully", () => {
    const rows = [["only one"]]; // Row shorter than mapping expects
    const mapping: Record<number, string> = { 0: "phrase", 2: "difficulty" };
    const result = applyMapping(rows, mapping);
    expect(result).toEqual([{ phrase: "only one", difficulty: "" }]);
  });

  it("trims cell values", () => {
    const rows = [["  seo tools  ", "  1200  "]];
    const mapping: Record<number, string> = { 0: "phrase", 1: "searchVolume" };
    const result = applyMapping(rows, mapping);
    expect(result).toEqual([{ phrase: "seo tools", searchVolume: "1200" }]);
  });

  it("handles empty rows", () => {
    const result = applyMapping([], { 0: "phrase" });
    expect(result).toEqual([]);
  });
});

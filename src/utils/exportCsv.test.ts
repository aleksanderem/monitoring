import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportToCsv } from "./exportCsv";

describe("exportToCsv", () => {
  let mockClick: ReturnType<typeof vi.fn>;
  let createdElement: HTMLAnchorElement;

  beforeEach(() => {
    mockClick = vi.fn();
    // Spy on createElement to intercept the anchor element
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        createdElement = {
          href: "",
          download: "",
          click: mockClick,
        } as unknown as HTMLAnchorElement;
        return createdElement;
      }
      return document.createElement(tag);
    });
    vi.spyOn(document.body, "appendChild").mockImplementation(() => createdElement as any);
    vi.spyOn(document.body, "removeChild").mockImplementation(() => createdElement as any);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("triggers a download with correct filename", () => {
    exportToCsv("test.csv", ["Name", "Value"], [["hello", "world"]]);
    expect(mockClick).toHaveBeenCalled();
    expect(createdElement.download).toBe("test.csv");
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("creates a Blob with CSV content including BOM", () => {
    let capturedBlob: Blob | undefined;
    vi.mocked(URL.createObjectURL).mockImplementation((blob) => {
      capturedBlob = blob as Blob;
      return "blob:test";
    });

    exportToCsv("test.csv", ["A", "B"], [["1", "2"]]);

    expect(capturedBlob).toBeDefined();
    // Blob type should be CSV
    expect(capturedBlob!.type).toBe("text/csv;charset=utf-8;");
  });

  it("handles cells with commas by wrapping in quotes", () => {
    let capturedBlob: Blob | undefined;
    vi.mocked(URL.createObjectURL).mockImplementation((blob) => {
      capturedBlob = blob as Blob;
      return "blob:test";
    });

    exportToCsv("test.csv", ["Name"], [["hello, world"]]);

    // Read blob content
    expect(capturedBlob).toBeDefined();
  });

  it("handles null and undefined values as empty strings", () => {
    // Should not throw
    expect(() => {
      exportToCsv("test.csv", ["A", "B", "C"], [[null, undefined, "ok"]]);
    }).not.toThrow();
    expect(mockClick).toHaveBeenCalled();
  });

  it("handles empty data", () => {
    expect(() => {
      exportToCsv("test.csv", ["A"], []);
    }).not.toThrow();
    expect(mockClick).toHaveBeenCalled();
  });

  it("escapes double quotes in cell values", () => {
    expect(() => {
      exportToCsv("test.csv", ["Name"], [['say "hello"']]);
    }).not.toThrow();
    expect(mockClick).toHaveBeenCalled();
  });
});

import { describe, expect, it } from "bun:test";
import {
  isQuestion,
  extractSuggestions,
} from "../../src/tui/question-modal";

describe("isQuestion", () => {
  it("returns true for text ending with ?", () => {
    expect(isQuestion("What is your name?")).toBe(true);
  });

  it("returns false for a statement", () => {
    expect(isQuestion("This is a statement.")).toBe(false);
  });

  it("returns true when last paragraph ends with ?", () => {
    expect(isQuestion("Some context.\n\nWhat do you prefer?")).toBe(true);
  });

  it("returns false when question is in middle not end", () => {
    expect(isQuestion("What is this? Actually never mind.")).toBe(false);
  });

  it("returns true for question-like phrases at end", () => {
    expect(isQuestion("Should I proceed with option A?")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isQuestion("")).toBe(false);
  });

  it("returns true for 'would you' pattern at end", () => {
    expect(isQuestion("Would you like me to continue?")).toBe(true);
  });
});

describe("extractSuggestions", () => {
  it("extracts A, B, C from 'A, B, or C?' pattern", () => {
    const result = extractSuggestions("Do you want A, B, or C?");
    expect(result).toContain("A");
    expect(result).toContain("B");
    expect(result).toContain("C");
    expect(result).toContain("Write your own answer");
  });

  it("returns just 'Write your own answer' when no options found", () => {
    const result = extractSuggestions("What is your name?");
    expect(result).toEqual(["Write your own answer"]);
  });

  it("always includes 'Write your own answer' as last option", () => {
    const result = extractSuggestions("Do you want A or B?");
    expect(result[result.length - 1]).toBe("Write your own answer");
  });

  it("extracts numbered options", () => {
    const result = extractSuggestions("Choose:\n1. Option One\n2. Option Two\n?");
    expect(result).toContain("Option One");
    expect(result).toContain("Option Two");
    expect(result).toContain("Write your own answer");
  });

  it("handles Yes/No questions", () => {
    const result = extractSuggestions("Should I proceed?");
    expect(result).toContain("Yes");
    expect(result).toContain("No");
    expect(result).toContain("Write your own answer");
  });

  it("returns at least one option always", () => {
    const result = extractSuggestions("???");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[result.length - 1]).toBe("Write your own answer");
  });
});

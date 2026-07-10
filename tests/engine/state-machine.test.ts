import { describe, expect, it } from "bun:test";
import { validateTransition, getValidTransitions, isHaltState, isTerminalState } from "../../src/engine/state-machine";
import type { WorkflowState } from "../../src/engine/types";

describe("state-machine", () => {
  describe("validateTransition", () => {
    it("allows ready-for-dev → in-dev", () => {
      expect(validateTransition("ready-for-dev", "in-dev")).toBe(true);
    });

    it("allows in-dev → ready-for-qa", () => {
      expect(validateTransition("in-dev", "ready-for-qa")).toBe(true);
    });

    it("allows in-dev → in-deskcheck", () => {
      expect(validateTransition("in-dev", "in-deskcheck")).toBe(true);
    });

    it("allows in-dev → halted-stall", () => {
      expect(validateTransition("in-dev", "halted-stall")).toBe(true);
    });

    it("allows in-dev → halted-ambiguous", () => {
      expect(validateTransition("in-dev", "halted-ambiguous")).toBe(true);
    });

    it("allows in-qa → ready-for-acceptance", () => {
      expect(validateTransition("in-qa", "ready-for-acceptance")).toBe(true);
    });

    it("allows in-acceptance → ready-to-deploy", () => {
      expect(validateTransition("in-acceptance", "ready-to-deploy")).toBe(true);
    });

    it("allows in-acceptance → ready-for-dev", () => {
      expect(validateTransition("in-acceptance", "ready-for-dev")).toBe(true);
    });

    it("allows ready-to-deploy → done", () => {
      expect(validateTransition("ready-to-deploy", "done")).toBe(true);
    });

    it("allows halted-stall → ready-for-dev", () => {
      expect(validateTransition("halted-stall", "ready-for-dev")).toBe(true);
    });

    it("allows halted-ambiguous → in-dev", () => {
      expect(validateTransition("halted-ambiguous", "in-dev")).toBe(true);
    });

    it("rejects done → anything", () => {
      const states: WorkflowState[] = ["ready-for-dev", "in-dev", "in-qa"];
      for (const s of states) {
        expect(validateTransition("done", s)).toBe(false);
      }
    });

    it("rejects ready-for-dev → done (skipping pipeline)", () => {
      expect(validateTransition("ready-for-dev", "done")).toBe(false);
    });

    it("rejects in-dev → done (skipping pipeline)", () => {
      expect(validateTransition("in-dev", "done")).toBe(false);
    });

    it("rejects in-analysis → in-dev (must go through ready-for-dev first)", () => {
      expect(validateTransition("in-analysis", "in-dev")).toBe(false);
    });

    it("rejects in-qa → in-dev (going backwards)", () => {
      expect(validateTransition("in-qa", "in-dev")).toBe(false);
    });
  });

  describe("getValidTransitions", () => {
    it("returns empty array for done", () => {
      expect(getValidTransitions("done")).toEqual([]);
    });

    it("returns multiple targets for in-dev", () => {
      const targets = getValidTransitions("in-dev");
      expect(targets).toContain("in-deskcheck");
      expect(targets).toContain("ready-for-qa");
      expect(targets).toContain("halted-stall");
      expect(targets).toContain("halted-ambiguous");
      expect(targets).toContain("halted-unsafe");
      expect(targets.length).toBeGreaterThanOrEqual(5);
    });

    it("returns un-halt targets for halted-ambiguous", () => {
      const targets = getValidTransitions("halted-ambiguous");
      expect(targets).toContain("ready-for-dev");
      expect(targets).toContain("in-dev");
      expect(targets).toContain("in-qa");
      expect(targets).toContain("in-acceptance");
    });
  });

  describe("isHaltState", () => {
    it("returns true for all halted-* states", () => {
      expect(isHaltState("halted-stall")).toBe(true);
      expect(isHaltState("halted-ambiguous")).toBe(true);
      expect(isHaltState("halted-human-gate")).toBe(true);
      expect(isHaltState("halted-unsafe")).toBe(true);
    });

    it("returns false for non-halted states", () => {
      expect(isHaltState("in-dev")).toBe(false);
      expect(isHaltState("done")).toBe(false);
      expect(isHaltState("ready-for-dev")).toBe(false);
    });
  });

  describe("isTerminalState", () => {
    it("returns true for done", () => {
      expect(isTerminalState("done")).toBe(true);
    });

    it("returns false for non-terminal states", () => {
      expect(isTerminalState("in-dev")).toBe(false);
      expect(isTerminalState("halted-stall")).toBe(false);
      expect(isTerminalState("ready-for-dev")).toBe(false);
    });
  });
});

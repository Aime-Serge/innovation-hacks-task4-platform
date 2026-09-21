import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatDate, isOverdue, relativeTime, todayIso } from "@/lib/dates";

describe("TC-031 overdue marking (BR-04)", () => {
  it("TC-031 is overdue when due before today and not done", () => {
    expect(isOverdue({ dueDate: "2030-01-01", status: "todo" }, "2030-01-02")).toBe(true);
  });

  it("TC-031 is not overdue when done, undated, due today or later", () => {
    expect(isOverdue({ dueDate: "2030-01-01", status: "done" }, "2030-01-02")).toBe(false);
    expect(isOverdue({ dueDate: null, status: "todo" }, "2030-01-02")).toBe(false);
    expect(isOverdue({ dueDate: "2030-01-02", status: "todo" }, "2030-01-02")).toBe(false);
    expect(isOverdue({ dueDate: "2030-01-03", status: "in_review" }, "2030-01-02")).toBe(false);
  });
});

describe("TC-003 date helpers", () => {
  it("TC-003 adds days across month and year ends", () => {
    expect(addDays("2030-12-30", 3)).toBe("2031-01-02");
    expect(addDays("2030-03-01", -1)).toBe("2030-02-28");
  });

  it("TC-003 counts whole days between dates", () => {
    expect(daysBetween("2030-01-01", "2030-01-08")).toBe(7);
    expect(daysBetween("2030-01-08", "2030-01-01")).toBe(-7);
  });

  it("TC-003 formats today as a local ISO date", () => {
    expect(todayIso(new Date(2030, 4, 6, 23, 59))).toBe("2030-05-06");
  });

  it("TC-003 formats short dates", () => {
    expect(formatDate("2030-05-06")).toBe("May 6");
  });

  it("TC-003 writes relative times, newest first friendly", () => {
    const now = new Date("2030-01-01T12:00:00Z");
    expect(relativeTime("2030-01-01T10:00:00Z", now)).toBe("2 hours ago");
    expect(relativeTime("2029-12-31T12:00:00Z", now)).toBe("yesterday");
    expect(relativeTime("2030-01-01T11:59:40Z", now)).toBe("this minute");
  });
});

import { describe, expect, it } from "vitest";
import { canEditEntry, canViewEntry, canViewMedia } from "@/lib/access";

const owner = { userId: "user-a", householdId: "home-1" };
const partner = { userId: "user-b", householdId: "home-1" };
const stranger = { userId: "user-c", householdId: "home-2" };

const shared = { householdId: "home-1", createdBy: "user-a", visibility: "HOUSEHOLD", status: "PUBLISHED" };
const privateEntry = { householdId: "home-1", createdBy: "user-a", visibility: "PRIVATE", status: "PUBLISHED" };
const draft = { householdId: "home-1", createdBy: "user-a", visibility: "HOUSEHOLD", status: "DRAFT" };

describe("entry permissions", () => {
  it("shows shared entries to every member of the household", () => {
    expect(canViewEntry(shared, owner)).toBe(true);
    expect(canViewEntry(shared, partner)).toBe(true);
  });

  it("never leaks a private entry to another member", () => {
    expect(canViewEntry(privateEntry, owner)).toBe(true);
    expect(canViewEntry(privateEntry, partner)).toBe(false);
  });

  it("keeps drafts to their author", () => {
    expect(canViewEntry(draft, owner)).toBe(true);
    expect(canViewEntry(draft, partner)).toBe(false);
  });

  it("never exposes deleted or cross-household entries", () => {
    expect(canViewEntry({ ...shared, status: "DELETED" }, owner)).toBe(false);
    expect(canViewEntry(shared, stranger)).toBe(false);
  });

  it("lets household members edit shared entries, but not private ones", () => {
    expect(canEditEntry(shared, owner)).toBe(true);
    expect(canEditEntry(shared, partner)).toBe(true);
    expect(canEditEntry(privateEntry, partner)).toBe(false);
    expect(canEditEntry(shared, stranger)).toBe(false);
  });
});

describe("media permissions", () => {
  const photo = { householdId: "home-1", uploadedBy: "user-a", visibility: "HOUSEHOLD", status: "ACTIVE" };

  it("follows the photo's own visibility, not only the entry's", () => {
    expect(canViewMedia(photo, partner)).toBe(true);
    expect(canViewMedia({ ...photo, visibility: "PRIVATE" }, partner)).toBe(false);
  });

  it("hides deleted media and other households", () => {
    expect(canViewMedia({ ...photo, status: "DELETED" }, owner)).toBe(false);
    expect(canViewMedia(photo, stranger)).toBe(false);
  });
});

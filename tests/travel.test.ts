import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  linkLabel,
  normalizeTripLink,
  parseCoordinates,
  tripCategoryGroups,
  tripLinkKind,
} from "@/lib/travel";
import {
  TRAVEL_TEMPLATES,
  findTravelTemplate,
  isCategorizedTemplate,
  templateCategoryNames,
  templateEntries,
  templateItemCount,
} from "@/lib/travel-templates";

describe("normalizeTripLink", () => {
  it("adds https to bare domains", () => {
    expect(normalizeTripLink("www.dpm.org.cn")).toBe("https://www.dpm.org.cn/");
  });

  it("keeps web links", () => {
    expect(normalizeTripLink("https://www.dpm.org.cn/visit")).toBe("https://www.dpm.org.cn/visit");
  });

  it("extracts a mini-program link from share text", () => {
    expect(normalizeTripLink("故宫博物院预约 #小程序://故宫博物院/AbCd1234 复制打开")).toBe(
      "#小程序://故宫博物院/AbCd1234",
    );
  });

  it("keeps app deep links", () => {
    expect(normalizeTripLink("weixin://dl/business/?t=abc")).toBe("weixin://dl/business/?t=abc");
  });

  it("rejects script and data urls", () => {
    expect(normalizeTripLink("javascript:alert(1)")).toBeNull();
    expect(normalizeTripLink("javascript://alert(1)")).toBeNull();
    expect(normalizeTripLink("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(normalizeTripLink("file:///etc/passwd")).toBeNull();
  });

  it("rejects plain text without a link", () => {
    expect(normalizeTripLink("全国博物馆")).toBeNull();
    expect(normalizeTripLink("   ")).toBeNull();
  });
});

describe("tripLinkKind", () => {
  it("tells web links apart from mini programs and deep links", () => {
    expect(tripLinkKind("https://www.dpm.org.cn/")).toBe("WEB");
    expect(tripLinkKind("#小程序://故宫博物院/AbCd1234")).toBe("MINIPROGRAM");
    expect(tripLinkKind("weixin://dl/business/?t=abc")).toBe("APP");
  });

  it("labels links for the list", () => {
    expect(linkLabel("https://www.dpm.org.cn/")).toBe("dpm.org.cn");
    expect(linkLabel("#小程序://故宫博物院/AbCd1234")).toContain("小程序");
    expect(linkLabel("weixin://dl/business/?t=abc")).toBe("weixin 链接");
  });
});

describe("parseCoordinates", () => {
  it("accepts valid coordinates", () => {
    expect(parseCoordinates("39.908", "116.397")).toEqual({
      latitude: 39.908,
      longitude: 116.397,
    });
  });

  it("treats missing or broken values as no coordinates", () => {
    expect(parseCoordinates("", "")).toBeNull();
    expect(parseCoordinates("39.908", "")).toBeNull();
    expect(parseCoordinates("abc", "116.397")).toBeNull();
    expect(parseCoordinates("91", "116.397")).toBeNull();
    expect(parseCoordinates("39.908", "181")).toBeNull();
  });
});

describe("travel templates", () => {
  it("has unique ids and at least one entry each", () => {
    const ids = new Set(TRAVEL_TEMPLATES.map((template) => template.id));
    expect(ids.size).toBe(TRAVEL_TEMPLATES.length);
    for (const template of TRAVEL_TEMPLATES) {
      expect(template.title.length, template.id).toBeGreaterThan(0);
      expect(templateItemCount(template), template.id).toBeGreaterThan(0);
    }
  });

  it("ships a cover image for every template", () => {
    for (const template of TRAVEL_TEMPLATES) {
      expect(template.cover.startsWith("/travel/covers/"), template.id).toBe(true);
      const file = path.join(process.cwd(), "public", template.cover);
      expect(fs.existsSync(file), template.cover).toBe(true);
    }
  });

  it("does not repeat an entry inside the same template", () => {
    for (const template of TRAVEL_TEMPLATES) {
      const entries = templateEntries(template);
      const names = entries.map((entry) => entry.name);
      expect(new Set(names).size, template.id).toBe(names.length);
      expect(entries.map((entry) => entry.sortOrder), template.id).toEqual(
        entries.map((_, index) => index),
      );
      for (const entry of entries) {
        expect(entry.name.trim().length, template.id).toBeGreaterThan(0);
        if (!isCategorizedTemplate(template)) {
          expect(entry.region.length, template.id).toBeGreaterThan(0);
          expect(entry.category).toBeNull();
        }
      }
    }
  });

  it("ships the two couple themes as 10 categories of 10 items", () => {
    const cases = [
      { id: "couple-budget-100", title: "普通预算情侣的 100 件小事" },
      { id: "couple-premium-100", title: "经济条件不错的情侣 100 件事" },
    ];

    for (const item of cases) {
      const template = findTravelTemplate(item.id);
      expect(template, item.id).toBeTruthy();
      expect(template!.title).toBe(item.title);
      expect(isCategorizedTemplate(template)).toBe(true);
      expect(templateCategoryNames(template!)).toHaveLength(10);
      expect(templateItemCount(template!)).toBe(100);

      const entries = templateEntries(template!);
      expect(entries).toHaveLength(100);
      for (const category of template!.categories!) {
        expect(category.items, category.name).toHaveLength(10);
      }
      for (const [index, entry] of entries.entries()) {
        expect(entry.category, entry.name).toBeTruthy();
        expect(entry.sortOrder, entry.name).toBe(index);
        expect(entry.region, entry.name).toBe("");
      }
    }
  });
});

describe("tripCategoryGroups", () => {
  const place = (category: string | null, done: boolean) => ({
    category,
    visits: done ? [{ id: "v" }] : [],
  });

  it("keeps template category order and computes per-category progress", () => {
    const groups = tripCategoryGroups(
      [place("日常", true), place("日常", false), place("旅行", true)],
      ["日常", "旅行", "未来"],
    );

    expect(groups.map((group) => group.name)).toEqual(["日常", "旅行"]);
    expect(groups[0]).toMatchObject({ total: 2, visited: 1, percent: 50 });
    expect(groups[1]).toMatchObject({ total: 1, visited: 1, percent: 100 });
  });

  it("puts uncategorized places into 其他 after template categories", () => {
    const groups = tripCategoryGroups([place(null, false), place("日常", true)], ["日常"]);
    expect(groups.map((group) => group.name)).toEqual(["日常", "其他"]);
    expect(groups[1]).toMatchObject({ total: 1, visited: 0, percent: 0 });
  });
});

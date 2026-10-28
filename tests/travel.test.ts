import { describe, expect, it } from "vitest";
import { linkLabel, normalizeTripLink, parseCoordinates, tripLinkKind } from "@/lib/travel";
import { TRAVEL_TEMPLATES } from "@/lib/travel-templates";

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
  it("has unique ids and at least one place each", () => {
    const ids = new Set(TRAVEL_TEMPLATES.map((template) => template.id));
    expect(ids.size).toBe(TRAVEL_TEMPLATES.length);
    for (const template of TRAVEL_TEMPLATES) {
      expect(template.title.length).toBeGreaterThan(0);
      expect(template.places.length).toBeGreaterThan(0);
    }
  });

  it("does not repeat a place inside the same template", () => {
    for (const template of TRAVEL_TEMPLATES) {
      const names = template.places.map((place) => place.name);
      expect(new Set(names).size, template.id).toBe(names.length);
      for (const place of template.places) {
        expect(place.name.length).toBeGreaterThan(0);
        expect(place.region.length).toBeGreaterThan(0);
      }
    }
  });
});

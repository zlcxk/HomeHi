import { describe, expect, it } from "vitest";
import {
  blockingReferenceCount,
  describeMediaCascades,
  describeMediaReferences,
  hasAnyMediaReference,
  hasLegacyDeletedRefs,
  mediaFileKeys,
  mediaFilePurgeKeys,
  parseDeletedRefs,
  serializeDeletedRefs,
  type MediaReferenceCounts,
} from "@/lib/media-lifecycle";

const empty: MediaReferenceCounts = {
  entryPhotos: 0,
  albumPhotos: 0,
  tripPhotos: 0,
  avatars: 0,
  assetPhotos: 0,
  covers: 0,
  tags: 0,
};

describe("media lifecycle", () => {
  it("标签和相册关联不阻止彻底删除，其他业务引用都阻止", () => {
    expect(blockingReferenceCount({ ...empty, tags: 3, albumPhotos: 4 })).toBe(0);
    expect(
      blockingReferenceCount({
        entryPhotos: 1,
        albumPhotos: 1,
        tripPhotos: 1,
        avatars: 1,
        assetPhotos: 1,
        covers: 1,
        tags: 5,
      }),
    ).toBe(5);
  });

  it("只要有任何业务或整理关系，就视为已有照片而不是新上传", () => {
    expect(hasAnyMediaReference(empty)).toBe(false);
    expect(hasAnyMediaReference({ ...empty, albumPhotos: 1 })).toBe(true);
    expect(hasAnyMediaReference({ ...empty, tags: 1 })).toBe(true);
    expect(hasAnyMediaReference({ ...empty, entryPhotos: 1 })).toBe(true);
  });

  it("阻止原因和级联清理分开描述", () => {
    const counts: MediaReferenceCounts = {
      entryPhotos: 2,
      albumPhotos: 3,
      tripPhotos: 0,
      avatars: 1,
      assetPhotos: 0,
      covers: 3,
      tags: 0,
    };
    expect(describeMediaReferences(counts)).toEqual(["2 条记录", "1 个头像", "3 个封面"]);
    expect(describeMediaCascades(counts)).toEqual(["3 个相册"]);
    expect(describeMediaReferences(empty)).toEqual([]);
    expect(describeMediaCascades(empty)).toEqual([]);
  });

  it("只清理真实存在且不重复的文件键", () => {
    expect(
      mediaFileKeys({
        storageKey: "media/a.jpg",
        thumbnailKey: "thumbs/a.webp",
        displayKey: null,
        playbackKey: null,
      }),
    ).toEqual(["media/a.jpg", "thumbs/a.webp"]);

    expect(
      mediaFileKeys({
        storageKey: "media/a.mp4",
        thumbnailKey: "thumbs/a.webp",
        displayKey: "display/a.webp",
        playbackKey: "playback/a.mp4",
      }),
    ).toHaveLength(4);

    // 历史数据里原图和变体键可能相同，不能重复删除。
    expect(
      mediaFileKeys({
        storageKey: "media/a.jpg",
        thumbnailKey: "media/a.jpg",
        displayKey: null,
        playbackKey: null,
      }),
    ).toEqual(["media/a.jpg"]);
  });

  it("彻底删除时先删变体，最后删原图", () => {
    expect(
      mediaFilePurgeKeys({
        storageKey: "media/a.jpg",
        thumbnailKey: "thumbs/a.webp",
        displayKey: "display/a.webp",
        playbackKey: null,
      }),
    ).toEqual(["thumbs/a.webp", "display/a.webp", "media/a.jpg"]);

    // 原图与变体同键时不能重复，也不能排到原图之后再删一次。
    expect(
      mediaFilePurgeKeys({
        storageKey: "media/a.jpg",
        thumbnailKey: "media/a.jpg",
        displayKey: null,
        playbackKey: null,
      }),
    ).toEqual(["media/a.jpg"]);
  });

  it("快照只保留有效的字符串 ID 并去重", () => {
    const refs = parseDeletedRefs(
      JSON.stringify({
        albumCovers: ["a", "a", "", 3],
        entryCovers: ["e"],
        tripCovers: null,
        userAvatars: ["u"],
        profileAvatars: [],
        assetPhotos: ["x"],
      }),
    );
    expect(refs).toEqual({
      albumCovers: ["a"],
      entryCovers: ["e"],
      tripCovers: [],
      userAvatars: ["u"],
      profileAvatars: [],
      assetPhotos: ["x"],
    });
    expect(parseDeletedRefs(null)).toBeNull();
    expect(parseDeletedRefs("not json")).toBeNull();
    expect(serializeDeletedRefs(refs!)).toContain('"albumCovers":["a"]');
  });

  it("旧版本删除的媒体没有引用快照", () => {
    expect(hasLegacyDeletedRefs(null)).toBe(true);
    expect(hasLegacyDeletedRefs("{}")).toBe(false);
  });
});

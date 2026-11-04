import { describe, expect, it } from "vitest";
import {
  blockingReferenceCount,
  describeMediaReferences,
  mediaFileKeys,
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
  it("标签不阻止彻底删除，其他业务引用都阻止", () => {
    expect(blockingReferenceCount({ ...empty, tags: 3 })).toBe(0);
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
    ).toBe(6);
  });

  it("把引用数量转成可读原因", () => {
    expect(
      describeMediaReferences({
        entryPhotos: 2,
        albumPhotos: 1,
        tripPhotos: 0,
        avatars: 1,
        assetPhotos: 0,
        covers: 3,
        tags: 0,
      }),
    ).toEqual(["2 条记录", "1 个相册", "1 个头像", "3 个封面"]);
    expect(describeMediaReferences(empty)).toEqual([]);
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
});

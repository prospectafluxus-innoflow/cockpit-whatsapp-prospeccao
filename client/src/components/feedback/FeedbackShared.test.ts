import { describe, expect, it } from "vitest";
import { canOpenFeedbackRecord } from "./FeedbackShared";

describe("canOpenFeedbackRecord", () => {
  it("requires a participant-visible status for the viewer's own record", () => {
    expect(
      canOpenFeedbackRecord({
        participantUserId: 7,
        viewerUserId: 7,
        status: "draft",
        canReadContent: false,
      })
    ).toBe(false);
    expect(
      canOpenFeedbackRecord({
        participantUserId: 7,
        viewerUserId: 7,
        status: "released",
        canReadContent: false,
      })
    ).toBe(true);
  });

  it("uses organizational read permission for another participant's record", () => {
    expect(
      canOpenFeedbackRecord({
        participantUserId: 7,
        viewerUserId: 9,
        status: "draft",
        canReadContent: false,
      })
    ).toBe(false);
    expect(
      canOpenFeedbackRecord({
        participantUserId: 7,
        viewerUserId: 9,
        status: "draft",
        canReadContent: true,
      })
    ).toBe(true);
  });
});

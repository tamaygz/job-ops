import {
  __resetApiClientAuthForTests,
  __setAuthTokenForTests,
} from "@client/api/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToSettingsLogStream } from "./settings-profile";

function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
  } as Response;
}

describe("settings profile log stream", () => {
  afterEach(() => {
    __resetApiClientAuthForTests();
    vi.restoreAllMocks();
  });

  it("subscribes to the authenticated API logs endpoint", async () => {
    const onOpen = vi.fn();
    const onMessage = vi.fn();

    __setAuthTokenForTests("stream-token");

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        createStreamResponse(['data: {"type":"snapshot","entries":[]}\n\n']),
      );

    const unsubscribe = subscribeToSettingsLogStream({
      onOpen,
      onMessage,
    });

    await vi.waitFor(() => {
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith({
        type: "snapshot",
        entries: [],
      });
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/settings/logs/stream",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer stream-token",
        },
      }),
    );

    unsubscribe();
  });
});

import { createFileRoute } from "@tanstack/react-router";

/**
 * Legacy Lovable cloud TTS endpoint.
 * Clients now use browser-local SpeechSynthesis via `useSpeech()` so Listen
 * keeps working without Lovable TTS credits. This route stays as a no-op
 * compatibility stub for any old callers.
 */
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async () => {
        return Response.json(
          {
            ok: false,
            mode: "local",
            message:
              "Cloud TTS is disabled. Use browser SpeechSynthesis (client useSpeech hook).",
          },
          { status: 410 },
        );
      },
    },
  },
});

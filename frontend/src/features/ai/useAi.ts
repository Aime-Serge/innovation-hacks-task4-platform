"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServices } from "@/providers/ServicesProvider";

/** FR-421: AI actions exist only while the API says AI is on. */
export function useAiStatus() {
  const { ai } = useServices();
  return useQuery({
    queryKey: ["ai", "status"],
    queryFn: ({ signal }) => ai.status(signal),
    staleTime: 30_000,
    retry: false, // a failing status simply hides the AI actions (NFR-405)
  });
}

const ACK_KEY = "devdash.ai-privacy-ack";

function readAck(): boolean {
  try {
    return window.localStorage.getItem(ACK_KEY) === "1";
  } catch {
    return false; // storage can be blocked: the notice then shows every time
  }
}

/** The privacy notice shows before first use (section 9); the answer is a per-browser convenience. */
export function usePrivacyAck(): [boolean, () => void] {
  const [acked, setAcked] = useState(readAck);
  const ack = useCallback(() => {
    try {
      window.localStorage.setItem(ACK_KEY, "1");
    } catch {
      // Not stored: it is asked again next time, which is the safe direction.
    }
    setAcked(true);
  }, []);
  return [acked, ack];
}

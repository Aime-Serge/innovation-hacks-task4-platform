import type { Metadata } from "next";
import { cookies } from "next/headers";
import { WelcomePage } from "@/features/welcome/WelcomePage";
import { sessionMarkerName } from "@/lib/session/marker";

export const metadata: Metadata = { title: { absolute: "Welcome · DevDash" } };

export default async function Page() {
  // Only the wording of the buttons depends on it; the dashboard checks the session itself.
  const signedIn = (await cookies()).has(sessionMarkerName());
  return <WelcomePage signedIn={signedIn} />;
}

import { redirect } from "next/navigation";

// Root → always send to /chat (layout handles auth state display)
export default function RootPage() {
  redirect("/chat");
}

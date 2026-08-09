import type { Metadata } from "next";
import { SavedClient } from "@/components/saved/saved-client";

export const metadata: Metadata = {
  title: "Saved dorms",
  description: "Dorms you saved in this browser.",
};

export default function SavedPage() {
  return (
    <div className="site-container py-10 md:py-14">
      <h1 className="font-display text-3xl tracking-tight md:text-4xl">Saved dorms</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Guest favorites stay in your browser on this device.
      </p>
      <div className="mt-8">
        <SavedClient />
      </div>
    </div>
  );
}

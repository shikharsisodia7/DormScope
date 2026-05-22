import { SavedClient } from "@/components/saved/saved-client";

export default function SavedPage() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-2">Saved dorms</h1>
      <p className="text-muted-foreground mb-8">Guest favorites stored in your browser. Sign in with Clerk for cloud sync (optional).</p>
      <SavedClient />
    </div>
  );
}

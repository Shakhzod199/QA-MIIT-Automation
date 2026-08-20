import { redirect } from "next/navigation";

// The app's landing page is the Dashboard. The suite overview that used to live
// here now has its own route at /test-cases — see components/SidebarNav.tsx,
// where "Dashboard" points at /trends and "All test cases" at /test-cases.
//
// Kept as a redirect rather than moving the Dashboard here so /trends stays the
// canonical Dashboard URL: existing links, bookmarks and the middleware's
// insufficient-role fallback all keep working, and the Dashboard view is not
// duplicated across two routes.
export default function RootPage() {
  redirect("/trends");
}

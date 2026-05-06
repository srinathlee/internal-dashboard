import { redirect } from "next/navigation";

/**
 * /sales has no own view — each tab now lives at its own route. We forward
 * to Leads (the first tab) so any bookmarked /sales link still lands
 * somewhere meaningful.
 */
export default function SalesIndexPage() {
  redirect("/sales/leads");
}

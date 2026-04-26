import { redirect } from "next/navigation";
import { getSiteData, isAdmin } from "@/lib/site-store";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const data = await getSiteData();
  return <AdminClient initialData={data} />;
}

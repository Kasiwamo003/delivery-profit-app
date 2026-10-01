window.APP_CONFIG = {
  SUPABASE_URL: "https://iuevkrvscjefecyicguj.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1ZXZrcnZzY2plZmVjeWljZ3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDgxODEsImV4cCI6MjEwNTgyNDE4MX0.0CaNygioEVKt30cTxR4yD8SIc1lv0ZopeSMZq1zanzM"
};
function refreshProStatusAfterReturn() {
  if (typeof window.checkProStatus !== "function") return;

  window.checkProStatus();
  setTimeout(() => window.checkProStatus(), 1500);
  setTimeout(() => window.checkProStatus(), 4000);
}

window.addEventListener("pageshow", refreshProStatusAfterReturn);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshProStatusAfterReturn();
  }
});

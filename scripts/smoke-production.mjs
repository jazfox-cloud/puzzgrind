const checks = [["/", 200], ["/privacy", 200], ["/sudoku", 200], ["/api/health", 200], ["/api/health/db", 200], ["/robots.txt", 200], ["/sitemap.xml", 200]];
for (const [path, expected] of checks) {
  const response = await fetch(new URL(path, "https://puzzgrind.com"), { redirect: "manual" });
  if (response.status !== expected) throw new Error(`Production smoke failed: ${path} returned ${response.status}`);
  console.log(`Production smoke: ${path} -> ${response.status}`);
  await response.body?.cancel();
}

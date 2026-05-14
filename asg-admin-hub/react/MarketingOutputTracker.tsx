import { useCallback, useState } from "react";

/**
 * React variant of the marketing output tracker.
 * For Squarespace (no build): use `asg-admin-hub/components/marketing-output-tracker.html`
 * with the Apps Script web app — same UI contract as `stats` + `emails` from MarketingOutputGmail.gs.
 */

const GMAIL_MCP = {
  type: "url",
  url: "https://gmailmcp.googleapis.com/mcp/v1",
  name: "gmail-mcp",
};

// Priority-ordered — first match wins, checked against subject + snippet
const CATEGORIES = [
  {
    name: "Listing Assets",
    keywords: [
      "photos,",
      "photos for",
      "photos and",
      "photos &",
      "3d walkthrough",
      "3d walk",
      "walkthrough",
      "floor plan",
      "floorplan",
      "virtual staging",
      "virtually staged",
      "drone",
      "aerial",
      "matterport",
      "- photos",
      "rental photos",
    ],
    color: "#2563eb",
  },
  {
    name: "Agent Portraits",
    keywords: [
      "portrait",
      "headshot",
      "head shot",
      "team photo",
      "portraits are ready",
    ],
    color: "#9333ea",
  },
  {
    name: "Video",
    keywords: [
      "video",
      "episode",
      "elevating state",
      "youtube",
      "yt.mov",
      "reel",
      "reels",
      "walkthrough video",
      "property tour video",
      "testimonial video",
      "recap video",
      "final episode",
    ],
    color: "#dc2626",
  },
  {
    name: "Events",
    keywords: [
      "invitation",
      "invite",
      "rsvp",
      "booking",
      "booked",
      "book marketing",
      "calendar invite",
      "open house",
      "oh materials",
      "broker tour",
      "broker open",
      "event",
      "happy hour",
      "networking",
      "lunch and learn",
      "seminar",
      "workshop",
      "client appreciation",
      "housewarming",
      "photo shoot",
      "photoshoot",
      "shoot scheduled",
    ],
    color: "#ca8a04",
  },
  {
    name: "Design",
    keywords: [
      "mailer",
      "postcard",
      "flyer",
      "brochure",
      "business card",
      "biz card",
      "fact sheet",
      "factsheet",
      "brag book",
      "bragbook",
      "listing presentation",
      "listing pres",
      "buyer guide",
      "buyer's guide",
      "seller guide",
      "seller's guide",
      "graphic",
      "graphics",
      "design",
      "logo",
      "signage",
      "sign rider",
      "door hanger",
      "rack card",
      "newsletter design",
      "template",
      "social media post",
      "instagram post",
      "facebook post",
      "banner",
      "yard sign",
      "qr code",
      "qr",
      "white logo",
      "logo png",
      "oh sign",
      "open house sign",
    ],
    color: "#ea580c",
  },
  {
    name: "Marketing Collateral",
    keywords: [
      "just sold",
      "just listed",
      "just leased",
      "just closed",
      "coming soon",
      "price reduction",
      "price drop",
      "new listing",
      "new on market",
      "email blast",
      "e-blast",
      "market update",
      "market report",
      "cma",
      "comp analysis",
    ],
    color: "#16a34a",
  },
  {
    name: "Onboarding",
    keywords: [
      "seller questionnaire",
      "buyer questionnaire",
      "questionnaire",
      "intake form",
      "onboarding",
      "welcome packet",
      "new agent",
      "converted to project",
    ],
    color: "#0d9488",
  },
  {
    name: "Operations",
    keywords: [
      "invoice",
      "payment",
      "receipt",
      "asana error",
      "hub",
      "bug fix",
      "login",
      "access issue",
      "password reset",
      "fwd:",
      "forwarded",
    ],
    color: "#64748b",
  },
];

function categorize(subject: string | undefined, snippet: string | undefined) {
  const text = ((subject || "") + " " + (snippet || "")).toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((k) => text.includes(k))) return cat.name;
  }
  return "Other";
}

function getCatColor(name: string) {
  return CATEGORIES.find((c) => c.name === name)?.color || "#334155";
}

function extractAddress(subject: string | undefined) {
  const match = (subject || "").match(
    /\d{2,5}\s+[NSEW]?\.?\s*[\w\s]+(?:Ave|St|Dr|Blvd|Rd|Ct|Ln|Way|Pl|Pkwy)[\w\s,#.]*?(?=\s*[-–—(]|$)/i,
  );
  return match ? match[0].trim() : null;
}

async function searchGmail(query: string, maxPages: number) {
  let allThreads: unknown[] = [];
  let pageToken: string | undefined;

  for (let i = 0; i < maxPages; i++) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: `You are a Gmail search assistant. Call the search_threads tool with query: ${query}\nSet pageSize to 50.${pageToken ? ` Set pageToken to "${pageToken}".` : ""} Do not modify the query.`,
          messages: [{ role: "user", content: "Execute the search." }],
          mcp_servers: [GMAIL_MCP],
        }),
      });

      const data = await response.json();
      const toolResults = data.content?.filter((b: { type: string }) => b.type === "mcp_tool_result");
      let gotResults = false;

      if (toolResults?.length) {
        for (const tr of toolResults) {
          const text = tr.content?.[0]?.text || "";
          try {
            const parsed = JSON.parse(text);
            if (parsed.threads) {
              allThreads = [...allThreads, ...parsed.threads];
              pageToken = parsed.nextPageToken;
              gotResults = true;
            }
          } catch {
            /* skip */
          }
        }
      }

      if (!gotResults || !pageToken) break;
    } catch (err) {
      console.error("Gmail search error:", err);
      break;
    }
  }

  return allThreads;
}

type ThreadMessage = {
  id: string;
  date: string;
  subject?: string;
  snippet?: string;
  sender?: string;
  labelIds?: string[];
  toRecipients?: string[];
  ccRecipients?: string[];
};

type Thread = { messages?: ThreadMessage[] };

type ProcessedEmail = {
  id: string;
  date: string;
  subject: string;
  snippet: string;
  sender?: string;
  recipients: string[];
  category: string;
  address: string | null;
};

function processThreads(threads: unknown[], senderFilter: string | null): ProcessedEmail[] {
  const results: ProcessedEmail[] = [];
  for (const thread of threads as Thread[]) {
    for (const msg of thread.messages || []) {
      const sender = (msg.sender || "").toLowerCase();
      if (senderFilter && !sender.includes(senderFilter.toLowerCase())) continue;
      if (!senderFilter && !(msg.labelIds || []).includes("SENT")) continue;

      const to = [...(msg.toRecipients || []), ...(msg.ccRecipients || [])].filter(
        (r) => r.toLowerCase() !== sender,
      );

      results.push({
        id: msg.id,
        date: msg.date,
        subject: msg.subject || "(no subject)",
        snippet: msg.snippet || "",
        sender: msg.sender,
        recipients: to,
        category: categorize(msg.subject, msg.snippet),
        address: extractAddress(msg.subject),
      });
    }
  }
  return results;
}

type Stats = {
  byCategory: Record<string, number>;
  byWeek: Record<string, number>;
  byMonth: Record<string, number>;
  byPerson: Record<string, number>;
  properties: string[];
  total: number;
};

function computeStats(emails: ProcessedEmail[]): Stats {
  const byCategory: Record<string, number> = {},
    byWeek: Record<string, number> = {},
    byMonth: Record<string, number> = {},
    byPerson: Record<string, number> = {};
  const properties = new Set<string>();

  for (const e of emails) {
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;

    const d = new Date(e.date);
    const ws = new Date(d);
    ws.setDate(d.getDate() - d.getDay());
    const weekKey = ws.toISOString().split("T")[0];
    byWeek[weekKey] = (byWeek[weekKey] || 0) + 1;

    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth[mk] = (byMonth[mk] || 0) + 1;

    const person = (e.sender || "").split("@")[0];
    byPerson[person] = (byPerson[person] || 0) + 1;

    if (e.address) properties.add(e.address);
  }

  return { byCategory, byWeek, byMonth, byPerson, properties: [...properties], total: emails.length };
}

const mot = {
  shell: {
    minHeight: "100vh" as const,
    background: "linear-gradient(180deg, #f8f8f8 0%, #f1f1f1 100%)",
    color: "#111111",
    fontFamily: '"Outfit", system-ui, -apple-system, sans-serif',
    padding: "28px 22px",
    border: "1px solid rgba(17, 17, 17, 0.12)",
    borderRadius: 28,
    boxSizing: "border-box" as const,
    width: "100%",
  },
  kicker: {
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.2em",
    color: "#666666",
    marginBottom: 8,
    fontWeight: 700,
  },
  title: {
    fontSize: "clamp(24px, 4vw, 32px)",
    fontWeight: 800,
    color: "#111111",
    margin: 0,
    letterSpacing: "-0.03em",
    lineHeight: 1.05,
  },
  titleRule: {
    width: 40,
    height: 3,
    background: "#111111",
    marginTop: 12,
    borderRadius: 999,
  },
  pillRow: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  pillGroup: {
    display: "inline-flex",
    gap: 4,
    background: "#ececec",
    borderRadius: 999,
    padding: 4,
    flexWrap: "wrap" as const,
  },
  pill: (active: boolean) =>
    ({
      padding: "8px 14px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      border: "none",
      background: active ? "#111111" : "transparent",
      color: active ? "#ffffff" : "#444444",
      boxShadow: active ? "0 4px 12px rgba(0, 0, 0, 0.16)" : "none",
      transition: "all 0.2s ease",
      fontFamily: "inherit",
    }) as const,
  primaryBtn: (disabled: boolean) =>
    ({
      padding: "10px 18px",
      borderRadius: 999,
      border: "1px solid #111111",
      background: disabled ? "#e5e5e5" : "#111111",
      color: disabled ? "#888888" : "#ffffff",
      fontSize: 12,
      fontWeight: 700,
      fontFamily: "inherit",
      cursor: disabled ? "not-allowed" : "pointer",
      marginLeft: "auto",
      transition: "transform 0.16s ease, box-shadow 0.16s ease",
    }) as const,
  progressWrap: { marginBottom: 20 },
  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 600,
    color: "#444444",
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    background: "rgba(17, 17, 17, 0.08)",
    overflow: "hidden" as const,
  },
  progressFill: {
    height: "100%",
    background: "#111111",
    borderRadius: 999,
    transition: "width 0.4s ease",
  },
  errorBanner: {
    padding: "12px 16px",
    background: "rgba(254, 226, 226, 0.6)",
    border: "1px solid rgba(220, 38, 38, 0.25)",
    borderRadius: 14,
    fontSize: 13,
    color: "#991b1b",
    marginBottom: 20,
    fontWeight: 600,
  },
  kpiRow: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap" as const,
  },
  kpi: {
    background: "#ffffff",
    border: "1px solid rgba(17, 17, 17, 0.12)",
    borderRadius: 20,
    padding: "16px 18px",
    flex: 1,
    minWidth: 140,
    boxShadow: "0 8px 20px rgba(17, 17, 17, 0.06)",
  },
  kpiLabel: {
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "#666666",
    marginBottom: 8,
    fontWeight: 700,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 800,
    color: "#111111",
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },
  kpiSub: {
    fontSize: 12,
    color: "#666666",
    marginTop: 6,
    fontWeight: 600,
  },
  tabsWrap: {
    display: "inline-flex",
    gap: 4,
    background: "#f0f0f0",
    border: "1px solid rgba(17, 17, 17, 0.12)",
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  tab: (active: boolean) =>
    ({
      padding: "8px 14px",
      background: active ? "#111111" : "transparent",
      color: active ? "#ffffff" : "#444444",
      border: "none",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      fontFamily: "inherit",
      cursor: "pointer",
      boxShadow: active ? "0 4px 10px rgba(0, 0, 0, 0.14)" : "none",
    }) as const,
  panel: {
    flex: 1,
    minWidth: 280,
    background: "#ffffff",
    border: "1px solid rgba(17, 17, 17, 0.12)",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 8px 20px rgba(17, 17, 17, 0.06)",
  },
  panelTitle: {
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "#666666",
    marginBottom: 16,
    fontWeight: 700,
  },
  empty: {
    textAlign: "center" as const,
    padding: "64px 0",
    color: "#999999",
  },
  feedRow: {
    display: "flex",
    gap: 14,
    padding: "14px 0",
    borderBottom: "1px solid rgba(17, 17, 17, 0.08)",
    alignItems: "flex-start" as const,
  },
  feedDate: {
    fontSize: 11,
    color: "#666666",
    fontWeight: 700,
    minWidth: 72,
    paddingTop: 3,
  },
  feedChip: (color: string) =>
    ({
      fontSize: 10,
      padding: "3px 10px",
      borderRadius: 999,
      background: `${color}18`,
      color,
      fontWeight: 700,
      whiteSpace: "nowrap" as const,
      minWidth: 108,
      textAlign: "center" as const,
    }) as const,
  feedBody: { flex: 1 },
  feedSubject: { fontSize: 14, color: "#111111", marginBottom: 4, fontWeight: 600 },
  feedMeta: { fontSize: 12, color: "#666666", fontWeight: 600 },
};

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <span style={{ color: "#666666" }}>{label}</span>
        <span style={{ color: "#111111", fontWeight: 800 }}>{value}</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "rgba(17, 17, 17, 0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 999,
            background: color,
            transition: "width 0.6s ease",
          }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={mot.kpi}>
      <div style={mot.kpiLabel}>{label}</div>
      <div style={mot.kpiValue}>{value}</div>
      {sub && <div style={mot.kpiSub}>{sub}</div>}
    </div>
  );
}

/**
 * Marketing output tracker: Gmail → categorization + stats.
 * Wire `fetch` to your Anthropic proxy or add `Authorization` / `anthropic-dangerous-direct-browser-access` as required by your deployment.
 */
export default function MarketingOutputTracker() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [emails, setEmails] = useState<ProcessedEmail[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState(30);
  const [view, setView] = useState<"overview" | "by person" | "feed">("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setProgress(0);
    setEmails([]);
    setStats(null);

    try {
      const isAllTime = days === 0;
      const timeFilter = isAllTime ? "" : ` newer_than:${days}d`;
      const maxPages = isAllTime ? 12 : days > 60 ? 6 : 3;

      setStatus("Scanning Tim's sent emails...");
      setProgress(10);
      const timThreads = await searchGmail(`in:sent${timeFilter}`, maxPages);
      const timEmails = processThreads(timThreads, null);
      setProgress(50);

      setStatus("Scanning Ellie's emails...");
      const ellieThreads = await searchGmail(
        `from:ellie.ngassa@compass.com${timeFilter}`,
        Math.max(2, maxPages - 2),
      );
      const ellieEmails = processThreads(ellieThreads, "ellie.ngassa");
      setProgress(85);

      setStatus("Categorizing...");
      const all = [...timEmails, ...ellieEmails];
      const seen = new Set<string>();
      const deduped = all.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      deduped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setEmails(deduped);
      setStats(computeStats(deduped));
      setProgress(100);
      setStatus("");
    } catch (err: unknown) {
      setStatus("Error: " + (err instanceof Error ? err.message : String(err)));
    }
    setLoading(false);
  }, [days]);

  const maxCat = stats ? Math.max(...Object.values(stats.byCategory), 1) : 1;
  const maxPerson = stats ? Math.max(...Object.values(stats.byPerson), 1) : 1;
  const useMonthly = stats && Object.keys(stats.byWeek).length > 12;
  const timeData = useMonthly ? stats?.byMonth : stats?.byWeek;
  const maxTime = timeData ? Math.max(...Object.values(timeData), 1) : 1;
  const rangeLabel = days === 0 ? "All Time" : `Last ${days} days`;

  const TIME_OPTIONS = [
    { label: "7d", value: 7 },
    { label: "14d", value: 14 },
    { label: "30d", value: 30 },
    { label: "60d", value: 60 },
    { label: "90d", value: 90 },
    { label: "All Time", value: 0 },
  ];

  return (
    <div id="asg-mot-output-tracker" style={mot.shell}>
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <div style={{ marginBottom: 28 }}>
        <div style={mot.kicker}>ASG Marketing</div>
        <h1 style={mot.title}>Output Tracker</h1>
        <div style={mot.titleRule} />
      </div>

      <div style={mot.pillRow}>
        <div style={mot.pillGroup}>
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDays(opt.value)}
              style={mot.pill(days === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={fetchData} disabled={loading} style={mot.primaryBtn(loading)}>
          {loading ? "Scanning…" : "Scan Gmail"}
        </button>
      </div>

      {loading && (
        <div style={mot.progressWrap}>
          <div style={mot.progressMeta}>
            <span>{status}</span>
            <span style={{ color: "#999999" }}>{progress}%</span>
          </div>
          <div style={mot.progressTrack}>
            <div style={{ ...mot.progressFill, width: `${progress}%` }} />
          </div>
        </div>
      )}

      {!loading && status && <div style={mot.errorBanner}>{status}</div>}

      {stats && (
        <>
          <div style={mot.kpiRow}>
            <StatCard label="Total Emails" value={stats.total} sub={rangeLabel} />
            <StatCard label="Properties" value={stats.properties.length} sub="Unique addresses" />
            <StatCard
              label="Categories"
              value={Object.keys(stats.byCategory).filter((c) => c !== "Other").length}
              sub="Content types"
            />
            <StatCard
              label="Avg / Week"
              value={
                Object.keys(stats.byWeek).length > 0
                  ? Math.round(stats.total / Object.keys(stats.byWeek).length)
                  : 0
              }
              sub="Emails per week"
            />
          </div>

          <div style={mot.tabsWrap}>
            {(["overview", "by person", "feed"] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setView(tab)} style={mot.tab(view === tab)}>
                {tab}
              </button>
            ))}
          </div>

          {view === "overview" && (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={mot.panel}>
                <div style={mot.panelTitle}>By Category</div>
                {Object.entries(stats.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <Bar key={cat} label={cat} value={count} max={maxCat} color={getCatColor(cat)} />
                  ))}
              </div>
              <div style={mot.panel}>
                <div style={mot.panelTitle}>{useMonthly ? "Monthly Volume" : "Weekly Volume"}</div>
                {Object.entries(timeData || {})
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .slice(0, 20)
                  .map(([key, count]) => {
                    const d = new Date(key + (useMonthly ? "-01" : ""));
                    const label = useMonthly
                      ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
                      : `Wk of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
                    return <Bar key={key} label={label} value={count} max={maxTime} color="#0d9488" />;
                  })}
              </div>
            </div>
          )}

          {view === "by person" && (
            <div style={{ ...mot.panel, maxWidth: 520 }}>
              <div style={mot.panelTitle}>Output by Person</div>
              {Object.entries(stats.byPerson)
                .sort((a, b) => b[1] - a[1])
                .map(([person, count], i) => (
                  <Bar
                    key={person}
                    label={person.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    value={count}
                    max={maxPerson}
                    color={["#2563eb", "#9333ea", "#16a34a", "#ea580c"][i % 4]}
                  />
                ))}
            </div>
          )}

          {view === "feed" && (
            <div style={{ ...mot.panel, padding: "12px 20px 8px" }}>
              {emails.slice(0, 80).map((e) => {
                const d = new Date(e.date);
                const color = getCatColor(e.category);
                return (
                  <div key={e.id} style={mot.feedRow}>
                    <div style={mot.feedDate}>
                      {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div style={mot.feedChip(color)}>{e.category}</div>
                    <div style={mot.feedBody}>
                      <div style={mot.feedSubject}>{e.subject}</div>
                      <div style={mot.feedMeta}>
                        {(e.sender || "").split("@")[0]} →{" "}
                        {e.recipients
                          .slice(0, 3)
                          .map((r) => r.split("@")[0])
                          .join(", ")}
                        {e.recipients.length > 3 && ` +${e.recipients.length - 3}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {!stats && !loading && (
        <div style={mot.empty}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.35 }}>◈</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#666666" }}>
            Select a time range and tap Scan Gmail
          </div>
        </div>
      )}
    </div>
  );
}

export { CATEGORIES, categorize, computeStats, extractAddress, getCatColor, processThreads, searchGmail };

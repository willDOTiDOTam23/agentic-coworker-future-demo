import React, { startTransition, useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ArtifactRecord, ConfigurationDetail, ConfigurationListItem } from "../../lib/domain.js";
import { derivePalette } from "../shared/palette.js";
import { getArtifacts, getConfiguration, getConfigurations, resetDemo } from "../shared/api.js";
import "../shared/styles.css";

interface OpsEvent {
  type: string;
  sessionId?: string;
  agentName?: string;
  detail?: string;
  status?: string;
  timestamp: string;
}

function groupArtifacts(items: ArtifactRecord[]) {
  return items.reduce<Record<string, ArtifactRecord[]>>((groups, artifact) => {
    groups[artifact.templateType] = [...(groups[artifact.templateType] ?? []), artifact];
    return groups;
  }, {});
}

function App() {
  const [sessions, setSessions] = useState<ConfigurationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConfigurationDetail | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const refreshSessions = useEffectEvent(async () => {
    const next = await getConfigurations();
    startTransition(() => {
      setSessions(next.items);
      if (!selectedId && next.items[0]) {
        setSelectedId(next.items[0].id);
      }
      if (selectedId && !next.items.find((item) => item.id === selectedId)) {
        setSelectedId(next.items[0]?.id ?? null);
      }
    });
  });

  const refreshDetail = useEffectEvent(async (sessionId: string) => {
    const [nextDetail, nextArtifacts] = await Promise.all([getConfiguration(sessionId), getArtifacts(sessionId)]);
    startTransition(() => {
      setDetail(nextDetail);
      setArtifacts(nextArtifacts.items);
    });
  });

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!selectedId) return;
    void refreshDetail(selectedId);
  }, [refreshDetail, selectedId]);

  useEffect(() => {
    const source = new EventSource("/api/ops/stream");
    source.onmessage = (message) => {
      const payload = JSON.parse(message.data) as OpsEvent;
      if (payload.type === "connected") {
        return;
      }

      startTransition(() => {
        setEvents((current) => [payload, ...current].slice(0, 20));
      });

      void refreshSessions();
      if (payload.sessionId && payload.sessionId === selectedId) {
        void refreshDetail(payload.sessionId);
      }
    };

    return () => source.close();
  }, [refreshDetail, refreshSessions, selectedId]);

  const filteredSessions = sessions.filter((session) => {
    const searchValue = deferredSearch.trim().toLowerCase();
    if (!searchValue) return true;
    const haystack = JSON.stringify(session.state).toLowerCase();
    return session.id.toLowerCase().includes(searchValue) || haystack.includes(searchValue);
  });

  const palette = derivePalette(detail?.session);
  const groupedArtifacts = groupArtifacts(artifacts);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", palette.accent);
    root.style.setProperty("--accent-alt", palette.accentAlt);
    root.style.setProperty("--bg-a", palette.backgroundA);
    root.style.setProperty("--bg-b", palette.backgroundB);
    root.style.setProperty("--body", palette.bodyColor);
    root.style.setProperty("--cabin", palette.cabinColor);
    root.style.setProperty("--ink", palette.ink);
  }, [palette]);

  return (
    <div className="shell">
      <div className="frame">
        <div className="nav">
          <div className="brand">
            <span className="brand-mark" />
            <div>
              <div className="brand-eyebrow">Part 2 · Agent ops</div>
              <div className="brand-name">Northstar Vans Ops Theater</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="nav-link" onClick={() => void resetDemo()}>
              Reset demo
            </button>
            <a className="nav-link" href="/customer.html">
              Customer site
            </a>
          </div>
        </div>

        <div className="ops-grid">
          <div className="panel session-rail">
            <h2 className="panel-title">Live sessions</h2>
            <input
              className="status-strip"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sessions"
            />
            <div className="session-list">
              {filteredSessions.length ? (
                filteredSessions.map((session) => (
                  <button
                    key={session.id}
                    className={`session-card ${session.id === selectedId ? "active" : ""}`.trim()}
                    onClick={() => setSelectedId(session.id)}
                  >
                    <div className="session-meta">
                      <span>{session.status}</span>
                      <span>{session.artifactCount} artifacts</span>
                    </div>
                    <h3 className="session-title">{session.id.slice(0, 8)}</h3>
                    <p className="session-summary">
                      Step {session.currentStep} · {session.theme.paletteChoice} · {session.theme.visualTone}
                    </p>
                  </button>
                ))
              ) : (
                <div className="ops-empty">No configurations yet. Start a voice build in the customer site.</div>
              )}
            </div>
          </div>

          <div className="panel ops-detail">
            <h2 className="panel-title">Session detail</h2>
            {detail ? (
              <div className="detail-grid">
                <div className="detail-columns">
                  <div className="detail-stat">
                    <div className="detail-stat-label">Status</div>
                    <div className="detail-stat-value">{detail.session.status}</div>
                  </div>
                  <div className="detail-stat">
                    <div className="detail-stat-label">Current step</div>
                    <div className="detail-stat-value">{detail.session.currentStep}</div>
                  </div>
                  <div className="detail-stat">
                    <div className="detail-stat-label">Monitor confidence</div>
                    <div className="detail-stat-value">
                      {detail.session.latestConfidence !== null
                        ? `${Math.round(detail.session.latestConfidence * 100)}%`
                        : "TBD"}
                    </div>
                  </div>
                </div>

                <div className="status-strip">
                  <span className="activity-label">Configuration snapshot</span>
                  <div className="activity-copy">
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(detail.session.state, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="status-strip">
                  <span className="activity-label">Recent customer signals</span>
                  <div className="activity-copy">
                    {detail.turns.length ? (
                      detail.turns.slice(0, 6).map((turn) => (
                        <p key={turn.id} style={{ marginTop: 0 }}>
                          <strong>{turn.speaker}:</strong> {turn.text}
                        </p>
                      ))
                    ) : (
                      "Waiting for the first captured step summary."
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="ops-empty">Select a configuration to inspect its state and activity.</div>
            )}
          </div>

          <div className="panel ops-activity">
            <h2 className="panel-title">Agent activity</h2>
            <div className="thought-stream">
              {events.length ? (
                events.map((event, index) => (
                  <div key={`${event.timestamp}-${index}`} className="thought-bubble">
                    <div className="thought-meta">
                      <span>{event.agentName ?? "System"}</span>
                      <span>{event.status ?? event.type}</span>
                    </div>
                    <div className="thought-copy">{event.detail ?? event.type}</div>
                  </div>
                ))
              ) : (
                <div className="ops-empty">Agent thought bubbles will appear here as runs stream over SSE.</div>
              )}
            </div>
          </div>

          <div className="panel ops-artifacts">
            <h2 className="panel-title">Artifacts</h2>
            <div className="artifact-stack">
              {Object.keys(groupedArtifacts).length ? (
                Object.entries(groupedArtifacts).map(([templateType, items]) => (
                  <div key={templateType}>
                    <p className="hero-kicker" style={{ marginBottom: 10 }}>
                      {templateType}
                    </p>
                    {items.map((artifact, index) => (
                      <details className="artifact-card" open={index === 0} key={artifact.id}>
                        <summary>
                          {artifact.agentName} revision · {new Date(artifact.createdAt).toLocaleTimeString()}
                        </summary>
                        <div className="artifact-meta">{artifact.createdAt}</div>
                        <div
                          className="artifact-html"
                          dangerouslySetInnerHTML={{ __html: artifact.renderedContent }}
                        />
                      </details>
                    ))}
                  </div>
                ))
              ) : (
                <div className="ops-empty">Artifacts will appear here as the agents complete planning work.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


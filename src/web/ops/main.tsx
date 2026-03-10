import React, { startTransition, useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";
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
  metadata?: Record<string, unknown>;
}

type RightRailTab = "activity" | "artifacts";

function groupArtifacts(items: ArtifactRecord[]) {
  return items.reduce<Record<string, ArtifactRecord[]>>((groups, artifact) => {
    groups[artifact.templateType] = [...(groups[artifact.templateType] ?? []), artifact];
    return groups;
  }, {});
}

function sortSessions(items: ConfigurationListItem[]) {
  return [...items].sort((left, right) => {
    const leftTimestamp = new Date(left.lastEventAt ?? left.updatedAt).getTime();
    const rightTimestamp = new Date(right.lastEventAt ?? right.updatedAt).getTime();
    return rightTimestamp - leftTimestamp;
  });
}

function upsertSessionItem(
  items: ConfigurationListItem[],
  session: ConfigurationDetail["session"] | ConfigurationListItem,
  options?: {
    artifactCount?: number;
    artifactCountDelta?: number;
    lastEventAt?: string | null;
  }
) {
  const current = items.find((item) => item.id === session.id);
  const nextArtifactCount = Math.max(
    0,
    options?.artifactCount ??
      ((current?.artifactCount ?? ("artifactCount" in session ? session.artifactCount : 0)) + (options?.artifactCountDelta ?? 0))
  );
  const nextItem: ConfigurationListItem = {
    ...(current ?? {
      artifactCount: 0,
      lastEventAt: null
    }),
    ...session,
    artifactCount: nextArtifactCount,
    lastEventAt: options?.lastEventAt ?? current?.lastEventAt ?? ("lastEventAt" in session ? session.lastEventAt : null)
  };

  return sortSessions([nextItem, ...items.filter((item) => item.id !== session.id)]);
}

function mergeArtifactRecord(items: ArtifactRecord[], artifact: ArtifactRecord) {
  return [artifact, ...items.filter((item) => item.id !== artifact.id)].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

function mapAgentEventToOpsEvent(event: ConfigurationDetail["agentEvents"][number]): OpsEvent {
  return {
    type: event.eventType,
    sessionId: event.sessionId,
    agentName: event.agentName,
    detail: event.displayText,
    status: event.status,
    timestamp: event.createdAt,
    metadata: event.details ?? undefined
  };
}

function mergeOpsEvents(historical: OpsEvent[], live: OpsEvent[]) {
  const seen = new Set<string>();
  return [...live, ...historical]
    .filter((event) => {
      const key = [
        event.timestamp,
        event.sessionId ?? "",
        event.agentName ?? "",
        event.status ?? "",
        event.detail ?? "",
        event.type
      ].join("|");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 30);
}

function App() {
  const [sessions, setSessions] = useState<ConfigurationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConfigurationDetail | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [search, setSearch] = useState("");
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>("activity");
  const selectedIdRef = useRef<string | null>(null);
  const sessionsRef = useRef<ConfigurationListItem[]>([]);
  const detailCacheRef = useRef(new Map<string, ConfigurationDetail>());
  const artifactCacheRef = useRef(new Map<string, ArtifactRecord[]>());
  const inflightDetailRef = useRef(new Map<string, Promise<void>>());
  const deferredSearch = useDeferredValue(search);

  const cacheSessionData = useEffectEvent((sessionId: string, nextDetail: ConfigurationDetail, nextArtifacts: ArtifactRecord[]) => {
    detailCacheRef.current.set(sessionId, nextDetail);
    artifactCacheRef.current.set(sessionId, nextArtifacts);
  });

  const applyCachedSelection = useEffectEvent((sessionId: string) => {
    const cachedDetail = detailCacheRef.current.get(sessionId) ?? null;
    const cachedArtifacts = artifactCacheRef.current.get(sessionId) ?? [];

    startTransition(() => {
      setDetail(cachedDetail);
      setArtifacts(cachedArtifacts);
    });
  });

  const loadSessionData = useEffectEvent(async (sessionId: string, options?: { force?: boolean }) => {
    applyCachedSelection(sessionId);
    const hasCachedDetail = detailCacheRef.current.has(sessionId);
    const hasCachedArtifacts = artifactCacheRef.current.has(sessionId);
    if (hasCachedDetail && hasCachedArtifacts && !options?.force) {
      return;
    }

    const existingRequest = inflightDetailRef.current.get(sessionId);
    if (existingRequest) {
      await existingRequest;
      return;
    }

    const request = Promise.all([getConfiguration(sessionId), getArtifacts(sessionId)])
      .then(([nextDetail, nextArtifacts]) => {
        cacheSessionData(sessionId, nextDetail, nextArtifacts.items);
        if (selectedIdRef.current === sessionId) {
          startTransition(() => {
            setDetail(nextDetail);
            setArtifacts(nextArtifacts.items);
          });
        }
      })
      .finally(() => {
        inflightDetailRef.current.delete(sessionId);
      });

    inflightDetailRef.current.set(sessionId, request);
    await request;
  });

  const patchCachedSession = useEffectEvent((sessionId: string, updater: (current: ConfigurationDetail) => ConfigurationDetail) => {
    const current = detailCacheRef.current.get(sessionId);
    if (!current) {
      return;
    }

    const next = updater(current);
    detailCacheRef.current.set(sessionId, next);
    if (selectedIdRef.current === sessionId) {
      startTransition(() => {
        setDetail(next);
      });
    }
  });

  const mergeSessionIntoList = useEffectEvent(
    (
      session: ConfigurationDetail["session"] | ConfigurationListItem,
      options?: {
        artifactCount?: number;
        artifactCountDelta?: number;
        lastEventAt?: string | null;
      }
    ) => {
      startTransition(() => {
        setSessions((current) => upsertSessionItem(current, session, options));
      });
    }
  );

  const mergeArtifactIntoCache = useEffectEvent((artifact: ArtifactRecord) => {
    const currentArtifacts = artifactCacheRef.current.get(artifact.sessionId) ?? [];
    const nextArtifacts = mergeArtifactRecord(currentArtifacts, artifact);
    artifactCacheRef.current.set(artifact.sessionId, nextArtifacts);
    if (selectedIdRef.current === artifact.sessionId) {
      startTransition(() => {
        setArtifacts(nextArtifacts);
      });
    }
  });

  const refreshSessions = useEffectEvent(async () => {
    const next = await getConfigurations();
    const preferredId =
      selectedIdRef.current && next.items.find((item) => item.id === selectedIdRef.current)
        ? selectedIdRef.current
        : next.items[0]?.id ?? null;

    startTransition(() => {
      setSessions(sortSessions(next.items));
      setSelectedId(preferredId);
    });

    next.items.slice(0, 3).forEach((item) => {
      void loadSessionData(item.id);
    });
  });

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!selectedId) {
      startTransition(() => {
        setDetail(null);
        setArtifacts([]);
      });
      return;
    }

    void loadSessionData(selectedId);
  }, [loadSessionData, selectedId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    const source = new EventSource("/api/ops/stream");
    source.onmessage = (message) => {
      const payload = JSON.parse(message.data) as OpsEvent;
      if (payload.type === "connected") {
        return;
      }

      if (payload.type === "session_updated") {
        const nextSession = payload.metadata?.session as ConfigurationDetail["session"] | undefined;
        if (nextSession) {
          mergeSessionIntoList(nextSession, { lastEventAt: payload.timestamp });
          patchCachedSession(nextSession.id, (current) => ({
            ...current,
            session: nextSession
          }));
          if (!selectedIdRef.current) {
            startTransition(() => {
              setSelectedId(nextSession.id);
            });
          }
        }
        return;
      }

      startTransition(() => {
        setEvents((current) => [payload, ...current].slice(0, 30));
      });

      if (payload.sessionId) {
        const matchingSession = sessionsRef.current.find((session) => session.id === payload.sessionId);
        if (matchingSession) {
          mergeSessionIntoList(matchingSession, {
            artifactCountDelta: payload.type === "artifact_ready" ? 1 : 0,
            lastEventAt: payload.timestamp
          });
        }

        const confidenceScore = payload.metadata?.confidenceScore;
        if (typeof confidenceScore === "number") {
          patchCachedSession(payload.sessionId, (current) => ({
            ...current,
            session: {
              ...current.session,
              latestConfidence: confidenceScore
            }
          }));
          const currentListSession = sessionsRef.current.find((session) => session.id === payload.sessionId);
          if (currentListSession) {
            mergeSessionIntoList(
              {
                ...currentListSession,
                latestConfidence: confidenceScore
              },
              { lastEventAt: payload.timestamp }
            );
          }
        }

        if (payload.type === "artifact_ready") {
          const artifact = payload.metadata?.artifact as ArtifactRecord | undefined;
          if (artifact) {
            mergeArtifactIntoCache(artifact);
          } else {
            void loadSessionData(payload.sessionId, { force: true });
          }
        }

        if (payload.sessionId === selectedIdRef.current && !detailCacheRef.current.has(payload.sessionId)) {
          void loadSessionData(payload.sessionId, { force: true });
        }
      }
    };

    return () => source.close();
  }, [loadSessionData, mergeArtifactIntoCache, mergeSessionIntoList, patchCachedSession]);

  const filteredSessions = sessions.filter((session) => {
    const searchValue = deferredSearch.trim().toLowerCase();
    if (!searchValue) return true;
    const haystack = JSON.stringify(session.state).toLowerCase();
    return session.id.toLowerCase().includes(searchValue) || haystack.includes(searchValue);
  });

  const palette = derivePalette(detail?.session, detail?.visualSpec);
  const groupedArtifacts = groupArtifacts(artifacts);
  const scopedEvents = mergeOpsEvents(
    (detail?.agentEvents ?? []).map(mapAgentEventToOpsEvent).filter((event) => !selectedId || event.sessionId === selectedId),
    events.filter((event) => !selectedId || !event.sessionId || event.sessionId === selectedId)
  );

  const handleReset = useEffectEvent(async () => {
    await resetDemo();
    detailCacheRef.current.clear();
    artifactCacheRef.current.clear();
    inflightDetailRef.current.clear();
    startTransition(() => {
      setSessions([]);
      setSelectedId(null);
      setDetail(null);
      setArtifacts([]);
      setEvents([]);
    });
    await refreshSessions();
  });

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
            <button className="nav-link" onClick={() => void handleReset()}>
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
                    onFocus={() => void loadSessionData(session.id)}
                    onMouseEnter={() => void loadSessionData(session.id)}
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

          <div className="panel ops-rail" data-testid="ops-right-rail">
            <div className="ops-rail-head">
              <h2 className="panel-title">{rightRailTab === "activity" ? "Agent activity" : "Artifacts"}</h2>
              <div className="ops-tab-list" role="tablist" aria-label="Ops right rail">
                <button
                  className={`ops-tab ${rightRailTab === "activity" ? "active" : ""}`.trim()}
                  role="tab"
                  aria-selected={rightRailTab === "activity"}
                  onClick={() => setRightRailTab("activity")}
                >
                  Activity
                </button>
                <button
                  className={`ops-tab ${rightRailTab === "artifacts" ? "active" : ""}`.trim()}
                  role="tab"
                  aria-selected={rightRailTab === "artifacts"}
                  onClick={() => setRightRailTab("artifacts")}
                >
                  Artifacts
                </button>
              </div>
            </div>

            <div className="ops-rail-body">
              {rightRailTab === "activity" ? (
                <div className="ops-scroll-panel">
                  <div className="thought-stream">
                    {scopedEvents.length ? (
                      scopedEvents.map((event, index) => (
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
              ) : (
                <div className="ops-scroll-panel">
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

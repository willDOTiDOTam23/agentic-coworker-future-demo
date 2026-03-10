import React, { useEffect, useEffectEvent, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ConfigurationSession, VisualizationSpec } from "../../lib/domain.js";
import { STEP_DEFINITIONS } from "../../lib/domain.js";
import { SaveConfigurationStepSchema } from "../../lib/schemas.js";
import { createRealtimeSession, getConfiguration, saveConfigurationStep, submitConfiguration } from "../shared/api.js";
import { derivePalette } from "../shared/palette.js";
import { VanAssembly } from "../shared/VanAssembly.js";
import { Waveform } from "../shared/Waveform.js";
import "../shared/styles.css";

type ConnectionState = "idle" | "connecting" | "connected" | "error";
type TranscriptEntry = {
  id: string;
  speaker: "customer" | "guide";
  text: string;
};

function emptyWaveform() {
  return new Array(24).fill(0.12);
}

function createWaveSampler(analyser: AnalyserNode, setValues: (values: number[]) => void) {
  const data = new Uint8Array(analyser.frequencyBinCount);
  let frame = 0;

  const tick = () => {
    analyser.getByteFrequencyData(data);
    const next = Array.from({ length: 24 }, (_, index) => {
      const bucketSize = Math.floor(data.length / 24);
      const start = index * bucketSize;
      const segment = data.slice(start, start + bucketSize);
      const average =
        segment.reduce((sum, value) => sum + value, 0) / Math.max(1, segment.length);
      return Math.max(0.1, average / 255);
    });
    setValues(next);
    frame = requestAnimationFrame(tick);
  };

  tick();
  return () => cancelAnimationFrame(frame);
}

function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [statusCopy, setStatusCopy] = useState("Ready when you are.");
  const [session, setSession] = useState<ConfigurationSession | null>(null);
  const [visualSpec, setVisualSpec] = useState<VisualizationSpec | null>(null);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [customerWave, setCustomerWave] = useState<number[]>(emptyWaveform());
  const [assistantWave, setAssistantWave] = useState<number[]>(emptyWaveform());

  const sessionIdRef = useRef<string | null>(null);
  const sessionStreamRef = useRef<EventSource | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localCleanupRef = useRef<(() => void) | null>(null);
  const remoteCleanupRef = useRef<(() => void) | null>(null);
  const currentAssistantTranscriptRef = useRef("");
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  const handledFunctionCallsRef = useRef<Set<string>>(new Set());
  const responseInFlightRef = useRef(false);

  const applySession = useEffectEvent((nextSession: ConfigurationSession) => {
    sessionIdRef.current = nextSession.id;
    setSession(nextSession);
  });

  const applyVisualSpec = useEffectEvent((nextVisualSpec: VisualizationSpec | null | undefined) => {
    if (nextVisualSpec) {
      setVisualSpec(nextVisualSpec);
    }
  });

  const subscribeToSessionStream = useEffectEvent((sessionId: string) => {
    sessionStreamRef.current?.close();
    const eventSource = new EventSource(`/api/configurations/${sessionId}/stream`);
    sessionStreamRef.current = eventSource;

    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        type: string;
        metadata?: { session?: ConfigurationSession; visualSpec?: VisualizationSpec };
      };

      if (payload.type === "session_updated") {
        if (payload.metadata?.session) {
          applySession(payload.metadata.session);
        }
      }

      if (payload.type === "visual_spec_updated") {
        applyVisualSpec(payload.metadata?.visualSpec);
      }
    };
  });

  const sendRealtimeEvent = useEffectEvent((payload: Record<string, unknown>) => {
    dataChannelRef.current?.send(JSON.stringify(payload));
  });

  const addTranscriptEntry = useEffectEvent((speaker: TranscriptEntry["speaker"], text: string) => {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }

    setTranscriptEntries((current) =>
      [
        ...current,
        {
          id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          speaker,
          text: normalized
        }
      ].slice(-3)
    );
  });

  const streamAssistantTranscript = useEffectEvent((delta: string) => {
    const nextText = `${currentAssistantTranscriptRef.current}${delta}`.trim();
    currentAssistantTranscriptRef.current = nextText;
    if (!nextText) {
      return;
    }

    const messageId = currentAssistantMessageIdRef.current ?? `guide-${Date.now()}`;
    currentAssistantMessageIdRef.current = messageId;

    setTranscriptEntries((current) => {
      const existingIndex = current.findIndex((entry) => entry.id === messageId);
      if (existingIndex === -1) {
        const nextEntries: TranscriptEntry[] = [...current, { id: messageId, speaker: "guide", text: nextText }];
        return nextEntries.slice(-3);
      }

      const next = [...current];
      next[existingIndex] = {
        ...next[existingIndex],
        text: nextText
      };
      return next.slice(-3);
    });
  });

  const finalizeAssistantTranscript = useEffectEvent(() => {
    currentAssistantTranscriptRef.current = "";
    currentAssistantMessageIdRef.current = null;
  });

  const requestModelResponse = useEffectEvent((response?: Record<string, unknown>) => {
    if (responseInFlightRef.current) {
      return false;
    }

    responseInFlightRef.current = true;
    if (response) {
      sendRealtimeEvent({
        type: "response.create",
        response
      });
      return true;
    }

    sendRealtimeEvent({ type: "response.create" });
    return true;
  });

  const handleFunctionCall = useEffectEvent(async (item: Record<string, unknown>) => {
    const callId = String(item.call_id ?? item.callId ?? item.id ?? "");
    const toolName = String(item.name ?? "");
    const rawArguments = String(item.arguments ?? "{}");
    const sessionId = sessionIdRef.current;

    if (!sessionId || !callId || !toolName || handledFunctionCallsRef.current.has(callId)) {
      return;
    }

    handledFunctionCallsRef.current.add(callId);
    let output: Record<string, unknown> = { ok: false };

    try {
      const parsedArguments = JSON.parse(rawArguments);

      if (toolName === "get_current_configuration") {
        const detail = await getConfiguration(sessionId);
        applySession(detail.session);
        applyVisualSpec(detail.visualSpec);
        output = {
          session: detail.session,
          visualSpec: detail.visualSpec
        };
      }

      if (toolName === "save_configuration_step") {
        const validated = SaveConfigurationStepSchema.parse({
          step: parsedArguments.step,
          values: parsedArguments.values,
          visualTone: parsedArguments.visualTone,
          paletteChoice: parsedArguments.paletteChoice,
          summary: parsedArguments.summary
        });
        const result = await saveConfigurationStep(sessionId, validated);
        applySession(result.session);
        applyVisualSpec(result.visualSpec);
        output = {
          ok: true,
          currentStep: result.session.currentStep,
          status: result.session.status
        };
        setStatusCopy(`Saved ${validated.step}.`);
      }

      if (toolName === "submit_configuration") {
        const result = await submitConfiguration(sessionId);
        applySession(result.session);
        applyVisualSpec(result.visualSpec);
        output = {
          ok: true,
          status: result.session.status
        };
        setStatusCopy("Build sent to ops.");
      }
    } catch (error) {
      output = {
        ok: false,
        error: error instanceof Error ? error.message : "Tool execution failed."
      };
      setStatusCopy(output.error as string);
    }

    sendRealtimeEvent({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output),
        status: "completed"
      }
    });
    requestModelResponse();
  });

  const handleRealtimeMessage = useEffectEvent(async (event: MessageEvent<string>) => {
    const payload = JSON.parse(event.data) as Record<string, unknown>;

    if (payload.type === "response.created") {
      responseInFlightRef.current = true;
      return;
    }

    if (payload.type === "response.output_audio_transcript.delta" || payload.type === "response.output_text.delta") {
      streamAssistantTranscript(String(payload.delta ?? ""));
      return;
    }

    if (payload.type === "response.done") {
      responseInFlightRef.current = false;
      const output = (payload.response as { output?: Array<Record<string, unknown>> } | undefined)?.output ?? [];
      const functionCall = output.find((item) => item.type === "function_call");
      if (functionCall) {
        await handleFunctionCall(functionCall);
        return;
      }

      finalizeAssistantTranscript();
      return;
    }

    if (payload.type === "conversation.item.input_audio_transcription.completed") {
      addTranscriptEntry("customer", String(payload.transcript ?? ""));
      return;
    }

    if (payload.type === "error") {
      const message = String((payload.error as { message?: string } | undefined)?.message ?? "Realtime error.");
      if (message.includes("active response in progress")) {
        setStatusCopy("Guide is finishing a thought.");
        return;
      }

      responseInFlightRef.current = false;
      setConnectionState("error");
      setStatusCopy(message);
    }
  });

  async function startVoiceBuild() {
    if (connectionState === "connecting" || connectionState === "connected") {
      return;
    }

    setConnectionState("connecting");
    setStatusCopy("Connecting voice...");
    setTranscriptEntries([]);
    setVisualSpec(null);
    sessionStreamRef.current?.close();
    handledFunctionCallsRef.current.clear();
    responseInFlightRef.current = false;
    finalizeAssistantTranscript();

    try {
      const realtime = await createRealtimeSession();
      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      const audioContext = new AudioContext();
      const localSource = audioContext.createMediaStreamSource(microphone);
      const localAnalyser = audioContext.createAnalyser();
      localAnalyser.fftSize = 128;
      localSource.connect(localAnalyser);
      localCleanupRef.current = createWaveSampler(localAnalyser, setCustomerWave);

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      microphone.getTracks().forEach((track) => peer.addTrack(track, microphone));

      const assistantAudio = new Audio();
      assistantAudio.autoplay = true;

      peer.ontrack = async (trackEvent) => {
        const remoteStream = trackEvent.streams[0];
        assistantAudio.srcObject = remoteStream;
        const remoteSource = audioContext.createMediaStreamSource(remoteStream);
        const remoteAnalyser = audioContext.createAnalyser();
        remoteAnalyser.fftSize = 128;
        remoteSource.connect(remoteAnalyser);
        remoteCleanupRef.current = createWaveSampler(remoteAnalyser, setAssistantWave);
        await assistantAudio.play().catch(() => undefined);
      };

      const channel = peer.createDataChannel("oai-events");
      dataChannelRef.current = channel;
      channel.addEventListener("message", handleRealtimeMessage);
      channel.addEventListener("open", () => {
        setConnectionState("connected");
        setStatusCopy("Voice guide is live.");
        requestModelResponse({
          instructions:
            "Greet the customer and begin step one with a single short question about the vision and use case."
        });
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${realtime.clientSecret}`,
          "Content-Type": "application/sdp"
        },
        body: offer.sdp ?? ""
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const answer = await response.text();
      await peer.setRemoteDescription({
        type: "answer",
        sdp: answer
      });

      sessionIdRef.current = realtime.sessionId;
      const detail = await getConfiguration(realtime.sessionId);
      applySession(detail.session);
      applyVisualSpec(detail.visualSpec);
      subscribeToSessionStream(realtime.sessionId);
    } catch (error) {
      setConnectionState("error");
      setStatusCopy(error instanceof Error ? error.message : "Unable to start the voice build.");
    }
  }

  useEffect(() => {
    return () => {
      localCleanupRef.current?.();
      remoteCleanupRef.current?.();
      sessionStreamRef.current?.close();
      peerRef.current?.close();
    };
  }, []);

  const palette = derivePalette(session, visualSpec);

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

  const currentStepNumber = Math.min(Math.max(session?.currentStep ?? 1, 1), STEP_DEFINITIONS.length);
  const currentStepLabel =
    session?.status === "submitted" ? "Submitted" : STEP_DEFINITIONS[currentStepNumber - 1]?.label ?? STEP_DEFINITIONS[0].label;

  return (
    <div className="shell">
      <div className="frame">
        <div className="customer-layout">
          <div className="page-header">
            <div className="page-header-copy">
              <div className="brand-eyebrow">Northstar Vans</div>
              <h1 className="page-title">Build by voice.</h1>
            </div>
            <a className="nav-link" href="/ops.html" target="_blank" rel="noreferrer">
              Open Ops Theater
            </a>
          </div>

          <div className="conversation-row">
            <div className="panel conversation-visual-panel">
              <Waveform customerValues={customerWave} guideValues={assistantWave} />
            </div>

            <div className="voice-action-panel">
              <button
                className="voice-cta"
                disabled={connectionState === "connecting" || connectionState === "connected"}
                onClick={startVoiceBuild}
              >
                {connectionState === "connected"
                  ? "Voice build live"
                  : connectionState === "error"
                    ? "Let's talk again"
                    : "Let's talk"}
              </button>

              <div className="voice-status-card">
                <span className={`voice-status-chip ${connectionState}`}>{connectionState}</span>
                <p className="voice-status-copy">{statusCopy}</p>
                <div className="voice-progress-copy">
                  <span>{session?.status === "submitted" ? "Build complete" : `Step ${currentStepNumber} of 5`}</span>
                  <strong>{currentStepLabel}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="panel transcript-panel">
            <div className="transcript-thread" aria-live="polite">
              {transcriptEntries.length === 0 ? (
                <div className="transcript-bubble guide empty">Conversation appears here.</div>
              ) : (
                transcriptEntries.map((entry) => (
                  <div key={entry.id} className={`transcript-bubble ${entry.speaker === "customer" ? "customer" : "guide"}`}>
                    {entry.text}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel build-panel">
            <div className="build-panel-head">
            <div>
                <h2 className="panel-title">Van configuration</h2>
                <div className="build-panel-meta">{session?.status === "submitted" ? "Sent to ops" : currentStepLabel}</div>
              </div>
            </div>
            <VanAssembly session={session} visualSpec={visualSpec} />
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

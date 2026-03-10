import React, { useEffect, useEffectEvent, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ConfigurationSession } from "../../lib/domain.js";
import { STEP_DEFINITIONS } from "../../lib/domain.js";
import { SaveConfigurationStepSchema } from "../../lib/schemas.js";
import { createRealtimeSession, getConfiguration, saveConfigurationStep, submitConfiguration } from "../shared/api.js";
import { derivePalette } from "../shared/palette.js";
import { VanAssembly } from "../shared/VanAssembly.js";
import { Waveform } from "../shared/Waveform.js";
import "../shared/styles.css";

type ConnectionState = "idle" | "connecting" | "connected" | "error";

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
  const [statusCopy, setStatusCopy] = useState("Tap the center button to start the voice build.");
  const [session, setSession] = useState<ConfigurationSession | null>(null);
  const [assistantTranscript, setAssistantTranscript] = useState("");
  const [customerTranscript, setCustomerTranscript] = useState("");
  const [customerWave, setCustomerWave] = useState<number[]>(emptyWaveform());
  const [assistantWave, setAssistantWave] = useState<number[]>(emptyWaveform());

  const sessionIdRef = useRef<string | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localCleanupRef = useRef<(() => void) | null>(null);
  const remoteCleanupRef = useRef<(() => void) | null>(null);
  const currentAssistantTranscriptRef = useRef("");
  const handledFunctionCallsRef = useRef<Set<string>>(new Set());
  const responseInFlightRef = useRef(false);

  const applySession = useEffectEvent((nextSession: ConfigurationSession) => {
    sessionIdRef.current = nextSession.id;
    setSession(nextSession);
  });

  const sendRealtimeEvent = useEffectEvent((payload: Record<string, unknown>) => {
    dataChannelRef.current?.send(JSON.stringify(payload));
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
        output = {
          session: detail.session
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
        output = {
          ok: true,
          currentStep: result.session.currentStep,
          status: result.session.status
        };
        setStatusCopy(`Captured ${validated.step}. Keeping the build moving.`);
      }

      if (toolName === "submit_configuration") {
        const result = await submitConfiguration(sessionId);
        applySession(result.session);
        output = {
          ok: true,
          status: result.session.status
        };
        setStatusCopy("Configuration submitted. Ops agents are picking it up.");
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
      currentAssistantTranscriptRef.current += String(payload.delta ?? "");
      setAssistantTranscript(currentAssistantTranscriptRef.current.trim());
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

      currentAssistantTranscriptRef.current = "";
      return;
    }

    if (payload.type === "conversation.item.input_audio_transcription.completed") {
      setCustomerTranscript(String(payload.transcript ?? ""));
      return;
    }

    if (payload.type === "error") {
      const message = String((payload.error as { message?: string } | undefined)?.message ?? "Realtime error.");
      if (message.includes("active response in progress")) {
        setStatusCopy("The guide is still finishing a thought. Waiting to continue cleanly.");
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
    setStatusCopy("Requesting the latest Realtime session and microphone access...");
    handledFunctionCallsRef.current.clear();
    responseInFlightRef.current = false;

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
        setStatusCopy("Connected. The guide is ready to talk.");
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
    } catch (error) {
      setConnectionState("error");
      setStatusCopy(error instanceof Error ? error.message : "Unable to start the voice build.");
    }
  }

  useEffect(() => {
    return () => {
      localCleanupRef.current?.();
      remoteCleanupRef.current?.();
      peerRef.current?.close();
    };
  }, []);

  const palette = derivePalette(session);

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
              <div className="brand-eyebrow">Voice-led configuration</div>
              <div className="brand-name">Northstar Vans</div>
            </div>
          </div>
          <a className="nav-link" href="/ops.html" target="_blank" rel="noreferrer">
            Open Ops Theater
          </a>
        </div>

        <div className="hero-grid">
          <div className="customer-stage">
            <div className="customer-card">
              <p className="hero-kicker">Part 1 · Realtime voice</p>
              <h1 className="hero-title">Build a van by talking to it.</h1>
              <p className="hero-copy">
                The UI gets out of the way. A single voice guide walks the customer through a five-step
                build and the van comes alive as the conversation sharpens.
              </p>
              <button
                className="voice-cta"
                disabled={connectionState === "connecting" || connectionState === "connected"}
                onClick={startVoiceBuild}
              >
                {connectionState === "connected"
                  ? "Voice build live"
                  : connectionState === "error"
                    ? "Restart voice build"
                    : "Start voice build"}
              </button>

              <div className="status-strip">
                <span className="activity-label">{connectionState}</span>
                <div className="activity-copy">{statusCopy}</div>
              </div>

              <div className="chip-row">
                {STEP_DEFINITIONS.map((step, index) => {
                  const currentStep = session?.currentStep ?? 0;
                  const isComplete = currentStep > index + 1 || session?.status === "submitted";
                  const isActive = currentStep === index + 1 && session?.status !== "submitted";
                  return (
                    <span
                      key={step.id}
                      className={`chip ${isComplete ? "complete" : ""} ${isActive ? "active" : ""}`.trim()}
                    >
                      {index + 1}. {step.label}
                    </span>
                  );
                })}
              </div>

              <div className="transcript-strip">
                <span className="activity-label">Live conversation</span>
                <div className="activity-copy">
                  <strong>Customer:</strong> {customerTranscript || "Waiting for the customer to speak."}
                </div>
                <div className="activity-copy">
                  <strong>Guide:</strong> {assistantTranscript || "The guide will speak once the Realtime session is open."}
                </div>
              </div>
            </div>
          </div>

          <div className="visual-column">
            <div className="panel">
              <h2 className="panel-title">Shared waveform</h2>
              <div className="waveform-grid">
                <Waveform customerValues={customerWave} guideValues={assistantWave} />
              </div>
            </div>

            <div className="panel">
              <h2 className="panel-title">Configuration build-up</h2>
              <VanAssembly session={session} />
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

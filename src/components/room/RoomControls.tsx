"use client";

import { useCallback, useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";

// Controls bar sits on a white background — use light-background styles
const activeBtnStyle: React.CSSProperties = {
  background: "#edf2f6",
  color: "#456071",
  border: "1.5px solid rgba(69,96,113,0.2)",
  borderRadius: 10,
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  outline: "none",
};

const mutedBtnStyle: React.CSSProperties = {
  background: "rgba(220,38,38,0.28)",
  color: "#ff6b6b",
  border: "2px solid rgba(220,38,38,0.55)",
  borderRadius: 10,
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  outline: "none",
};

const screenBtnStyle: React.CSSProperties = {
  background: "#edf2f6",
  color: "#456071",
  border: "1.5px solid rgba(69,96,113,0.2)",
  borderRadius: 10,
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  outline: "none",
};

const leaveBtnStyle: React.CSSProperties = {
  background: "rgba(220,38,38,0.28)",
  color: "#ff6b6b",
  border: "2px solid rgba(220,38,38,0.55)",
  borderRadius: 10,
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.15s",
  outline: "none",
};

export default function RoomControls({ onLeave }: { onLeave: () => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const room = useRoomContext();

  const screenEnabled = localParticipant?.isScreenShareEnabled ?? false;
  const connected = !!localParticipant;

  const [mediaError, setMediaError] = useState<string | null>(null);

  const isIPhone = typeof navigator !== "undefined" && /iPhone/i.test(navigator.userAgent || "");
  const canShareScreen =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    "getDisplayMedia" in navigator.mediaDevices &&
    !isIPhone;

  const toggleMic = useCallback(async () => {
    if (!localParticipant) return;
    setMediaError(null);
    try { await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled); }
    catch (err) { console.error("[RoomControls] toggleMic", err); setMediaError("Could not toggle microphone."); }
  }, [localParticipant, isMicrophoneEnabled]);

  const toggleCam = useCallback(async () => {
    if (!localParticipant) return;
    setMediaError(null);
    try {
      if (!isCameraEnabled && typeof navigator !== "undefined") {
        await navigator.mediaDevices.getUserMedia({ video: true });
      }
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) { console.error("[RoomControls] toggleCam", err); setMediaError("Could not toggle camera."); }
  }, [localParticipant, isCameraEnabled]);

  const toggleScreen = useCallback(async () => {
    if (!localParticipant || !canShareScreen) return;
    setMediaError(null);
    try { await localParticipant.setScreenShareEnabled(!screenEnabled); }
    catch (err) { console.error("[RoomControls] toggleScreen", err); setMediaError("Could not toggle screen share."); }
  }, [localParticipant, screenEnabled, canShareScreen]);

  const leaveRoom = useCallback(async () => {
    try { await room?.disconnect(true); }
    finally { onLeave(); }
  }, [room, onLeave]);

  const activeDot: React.CSSProperties = {
    width: 8, height: 8, borderRadius: "50%", background: "#456071", flexShrink: 0,
  };
  const mutedDot: React.CSSProperties = {
    width: 9, height: 9, borderRadius: "50%", background: "#ef4444", flexShrink: 0,
  };

  return (
    <div style={{ borderTop: "1px solid #e8eaed", background: "white", padding: "10px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={toggleMic} disabled={!connected}
          style={isMicrophoneEnabled ? activeBtnStyle : mutedBtnStyle}
          aria-label="Toggle microphone">
          <span style={isMicrophoneEnabled ? activeDot : mutedDot} />
          {isMicrophoneEnabled ? "Mic" : "Mic off"}
        </button>

        <button type="button" onClick={toggleCam} disabled={!connected}
          style={isCameraEnabled ? activeBtnStyle : mutedBtnStyle}
          aria-label="Toggle camera">
          <span style={isCameraEnabled ? activeDot : mutedDot} />
          {isCameraEnabled ? "Camera" : "Camera off"}
        </button>

        <button type="button" onClick={toggleScreen} disabled={!connected || !canShareScreen}
          style={screenBtnStyle}
          aria-label="Toggle screen share">
          {screenEnabled ? "Stop Sharing" : "Share Screen"}
        </button>

        <button type="button" onClick={leaveRoom}
          style={leaveBtnStyle}
          aria-label="Leave room">
          Leave Room
        </button>
      </div>

      {mediaError && (
        <p style={{ fontSize: 11, color: "#c4607a", textAlign: "center", margin: 0 }}>{mediaError}</p>
      )}
    </div>
  );
}

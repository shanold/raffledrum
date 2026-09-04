"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Trophy } from "lucide-react";

type DisplayState = {
  names: string[];
  ticketCount: number;
  spinning: boolean;
  winner: string | null;
  winnerNumber: number | null;
  message: string;
  celebrating: boolean;
  verified: boolean;
  qrCode: string;
  shareUrl: string;
  storedTickets: { name: string; number: number }[];
  updatedAt: number;
};
type Slip = {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  va: number;
  w: number;
  h: number;
  color: string;
};
const key = "raffle-drum-public-display";
const colors = ["#fff4b8", "#c8f3ff", "#ffd5e5", "#d9ffc8", "#eee0ff"];

export default function PublicDisplay() {
  const [display, setDisplay] = useState<DisplayState | null>(null);
  const [winnerOpen, setWinnerOpen] = useState(false);
  const [winningSlipFlying, setWinningSlipFlying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<DisplayState | null>(null);
  const slipsRef = useRef<Slip[]>([]);
  const namesSignatureRef = useRef("");
  const movingRef = useRef(false);
  const previousSpinRef = useRef(false);
  const angleRef = useRef(0),
    speedRef = useRef(0),
    winnerKeyRef = useRef("");
  const revealTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const receive = (next: DisplayState) => {
      liveRef.current = next;
      setDisplay(next);
    };
    try {
      const saved = localStorage.getItem(key);
      if (saved) receive(JSON.parse(saved));
    } catch {
      /* wait for organizer */
    }
    const storage = (event: StorageEvent) => {
      if (event.key === key && event.newValue)
        try {
          receive(JSON.parse(event.newValue));
        } catch {}
    };
    addEventListener("storage", storage);
    const channel =
      "BroadcastChannel" in window ? new BroadcastChannel(key) : null;
    if (channel) channel.onmessage = (event) => receive(event.data);
    return () => {
      removeEventListener("storage", storage);
      channel?.close();
    };
  }, []);

  useEffect(() => {
    const nextKey =
      display?.winner && display.winnerNumber !== null
        ? `${display.winner}:${display.winnerNumber}`
        : "";
    if (!nextKey) {
      winnerKeyRef.current = "";
      setWinningSlipFlying(false);
    }
    if (nextKey && nextKey !== winnerKeyRef.current) {
      winnerKeyRef.current = nextKey;
      setWinnerOpen(false);
      setWinningSlipFlying(true);
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = window.setTimeout(() => {
        setWinningSlipFlying(false);
        setWinnerOpen(true);
      }, 1900);
    }
  }, [display]);

  useEffect(
    () => () => {
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const names = display?.names ?? [];
    const signature = names.join("\u0000");
    if (signature === namesSignatureRef.current) return;
    namesSignatureRef.current = signature;
    slipsRef.current = names.map((name, i) => ({
      name,
      x: 320 + (Math.random() - 0.5) * 230,
      y: 215 + Math.random() * 125,
      vx: 0,
      vy: 0,
      a: (Math.random() - 0.5) * 0.7,
      va: 0,
      w: Math.min(108, Math.max(66, 34 + name.length * 7)),
      h: 28,
      color: colors[i % colors.length],
    }));
  }, [display]);

  useEffect(() => {
    const isSpinning = !!display?.spinning;
    if (isSpinning && !previousSpinRef.current) {
      for (const slip of slipsRef.current) {
        slip.vx += (Math.random() - 0.5) * 9;
        slip.vy -= 3 + Math.random() * 8;
        slip.va += (Math.random() - 0.5) * 0.38;
      }
      movingRef.current = true;
      speedRef.current = 0.075;
    }
    if (!isSpinning && previousSpinRef.current) {
      movingRef.current = false;
      speedRef.current = 0;
    }
    previousSpinRef.current = isSpinning;
  }, [display?.spinning]);

  useEffect(() => {
    const canvas = canvasRef.current,
      ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0;
    const render = () => {
      const state = liveRef.current,
        cx = 320,
        cy = 225,
        radius = 174;
      const tumbling =
        !!state?.spinning && !state.message.toLowerCase().includes("slowing");
      if (tumbling)
        speedRef.current = Math.min(0.13, speedRef.current + 0.0025);
      else speedRef.current *= 0.982;
      angleRef.current += speedRef.current;
      ctx.clearRect(0, 0, 640, 470);
      const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 205);
      glow.addColorStop(0, "#263b68");
      glow.addColorStop(1, "#081022");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
      ctx.fill();
      const rainbow = ctx.createConicGradient(angleRef.current, cx, cy);
      [
        "#ff4d6d",
        "#ff9f1c",
        "#ffe66d",
        "#4ee58b",
        "#46c7ff",
        "#8d65ff",
        "#ff4dba",
        "#ff4d6d",
      ].forEach((c, i) => rainbow.addColorStop(i / 7, c));
      ctx.strokeStyle = rainbow;
      ctx.lineWidth = 11;
      ctx.shadowColor = tumbling ? "#56d9ff" : "transparent";
      ctx.shadowBlur = tumbling ? 25 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
      for (const slip of slipsRef.current) {
        if (movingRef.current) {
          if (tumbling) {
            const dx = slip.x - cx,
              dy = slip.y - cy;
            slip.vx += -dy * 0.0035 + (Math.random() - 0.5) * 0.75;
            slip.vy += dx * 0.0035 + (Math.random() - 0.5) * 0.75;
            slip.va += (Math.random() - 0.5) * 0.035;
          }
          slip.vy += tumbling ? 0.105 : 0.19;
          const drag = tumbling ? 0.994 : 0.955;
          slip.vx *= drag;
          slip.vy *= drag;
          slip.va *= tumbling ? 0.985 : 0.93;
          slip.x += slip.vx;
          slip.y += slip.vy;
          slip.a += slip.va;
          const dx = slip.x - cx,
            dy = slip.y - cy,
            dist = Math.hypot(dx, dy),
            edge = radius - Math.max(slip.w, slip.h) * 0.48;
          if (dist > edge) {
            const nx = dx / dist,
              ny = dy / dist;
            slip.x = cx + nx * edge;
            slip.y = cy + ny * edge;
            const dot = slip.vx * nx + slip.vy * ny;
            if (dot > 0) {
              const bounce = tumbling ? 1.72 : 1.2;
              slip.vx -= bounce * dot * nx;
              slip.vy -= bounce * dot * ny;
            }
            if (tumbling) slip.va += (Math.random() - 0.5) * 0.15;
            else {
              slip.vx *= 0.76;
              slip.vy *= 0.6;
              slip.va *= 0.68;
            }
          }
        }
        const shown =
          slip.name.length > 15 ? `${slip.name.slice(0, 14)}…` : slip.name;
        ctx.save();
        ctx.translate(slip.x, slip.y);
        ctx.rotate(slip.a);
        ctx.fillStyle = slip.color;
        ctx.strokeStyle = "#18213a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-slip.w / 2, -slip.h / 2, slip.w, slip.h, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#17213a";
        ctx.font = "700 13px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(shown, 0, 1);
        ctx.restore();
      }
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = angleRef.current + (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28);
        ctx.lineTo(
          cx + Math.cos(a) * (radius - 5),
          cy + Math.sin(a) * (radius - 5),
        );
        ctx.stroke();
      }
      ctx.fillStyle = "#f8ba43";
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="display-shell">
      <div className="display-heading">
        <div>
          <p>PUBLIC RAFFLE DISPLAY</p>
          <h1>Raffle Drum</h1>
        </div>
        <div className="display-count">
          <strong>{(display?.ticketCount ?? 0).toLocaleString()}</strong>
          <span>tickets</span>
        </div>
      </div>
      <section className="display-stage">
        <canvas
          ref={canvasRef}
          width={640}
          height={470}
          aria-label="Public raffle drum"
        />
        <div className="display-stand">
          <i />
          <i />
        </div>
        <div className="display-status">
          <span className={display?.spinning ? "active" : ""} />
          {display?.message ?? "Waiting for the organizer…"}
        </div>
      </section>
      {display?.storedTickets?.length ? (
        <aside
          className="display-stored"
          aria-label="Removed and stored tickets"
        >
          <div className="display-stored-title">
            <strong>Drawn tickets</strong>
            <span>REMOVED &amp; STORED</span>
          </div>
          <ol>
            {display.storedTickets.map((ticket, index) => (
              <li key={`${ticket.number}-${index}`}>
                <b>#{ticket.number.toLocaleString()}</b>
                <span>{ticket.name}</span>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
      {display?.verified && display.qrCode && (
        <aside className="display-qr">
          <img
            src={display.qrCode}
            alt="QR code for public raffle verification"
          />
          <div>
            <strong>Verify this raffle</strong>
            <span>Scan for tickets and audit details</span>
          </div>
        </aside>
      )}
      {winningSlipFlying && display?.winner && (
        <div className="winning-slip-flight" aria-hidden="true">
          <span>{display.winner}</span>
          <b>#{display.winnerNumber?.toLocaleString()}</b>
        </div>
      )}
      {winnerOpen && display?.celebrating && (
        <div className="display-confetti" aria-hidden="true">
          <span className="display-pop-flash left" />
          <span className="display-pop-flash right" />
          {Array.from({ length: 220 }, (_, i) => {
            const left = i % 2 === 0,
              slot = Math.floor(i / 2),
              origin = left ? 8 : 92,
              targetX = 2 + ((slot * 47 + (left ? 7 : 19)) % 96),
              targetY = 2 + ((slot * 29) % 48),
              tx = targetX - origin,
              ty = targetY - 90,
              sway = left ? 1 : -1;
            return (
              <i
                key={i}
                className={
                  i % 5 === 0
                    ? "confetti-round"
                    : i % 7 === 0
                      ? "confetti-streamer"
                      : ""
                }
                style={
                  {
                    left: `${origin}%`,
                    top: "90%",
                    "--mx": `${tx * 0.36}vw`,
                    "--my": `${ty * 0.36}vh`,
                    "--tx": `${tx}vw`,
                    "--ty": `${ty}vh`,
                    "--s1x": `${tx + sway * (5 + (i % 7))}vw`,
                    "--s1y": `${ty + 18}vh`,
                    "--s2x": `${tx - sway * (5 + (i % 8))}vw`,
                    "--s2y": `${ty + 39}vh`,
                    "--s3x": `${tx + sway * (4 + (i % 6))}vw`,
                    "--s3y": `${ty + 62}vh`,
                    "--fx": `${tx - sway * (2 + (i % 4))}vw`,
                    "--spin": `${540 + (i % 8) * 115}deg`,
                    animationDelay: `${(i % 6) * 0.006}s`,
                    animationDuration: `${5.2 + (i % 9) * 0.11}s`,
                    backgroundColor: [
                      "#ff315f",
                      "#ffd21f",
                      "#00e39c",
                      "#31b8ff",
                      "#a95cff",
                      "#ff7417",
                    ][i % 6],
                  } as CSSProperties
                }
              />
            );
          })}
        </div>
      )}
      {winnerOpen && display?.winner && (
        <div className="display-modal" role="dialog" aria-modal="true">
          <div>
            <Trophy />
            <small>WINNER</small>
            <strong>{display.winner}</strong>
            <b>Ticket #{display.winnerNumber?.toLocaleString()}</b>
            <button onClick={() => setWinnerOpen(false)}>OK</button>
          </div>
        </div>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExternalLink, Search, ShieldCheck } from "lucide-react";
import { deterministicIndex, sha256Hex, ticketCommitment } from "@/lib/verified-raffle";

type PublicDraw = {
  sequence: number;
  ticketCount: number;
  manifestHash: string;
  publicManifestHash?: string | null;
  targetRound: number;
  drandRandomness: string;
  drandSignature: string;
  winnerMasked: string;
  winnerNumber: number;
  winnerIndex: number;
  drawnAt: string;
  removed: boolean;
};
type PublicRaffle = {
  id: string;
  status: "locked" | "drawn";
  ticketCount: number;
  manifestHash: string;
  targetRound: number;
  lockedAt: string;
  publicManifestHash?: string | null;
  auditVersion: number;
  draws: PublicDraw[];
};

function ticketNumberFromLedgerRow(row: string) {
  const match = row.match(/^(\d+),/);
  return match ? Number(match[1]) : null;
}

export default function VerifyRaffle() {
  const params = useParams<{ id: string }>(),
    id = String(params.id ?? "").toUpperCase();
  const [raffle, setRaffle] = useState<PublicRaffle | null>(null),
    [error, setError] = useState(""),
    [ticket, setTicket] = useState(""),
    [ticketResult, setTicketResult] = useState<
      { number: number; name: string; commitment?: string } | null | undefined
    >(undefined),
    [checking, setChecking] = useState(false),
    [ledgerStatus, setLedgerStatus] = useState<
      "checking" | "passed" | "failed" | "legacy"
    >("checking"),
    [receiptTicket, setReceiptTicket] = useState(""),
    [receiptName, setReceiptName] = useState(""),
    [receiptCode, setReceiptCode] = useState(""),
    [receiptResult, setReceiptResult] = useState<boolean | null>(null),
    [receiptChecking, setReceiptChecking] = useState(false),
    [mathStatus, setMathStatus] = useState<
      "checking" | "passed" | "failed" | "error"
    >("checking");
  const latest = raffle?.draws.at(-1);
  useEffect(() => {
    void fetch(`/api/verified/${encodeURIComponent(id)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Raffle not found.");
        setRaffle(data.raffle);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Raffle not found.",
        ),
      );
  }, [id]);
  useEffect(() => {
    if (!latest) return;
    setMathStatus("checking");
    if (raffle.auditVersion < 2 || !raffle.publicManifestHash) {
      setLedgerStatus("legacy");
      void deterministicIndex(
        latest.manifestHash,
        latest.targetRound,
        latest.drandRandomness,
        latest.ticketCount,
      )
        .then((index) =>
          setMathStatus(index === latest.winnerIndex ? "passed" : "failed"),
        )
        .catch(() => setMathStatus("error"));
      return;
    }
    setLedgerStatus("checking");
    void fetch(`/api/verified/${encodeURIComponent(id)}/manifest`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Public ledger is unavailable.");
        const ledger = await response.text();
        if ((await sha256Hex(ledger)) !== raffle.publicManifestHash)
          throw new Error("Public ledger fingerprint mismatch.");
        const lines = ledger.trimEnd().split("\n");
        const expectedHeader =
          raffle.auditVersion >= 4
            ? "Ticket,VerificationCode,Commitment"
            : raffle.auditVersion >= 3
            ? "Ticket,DisplayName,VerificationCode,Commitment"
            : "Ticket,DisplayName,Commitment";
        if (lines[0] !== expectedHeader)
          throw new Error("Public ledger format mismatch.");
        const originalRows = lines.slice(1);
        for (let drawIndex = 0; drawIndex < raffle.draws.length; drawIndex++) {
          const draw = raffle.draws[drawIndex];
          const removed = new Set(
            raffle.draws
              .slice(0, drawIndex)
              .filter((earlier) => earlier.removed)
              .map((earlier) => earlier.winnerNumber),
          );
          const rows = originalRows.filter((row) => {
            const number = ticketNumberFromLedgerRow(row);
            return number !== null && !removed.has(number);
          });
          const candidate = `${lines[0]}\n${rows.join("\n")}\n`;
          const candidateHash = await sha256Hex(candidate);
          if (candidateHash !== draw.manifestHash || rows.length !== draw.ticketCount)
            throw new Error("Draw ledger mismatch.");
          const index = await deterministicIndex(
            candidateHash,
            draw.targetRound,
            draw.drandRandomness,
            rows.length,
          );
          if (
            index !== draw.winnerIndex ||
            ticketNumberFromLedgerRow(rows[index]) !== draw.winnerNumber
          )
            throw new Error("Draw result mismatch.");
        }
        setLedgerStatus("passed");
        setMathStatus("passed");
      })
      .catch(() => {
        setLedgerStatus("failed");
        setMathStatus("failed");
      });
  }, [id, latest, raffle]);
  const checkTicket = async () => {
    setChecking(true);
    try {
      const response = await fetch(
          `/api/verified/${encodeURIComponent(id)}?ticket=${encodeURIComponent(ticket)}`,
        ),
        data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTicketResult(data.ticket ?? null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Ticket lookup failed.",
      );
    } finally {
      setChecking(false);
    }
  };
  const checkReceipt = async () => {
    setReceiptChecking(true);
    setReceiptResult(null);
    try {
      const number = Number(receiptTicket.replaceAll(",", ""));
      if (!Number.isSafeInteger(number) || number < 1)
        throw new Error("Enter a valid ticket number.");
      const response = await fetch(
          `/api/verified/${encodeURIComponent(id)}?ticket=${encodeURIComponent(String(number))}`,
        ),
        data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Ticket check failed.");
      if (!data.ticket?.commitment) {
        setReceiptResult(false);
        return;
      }
      const calculated = await ticketCommitment(
        { number, name: receiptName.trim() },
        receiptCode.trim(),
      );
      setReceiptResult(calculated === data.ticket.commitment);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ticket check failed.");
    } finally {
      setReceiptChecking(false);
    }
  };
  if (error)
    return (
      <main className="verify-shell">
        <section className="verify-card">
          <h1>Couldn&apos;t verify raffle</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  if (!raffle)
    return (
      <main className="verify-shell">
        <section className="verify-card">
          <p>Loading verified raffle…</p>
        </section>
      </main>
    );
  return (
    <main className="verify-shell">
      <section className="verify-card">
        <div className="verify-brand">
          <ShieldCheck />
          <div>
            <p>PUBLIC AUDIT</p>
            <h1>{raffle.id}</h1>
          </div>
        </div>
        <div
          className={
            raffle.status === "drawn" ? "public-status drawn" : "public-status"
          }
        >
          <span />
          {raffle.status === "drawn"
            ? "Drawing complete and reproducible"
            : "Ticket list locked"}
        </div>
        {latest ? (
          <>
            <div className="public-winner">
              <small>VERIFIED WINNER #{latest.sequence}</small>
              <strong>{latest.winnerMasked}</strong>
              <b>Ticket #{latest.winnerNumber.toLocaleString()}</b>
            </div>
            {raffle.draws.length > 1 && (
              <ol>
                {[...raffle.draws].reverse().map((draw) => (
                  <li key={draw.sequence}>
                    Draw {draw.sequence}: {draw.winnerMasked} — Ticket #
                    {draw.winnerNumber.toLocaleString()}
                    {draw.removed ? " (removed from later draws)" : ""}
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <div className="locked-message">
            <strong>The result is not known yet.</strong>
            <p>
              The app committed to public randomness round #
              {raffle.targetRound.toLocaleString()} before that value existed.
            </p>
          </div>
        )}
        <div className="public-facts">
          <div>
            <span>Original locked tickets</span>
            <strong>{raffle.ticketCount.toLocaleString()}</strong>
          </div>
          <div>
            <span>Locked at</span>
            <strong>{new Date(raffle.lockedAt).toLocaleString()}</strong>
          </div>
          <div className="wide">
            <span>Original list fingerprint</span>
            <code>{raffle.manifestHash}</code>
          </div>
          {raffle.publicManifestHash && (
            <div className="wide">
              <span>Public ticket-ledger fingerprint</span>
              <code>{raffle.publicManifestHash}</code>
            </div>
          )}
          {raffle.auditVersion >= 2 && (
            <div className="wide">
              <span>Public ledger check</span>
              <strong
                className={
                  ledgerStatus === "passed"
                    ? "pass"
                    : ledgerStatus === "failed"
                      ? "fail"
                      : ""
                }
              >
                {ledgerStatus === "passed"
                  ? "Passed — published tickets match the locked fingerprint"
                  : ledgerStatus === "failed"
                    ? "Failed — the published ledger or a draw does not match"
                    : "Checking published tickets…"}
              </strong>
            </div>
          )}
          {latest && (
            <>
              <div>
                <span>Latest beacon round</span>
                <strong>#{latest.targetRound.toLocaleString()}</strong>
              </div>
              <div>
                <span>Latest math check</span>
                <strong
                  className={
                    mathStatus === "passed"
                      ? "pass"
                      : mathStatus === "failed" || mathStatus === "error"
                        ? "fail"
                        : ""
                  }
                >
                  {mathStatus === "passed"
                    ? "Passed"
                    : mathStatus === "failed"
                      ? "Failed"
                      : mathStatus === "error"
                        ? "Could not check"
                        : "Checking…"}
                </strong>
              </div>
              <div className="wide">
                <span>Latest public randomness</span>
                <code>{latest.drandRandomness}</code>
              </div>
            </>
          )}
        </div>
        <section className="ticket-check">
          <h2>Check a ticket</h2>
          <p>
            Enter an exact ticket number. Names are partially masked for
            privacy.
          </p>
          <div>
            <input
              inputMode="numeric"
              value={ticket}
              onChange={(event) => setTicket(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void checkTicket();
              }}
              placeholder="45,583"
            />
            <button
              onClick={() => {
                void checkTicket();
              }}
              disabled={checking || !ticket.trim()}
            >
              <Search />
              {checking ? "Checking" : "Check"}
            </button>
          </div>
          {ticketResult === null && (
            <p className="ticket-miss">
              That ticket number is not in this locked raffle.
            </p>
          )}
          {ticketResult && (
            <p className="ticket-hit">
              <ShieldCheck />
              Ticket #{ticketResult.number.toLocaleString()} belongs to{" "}
              <strong>{ticketResult.name}</strong>
            </p>
          )}
        </section>
        {raffle.auditVersion >= 2 && raffle.publicManifestHash && (
          <section className="receipt-check">
            {raffle.auditVersion >= 3 && (
              <>
                <h2>Verify a name and ticket</h2>
                <p>
                  Copy the public verification code for this ticket from the
                  audit ledger below, then enter the exact full name and ticket
                  number. No organizer access is needed.
                </p>
                <div className="receipt-fields">
                  <label>
                    <span>Exact full name</span>
                    <input
                      value={receiptName}
                      onChange={(event) => setReceiptName(event.target.value)}
                      placeholder="Bob Smith"
                    />
                  </label>
                  <label>
                    <span>Ticket number</span>
                    <input
                      inputMode="numeric"
                      value={receiptTicket}
                      onChange={(event) => setReceiptTicket(event.target.value)}
                      placeholder="45,583"
                    />
                  </label>
                  <label className="receipt-code">
                    <span>Public verification code</span>
                    <input
                      value={receiptCode}
                      onChange={(event) => setReceiptCode(event.target.value)}
                      placeholder="AB12-CD34-EF56-7890-AB12-CD34"
                    />
                  </label>
                </div>
                <button
                  onClick={() => void checkReceipt()}
                  disabled={
                    receiptChecking ||
                    !receiptName.trim() ||
                    !receiptTicket.trim() ||
                    !receiptCode.trim()
                  }
                >
                  <ShieldCheck />
                  {receiptChecking ? "Verifying…" : "Verify ticket owner"}
                </button>
                {receiptResult === true && (
                  <p className="receipt-pass">
                    ✓ This exact name and ticket were frozen into the raffle
                    before the draw.
                  </p>
                )}
                {receiptResult === false && (
                  <p className="receipt-fail">
                    The name, ticket number, and public code do not match the
                    locked commitment.
                  </p>
                )}
              </>
            )}
            <h2>Independently audit this raffle</h2>
            <p>
              This page downloads the frozen public ticket ledger and checks
              its SHA-256 fingerprint, every draw&apos;s eligible ticket list,
              winner index, and winning ticket in your browser. No organizer
              password or private code is required.
            </p>
            <a
              className="manifest-download"
              href={`/api/verified/${encodeURIComponent(id)}/manifest`}
            >
              Download the public audit ledger
            </a>
            <small>
              The ledger contains ticket numbers, public verification codes,
              and commitments—never the organizer password or participant
              names.
            </small>
          </section>
        )}
        <a
          className="drand-link"
          href={`https://api.drand.sh/v2/beacons/quicknet/rounds/${latest?.targetRound ?? raffle.targetRound}`}
          target="_blank"
          rel="noreferrer"
        >
          View the independent public beacon record <ExternalLink />
        </a>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { Club, PlayerProfile } from "@/types/golf";
import { getProfile, saveProfile, resetProfile } from "@/lib/storage";
import { DISPERSION_DISCLAIMER } from "@/data/player-defaults";
import { Card, PageHeader, Screen } from "@/components/ui";

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        className="text-input mt-1 mono"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
          onChange(Number.isNaN(n) ? 0 : n);
        }}
      />
    </label>
  );
}

export default function MyGamePage() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(getProfile());
  }, []);

  if (!profile) {
    return (
      <Screen>
        <p className="muted pt-20 text-center">Loading…</p>
      </Screen>
    );
  }

  function update(next: PlayerProfile) {
    setProfile(next);
    saveProfile(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  function updateClub(id: string, patch: Partial<Club>) {
    if (!profile) return;
    update({ ...profile, clubs: profile.clubs.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  }

  const needsWork = profile.clubs.filter((c) => c.needsCalibration || c.planningDistance === 0);

  return (
    <Screen>
      <PageHeader
        eyebrow="My Game"
        title="Player Profile"
        right={saved ? <span className="badge badge-green">Saved</span> : undefined}
      />

      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow mb-1">Handicap</div>
            <div className="muted text-xs">Official handicap stays in TheGrint.</div>
          </div>
          <input
            className="text-input mono"
            style={{ width: 96, fontSize: 28, fontWeight: 800, textAlign: "center" }}
            inputMode="numeric"
            value={profile.handicap}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
              update({ ...profile, handicap: Number.isNaN(n) ? 0 : n });
            }}
          />
        </div>
      </Card>

      <div className="card-flat mb-4">
        <div className="eyebrow mb-1">How the engine uses this</div>
        <p className="text-sm">
          Planning Distance is the only distance the engine plans around. Good Strike is recorded but never
          used to build a strategy.
        </p>
      </div>

      {needsWork.length > 0 ? (
        <div className="card-flat mb-4" style={{ borderLeft: "3px solid var(--caution)" }}>
          <div className="caution font-bold text-sm mb-1">
            {needsWork.length} club{needsWork.length > 1 ? "s" : ""} need numbers
          </div>
          <p className="muted text-xs">
            {needsWork.map((c) => c.clubName).join(", ")}. Clubs with 0 yards are disabled and the engine
            ignores them — nothing was invented for them.
          </p>
        </div>
      ) : null}

      <div className="eyebrow mb-2">Clubs</div>
      <div className="grid gap-2 mb-6">
        {profile.clubs
          .filter((c) => c.category !== "PUTTER")
          .map((club) => {
            const open = openId === club.id;
            return (
              <div key={club.id} className="card" style={{ padding: 14 }}>
                <button
                  className="w-full flex items-center justify-between text-left"
                  onClick={() => setOpenId(open ? null : club.id)}
                >
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      {club.clubName}
                      {club.needsCalibration ? (
                        <span className="badge badge-yellow">Needs calibration</span>
                      ) : null}
                      {!club.enabled ? <span className="badge">Off</span> : null}
                    </div>
                    <div className="muted text-xs mt-1 mono">
                      {club.planningDistance > 0
                        ? `PLAN ${club.planningDistance} · CONS ${club.conservativeDistance} · GOOD ${club.goodStrikeDistance}`
                        : "No distances loaded"}
                    </div>
                  </div>
                  <span className="muted">{open ? "▲" : "▼"}</span>
                </button>

                {open ? (
                  <div className="mt-4 grid gap-3">
                    <div className="grid grid-cols-3 gap-2">
                      <NumberField
                        label="Conservative"
                        value={club.conservativeDistance}
                        onChange={(n) => updateClub(club.id, { conservativeDistance: n })}
                      />
                      <NumberField
                        label="Planning"
                        value={club.planningDistance}
                        onChange={(n) => updateClub(club.id, { planningDistance: n })}
                      />
                      <NumberField
                        label="Good strike"
                        value={club.goodStrikeDistance}
                        onChange={(n) => updateClub(club.id, { goodStrikeDistance: n })}
                      />
                    </div>

                    <div>
                      <div className="eyebrow mb-2">
                        Dispersion ·{" "}
                        <span className="caution">
                          {club.dispersionSource === "ESTIMATE" ? DISPERSION_DISCLAIMER : "OBSERVED"}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <NumberField
                          label="Left"
                          value={club.leftDispersionYards}
                          onChange={(n) => updateClub(club.id, { leftDispersionYards: n })}
                        />
                        <NumberField
                          label="Right"
                          value={club.rightDispersionYards}
                          onChange={(n) => updateClub(club.id, { rightDispersionYards: n })}
                        />
                        <NumberField
                          label="Short"
                          value={club.shortDispersionYards}
                          onChange={(n) => updateClub(club.id, { shortDispersionYards: n })}
                        />
                        <NumberField
                          label="Long"
                          value={club.longDispersionYards}
                          onChange={(n) => updateClub(club.id, { longDispersionYards: n })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="eyebrow">Typical miss</span>
                        <select
                          className="text-input mt-1"
                          value={club.typicalMiss}
                          onChange={(e) =>
                            updateClub(club.id, { typicalMiss: e.target.value as Club["typicalMiss"] })
                          }
                        >
                          {["NONE", "LEFT", "RIGHT", "SHORT", "LONG"].map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="eyebrow">Confidence</span>
                        <select
                          className="text-input mt-1"
                          value={club.confidence}
                          onChange={(e) =>
                            updateClub(club.id, { confidence: e.target.value as Club["confidence"] })
                          }
                        >
                          {["LOW", "MEDIUM", "HIGH"].map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="eyebrow">Notes</span>
                      <input
                        className="text-input mt-1"
                        value={club.notes}
                        onChange={(e) => updateClub(club.id, { notes: e.target.value })}
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateClub(club.id, { enabled: !club.enabled })}
                      >
                        {club.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => updateClub(club.id, { needsCalibration: !club.needsCalibration })}
                      >
                        {club.needsCalibration ? "Mark calibrated" : "Needs calibration"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
      </div>

      <button
        className="btn btn-danger"
        onClick={() => {
          if (!window.confirm("Reset all clubs to the original numbers?")) return;
          resetProfile();
          setProfile(getProfile());
        }}
      >
        Reset to default distances
      </button>
    </Screen>
  );
}

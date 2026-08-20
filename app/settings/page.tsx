"use client";

import { useEffect, useRef, useState } from "react";
import type { AppSettings } from "@/lib/storage";
import {
  buildBackup,
  downloadJson,
  getProfile,
  getRounds,
  getSettings,
  getUserCourses,
  restoreBackup,
  saveSettings,
} from "@/lib/storage";
import { Card, PageHeader, Screen, StatRow } from "@/components/ui";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  if (!settings) return null;

  function update(patch: Partial<AppSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    if (patch.darkMode !== undefined) {
      document.documentElement.setAttribute("data-theme", patch.darkMode ? "dark" : "light");
    }
  }

  return (
    <Screen>
      <PageHeader eyebrow="Five Decisions" title="Settings" />

      <Card className="mb-4">
        <div className="stat-row">
          <span className="text-sm">Hide Score by default</span>
          <button
            className="badge"
            style={settings.hideScoreDefault ? { color: "var(--accent)" } : undefined}
            onClick={() => update({ hideScoreDefault: !settings.hideScoreDefault })}
          >
            {settings.hideScoreDefault ? "ON" : "OFF"}
          </button>
        </div>
        <div className="stat-row">
          <span className="text-sm">Dark background</span>
          <button
            className="badge"
            style={settings.darkMode ? { color: "var(--accent)" } : undefined}
            onClick={() => update({ darkMode: !settings.darkMode })}
          >
            {settings.darkMode ? "ON" : "OFF"}
          </button>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="eyebrow mb-3">Backup</div>
        <StatRow label="Rounds stored" value={getRounds().length} />
        <StatRow label="User courses" value={getUserCourses().length} />
        <StatRow label="Clubs" value={getProfile().clubs.length} />

        <div className="grid gap-2 mt-4">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => downloadJson("player-profile.json", getProfile())}
          >
            Export player-profile.json
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => downloadJson("courses.json", getUserCourses())}
          >
            Export courses.json
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => downloadJson("round-history.json", getRounds())}
          >
            Export round-history.json
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => downloadJson("five-decisions-backup.json", buildBackup())}
          >
            Export full backup
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const parsed = JSON.parse(await f.text());
                restoreBackup(parsed);
                setMessage("Backup imported.");
              } catch {
                setMessage("That file could not be read as a Five Decisions backup.");
              }
            }}
          />
        </div>
        {message ? <p className="text-sm mt-3 accent">{message}</p> : null}
      </Card>

      <Card>
        <div className="eyebrow mb-2">About the model</div>
        <p className="text-sm mb-2">
          The decision engine is deterministic and runs offline. It ranks options with an H18 estimate of
          expected score, never a professional strokes-gained table.
        </p>
        <p className="muted text-xs">
          You will never see &quot;+0.73 strokes&quot; in this app. You will see LOW / MEDIUM / HIGH cost and a
          confidence level.
        </p>
      </Card>
    </Screen>
  );
}

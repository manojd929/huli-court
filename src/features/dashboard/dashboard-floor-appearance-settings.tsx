"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useDashboardAppearance } from "./dashboard-appearance-provider";
import { DashboardFloorLivePreviewPanel } from "./dashboard-floor-live-preview";
import { DashboardFloorThemePicker } from "./dashboard-floor-theme-picker";
import { DashboardFloorThemeSwatches } from "./dashboard-floor-theme-swatches";

/** Commissioner-facing control for curated dashboard backdrop themes (persisted locally). */
export function DashboardFloorAppearanceSettingsCard() {
  const { hydrated, floorTheme, setFloorTheme } = useDashboardAppearance();

  return (
    <Card
      id="commissioner-appearance"
      className="border-border/60 bg-card/60 shadow-sm backdrop-blur-sm"
    >
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base tracking-tight sm:text-[1.05rem]">
          Commissioner dashboard backdrop
        </CardTitle>
        <CardDescription>
          Choose how the commissioner tournament home looks behind your cards and navigation. Lives
          on this device only until we sync preferences to your profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pt-6">
        <DashboardFloorLivePreviewPanel theme={floorTheme} hydrated={hydrated} />

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Theme presets</p>
            <p className="text-sm leading-snug text-muted-foreground">
              Tap a preset; the dashboard and preview update immediately on this browser.
            </p>
          </div>
          <DashboardFloorThemeSwatches
            selectedTheme={floorTheme}
            disabled={!hydrated}
            onSelect={setFloorTheme}
          />
        </div>

        <Separator className="bg-border/50" />

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground">List picker</p>
            <p className="text-sm leading-snug text-muted-foreground">
              Same themes as above; alternate control for keyboard navigation or tighter layouts.
            </p>
          </div>
          <DashboardFloorThemePicker triggerClassName="sm:shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

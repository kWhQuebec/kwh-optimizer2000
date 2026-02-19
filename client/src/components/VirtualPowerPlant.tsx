/**
 * Virtual Power Plant Component — kWh Québec
 * Displays aggregate solar farm stats with animated panels
 * Shows MW, CO2 avoided, homes powered, cars removed
 */

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import clsx from "clsx";

interface VirtualPowerPlantStats {
  id: string;
  totalInstalledMW: number;
  totalProjectsCompleted: number;
  totalProjectsInProgress: number;
  totalPanelCount: number;
  totalKWhProduced: number;
  totalCO2AvoidedTonnes: number;
  totalSavingsDollars: number;
  equivalentHomesP: number;
  equivalentCarsRemoved: number;
  lastUpdatedAt: string;
}

interface SolarPanelProps {
  isLit: boolean;
  isAnimating: boolean;
}

interface VirtualPowerPlantProps {
  highlightProjectId?: string;
  clientName?: string;
}

// Animated Solar Panel SVG Component
function SolarPanel({ isLit, isAnimating }: SolarPanelProps) {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      className={clsx(
        "transition-all duration-300",
        isLit ? "drop-shadow-lg" : ""
      )}
    >
      {/* Panel background */}
      <rect
        x="10"
        y="10"
        width="60"
        height="60"
        rx="4"
        fill={isLit ? "#003DA6" : "#9ca3af"}
        opacity={isLit ? 0.9 : 0.5}
      />

      {/* Panel grid pattern */}
      <g stroke={isLit ? "#003DA6" : "#d1d5db"} strokeWidth="1" opacity="0.5">
        <line x1="10" y1="27" x2="70" y2="27" />
        <line x1="10" y1="44" x2="70" y2="44" />
        <line x1="10" y1="61" x2="70" y2="61" />
        <line x1="27" y1="10" x2="27" y2="70" />
        <line x1="44" y1="10" x2="44" y2="70" />
        <line x1="61" y1="10" x2="61" y2="70" />
      </g>

      {/* Glow effect for lit panels */}
      {isLit && (
        <circle
          cx="40"
          cy="40"
          r="32"
          fill="none"
          stroke="#FFB005"
          strokeWidth="2"
          opacity={isAnimating ? 0.8 : 0.3}
          className={clsx(isAnimating && "animate-pulse")}
        />
      )}

      {/* Panel frame */}
      <rect
        x="10"
        y="10"
        width="60"
        height="60"
        rx="4"
        fill="none"
        stroke={isLit ? "#003DA6" : "#9ca3af"}
        strokeWidth="2"
      />
    </svg>
  );
}

// Counter component with animation
function AnimatedCounter({
  value,
  label,
  unit,
  icon,
  color,
}: {
  value: number;
  label: string;
  unit: string;
  icon: string;
  color: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Animate counter from 0 to value over 1 second
    const startTime = Date.now();
    const duration = 1000;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayValue(Math.floor(value * progress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animate();
  }, [value]);

  return (
    <div className={clsx("rounded-lg border-2 p-6", `border-${color}-200`)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={clsx("text-3xl font-bold mt-2", `text-${color}-600`)}>
            {displayValue.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{unit}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}

export function VirtualPowerPlant({
  highlightProjectId,
  clientName,
}: VirtualPowerPlantProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["gamification", "virtual-powerplant"],
    queryFn: async () => {
      const res = await fetch("/api/gamification/virtual-powerplant");
      if (!res.ok) throw new Error("Failed to fetch virtual power plant stats");
      return res.json() as Promise<VirtualPowerPlantStats>;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-muted-foreground">
            Loading virtual power plant...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-muted-foreground">
            No power plant data available
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate panel grid dimensions
  const totalPanels = Math.max(
    Math.ceil(stats.totalProjectsCompleted * 3),
    12
  );
  const gridCols = 6;
  const gridRows = Math.ceil(totalPanels / gridCols);
  const litPanels = stats.totalProjectsCompleted;
  const inProgressPanels = Math.min(stats.totalProjectsInProgress, totalPanels - litPanels);

  // Create panel array
  const panels = Array.from({ length: totalPanels }, (_, i) => ({
    id: i,
    isCompleted: i < litPanels,
    isInProgress: i >= litPanels && i < litPanels + inProgressPanels,
  }));

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-yellow-50 to-orange-50 pb-4">
          <CardTitle className="text-2xl flex items-center gap-2">
            <span className="text-4xl">⚡</span>
            Centrale Virtuelle Solaire
          </CardTitle>
          <CardDescription>
            {clientName
              ? `Partnership with ${clientName} - Your solar farm contributing to the collective`
              : "Collective impact of all kWh Québec projects worldwide"}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          {/* Solar Panel Grid */}
          <div className="mb-8 p-8 bg-gradient-to-b from-blue-50 to-slate-50 rounded-xl border-2 border-blue-100">
            <p className="text-sm font-semibold text-slate-600 mb-6">
              {litPanels} Completed • {inProgressPanels} In Progress • {totalPanels - litPanels - inProgressPanels} Available
            </p>

            <div
              className="gap-4 auto-fit"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${gridCols}, minmax(80px, 1fr))`,
              }}
            >
              {panels.map((panel) => (
                <div
                  key={panel.id}
                  className={clsx(
                    "flex justify-center transition-all duration-300",
                    highlightProjectId && panel.isCompleted && "ring-4 ring-yellow-400"
                  )}
                >
                  <SolarPanel
                    isLit={panel.isCompleted}
                    isAnimating={panel.isInProgress}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatedCounter
              value={Math.round(stats.totalInstalledMW * 100) / 100}
              label="Total Solar Capacity"
              unit="MW"
              icon="☀️"
              color="yellow"
            />

            <AnimatedCounter
              value={Math.round(stats.totalCO2AvoidedTonnes)}
              label="CO2 Avoided"
              unit="Tonnes"
              icon="🌍"
              color="green"
            />

            <AnimatedCounter
              value={stats.equivalentHomesP}
              label="Equivalent Homes"
              unit="Annual Power Supply"
              icon="🏠"
              color="blue"
            />

            <AnimatedCounter
              value={stats.equivalentCarsRemoved}
              label="Cars Removed"
              unit="Equivalent Emissions"
              icon="🚗"
              color="purple"
            />

            <AnimatedCounter
              value={stats.totalProjectsCompleted}
              label="Systems Delivered"
              unit="Solar Installations"
              icon="✓"
              color="emerald"
            />

            <AnimatedCounter
              value={Math.round(stats.totalKWhProduced)}
              label="kWh Generated"
              unit="Annually"
              icon="⚡"
              color="orange"
            />
          </div>
        </CardContent>
      </Card>

      {/* Milestone Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Milestones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 5 MW Milestone */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">5 MW Installed</span>
              <span className="text-sm font-semibold text-blue-600">
                {Math.round((stats.totalInstalledMW / 5) * 100)}%
              </span>
            </div>
            <Progress
              value={Math.min((stats.totalInstalledMW / 5) * 100, 100)}
            />
          </div>

          {/* 100 Systems Milestone */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">100 Systems Delivered</span>
              <span className="text-sm font-semibold text-green-600">
                {Math.round(
                  (stats.totalProjectsCompleted / 100) * 100
                )}%
              </span>
            </div>
            <Progress
              value={Math.min(
                (stats.totalProjectsCompleted / 100) * 100,
                100
              )}
            />
          </div>

          {/* 1000 Homes Milestone */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                1000 Equivalent Homes Powered
              </span>
              <span className="text-sm font-semibold text-purple-600">
                {Math.round((stats.equivalentHomesP / 1000) * 100)}%
              </span>
            </div>
            <Progress
              value={Math.min((stats.equivalentHomesP / 1000) * 100, 100)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Last updated: {new Date(stats.lastUpdatedAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

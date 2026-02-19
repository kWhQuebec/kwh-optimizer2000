/**
 * Gamification Panel — kWh Québec
 * Displays missions, tasks, badges, and level progress
 * Used in both client and AM dashboards
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import clsx from "clsx";

interface Task {
  id: string;
  title: string;
  pointsReward: number;
  completed: boolean;
  completedAt?: string;
  assignedTo: "client" | "account_manager";
}

interface Mission {
  id: string;
  missionNumber: number;
  title: string;
  stage: string;
  status: "locked" | "active" | "completed";
  pointsReward: number;
  bonusPointsEarned: number;
  startedAt?: string;
  completedAt?: string;
  tasks: Task[];
}

interface BadgeData {
  id: string;
  badgeType: string;
  badgeName: string;
  badgeIcon: string;
  badgeDescription: string;
  unlockedAt: string;
}

interface Profile {
  id: string;
  displayName: string;
  totalPoints: number;
  level: "bronze" | "silver" | "gold" | "platinum";
  currentStreak: number;
  longestStreak: number;
  totalProjectsCompleted: number;
  totalMWInstalled: number;
  totalCO2Avoided: number;
  badges: BadgeData[];
}

interface GamificationPanelProps {
  opportunityId: string;
  profileId: string;
  userType: "client" | "account_manager";
  onTaskComplete?: (taskId: string) => void;
}

const LEVEL_COLORS = {
  bronze: "from-yellow-700 to-yellow-600",
  silver: "from-slate-500 to-slate-400",
  gold: "from-yellow-400 to-yellow-300",
  platinum: "from-purple-400 to-blue-400",
};

const LEVEL_ICONS = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "👑",
};

export function GamificationPanel({
  opportunityId,
  profileId,
  userType,
  onTaskComplete,
}: GamificationPanelProps) {
  const [isCompletingTask, setIsCompletingTask] = useState<string | null>(null);

  // Fetch missions for this opportunity
  const { data: missionsData, isLoading: missionsLoading } = useQuery({
    queryKey: ["gamification", "missions", opportunityId],
    queryFn: async () => {
      const res = await fetch(`/api/gamification/missions/${opportunityId}`);
      if (!res.ok) throw new Error("Failed to fetch missions");
      return res.json();
    },
  });

  // Fetch profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["gamification", "profile", profileId],
    queryFn: async () => {
      const res = await fetch(`/api/gamification/profile/${profileId}`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json() as Promise<Profile>;
    },
  });

  // Handle task completion
  const handleCompleteTask = async (taskId: string) => {
    setIsCompletingTask(taskId);
    try {
      const res = await fetch(`/api/gamification/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          completedBy: profileId,
        }),
      });

      if (res.ok) {
        // Refetch profile and missions to update UI
        onTaskComplete?.(taskId);
        window.location.reload(); // Simple refresh; use query invalidation in production
      }
    } catch (error) {
      console.error("Error completing task:", error);
    } finally {
      setIsCompletingTask(null);
    }
  };

  if (missionsLoading || profileLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-muted-foreground">
            Loading gamification data...
          </p>
        </CardContent>
      </Card>
    );
  }

  const missions: Mission[] = missionsData?.missions || [];
  const activeMission = missions.find((m) => m.status === "active");
  const completedMissions = missions.filter((m) => m.status === "completed");

  const clientTasks = activeMission?.tasks.filter(
    (t) => t.assignedTo === "client"
  ) || [];
  const amTasks = activeMission?.tasks.filter(
    (t) => t.assignedTo === "account_manager"
  ) || [];

  const tasksForUser =
    userType === "client" ? clientTasks : amTasks;
  const completedTaskCount = tasksForUser.filter((t) => t.completed).length;
  const totalTaskCount = tasksForUser.length;
  const taskProgressPercent =
    totalTaskCount > 0 ? (completedTaskCount / totalTaskCount) * 100 : 0;

  const levelThresholds = {
    bronze: 0,
    silver: 5000,
    gold: 15000,
    platinum: 50000,
  };
  const currentLevelThreshold =
    levelThresholds[profile?.level || "bronze"] || 0;
  const nextLevel =
    profile?.level === "bronze"
      ? "silver"
      : profile?.level === "silver"
        ? "gold"
        : profile?.level === "gold"
          ? "platinum"
          : "platinum";
  const nextLevelThreshold = levelThresholds[nextLevel] || 0;
  const pointsToNextLevel = Math.max(
    0,
    nextLevelThreshold - (profile?.totalPoints || 0)
  );
  const levelProgressPercent =
    ((profile?.totalPoints || 0) - currentLevelThreshold) /
    (nextLevelThreshold - currentLevelThreshold) *
    100;

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">
                  {LEVEL_ICONS[profile?.level || "bronze"]}
                </span>
                {profile?.displayName}
              </CardTitle>
              <CardDescription>
                Level: {profile?.level?.toUpperCase() || "BRONZE"}
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-yellow-500">
                {profile?.totalPoints || 0}
              </p>
              <p className="text-xs text-muted-foreground">Total Points</p>
            </div>
          </div>

          {/* Level Progress Bar */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>Progress to {nextLevel.toUpperCase()}</span>
              <span className="text-xs text-muted-foreground">
                {pointsToNextLevel} points remaining
              </span>
            </div>
            <Progress value={Math.min(100, levelProgressPercent)} />
          </div>

          {/* Streak Stats */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-lg font-semibold">{profile?.currentStreak}</p>
              <p className="text-xs text-muted-foreground">Current Streak</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{profile?.longestStreak}</p>
              <p className="text-xs text-muted-foreground">Longest Streak</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">
                {profile?.totalProjectsCompleted}
              </p>
              <p className="text-xs text-muted-foreground">Projects</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Active Mission */}
      {activeMission && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Mission {activeMission.missionNumber}: {activeMission.title}
            </CardTitle>
            <CardDescription>
              Pipeline Stage: {activeMission.stage}
            </CardDescription>

            {/* Mission Progress */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>
                  {completedTaskCount} / {totalTaskCount} Tasks Complete
                </span>
                <span className="text-sm font-semibold">
                  {activeMission.pointsReward} points available
                </span>
              </div>
              <Progress value={taskProgressPercent} />
            </div>
          </CardHeader>

          <CardContent>
            {/* Task Tabs */}
            <Tabs
              defaultValue={userType === "client" ? "client" : "am"}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="client">Client Tasks</TabsTrigger>
                <TabsTrigger value="am">AM Tasks</TabsTrigger>
              </TabsList>

              <TabsContent value="client" className="space-y-4">
                {clientTasks.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    No client tasks for this mission.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {clientTasks.map((task) => (
                      <li key={task.id}>
                        <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                          <Checkbox
                            id={`task-${task.id}`}
                            checked={task.completed}
                            disabled={
                              userType !== "client" || isCompletingTask === task.id
                            }
                            onChange={() => handleCompleteTask(task.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={`task-${task.id}`}
                              className={clsx(
                                "block text-sm font-medium cursor-pointer",
                                task.completed && "line-through text-muted-foreground"
                              )}
                            >
                              {task.title}
                            </label>
                            <span className="inline-block mt-1 text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                              +{task.pointsReward} pts
                            </span>
                          </div>
                          {task.completed && (
                            <span className="text-lg">✓</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="am" className="space-y-4">
                {amTasks.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    No AM tasks for this mission.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {amTasks.map((task) => (
                      <li key={task.id}>
                        <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                          <Checkbox
                            id={`task-${task.id}`}
                            checked={task.completed}
                            disabled={
                              userType !== "account_manager" ||
                              isCompletingTask === task.id
                            }
                            onChange={() => handleCompleteTask(task.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={`task-${task.id}`}
                              className={clsx(
                                "block text-sm font-medium cursor-pointer",
                                task.completed && "line-through text-muted-foreground"
                              )}
                            >
                              {task.title}
                            </label>
                            <span className="inline-block mt-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              +{task.pointsReward} pts
                            </span>
                          </div>
                          {task.completed && (
                            <span className="text-lg">✓</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Badges */}
      {profile?.badges && profile.badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Badges Unlocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {profile.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-50 text-center"
                >
                  <span className="text-3xl">{badge.badgeIcon}</span>
                  <p className="text-xs font-semibold">{badge.badgeName}</p>
                  <p className="text-xs text-muted-foreground">
                    {badge.badgeDescription}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed Missions */}
      {completedMissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Completed Missions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedMissions.map((mission) => (
                <div
                  key={mission.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-green-50 border border-green-200"
                >
                  <span className="font-medium text-sm">
                    Mission {mission.missionNumber}: {mission.title}
                  </span>
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    +{mission.pointsReward} pts
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

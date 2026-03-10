import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { getFreshToken } from "@/lib/queryClient";

interface HqJobStatus {
  id: string;
  status: string;
  importedCsvFiles?: number;
  totalReadings?: number;
  errorMessage?: string;
}

export function HQJobNotifier() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const notifiedJobs = useRef(new Set<string>());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authFailCount = useRef(0);

  const isStaff = user && (user.role === "admin" || user.role === "analyst");

  useEffect(() => {
    if (!isStaff) return;

    const handleAuthFailure = () => {
      authFailCount.current++;
      if (authFailCount.current >= 3 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const checkActiveJob = async () => {
      try {
        const token = await getFreshToken();
        if (!token) {
          handleAuthFailure();
          return;
        }

        const res = await fetch("/api/admin/hq-data/active-job", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          handleAuthFailure();
          return;
        }
        if (!res.ok) return;
        authFailCount.current = 0;
        const data = await res.json();

        if (data.job && !notifiedJobs.current.has(data.job.id)) {
          setTrackedJobId(data.job.id);
        } else if (!data.job && trackedJobId) {
          const freshToken = await getFreshToken();
          if (!freshToken) { handleAuthFailure(); return; }
          const jobRes = await fetch(`/api/admin/hq-data/jobs/${trackedJobId}`, {
            headers: { Authorization: `Bearer ${freshToken}` },
          });
          if (jobRes.status === 401) { handleAuthFailure(); return; }
          if (!jobRes.ok) {
            setTrackedJobId(null);
            return;
          }
          authFailCount.current = 0;
          const job: HqJobStatus = await jobRes.json();

          if (job.status === "completed" && !notifiedJobs.current.has(job.id)) {
            notifiedJobs.current.add(job.id);
            toast({
              title: "Récupération terminée",
              description: `${job.importedCsvFiles || 0} fichier(s) importé(s), ${(job.totalReadings || 0).toLocaleString()} lecture(s)`,
              variant: "default",
            });
            setTrackedJobId(null);
          } else if (job.status === "failed" && !notifiedJobs.current.has(job.id)) {
            notifiedJobs.current.add(job.id);
            toast({
              title: "Échec de la récupération",
              description: job.errorMessage || "Une erreur est survenue",
              variant: "destructive",
            });
            setTrackedJobId(null);
          }
        }
      } catch {
      }
    };

    const pollInterval = trackedJobId ? 3000 : 60000;

    authFailCount.current = 0;
    checkActiveJob();
    intervalRef.current = setInterval(checkActiveJob, pollInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isStaff, trackedJobId, toast]);

  return null;
}

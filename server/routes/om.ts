import { Router } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertOmContractSchema, insertOmVisitSchema, insertOmPerformanceSnapshotSchema } from "@shared/schema";
import { createLogger } from "../lib/logger";

const log = createLogger("OM");

const router = Router();

router.get("/api/om-contracts", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const contracts = await storage.getOmContracts();
    res.json(contracts);
  } catch (error) {
    log.error("Error fetching O&M contracts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/om-contracts/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const contract = await storage.getOmContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: "O&M contract not found" });
    }

    const site = await storage.getSite(contract.siteId);
    const client = await storage.getClient(contract.clientId);
    const visits = await storage.getOmVisitsByContractId(contract.id);

    res.json({
      ...contract,
      site,
      client,
      visits,
    });
  } catch (error) {
    log.error("Error fetching O&M contract:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/om-contracts/client/:clientId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const contracts = await storage.getOmContractsByClientId(req.params.clientId);
    res.json(contracts);
  } catch (error) {
    log.error("Error fetching O&M contracts by client:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/om-contracts/site/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const contracts = await storage.getOmContractsBySiteId(req.params.siteId);
    res.json(contracts);
  } catch (error) {
    log.error("Error fetching O&M contracts by site:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/om-contracts", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const parsed = insertOmContractSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const contract = await storage.createOmContract({
      ...parsed.data,
      createdBy: req.userId,
    });
    res.status(201).json(contract);
  } catch (error) {
    log.error("Error creating O&M contract:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/om-contracts/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const contract = await storage.updateOmContract(req.params.id, req.body);
    if (!contract) {
      return res.status(404).json({ error: "O&M contract not found" });
    }
    res.json(contract);
  } catch (error) {
    log.error("Error updating O&M contract:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/om-contracts/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const deleted = await storage.deleteOmContract(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "O&M contract not found" });
    }
    res.status(204).send();
  } catch (error) {
    log.error("Error deleting O&M contract:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/om-contracts/:id/activate", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const contract = await storage.getOmContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: "O&M contract not found" });
    }
    
    const updated = await storage.updateOmContract(req.params.id, {
      status: "active",
      startDate: req.body.startDate || new Date(),
    });
    
    res.json(updated);
  } catch (error) {
    log.error("Error activating O&M contract:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/om-visits", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const visits = await storage.getOmVisits();
    res.json(visits);
  } catch (error) {
    log.error("Error fetching O&M visits:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/om-visits/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const visit = await storage.getOmVisit(req.params.id);
    if (!visit) {
      return res.status(404).json({ error: "O&M visit not found" });
    }
    res.json(visit);
  } catch (error) {
    log.error("Error fetching O&M visit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/om-visits/contract/:contractId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const visits = await storage.getOmVisitsByContractId(req.params.contractId);
    res.json(visits);
  } catch (error) {
    log.error("Error fetching O&M visits by contract:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/om-visits", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const parsed = insertOmVisitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const visit = await storage.createOmVisit(parsed.data);
    res.status(201).json(visit);
  } catch (error) {
    log.error("Error creating O&M visit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/om-visits/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const visit = await storage.updateOmVisit(req.params.id, req.body);
    if (!visit) {
      return res.status(404).json({ error: "O&M visit not found" });
    }
    res.json(visit);
  } catch (error) {
    log.error("Error updating O&M visit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/om-visits/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const deleted = await storage.deleteOmVisit(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "O&M visit not found" });
    }
    res.status(204).send();
  } catch (error) {
    log.error("Error deleting O&M visit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/om-visits/:id/complete", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const visit = await storage.getOmVisit(req.params.id);
    if (!visit) {
      return res.status(404).json({ error: "O&M visit not found" });
    }
    
    const { findings, actionsTaken, issuesFound, issuesResolved, systemReadings, partsUsed } = req.body;
    
    const updated = await storage.updateOmVisit(req.params.id, {
      status: "completed",
      actualDate: new Date(),
      findings,
      actionsTaken,
      issuesFound: issuesFound || 0,
      issuesResolved: issuesResolved || 0,
      systemReadings,
      partsUsed,
    });
    
    res.json(updated);
  } catch (error) {
    log.error("Error completing O&M visit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/om-performance/contract/:contractId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const snapshots = await storage.getOmPerformanceSnapshotsByContractId(req.params.contractId);
    res.json(snapshots);
  } catch (error) {
    log.error("Error fetching O&M performance snapshots:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/om-performance", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const parsed = insertOmPerformanceSnapshotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const snapshot = await storage.createOmPerformanceSnapshot(parsed.data);
    res.status(201).json(snapshot);
  } catch (error) {
    log.error("Error creating O&M performance snapshot:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/om-performance/sites", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const contracts = await storage.getOmContracts();
    const siteIds = [...new Set(contracts.map(c => c.siteId))];
    
    const sites = await Promise.all(
      siteIds.map(async (siteId) => {
        const site = await storage.getSite(siteId);
        return site;
      })
    );
    
    res.json(sites.filter(Boolean));
  } catch (error) {
    log.error("Error fetching O&M sites:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/om-performance/dashboard/:siteId", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const siteId = req.params.siteId;
    
    const contracts = await storage.getOmContractsBySiteId(siteId);
    
    if (contracts.length === 0) {
      return res.json({
        contracts: [],
        snapshots: [],
        visits: [],
        summary: null,
      });
    }
    
    const allSnapshots: Awaited<ReturnType<typeof storage.getOmPerformanceSnapshotsByContractId>>[] = [];
    const allVisits: Awaited<ReturnType<typeof storage.getOmVisitsByContractId>>[] = [];
    
    for (const contract of contracts) {
      const snapshots = await storage.getOmPerformanceSnapshotsByContractId(contract.id);
      const visits = await storage.getOmVisitsByContractId(contract.id);
      allSnapshots.push(snapshots);
      allVisits.push(visits);
    }
    
    const flatSnapshots = allSnapshots.flat();
    const flatVisits = allVisits.flat();
    
    const latestSnapshots = flatSnapshots.slice(-12);
    const avgPerformanceRatio = latestSnapshots.length > 0
      ? latestSnapshots.reduce((sum, s) => sum + (s.performanceRatio || 0), 0) / latestSnapshots.length
      : null;
    const totalProductionKWh = latestSnapshots.reduce((sum, s) => sum + (s.actualProductionKWh || 0), 0);
    const totalSavings = latestSnapshots.reduce((sum, s) => sum + (s.actualSavings || 0), 0);
    
    res.json({
      contracts,
      snapshots: flatSnapshots,
      visits: flatVisits,
      summary: {
        avgPerformanceRatio,
        totalProductionKWh,
        totalSavings,
        totalVisits: flatVisits.length,
        completedVisits: flatVisits.filter(v => v.status === "completed").length,
        openIssues: flatVisits.reduce((sum, v) => sum + ((v.issuesFound || 0) - (v.issuesResolved || 0)), 0),
      },
    });
  } catch (error) {
    log.error("Error fetching O&M performance dashboard:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

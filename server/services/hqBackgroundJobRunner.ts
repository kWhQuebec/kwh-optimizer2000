import { storage } from "../storage";
import { HQDataFetcher, HQContract, HQDownloadResult } from "./hqDataFetcher";
import { parseHydroQuebecCSV } from "../routes/siteAnalysisHelpers";
import { sendEmail } from "../emailService";
import { createLogger } from "../lib/logger";
import { applyTariffToSite } from "../repositories/siteRepo";
import fs from "fs";
import path from "path";

const log = createLogger("HQ-BackgroundJob");

const activeJobs = new Map<string, { abortController: AbortController }>();

export function isJobRunning(jobId: string): boolean {
  return activeJobs.has(jobId);
}

export function getRunningJobId(): string | undefined {
  const keys = Array.from(activeJobs.keys());
  return keys.length > 0 ? keys[0] : undefined;
}

export async function startBackgroundFetch(opts: {
  jobId: string;
  siteId?: string;
  username: string;
  password: string;
  filterAccountNumbers?: string[];
  filterContractNumbers?: string[];
  notifyEmail?: string;
  startedById?: string;
}): Promise<void> {
  const { jobId, siteId, username, password, filterAccountNumbers, filterContractNumbers, notifyEmail, startedById } = opts;

  if (activeJobs.size > 0) {
    await storage.updateHqFetchJob(jobId, {
      status: "failed",
      errorMessage: "Un autre processus de récupération est déjà en cours. Veuillez attendre qu'il se termine.",
      completedAt: new Date(),
    });
    return;
  }

  const abortController = new AbortController();
  activeJobs.set(jobId, { abortController });

  runJob(opts).catch((err) => {
    log.error(`Background job ${jobId} crashed:`, err);
  }).finally(() => {
    activeJobs.delete(jobId);
  });
}

async function runJob(opts: {
  jobId: string;
  siteId?: string;
  username: string;
  password: string;
  filterAccountNumbers?: string[];
  filterContractNumbers?: string[];
  notifyEmail?: string;
  startedById?: string;
}): Promise<void> {
  const { jobId, siteId, username, password, filterAccountNumbers, filterContractNumbers, notifyEmail } = opts;
  const startTime = Date.now();

  try {
    await storage.updateHqFetchJob(jobId, {
      status: "authenticating",
      currentStage: "login",
      currentDetail: "Connexion au portail Hydro-Québec...",
    });

    const fetcher = new HQDataFetcher();

    const loginSuccess = await fetcher.login(username, password);
    if (!loginSuccess) {
      await storage.updateHqFetchJob(jobId, {
        status: "failed",
        errorMessage: "Échec de l'authentification — identifiants invalides ou compte verrouillé",
        completedAt: new Date(),
      });
      return;
    }

    await storage.updateHqFetchJob(jobId, {
      status: "fetching",
      currentStage: "fetching_accounts",
      currentDetail: "Recherche des comptes et contrats disponibles...",
    });

    const accounts = await fetcher.getAccounts();
    if (accounts.length === 0) {
      await storage.updateHqFetchJob(jobId, {
        status: "failed",
        errorMessage: "Aucun compte lié trouvé. Vérifiez les procurations.",
        completedAt: new Date(),
      });
      return;
    }

    let allContracts: Array<HQContract & { applicantId: string; customerId: string }> = [];

    for (const account of accounts) {
      const contracts = await fetcher.getContracts(
        account.applicantId,
        account.customerId,
        filterAccountNumbers,
        filterContractNumbers,
      );
      for (const c of contracts) {
        allContracts.push({ ...c, applicantId: account.applicantId, customerId: account.customerId });
      }
    }

    if (allContracts.length === 0) {
      await storage.updateHqFetchJob(jobId, {
        status: "failed",
        errorMessage: "Aucun contrat trouvé correspondant aux filtres spécifiés.",
        completedAt: new Date(),
      });
      return;
    }

    const contractsMetadata = allContracts.map(c => ({
      contractId: c.contractId,
      accountId: c.accountId,
      meterId: c.meterId,
      address: c.address,
      rateCode: c.rateCode,
    }));

    await storage.updateHqFetchJob(jobId, {
      totalContracts: allContracts.length,
      contractsData: contractsMetadata,
      currentStage: "fetching_contracts",
      currentDetail: `${allContracts.length} contrat(s) trouvé(s) — démarrage du téléchargement`,
    });

    const csvOptions: Array<"energie-heure" | "puissance-min"> = ["energie-heure", "puissance-min"];
    let totalCsvFiles = 0;
    let importedCsvFiles = 0;
    let totalReadings = 0;
    let completedContracts = 0;
    const tmpDir = "/tmp/meter-uploads";
    fs.mkdirSync(tmpDir, { recursive: true });
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 50);

    for (const contract of allContracts) {
      completedContracts++;

      await storage.updateHqFetchJob(jobId, {
        status: "fetching",
        completedContracts,
        currentStage: "downloading",
        currentDetail: `Contrat ${completedContracts}/${allContracts.length} — ${contract.contractId} — récupération des périodes de facturation`,
      });

      let periods: Array<{ startDate: string; endDate: string; contractId: string }> = [];
      try {
        periods = await fetcher.getPeriods(contract.applicantId, contract.customerId, contract.contractId);
      } catch (err: any) {
        log.warn(`Failed to get periods for ${contract.contractId}: ${err.message}`);
        continue;
      }

      const contractCsvCount = periods.length * csvOptions.length;
      totalCsvFiles += contractCsvCount;

      await storage.updateHqFetchJob(jobId, {
        totalCsvFiles,
        currentDetail: `${contract.contractId} — ${periods.length} période(s), ${contractCsvCount} fichier(s) à télécharger`,
      });

      let periodIdx = 0;
      for (const period of periods) {
        periodIdx++;
        for (const option of csvOptions) {
          await storage.updateHqFetchJob(jobId, {
            currentDetail: `${contract.contractId} — ${option} période ${periodIdx}/${periods.length}`,
          });

          try {
            const csvContent = await fetcher.downloadCSV(
              contract.applicantId,
              contract.customerId,
              contract.contractId,
              period.startDate,
              period.endDate,
              option,
            );

            if (!csvContent || csvContent.trim().length === 0) {
              log.warn(`Empty CSV for ${contract.contractId} ${option} ${period.startDate}`);
              continue;
            }

            if (siteId) {
              const granularity = option === "energie-heure" ? "HOUR" : "FIFTEEN_MIN";
              const safeContract = sanitize(contract.contractId);
              const safeOption = sanitize(option);
              const safePeriodStart = sanitize(period.startDate);
              const safePeriodEnd = sanitize(period.endDate);
              const fileName = `${safeContract}_${safeOption}_${safePeriodStart}_${safePeriodEnd}.csv`;
              const tmpPath = path.join(tmpDir, `${Date.now()}_${fileName}`);

              try {
                fs.writeFileSync(tmpPath, csvContent, "utf-8");

                const meterFile = await storage.createMeterFile({
                  siteId,
                  fileName,
                  granularity,
                  hqContractNumber: contract.contractId,
                  hqMeterNumber: contract.meterId,
                  periodStart: period.startDate ? new Date(period.startDate) : undefined,
                  periodEnd: period.endDate ? new Date(period.endDate) : undefined,
                });

                const readings = await parseHydroQuebecCSV(tmpPath, meterFile.id, granularity);

                if (readings.length > 0) {
                  const BATCH_SIZE = 500;
                  for (let i = 0; i < readings.length; i += BATCH_SIZE) {
                    await storage.createMeterReadings(readings.slice(i, i + BATCH_SIZE));
                  }
                  totalReadings += readings.length;

                  const timestamps = readings.map(r => r.timestamp.getTime());
                  const minDate = new Date(Math.min(...timestamps));
                  const maxDate = new Date(Math.max(...timestamps));
                  await storage.updateMeterFile(meterFile.id, {
                    status: "PARSED",
                    periodStart: minDate,
                    periodEnd: maxDate,
                  });
                } else {
                  await storage.updateMeterFile(meterFile.id, { status: "PARSED" });
                }

                importedCsvFiles++;
                log.info(`Imported: ${fileName} (${readings.length} readings)`);
              } finally {
                if (fs.existsSync(tmpPath)) {
                  try { fs.unlinkSync(tmpPath); } catch {}
                }
              }
            }

            await storage.updateHqFetchJob(jobId, {
              importedCsvFiles,
              totalReadings,
            });
          } catch (csvErr: any) {
            log.warn(`CSV download failed: ${contract.contractId} ${option} ${period.startDate}: ${csvErr.message}`);
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (siteId) {
        try {
          await storage.updateSite(siteId, {
            hqContractNumber: contract.contractId,
            hqAccountNumber: contract.accountId || undefined,
            hqMeterNumber: contract.meterId || undefined,
            hqTariffDetail: contract.rateCode || undefined,
            serviceAddress: contract.address || undefined,
          });
          if (contract.rateCode) {
            await applyTariffToSite(siteId, contract.rateCode);
            log.info(`Propagated tariff ${contract.rateCode} to site ${siteId}`);
          }
        } catch (siteErr: any) {
          log.warn(`Failed to update site meter info for ${contract.contractId}: ${siteErr.message}`);
        }
      }
    }

    // Auto-trigger economic validation if site has consumption data
    if (siteId && importedCsvFiles > 0) {
      try {
        const updatedSite = await storage.getSite(siteId);
        if (updatedSite?.roofAreaValidated) {
          log.info(`Auto-triggering economic validation for site ${siteId} (roof validated, ${importedCsvFiles} CSV files imported)`);
          await storage.updateHqFetchJob(jobId, {
            currentStage: "auto_analysis",
            currentDetail: "Lancement automatique de la validation économique...",
          });
          try {
            const { runAutoAnalysisForSite } = await import("../routes/siteAnalysisHelpers");
            await runAutoAnalysisForSite(siteId);
            log.info(`Auto-analysis completed for site ${siteId}`);
          } catch (analysisErr: any) {
            log.warn(`Auto-analysis failed for site ${siteId}: ${analysisErr.message}`);
          }
        } else {
          log.info(`Site ${siteId} has consumption data but roof not yet validated — flagging as ready for analysis`);
          await storage.updateSite(siteId, { readyForAnalysis: true });
        }
      } catch (autoErr: any) {
        log.warn(`Auto-analysis check failed: ${autoErr.message}`);
      }
    }

    const elapsedMs = Date.now() - startTime;
    const elapsedMin = Math.round(elapsedMs / 60000);

    await storage.updateHqFetchJob(jobId, {
      status: "completed",
      completedContracts: allContracts.length,
      importedCsvFiles,
      totalReadings,
      currentStage: "completed",
      currentDetail: `${importedCsvFiles} fichier(s) importé(s), ${totalReadings.toLocaleString()} lecture(s) en ${elapsedMin} min`,
      completedAt: new Date(),
    });

    log.info(`Job ${jobId} completed: ${importedCsvFiles} files, ${totalReadings} readings in ${elapsedMin}min`);

    if (notifyEmail) {
      try {
        await sendEmail({
          to: notifyEmail,
          subject: `Récupération Hydro-Québec terminée — ${importedCsvFiles} fichier(s)`,
          htmlBody: `
            <h2>Récupération de données terminée</h2>
            <p>La récupération automatique des données depuis le portail Hydro-Québec est terminée.</p>
            <table style="border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 4px 12px; font-weight: bold;">Contrats traités</td><td style="padding: 4px 12px;">${allContracts.length}</td></tr>
              <tr><td style="padding: 4px 12px; font-weight: bold;">Fichiers importés</td><td style="padding: 4px 12px;">${importedCsvFiles}</td></tr>
              <tr><td style="padding: 4px 12px; font-weight: bold;">Lectures importées</td><td style="padding: 4px 12px;">${totalReadings.toLocaleString()}</td></tr>
              <tr><td style="padding: 4px 12px; font-weight: bold;">Durée</td><td style="padding: 4px 12px;">${elapsedMin} minute(s)</td></tr>
            </table>
            <p style="color: #666; font-size: 12px;">— kWh Québec</p>
          `,
        });
        log.info(`Notification email sent to ${notifyEmail}`);
      } catch (emailErr: any) {
        log.warn(`Failed to send notification email: ${emailErr.message}`);
      }
    }
  } catch (error: any) {
    log.error(`Job ${jobId} failed:`, error);
    await storage.updateHqFetchJob(jobId, {
      status: "failed",
      errorMessage: error.message || "Erreur inconnue",
      completedAt: new Date(),
    });
  }
}

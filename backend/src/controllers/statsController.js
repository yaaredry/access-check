'use strict';

const statsRepo = require('../repositories/statsRepository');

async function getStats(req, res, next) {
  try {
    const [
      gateScanCounts,
      gateScanVerdictBreakdown,
      hourlyScanActivity,
      requestCounts,
      pendingBacklog,
      topRequestors,
      populationBreakdown,
      approvalRate,
      verdictCounts,
      avgTimeToVerdict,
    ] = await Promise.all([
      statsRepo.getGateScanCounts(),
      statsRepo.getGateScanVerdictBreakdown(),
      statsRepo.getHourlyScanActivity({ days: 3 }),
      statsRepo.getRequestCounts(),
      statsRepo.getPendingBacklog(),
      statsRepo.getTopRequestors(),
      statsRepo.getPopulationBreakdown(),
      statsRepo.getApprovalRate(),
      statsRepo.getVerdictCounts(),
      statsRepo.getAvgTimeToVerdict(),
    ]);

    return res.json({
      gateScans: {
        counts: gateScanCounts,
        verdictBreakdown: gateScanVerdictBreakdown,
        hourlyScanActivity,
      },
      requests: {
        counts: requestCounts,
        pendingBacklog,
        populationBreakdown,
        approvalRate,
        topRequestors,
      },
      admin: {
        verdictCounts,
        avgTimeToVerdict,
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getStats };

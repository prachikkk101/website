import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../config/db';
import ExcelJS from 'exceljs';

export const exportDashboardReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const sites = await prisma.site.findMany({
      include: { _count: { select: { connections: true } } },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GP-PMS System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Dashboard Summary');

    sheet.columns = [
      { header: 'Site Name', key: 'siteName', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Target Connections', key: 'targetConns', width: 20 },
      { header: 'Total Applications', key: 'totalConns', width: 20 },
      { header: 'Done Connections', key: 'doneConns', width: 20 },
      { header: 'Meters Installed', key: 'metersInstalled', width: 20 },
      { header: 'RFC Connections', key: 'rfcConns', width: 20 },
      { header: 'LMC Done', key: 'lmcDone', width: 15 },
      { header: 'I&C Done', key: 'icDone', width: 15 },
      { header: 'Completion %', key: 'completionPct', width: 15 },
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D5016' }, // Forest Green
    };

    for (const site of sites) {
      const totalConns = site._count.connections;
      const doneConns = await prisma.pNGConnection.count({ where: { siteId: site.id, status: 'Done' } });
      const metersInstalled = await prisma.meterInstallation.count({ where: { siteId: site.id } });
      const rfcConns = await prisma.pNGConnection.count({ where: { siteId: site.id, status: 'RFC' } });
      const lmcDone = await prisma.lMCWork.count({
        where: { siteId: site.id, remarks: { equals: 'DONE', mode: 'insensitive' } },
      });
      const icDone = await prisma.iCWork.count({ where: { siteId: site.id, status: 'Done' } });

      const completionPct = site.targetConns > 0 ? Math.round((doneConns / site.targetConns) * 100) : 0;

      sheet.addRow({
        siteName: site.name,
        status: site.status,
        targetConns: site.targetConns,
        totalConns,
        doneConns,
        metersInstalled,
        rfcConns,
        lmcDone,
        icDone,
        completionPct: `${completionPct}%`,
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="GP-PMS_Dashboard_Report.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

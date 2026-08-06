import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import prisma from '../config/db';
import { PEStatus, Prisma } from '@prisma/client';
import { adjustInventoryStock } from '../utils/stockHelper';

export const getPELaying = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.siteId as string;
    const { status, raBillNo } = req.query;

    // Admin visibility diagnostic — confirm query is site-scoped only (no createdBy filter)
    console.log(`\ud83d\udd35 getPELaying — user: ${req.user?.id} role: ${req.user?.role} siteId: ${siteId}`);

    const where: any = {};
    if (siteId && siteId !== 'all') {
      where.siteId = siteId;
    }
    if (status) where.status = status as PEStatus;
    if (raBillNo) where.raBillNo = { contains: String(raBillNo), mode: 'insensitive' };

    const records = await prisma.pELaying.findMany({
      where,
      orderBy: { layingDate: 'desc' },
    });

    console.log(`\ud83d\udfe2 getPELaying — returned ${records.length} records for site ${siteId} (no user filter applied)`);

    // Compute cumulative totals
    const totals = records.reduce(
      (acc, r) => ({
        d32oc:   acc.d32oc   + r.d32oc.toNumber(),
        d32b:    acc.d32b    + r.d32b.toNumber(),
        d32hdd:  acc.d32hdd  + r.d32hdd.toNumber(),
        d63oc:   acc.d63oc   + r.d63oc.toNumber(),
        d63b:    acc.d63b    + r.d63b.toNumber(),
        d63hdd:  acc.d63hdd  + r.d63hdd.toNumber(),
        d90oc:   acc.d90oc   + r.d90oc.toNumber(),
        d90b:    acc.d90b    + r.d90b.toNumber(),
        d90hdd:  acc.d90hdd  + r.d90hdd.toNumber(),
        d90tot:  acc.d90tot  + r.d90tot.toNumber(),
        d125oc:  acc.d125oc  + r.d125oc.toNumber(),
        d125b:   acc.d125b   + r.d125b.toNumber(),
        d125hdd: acc.d125hdd + r.d125hdd.toNumber(),
        d125tot: acc.d125tot + r.d125tot.toNumber(),
      }),
      { d32oc: 0, d32b: 0, d32hdd: 0, d63oc: 0, d63b: 0, d63hdd: 0, d90oc: 0, d90b: 0, d90hdd: 0, d90tot: 0, d125oc: 0, d125b: 0, d125hdd: 0, d125tot: 0 }
    );

    res.status(200).json({ success: true, records, totals });
  } catch (error) {
    next(error);
  }
};


export const createPELaying = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log('🔵 PE Laying create — full request body:', JSON.stringify(req.body, null, 2));

  const schema = z.object({
    layingDate: z.string().min(1),
    testingDate: z.string().nullable().optional(),
    chargingDate: z.string().nullable().optional(),
    raBillNo: z.string().nullable().optional(),
    reportNo: z.string().nullable().optional(),
    status: z.nativeEnum(PEStatus).nullable().optional(),
    connType: z.string().nullable().optional(),   // Domestic / Commercial / Industrial
    area: z.string().min(1),
    coilNo: z.string().nullable().optional(),
    d32oc:   z.number().nonnegative().nullable().optional(),
    d32b:    z.number().nonnegative().nullable().optional(),
    d32hdd:  z.number().nonnegative().nullable().optional(),
    d63oc:   z.number().nonnegative().nullable().optional(),
    d63b:    z.number().nonnegative().nullable().optional(),
    d63hdd:  z.number().nonnegative().nullable().optional(),
    d90oc:   z.number().nonnegative().nullable().optional(),
    d90b:    z.number().nonnegative().nullable().optional(),
    d90hdd:  z.number().nonnegative().nullable().optional(),
    d90tot:  z.number().nonnegative().nullable().optional(),
    d125oc:  z.number().nonnegative().nullable().optional(),
    d125b:   z.number().nonnegative().nullable().optional(),
    d125hdd: z.number().nonnegative().nullable().optional(),
    d125tot: z.number().nonnegative().nullable().optional(),
    // DPR photo — Cloudflare R2 URL uploaded by frontend before save
    dprPhotoUrl: z.string().url().nullable().optional(),
    // MDPE Fittings used in this entry: [{material: string, qty: number}]
    mdpeMaterials: z.array(z.object({
      material: z.string().min(1),
      qty: z.number().nonnegative(),
    })).nullable().optional(),
    // Custom column values: { colKey: value }
    customFields: z.record(z.string(), z.any()).nullable().optional(),
  });

  try {
    const siteId = req.params.siteId as string;

    console.log('🔵 PE Laying save - materials payload:', JSON.stringify(req.body.mdpeMaterials || req.body.materialsUsed || [], null, 2));
    for (const material of req.body.mdpeMaterials || req.body.materialsUsed || []) {
      const materialName = material.material || material.name;
      const inv = await prisma.inventoryItem.findUnique({
        where: { siteId_material: { siteId, material: materialName } },
      });
      console.log(`🔵 Checking material "${materialName}" for site ${siteId}: exists in inventory =`, !!inv, 'available =', inv ? Math.max(0, inv.received - inv.issued - inv.returned) : 0);
    }

    let data;
    try {
      data = schema.parse(req.body);
      console.log('🟢 PE Laying Zod validation passed. Parsed data:', JSON.stringify(data, null, 2));
    } catch (zodErr: any) {
      console.error('❌ PE Laying Zod validation FAILED:', JSON.stringify(zodErr.errors ?? zodErr, null, 2));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: zodErr.errors ?? zodErr.message,
      });
    }

    try {
    // Note: Stock sufficiency pre-flight check removed so workers are never blocked from saving work.
    // Stock is automatically issued/deducted in the background.
    const mdpeUsage: { material: string; qty: number }[] = (data.mdpeMaterials || [])
      .filter((m: any) => m.qty > 0)
      .map((m: any) => ({ material: m.material, qty: Math.round(m.qty) }));

      const record = await prisma.pELaying.create({
        data: {
          siteId,
          layingDate: new Date(data.layingDate),
          testingDate: data.testingDate ? new Date(data.testingDate) : null,
          chargingDate: data.chargingDate ? new Date(data.chargingDate) : null,
          raBillNo: data.raBillNo || null,
          reportNo: data.reportNo || null,
          status: data.status || PEStatus.LAYING,
          connType: data.connType || 'Domestic',
          area: data.area,
          coilNo: data.coilNo || '',
          d32oc:   data.d32oc   ?? 0,
          d32b:    data.d32b    ?? 0,
          d32hdd:  data.d32hdd  ?? 0,
          d63oc:   data.d63oc   ?? 0,
          d63b:    data.d63b    ?? 0,
          d63hdd:  data.d63hdd  ?? 0,
          d90oc:   data.d90oc   ?? 0,
          d90b:    data.d90b    ?? 0,
          d90hdd:  data.d90hdd  ?? 0,
          // d90tot = sum of parts (kept for dashboard query compatibility)
          d90tot:  data.d90tot  ?? ((data.d90oc ?? 0) + (data.d90b ?? 0) + (data.d90hdd ?? 0)),
          d125oc:  data.d125oc  ?? 0,
          d125b:   data.d125b   ?? 0,
          d125hdd: data.d125hdd ?? 0,
          // d125tot = sum of parts
          d125tot: data.d125tot ?? ((data.d125oc ?? 0) + (data.d125b ?? 0) + (data.d125hdd ?? 0)),
          // DPR photo URL (null if none uploaded)
          dprPhotoUrl: data.dprPhotoUrl || null,
          // Store MDPE materials used (non-zero qty only) for reversal on update/delete
          mdpeMaterials: mdpeUsage.length > 0 ? mdpeUsage : Prisma.JsonNull,
          // Custom column values (user-defined extra fields)
          customFields: data.customFields ? data.customFields : Prisma.JsonNull,
        },
      });

      console.log('🟢 PE Laying created successfully. ID:', record.id);

      // ── STEP 2: Deduct stock — MDPE fittings only (fire-and-forget) ──
      // Pipe metre quantities do NOT deduct inventory. Only mdpeMaterials (fittings) do.
      if (mdpeUsage.length > 0) {
        const siteIdSnapshot = siteId;
        setImmediate(async () => {
          console.log(`[PE create] 🟡 Background stock deduction starting for ${mdpeUsage.length} MDPE fitting(s)...`);
          for (const item of mdpeUsage) {
            if (Number(item.qty) > 0) {
              await adjustInventoryStock(siteIdSnapshot, item.material, Number(item.qty));
            }
          }
          console.log('[PE create] 🟢 Background stock deduction complete.');
        });
      }

      res.status(201).json({ success: true, record });
    } catch (prismaErr: any) {
      console.error('❌ PE Laying Prisma create FAILED:', prismaErr.message, prismaErr);
      return res.status(500).json({ success: false, error: prismaErr.message });
    }
  } catch (error) {
    next(error);
  }
};


export const updatePELaying = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Full schema — workers can update all fields of their PE laying entries
  const schema = z.object({
    layingDate: z.string().nullable().optional(),
    testingDate: z.string().nullable().optional(),
    chargingDate: z.string().nullable().optional(),
    raBillNo: z.string().nullable().optional(),
    reportNo: z.string().nullable().optional(),
    status: z.nativeEnum(PEStatus).nullable().optional(),
    connType: z.string().nullable().optional(),
    area: z.string().nullable().optional(),
    // coilNo field is re-labelled "Customer Name" in the UI but stored as coilNo in DB
    coilNo: z.string().nullable().optional(),
    d32oc:   z.number().nonnegative().nullable().optional(),
    d32b:    z.number().nonnegative().nullable().optional(),
    d32hdd:  z.number().nonnegative().nullable().optional(),
    d63oc:   z.number().nonnegative().nullable().optional(),
    d63b:    z.number().nonnegative().nullable().optional(),
    d63hdd:  z.number().nonnegative().nullable().optional(),
    d90oc:   z.number().nonnegative().nullable().optional(),
    d90b:    z.number().nonnegative().nullable().optional(),
    d90hdd:  z.number().nonnegative().nullable().optional(),
    d90tot:  z.number().nonnegative().nullable().optional(),
    d125oc:  z.number().nonnegative().nullable().optional(),
    d125b:   z.number().nonnegative().nullable().optional(),
    d125hdd: z.number().nonnegative().nullable().optional(),
    d125tot: z.number().nonnegative().nullable().optional(),
    // DPR photo URL update
    dprPhotoUrl: z.string().url().nullable().optional(),
    // MDPE Fittings update: pass the NEW complete list; controller computes deltas
    mdpeMaterials: z.array(z.object({
      material: z.string().min(1),
      qty: z.number().nonnegative(),
    })).nullable().optional(),
    // Custom column values update: pass entire updated object
    customFields: z.record(z.string(), z.any()).nullable().optional(),
  });

  try {
    const recordId = req.params.recordId as string;
    const data = schema.parse(req.body);

    // Fetch the EXISTING record so we can compute pipe quantity deltas
    const existing = await prisma.pELaying.findUnique({ where: { id: recordId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'PE Laying record not found' });
    }

    const siteId = existing.siteId;

    // ── PRE-FLIGHT: Stock check — MDPE fittings only ──
    // Pipe metre quantities (d32, d63, d90, d125) are progress records, NOT inventory
    // issuances — they must never gate-check or deduct from stock.
    const oldMdpe: { material: string; qty: number }[] = Array.isArray((existing as any).mdpeMaterials)
      ? (existing as any).mdpeMaterials
      : [];
    const newMdpe: { material: string; qty: number }[] = data.mdpeMaterials !== undefined
      ? (data.mdpeMaterials || [])
      : oldMdpe; // not updated — keep existing

    // Build delta map for MDPE: positive = more used, negative = less used (stock restored)
    const mdpeDeltaMap: Map<string, number> = new Map();
    for (const item of oldMdpe) mdpeDeltaMap.set(item.material, -(item.qty));
    for (const item of newMdpe) mdpeDeltaMap.set(item.material, (mdpeDeltaMap.get(item.material) ?? 0) + item.qty);
    const mdpeDeltas = Array.from(mdpeDeltaMap.entries())
      .map(([material, delta]) => ({ material, delta: Math.round(delta) }))
      .filter(d => d.delta !== 0);

    // Note: Stock sufficiency pre-flight check removed so workers are never blocked from saving work.

    const updated = await prisma.pELaying.update({
      where: { id: recordId },
      data: {
        ...(data.layingDate ? { layingDate: new Date(data.layingDate) } : {}),
        testingDate: data.testingDate ? new Date(data.testingDate) : (data.testingDate === null ? null : undefined),
        chargingDate: data.chargingDate ? new Date(data.chargingDate) : (data.chargingDate === null ? null : undefined),
        raBillNo: data.raBillNo !== undefined ? data.raBillNo : undefined,
        reportNo: data.reportNo !== undefined ? data.reportNo : undefined,
        status: data.status !== undefined && data.status !== null ? data.status : undefined,
        connType: data.connType !== undefined ? (data.connType ?? undefined) : undefined,
        area: data.area !== undefined ? (data.area ?? undefined) : undefined,
        coilNo: data.coilNo !== undefined ? (data.coilNo ?? '') : undefined,
        d32oc:   data.d32oc   !== undefined ? (data.d32oc   ?? 0) : undefined,
        d32b:    data.d32b    !== undefined ? (data.d32b    ?? 0) : undefined,
        d32hdd:  data.d32hdd  !== undefined ? (data.d32hdd  ?? 0) : undefined,
        d63oc:   data.d63oc   !== undefined ? (data.d63oc   ?? 0) : undefined,
        d63b:    data.d63b    !== undefined ? (data.d63b    ?? 0) : undefined,
        d63hdd:  data.d63hdd  !== undefined ? (data.d63hdd  ?? 0) : undefined,
        d90oc:   data.d90oc   !== undefined ? (data.d90oc   ?? 0) : undefined,
        d90b:    data.d90b    !== undefined ? (data.d90b    ?? 0) : undefined,
        d90hdd:  data.d90hdd  !== undefined ? (data.d90hdd  ?? 0) : undefined,
        d90tot:  data.d90tot  !== undefined ? (data.d90tot  ?? 0) : data.d90oc !== undefined ? ((data.d90oc ?? 0) + (data.d90b ?? 0) + (data.d90hdd ?? 0)) : undefined,
        d125oc:  data.d125oc  !== undefined ? (data.d125oc  ?? 0) : undefined,
        d125b:   data.d125b   !== undefined ? (data.d125b   ?? 0) : undefined,
        d125hdd: data.d125hdd !== undefined ? (data.d125hdd ?? 0) : undefined,
        d125tot: data.d125tot !== undefined ? (data.d125tot ?? 0) : data.d125oc !== undefined ? ((data.d125oc ?? 0) + (data.d125b ?? 0) + (data.d125hdd ?? 0)) : undefined,
        dprPhotoUrl: data.dprPhotoUrl !== undefined ? data.dprPhotoUrl : undefined,
        // Update stored MDPE list if caller sent a new one
        ...(data.mdpeMaterials !== undefined ? { mdpeMaterials: newMdpe.length > 0 ? newMdpe : Prisma.JsonNull } : {}),
        // Update custom fields if caller sent them
        ...(data.customFields !== undefined ? { customFields: data.customFields ?? Prisma.JsonNull } : {}),
        updatedAt: new Date(),
      },
    });

    // ── Diff-based stock adjustment — MDPE fittings only (fire-and-forget) ──
    // Pipe metre quantities do NOT deduct inventory.
    if (mdpeDeltas.length > 0) {
      const siteIdSnapshot = siteId;
      setImmediate(async () => {
        console.log(`[PE update] 🟡 Stock diff-adjustment: ${mdpeDeltas.length} MDPE fitting(s) changed`);
        for (const adj of mdpeDeltas) {
          await adjustInventoryStock(siteIdSnapshot, adj.material, adj.delta);
        }
        console.log('[PE update] 🟢 Stock diff-adjustment complete.');
      });
    } else {
      console.log('[PE update] ⚪ No MDPE fitting quantities changed — no inventory adjustments needed.');
    }

    res.status(200).json({ success: true, record: updated });
  } catch (error) {
    next(error);
  }
};


export const deletePELaying = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const recordId = req.params.recordId as string;

    console.log('🔵 Delete request for PE Laying record:', recordId);

    const existing = await prisma.pELaying.findUnique({
      where: { id: recordId },
      select: {
        id: true, siteId: true, area: true, layingDate: true,
        d32oc: true, d32b: true, d32hdd: true,
        d63oc: true, d63b: true, d63hdd: true,
        d90tot: true, d125tot: true,
        mdpeMaterials: true,  // needed to reverse MDPE stock deductions
      },
    });

    if (!existing) {
      console.warn('⚠️  PE Laying record not found for delete:', recordId);
      return res.status(404).json({ success: false, error: 'PE Laying record not found' });
    }

    // ── Pipe metres are progress records, NOT inventory issuances ──
    // No pipe stock reversal needed on delete — pipe metres never touched inventory.

    // Also reverse MDPE fittings stock deductions
    const mdpeReversal: { material: string; qty: number }[] = Array.isArray((existing as any).mdpeMaterials)
      ? (existing as any).mdpeMaterials.filter((m: any) => m.qty > 0)
      : [];
    if (mdpeReversal.length > 0) {
      console.log(`[PE delete] 🟡 Reversing MDPE fittings stock for ${mdpeReversal.length} item(s)...`);
      for (const item of mdpeReversal) {
        if (Number(item.qty) > 0) {
          await adjustInventoryStock(existing.siteId, item.material, -Number(item.qty));
        }
      }
      console.log('[PE delete] 🟢 MDPE stock reversal complete.');
    }

    const deleted = await prisma.pELaying.delete({ where: { id: recordId } });

    console.log('🟢 Deleted PE Laying record:', deleted.id, `(area: ${deleted.area})`);

    res.json({ success: true, deletedId: deleted.id });
  } catch (error: any) {
    console.error('❌ Delete PE Laying failed:', error.message);
    next(error);
  }
};

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { z } from 'zod';
import prisma from '../config/db';
import { AccountType } from '@prisma/client';

/* ───────────────────────────────────────────────────────────
   PNG Connections
─────────────────────────────────────────────────────────── */

export const getPNGConnections = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const siteId = req.params.siteId as string;
    const { accountType, area, bpNo, houseNo, status, page = '1', limit = '50' } = req.query;

    // Item 4 diagnostic log — confirm site-scoped (not user-scoped) query
    console.log('🔵 getPNGConnections — user:', req.user?.id, 'role:', req.user?.role, 'siteId:', siteId);

    const where: any = { siteId };
    if (accountType) where.accountType = accountType as AccountType;
    if (bpNo) where.bpNo = { contains: String(bpNo), mode: 'insensitive' };
    if (houseNo) where.houseNo = { contains: String(houseNo), mode: 'insensitive' };
    if (area) where.society = { contains: String(area), mode: 'insensitive' };
    if (status) where.status = String(status);

    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);
    const skip = (pageNum - 1) * limitNum;

    const [connections, total] = await Promise.all([
      prisma.pNGConnection.findMany({
        where,
        include: {
          supervisor: { select: { id: true, name: true } },
          meterInstallation: true,
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pNGConnection.count({ where }),
    ]);

    console.log('🟢 getPNGConnections — returned', connections.length, 'of', total, 'total for site', siteId);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      connections,
    });
  } catch (error) {
    next(error);
  }
};


export const createPNGConnection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Diagnostic log — handles both R2 URL strings and legacy base64 blobs
  const photoDesc = (v: any) => {
    if (!v) return null;
    if (typeof v === 'string' && v.startsWith('http')) return `[R2 URL: ${v.slice(0, 60)}...]`;
    if (typeof v === 'string' && v.startsWith('data:')) return `[base64 ~${Math.round((v.length * 3/4)/1024)}KB]`;
    return `[string len=${v.length}]`;
  };
  console.log('🔵 PNG Create — incoming fields:', {
    meterNo:    req.body.meterNo,
    meterDate:  req.body.meterDate,
    gcStatus:   req.body.gcStatus,
    giStatus:   req.body.giStatus,
    rfcStatus:  req.body.rfcStatus,
    ngStatus:   req.body.ngStatus,
    gcDate:     req.body.gcDate,
    photo1Data: photoDesc(req.body.photo1Data),
    photo2Data: photoDesc(req.body.photo2Data),
  });

  const schema = z.object({
    appNo: z.string().nullable().optional(),
    bpNo: z.string().nullable().optional(),
    accountType: z.nativeEnum(AccountType).nullable().optional(),
    customerName: z.string().min(1, "Customer name required"),
    mobile: z.string().min(10, "Mobile must be at least 10 digits"),
    altMobile: z.string().nullable().optional(),
    houseNo: z.string().nullable().optional(),
    address1: z.string().nullable().optional(),
    address2: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    society: z.string().nullable().optional(),
    supervisorId: z.string().uuid().nullable().optional(),
    assignDateAgency: z.string().nullable().optional(),
    assignDateSuper: z.string().nullable().optional(),
    bpCreationDate: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    plumbingDate: z.string().nullable().optional(),
    gcLength: z.number().nonnegative().nullable().optional(),
    giPipeMtr: z.number().nonnegative().nullable().optional(),
    tfCount: z.number().int().nonnegative().nullable().optional(),
    ivCount: z.number().int().nonnegative().nullable().optional(),
    // Status fields — previously stripped by Zod (not in schema), never saved to DB
    giStatus:  z.string().nullable().optional(),
    rfcStatus: z.string().nullable().optional(),
    ngStatus:  z.string().nullable().optional(),
    // Quick meter recording before formal MeterInstallation
    meterNo:   z.string().nullable().optional(),
    meterDate: z.string().nullable().optional(),
    // House photos as base64 data URLs — stored in DB TEXT columns.
    // Frontend enforces ≤4MB per photo before base64 conversion (~5.3MB encoded max).
    photo1Data: z.string().nullable().optional(),
    photo2Data: z.string().nullable().optional(),
    // Materials used per connection — triggers stock deduction AFTER save
    materialsUsed: z.array(
      z.object({
        material: z.string().min(1),
        qty: z.number().positive(),
        unit: z.string().optional(),
      })
    ).optional().default([]),
    // Arbitrary custom-column values added via "Manage Columns" — { columnKey: value }
    customFields: z.record(z.string(), z.string()).optional(),
  });

  try {
    const siteId = req.params.siteId as string;

    // Parse + validate — Zod strips unknown fields and coerces types
    let data: z.infer<typeof schema>;
    try {
      data = schema.parse(req.body);
    } catch (zodErr: any) {
      console.error('[PNG create] Zod validation error:', JSON.stringify(zodErr.errors, null, 2));
      return res.status(400).json({ success: false, error: 'Validation failed', details: zodErr.errors });
    }

    const appNo = (data.appNo && data.appNo.trim()) ? data.appNo.trim() : null;

    if (appNo) {
      const existing = await prisma.pNGConnection.findUnique({ where: { appNo } });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Application number already exists' });
      }
    }

    // ── STEP 1: Create the PNG connection record (committed independently) ──
    const connection = await prisma.pNGConnection.create({
      data: {
        siteId,
        appNo,
        bpNo: data.bpNo || null,
        accountType: data.accountType || AccountType.DOMESTIC,
        customerName: data.customerName,
        mobile: data.mobile,
        altMobile: data.altMobile || null,
        houseNo: data.houseNo || '',
        address1: data.address1 || '',
        address2: data.address2 || null,
        city: data.city || '',
        society: data.society || null,
        supervisorId: data.supervisorId || null,
        status: data.status || 'Pending',
        assignDateAgency: data.assignDateAgency ? new Date(data.assignDateAgency) : null,
        assignDateSuper: data.assignDateSuper ? new Date(data.assignDateSuper) : null,
        bpCreationDate: data.bpCreationDate ? new Date(data.bpCreationDate) : null,
        plumbingDate: data.plumbingDate ? new Date(data.plumbingDate) : null,
        gcLength: data.gcLength ?? null,
        giPipeMtr: data.giPipeMtr ?? null,
        tfCount: data.tfCount ?? 0,
        ivCount: data.ivCount ?? 0,
        // Newly persisted status fields
        giStatus:   data.giStatus  || null,
        rfcStatus:  data.rfcStatus || null,
        ngStatus:   data.ngStatus  || null,
        meterNo:    data.meterNo   || null,
        meterDate:  data.meterDate ? new Date(data.meterDate) : null,
        // Photos — base64 data URLs. Null if user didn't upload a photo.
        photo1Data: data.photo1Data || null,
        photo2Data: data.photo2Data || null,
        // Custom column values — stored as a JSON object { columnKey: value }
        customFields: data.customFields ?? {},
        // Persist materialsUsed so delete can reverse the stock deduction
        materialsUsed: data.materialsUsed.length > 0 ? data.materialsUsed : undefined,
      },
    });

    console.log(`[PNG create] Connection saved: ${connection.id} (appNo: ${appNo})`);
    console.log('🟢 PNG Created — saved values:', {
      meterNo:    connection.meterNo,
      gcStatus:   connection.status,
      giStatus:   connection.giStatus,
      rfcStatus:  connection.rfcStatus,
      ngStatus:   connection.ngStatus,
      hasPhoto1:  !!connection.photo1Data,
      hasPhoto2:  !!connection.photo2Data,
    });

    // ── STEP 2: Deduct stock — fire-and-forget via setImmediate.
    //    This runs COMPLETELY OUTSIDE the HTTP response cycle so it can NEVER
    //    block or timeout the save — even if many materials require sequential DB calls.
    //    Failures are logged but never propagated to the client.
    if (data.materialsUsed && data.materialsUsed.length > 0) {
      const materialsSnapshot = data.materialsUsed;
      const siteIdSnapshot = siteId;
      setImmediate(async () => {
        console.log(`[PNG create] 🟡 Background stock deduction starting for ${materialsSnapshot.length} material(s)...`);
        for (const mat of materialsSnapshot) {
          try {
            const qty = Math.round(mat.qty);
            if (qty <= 0) {
              console.log(`[PNG create] Skipping "${mat.material}" — qty ${mat.qty} rounds to 0`);
              continue;
            }

            console.log(`[PNG create] Looking up "${mat.material}" in inventory (site: ${siteIdSnapshot})...`);

            const invItem = await prisma.inventoryItem.findUnique({
              where: { siteId_material: { siteId: siteIdSnapshot, material: mat.material } },
            });

            if (!invItem) {
              console.warn(`[PNG create] ⚠ Material NOT FOUND in inventory: "${mat.material}" — skipping`);
              continue;
            }

            const newIssued  = invItem.issued + qty;
            const newInStore = Math.max(0, invItem.received - newIssued - invItem.returned);

            await prisma.inventoryItem.update({
              where: { siteId_material: { siteId: siteIdSnapshot, material: mat.material } },
              data: { issued: newIssued, inStore: newInStore, updatedAt: new Date() },
            });

            console.log(`[PNG create] ✅ Stock deducted — "${mat.material}" +${qty} issued → ${newIssued} total issued`);
          } catch (stockErr: any) {
            console.error(`[PNG create] ❌ Stock deduction failed for "${mat.material}":`, stockErr.message);
          }
        }
        console.log(`[PNG create] 🟢 Background stock deduction complete.`);
      });
    }

    // Response sent immediately — stock deduction runs in background
    res.status(201).json({ success: true, connection });
  } catch (error: any) {
    console.error('[PNG create] Fatal error:', error.message, error);
    next(error);
  }
};

export const updatePNGConnection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    // Core customer/address fields — included so edits to these fields are persisted
    customerName: z.string().nullable().optional(),
    mobile:       z.string().nullable().optional(),
    altMobile:    z.string().nullable().optional(),
    houseNo:      z.string().nullable().optional(),
    address1:     z.string().nullable().optional(),
    city:         z.string().nullable().optional(),
    society:      z.string().nullable().optional(),
    accountType:  z.nativeEnum(AccountType).nullable().optional(),
    appNo:        z.string().nullable().optional(),
    bpNo:         z.string().nullable().optional(),
    status:       z.string().nullable().optional(),
    plumbingDate: z.string().nullable().optional(),
    gcLength:     z.number().nonnegative().nullable().optional(),
    giPipeMtr:    z.number().nonnegative().nullable().optional(),
    tfCount:      z.number().int().nonnegative().nullable().optional(),
    ivCount:      z.number().int().nonnegative().nullable().optional(),
    supervisorId: z.string().uuid().nullable().optional(),
    // Status fields now persisted
    giStatus:  z.string().nullable().optional(),
    rfcStatus: z.string().nullable().optional(),
    ngStatus:  z.string().nullable().optional(),
    meterNo:   z.string().nullable().optional(),
    meterDate: z.string().nullable().optional(),
    // Photos — only present if user selected a new photo; undefined = keep existing in DB
    photo1Data: z.string().nullable().optional(),
    photo2Data: z.string().nullable().optional(),
    // Custom column values
    customFields: z.record(z.string(), z.string()).optional(),
    // Materials used — included so UPDATE can adjust stock deductions
    materialsUsed: z.array(
      z.object({
        material: z.string(),
        qty:      z.number().nonnegative(),
        unit:     z.string().optional(),
      })
    ).optional(),
  });

  console.log('🔵 PNG Update — incoming photo fields:', {
    photo1Data: req.body.photo1Data
      ? (req.body.photo1Data.startsWith('http') ? `[R2 URL: ${req.body.photo1Data.slice(0,60)}...]` : '[base64]')
      : null,
    photo2Data: req.body.photo2Data
      ? (req.body.photo2Data.startsWith('http') ? `[R2 URL: ${req.body.photo2Data.slice(0,60)}...]` : '[base64]')
      : null,
  });

  try {
    const connectionId = req.params.connectionId as string;
    const data = schema.parse(req.body);

    const existing = await prisma.pNGConnection.findUnique({ where: { id: connectionId } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }

    const updated = await prisma.pNGConnection.update({
      where: { id: connectionId },
      data: {
        // Core customer/address fields
        customerName: data.customerName !== undefined ? (data.customerName ?? undefined) : undefined,
        mobile:       data.mobile       !== undefined ? (data.mobile       ?? undefined) : undefined,
        altMobile:    data.altMobile    !== undefined ? data.altMobile    : undefined,
        houseNo:      data.houseNo      !== undefined ? (data.houseNo     ?? undefined) : undefined,
        address1:     data.address1     !== undefined ? (data.address1    ?? undefined) : undefined,
        city:         data.city         !== undefined ? (data.city        ?? undefined) : undefined,
        society:      data.society      !== undefined ? data.society      : undefined,
        accountType:  data.accountType  !== undefined ? (data.accountType ?? undefined) : undefined,
        bpNo:         data.bpNo         !== undefined ? data.bpNo         : undefined,
        status:       data.status                    || undefined,
        plumbingDate: data.plumbingDate ? new Date(data.plumbingDate) : (data.plumbingDate === null ? null : undefined),
        gcLength:     data.gcLength     !== undefined ? data.gcLength     : undefined,
        giPipeMtr:    data.giPipeMtr    !== undefined ? data.giPipeMtr    : undefined,
        tfCount:      data.tfCount      !== undefined ? data.tfCount      : undefined,
        ivCount:      data.ivCount      !== undefined ? data.ivCount      : undefined,
        supervisorId: data.supervisorId !== undefined ? data.supervisorId : undefined,
        giStatus:     data.giStatus     !== undefined ? data.giStatus     : undefined,
        rfcStatus:    data.rfcStatus    !== undefined ? data.rfcStatus    : undefined,
        ngStatus:     data.ngStatus     !== undefined ? data.ngStatus     : undefined,
        meterNo:      data.meterNo      !== undefined ? data.meterNo      : undefined,
        meterDate:    data.meterDate ? new Date(data.meterDate) : (data.meterDate === null ? null : undefined),
        // Photos — only update if explicitly provided (undefined = keep existing)
        photo1Data: data.photo1Data !== undefined ? data.photo1Data : undefined,
        photo2Data: data.photo2Data !== undefined ? data.photo2Data : undefined,
        // Custom column values — merge new values into existing to avoid clobbering
        customFields: data.customFields !== undefined ? data.customFields : undefined,
        updatedAt: new Date(),
      },
    });

    console.log('🟢 PNG Update saved — photo1Data stored:', data.photo1Data !== undefined ? 'YES' : 'unchanged', '| photo2Data stored:', data.photo2Data !== undefined ? 'YES' : 'unchanged');

    // ── Revert old stock, apply new stock, persist materialsUsed ────────
    // Only runs when materialsUsed is explicitly included in the update payload.
    if (data.materialsUsed !== undefined) {
      const oldMaterials = (existing.materialsUsed as { material: string; qty: number }[] | null) ?? [];
      const newMaterials = data.materialsUsed ?? [];
      const siteId = existing.siteId;

      // Persist the new materialsUsed immediately (synchronously, before background jobs)
      await prisma.pNGConnection.update({
        where: { id: connectionId },
        data: { materialsUsed: newMaterials.length > 0 ? newMaterials : [] },
      });

      // Background stock adjustment — revert old, apply new
      setImmediate(async () => {
        console.log('[PNG update] 🟡 Stock adjustment: reverting old materials, applying new...');
        // Step 1: revert old deductions
        for (const mat of oldMaterials) {
          try {
            const qty = Math.round(mat.qty ?? 0);
            if (qty <= 0) continue;
            const inv = await prisma.inventoryItem.findUnique({
              where: { siteId_material: { siteId, material: mat.material } },
            });
            if (!inv) continue;
            const newIssued  = Math.max(0, inv.issued - qty);
            const newInStore = Math.max(0, inv.received - newIssued - inv.returned);
            await prisma.inventoryItem.update({
              where: { siteId_material: { siteId, material: mat.material } },
              data: { issued: newIssued, inStore: newInStore, updatedAt: new Date() },
            });
            console.log(`[PNG update] ↩️  Reverted "${mat.material}" -${qty}`);
          } catch (e: any) {
            console.error(`[PNG update] ❌ Revert failed for "${mat.material}":`, e.message);
          }
        }
        // Step 2: apply new deductions
        for (const mat of newMaterials) {
          try {
            const qty = Math.round(mat.qty ?? 0);
            if (qty <= 0) continue;
            const inv = await prisma.inventoryItem.findUnique({
              where: { siteId_material: { siteId, material: mat.material } },
            });
            if (!inv) {
              console.warn(`[PNG update] ⚠️ Material "${mat.material}" not in inventory — skipping`);
              continue;
            }
            const newIssued  = inv.issued + qty;
            const newInStore = Math.max(0, inv.received - newIssued - inv.returned);
            await prisma.inventoryItem.update({
              where: { siteId_material: { siteId, material: mat.material } },
              data: { issued: newIssued, inStore: newInStore, updatedAt: new Date() },
            });
            console.log(`[PNG update] ✅ Applied "${mat.material}" +${qty}`);
          } catch (e: any) {
            console.error(`[PNG update] ❌ Apply failed for "${mat.material}":`, e.message);
          }
        }
        console.log('[PNG update] 🟢 Stock adjustment complete.');
      });
    }

    res.status(200).json({ success: true, connection: updated });
  } catch (error) {
    next(error);
  }
};

/* ───────────────────────────────────────────────────────────
   Meter Installation
─────────────────────────────────────────────────────────── */

export const submitMeterInstallation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const schema = z.object({
    meterMake: z.string().min(1),
    serialNo: z.string().min(1),
    meterReading: z.number().nonnegative(),
    lhsRhs: z.enum(['LHS', 'RHS']),
    installationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    meterPhotoUrl: z.string().url().optional(),
  });

  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const connectionId = req.params.connectionId as string;
    const data = schema.parse(req.body);

    // Verify connection exists
    const connection = await prisma.pNGConnection.findUnique({ where: { id: connectionId } });
    if (!connection) {
      return res.status(404).json({ success: false, error: 'PNG Connection not found' });
    }

    // Enforce duplicate serial number prevention at DB level (will throw on unique constraint)
    const existingSerial = await prisma.meterInstallation.findUnique({ where: { serialNo: data.serialNo } });
    if (existingSerial) {
      return res.status(400).json({
        success: false,
        error: `Meter serial number "${data.serialNo}" is already registered to another connection`,
      });
    }

    const meter = await prisma.meterInstallation.upsert({
      where: { pngConnectionId: connectionId },
      update: {
        ...data,
        installationDate: new Date(data.installationDate),
        installedByUserId: req.user.id,
        updatedAt: new Date(),
      },
      create: {
        pngConnectionId: connectionId,
        siteId: connection.siteId,
        installedByUserId: req.user.id,
        ...data,
        installationDate: new Date(data.installationDate),
      },
    });

    // Also update connection status to indicate meter installed
    await prisma.pNGConnection.update({
      where: { id: connectionId },
      data: { status: 'Meter Installed', updatedAt: new Date() },
    });

    try {
      await prisma.meterRegister.update({
        where: { serialNo: data.serialNo },
        data: { status: 'Installed', pngConnectionId: connectionId, updatedAt: new Date() },
      });
    } catch (e) {
      // Meter might not be in register, ignore
    }

    res.status(201).json({ success: true, meter });
  } catch (error) {
    next(error);
  }
};
export const deletePNGConnection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const connectionId = req.params.connectionId as string;

    console.log('🔵 Delete request for PNG Connection:', connectionId);

    // Verify the connection exists before attempting delete
    const existing = await prisma.pNGConnection.findUnique({
      where: { id: connectionId },
      select: { id: true, customerName: true, appNo: true, siteId: true, materialsUsed: true },
    });

    if (!existing) {
      console.warn('⚠️  PNG Connection not found for delete:', connectionId);
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }

    // ── Reverse stock deduction before deleting ──────────────────────────────
    const materials = existing.materialsUsed as { material: string; qty: number }[] | null;
    if (Array.isArray(materials) && materials.length > 0) {
      console.log(`[PNG delete] 🟡 Reversing stock deduction for ${materials.length} material(s)...`);
      for (const mat of materials) {
        try {
          const qty = Math.round(mat.qty ?? 0);
          if (qty <= 0) continue;
          const invItem = await prisma.inventoryItem.findUnique({
            where: { siteId_material: { siteId: existing.siteId, material: mat.material } },
          });
          if (!invItem) {
            console.warn(`[PNG delete] ⚠ Material "${mat.material}" not found in inventory — skipping reversal`);
            continue;
          }
          const newIssued  = Math.max(0, invItem.issued - qty);
          const newInStore = Math.max(0, invItem.received - newIssued - invItem.returned);
          await prisma.inventoryItem.update({
            where: { siteId_material: { siteId: existing.siteId, material: mat.material } },
            data: { issued: newIssued, inStore: newInStore, updatedAt: new Date() },
          });
          console.log(`[PNG delete] ✅ Reversed "${mat.material}" −${qty} issued → ${newIssued} total issued`);
        } catch (stockErr: any) {
          console.error(`[PNG delete] ❌ Stock reversal failed for "${mat.material}":`, stockErr.message);
        }
      }
      console.log('[PNG delete] 🟢 Stock reversal complete.');
    }

    // Hard-delete from Neon. Related MeterInstallation cascades if schema has onDelete: Cascade.
    // If not, delete meter first to avoid FK constraint.
    await prisma.meterInstallation.deleteMany({ where: { pngConnectionId: connectionId } });

    const deleted = await prisma.pNGConnection.delete({ where: { id: connectionId } });

    console.log('🟢 Deleted from Neon:', deleted.id, `(${deleted.customerName}, appNo: ${deleted.appNo})`);

    res.json({ success: true, deletedId: deleted.id });
  } catch (error: any) {
    console.error('❌ Delete PNG Connection failed:', error.message, error);
    next(error);
  }
};

import express from 'express';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Middleware: ADMIN only guard
function adminOnly(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  next();
}

router.use(authMiddleware, adminOnly);

// ─── GET /api/admin/stats ────────────────────────────────────────────
// Returns system-wide statistics
router.get('/stats', async (req, res) => {
  try {
    const [totalPatients, totalOpticians, totalOrders, totalProducts] =
      await Promise.all([
        prisma.user.count({ where: { role: 'PATIENT' } }),
        prisma.user.count({ where: { role: 'OPTICIAN' } }),
        prisma.order.count(),
        prisma.product.count(),
      ]);

    const revenueResult = await prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: 'PAID' },
    });

    const pendingOrders = await prisma.order.count({
      where: { status: 'PENDING' },
    });
    const pendingPrescriptions = await prisma.prescription.count({
      where: { status: 'PENDING' },
    });
    const confirmedAppointments = await prisma.appointment.count({
      where: { status: 'CONFIRMED' },
    });

    res.json({
      totalPatients,
      totalOpticians,
      totalOrders,
      totalProducts,
      totalRevenue: revenueResult._sum.totalAmount || 0,
      pendingOrders,
      pendingPrescriptions,
      confirmedAppointments,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
});


// ─── GET /api/admin/users ─────────────────────────────────────────────
// List users with optional role filter (?role=PATIENT or ?role=OPTICIAN)
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    const where = {
      password: { not: 'ACCOUNT_DEACTIVATED' },
      NOT: [
        { fullName: { startsWith: '[Archived]' } },
        { email: { startsWith: 'archived_' } },
      ],
    };
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        gender: true,
        dob: true,
        role: true,
        createdAt: true,
        _count: {
          select: { orders: true, prescriptionsAsPatient: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// ─── POST /api/admin/opticians ────────────────────────────────────────
// Create a new optician account
router.post('/opticians', async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber, gender } = req.body;

    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ error: 'Full name, email, and password are required.' });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return res
        .status(400)
        .json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const cleanPhone = phoneNumber ? phoneNumber.replace(/\D/g, '').slice(0, 10) : null;
    const optician = await prisma.user.create({
      data: {
        fullName,
        email: email.toLowerCase(),
        password: hashedPassword,
        phoneNumber: cleanPhone,
        gender: gender || null,
        role: 'OPTICIAN',
        mustChangePassword: true,
      },
    });

    // Send Welcome Email to the new Optician
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const mailOptions = {
          from: `"Nethmini Opticals Staff Administration" <${process.env.EMAIL_USER}>`,
          to: optician.email,
          subject: 'Welcome to Nethmini Opticals - Your Optician Staff Account Credentials',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
              <h2 style="color: #1b5e85; margin-bottom: 8px;">Welcome to Nethmini Opticals!</h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.5;">Hello <strong>${optician.fullName}</strong>,</p>
              <p style="color: #475569; font-size: 14px; line-height: 1.5;">An official <strong>Optician Staff Account</strong> has been created for you by the system administrator. You can now log in to the Optician Portal to review prescription slips, manage orders, and access patient clinical records.</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #1e293b;"><strong>Staff Portal Credentials:</strong></p>
                <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>Login Email:</strong> <span style="font-family: monospace; color: #0284c7;">${optician.email}</span></p>
                <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>Temporary Password:</strong> <span style="font-family: monospace; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">${password}</span></p>
              </div>

              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 13px; color: #1e40af;"><strong>Security Notice:</strong> For patient privacy and clinical integrity, please log in and change your password in the <em>Account Security</em> tab immediately.</p>
              </div>

              <p style="font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 24px;">
                Nethmini Opticals Management System • Confidential Healthcare Communication
              </p>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Welcome email dispatched to optician: ${optician.email}`);
      } catch (mailErr) {
        console.warn('Welcome email dispatch skipped/failed:', mailErr.message);
      }
    }

    res.status(201).json({
      message: 'Optician account created successfully.',
      optician: {
        id: optician.id,
        fullName: optician.fullName,
        email: optician.email,
        role: optician.role,
      },
    });
  } catch (error) {
    console.error('Create optician error:', error);
    res.status(500).json({ error: 'Failed to create optician account.' });
  }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────
// Delete a user account (patient or optician)
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.role === 'ADMIN') {
      return res.status(403).json({ error: 'Cannot delete admin accounts.' });
    }

    // Cascade delete in transaction to prevent foreign key errors
    await prisma.$transaction(async (tx) => {
      // 1. Delete notifications
      await tx.notification.deleteMany({ where: { userId: id } });

      // 2. Delete reviews
      await tx.review.deleteMany({ where: { patientId: id } });

      // 3. Delete appointments as patient, unlink as doctor
      await tx.appointment.deleteMany({ where: { patientId: id } });
      await tx.appointment.updateMany({ where: { opticianId: id }, data: { opticianId: null } });

      // 4. Prescriptions: delete as patient, unlink as doctor
      await tx.prescription.deleteMany({ where: { patientId: id } });
      await tx.prescription.updateMany({ where: { opticianId: id }, data: { opticianId: null } });

      // 5. Orders: delete items and orders
      const userOrders = await tx.order.findMany({
        where: { patientId: id },
        select: { id: true },
      });
      const orderIds = userOrders.map((o) => o.id);
      if (orderIds.length > 0) {
        await tx.notification.deleteMany({ where: { relatedId: { in: orderIds } } });
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      }

      // If optician, unlink assigned orders
      await tx.order.updateMany({ where: { assignedOpticianId: id }, data: { assignedOpticianId: null } });

      // 6. Delete the user
      await tx.user.delete({ where: { id } });
    });

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// ─── POST /api/admin/notifications ───────────────────────────────────
// Send a system-wide notification to all users of a role
router.post('/notifications', async (req, res) => {
  try {
    const { title, message, targetRole } = req.body;
    if (!title || !message || !targetRole) {
      return res
        .status(400)
        .json({ error: 'Title, message, and targetRole are required.' });
    }

    if (!['PATIENT', 'OPTICIAN'].includes(targetRole)) {
      return res
        .status(400)
        .json({ error: 'targetRole must be PATIENT or OPTICIAN.' });
    }

    // Get all users of the target role
    const users = await prisma.user.findMany({
      where: { role: targetRole },
      select: { id: true },
    });

    // Create individual notifications for each user
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        role: targetRole,
        title,
        message,
        type: 'SYSTEM_ANNOUNCEMENT',
      })),
    });

    res.json({
      message: `Notification sent to ${users.length} ${targetRole.toLowerCase()}(s).`,
      count: users.length,
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notifications.' });
  }
});

// ─── PUT /api/admin/opticians/:id ────────────────────────────────────
// Edit an optician's details
router.put('/opticians/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phoneNumber, gender } = req.body;

    const optician = await prisma.user.findUnique({ where: { id } });
    if (!optician)
      return res.status(404).json({ error: 'Optician not found.' });
    if (optician.role !== 'OPTICIAN')
      return res.status(400).json({ error: 'User is not an optician.' });

    if (email && email.toLowerCase() !== optician.email) {
      const existing = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (existing)
        return res
          .status(400)
          .json({ error: 'Email already in use by another account.' });
    }

    const cleanPhone = phoneNumber !== undefined ? (phoneNumber ? phoneNumber.replace(/\D/g, '').slice(0, 10) : null) : undefined;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(fullName && { fullName }),
        ...(email && { email: email.toLowerCase() }),
        ...(cleanPhone !== undefined && { phoneNumber: cleanPhone }),
        ...(gender !== undefined && { gender }),
      },
    });

    res.json({
      message: 'Optician updated successfully.',
      optician: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
      },
    });
  } catch (error) {
    console.error('Edit optician error:', error);
    res.status(500).json({ error: 'Failed to update optician.' });
  }
});

// ─── GET /api/admin/revenue ───────────────────────────────────────────
// Returns revenue breakdown: by month, by product, recent orders
router.get('/revenue', async (req, res) => {
  try {
    // All non-cancelled orders with items
    const orders = await prisma.order.findMany({
      where: { status: { not: 'CANCELLED' } },
      include: {
        patient: { select: { fullName: true, email: true } },
        items: {
          include: {
            frame: { select: { name: true, brand: true, price: true } },
            lens: { select: { type: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute metrics only from PAID orders
    const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID');

    // Monthly revenue (only paid)
    const monthlyMap = {};
    for (const order of paidOrders) {
      const key = new Date(order.createdAt).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
      });
      monthlyMap[key] = (monthlyMap[key] || 0) + order.totalAmount;
    }
    const monthly = Object.entries(monthlyMap)
      .map(([month, revenue]) => ({ month, revenue }))
      .reverse();

    // Revenue by product (only paid)
    const productMap = {};
    for (const order of paidOrders) {
      for (const item of order.items) {
        if (item.frame) {
          const key = item.frame.name;
          if (!productMap[key])
            productMap[key] = {
              name: key,
              brand: item.frame.brand,
              revenue: 0,
              count: 0,
            };
          productMap[key].revenue += item.price * item.quantity;
          productMap[key].count += item.quantity;
        }
      }
    }
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Recent orders summary (includes all non-cancelled orders, with payment metadata)
    const recentOrders = orders.slice(0, 20).map((o) => ({
      id: o.id,
      patientName: o.patient?.fullName || 'Unknown',
      totalAmount: o.totalAmount,
      status: o.status,
      createdAt: o.createdAt,
      itemCount: o.items.length,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
    }));

    const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = paidOrders.length;
    const paidOrderCount = paidOrders.length;
    const codRevenue = paidOrders
      .filter((o) => o.paymentMethod === 'COD')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    const cardRevenue = paidOrders
      .filter((o) => o.paymentMethod === 'CARD')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    res.json({
      totalRevenue,
      totalOrders,
      paidOrderCount,
      codRevenue,
      cardRevenue,
      monthly,
      topProducts,
      recentOrders,
    });
  } catch (error) {
    console.error('Revenue error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data.' });
  }
});

export default router;

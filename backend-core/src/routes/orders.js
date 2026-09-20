import express from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// GET /api/orders
// Retrieve all orders for optician/admin, or only patient's orders for patient
router.get('/', async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let orders;
    if (userRole === 'PATIENT') {
      orders = await prisma.order.findMany({
        where: { patientId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          assignedOptician: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          patient: {
            select: {
              fullName: true,
              email: true,
              phoneNumber: true,
            },
          },
          items: {
            include: {
              frame: true,
              lens: true,
            },
          },
        },
      });
    } else {
      orders = await prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          assignedOptician: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          patient: {
            select: {
              fullName: true,
              email: true,
              phoneNumber: true,
            },
          },
          items: {
            include: {
              frame: true,
              lens: true,
            },
          },
        },
      });
    }

    // Enrich orders with holdReason and cancelReason from Notifications
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length > 0) {
      const notifications = await prisma.notification.findMany({
        where: {
          relatedId: { in: orderIds },
          type: { in: ['ORDER_HOLD', 'ORDER_CANCELLED'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      const notifMap = {};
      for (const n of notifications) {
        if (!notifMap[n.relatedId]) notifMap[n.relatedId] = {};
        const reason = n.message.includes(': ')
          ? n.message.split(': ').slice(1).join(': ')
          : n.message;
        if (n.type === 'ORDER_HOLD' && !notifMap[n.relatedId].holdReason) {
          notifMap[n.relatedId].holdReason = reason;
        }
        if (n.type === 'ORDER_CANCELLED' && !notifMap[n.relatedId].cancelReason) {
          notifMap[n.relatedId].cancelReason = reason;
        }
      }

      const enrichedOrders = orders.map((o) => ({
        ...o,
        holdReason: notifMap[o.id]?.holdReason || null,
        cancelReason: notifMap[o.id]?.cancelReason || null,
      }));

      return res.json(enrichedOrders);
    }

    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Server error retrieving orders.' });
  }
});

// POST /api/orders
// Place a new order with nested order items
router.post('/', async (req, res) => {
  let { items, frameId, lensId, quantity = 1, prescriptionId, shippingAddress, recipientName, recipientPhone, shippingCost = 0.0, paymentMethod = 'COD' } = req.body;

  let patientId = req.user.id;
  const isOpticianOrAdmin =
    req.user.role === 'OPTICIAN' || req.user.role === 'ADMIN';

  if (isOpticianOrAdmin && req.body.patientId) {
    patientId = req.body.patientId;
  }

  // Support backwards compatibility for single-item requests
  if (!items && frameId) {
    items = [{ frameId, lensId, quantity }];
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ error: 'Order items are required.' });
  }

  try {
    let totalAmount = 0.0;
    const validatedItems = [];

    // 1. Validate all items before touching the database
    for (const item of items) {
      const { frameId: fId, lensId: lId, quantity: qty = 1 } = item;

      if (!fId) {
        return res
          .status(400)
          .json({ error: 'Frame product ID (frameId) is required for each item.' });
      }

      // Verify frame product exists and check stock
      const product = await prisma.product.findUnique({
        where: { id: fId },
      });

      if (!product) {
        return res
          .status(404)
          .json({ error: `Frame product with ID ${fId} not found.` });
      }

      if (product.stockLevel < qty) {
        return res.status(400).json({
          error: `Insufficient stock for frame "${product.name}". Only ${product.stockLevel} items available.`,
        });
      }

      // Optional: If lensId is provided, verify lens exists and check stock
      let lens = null;
      if (lId) {
        lens = await prisma.lens.findUnique({
          where: { id: lId },
        });
        if (!lens) {
          return res
            .status(404)
            .json({ error: `Lens with ID ${lId} not found.` });
        }
        if (lens.stockLevel < qty) {
          return res.status(400).json({
            error: `Insufficient stock for lens "${lens.type}". Only ${lens.stockLevel} items available.`,
          });
        }
      }

      const framePrice = product.price;
      const lensPrice = lens ? lens.price : 0.0;
      const itemUnitPrice = framePrice + lensPrice;
      totalAmount += itemUnitPrice * qty;

      validatedItems.push({
        frameId: fId,
        lensId: lId || null,
        quantity: qty,
        price: itemUnitPrice, // unit price at checkout
      });
    }

    // 2. Execute database write transaction (Order + OrderItems + Stock Update)
    const newOrder = await prisma.$transaction(async (tx) => {
      // Create Order and nested OrderItems
      const order = await tx.order.create({
        data: {
          patientId: patientId,
          prescriptionId: prescriptionId || null,
          totalAmount: totalAmount + parseFloat(shippingCost || 0.0),
          status: 'PENDING',
          shippingAddress: shippingAddress || null,
          recipientName: recipientName || null,
          recipientPhone: recipientPhone ? recipientPhone.replace(/\D/g, '').slice(0, 10) : null,
          shippingCost: parseFloat(shippingCost || 0.0),
          paymentMethod: paymentMethod || 'COD',
          paymentStatus: 'PENDING',
          items: {
            create: validatedItems.map((item) => ({
              frameId: item.frameId,
              lensId: item.lensId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: {
          items: {
            include: {
              frame: true,
              lens: true,
            },
          },
        },
      });

      // Decrement stock levels for each item
      for (const item of validatedItems) {
        await tx.product.update({
          where: { id: item.frameId },
          data: {
            stockLevel: {
              decrement: item.quantity,
            },
          },
        });

        if (item.lensId) {
          await tx.lens.update({
            where: { id: item.lensId },
            data: {
              stockLevel: {
                decrement: item.quantity,
              },
            },
          });
        }
      }

      return order;
    });

    // Create a notification
    try {
      const patient = await prisma.user.findUnique({
        where: { id: patientId },
        select: { fullName: true },
      });
      const patientName = patient?.fullName || 'A patient';

      if (isOpticianOrAdmin) {
        await prisma.notification.create({
          data: {
            userId: patientId,
            title: 'New Order Created',
            message: `An order has been created for you by the optician. Total Amount: $${newOrder.totalAmount.toFixed(2)}.`,
            type: 'ORDER_CREATED',
            relatedId: newOrder.id,
          },
        });
      } else {
        await prisma.notification.create({
          data: {
            role: 'OPTICIAN',
            title: 'New Order Placed',
            message: `${patientName} placed a new order. Total Amount: $${newOrder.totalAmount.toFixed(2)}.`,
            type: 'ORDER_PLACED',
            relatedId: newOrder.id,
          },
        });
      }
    } catch (notifError) {
      console.error('Failed to create order notification:', notifError);
    }

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'Server error processing order placement.' });
  }
});

// DELETE /api/orders/:id
// Cancel a pending order and restore stock levels
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const patientId = req.user.id; // From authMiddleware

  try {
    // 1. Find the order with nested items
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: `Order with ID ${id} not found.` });
    }

    // 2. Security: Verify order belongs to the logged-in patient
    if (order.patientId !== patientId) {
      return res
        .status(403)
        .json({ error: 'Unauthorized to cancel this order.' });
    }

    // 3. Status check: Only PENDING orders can be cancelled
    if (order.status !== 'PENDING') {
      return res.status(400).json({
        error: `Cannot cancel an order with status: ${order.status}.`,
      });
    }

    // 4. Run database transaction to update status and restore stock levels
    const cancelledOrder = await prisma.$transaction(async (tx) => {
      // Update order status to CANCELLED
      const updated = await tx.order.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Restore stock levels for each item in the order
      for (const item of order.items) {
        if (item.frameId) {
          await tx.product.update({
            where: { id: item.frameId },
            data: {
              stockLevel: {
                increment: item.quantity,
              },
            },
          });
        }
        if (item.lensId) {
          await tx.lens.update({
            where: { id: item.lensId },
            data: {
              stockLevel: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      return updated;
    });

    res.json({
      message: 'Order cancelled successfully',
      order: cancelledOrder,
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res
      .status(500)
      .json({ error: 'Server error processing order cancellation.' });
  }
});

// PUT /api/orders/:id/claim
// Claim an order for fabrication/processing by the logged-in optician
router.put('/:id/claim', async (req, res) => {
  const { id } = req.params;
  const userRole = req.user.role;
  const opticianId = req.user.id;

  if (userRole !== 'OPTICIAN' && userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Only clinical staff can claim orders.' });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { assignedOptician: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.assignedOpticianId && order.assignedOpticianId !== opticianId && userRole !== 'ADMIN') {
      return res.status(400).json({
        error: `This order is already claimed by ${order.assignedOptician?.fullName || 'another optician'}.`,
      });
    }

    // Automatically transition to PROCESSING if currently PENDING
    const nextStatus = order.status === 'PENDING' ? 'PROCESSING' : order.status;

    const updated = await prisma.order.update({
      where: { id },
      data: {
        assignedOpticianId: opticianId,
        status: nextStatus,
      },
      include: {
        assignedOptician: {
          select: { id: true, fullName: true, email: true },
        },
        patient: {
          select: { fullName: true, email: true, phoneNumber: true },
        },
        items: {
          include: { frame: true, lens: true },
        },
      },
    });

    res.json({
      message: 'Order claimed successfully.',
      order: updated,
    });
  } catch (error) {
    console.error('Claim order error:', error);
    res.status(500).json({ error: 'Failed to claim order.' });
  }
});

// PUT /api/orders/:id/release
// Release a claimed order back to the open clinic queue
router.put('/:id/release', async (req, res) => {
  const { id } = req.params;
  const userRole = req.user.role;
  const opticianId = req.user.id;

  if (userRole !== 'OPTICIAN' && userRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Only clinical staff can release orders.' });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.assignedOpticianId !== opticianId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'You cannot release an order claimed by another staff member.' });
    }

    // If currently PROCESSING, revert to PENDING
    const nextStatus = order.status === 'PROCESSING' ? 'PENDING' : order.status;

    const updated = await prisma.order.update({
      where: { id },
      data: {
        assignedOpticianId: null,
        status: nextStatus,
      },
      include: {
        assignedOptician: {
          select: { id: true, fullName: true, email: true },
        },
        patient: {
          select: { fullName: true, email: true, phoneNumber: true },
        },
        items: {
          include: { frame: true, lens: true },
        },
      },
    });

    res.json({
      message: 'Order released back to open queue.',
      order: updated,
    });
  } catch (error) {
    console.error('Release order error:', error);
    res.status(500).json({ error: 'Failed to release order.' });
  }
});

// PUT /api/orders/:id
// Update order details (Optician / Admin only)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, reason, shippingAddress, recipientName, recipientPhone, courierName, trackingNumber, paymentStatus, assignedOpticianId } = req.body;
  const userRole = req.user.role;

  if (userRole !== 'OPTICIAN' && userRole !== 'ADMIN') {
    return res.status(403).json({
      error: 'Unauthorized. Only opticians and admins can modify orders.',
    });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { 
        patient: true,
        items: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: `Order with ID ${id} not found.` });
    }

    // If order is claimed by another optician and caller is not an Admin, prevent modification
    if (order.assignedOpticianId && order.assignedOpticianId !== req.user.id && userRole !== 'ADMIN') {
      return res.status(403).json({
        error: 'This order is currently locked and assigned to another optician. Only the assigned optician or clinic administrator can modify it.',
      });
    }

    // If order is being cancelled and was not already cancelled, restore inventory stock
    if (status === 'CANCELLED' && order.status !== 'CANCELLED') {
      await prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          if (item.frameId) {
            await tx.product.update({
              where: { id: item.frameId },
              data: {
                stockLevel: {
                  increment: item.quantity,
                },
              },
            });
          }
          if (item.lensId) {
            await tx.lens.update({
              where: { id: item.lensId },
              data: {
                stockLevel: {
                  increment: item.quantity,
                },
              },
            });
          }
        }
      });
    }

    // If order is marked as COMPLETED, automatically mark paymentStatus as PAID (for COD settlements / in-store pickups)
    const effectivePaymentStatus = paymentStatus !== undefined
      ? paymentStatus
      : (status === 'COMPLETED' ? 'PAID' : undefined);

    const cleanRecipientPhone = recipientPhone !== undefined ? (recipientPhone ? recipientPhone.replace(/\D/g, '').slice(0, 10) : null) : undefined;

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(assignedOpticianId !== undefined && { assignedOpticianId: assignedOpticianId || null }),
        ...(shippingAddress !== undefined && { shippingAddress }),
        ...(recipientName !== undefined && { recipientName }),
        ...(cleanRecipientPhone !== undefined && { recipientPhone: cleanRecipientPhone }),
        ...(courierName !== undefined && { courierName }),
        ...(trackingNumber !== undefined && { trackingNumber }),
        ...(effectivePaymentStatus !== undefined && { paymentStatus: effectivePaymentStatus }),
      },
      include: {
        assignedOptician: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    const displayId = order.id.substring(0, 8).toUpperCase();

    // Create notifications for patient when status is ON_HOLD or CANCELLED
    if (status === 'ON_HOLD') {
      try {
        await prisma.notification.create({
          data: {
            userId: order.patientId,
            title: 'Order Placed On Hold',
            message: reason
              ? `Your order ${displayId} has been placed on hold: ${reason}`
              : `Your order ${displayId} has been placed on hold pending verification.`,
            type: 'ORDER_HOLD',
            relatedId: order.id,
          },
        });
      } catch (notifErr) {
        console.error('Failed to create ON_HOLD notification:', notifErr);
      }
    } else if (status === 'CANCELLED') {
      try {
        await prisma.notification.create({
          data: {
            userId: order.patientId,
            title: 'Order Cancelled',
            message: reason
              ? `Your order ${displayId} was cancelled: ${reason}`
              : `Your order ${displayId} was cancelled.`,
            type: 'ORDER_CANCELLED',
            relatedId: order.id,
          },
        });
      } catch (notifErr) {
        console.error('Failed to create ORDER_CANCELLED notification:', notifErr);
      }
    }

    // Send email notification on status change (READY_FOR_PICKUP, COMPLETED, ON_HOLD, CANCELLED)
    if (status && status !== order.status) {
      await sendOrderStatusEmail(updatedOrder, order.patient, status, reason);
    }

    res.json({
      message: 'Order updated successfully',
      order: {
        ...updatedOrder,
        ...(status === 'ON_HOLD' && reason && { holdReason: reason }),
        ...(status === 'CANCELLED' && reason && { cancelReason: reason }),
      },
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res
      .status(500)
      .json({ error: 'Server error processing order update.' });
  }
});

// POST /api/orders/notify-pickup
// Send email notifications to all or specific patient(s) with orders ready for pickup
router.post('/notify-pickup', async (req, res) => {
  const userRole = req.user.role;
  if (userRole !== 'OPTICIAN' && userRole !== 'ADMIN') {
    return res.status(403).json({
      error: 'Unauthorized. Only opticians and admins can trigger notifications.',
    });
  }

  try {
    const { orderId, orderIds } = req.body || {};
    let whereCondition = { status: 'READY_FOR_PICKUP' };

    if (orderId) {
      whereCondition = { id: orderId };
    } else if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      whereCondition = { id: { in: orderIds } };
    }

    const readyOrders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        patient: true,
        items: {
          include: { frame: true, lens: true }
        }
      },
    });

    for (const order of readyOrders) {
      await sendOrderStatusEmail(order, order.patient, 'READY_FOR_PICKUP');
      // Set status to COMPLETED and paymentStatus to PAID to finalize the order and recognize revenue
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED', paymentStatus: 'PAID' },
      });
    }

    res.json({
      success: true,
      message: `Notification email(s) successfully sent & order(s) locked as Completed for ${readyOrders.length} customer(s).`,
      count: readyOrders.length,
      notifiedOrderIds: readyOrders.map((o) => o.id),
    });
  } catch (error) {
    console.error('Error sending pickup notifications:', error);
    res.status(500).json({ error: 'Server error sending pickup notifications.' });
  }
});

// Helper function to send order status update email using nodemailer
async function sendOrderStatusEmail(order, patient, status, reason = null) {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.log('--- EMAIL CONFIGURATION MISSING ---');
    console.log('Cannot send order status update email.');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    let subject = '';
    let htmlContent = '';
    const orderRef = order.id.substring(0, 8).toUpperCase();

    if (status === 'READY_FOR_PICKUP') {
      subject = `Nethmini Opticals - Order Ready for Pickup (${orderRef})`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #1b5e85;">Your Order is Ready for Pickup</h2>
          <p>Hello ${patient.fullName},</p>
          <p>Your eyewear order <strong>${orderRef}</strong> is ready for customer pickup.</p>
          <p>You can collect your order from our store:</p>
          <div style="background: #f4f8fa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1b5e85;">
            <strong>Store Location:</strong> Nethmini Opticals - Giriulla Branch
          </div>
          <p>Please bring a copy of this email or your Order ID when you come to collect it.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
          <p style="font-size: 11px; color: #999; text-align: center;">Nethmini Opticals Team</p>
        </div>
      `;
    } else if (status === 'COMPLETED') {
      subject = `Nethmini Opticals - Order Completed (${orderRef})`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2e7d32;">Order Completed Successfully</h2>
          <p>Hello ${patient.fullName},</p>
          <p>Your order <strong>${orderRef}</strong> has been completed and marked as picked up / delivered.</p>
          <p>Thank you for choosing Nethmini Opticals for your visual health needs. We hope you love your new eyewear.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
          <p style="font-size: 11px; color: #999; text-align: center;">Nethmini Opticals Team</p>
        </div>
      `;
    } else if (status === 'ON_HOLD') {
      subject = `Nethmini Opticals - Order On Hold (${orderRef})`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #d97706;">Order Temporarily Placed On Hold</h2>
          <p>Hello ${patient.fullName},</p>
          <p>Your eyewear order <strong>${orderRef}</strong> has been placed on hold by our optical team.</p>
          <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e;">Reason for Hold:</strong>
            <p style="color: #78350f; margin: 6px 0 0 0;">${reason || 'Additional prescription or fitting clarification required by the optical lab.'}</p>
          </div>
          <p>Our team will contact you shortly if any additional details are needed. You can also view live updates directly in your Visual Health Dashboard.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
          <p style="font-size: 11px; color: #999; text-align: center;">Nethmini Opticals Team</p>
        </div>
      `;
    } else if (status === 'CANCELLED') {
      subject = `Nethmini Opticals - Order Cancelled (${orderRef})`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #dc2626;">Order Cancelled</h2>
          <p>Hello ${patient.fullName},</p>
          <p>Your eyewear order <strong>${orderRef}</strong> has been cancelled.</p>
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <strong style="color: #991b1b;">Reason for Cancellation:</strong>
            <p style="color: #7f1d1d; margin: 6px 0 0 0;">${reason || 'Order cancelled by optician.'}</p>
          </div>
          <p>If you have any questions or would like to discuss alternative frames or lenses, please contact our clinic.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
          <p style="font-size: 11px; color: #999; text-align: center;">Nethmini Opticals Team</p>
        </div>
      `;
    } else {
      return; // Do not send email for other statuses
    }

    const mailOptions = {
      from: `"Nethmini Opticals" <${emailUser}>`,
      to: patient.email.toLowerCase(),
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SENT] Order status email sent to ${patient.email} for status ${status}`);
  } catch (error) {
    console.error('Error sending order status email:', error);
  }
}

// POST /api/orders/payhere-hash
// Compatibility alias for PayHere hash generation
router.post('/payhere-hash', async (req, res) => {
  try {
    const { orderId, amount, currency = 'LKR' } = req.body;
    if (!orderId || !amount) {
      return res.status(400).json({ error: 'orderId and amount are required.' });
    }

    const merchantId = (process.env.PAYHERE_MERCHANT_ID || '').trim();
    const merchantSecret = (process.env.PAYHERE_MERCHANT_SECRET || '').trim();
    const ngrokUrl = (process.env.PAYHERE_NGROK_URL || '').trim();

    const md5 = (str) => crypto.createHash('md5').update(str).digest('hex').toUpperCase();
    const amountFormatted = parseFloat(amount).toFixed(2);
    const hashedSecret = md5(merchantSecret);
    const hash = md5(`${merchantId}${orderId}${amountFormatted}${currency}${hashedSecret}`);

    return res.json({
      merchant_id: merchantId,
      order_id: orderId,
      amount: amountFormatted,
      currency,
      hash,
      notify_url: `${ngrokUrl}/api/payments/notify`,
      return_url: 'http://localhost:5173/#/dashboard',
      cancel_url: 'http://localhost:5173/#/catalog',
      sandbox: true,
    });
  } catch (err) {
    console.error('[PayHere /payhere-hash alias]', err);
    return res.status(500).json({ error: 'Failed to generate payment hash.' });
  }
});

export default router;

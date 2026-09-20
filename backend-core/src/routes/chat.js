import express from 'express';
import { prisma } from '../lib/prisma.js';
import authMiddleware from '../middleware/auth.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const candidateModels = [
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-lite-latest',
];

/**
 * Helper to call Gemini AI with fallbacks
 */
async function generateAiChatResponse(systemInstruction, conversationHistory, userMessage) {
  if (!geminiApiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const genAI = new GoogleGenerativeAI(geminiApiKey);

  // Format contents for Gemini
  // Gemini expects contents: [{ role: 'user'|'model', parts: [{ text: '...' }] }]
  const contents = [];

  // Add conversation history if provided
  if (Array.isArray(conversationHistory)) {
    for (const item of conversationHistory.slice(-6)) {
      const role = item.role === 'model' || item.role === 'assistant' ? 'model' : 'user';
      if (item.text && typeof item.text === 'string') {
        contents.push({
          role,
          parts: [{ text: item.text }],
        });
      }
    }
  }

  // Add the current user prompt
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  let lastError = null;
  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
      });

      const result = await model.generateContent({ contents });
      const reply = result.response.text();
      if (reply) {
        return reply;
      }
    } catch (err) {
      lastError = err;
      console.warn(`Gemini chat model ${modelName} failed:`, err.message);
    }
  }

  throw lastError || new Error('Failed to generate AI response across all models');
}

// ==========================================
// 1. TIER 1: AI CLINICAL VISION ASSISTANT
// POST /api/chat/ai
// Accessible to authenticated users (and extracts active Rx)
// ==========================================
router.post('/ai', authMiddleware, async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const userId = req.user.id;

    // Fetch user's latest prescription and order context to give evidence-based advice
    const [latestRx, userRecord] = await Promise.all([
      prisma.prescription.findFirst({
        where: { patientId: userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      }),
    ]);

    let rxContext = 'No optical prescription on file yet.';
    if (latestRx) {
      rxContext = `Patient's on-file optical prescription (${latestRx.status}):
- Right Eye (OD): SPH ${latestRx.odSph || '0.00'}, CYL ${latestRx.odCyl || '0.00'}, AXIS ${latestRx.odAxis || '0'}°
- Left Eye (OS): SPH ${latestRx.osSph || '0.00'}, CYL ${latestRx.osCyl || '0.00'}, AXIS ${latestRx.osAxis || '0'}°
- Pupillary Distance (PD): ${latestRx.pd ? latestRx.pd + ' mm' : 'Not recorded'}
- Near Add: ${latestRx.odAdd || 'None'}`;
    }

    const systemInstruction = `You are the InsightOpticals AI Clinical Vision Assistant, an evidence-based optical triage and dispensing counselor for InsightOpticals (Sri Lanka).
Patient Name: ${userRecord?.fullName || 'Customer'}
${rxContext}

Clinical & Ophthalmic Guidelines (ISO 13666, AOA Clinical Practice Standards):
1. Prescription Explanations:
   - SPH (Sphere): Degree of myopia (-) or hyperopia (+).
   - CYL (Cylinder) & AXIS: Correction for astigmatism (corneal curvature).
   - ADD: Near addition for presbyopia (reading/computer).
   - PD: Pupillary distance, critical for optical center alignment to avoid induced prismatic effect.
2. Lens Material & Index Selection:
   - Mild (0.00 to ±2.00 D): Standard CR-39 (1.50) or 1.56 Mid-Index.
   - Moderate (±2.25 to ±4.00 D): 1.59 Polycarbonate (impact-resistant) or 1.61 High-Index (thinner, lighter).
   - High (±4.25 to ±6.00 D): 1.67 Super High-Index (flatter curves, minimum edge thickness).
   - Extreme (> ±6.00 D): 1.74 Ultra High-Index.
   - Screen use: Recommend Anti-Reflective (AR) + Blue Cut filter.
   - Outdoor active: Recommend Polarized or Photochromic (Transitions).
3. Red-Flag Emergency Ocular Symptoms:
   - If user reports sudden severe eye pain, sudden loss of vision, curtain over field of view, sudden shower of dark floaters or flashing lights, or chemical trauma:
   - IMMEDIATELY instruct them to seek urgent in-person emergency ophthalmological care (e.g., National Eye Hospital Colombo or nearest emergency eye unit). Do not attempt to diagnose emergencies online.
4. Language & Multilingual Capability:
   - You fully support **Sinhala (සිංහල)**, **Singlish**, and **English**.
   - If the patient writes in Sinhala (or Singlish) or asks for Sinhala, respond fluently, politely, and naturally in Sinhala.
   - When explaining optical terms in Sinhala, keep standard optical abbreviations in brackets for clarity (e.g., "SPH (දුර පෙනීම / ළඟ පෙනීම)", "CYL (ඇස්වල ඇදවීම - Astigmatism)", "High-Index කාච", "Blue Cut ආලේපනය").
5. Tone & Style:
   - Professional, warm, reassuring, precise, and concise. Avoid unnecessary filler or decorative fluff.
   - Mention prices in Sri Lankan Rupees (LKR) when referring to eyewear/treatments.
   - Inform the user that if they want custom frame fitting verification or clinical prescription approval, they can switch to the "Ask Licensed Optician" tab to message our clinic staff directly.`;

    const aiReply = await generateAiChatResponse(systemInstruction, conversationHistory, message);

    res.json({
      reply: aiReply,
      hasRx: !!latestRx,
    });
  } catch (error) {
    console.error('AI chat endpoint error:', error);
    res.status(500).json({
      error: 'Unable to complete AI clinical consultation at this moment.',
      details: error.message,
    });
  }
});

// ==========================================
// 2. TIER 2: ASYNCHRONOUS OPTICIAN TELE-CONSULTATION
// GET /api/chat/messages
// Patient fetches their messaging history with the optician
// ==========================================
router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const targetPatientId = (role === 'OPTICIAN' || role === 'ADMIN') && req.query.patientId
      ? req.query.patientId
      : userId;

    const messages = await prisma.chatMessage.findMany({
      where: { patientId: targetPatientId },
      orderBy: { createdAt: 'asc' },
    });

    // If optician is reading, mark patient's messages as read
    if (role === 'OPTICIAN' || role === 'ADMIN') {
      await prisma.chatMessage.updateMany({
        where: {
          patientId: targetPatientId,
          senderRole: 'PATIENT',
          isRead: false,
        },
        data: { isRead: true },
      });
    }

    // If patient is reading, mark optician's messages as read
    if (role === 'PATIENT') {
      await prisma.chatMessage.updateMany({
        where: {
          patientId: userId,
          senderRole: 'OPTICIAN',
          isRead: false,
        },
        data: { isRead: true },
      });
    }

    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Server error retrieving consultation messages.' });
  }
});

// ==========================================
// POST /api/chat/messages
// Patient sends a consultation message to the optical staff
// ==========================================
router.post('/messages', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const patient = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true },
    });

    const senderName = patient?.fullName || 'Patient';

    const chatMsg = await prisma.chatMessage.create({
      data: {
        patientId: userId,
        senderRole: 'PATIENT',
        senderName,
        message: message.trim(),
        isRead: false,
      },
    });

    // Send high-priority notification to Opticians
    await prisma.notification.create({
      data: {
        role: 'OPTICIAN',
        title: 'New Patient Consultation Inquiry',
        message: `${senderName} submitted an inquiry: "${message.trim().slice(0, 75)}${message.length > 75 ? '...' : ''}"`,
        type: 'PATIENT_CHAT',
        relatedId: userId,
      },
    });

    res.status(201).json(chatMsg);
  } catch (error) {
    console.error('Error sending patient chat message:', error);
    res.status(500).json({ error: 'Failed to send consultation message.' });
  }
});

// ==========================================
// GET /api/chat/optician/conversations
// Optician retrieves list of patient threads with latest message & Rx
// ==========================================
router.get('/optician/conversations', authMiddleware, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'OPTICIAN' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only licensed opticians and administrators can access consultation inboxes.' });
    }

    // Find all patients who have chat messages
    const distinctPatientIds = await prisma.chatMessage.groupBy({
      by: ['patientId'],
    });

    const patientIds = distinctPatientIds.map((item) => item.patientId);

    const patients = await prisma.user.findMany({
      where: { id: { in: patientIds } },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        prescriptionsAsPatient: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Fetch conversation stats for each patient
    const threads = await Promise.all(
      patients.map(async (patient) => {
        const [latestMsg, unreadCount, totalCount] = await Promise.all([
          prisma.chatMessage.findFirst({
            where: { patientId: patient.id },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.chatMessage.count({
            where: {
              patientId: patient.id,
              senderRole: 'PATIENT',
              isRead: false,
            },
          }),
          prisma.chatMessage.count({
            where: { patientId: patient.id },
          }),
        ]);

        return {
          patientId: patient.id,
          patientName: patient.fullName || 'Unknown Patient',
          email: patient.email,
          phoneNumber: patient.phoneNumber,
          latestPrescription: patient.prescriptionsAsPatient[0] || null,
          latestMessage: latestMsg?.message || '',
          latestMessageRole: latestMsg?.senderRole || '',
          latestMessageAt: latestMsg?.createdAt || null,
          unreadCount,
          totalCount,
        };
      })
    );

    // Sort threads by most recent message
    threads.sort((a, b) => {
      const timeA = a.latestMessageAt ? new Date(a.latestMessageAt).getTime() : 0;
      const timeB = b.latestMessageAt ? new Date(b.latestMessageAt).getTime() : 0;
      return timeB - timeA;
    });

    res.json(threads);
  } catch (error) {
    console.error('Error fetching optician conversations:', error);
    res.status(500).json({ error: 'Failed to retrieve consultation inbox.' });
  }
});

// ==========================================
// POST /api/chat/optician/reply
// Optician replies directly to a patient thread
// ==========================================
router.post('/optician/reply', authMiddleware, async (req, res) => {
  try {
    const { role, id: opticianId, fullName: opticianName } = req.user;
    if (role !== 'OPTICIAN' && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only licensed opticians can reply to clinical inquiries.' });
    }

    const { patientId, message } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required.' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Reply message cannot be empty.' });
    }

    const opticianUser = await prisma.user.findUnique({
      where: { id: opticianId },
      select: { fullName: true },
    });

    const senderName = opticianUser?.fullName || opticianName || 'Licensed Optician';

    const chatMsg = await prisma.chatMessage.create({
      data: {
        patientId,
        senderRole: 'OPTICIAN',
        senderName,
        message: message.trim(),
        isRead: false,
      },
    });

    // Mark previous patient messages as read
    await prisma.chatMessage.updateMany({
      where: {
        patientId,
        senderRole: 'PATIENT',
        isRead: false,
      },
      data: { isRead: true },
    });

    // Create notification for patient
    await prisma.notification.create({
      data: {
        userId: patientId,
        role: 'PATIENT',
        title: 'Optician Response Received',
        message: `${senderName} replied: "${message.trim().slice(0, 75)}${message.length > 75 ? '...' : ''}"`,
        type: 'OPTICIAN_REPLY',
        relatedId: chatMsg.id,
      },
    });

    res.status(201).json(chatMsg);
  } catch (error) {
    console.error('Error in optician reply:', error);
    res.status(500).json({ error: 'Failed to send optician reply.' });
  }
});

export default router;

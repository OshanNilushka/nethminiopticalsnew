import express from 'express';
import { prisma } from '../lib/prisma.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Jimp } from 'jimp';
import Tesseract from 'tesseract.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';


const router = express.Router();

// GET /api/prescriptions/patients
// Fetch all patients with their prescriptions and orders (Optician/Admin only)
router.get('/patients', async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'OPTICIAN' && role !== 'ADMIN') {
      return res.status(403).json({
        error:
          'Unauthorized. Only opticians and admins can access patient records.',
      });
    }

    const patients = await prisma.user.findMany({
      where: { role: 'PATIENT' },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        dob: true,
        gender: true,
        prescriptionsAsPatient: {
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                frame: true,
                lens: true,
              },
            },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    res.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Server error fetching patients.' });
  }
});

// POST /api/prescriptions/patients
// Register a new walk-in patient from opticals shop (Optician/Admin only)
router.post('/patients', async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== 'OPTICIAN' && role !== 'ADMIN') {
      return res.status(403).json({
        error:
          'Unauthorized. Only opticians and admins can register walk-in patients.',
      });
    }

    const { fullName, phoneNumber, email, dob, gender } = req.body;

    if (!fullName || !phoneNumber) {
      return res.status(400).json({
        error: 'Full name and phone number are required for walk-in patient registration.',
      });
    }

    // Generate clean email handle if not provided
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const userEmail =
      email && email.trim()
        ? email.toLowerCase().trim()
        : `walkin.${cleanPhone || Date.now()}@insightopticals.local`;

    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, email: true },
    });

    if (existingUser) {
      return res.status(400).json({
        error: `A patient record with email "${userEmail}" already exists.`,
      });
    }

    // Safely parse Date of Birth
    let parsedDob = null;
    if (dob) {
      const d = new Date(dob);
      if (!isNaN(d.getTime())) {
        parsedDob = d;
      }
    }

    // Default password for walk-in account
    const defaultPassword = 'WalkIn@' + (cleanPhone ? cleanPhone.slice(-4) : '2026');
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const newPatient = await prisma.user.create({
      data: {
        email: userEmail,
        password: hashedPassword,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        dob: parsedDob,
        gender: gender || null,
        role: 'PATIENT',
        mustChangePassword: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        dob: true,
        gender: true,
        prescriptionsAsPatient: true,
        orders: true,
      },
    });

    // Send welcome email if customer provided their own real email
    const isRealEmail =
      email &&
      email.trim() &&
      !userEmail.endsWith('@insightopticals.local') &&
      userEmail.includes('@');

    if (isRealEmail) {
      const emailUser = process.env.EMAIL_USER;
      const emailPass = process.env.EMAIL_PASS;
      if (emailUser && emailPass) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: emailUser, pass: emailPass },
          });

          const mailOptions = {
            from: `"Nethmini Opticals" <${emailUser}>`,
            to: userEmail,
            subject: 'Welcome to Nethmini Opticals - Your Account Details',
            html: `
              <div style="font-family: Arial, sans-serif; padding: 24px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #1b5e85; margin: 0; font-size: 24px;">Nethmini Opticals</h1>
                  <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Vision Care & Precision Eyewear</p>
                </div>
                <h2 style="color: #1e293b; font-size: 18px;">Welcome, ${newPatient.fullName}!</h2>
                <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                  An account was created for you at our optical shop. You can now log into your online patient portal to view your prescriptions, try on frames in 3D, and track your orders.
                </p>
                <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
                  <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;"><strong>Username / Email:</strong> ${userEmail}</p>
                  <p style="margin: 0; font-size: 13px; color: #64748b;">
                    <strong>Temporary Password:</strong> 
                    <span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: bold; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 15px; margin-left: 6px;">${defaultPassword}</span>
                  </p>
                </div>
                <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                  <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.5;">
                    ⚠️ <strong>Security Notice:</strong> Please use this temporary password to log in, then visit <strong>Settings</strong> in your dashboard to set your own secure password. Alternatively, you can use the <strong>Forgot Password</strong> option on the login page anytime.
                  </p>
                </div>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
                  Nethmini Opticals Team · Thank you for trusting us with your vision.
                </p>
              </div>
            `,
          };

          transporter.sendMail(mailOptions).catch((mailErr) => {
            console.warn('Welcome email sending failed:', mailErr.message);
          });
        } catch (emailErr) {
          console.warn(
            'Failed to initialize welcome email transporter:',
            emailErr.message,
          );
        }
      }
    }

    res.status(201).json(newPatient);
  } catch (error) {
    console.error('Error creating walk-in patient:', error);
    res.status(500).json({
      error: error.message || 'Server error registering walk-in patient.',
    });
  }
});

// POST /api/prescriptions
// Patient uploads a prescription for validation, OR optician logs a prescription for a patient
router.post('/', async (req, res) => {
  const {
    odSph,
    odCyl,
    odAxis,
    osSph,
    osCyl,
    osAxis,
    pd,
    ocrImageUrl,
    rawOcrResult,
  } = req.body;

  let patientId = req.user.id;
  const isOpticianOrAdmin =
    req.user.role === 'OPTICIAN' || req.user.role === 'ADMIN';

  if (isOpticianOrAdmin && req.body.patientId) {
    patientId = req.body.patientId;
  }

  try {
    // 1. Create prescription record
    const prescription = await prisma.prescription.create({
      data: {
        patientId,
        odSph: odSph ? parseFloat(odSph) : null,
        odCyl: odCyl ? parseFloat(odCyl) : null,
        odAxis: odAxis ? parseInt(odAxis) : null,
        osSph: osSph ? parseFloat(osSph) : null,
        osCyl: osCyl ? parseFloat(osCyl) : null,
        osAxis: osAxis ? parseInt(osAxis) : null,
        pd: pd ? parseFloat(pd) : null,
        ocrImageUrl: ocrImageUrl || null,
        rawOcrResult: rawOcrResult || null,
        status: isOpticianOrAdmin ? 'VALIDATED' : 'PENDING',
        isValidated: isOpticianOrAdmin,
        opticianId: isOpticianOrAdmin ? req.user.id : null,
      },
    });

    // 2. Fetch patient name
    const patient = await prisma.user.findUnique({
      where: { id: patientId },
      select: { fullName: true },
    });

    const patientName = patient?.fullName || 'A patient';

    // 3. Create notifications
    if (isOpticianOrAdmin) {
      await prisma.notification.create({
        data: {
          userId: patientId,
          title: 'New Prescription Logged',
          message: `Dr. ${req.user.fullName || 'The optician'} has added a validated prescription to your profile.`,
          type: 'PRESCRIPTION_VALIDATED',
          relatedId: prescription.id,
        },
      });
    } else {
      await prisma.notification.create({
        data: {
          role: 'OPTICIAN',
          title: 'New Prescription Validation Request',
          message: `${patientName} uploaded a new prescription and requested validation.`,
          type: 'PRESCRIPTION_PENDING',
          relatedId: prescription.id,
        },
      });
    }

    res.status(201).json(prescription);
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({ error: 'Server error saving prescription.' });
  }
});

// GET /api/prescriptions
// Fetch prescriptions based on role
router.get('/', async (req, res) => {
  try {
    const { id, role } = req.user;
    let prescriptions;

    if (role === 'PATIENT') {
      prescriptions = await prisma.prescription.findMany({
        where: { patientId: id },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      prescriptions = await prisma.prescription.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              fullName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      });
    }

    res.json(prescriptions);
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({ error: 'Server error fetching prescriptions.' });
  }
});

// PUT /api/prescriptions/:id/status
// Optician/Admin validates or rejects a prescription
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, odSph, odCyl, odAxis, osSph, osCyl, osAxis, pd, odAdd, rejectionReason } =
    req.body;
  const { role, id: opticianId } = req.user;

  if (role !== 'OPTICIAN' && role !== 'ADMIN') {
    return res.status(403).json({
      error:
        'Unauthorized. Only opticians and admins can validate prescriptions.',
    });
  }

  if (!status || !['VALIDATED', 'REJECTED', 'PENDING'].includes(status)) {
    return res.status(400).json({
      error: 'Invalid or missing status (VALIDATED, REJECTED, PENDING).',
    });
  }

  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id },
    });

    if (!prescription) {
      return res
        .status(404)
        .json({ error: `Prescription with ID ${id} not found.` });
    }

    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        status,
        isValidated: status === 'VALIDATED',
        opticianId,
        rejectionReason: status === 'REJECTED' ? (rejectionReason || null) : null,
        ...(odSph !== undefined && {
          odSph: odSph !== null && odSph !== '' ? parseFloat(odSph) : null,
        }),
        ...(odCyl !== undefined && {
          odCyl: odCyl !== null && odCyl !== '' ? parseFloat(odCyl) : null,
        }),
        ...(odAxis !== undefined && {
          odAxis: odAxis !== null && odAxis !== '' ? parseInt(odAxis) : null,
        }),
        ...(osSph !== undefined && {
          osSph: osSph !== null && osSph !== '' ? parseFloat(osSph) : null,
        }),
        ...(osCyl !== undefined && {
          osCyl: osCyl !== null && osCyl !== '' ? parseFloat(osCyl) : null,
        }),
        ...(osAxis !== undefined && {
          osAxis: osAxis !== null && osAxis !== '' ? parseInt(osAxis) : null,
        }),
        ...(pd !== undefined && {
          pd: pd !== null && pd !== '' ? parseFloat(pd) : null,
        }),
        ...(odAdd !== undefined && {
          odAdd: odAdd !== null && odAdd !== '' ? parseFloat(odAdd) : null,
        }),
      },
    });

    // Create notification for the patient
    await prisma.notification.create({
      data: {
        userId: prescription.patientId,
        title:
          status === 'VALIDATED'
            ? 'Prescription Validated'
            : 'Prescription Rejected',
        message:
          status === 'VALIDATED'
            ? 'Your prescription has been validated successfully by the optician.'
            : `Your prescription validation request was rejected by the optician. Reason: ${rejectionReason || 'Please upload a clear image of your prescription slip.'}`,
        type:
          status === 'VALIDATED'
            ? 'PRESCRIPTION_VALIDATED'
            : 'PRESCRIPTION_REJECTED',
        relatedId: prescription.id,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating prescription status:', error);
    res
      .status(500)
      .json({ error: 'Server error updating prescription status.' });
  }
});

// Configure multer storage for uploaded prescription images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'prescription-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      return cb(
        new Error('Only image files (.png, .jpg, .jpeg, .webp) are allowed.'),
      );
    }
    cb(null, true);
  },
});

// POST /api/prescriptions/scan
// Upload an image of a prescription and extract values locally using Tesseract.js
router.post(
  '/scan',
  (req, res, next) => {
    upload.single('prescription')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'Please upload a prescription image file.' });
    }

    try {
      const imagePath = `/uploads/${req.file.filename}`;
      const fullPath = req.file.path;

      // Pre-process image: resize intelligently so payload stays well under OCR.space 1MB limit
      try {
        const image = await Jimp.read(fullPath);
        let targetW = image.bitmap.width;
        let targetH = image.bitmap.height;

        // Capping dimensions to optimal OCR size (max width 1600px, min width 1000px if small)
        if (targetW < 800) {
          const scale = 1.5;
          targetW = Math.round(targetW * scale);
          targetH = Math.round(targetH * scale);
        } else if (targetW > 1600) {
          const ratio = 1600 / targetW;
          targetW = 1600;
          targetH = Math.round(targetH * ratio);
        }

        const scaled = image.resize({ w: targetW, h: targetH });
        const whiteBg = new Jimp({
          width: scaled.bitmap.width,
          height: scaled.bitmap.height,
          color: 0xffffffff,
        });
        whiteBg.composite(scaled, 0, 0);
        await whiteBg.write(fullPath);
        console.log(`Pre-processed image using Jimp to ${targetW}x${targetH}.`);
      } catch (jimpErr) {
        console.warn('Image pre-processing skipped/failed:', jimpErr.message);
      }

      const imageBuffer = fs.readFileSync(fullPath);
      const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

      // 0. Primary AI Vision Attempt: Gemini AI Multimodal (If API Key Present)
      const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (geminiApiKey) {
        console.log('Attempting high-precision Gemini AI Multimodal Vision extraction...');
        try {
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const candidateModels = [
            'gemini-flash-latest',
            'gemini-2.5-flash',
            'gemini-3.6-flash',
            'gemini-3.7-flash',
            'gemini-3.8-flash',
            'gemini-flash-lite-latest',
          ];

          const prompt = `You are a specialized optical prescription reader AI. Analyze this optical prescription image or doctor slip and extract the exact prescription parameters.
Doctors frequently use optical shorthand on handwritten slips:
- SPH (Sphere): numbers like 1 or +1 mean +1.00; 0 or Plano/PL means 0.00. SPH MUST include sign (+ or -) and two decimals (e.g. "+1.00", "0.00").
- CYL (Cylinder): numbers like -50, 50, or .50 denote diopters like -0.50. Numbers like -2 mean -2.00. CYL MUST include sign (+ or -) and two decimals if present, or null if empty.
- AXIS: degrees from 1 to 180 (e.g. "90"). Null if not present.
- PD (Pupillary Distance): normal optical PD is between 50 and 75 mm. If written as 6, 6mm, or 6cm, it is optical shorthand for 60 mm.
- Doctor: doctor name if present (e.g. "Dr. Nayana").
- Date: examination date in YYYY-MM-DD or null.

Return ONLY valid JSON matching this exact structure with no markdown or formatting wrapper:
{
  "od": { "sphere": "+1.00", "cyl": "-0.50", "axis": "90" },
  "os": { "sphere": "0.00", "cyl": "-2.00", "axis": "90" },
  "pd": "60",
  "doctor": "Dr. Nayana",
  "date": null
}`;

          const imagePart = {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: mimeType,
            },
          };

          let responseText = null;
          for (const modelName of candidateModels) {
            try {
              const model = genAI.getGenerativeModel({ model: modelName });
              const result = await model.generateContent([prompt, imagePart]);
              responseText = result.response.text();
              console.log(`Gemini AI Vision succeeded with model: ${modelName}`);
              break;
            } catch (err) {
              console.warn(`Gemini model ${modelName} attempt failed:`, err.message);
            }
          }

          if (responseText) {
            console.log('--- GEMINI AI VISION RESPONSE ---');
            console.log(responseText);

            const cleanJsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsedAi = JSON.parse(cleanJsonStr);

            parsedAi.rawOcrResult = responseText;
            parsedAi.imageUrl = imagePath;

            return res.json(parsedAi);
          }
        } catch (geminiErr) {
          console.warn('Gemini AI Vision skipped/failed, falling back to OCR:', geminiErr.message);
        }
      }

      // Pre-process image: resize intelligently so payload stays well under OCR.space 1MB limit
      try {
        const image = await Jimp.read(fullPath);
        let targetW = image.bitmap.width;
        let targetH = image.bitmap.height;

        if (targetW < 800) {
          const scale = 1.5;
          targetW = Math.round(targetW * scale);
          targetH = Math.round(targetH * scale);
        } else if (targetW > 1600) {
          const ratio = 1600 / targetW;
          targetW = 1600;
          targetH = Math.round(targetH * ratio);
        }

        const scaled = image.resize({ w: targetW, h: targetH });
        const whiteBg = new Jimp({
          width: scaled.bitmap.width,
          height: scaled.bitmap.height,
          color: 0xffffffff,
        });
        whiteBg.composite(scaled, 0, 0);
        await whiteBg.write(fullPath);
        console.log(`Pre-processed image using Jimp to ${targetW}x${targetH}.`);
      } catch (jimpErr) {
        console.warn('Image pre-processing skipped/failed:', jimpErr.message);
      }

      let rawText = '';

      // Secondary Attempt: OCR.space Cloud API
      try {
        const apiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';

        const callOcrSpace = async (engine) => {
          const formData = new FormData();
          formData.append('apikey', apiKey);
          formData.append('base64Image', base64Image);
          formData.append('language', 'eng');
          formData.append('isTable', 'true');
          formData.append('ocrEngine', engine);
          formData.append('scale', 'true');

          const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData,
          });

          return await response.json();
        };

        let ocrData = await callOcrSpace('2');

        if (!ocrData || ocrData.OCRExitCode !== 1 || ocrData.error) {
          console.warn('OCR Engine 2 notice:', JSON.stringify(ocrData));
          ocrData = await callOcrSpace('1');
        }

        if (ocrData && ocrData.OCRExitCode === 1 && ocrData.ParsedResults?.[0]?.ParsedText) {
          rawText = ocrData.ParsedResults[0].ParsedText;
          console.log('--- OCR.SPACE TEXT RECEIVED ---');
        } else {
          console.warn('OCR.space API unavailable or throttled:', JSON.stringify(ocrData));
        }
      } catch (ocrErr) {
        console.warn('OCR.space network call failed:', ocrErr.message);
      }

      // Tertiary Fallback Attempt: Local Tesseract.js Engine
      if (!rawText || !rawText.trim()) {
        console.log('Using local Tesseract.js OCR engine fallback...');
        try {
          const tesseractResult = await Tesseract.recognize(fullPath, 'eng');
          rawText = tesseractResult?.data?.text || '';
          console.log('--- TESSERACT.JS LOCAL TEXT RECEIVED ---');
        } catch (tessErr) {
          console.error('Tesseract.js OCR Error:', tessErr.message);
        }
      }

      if (!rawText || !rawText.trim()) {
        throw new Error('Unable to extract text from prescription. Please ensure the image is clear and well-lit.');
      }

      console.log('--- RAW OCR TEXT START ---');
      console.log(rawText);
      console.log('--- RAW OCR TEXT END ---');

      // Run the enhanced heuristic parser
      const parsedData = parsePrescriptionText(rawText);

      // Attach raw text and local file path to the response
      parsedData.rawOcrResult = rawText;
      parsedData.imageUrl = imagePath;

      res.json(parsedData);
    } catch (error) {
      console.error('Prescription Scanning Error:', error);
      res.status(500).json({
        error: 'Failed to process prescription scan: ' + error.message,
      });
    }
  },
);

// Advanced Heuristic & Pattern Parser for Optical Prescriptions
function parsePrescriptionText(rawText) {
  const result = {
    od: { sphere: null, cyl: null, axis: null },
    os: { sphere: null, cyl: null, axis: null },
    pd: null,
    doctor: null,
    date: null,
  };

  if (!rawText) return result;

  // Clean common OCR character confusions in numeric context
  const cleanedText = rawText
    .replace(/(\d)[oO](\d)/g, '$10$2')
    .replace(/(\d)[oO]\b/g, '$10')
    .replace(/(\d)[lI](\d)/g, '$11')
    .replace(/(\d)[lI]\b/g, '$11')
    .replace(/°/g, ' ');

  const lines = cleanedText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Helper to extract numbers with signs (+ / -) or decimals
  const parseNumbers = (str) => {
    // Strip line index prefixes like "1." or "2." at start of line
    const sanitized = str.replace(/^\s*\d+[\.\)]\s*/, '');

    // Replace optical label words (sph, cyl, axis, add, ds, dc, deg, mm, etc.)
    const numPart = sanitized
      .replace(/\b(sph|cyl|axis|add|ds|dc|deg|dp|mm|right|left|eye|od|os)\b/gi, ' ')
      .replace(/[x@,/]/g, ' ');

    const matches = numPart.match(/[-+]?\d+(?:\.\d+)?/g) || [];
    return matches.map(Number);
  };

  const formatDiopter = (num, isAxis = false) => {
    if (num === null || num === undefined || isNaN(num)) return null;
    if (isAxis) {
      return String(Math.round(Math.abs(num)));
    }
    // Handle OCR missing decimal point (e.g. 250 -> 2.50)
    if (Math.abs(num) >= 100 && Math.abs(num) <= 2500 && Math.floor(num) === num) {
      num = num / 100;
    }
    const str = num.toFixed(2);
    return num > 0 ? `+${str}` : str;
  };

  let odLine = '';
  let osLine = '';

  for (const line of lines) {
    const lower = line.toLowerCase();
    const isRight =
      /\b(o\.?d\.?|right|r\.?e\.?)\b/.test(lower) ||
      /^r\b/.test(lower) ||
      /^re\b/.test(lower) ||
      lower.includes('right eye');

    const isLeft =
      /\b(o\.?s\.?|left|l\.?e\.?)\b/.test(lower) ||
      /^l\b/.test(lower) ||
      /^le\b/.test(lower) ||
      lower.includes('left eye');

    if (isRight && !odLine) odLine = line;
    if (isLeft && !osLine) osLine = line;
  }

  if (odLine) {
    const nums = parseNumbers(odLine);
    if (nums.length >= 1) result.od.sphere = formatDiopter(nums[0]);
    if (nums.length >= 2) result.od.cyl = formatDiopter(nums[1]);
    if (nums.length >= 3) result.od.axis = formatDiopter(nums[2], true);
  }

  if (osLine) {
    const nums = parseNumbers(osLine);
    if (nums.length >= 1) result.os.sphere = formatDiopter(nums[0]);
    if (nums.length >= 2) result.os.cyl = formatDiopter(nums[1]);
    if (nums.length >= 3) result.os.axis = formatDiopter(nums[2], true);
  }

  // Fallback: Grid or Sequential lines if explicit OD/OS lines not matched separately
  if (!result.od.sphere && !result.os.sphere) {
    const numericLines = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('pd') || lower.includes('date') || lower.includes('dr.')) continue;
      const nums = parseNumbers(line);
      if (nums.length >= 1 && nums.some((n) => Math.abs(n) <= 25)) {
        numericLines.push(nums);
      }
    }

    if (numericLines.length >= 1) {
      const r1 = numericLines[0];
      if (r1.length >= 1) result.od.sphere = formatDiopter(r1[0]);
      if (r1.length >= 2) result.od.cyl = formatDiopter(r1[1]);
      if (r1.length >= 3) result.od.axis = formatDiopter(r1[2], true);
    }
    if (numericLines.length >= 2) {
      const r2 = numericLines[1];
      if (r2.length >= 1) result.os.sphere = formatDiopter(r2[0]);
      if (r2.length >= 2) result.os.cyl = formatDiopter(r2[1]);
      if (r2.length >= 3) result.os.axis = formatDiopter(r2[2], true);
    }
  }

  // Extract Pupillary Distance (PD)
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('pd') || lower.includes('pupil') || lower.includes('dist')) {
      const nums = parseNumbers(line).filter((n) => n >= 40 && n <= 85);
      if (nums.length > 0) result.pd = String(Math.round(nums[0]));
    }
  }

  // Extract Doctor & Date
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('dr') || lower.includes('doctor') || lower.includes('optometrist') || lower.includes('prescribed')) {
      const docLabelMatch = line.match(/(?:doctor(?:\s+name)?|optometrist|prescribed\s+by)\s*[:\-]\s*(?:dr\.?\s*)?([a-z\s.]+)/i);
      if (docLabelMatch && docLabelMatch[1] && docLabelMatch[1].trim() && docLabelMatch[1].trim().toLowerCase() !== 'name') {
        let name = docLabelMatch[1].trim().replace(/\b[a-z]/g, (l) => l.toUpperCase());
        if (!name.toLowerCase().startsWith('dr')) {
          name = 'Dr. ' + name;
        }
        result.doctor = name;
        break;
      }
      const drMatch = line.match(/\b(?:dr\.?)\s+([a-z\s.]+)/i);
      if (drMatch && drMatch[1]) {
        let name = drMatch[1].trim().replace(/\b[a-z]/g, (l) => l.toUpperCase());
        result.doctor = 'Dr. ' + name;
        break;
      }
    }
    if (lower.includes('date')) {
      const match =
        line.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/) || line.match(/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/);
      if (match) result.date = match[0];
    }
  }

  return result;
}

export default router;

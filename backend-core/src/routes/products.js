import express from 'express';
import { prisma } from '../lib/prisma.js';
import authMiddleware from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Configure multer storage for uploaded GLB models
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'file') {
      if (ext !== '.glb') {
        return cb(new Error('Only 3D model files (.glb) are allowed.'));
      }
    } else if (file.fieldname === 'image') {
      const allowedImgExts = ['.png', '.jpg', '.jpeg', '.webp'];
      if (!allowedImgExts.includes(ext)) {
        return cb(
          new Error('Only image files (.png, .jpg, .jpeg, .webp) are allowed.'),
        );
      }
    }
    cb(null, true);
  },
});

// World Optical Dispensing Standards Matrix
export const WORLD_OPTICAL_RULES = {
  round: {
    faceShape: "Round",
    principle: "Principle of Contrast & Angular Structure",
    characteristic: "Proportional length and width with soft, curved contours and a rounded chin.",
    rationale: "Angular, structured frames (Rectangle, Square, Geometric, Wayfarer) add sharp architectural lines that contrast soft facial curves, elongating the silhouette for balanced symmetry.",
    recommendedShapes: ["Rectangle", "Square", "Geometric", "Wayfarer"],
    avoid: "Small round, perfectly circular, or rimless circular frames (they visually amplify facial roundness)."
  },
  square: {
    faceShape: "Square",
    principle: "Principle of Softening & Harmonic Curvature",
    characteristic: "Broad forehead, strong horizontal jawline, and angular chiseled chin.",
    rationale: "Soft curved and rounded contours (Round, Oval, Aviator, Cat-Eye) soften the geometric rigidity of a prominent jawline and balance angular facial bone structure.",
    recommendedShapes: ["Round", "Oval", "Aviator", "Cat-Eye"],
    avoid: "Sharp boxy squares, heavy geometric rectangles, or thick flat-top rims (they amplify jawline sharpness)."
  },
  oval: {
    faceShape: "Oval",
    principle: "Principle of Proportion & Natural Symmetry",
    characteristic: "Balanced facial proportions with high cheekbones and a gently narrowing jawline.",
    rationale: "Oval facial structure has natural optical equilibrium. Almost all shapes complement this profile; aim for frames equal to or slightly broader than the widest part of the face.",
    recommendedShapes: ["Rectangle", "Geometric", "Square", "Aviator", "Wayfarer"],
    avoid: "Overly massive or severely oversized frames that disrupt natural symmetrical facial proportions."
  },
  heart: {
    faceShape: "Heart",
    principle: "Principle of Inverted Balance & Base Widening",
    characteristic: "Broad forehead tapering gracefully to high cheekbones and a delicate pointed chin.",
    rationale: "Frames with lower visual weight or curved bases (Round, Oval, Aviator, Light Rimless) draw attention downward, harmonizing a wider forehead with a tapered chin.",
    recommendedShapes: ["Round", "Oval", "Aviator", "Light Rimless", "Clubmaster"],
    avoid: "Heavy decorative browlines, top-heavy upper rims, or exaggerated wide cat-eyes (they add excessive visual weight to the forehead)."
  },
  diamond: {
    faceShape: "Diamond",
    principle: "Principle of Eyeline Accentuation & Cheekbone Softening",
    characteristic: "Narrow forehead and jawline with prominent, sculpted high cheekbones.",
    rationale: "Frames with distinctive brow accents or sweeping curves (Cat-Eye, Oval, Round, Browline/Clubmaster) highlight the eye line while gently softening wider cheekbone points.",
    recommendedShapes: ["Cat-Eye", "Oval", "Round", "Clubmaster", "Aviator", "Geometric"],
    avoid: "Narrow horizontal rectangles or tight boxy frames (they make cheekbones appear disproportionately broad)."
  },
  oblong: {
    faceShape: "Oblong",
    principle: "Principle of Vertical Balance & Depth",
    characteristic: "Face is noticeably longer than it is wide, with an elongated straight cheek line.",
    rationale: "Taller frames with vertical depth (Aviator, Wayfarer, Deep Square, Oversized) break up vertical facial length, creating an optical illusion of width and balance.",
    recommendedShapes: ["Aviator", "Wayfarer", "Square", "Geometric", "Rectangle"],
    avoid: "Narrow, short, low-profile horizontal lenses (they make the face appear noticeably longer)."
  }
};

// GET /api/products/recommendations
// Query Param: ?shape=oval
router.get('/recommendations', async (req, res) => {
  try {
    const { shape } = req.query;

    if (!shape) {
      return res
        .status(400)
        .json({ error: 'Face shape parameter is required.' });
    }

    const faceShapeKey = shape.toLowerCase();
    const opticalRationale = WORLD_OPTICAL_RULES[faceShapeKey] || {
      faceShape: shape,
      principle: "Universal Optical Alignment",
      characteristic: "Unique balanced facial geometry.",
      rationale: "Curated selection of classic optical frames designed for all-day comfort and visual appeal.",
      recommendedShapes: ["Rectangle", "Round", "Square", "Oval", "Aviator", "Geometric"],
      avoid: "Improperly sized bridges or frame widths exceeding temple breadth."
    };

    const products = await prisma.product.findMany({
      where: {
        shape: {
          in: opticalRationale.recommendedShapes,
        },
      },
    });

    res.json({
      products,
      opticalRationale
    });
  } catch (error) {
    console.error('Error fetching frame recommendations:', error);
    res.status(500).json({ error: 'Server error retrieving recommendations.' });
  }
});

const REAL_OPTICAL_LENSES = [
  { type: "Standard Hard-Coated Scratch Resistant Lens", material: "CR-39 Standard", price: 3500.0, stockLevel: 100, description: "Durable daily optical lens with scratch resistant hard coating" },
  { type: "Lens 1 - BlueCut Precision Optical Lens", material: "Polycarbonate UV420", price: 8500.0, stockLevel: 60, description: "UV420 Blue-light blocker with ultra-clear anti-glare coating" },
  { type: "Crizal Anti-Reflective Hydrophobic Lens", material: "1.61 High-Index", price: 6500.0, stockLevel: 50, description: "Hydrophobic, smudge-resistant anti-glare coating" },
  { type: "Essilor Transitions Gen 8 Photochromic Lens", material: "Transitions Polycarbonate", price: 14000.0, stockLevel: 40, description: "Auto-darkening UV responsive light intelligent lenses" },
  { type: "1.67 Ultra-Thin High-Index Lens", material: "1.67 High-Index", price: 11500.0, stockLevel: 45, description: "High-index ultra slim lightweight lens for higher prescription powers" },
  { type: "Carl Zeiss Progressive Digital HD Lens", material: "Progressive HD Polycarbonate", price: 18500.0, stockLevel: 30, description: "Precision progressive multi-focal lens for smooth distance to near vision" }
];

// GET /api/products/lenses
// Fetch all real optical lenses from the database catalog (auto-seeding if needed)
router.get('/lenses', async (req, res) => {
  try {
    let lenses = await prisma.lens.findMany();
    // Ensure all 6 real optical lenses exist with correct LKR prices
    for (const lensData of REAL_OPTICAL_LENSES) {
      const found = lenses.find(l => l.type === lensData.type);
      if (!found) {
        try {
          await prisma.lens.create({
            data: {
              type: lensData.type,
              material: lensData.material,
              price: lensData.price,
              stockLevel: lensData.stockLevel,
              description: lensData.description,
            },
          });
        } catch (e) {
          console.warn("Lens seeding warning:", e.message);
        }
      }
    }
    lenses = await prisma.lens.findMany({
      orderBy: { price: 'asc' },
    });
    res.json(lenses);
  } catch (error) {
    console.error('Error fetching lenses:', error);
    res.status(500).json({ error: 'Server error retrieving lenses.' });
  }
});

const LENSES_CATALOG = [
  {
    name: "Air Optix Night & Day Aqua Contact Lenses",
    brand: "Air Optix",
    material: "Silicone Hydrogel",
    price: 12500.0,
    shape: "Contact Lens",
    gender: "UNISEX",
    stockLevel: 45,
    imageUrl: "/lenses/Air Optix Night & Day Aqua Contact Lenses.png"
  },
  {
    name: "Biofinity Toric Contact Lenses",
    brand: "Biofinity",
    material: "Comfilcon A (Aquaform)",
    price: 14200.0,
    shape: "Contact Lens",
    gender: "UNISEX",
    stockLevel: 35,
    imageUrl: "/lenses/Biofinity Toric Contact Lenses.png"
  },
  {
    name: "Dailies AquaComfort Plus Contact Lenses",
    brand: "Dailies",
    material: "Nelfilcon A",
    price: 11800.0,
    shape: "Contact Lens",
    gender: "UNISEX",
    stockLevel: 50,
    imageUrl: "/lenses/Dailies AquaComfort Plus Contact Lenses.png"
  },
  {
    name: "Dailies Total 1 Contact Lenses",
    brand: "Alcon",
    material: "Delefilcon A Water Gradient",
    price: 16500.0,
    shape: "Contact Lens",
    gender: "UNISEX",
    stockLevel: 40,
    imageUrl: "/lenses/Dailies Total 1 Contact Lenses.png"
  },
  {
    name: "INFUSE One-Day Contact Lenses",
    brand: "Bausch + Lomb",
    material: "Kalifilcon A (ProBalance)",
    price: 15500.0,
    shape: "Contact Lens",
    gender: "UNISEX",
    stockLevel: 30,
    imageUrl: "/lenses/INFUSE One-Day Contact Lenses.png"
  },
  {
    name: "Lens 1",
    brand: "Essilor Crizal",
    material: "1.61 High-Index Polycarbonate",
    price: 8500.0,
    shape: "Optical Lens",
    gender: "UNISEX",
    stockLevel: 60,
    imageUrl: "/lenses/Lens 1.png"
  },
  {
    name: "Precision1 Contact Lenses",
    brand: "Precision1",
    material: "Verofilcon A (SMARTSURFACE)",
    price: 13500.0,
    shape: "Contact Lens",
    gender: "UNISEX",
    stockLevel: 40,
    imageUrl: "/lenses/Precision1 Contact Lenses.png"
  },
  {
    name: "Total30 Contact Lenses",
    brand: "Total30",
    material: "Lehfilcon A Biomimetic",
    price: 14800.0,
    shape: "Contact Lens",
    gender: "UNISEX",
    stockLevel: 30,
    imageUrl: "/lenses/Total30 Contact Lenses.png"
  },
  {
    name: "ULTRA for Presbyopia Contact Lenses",
    brand: "Bausch + Lomb",
    material: "Samfilcon A (MoistureSeal)",
    price: 17200.0,
    shape: "Contact Lens",
    gender: "UNISEX",
    stockLevel: 25,
    imageUrl: "/lenses/ULTRA for Presbyopia Contact Lenses.png"
  }
];

// GET /api/products
// Fetch all products (frames + lenses catalog)
router.get('/', async (req, res) => {
  try {
    let products = await prisma.product.findMany();
    
    // Check if lenses already exist in database, if not seed them
    const existingLenses = products.filter(p => p.imageUrl && p.imageUrl.startsWith('/lenses/'));
    if (existingLenses.length < LENSES_CATALOG.length) {
      for (const lensItem of LENSES_CATALOG) {
        const found = products.find(p => p.name === lensItem.name || p.imageUrl === lensItem.imageUrl);
        if (!found) {
          try {
            await prisma.product.create({
              data: lensItem
            });
          } catch (e) {
            console.warn("Lens product seed warning:", e.message);
          }
        }
      }
      products = await prisma.product.findMany();
    }
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Server error retrieving products.' });
  }
});

// POST /api/products
// Create a new product with 3D model upload (Optician / Admin only)
router.post(
  '/',
  authMiddleware,
  (req, res, next) => {
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'image', maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    const userRole = req.user.role;
    if (userRole !== 'OPTICIAN' && userRole !== 'ADMIN') {
      return res.status(403).json({
        error: 'Unauthorized. Only opticians and admins can manage products.',
      });
    }

    const { name, brand, material, price, shape, gender, stockLevel } =
      req.body;

    if (
      !name ||
      !brand ||
      !material ||
      price === undefined ||
      !shape ||
      !gender
    ) {
      return res.status(400).json({
        error:
          'Missing required product fields (name, brand, material, price, shape, gender).',
      });
    }

    const modelFile = req.files?.['file']?.[0];
    const imageFile = req.files?.['image']?.[0];

    if (!modelFile && !imageFile) {
      return res.status(400).json({
        error: 'Please upload a 3D model file (.glb) or a preview image.',
      });
    }

    const modelUrl = modelFile ? `/uploads/${modelFile.filename}` : null;
    let imageUrl = imageFile ? `/uploads/${imageFile.filename}` : null;

    // For backwards compatibility: if no preview image is uploaded, fallback imageUrl to the model path
    if (!imageUrl && modelUrl) {
      imageUrl = modelUrl;
    }

    try {
      const newProduct = await prisma.product.create({
        data: {
          name,
          brand,
          material,
          price: parseFloat(price),
          shape,
          gender,
          stockLevel: parseInt(stockLevel) || 0,
          imageUrl: imageUrl,
          modelUrl: modelUrl,
        },
      });
      res.status(201).json(newProduct);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ error: 'Server error creating product.' });
    }
  },
);

// PUT /api/products/:id
// Update an existing product (Optician / Admin only)
router.put(
  '/:id',
  authMiddleware,
  (req, res, next) => {
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'image', maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    const userRole = req.user.role;
    if (userRole !== 'OPTICIAN' && userRole !== 'ADMIN') {
      return res.status(403).json({
        error: 'Unauthorized. Only opticians and admins can manage products.',
      });
    }

    const { id } = req.params;
    const { name, brand, material, price, shape, gender, stockLevel } =
      req.body;

    try {
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return res
          .status(404)
          .json({ error: `Product with ID ${id} not found.` });
      }

      const modelFile = req.files?.['file']?.[0];
      const imageFile = req.files?.['image']?.[0];

      const modelUrl = modelFile ? `/uploads/${modelFile.filename}` : undefined;
      const imageUrl = imageFile ? `/uploads/${imageFile.filename}` : undefined;

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(brand && { brand }),
          ...(material && { material }),
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(shape && { shape }),
          ...(gender && { gender }),
          ...(stockLevel !== undefined && { stockLevel: parseInt(stockLevel) }),
          ...(modelUrl !== undefined && { modelUrl }),
          ...(imageUrl !== undefined && { imageUrl }),
        },
      });
      res.json(updatedProduct);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ error: 'Server error updating product.' });
    }
  },
);

// PUT /api/products/:id/calibration
// Update 3D model calibration parameters (Optician / Admin only)
router.put('/:id/calibration', authMiddleware, async (req, res) => {
  const userRole = req.user.role;
  if (userRole !== 'OPTICIAN' && userRole !== 'ADMIN') {
    return res.status(403).json({
      error: 'Unauthorized. Only opticians and admins can calibrate products.',
    });
  }

  const { id } = req.params;
  const { scaleMultiplier, xOffset, yOffset, zOffset, rotationX, rotationY, rotationZ } = req.body;

  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: `Product with ID ${id} not found.` });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        scaleMultiplier: scaleMultiplier !== undefined ? parseFloat(scaleMultiplier) : product.scaleMultiplier,
        xOffset: xOffset !== undefined ? parseFloat(xOffset) : product.xOffset,
        yOffset: yOffset !== undefined ? parseFloat(yOffset) : product.yOffset,
        zOffset: zOffset !== undefined ? parseFloat(zOffset) : product.zOffset,
        rotationX: rotationX !== undefined ? parseFloat(rotationX) : product.rotationX,
        rotationY: rotationY !== undefined ? parseFloat(rotationY) : product.rotationY,
        rotationZ: rotationZ !== undefined ? parseFloat(rotationZ) : product.rotationZ,
      },
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating frame calibration:', error);
    res.status(500).json({ error: 'Server error updating frame calibration.' });
  }
});

// PATCH /api/products/:id/shape
// Quick 1-click shape correction (Optician / Admin only)
router.patch('/:id/shape', authMiddleware, async (req, res) => {
  const userRole = req.user.role;
  if (userRole !== 'OPTICIAN' && userRole !== 'ADMIN') {
    return res.status(403).json({
      error: 'Unauthorized. Only opticians and admins can update frame shapes.',
    });
  }

  const { id } = req.params;
  const { shape } = req.body;

  if (!shape) {
    return res.status(400).json({ error: 'Frame shape is required.' });
  }

  try {
    const updated = await prisma.product.update({
      where: { id },
      data: { shape },
    });
    res.json({ message: 'Frame shape updated successfully', product: updated });
  } catch (error) {
    console.error('Error updating frame shape:', error);
    res.status(500).json({ error: 'Failed to update frame shape.' });
  }
});

// DELETE /api/products/:id
// Delete a product (Optician / Admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  const userRole = req.user.role;
  if (userRole !== 'OPTICIAN' && userRole !== 'ADMIN') {
    return res.status(403).json({
      error: 'Unauthorized. Only opticians and admins can manage products.',
    });
  }

  const { id } = req.params;

  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res
        .status(404)
        .json({ error: `Product with ID ${id} not found.` });
    }

    await prisma.product.delete({
      where: { id },
    });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Server error deleting product.' });
  }
});

export default router;

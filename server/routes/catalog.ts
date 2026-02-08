import { Router } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { asyncHandler, BadRequestError, NotFoundError } from "../middleware/errorHandler";
import { storage } from "../storage";
import {
  insertComponentCatalogSchema,
  insertPricingComponentSchema,
  insertSupplierSchema,
  insertPriceHistorySchema,
} from "@shared/schema";
import { createLogger } from "../lib/logger";

const log = createLogger("Catalog");
const router = Router();

router.get("/api/catalog", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const catalog = await storage.getCatalog();
  res.json(catalog);
}));

router.post("/api/catalog", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const parsed = insertComponentCatalogSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError("Validation error", parsed.error.errors);
  }

  const item = await storage.createCatalogItem(parsed.data);
  res.status(201).json(item);
}));

router.patch("/api/catalog/:id", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const item = await storage.updateCatalogItem(req.params.id, req.body);
  if (!item) {
    throw new NotFoundError("Item");
  }
  res.json(item);
}));

router.delete("/api/catalog/:id", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const deleted = await storage.deleteCatalogItem(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Item");
  }
  res.status(204).send();
}));

router.get("/api/pricing-components", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const components = await storage.getPricingComponents();
  res.json(components);
}));

router.get("/api/pricing-components/active", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const components = await storage.getActivePricingComponents();
  res.json(components);
}));

router.get("/api/pricing-components/category/:category", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const components = await storage.getPricingComponentsByCategory(req.params.category);
  res.json(components);
}));

router.get("/api/pricing-components/:id", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const component = await storage.getPricingComponent(req.params.id);
  if (!component) {
    throw new NotFoundError("Component");
  }
  res.json(component);
}));

router.post("/api/pricing-components", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const parsed = insertPricingComponentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError("Validation error", parsed.error.errors);
  }
  const component = await storage.createPricingComponent(parsed.data);
  res.status(201).json(component);
}));

router.patch("/api/pricing-components/:id", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const component = await storage.updatePricingComponent(req.params.id, req.body);
  if (!component) {
    throw new NotFoundError("Component");
  }
  res.json(component);
}));

router.delete("/api/pricing-components/:id", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const deleted = await storage.deletePricingComponent(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Component");
  }
  res.status(204).send();
}));

router.get("/api/suppliers", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const suppliers = await storage.getSuppliers();
  res.json(suppliers);
}));

router.get("/api/suppliers/category/:category", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const suppliers = await storage.getSuppliersByCategory(req.params.category);
  res.json(suppliers);
}));

router.get("/api/suppliers/:id", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const supplier = await storage.getSupplier(req.params.id);
  if (!supplier) {
    throw new NotFoundError("Supplier");
  }
  res.json(supplier);
}));

router.post("/api/suppliers", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = insertSupplierSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError("Validation error", parsed.error.errors);
  }
  const supplier = await storage.createSupplier(parsed.data);
  res.status(201).json(supplier);
}));

router.patch("/api/suppliers/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const supplier = await storage.updateSupplier(req.params.id, req.body);
  if (!supplier) {
    throw new NotFoundError("Supplier");
  }
  res.json(supplier);
}));

router.delete("/api/suppliers/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deleteSupplier(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Supplier");
  }
  res.status(204).send();
}));

router.get("/api/price-history", authMiddleware, requireStaff, asyncHandler(async (req, res) => {
  const { category, supplierId, itemName } = req.query;

  let history;
  if (supplierId && typeof supplierId === 'string') {
    history = await storage.getPriceHistoryBySupplier(supplierId);
  } else if (category && typeof category === 'string') {
    history = await storage.getPriceHistoryByCategory(category);
  } else if (itemName && typeof itemName === 'string') {
    history = await storage.getPriceHistoryByItem(itemName);
  } else {
    history = await storage.getPriceHistory();
  }

  res.json(history);
}));

router.post("/api/price-history", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = insertPriceHistorySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new BadRequestError("Validation error", parsed.error.errors);
  }
  const entry = await storage.createPriceHistory(parsed.data);
  res.status(201).json(entry);
}));

router.delete("/api/price-history/:id", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const deleted = await storage.deletePriceHistory(req.params.id);
  if (!deleted) {
    throw new NotFoundError("Price history entry");
  }
  res.status(204).send();
}));

router.post("/api/price-history/:id/promote-to-catalog", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const priceEntry = await storage.getPriceHistoryById(req.params.id);
  if (!priceEntry) {
    throw new NotFoundError("Price history entry");
  }

  let manufacturerName = "Unknown";
  if (priceEntry.supplierId) {
    const supplier = await storage.getSupplier(priceEntry.supplierId);
    if (supplier) {
      manufacturerName = supplier.name;
    }
  }

  const existingItem = await storage.getCatalogItemByManufacturerModel(
    manufacturerName,
    priceEntry.itemName
  );

  if (existingItem) {
    const updated = await storage.updateCatalogItem(existingItem.id, {
      unitCost: priceEntry.pricePerUnit,
    });
    return res.json({
      message: "Catalog item updated",
      catalogItem: updated,
      action: "updated"
    });
  } else {
    const newItem = await storage.createCatalogItem({
      category: priceEntry.category,
      manufacturer: manufacturerName,
      model: priceEntry.itemName,
      unitCost: priceEntry.pricePerUnit,
      active: true,
    });
    return res.status(201).json({
      message: "Catalog item created",
      catalogItem: newItem,
      action: "created"
    });
  }
}));

export default router;

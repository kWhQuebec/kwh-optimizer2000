import { Router, Response } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
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

router.get("/api/catalog", authMiddleware, requireStaff, async (req, res) => {
  try {
    const catalog = await storage.getCatalog();
    res.json(catalog);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/catalog", authMiddleware, requireStaff, async (req, res) => {
  try {
    const parsed = insertComponentCatalogSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const item = await storage.createCatalogItem(parsed.data);
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/catalog/:id", authMiddleware, requireStaff, async (req, res) => {
  try {
    const item = await storage.updateCatalogItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/catalog/:id", authMiddleware, requireStaff, async (req, res) => {
  try {
    const deleted = await storage.deleteCatalogItem(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/pricing-components", authMiddleware, requireStaff, async (req, res) => {
  try {
    const components = await storage.getPricingComponents();
    res.json(components);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/pricing-components/active", authMiddleware, requireStaff, async (req, res) => {
  try {
    const components = await storage.getActivePricingComponents();
    res.json(components);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/pricing-components/category/:category", authMiddleware, requireStaff, async (req, res) => {
  try {
    const components = await storage.getPricingComponentsByCategory(req.params.category);
    res.json(components);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/pricing-components/:id", authMiddleware, requireStaff, async (req, res) => {
  try {
    const component = await storage.getPricingComponent(req.params.id);
    if (!component) {
      return res.status(404).json({ error: "Component not found" });
    }
    res.json(component);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/pricing-components", authMiddleware, requireStaff, async (req, res) => {
  try {
    const parsed = insertPricingComponentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const component = await storage.createPricingComponent(parsed.data);
    res.status(201).json(component);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/pricing-components/:id", authMiddleware, requireStaff, async (req, res) => {
  try {
    const component = await storage.updatePricingComponent(req.params.id, req.body);
    if (!component) {
      return res.status(404).json({ error: "Component not found" });
    }
    res.json(component);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/pricing-components/:id", authMiddleware, requireStaff, async (req, res) => {
  try {
    const deleted = await storage.deletePricingComponent(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Component not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/suppliers", authMiddleware, requireStaff, async (req, res) => {
  try {
    const suppliers = await storage.getSuppliers();
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/suppliers/category/:category", authMiddleware, requireStaff, async (req, res) => {
  try {
    const suppliers = await storage.getSuppliersByCategory(req.params.category);
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/suppliers/:id", authMiddleware, requireStaff, async (req, res) => {
  try {
    const supplier = await storage.getSupplier(req.params.id);
    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/suppliers", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const parsed = insertSupplierSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const supplier = await storage.createSupplier(parsed.data);
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/api/suppliers/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const supplier = await storage.updateSupplier(req.params.id, req.body);
    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/suppliers/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const deleted = await storage.deleteSupplier(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Supplier not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/price-history", authMiddleware, requireStaff, async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/price-history", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const parsed = insertPriceHistorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const entry = await storage.createPriceHistory(parsed.data);
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/price-history/:id", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const deleted = await storage.deletePriceHistory(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Price history entry not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/price-history/:id/promote-to-catalog", authMiddleware, requireStaff, async (req: AuthRequest, res) => {
  try {
    const priceEntry = await storage.getPriceHistoryById(req.params.id);
    if (!priceEntry) {
      return res.status(404).json({ error: "Price history entry not found" });
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
  } catch (error) {
    log.error("Error promoting price to catalog:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

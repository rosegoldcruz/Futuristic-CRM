#!/usr/bin/env python3
"""
Seed suppliers and products data
Adds Highland Cabinetry Inc (HCI) and QuickKit with their full product catalogs
"""
import asyncio
import sys
from config.db import execute_returning, execute
from pathlib import Path

# Highland Cabinetry Inc (HCI) - From catalog screenshots
HCI_SUPPLIER = {
    "name": "Highland Cabinetry Inc",
    "contact_name": "Sales Department",
    "email": "sales@highlandcabinetry.com",
    "phone": "1-800-555-HCI1",
    "website": "https://highlandcabinetry.com",
    "supplier_type": "manufacturer",
    "city": "Phoenix",
    "state": "AZ",
    "postal_code": "85001",
    "internal_notes": "Premium cabinet manufacturer - full product line from 2023 catalog",
    "is_active": True,
}

# QuickKit Cabinet Refacing
QUICKKIT_SUPPLIER = {
    "name": "QuickKit Cabinet Refacing",
    "contact_name": "Customer Service",
    "email": "orders@quickkit.com",
    "phone": "1-888-QUICKKIT",
    "website": "https://quickkit.com",
    "supplier_type": "materials",
    "city": "Dallas",
    "state": "TX",
    "postal_code": "75001",
    "internal_notes": "DIY cabinet refacing kits and supplies - fast shipping",
    "is_active": True,
}

# HCI Product Categories from catalog
HCI_PRODUCTS = [
    # Door Styles
    {
        "name": "Shaker Style Door",
        "description": "Classic shaker style recessed panel door - most popular choice",
        "category": "doors",
        "sku_prefix": "HCI-SHK",
        "base_price": 95.00,
        "base_cost": 48.00,
        "unit": "each",
        "available_styles": ["standard_shaker", "wide_rail", "narrow_rail"],
        "available_colors": ["white", "off_white", "gray", "navy", "sage_green", "natural_maple", "cherry", "walnut"],
        "available_finishes": ["painted", "stained", "glazed"],
        "specifications": {"material": "MDF or hardwood", "thickness": "3/4 inch", "warranty": "Limited lifetime"},
    },
    {
        "name": "Raised Panel Door",
        "description": "Traditional raised panel design - elegant and timeless",
        "category": "doors",
        "sku_prefix": "HCI-RAI",
        "base_price": 125.00,
        "base_cost": 62.00,
        "unit": "each",
        "available_styles": ["cathedral", "square", "arched"],
        "available_colors": ["white", "cream", "cherry", "maple", "oak"],
        "available_finishes": ["painted", "stained", "glazed", "distressed"],
        "specifications": {"material": "Solid hardwood", "thickness": "3/4 inch"},
    },
    {
        "name": "Slab/Modern Door",
        "description": "Clean contemporary flat panel door",
        "category": "doors",
        "sku_prefix": "HCI-SLB",
        "base_price": 110.00,
        "base_cost": 55.00,
        "unit": "each",
        "available_styles": ["flat_slab", "horizontal_grain", "vertical_grain"],
        "available_colors": ["white", "black", "gray", "navy", "walnut", "bamboo"],
        "available_finishes": ["painted", "stained", "high_gloss", "matte"],
        "specifications": {"material": "MDF or veneer", "thickness": "3/4 inch"},
    },
    {
        "name": "Glass Door",
        "description": "Frame with glass insert - perfect for display cabinets",
        "category": "doors",
        "sku_prefix": "HCI-GLS",
        "base_price": 165.00,
        "base_cost": 85.00,
        "unit": "each",
        "available_styles": ["clear_glass", "seeded_glass", "frosted_glass", "mullion"],
        "available_colors": ["white", "gray", "cherry", "maple"],
        "available_finishes": ["painted", "stained"],
        "specifications": {"glass_type": "Tempered safety glass", "frame_material": "Hardwood"},
    },
    
    # Drawer Fronts
    {
        "name": "Drawer Front - Matching",
        "description": "Drawer front to match door style",
        "category": "panels",
        "sku_prefix": "HCI-DRW",
        "base_price": 55.00,
        "base_cost": 28.00,
        "unit": "each",
        "available_styles": ["shaker", "raised_panel", "slab"],
        "available_colors": ["white", "gray", "cherry", "maple", "walnut"],
        "available_finishes": ["painted", "stained", "glazed"],
        "specifications": {"available_sizes": "Multiple sizes available"},
    },
    
    # End Panels & Accessories
    {
        "name": "Finished End Panel",
        "description": "Finished panel for exposed cabinet ends",
        "category": "panels",
        "sku_prefix": "HCI-END",
        "base_price": 145.00,
        "base_cost": 75.00,
        "unit": "each",
        "available_styles": ["matching_door_style"],
        "available_colors": ["white", "gray", "cherry", "maple"],
        "available_finishes": ["painted", "stained"],
        "specifications": {"standard_sizes": "96\" x 24\", custom available"},
    },
    {
        "name": "Crown Molding",
        "description": "Decorative crown molding to match cabinet style",
        "category": "accessories",
        "sku_prefix": "HCI-CRN",
        "base_price": 32.00,
        "base_cost": 16.00,
        "unit": "linear_foot",
        "available_styles": ["traditional", "contemporary", "simple"],
        "available_colors": ["white", "gray", "cherry", "maple"],
        "available_finishes": ["painted", "stained"],
    },
    {
        "name": "Light Rail Molding",
        "description": "Under-cabinet light rail trim",
        "category": "accessories",
        "sku_prefix": "HCI-LGT",
        "base_price": 18.00,
        "base_cost": 9.00,
        "unit": "linear_foot",
        "available_colors": ["white", "gray", "cherry", "maple"],
        "available_finishes": ["painted", "stained"],
    },
    {
        "name": "Toe Kick",
        "description": "Matching toe kick material",
        "category": "accessories",
        "sku_prefix": "HCI-TOE",
        "base_price": 12.00,
        "base_cost": 6.00,
        "unit": "linear_foot",
        "available_colors": ["white", "gray", "cherry", "maple"],
        "available_finishes": ["painted", "stained"],
    },
    
    # Hardware
    {
        "name": "Soft-Close Hinges",
        "description": "European-style soft-close concealed hinges",
        "category": "hardware",
        "sku_prefix": "HCI-HNG",
        "base_price": 8.50,
        "base_cost": 4.25,
        "unit": "each",
        "available_colors": ["nickel", "black"],
        "specifications": {"load_capacity": "110° opening", "brand": "Blum or equal"},
    },
]

# QuickKit Products
QUICKKIT_PRODUCTS = [
    {
        "name": "Complete Kitchen Refacing Kit",
        "description": "All-in-one DIY kitchen cabinet refacing kit - includes doors, drawer fronts, hardware",
        "category": "other",
        "sku_prefix": "QK-KIT-FULL",
        "base_price": 2499.00,
        "base_cost": 1250.00,
        "unit": "kit",
        "available_styles": ["shaker", "raised_panel", "slab"],
        "available_colors": ["white", "gray", "espresso"],
        "available_finishes": ["painted", "stained"],
        "specifications": {"includes": "Doors, drawer fronts, hinges, hardware, instructions"},
    },
    {
        "name": "Door-Only Refacing Kit",
        "description": "Replacement doors only - for existing cabinet boxes",
        "category": "doors",
        "sku_prefix": "QK-KIT-DOOR",
        "base_price": 1299.00,
        "base_cost": 650.00,
        "unit": "kit",
        "available_styles": ["shaker", "slab"],
        "available_colors": ["white", "gray", "black"],
        "available_finishes": ["painted"],
        "specifications": {"includes": "Pre-hung doors with hinges"},
    },
    {
        "name": "Peel & Stick Cabinet Film",
        "description": "Self-adhesive vinyl film for cabinet box covering",
        "category": "finishes",
        "sku_prefix": "QK-FILM",
        "base_price": 89.00,
        "base_cost": 45.00,
        "unit": "roll",
        "available_colors": ["white", "gray", "black", "wood_grain"],
        "available_finishes": ["matte", "gloss"],
        "specifications": {"coverage": "50 sq ft per roll", "thickness": "3mil"},
    },
    {
        "name": "RTF (Rigid Thermofoil) Door",
        "description": "Pre-finished RTF door - ready to install",
        "category": "doors",
        "sku_prefix": "QK-RTF",
        "base_price": 45.00,
        "base_cost": 22.50,
        "unit": "each",
        "available_styles": ["shaker", "flat"],
        "available_colors": ["white", "linen", "gray"],
        "available_finishes": ["matte"],
        "specifications": {"material": "MDF with thermofoil", "edge": "Seamless wrap"},
    },
    {
        "name": "Cabinet Hardware Pack",
        "description": "Matching pulls and knobs - pack of 25",
        "category": "hardware",
        "sku_prefix": "QK-HW-PACK",
        "base_price": 129.00,
        "base_cost": 65.00,
        "unit": "pack",
        "available_styles": ["bar_pull", "cup_pull", "knob"],
        "available_colors": ["brushed_nickel", "matte_black", "chrome", "brass"],
        "specifications": {"quantity": "25 pieces per pack", "screws_included": True},
    },
]


async def create_supplier(supplier_data: dict) -> int:
    """Create a supplier and return its ID"""
    query = """
        INSERT INTO suppliers (name, contact_name, email, phone, website, supplier_type, 
                             city, state, postal_code, internal_notes, is_active, metadata)
        VALUES (:name, :contact_name, :email, :phone, :website, :supplier_type,
                :city, :state, :postal_code, :internal_notes, :is_active, '{}'::jsonb)
        RETURNING id, name
    """
    row = await execute_returning(query, supplier_data)
    if row:
        print(f"✓ Created supplier: {row['name']} (ID: {row['id']})")
        return row['id']
    raise Exception("Failed to create supplier")


async def create_product(product_data: dict, supplier_id: int, tenant_id: int = 1) -> None:
    """Create a product"""
    import json
    
    query = """
        INSERT INTO products (
            tenant_id, supplier_id, name, description, category, sku_prefix,
            base_price, base_cost, unit, status, available_styles, available_colors,
            available_finishes, specifications, metadata
        ) VALUES (
            :tenant_id, :supplier_id, :name, :description, :category, :sku_prefix,
            :base_price, :base_cost, :unit, :status,
            CAST(:available_styles AS jsonb), CAST(:available_colors AS jsonb), 
            CAST(:available_finishes AS jsonb), CAST(:specifications AS jsonb), '{}'::jsonb
        )
        RETURNING id, name
    """
    
    params = {
        "tenant_id": tenant_id,
        "supplier_id": supplier_id,
        "name": product_data["name"],
        "description": product_data.get("description"),
        "category": product_data.get("category", "other"),
        "sku_prefix": product_data.get("sku_prefix"),
        "base_price": product_data.get("base_price"),
        "base_cost": product_data.get("base_cost"),
        "unit": product_data.get("unit", "each"),
        "status": "active",
        "available_styles": json.dumps(product_data.get("available_styles", [])),
        "available_colors": json.dumps(product_data.get("available_colors", [])),
        "available_finishes": json.dumps(product_data.get("available_finishes", [])),
        "specifications": json.dumps(product_data.get("specifications", {})),
    }
    
    row = await execute_returning(query, params)
    if row:
        print(f"  ✓ Added product: {row['name']}")


async def main():
    """Seed suppliers and products"""
    print("\n" + "="*70)
    print("SEEDING SUPPLIERS & PRODUCTS DATA")
    print("="*70 + "\n")
    
    try:
        # Create Highland Cabinetry Inc
        print("Creating Highland Cabinetry Inc (HCI)...")
        hci_id = await create_supplier(HCI_SUPPLIER)
        
        print(f"\nAdding {len(HCI_PRODUCTS)} HCI products...")
        for product in HCI_PRODUCTS:
            await create_product(product, hci_id)
        
        print("\n" + "-"*70 + "\n")
        
        # Create QuickKit
        print("Creating QuickKit Cabinet Refacing...")
        quickkit_id = await create_supplier(QUICKKIT_SUPPLIER)
        
        print(f"\nAdding {len(QUICKKIT_PRODUCTS)} QuickKit products...")
        for product in QUICKKIT_PRODUCTS:
            await create_product(product, quickkit_id)
        
        print("\n" + "="*70)
        print("✅ DATA SEEDING COMPLETE!")
        print(f"   - Highland Cabinetry Inc: {len(HCI_PRODUCTS)} products")
        print(f"   - QuickKit: {len(QUICKKIT_PRODUCTS)} products")
        print("="*70 + "\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

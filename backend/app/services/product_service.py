from typing import Any
from decimal import Decimal

# Realistic Electrical Products Catalog for E-Commerce Store
ELECTRICAL_PRODUCTS: list[dict[str, Any]] = [
    {
        "id": "prod_led_bulb_01",
        "name": "Philips Stellar 12W LED Bulb (Cool Day White)",
        "category": "Lighting",
        "price": 199.00,
        "currency": "INR",
        "stock": 140,
        "in_stock": True,
        "rating": 4.8,
        "reviews_count": 520,
        "badge": "Bestseller",
        "image_url": "https://images.unsplash.com/photo-1550524514-6c70313172ca?w=600&auto=format&fit=crop&q=80",
        "description": "Energy-efficient 12W B22 LED bulb offering 1200 Lumens crystal clear cool daylight with surge protection up to 4kV.",
        "specs": {
            "Wattage": "12W",
            "Cap Fitting": "B22",
            "Lumens": "1200 lm",
            "Lifespan": "25,000 Hours",
            "Color Temp": "6500K",
            "Warranty": "2 Years",
        },
    },
    {
        "id": "prod_smart_bulb_02",
        "name": "Wipro Next 20W Smart RGB LED Bulb (WiFi + Alexa)",
        "category": "Lighting",
        "price": 1299.00,
        "currency": "INR",
        "stock": 85,
        "in_stock": True,
        "rating": 4.7,
        "reviews_count": 340,
        "badge": "Smart Home",
        "image_url": "https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop&q=80",
        "description": "16 million colors tunable smart bulb with voice control via Amazon Alexa & Google Home, scheduling, and music sync.",
        "specs": {
            "Wattage": "20W",
            "Connectivity": "WiFi 2.4GHz",
            "Colors": "16 Million RGB",
            "Voice Control": "Alexa / Google Assistant",
            "App": "Wipro Next Smart Home",
            "Warranty": "2 Years",
        },
    },
    {
        "id": "prod_tube_light_03",
        "name": "Havells Glaze 20W T5 LED Tube Light (4 Feet)",
        "category": "Lighting",
        "price": 499.00,
        "currency": "INR",
        "stock": 95,
        "in_stock": True,
        "rating": 4.6,
        "reviews_count": 180,
        "badge": "Energy Saver",
        "image_url": "https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=600&auto=format&fit=crop&q=80",
        "description": "Ultra-slim 20W batten tube light with uniform light distribution, glare-free optical diffuser, and corrosion-resistant body.",
        "specs": {
            "Length": "4 Feet (1200mm)",
            "Wattage": "20W",
            "Lumens": "2200 lm",
            "Material": "Polycarbonate Extrusion",
            "Warranty": "2 Years",
        },
    },
    {
        "id": "prod_ceiling_fan_04",
        "name": "Crompton HighBreeze 1200mm Ceiling Fan (Brown)",
        "category": "Fans & Cooling",
        "price": 3499.00,
        "currency": "INR",
        "stock": 42,
        "in_stock": True,
        "rating": 4.8,
        "reviews_count": 410,
        "badge": "High Air Delivery",
        "image_url": "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=80",
        "description": "High-speed 380 RPM ceiling fan with 100% copper motor, double ball bearing, and aerodynamic ribbed blades.",
        "specs": {
            "Sweep": "1200 mm (48 inches)",
            "Speed": "380 RPM",
            "Air Delivery": "230 CMM",
            "Power Consumption": "70W",
            "Motor": "100% Copper Winding",
            "Warranty": "2 Years",
        },
    },
    {
        "id": "prod_smart_fan_05",
        "name": "Atomberg Renesa BLDC Smart Ceiling Fan with Remote",
        "category": "Fans & Cooling",
        "price": 7499.00,
        "currency": "INR",
        "stock": 35,
        "in_stock": True,
        "rating": 4.9,
        "reviews_count": 620,
        "badge": "5-Star BLDC",
        "image_url": "https://images.unsplash.com/photo-1594918074900-50d4f20f66e0?w=600&auto=format&fit=crop&q=80",
        "description": "Super energy-efficient BLDC motor saves up to 65% electricity (consumes only 28W). Comes with smart remote & IoT WiFi app control.",
        "specs": {
            "Motor": "BLDC Inverter Tech",
            "Power": "28W (Saves ₹1500/yr)",
            "Sweep": "1200 mm",
            "Speed": "360 RPM",
            "Control": "IR Remote & IoT App",
            "Warranty": "3 Years On-Site",
        },
    },
    {
        "id": "prod_table_fan_06",
        "name": "Usha Mist Air 400mm High-Speed Table Fan",
        "category": "Fans & Cooling",
        "price": 1999.00,
        "currency": "INR",
        "stock": 50,
        "in_stock": True,
        "rating": 4.5,
        "reviews_count": 195,
        "badge": "Compact Air",
        "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&auto=format&fit=crop&q=80",
        "description": "Aerodynamically designed 3-blade table fan with 100% copper motor, thermal overload protector, and smooth oscillation.",
        "specs": {
            "Sweep": "400 mm",
            "Speed": "1280 RPM",
            "Power": "55W",
            "Oscillation": "90 Degree Wide",
            "Warranty": "2 Years",
        },
    },
    {
        "id": "prod_exhaust_fan_07",
        "name": "Luminous Vento Deluxe 200mm High-Suction Exhaust Fan",
        "category": "Fans & Cooling",
        "price": 1499.00,
        "currency": "INR",
        "stock": 60,
        "in_stock": True,
        "rating": 4.6,
        "reviews_count": 130,
        "badge": "Silent Suction",
        "image_url": "https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?w=600&auto=format&fit=crop&q=80",
        "description": "High air suction exhaust fan for kitchens and bathrooms with automatic back shutters to prevent dust and insects.",
        "specs": {
            "Sweep": "200 mm",
            "Air Suction": "490 CMM",
            "Shutter": "Automatic Louver",
            "Body": "Rust-Proof Polycarbonate",
            "Warranty": "2 Years",
        },
    },
    {
        "id": "prod_electric_kettle_08",
        "name": "Prestige 1.5L Stainless Steel Fast-Boil Electric Kettle",
        "category": "Kitchen Appliances",
        "price": 1299.00,
        "currency": "INR",
        "stock": 70,
        "in_stock": True,
        "rating": 4.7,
        "reviews_count": 310,
        "badge": "Fast Boil",
        "image_url": "https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=600&auto=format&fit=crop&q=80",
        "description": "1500W rapid boil electric kettle with automatic shut-off, boil-dry protection, 360-degree swivel base, and food-grade 304 steel.",
        "specs": {
            "Capacity": "1.5 Liters",
            "Power": "1500W",
            "Material": "304 Stainless Steel",
            "Safety": "Auto Cut-Off & Dry Boil Lock",
            "Warranty": "1 Year",
        },
    },
    {
        "id": "prod_mixer_grinder_09",
        "name": "Philips HL7756 750W Heavy-Duty Mixer Grinder (3 Jars)",
        "category": "Kitchen Appliances",
        "price": 6999.00,
        "currency": "INR",
        "stock": 40,
        "in_stock": True,
        "rating": 4.8,
        "reviews_count": 890,
        "badge": "Heavy Duty 750W",
        "image_url": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&auto=format&fit=crop&q=80",
        "description": "Turbo 750W motor with advanced air ventilation to grind toughest spices like turmeric in 2 minutes. Includes 3 stainless steel leak-proof jars.",
        "specs": {
            "Motor Power": "750W Turbo",
            "Jars": "1.5L Wet, 1.0L Multipurpose, 0.3L Chutney",
            "Blades": "Specially designed 304 stainless steel",
            "Overload Protection": "Yes",
            "Warranty": "2 Years on Product, 5 Years on Motor",
        },
    },
    {
        "id": "prod_induction_stove_10",
        "name": "Pigeon Cruise 2100W Digital Induction Cooktop",
        "category": "Kitchen Appliances",
        "price": 3499.00,
        "currency": "INR",
        "stock": 45,
        "in_stock": True,
        "rating": 4.6,
        "reviews_count": 415,
        "badge": "Digital Touch",
        "image_url": "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80",
        "description": "7 preset Indian cooking menus, soft push button control, dual heat sensor, and LED display for high-efficiency energy-saving cooking.",
        "specs": {
            "Power": "2100W",
            "Presets": "7 Indian Cooking Modes",
            "Glass Plate": "High Grade Crystal Glass",
            "Auto Switch Off": "Yes",
            "Warranty": "1 Year",
        },
    },
    {
        "id": "prod_emergency_light_11",
        "name": "Wipro Coral Rechargeable 24-LED Emergency Lantern",
        "category": "Lighting",
        "price": 899.00,
        "currency": "INR",
        "stock": 80,
        "in_stock": True,
        "rating": 4.5,
        "reviews_count": 220,
        "badge": "Long Backup",
        "image_url": "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600&auto=format&fit=crop&q=80",
        "description": "Powerful 24 LED lantern with 3000mAh lithium-ion battery providing up to 8 hours backup, 360-degree illumination, and auto-on on power cut.",
        "specs": {
            "LED Count": "24 Bright LEDs",
            "Battery": "3000mAh Li-ion",
            "Backup Time": "Up to 8 Hours",
            "Charging Time": "4-5 Hours",
            "Warranty": "1 Year",
        },
    },
    {
        "id": "prod_extension_board_12",
        "name": "Anchor by Panasonic 4-Socket Heavy Extension Board",
        "category": "Power & Cables",
        "price": 499.00,
        "currency": "INR",
        "stock": 110,
        "in_stock": True,
        "rating": 4.7,
        "reviews_count": 310,
        "badge": "Surge Protected",
        "image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
        "description": "4 universal international sockets with individual switch indicators, 2-meter heavy copper cord, and fire-retardant housing.",
        "specs": {
            "Sockets": "4 Universal Sockets",
            "Cord Length": "2 Meters Heavy Duty",
            "Rating": "6A 240V AC",
            "Material": "Flame-Retardant Polycarbonate",
            "Warranty": "1 Year",
        },
    },
    {
        "id": "prod_power_strip_13",
        "name": "Belkin 6-Socket Essential Surge Protector Power Strip",
        "category": "Power & Cables",
        "price": 899.00,
        "currency": "INR",
        "stock": 75,
        "in_stock": True,
        "rating": 4.8,
        "reviews_count": 550,
        "badge": "650 Joules Surge",
        "image_url": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80",
        "description": "650-Joule surge protection protects expensive computers, home theaters, and gaming consoles against voltage spikes and lightning.",
        "specs": {
            "Surge Rating": "650 Joules",
            "Sockets": "6 Grounded Sockets",
            "Max Current": "10A / 2400W",
            "Cable": "2 Meter Heavy Duty",
            "Warranty": "5 Years / Connected Equipment Warranty",
        },
    },
    {
        "id": "prod_mobile_charger_14",
        "name": "Ambrane 65W GaN Dual-Port Fast Wall Charger",
        "category": "Power & Cables",
        "price": 699.00,
        "currency": "INR",
        "stock": 90,
        "in_stock": True,
        "rating": 4.7,
        "reviews_count": 270,
        "badge": "65W GaN Tech",
        "image_url": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80",
        "description": "Ultra-compact Gallium Nitride (GaN) fast charger with USB-C PD 65W and USB-A QuickCharge 3.0 for laptops, tablets, and phones.",
        "specs": {
            "Output": "65W Max USB-C PD + 18W USB-A",
            "Technology": "GaN (Gallium Nitride)",
            "Compatibility": "MacBook, iPhone, Samsung, Pixel",
            "Safety": "Over-heat, Over-voltage Multi-Protection",
            "Warranty": "1 Year",
        },
    },
    {
        "id": "prod_usb_cable_15",
        "name": "Boat Rugged Braided USB-C to USB-C 100W Fast Cable",
        "category": "Power & Cables",
        "price": 299.00,
        "currency": "INR",
        "stock": 130,
        "in_stock": True,
        "rating": 4.6,
        "reviews_count": 480,
        "badge": "Nylon Braided",
        "image_url": "https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?w=600&auto=format&fit=crop&q=80",
        "description": "Heavy-duty nylon braided 100W Power Delivery cable with 10,000+ bend lifespan and 480Mbps high-speed data transfer.",
        "specs": {
            "Length": "1.5 Meters",
            "Power Rating": "100W (20V/5A)",
            "Connector": "Type-C to Type-C Metal Alloy",
            "Material": "Military Grade Braided Fiber",
            "Warranty": "2 Years",
        },
    },
    {
        "id": "prod_smart_plug_16",
        "name": "TP-Link Tapo 16A Smart WiFi Plug with Energy Monitoring",
        "category": "Power & Cables",
        "price": 999.00,
        "currency": "INR",
        "stock": 65,
        "in_stock": True,
        "rating": 4.8,
        "reviews_count": 390,
        "badge": "Energy Tracker",
        "image_url": "https://images.unsplash.com/photo-1558002038-1055907df827?w=600&auto=format&fit=crop&q=80",
        "description": "16A heavy appliance smart plug for ACs, geysers, and heaters. Real-time electricity consumption monitoring and app timer scheduling.",
        "specs": {
            "Rating": "16A Heavy Duty (up to 3680W)",
            "Connectivity": "Direct WiFi (No Hub Required)",
            "Features": "Live kWh Energy Monitoring, Timer, Voice Control",
            "Safety": "Flame-Retardant UL94-V0",
            "Warranty": "2 Years",
        },
    },
    {
        "id": "prod_electrical_switch_17",
        "name": "Legrand Arteor 6A Modular Switch (Set of 10)",
        "category": "Switches & Wiring",
        "price": 149.00,
        "currency": "INR",
        "stock": 200,
        "in_stock": True,
        "rating": 4.9,
        "reviews_count": 610,
        "badge": "Architectural",
        "image_url": "https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=600&auto=format&fit=crop&q=80",
        "description": "Premium glossy white modular switch with silver cadmium oxide contacts for 100,000+ operations and spark-free switching.",
        "specs": {
            "Rating": "6A 240V AC 1-Way",
            "Quantity": "Pack of 10 Units",
            "Type": "Modular 1-Module",
            "Contacts": "Silver Inlay High Conductivity",
            "Warranty": "10 Years Replacement",
        },
    },
    {
        "id": "prod_electrical_socket_18",
        "name": "Schneider Electric Livia 6/16A Combined Shuttered Socket",
        "category": "Switches & Wiring",
        "price": 199.00,
        "currency": "INR",
        "stock": 160,
        "in_stock": True,
        "rating": 4.8,
        "reviews_count": 380,
        "badge": "Child Shutter",
        "image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
        "description": "Dual 6A/16A universal modular socket with integrated child safety shutters and phosphor bronze spring contacts.",
        "specs": {
            "Rating": "6A / 16A Combined Heavy Load",
            "Modules": "2 Module Width",
            "Safety": "Integrated Child Protection Shutters",
            "Material": "UV-Stabilized Polycarbonate",
            "Warranty": "5 Years",
        },
    },
    {
        "id": "prod_mcb_19",
        "name": "Havells Euro-II 32A Double Pole C-Curve MCB",
        "category": "Switches & Wiring",
        "price": 599.00,
        "currency": "INR",
        "stock": 80,
        "in_stock": True,
        "rating": 4.9,
        "reviews_count": 450,
        "badge": "IS/IEC Certified",
        "image_url": "https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?w=600&auto=format&fit=crop&q=80",
        "description": "32A Double Pole miniature circuit breaker with 10kA breaking capacity, bi-metallic overload strip, and rapid arc extinction chamber.",
        "specs": {
            "Poles": "Double Pole (DP)",
            "Current Rating": "32 Amperes",
            "Breaking Capacity": "10kA",
            "Curve": "C-Curve (Household & Commercial)",
            "Warranty": "2 Years",
        },
    },
    {
        "id": "prod_electrical_wire_20",
        "name": "Finolex 2.5 sq mm Flame Retardant Copper Wire (90m Roll)",
        "category": "Switches & Wiring",
        "price": 1899.00,
        "currency": "INR",
        "stock": 60,
        "in_stock": True,
        "rating": 4.9,
        "reviews_count": 720,
        "badge": "100% Pure Copper",
        "image_url": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=80",
        "description": "100% electrolytic grade multi-strand pure copper wire with lead-free flame-retardant (FR) PVC insulation for house wiring.",
        "specs": {
            "Cross Section": "2.5 sq mm",
            "Length": "90 Meters (Standard Roll)",
            "Insulation": "Flame Retardant (FR) PVC",
            "Voltage Grade": "1100V",
            "Warranty": "5 Years",
        },
    },
    {
        "id": "prod_inverter_21",
        "name": "Luminous Zelio+ 1700 Pure Sinewave Inverter + 150Ah Battery",
        "category": "Inverters & Heavy Power",
        "price": 24999.00,
        "currency": "INR",
        "stock": 25,
        "in_stock": True,
        "rating": 4.9,
        "reviews_count": 860,
        "badge": "High Value / Backup",
        "image_url": "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600&auto=format&fit=crop&q=80",
        "description": "1500VA / 24V Pure Sinewave smart home inverter system with intelligent 32-bit DSP processor, LED display for battery time, and heavy-duty tubular battery.",
        "specs": {
            "Capacity": "1500VA / 1260W Output",
            "Waveform": "Pure Sine Wave",
            "Display": "Back-up time & battery % indicator",
            "Battery Included": "150Ah Tall Tubular Battery",
            "Warranty": "3 Years Comprehensive On-Site",
        },
    },
    {
        "id": "prod_industrial_panel_22",
        "name": "Schneider Electric 3-Phase Industrial Distribution Panel 63A",
        "category": "Inverters & Heavy Power",
        "price": 75000.00,
        "currency": "INR",
        "stock": 10,
        "in_stock": True,
        "rating": 5.0,
        "reviews_count": 92,
        "badge": "Enterprise / High Risk",
        "image_url": "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=80",
        "description": "Heavy industrial grade 3-Phase 415V electrical power distribution board with 63A 4-Pole RCCB, surge protection class II, and sheet metal IP54 enclosure.",
        "specs": {
            "Voltage": "415V 3-Phase 50Hz",
            "Current Rating": "63A 4-Pole",
            "Enclosure": "IP54 Weatherproof Sheet Steel",
            "Protection": "Surge Diverter + 30mA Earth Leakage",
            "Warranty": "5 Years",
        },
    },
]


def list_products(category: str | None = None, search: str | None = None) -> list[dict[str, Any]]:
    """Returns products filtered by category and/or search term."""
    results = ELECTRICAL_PRODUCTS
    if category and category.lower() != "all":
        results = [p for p in results if p["category"].lower() == category.lower()]
    if search:
        s = search.lower().strip()
        results = [
            p
            for p in results
            if s in p["name"].lower()
            or s in p["description"].lower()
            or s in p["category"].lower()
        ]
    return results


def get_product_by_id(product_id: str) -> dict[str, Any] | None:
    """Finds product by ID or returns None."""
    for p in ELECTRICAL_PRODUCTS:
        if p["id"] == product_id:
            return p
    return None


def calculate_risk_level(amount: float, failure_type: str, retry_count: int) -> dict[str, Any]:
    """
    Transparent Risk Evaluation Algorithm:
    - Order Amount:
        < ₹1,000 -> LOW
        ₹1,000 - ₹10,000 -> MEDIUM
        ₹10,000 - ₹50,000 -> HIGH
        >= ₹50,000 -> CRITICAL
    - Multipliers for failure type and attempts.
    """
    base_score = 0.3
    if amount < 1000:
        base_score = 0.25
        risk_level = "LOW"
    elif amount < 10000:
        base_score = 0.55
        risk_level = "MEDIUM"
    elif amount < 50000:
        base_score = 0.85
        risk_level = "HIGH"
    else:
        base_score = 0.98
        risk_level = "CRITICAL"

    if failure_type.upper() in {"NETWORK_ERROR", "PAYMENT_TIMEOUT"}:
        recommendation = f"Prioritize recovery: {risk_level} value order (₹{amount:,.2f}) experienced transient technical failure."
        recoverability = "HIGH"
    elif failure_type.upper() == "CHECKOUT_ABANDONMENT":
        recommendation = f"High purchase intent detected: Customer reached checkout for ₹{amount:,.2f}. Send continuation message."
        recoverability = "MEDIUM"
    elif retry_count >= 1:
        recommendation = f"Repeated payment failure ({retry_count + 1} attempts). Immediate human associate intervention required."
        recoverability = "MANUAL_REQUIRED"
    else:
        recommendation = f"Assess payment channel for {risk_level} risk order value of ₹{amount:,.2f}."
        recoverability = "MODERATE"

    return {
        "risk_level": risk_level,
        "risk_score": base_score,
        "recommendation": recommendation,
        "recoverability": recoverability,
    }

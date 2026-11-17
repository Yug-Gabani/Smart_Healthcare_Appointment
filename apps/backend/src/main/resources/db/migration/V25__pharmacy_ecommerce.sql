-- V25__pharmacy_ecommerce.sql
-- Pharmacy E-Commerce Module: Categories, Medicines Catalog, Carts, and Orders.

CREATE TABLE IF NOT EXISTS medicine_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL UNIQUE,
    slug VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(64),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medicine_categories_active ON medicine_categories(is_active);

CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES medicine_categories(id),
    name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(255) NOT NULL,
    description TEXT,
    composition VARCHAR(500),
    dosage_information TEXT,
    usage_instructions TEXT,
    price_paise BIGINT NOT NULL,
    discounted_price_paise BIGINT,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    requires_prescription BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category_id);
CREATE INDEX IF NOT EXISTS idx_medicines_active ON medicines(is_active);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);

CREATE TABLE IF NOT EXISTS pharmacy_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_carts_user ON pharmacy_carts(user_id);

CREATE TABLE IF NOT EXISTS pharmacy_cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES pharmacy_carts(id) ON DELETE CASCADE,
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pharmacy_cart_items_cart_medicine UNIQUE (cart_id, medicine_id),
    CONSTRAINT chk_pharmacy_cart_item_quantity CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_cart_items_cart ON pharmacy_cart_items(cart_id);

CREATE TABLE IF NOT EXISTS pharmacy_commerce_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(32) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id),
    subtotal_paise BIGINT NOT NULL,
    discount_paise BIGINT NOT NULL DEFAULT 0,
    delivery_fee_paise BIGINT NOT NULL DEFAULT 0,
    total_paise BIGINT NOT NULL,
    order_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_PAYMENT',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    razorpay_order_id VARCHAR(64) UNIQUE,
    razorpay_payment_id VARCHAR(64),
    razorpay_signature VARCHAR(256),
    delivery_name VARCHAR(255) NOT NULL,
    delivery_phone VARCHAR(50) NOT NULL,
    delivery_street TEXT NOT NULL,
    delivery_city VARCHAR(128) NOT NULL,
    delivery_state VARCHAR(128) NOT NULL,
    delivery_pincode VARCHAR(16) NOT NULL,
    prescription_id UUID REFERENCES prescriptions(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_commerce_orders_user ON pharmacy_commerce_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_commerce_orders_status ON pharmacy_commerce_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_commerce_orders_razorpay ON pharmacy_commerce_orders(razorpay_order_id);

CREATE TABLE IF NOT EXISTS pharmacy_commerce_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES pharmacy_commerce_orders(id) ON DELETE CASCADE,
    medicine_id UUID REFERENCES medicines(id),
    medicine_name VARCHAR(255) NOT NULL,
    unit_price_paise BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    total_paise BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_order ON pharmacy_commerce_order_items(order_id);

-- Seed Categories
INSERT INTO medicine_categories (id, name, slug, description, icon) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Pain & Fever Relief', 'pain-fever', 'Medicines for aches, pains, headaches, and fever reduction', 'Pill'),
    ('a0000000-0000-0000-0000-000000000002', 'Vitamins & Supplements', 'vitamins-supplements', 'Immunity boosters, multivitamins, and dietary supplements', 'ShieldPlus'),
    ('a0000000-0000-0000-0000-000000000003', 'Gastrointestinal & Digestion', 'digestion', 'Antacids, acid reflux, laxatives, and gut health essentials', 'Activity'),
    ('a0000000-0000-0000-0000-000000000004', 'Respiratory & Allergy', 'respiratory-allergy', 'Antihistamines, cough syrups, inhalers, and decongestants', 'Wind'),
    ('a0000000-0000-0000-0000-000000000005', 'Cardiac & Diabetes Care', 'cardiac-diabetes', 'Prescription medicines for blood pressure and glucose regulation', 'HeartPulse'),
    ('a0000000-0000-0000-0000-000000000006', 'Dermatology & Skin', 'dermatology', 'Topical ointments, antiseptic lotions, and dermatological creams', 'Sparkles')
ON CONFLICT (id) DO NOTHING;

-- Seed Medicines (Both OTC and Prescription)
INSERT INTO medicines (id, category_id, name, manufacturer, description, composition, dosage_information, usage_instructions, price_paise, discounted_price_paise, stock_quantity, image_url, requires_prescription, is_active) VALUES
    (
        'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'Paracetamol 650mg (Dolo 650)',
        'Micro Labs Ltd',
        'Effective antipyretic and analgesic for fever, body ache, and mild to moderate pain relief.',
        'Paracetamol IP 650mg',
        '1 tablet every 4-6 hours as needed; do not exceed 4 tablets in 24 hours.',
        'Take with a full glass of water after food.',
        3500, 3150, 150,
        '/symptom-fever.jpg',
        FALSE, TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000001',
        'Ibuprofen & Paracetamol (Combiflam)',
        'Sanofi India Ltd',
        'Combined non-steroidal anti-inflammatory and painkiller for severe headaches and joint pain.',
        'Ibuprofen IP 400mg + Paracetamol IP 325mg',
        '1 tablet twice daily after meals.',
        'Swallow whole with food to avoid gastric irritation.',
        4800, 4200, 100,
        '/symptom-headache.jpg',
        FALSE, TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000003',
        'a0000000-0000-0000-0000-000000000002',
        'Vitamin C + Zinc Chewable (Limcee Plus)',
        'Abbott Healthcare',
        'Immunity booster providing antioxidant support and rapid tissue repair.',
        'Ascorbic Acid 500mg + Zinc 5mg',
        '1 chewable tablet daily or as directed by physician.',
        'Chew tablet thoroughly before swallowing.',
        2500, 2000, 200,
        '/order-medicine.jpg',
        FALSE, TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000004',
        'a0000000-0000-0000-0000-000000000002',
        'Vitamin D3 60K IU (Calcirol Granules)',
        'Cadila Pharmaceuticals',
        'High-potency cholecalciferol for bone mineralization, calcium absorption, and joint resilience.',
        'Cholecalciferol IP 60,000 IU',
        '1 sachet weekly for 8 weeks, then as advised.',
        'Dissolve in a glass of warm milk after dinner.',
        9000, 7500, 80,
        '/order-medicine.jpg',
        FALSE, TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000005',
        'a0000000-0000-0000-0000-000000000003',
        'Pantoprazole Gastro-Resistant 40mg (Pan 40)',
        'Alkem Laboratories Ltd',
        'Proton pump inhibitor reducing stomach acid production, treating GERD, acidity, and ulcers.',
        'Pantoprazole Sodium IP 40mg',
        '1 tablet once daily in the morning.',
        'Take on an empty stomach at least 30 minutes before breakfast.',
        12000, 10500, 120,
        '/order-medicine.jpg',
        TRUE, TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000006',
        'a0000000-0000-0000-0000-000000000003',
        'Gelusil MPS Liquid Antacid (Mint Flavour)',
        'Pfizer Ltd',
        'Fast-acting double action relief from acidity, heartburn, and gas discomfort.',
        'Aluminium Hydroxide 250mg + Magnesium Hydroxide 250mg + Dimethicone 50mg',
        '1-2 teaspoons (5-10 ml) after meals and at bedtime.',
        'Shake bottle well before each use.',
        14000, 12500, 95,
        '/order-medicine.jpg',
        FALSE, TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000007',
        'a0000000-0000-0000-0000-000000000004',
        'Cetirizine 10mg (Cetzine)',
        'Dr. Reddy Laboratories',
        'Non-sedating second-generation antihistamine for seasonal allergic rhinitis, sneezing, and hives.',
        'Cetirizine Hydrochloride IP 10mg',
        '1 tablet once daily, preferably in the evening.',
        'Swallow with water; avoid alcohol consumption.',
        4500, 3800, 180,
        '/symptom-child.jpg',
        FALSE, TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000008',
        'a0000000-0000-0000-0000-000000000004',
        'Amoxicillin & Potassium Clavulanate (Augmentin 625)',
        'GlaxoSmithKline Pharmaceuticals',
        'Broad-spectrum penicillin antibiotic treating bacterial respiratory, ear, and skin infections.',
        'Amoxicillin 500mg + Clavulanic Acid 125mg',
        '1 tablet every 12 hours with meals for prescribed duration.',
        'Strictly prescription only. Complete full course as prescribed.',
        22500, 19800, 60,
        '/order-medicine.jpg',
        TRUE, TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000009',
        'a0000000-0000-0000-0000-000000000005',
        'Metformin Extended Release 500mg (Glycomet-SR)',
        'USV Private Ltd',
        'First-line biguanide antihyperglycemic for glycemic control in Type 2 Diabetes Mellitus.',
        'Metformin Hydrochloride IP 500mg (Sustained Release)',
        '1 tablet once or twice daily with dinner.',
        'Requires physician prescription and monitoring.',
        5500, 4800, 90,
        '/order-medicine.jpg',
        TRUE, TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000010',
        'a0000000-0000-0000-0000-000000000005',
        'Telmisartan 40mg (Telma 40)',
        'Glenmark Pharmaceuticals',
        'Angiotensin II receptor blocker (ARB) for arterial hypertension management.',
        'Telmisartan IP 40mg',
        '1 tablet once daily at the same time each morning.',
        'Requires regular blood pressure monitoring and doctor prescription.',
        11000, 9600, 75,
        '/symptom-chestpain.jpg',
        TRUE, TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000011',
        'a0000000-0000-0000-0000-000000000006',
        'Betadine 10% Ointment 20g',
        'Win-Medicare Pvt Ltd',
        'Antiseptic microbicidal ointment for prevention and treatment of surface wound infections.',
        'Povidone Iodine IP 10% w/w',
        'Apply gently to affected area 1 to 2 times daily.',
        'Clean wound thoroughly before applying; cover with sterile dressing if needed.',
        9500, 8500, 110,
        '/order-medicine.jpg',
        FALSE, TRUE
    ),
    (
        'b0000000-0000-0000-0000-000000000012',
        'a0000000-0000-0000-0000-000000000006',
        'Moisturizing Cream with Ceramides (Cetaphil 100g)',
        'Galderma India Pvt Ltd',
        'Dermatologist-recommended intense hydration cream for dry and sensitive skin.',
        'Purified Water, Glycerin, Hydrogenated Polyisobutene, Cetearyl Alcohol, Tocopheryl Acetate',
        'Apply liberally as often as needed.',
        'For external dermatological use only.',
        42500, 39500, 50,
        '/order-medicine.jpg',
        FALSE, TRUE
    )
ON CONFLICT (id) DO NOTHING;


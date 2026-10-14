```mermaid
erDiagram
    %% ===== Users & Doctors =====
    users {
        INT user_id PK
        VARCHAR(100) full_name
        VARCHAR(255) email UK
        TEXT password_hash
        VARCHAR(20) phone
        ENUM account_type
        TIMESTAMP created_at
    }
    patient_profiles {
        INT patient_id PK, FK
        DATE date_of_birth
        VARCHAR(20) gender
        VARCHAR(5) blood_group
        TEXT address
        VARCHAR(20) emergency_contact
    }
    doctors {
        INT doctor_id PK, FK
        VARCHAR(80) license_number UK
        VARCHAR(150) qualification
        INT experience_years
        DECIMAL consultation_fee
        VARCHAR(20) verification_status
    }
    specialties {
        INT specialty_id PK
        VARCHAR(100) specialty_name UK
        TEXT description
    }
    doctor_specialties {
        INT doctor_id PK, FK
        INT specialty_id PK, FK
    }
    doctor_availability {
        INT availability_id PK
        INT doctor_id FK
        TIMESTAMP start_time
        TIMESTAMP end_time
        BOOLEAN is_available
    }

    %% ===== Triage & Bookings =====
    triage_questions {
        INT question_id PK
        TEXT question_text
        VARCHAR(30) question_type
        BOOLEAN is_active
    }
    triage_sessions {
        INT triage_id PK
        INT patient_id FK
        TEXT symptoms
        VARCHAR(20) urgency_level
        TEXT ai_recommendation
        TIMESTAMP created_at
    }
    triage_responses {
        INT response_id PK
        INT triage_id FK
        INT question_id FK
        TEXT answer_text
    }
    medical_documents {
        INT document_id PK
        INT patient_id FK
        INT triage_id FK "NULL"
        TEXT file_url
        VARCHAR(50) file_type
        TIMESTAMP uploaded_at
    }
    appointments {
        INT appointment_id PK
        INT patient_id FK
        INT doctor_id FK
        INT availability_id FK
        INT triage_id FK "NULL"
        TIMESTAMP appointment_time
        VARCHAR(20) status
        TEXT reason
        TIMESTAMP created_at
    }

    %% ===== Consultations =====
    consultations {
        INT consultation_id PK
        INT appointment_id FK, UK
        TIMESTAMP start_time
        TIMESTAMP end_time
        VARCHAR(10) consultation_type
        VARCHAR(20) status
    }
    consultation_summaries {
        INT summary_id PK
        INT consultation_id FK, UK
        TEXT summary_text
        TEXT action_items
        BOOLEAN ai_generated
        BOOLEAN doctor_approved
        TIMESTAMP created_at
    }
    consultation_transcripts {
        INT transcript_id PK
        INT consultation_id FK, UK
        TEXT transcript_text
        TIMESTAMP generated_at
    }
    consultation_messages {
        INT message_id PK
        INT consultation_id FK
        INT sender_id FK
        TEXT message_text
        TIMESTAMP sent_at
    }

    %% ===== Prescriptions & Orders =====
    medicines {
        INT medicine_id PK
        VARCHAR(150) medicine_name
        TEXT description
        DECIMAL unit_price
        INT stock_quantity
    }
    prescriptions {
        INT prescription_id PK
        INT consultation_id FK
        INT patient_id FK
        INT doctor_id FK
        TIMESTAMP issued_at
        TEXT notes
    }
    prescription_items {
        INT prescription_item_id PK
        INT prescription_id FK
        INT medicine_id FK
        VARCHAR(100) dosage
        VARCHAR(100) frequency
        VARCHAR(100) duration
        INT quantity
    }
    medicine_orders {
        INT order_id PK
        INT patient_id FK
        INT prescription_id FK
        TIMESTAMP order_date
        VARCHAR(20) order_status
        DECIMAL total_amount
    }
    medicine_order_items {
        INT order_item_id PK
        INT order_id FK
        INT medicine_id FK
        INT quantity
        DECIMAL unit_price
    }

    %% ===== Payments & Alerts =====
    payments {
        INT payment_id PK
        INT patient_id FK
        INT appointment_id FK "NULL"
        INT order_id FK "NULL"
        DECIMAL amount
        VARCHAR(30) payment_method
        VARCHAR(20) payment_status
        VARCHAR(150) transaction_reference
        TIMESTAMP paid_at
    }
    notifications {
        INT notification_id PK
        INT user_id FK
        INT appointment_id FK "NULL"
        TEXT message
        VARCHAR(40) notification_type
        BOOLEAN is_read
        TIMESTAMP created_at
    }

    %% ===== Relationships: Users & Doctors =====
    users ||--o| patient_profiles : "1:1"
    users ||--o| doctors : "1:1"
    doctors ||--o{ doctor_specialties : has
    specialties ||--o{ doctor_specialties : "belongs to"
    doctors ||--o{ doctor_availability : offers

    %% ===== Relationships: Triage & Bookings =====
    patient_profiles ||--o{ triage_sessions : starts
    triage_sessions ||--o{ triage_responses : contains
    triage_questions ||--o{ triage_responses : "answered in"
    patient_profiles ||--o{ medical_documents : uploads
    triage_sessions |o--o{ medical_documents : "linked to"
    patient_profiles ||--o{ appointments : books
    doctors ||--o{ appointments : attends
    doctor_availability ||--o{ appointments : "reserved by"
    triage_sessions |o--o{ appointments : "leads to"

    %% ===== Relationships: Consultations =====
    appointments ||--o| consultations : "1:0..1"
    consultations ||--o| consultation_summaries : "1:0..1"
    consultations ||--o| consultation_transcripts : "1:0..1"
    consultations ||--o{ consultation_messages : has
    users ||--o{ consultation_messages : sends

    %% ===== Relationships: Prescriptions & Orders =====
    consultations ||--o{ prescriptions : issues
    patient_profiles ||--o{ prescriptions : receives
    doctors ||--o{ prescriptions : writes
    prescriptions ||--o{ prescription_items : includes
    medicines ||--o{ prescription_items : "prescribed as"
    patient_profiles ||--o{ medicine_orders : places
    prescriptions ||--o{ medicine_orders : "fulfilled by"
    medicine_orders ||--o{ medicine_order_items : contains
    medicines ||--o{ medicine_order_items : "ordered as"

    %% ===== Relationships: Payments & Alerts =====
    patient_profiles ||--o{ payments : makes
    appointments |o--o{ payments : "paid via"
    medicine_orders |o--o{ payments : "paid via"
    users ||--o{ notifications : receives
    appointments |o--o{ notifications : triggers
```

## Legend

| Symbol | Meaning |
|--------|---------|
| `PK` | Primary key |
| `FK` | Foreign key |
| `UK` | Unique key |
| `"NULL"` | Nullable column |
| `\|\|--o{` | One-to-many (1 : N / 1 : 0..N) |
| `\|\|--o\|` | One-to-zero-or-one (1 : 0..1 / 1 : 1) |
| `doctor_specialties` | Junction table for the many-to-many between doctors and specialties |
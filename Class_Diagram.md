<!-- 
# Healthcare Platform — UML Class Diagram

This UML class diagram represents all 26 classes and enumerations of the Healthcare Platform, including patient management, appointments, medical records, consultations, AI assistance, pharmacy, payments, notifications, and administration. -->

```mermaid
classDiagram
    direction TB

    class User {
        +UUID id
        +String name
        +String email
        +String phone
        +String password
        +UserRole role
        +String status
        +DateTime createdAt
        +login()
        +logout()
        +updateProfile()
        +changePassword()
    }

    class UserRole {
        <<enumeration>>
        PATIENT
        CAREGIVER
        DOCTOR
        NURSE
        PHARMACIST
        ADMIN
        IT_ADMIN
        OWNER
        PAYMENT_GATEWAY
        INSURANCE_PROVIDER
        REGULATORY_BODY
    }

    class Patient {
        +Date dateOfBirth
        +String gender
        +String address
        +String medicalHistory
        +String insuranceId
        +createAccount()
        +bookAppointment()
        +cancelAppointment()
        +uploadAttachment()
        +viewAppointments()
    }

    class Appointment {
        +UUID id
        +DateTime appointmentDate
        +AppointmentStatus status
        +String reason
        +String urgency
        +String aiSummary
        +DateTime createdAt
        +reschedule()
        +cancel()
        +getDetails()
        +sendNotification()
    }

    class AppointmentStatus {
        <<enumeration>>
        SCHEDULED
        CONFIRMED
        CANCELLED
        RESCHEDULED
        COMPLETED
        NO_SHOW
    }

    class Doctor {
        +String specialization
        +String qualification
        +String experience
        +String availability
        +Float rating
        +setAvailability()
        +viewAppointments()
        +recordConsultation()
        +createPrescription()
        +viewPatientHistory()
    }

    class DoctorAvailability {
        +UUID id
        +UUID doctorId
        +Date date
        +Time startTime
        +Time endTime
        +Boolean isAvailable
        +setAvailability()
        +updateAvailability()
    }

    class Nurse {
        +String licenseNo
        +String department
        +viewAppointments()
        +assistDoctor()
        +updatePatientInfo()
    }

    class Pharmacist {
        +String licenseNo
        +String pharmacyId
        +viewPrescriptions()
        +dispenseMedicine()
        +updateInventory()
    }

    class AdminStaff {
        +String department
        +manageAppointments()
        +manageDoctors()
        +viewReports()
    }

    class ITAdmin {
        +String skills
        +manageSystem()
        +troubleshoot()
        +monitorLogs()
    }

    class Receptionist {
        +String shift
        +checkInPatients()
        +scheduleAppointments()
        +answerCalls()
    }

    class PlatformOwner {
        +String businessName
        +viewAnalytics()
        +managePlatform()
        +generateReports()
    }

    class PaymentGateway {
        +String provider
        +processPayment()
        +refundPayment()
        +verifyTransaction()
    }

    class InsuranceProvider {
        +String providerName
        +verifyCoverage()
        +processClaim()
        +checkEligibility()
    }

    class RegulatoryBody {
        +String name
        +auditRecords()
        +verifyCompliance()
        +generateReports()
    }

    class MedicalRecord {
        +UUID id
        +UUID patientId
        +Date visitDate
        +String diagnosis
        +String notes
        +List~String~ attachments
        +addRecord()
        +getHistory()
        +updateRecord()
    }

    class Consultation {
        +UUID id
        +UUID appointmentId
        +UUID doctorId
        +UUID patientId
        +String notes
        +String aiSummary
        +String transcript
        +saveNotes()
        +generateActionItems()
        +getSummary()
    }

    class Prescription {
        +UUID id
        +UUID consultationId
        +UUID doctorId
        +String medicine
        +String dosage
        +String instructions
        +DateTime issuedAt
        +create()
        +update()
        +cancel()
    }

    class Medicine {
        +UUID id
        +String name
        +String dosageForm
        +String manufacturer
        +checkAvailability()
        +getDetails()
    }

    class PharmacyOrder {
        +UUID id
        +UUID prescriptionId
        +UUID pharmacistId
        +String status
        +UUID deliveryPartnerId
        +DateTime createdAt
        +processOrder()
        +updateStatus()
        +trackDelivery()
    }

    class Pharmacy {
        +UUID id
        +String name
        +String address
        +String contact
        +viewOrders()
        +updateInventory()
        +manageDelivery()
    }

    class Notification {
        +UUID id
        +UUID userId
        +NotificationType type
        +String message
        +DateTime sentAt
        +String status
        +send()
        +markAsRead()
    }

    class NotificationType {
        <<enumeration>>
        EMAIL
        SMS
        IN_APP
        APPOINTMENT_REMINDER
        PRESCRIPTION_ALERT
        SYSTEM_ALERT
    }

    class VideoConsultation {
        +UUID id
        +UUID appointmentId
        +DateTime startTime
        +DateTime endTime
        +String transcript
        +String status
        +start()
        +end()
        +generateTranscript()
    }

    class DeliveryPartner {
        +UUID id
        +String name
        +String contact
        +String area
        +acceptOrder()
        +updateDeliveryStatus()
    }

    %% Inheritance: platform user roles
    User <|-- Patient
    User <|-- Doctor
    User <|-- Nurse
    User <|-- Pharmacist
    User <|-- AdminStaff
    User <|-- ITAdmin
    User <|-- Receptionist
    User <|-- PlatformOwner

    %% User role and status types
    User --> UserRole : has role
    Appointment --> AppointmentStatus : has status
    Notification --> NotificationType : has type

    %% Patient and appointment management
    Patient "1" --> "0..*" Appointment : books
    Doctor "1" --> "0..*" Appointment : assigned to
    Doctor "1" --> "0..*" DoctorAvailability : has

    %% Patient medical history
    Patient "1" --> "0..*" MedicalRecord : has
    Appointment "1" --> "0..1" Consultation : results in
    Consultation "1" --> "0..*" Prescription : creates

    %% Prescription and medicine management
    Prescription "0..*" --> "1..*" Medicine : for
    Prescription "1" --> "0..*" PharmacyOrder : authorizes
    Pharmacy "1" --> "0..*" PharmacyOrder : fulfills
    DeliveryPartner "1" --> "0..*" PharmacyOrder : delivers

    %% Online consultation
    Appointment "1" *-- "0..1" VideoConsultation : includes

    %% Notifications
    User "1" --> "0..*" Notification : receives

    %% Staff associations
    Nurse ..> Patient : assists
    Nurse ..> Doctor : supports
    Pharmacist ..> Prescription : verifies
    AdminStaff ..> Appointment : manages
    AdminStaff ..> Doctor : manages
    ITAdmin ..> User : manages access
    Receptionist ..> Appointment : schedules

    %% Platform integrations
    Patient ..> PaymentGateway : makes payments
    Patient ..> InsuranceProvider : insurance claims
    PlatformOwner ..> RegulatoryBody : compliance reports
    Pharmacy ..> Pharmacist : employs
```

## Class count

| Category | Count |
|---|---:|
| Core classes and user roles | 17 |
| Enums | 3 |
| Medical, consultation and pharmacy classes | 6 |
| **Total** | **26** |

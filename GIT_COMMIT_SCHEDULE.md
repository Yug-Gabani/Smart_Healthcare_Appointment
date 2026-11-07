# PulseCare Git Commit & Push Schedule (`feat/Payment_Gateway` on `main_v2`)

> **💡 PowerShell Note**: In Windows PowerShell, multi-line `\` causes syntax errors. All commands below are formatted as single clean lines ready to directly copy-paste into PowerShell.
> **⚡ Force Push**: Every push command includes `--force` to keep remote synchronized smoothly.

---

## 🌿 Current Branch Status
You are on the branch:
```powershell
git branch --show-current
# Output: feat/Payment_Gateway
```
*Base Branch for Pull Requests:* **`main_v2`**

---

## 👥 Contributor Workload Distribution

| Area | **Person 1** (Backend & Payments Lead) | **Person 2** (Architecture & UI Lead) |
| :--- | :--- | :--- |
| **Backend** | Payment Order, Razorpay SDK, OpenPDF Invoices, Kafka CDC & Outbox, Email & WhatsApp Engines | Redis 2-Phase Soft-Hold, Slot Rest APIs, Tiered Cancellation & Refund Service, Flyway V18 |
| **Frontend** | Patient Triage Booking UI, 10-Min Soft-Hold Badges, Vite Config | Payment Confirmation Screen, Refund Preview Dialog, Pipeline Audit Modal |
| **Tests & DevOps**| Payment & PDF Unit Tests, WhatsApp Packaging Tools | Refund & WhatsApp Unit Tests, Docker Compose, CDC Automation Scripts |

> **Note:** Replace `Person One <email1@example.com>` and `Person Two <email2@example.com>` with your actual names and emails.

---

## 📅 DAY 1: Database Migrations, Entities & Frontend Models

### Status: ✅ COMPLETED & REBASED ONTO `main_v2`
If you haven't force-pushed Day 1 yet, run:
```powershell
git push origin feat/Payment_Gateway --force
```

---

## 📅 DAY 2: Redis 2-Phase Slot Reservation & Booking UI

### Commit 2.1 — Person 2 (Backend: Redis Atomic Soft-Hold Engine)
```powershell
git add apps/backend/src/main/java/com/group6/healthcare/config/RedisConfig.java apps/backend/src/main/java/com/group6/healthcare/clinic/dto/SlotHoldRequest.java apps/backend/src/main/java/com/group6/healthcare/clinic/dto/SlotHoldResponse.java apps/backend/src/main/java/com/group6/healthcare/clinic/service/RedisSlotReservationService.java apps/backend/src/main/java/com/group6/healthcare/clinic/controller/SlotController.java
git commit --author="Person Two <email2@example.com>" -m "feat(backend): implement atomic Redis 2-phase slot reservation and hold REST controller"
```

### Commit 2.2 — Person 1 (Backend & Frontend: Clinic Services & 10-Minute Timer UI)
```powershell
git add apps/backend/src/main/java/com/group6/healthcare/clinic/service/AppointmentService.java apps/backend/src/main/java/com/group6/healthcare/clinic/service/DoctorService.java apps/frontend/src/components/PatientTriageBooking.tsx apps/frontend/index.html apps/frontend/vite.config.ts
git commit --author="Person One <email1@example.com>" -m "feat(fullstack): connect slot hold to appointment services and add 10-min booking countdown UI"
```

### 🚀 Day 2 Push Command
```powershell
git push origin feat/Payment_Gateway --force
```

---

## 📅 DAY 3: Razorpay Checkout & Confirmation Views

### Commit 3.1 — Person 1 (Backend: Razorpay Gateway & Verification APIs)
```powershell
git add apps/backend/src/main/java/com/group6/healthcare/payment/config/RazorpayConfig.java apps/backend/src/main/java/com/group6/healthcare/payment/entity/PaymentOrder.java apps/backend/src/main/java/com/group6/healthcare/payment/repository/PaymentOrderRepository.java apps/backend/src/main/java/com/group6/healthcare/payment/service/PaymentService.java apps/backend/src/main/java/com/group6/healthcare/payment/controller/PaymentController.java apps/backend/src/main/java/com/group6/healthcare/payment/dto/CreatePaymentOrderRequest.java apps/backend/src/main/java/com/group6/healthcare/payment/dto/CreatePaymentOrderResponse.java apps/backend/src/main/java/com/group6/healthcare/payment/dto/VerifyPaymentRequest.java apps/backend/src/main/java/com/group6/healthcare/payment/dto/VerifyPaymentResponse.java
git commit --author="Person One <email1@example.com>" -m "feat(backend): implement Razorpay order creation, HMAC signature verification, and payment APIs"
```

### Commit 3.2 — Person 2 (Backend & Frontend: Security Configuration & Confirmation Screen)
```powershell
git add apps/frontend/src/services/api.ts apps/frontend/src/components/AppointmentConfirmedView.tsx apps/frontend/src/components/CouponFeedbackModal.tsx apps/backend/src/main/java/com/group6/healthcare/config/SecurityConfig.java apps/backend/src/main/java/com/group6/healthcare/config/OpenApiConfig.java apps/backend/src/main/java/com/group6/healthcare/HealthcareApplication.java
git commit --author="Person Two <email2@example.com>" -m "feat(fullstack): add frontend checkout API, receipt confirmation screen, and Spring Security endpoints"
```

### 🚀 Day 3 Push Command
```powershell
git push origin feat/Payment_Gateway --force
```

---

## 📅 DAY 4: Outbox CDC, Notifications & Tiered Cancellation

### Commit 4.1 — Person 1 (Backend: Transactional Outbox, Kafka & WhatsApp/Email)
```powershell
git add apps/backend/src/main/java/com/group6/healthcare/payment/entity/PaymentOutbox.java apps/backend/src/main/java/com/group6/healthcare/payment/entity/NotificationAuditLog.java apps/backend/src/main/java/com/group6/healthcare/payment/repository/PaymentOutboxRepository.java apps/backend/src/main/java/com/group6/healthcare/payment/repository/NotificationAuditLogRepository.java apps/backend/src/main/java/com/group6/healthcare/payment/event/PaymentSuccessEvent.java apps/backend/src/main/java/com/group6/healthcare/payment/config/KafkaPaymentConfig.java apps/backend/src/main/java/com/group6/healthcare/payment/service/OutboxEventService.java apps/backend/src/main/java/com/group6/healthcare/payment/service/OutboxPublisherService.java apps/backend/src/main/java/com/group6/healthcare/payment/service/NotificationAuditService.java apps/backend/src/main/java/com/group6/healthcare/payment/service/PdfReceiptGeneratorService.java apps/backend/src/main/java/com/group6/healthcare/payment/service/PaymentReceiptEmailService.java apps/backend/src/main/java/com/group6/healthcare/payment/service/WhatsAppNotificationService.java apps/backend/src/main/java/com/group6/healthcare/payment/service/MinioStorageService.java
git commit --author="Person One <email1@example.com>" -m "feat(backend): build transactional outbox CDC, OpenPDF receipt generator, and multi-channel notifications"
```

### Commit 4.2 — Person 2 (Backend & Frontend: 4-Tier Cancellation & Live Refund Modal)
```powershell
git add apps/backend/src/main/java/com/group6/healthcare/payment/entity/PaymentRefund.java apps/backend/src/main/java/com/group6/healthcare/payment/repository/PaymentRefundRepository.java apps/backend/src/main/java/com/group6/healthcare/payment/dto/RefundTier.java apps/backend/src/main/java/com/group6/healthcare/payment/dto/RefundCalculationResult.java apps/backend/src/main/java/com/group6/healthcare/payment/dto/RefundPreviewResponse.java apps/backend/src/main/java/com/group6/healthcare/payment/dto/CancelAndRefundRequest.java apps/backend/src/main/java/com/group6/healthcare/payment/dto/CancelAndRefundResponse.java apps/backend/src/main/java/com/group6/healthcare/payment/service/RefundService.java apps/frontend/src/components/CancelRefundModal.tsx apps/frontend/src/components/MyAppointments.tsx apps/frontend/src/components/AppointmentDetail.tsx
git commit --author="Person Two <email2@example.com>" -m "feat(fullstack): add tiered cancellation backend service and interactive refund preview modal"
```

### 🚀 Day 4 Push Command
```powershell
git push origin feat/Payment_Gateway --force
```

---

## 📅 DAY 5: Unit & Integration Tests, Audit UI & DevOps

### Commit 5.1 — Person 1 (Backend Tests & WhatsApp Packaging)
```powershell
git add apps/backend/src/main/java/com/group6/healthcare/payment/controller/PaymentTestbenchController.java apps/backend/src/test/java/com/group6/healthcare/payment/PaymentFlowIntegrationTest.java apps/backend/src/test/java/com/group6/healthcare/payment/PaymentServiceTest.java apps/backend/src/test/java/com/group6/healthcare/payment/PdfReceiptGeneratorServiceTest.java apps/backend/src/test/resources/application-test.yml package-for-whatsapp.bat package-for-whatsapp.ps1
git commit --author="Person One <email1@example.com>" -m "test(backend): add payment testbench controller, flow integration tests, and packaging tools"
```

### Commit 5.2 — Person 2 (DevOps, CDC Automation, Audit UI & Refund Tests)
```powershell
git add apps/backend/src/test/java/com/group6/healthcare/payment/RefundServiceTest.java apps/backend/src/test/java/com/group6/healthcare/payment/WhatsAppNotificationServiceTest.java apps/backend/src/test/java/com/group6/healthcare/payment/PaymentTestbenchControllerTest.java apps/frontend/src/components/PipelineAuditModal.tsx docker/docker-compose.yml scripts/ start-all.ps1 stop-all.ps1 sync-keys.bat sync-keys.ps1 .gitignore GIT_COMMIT_SCHEDULE.md
git commit --author="Person Two <email2@example.com>" -m "chore(devops/ui): add pipeline audit modal, refund unit tests, and Docker container automation"
```

### 🚀 Day 5 Final Push Command
```powershell
git push origin feat/Payment_Gateway --force
```

---

## 🔍 Verification & Pull Request (PR)

### 1. Verify working tree is clean
```powershell
git status
# Expected Output: nothing to commit, working tree clean
```

### 2. Verify commit balance across both authors
```powershell
# Check Person 1 commits (should show 5 commits)
git log --oneline --author="Person One"

# Check Person 2 commits (should show 5 commits)
git log --oneline --author="Person Two"
```

### 3. Open Pull Request on GitHub
Visit your GitHub repository in your browser:
* Ensure base branch is set to **`main_v2`**: `base: main_v2` $\leftarrow$ `compare: feat/Payment_Gateway`
* You will see: ✅ **Able to merge. These branches can be automatically merged.**
* Click **Create pull request** to merge into `main_v2`.

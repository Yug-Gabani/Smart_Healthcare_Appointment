package com.group6.healthcare.pharmacy;

import com.group6.healthcare.user.entity.Role;
import com.group6.healthcare.clinic.entity.Appointment;
import com.group6.healthcare.clinic.entity.ConsultationType;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.Prescription;
import com.group6.healthcare.clinic.entity.PrescriptionStatus;
import com.group6.healthcare.clinic.repository.AppointmentRepository;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.PrescriptionRepository;
import com.group6.healthcare.pharmacy.dto.AddToCartRequest;
import com.group6.healthcare.pharmacy.dto.CartResponse;
import com.group6.healthcare.pharmacy.dto.CommerceOrderResponse;
import com.group6.healthcare.pharmacy.dto.MedicineResponse;
import com.group6.healthcare.pharmacy.dto.PharmacyCheckoutRequest;
import com.group6.healthcare.pharmacy.dto.PharmacyCheckoutResponse;
import com.group6.healthcare.pharmacy.dto.UpdateCartItemRequest;
import com.group6.healthcare.pharmacy.dto.VerifyPharmacyPaymentRequest;
import com.group6.healthcare.pharmacy.entity.CommerceOrderStatus;
import com.group6.healthcare.pharmacy.entity.CommercePaymentStatus;
import com.group6.healthcare.pharmacy.entity.Medicine;
import com.group6.healthcare.pharmacy.entity.MedicineCategory;
import com.group6.healthcare.pharmacy.repository.MedicineCategoryRepository;
import com.group6.healthcare.pharmacy.repository.MedicineRepository;
import com.group6.healthcare.pharmacy.repository.PharmacyCartItemRepository;
import com.group6.healthcare.pharmacy.repository.PharmacyCartRepository;
import com.group6.healthcare.pharmacy.repository.PharmacyCommerceOrderRepository;
import com.group6.healthcare.pharmacy.service.MedicineService;
import com.group6.healthcare.pharmacy.service.PharmacyCartService;
import com.group6.healthcare.pharmacy.service.PharmacyCommerceOrderService;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class PharmacyCommerceIntegrationTest {

    @Autowired private MedicineService medicineService;
    @Autowired private PharmacyCartService cartService;
    @Autowired private PharmacyCommerceOrderService orderService;

    @Autowired private MedicineCategoryRepository categoryRepository;
    @Autowired private MedicineRepository medicineRepository;
    @Autowired private PharmacyCartRepository cartRepository;
    @Autowired private PharmacyCartItemRepository cartItemRepository;
    @Autowired private PharmacyCommerceOrderRepository orderRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private DoctorRepository doctorRepository;
    @Autowired private AppointmentRepository appointmentRepository;
    @Autowired private PrescriptionRepository prescriptionRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private User patient;
    private User otherPatient;
    private MedicineCategory painCategory;
    private MedicineCategory rxCategory;
    private Medicine otcParacetamol;
    private Medicine rxAmoxicillin;

    @BeforeEach
    void setup() {
        orderRepository.deleteAll();
        cartItemRepository.deleteAll();
        cartRepository.deleteAll();
        prescriptionRepository.deleteAll();
        appointmentRepository.deleteAll();
        doctorRepository.deleteAll();
        medicineRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();

        patient = userRepository.save(User.builder()
                .email("patient.pharm@test.local")
                .passwordHash(passwordEncoder.encode("Pass1234!"))
                .fullName("Anita Sharma")
                .phone("+919876543210")
                .addressStreet("12 Green Valley")
                .addressCity("Bengaluru")
                .addressState("Karnataka")
                .addressPincode("560001")
                .role(Role.PATIENT)
                .enabled(true)
                .build());

        otherPatient = userRepository.save(User.builder()
                .email("other.patient@test.local")
                .passwordHash(passwordEncoder.encode("Pass1234!"))
                .fullName("Vikram Rao")
                .role(Role.PATIENT)
                .enabled(true)
                .build());

        painCategory = categoryRepository.save(MedicineCategory.builder()
                .name("Pain Relief")
                .slug("pain-relief")
                .description("Aches and fever")
                .icon("Pill")
                .active(true)
                .build());

        rxCategory = categoryRepository.save(MedicineCategory.builder()
                .name("Antibiotics")
                .slug("antibiotics")
                .description("Prescription antibiotics")
                .icon("Shield")
                .active(true)
                .build());

        otcParacetamol = medicineRepository.save(Medicine.builder()
                .category(painCategory)
                .name("Paracetamol 650mg")
                .manufacturer("Micro Labs")
                .description("Fever and pain relief")
                .composition("Paracetamol IP 650mg")
                .dosageInformation("1 tablet every 6 hours")
                .usageInstructions("Take with water")
                .pricePaise(3500L)
                .discountedPricePaise(3000L)
                .stockQuantity(100)
                .requiresPrescription(false)
                .active(true)
                .build());

        rxAmoxicillin = medicineRepository.save(Medicine.builder()
                .category(rxCategory)
                .name("Amoxicillin 500mg")
                .manufacturer("GSK")
                .description("Antibiotic capsules")
                .composition("Amoxicillin 500mg")
                .dosageInformation("1 capsule twice daily")
                .usageInstructions("Complete full course")
                .pricePaise(12000L)
                .discountedPricePaise(11000L)
                .stockQuantity(50)
                .requiresPrescription(true)
                .active(true)
                .build());
    }

    @Test
    void testMedicineBrowsingAndSearch() {
        var categories = medicineService.listCategories();
        assertThat(categories).hasSize(2);

        Page<MedicineResponse> allMedicines = medicineService.searchMedicines(null, null, null, PageRequest.of(0, 10));
        assertThat(allMedicines.getTotalElements()).isEqualTo(2);

        Page<MedicineResponse> searchResult = medicineService.searchMedicines(null, "Paracetamol", null, PageRequest.of(0, 10));
        assertThat(searchResult.getContent()).hasSize(1);
        assertThat(searchResult.getContent().get(0).name()).isEqualTo("Paracetamol 650mg");

        Page<MedicineResponse> otcOnly = medicineService.searchMedicines(null, null, false, PageRequest.of(0, 10));
        assertThat(otcOnly.getContent()).hasSize(1);
        assertThat(otcOnly.getContent().get(0).requiresPrescription()).isFalse();

        MedicineResponse detail = medicineService.getMedicineById(otcParacetamol.getId());
        assertThat(detail.name()).isEqualTo("Paracetamol 650mg");
        assertThat(detail.composition()).isEqualTo("Paracetamol IP 650mg");
    }

    @Test
    void testCartOperationsAndCalculations() {
        // 1. Add OTC to Cart
        CartResponse cart = cartService.addToCart(patient.getId(), new AddToCartRequest(otcParacetamol.getId(), 2));
        assertThat(cart.totalItemsCount()).isEqualTo(2);
        // Effective price: 3000 * 2 = 6000 paise. Delivery fee: 5000 paise (subtotal < 50000). Total: 11000 paise.
        assertThat(cart.subtotalPaise()).isEqualTo(6000L);
        assertThat(cart.discountPaise()).isEqualTo(1000L); // (3500 - 3000) * 2
        assertThat(cart.deliveryFeePaise()).isEqualTo(5000L);
        assertThat(cart.totalPaise()).isEqualTo(11000L);
        assertThat(cart.hasPrescriptionItems()).isFalse();

        // 2. Reject quantity exceeding stock
        assertThatThrownBy(() ->
                cartService.addToCart(patient.getId(), new AddToCartRequest(otcParacetamol.getId(), 500))
        ).isInstanceOf(IllegalArgumentException.class)
         .hasMessageContaining("Cannot add 500 units");

        // 3. Update quantity
        UUID cartItemId = cart.items().get(0).id();
        CartResponse updated = cartService.updateItemQuantity(patient.getId(), cartItemId, new UpdateCartItemRequest(5));
        assertThat(updated.totalItemsCount()).isEqualTo(5);
        assertThat(updated.subtotalPaise()).isEqualTo(15000L);

        // 4. Remove item
        CartResponse afterRemove = cartService.removeItem(patient.getId(), cartItemId);
        assertThat(afterRemove.totalItemsCount()).isEqualTo(0);
        assertThat(afterRemove.items()).isEmpty();
    }

    @Test
    void testPrescriptionValidationDuringCheckout() {
        // Add prescription-required medicine to cart
        cartService.addToCart(patient.getId(), new AddToCartRequest(rxAmoxicillin.getId(), 1));

        PharmacyCheckoutRequest reqNoRx = new PharmacyCheckoutRequest(
                "Anita Sharma", "+919876543210", "12 Green Valley",
                "Bengaluru", "Karnataka", "560001", null, "Urgent"
        );

        // Should reject checkout without prescription ID
        assertThatThrownBy(() -> orderService.createCheckoutOrder(patient.getId(), reqNoRx))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Prescription is required");

        // Should reject if prescription does not belong to patient
        Prescription otherRx = prescriptionRepository.save(Prescription.builder()
                .appointmentId(UUID.randomUUID())
                .patientId(otherPatient.getId())
                .doctorId(UUID.randomUUID())
                .status(PrescriptionStatus.SIGNED)
                .signedAt(OffsetDateTime.now())
                .build());

        PharmacyCheckoutRequest reqWrongPatient = new PharmacyCheckoutRequest(
                "Anita Sharma", "+919876543210", "12 Green Valley",
                "Bengaluru", "Karnataka", "560001", otherRx.getId(), null
        );

        assertThatThrownBy(() -> orderService.createCheckoutOrder(patient.getId(), reqWrongPatient))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Prescription does not belong to the authenticated patient");
    }

    @Test
    void testEndToEndCheckoutPaymentVerificationAndInventoryDeduction() {
        // 1. Add OTC medicine to cart (qty 3)
        cartService.addToCart(patient.getId(), new AddToCartRequest(otcParacetamol.getId(), 3));

        PharmacyCheckoutRequest checkoutReq = new PharmacyCheckoutRequest(
                "Anita Sharma", "+919876543210", "12 Green Valley",
                "Bengaluru", "Karnataka", "560001", null, "Please ring bell"
        );

        // 2. Create Checkout Order
        PharmacyCheckoutResponse checkoutResp = orderService.createCheckoutOrder(patient.getId(), checkoutReq);
        assertThat(checkoutResp.orderId()).isNotNull();
        assertThat(checkoutResp.razorpayOrderId()).isNotBlank();
        assertThat(checkoutResp.orderStatus()).isEqualTo("PENDING_PAYMENT");
        assertThat(checkoutResp.paymentStatus()).isEqualTo("PENDING");

        // 3. Verify Payment with sandbox signature
        VerifyPharmacyPaymentRequest verifyReq = new VerifyPharmacyPaymentRequest(
                checkoutResp.razorpayOrderId(),
                "pay_test_" + UUID.randomUUID().toString().substring(0, 8),
                "sandbox_signature"
        );

        CommerceOrderResponse confirmedOrder = orderService.verifyPayment(patient.getId(), verifyReq);
        assertThat(confirmedOrder.orderStatus()).isEqualTo("PLACED");
        assertThat(confirmedOrder.paymentStatus()).isEqualTo("SUCCESS");
        assertThat(confirmedOrder.deliveryName()).isEqualTo("Anita Sharma");
        assertThat(confirmedOrder.items()).hasSize(1);
        assertThat(confirmedOrder.items().get(0).quantity()).isEqualTo(3);

        // 4. Verify Stock Deduction (100 - 3 = 97)
        Medicine refreshedMedicine = medicineRepository.findById(otcParacetamol.getId()).orElseThrow();
        assertThat(refreshedMedicine.getStockQuantity()).isEqualTo(97);

        // 5. Verify User Cart was cleared
        CartResponse currentCart = cartService.getCartResponse(patient.getId());
        assertThat(currentCart.items()).isEmpty();

        // 6. Test Idempotency
        CommerceOrderResponse idempotentResp = orderService.verifyPayment(patient.getId(), verifyReq);
        assertThat(idempotentResp.paymentStatus()).isEqualTo("SUCCESS");

        // 7. Test Customer Order History
        List<CommerceOrderResponse> orders = orderService.getUserOrders(patient.getId());
        assertThat(orders).hasSize(1);
        assertThat(orders.get(0).id()).isEqualTo(confirmedOrder.id());

        // 8. Test Access Control: other patient cannot access Anita's order
        assertThatThrownBy(() -> orderService.getOrderDetails(otherPatient.getId(), confirmedOrder.id()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Access denied");
    }
}

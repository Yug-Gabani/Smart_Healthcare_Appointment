package com.group6.healthcare.pharmacy.entity;

import com.group6.healthcare.clinic.entity.Prescription;
import com.group6.healthcare.user.entity.User;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "pharmacy_commerce_orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PharmacyCommerceOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "order_number", nullable = false, unique = true, length = 32)
    private String orderNumber;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<PharmacyCommerceOrderItem> items = new ArrayList<>();

    @Column(name = "subtotal_paise", nullable = false)
    private Long subtotalPaise;

    @Column(name = "discount_paise", nullable = false)
    @Builder.Default
    private Long discountPaise = 0L;

    @Column(name = "delivery_fee_paise", nullable = false)
    @Builder.Default
    private Long deliveryFeePaise = 0L;

    @Column(name = "total_paise", nullable = false)
    private Long totalPaise;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_status", nullable = false, length = 32)
    @Builder.Default
    private CommerceOrderStatus orderStatus = CommerceOrderStatus.PENDING_PAYMENT;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 32)
    @Builder.Default
    private CommercePaymentStatus paymentStatus = CommercePaymentStatus.PENDING;

    @Column(name = "razorpay_order_id", unique = true, length = 64)
    private String razorpayOrderId;

    @Column(name = "razorpay_payment_id", length = 64)
    private String razorpayPaymentId;

    @Column(name = "razorpay_signature", length = 256)
    private String razorpaySignature;

    @Column(name = "delivery_name", nullable = false)
    private String deliveryName;

    @Column(name = "delivery_phone", nullable = false, length = 50)
    private String deliveryPhone;

    @Column(name = "delivery_street", nullable = false, columnDefinition = "TEXT")
    private String deliveryStreet;

    @Column(name = "delivery_city", nullable = false, length = 128)
    private String deliveryCity;

    @Column(name = "delivery_state", nullable = false, length = 128)
    private String deliveryState;

    @Column(name = "delivery_pincode", nullable = false, length = 16)
    private String deliveryPincode;

    @Column(name = "prescription_id")
    private UUID prescriptionId;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}

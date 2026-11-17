package com.group6.healthcare.pharmacy.repository;

import com.group6.healthcare.pharmacy.entity.PharmacyCommerceOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PharmacyCommerceOrderRepository extends JpaRepository<PharmacyCommerceOrder, UUID> {

    List<PharmacyCommerceOrder> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<PharmacyCommerceOrder> findByOrderNumber(String orderNumber);

    Optional<PharmacyCommerceOrder> findByRazorpayOrderId(String razorpayOrderId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM PharmacyCommerceOrder o WHERE o.razorpayOrderId = :orderId")
    Optional<PharmacyCommerceOrder> findByRazorpayOrderIdForUpdate(@Param("orderId") String orderId);
}


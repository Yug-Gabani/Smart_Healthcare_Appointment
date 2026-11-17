package com.group6.healthcare.pharmacy.repository;

import com.group6.healthcare.pharmacy.entity.PharmacyCartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PharmacyCartItemRepository extends JpaRepository<PharmacyCartItem, UUID> {
    Optional<PharmacyCartItem> findByCartIdAndMedicineId(UUID cartId, UUID medicineId);
    List<PharmacyCartItem> findAllByCartId(UUID cartId);
    void deleteByCartId(UUID cartId);
}


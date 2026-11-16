package com.group6.healthcare.pharmacy.repository;

import com.group6.healthcare.pharmacy.entity.PharmacyCart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PharmacyCartRepository extends JpaRepository<PharmacyCart, UUID> {
    Optional<PharmacyCart> findByUserId(UUID userId);
}


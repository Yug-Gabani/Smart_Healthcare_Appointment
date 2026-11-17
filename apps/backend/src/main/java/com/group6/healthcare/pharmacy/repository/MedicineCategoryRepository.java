package com.group6.healthcare.pharmacy.repository;

import com.group6.healthcare.pharmacy.entity.MedicineCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MedicineCategoryRepository extends JpaRepository<MedicineCategory, UUID> {
    Optional<MedicineCategory> findBySlug(String slug);
    Optional<MedicineCategory> findByNameIgnoreCase(String name);
    List<MedicineCategory> findAllByActiveTrueOrderByNameAsc();
}


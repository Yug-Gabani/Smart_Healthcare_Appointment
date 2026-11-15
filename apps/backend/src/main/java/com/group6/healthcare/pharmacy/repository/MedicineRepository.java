package com.group6.healthcare.pharmacy.repository;

import com.group6.healthcare.pharmacy.entity.Medicine;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MedicineRepository extends JpaRepository<Medicine, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Medicine m WHERE m.id = :id")
    Optional<Medicine> findByIdForUpdate(@Param("id") UUID id);

@Query(value = """
            SELECT m.* FROM medicines m
            WHERE m.is_active = true
              AND (:categoryId IS NULL OR m.category_id = :categoryId)
              AND (:requiresPrescription IS NULL OR m.requires_prescription = :requiresPrescription)
              AND (:search IS NULL OR m.name ILIKE CONCAT('%', :search, '%')
                                 OR m.manufacturer ILIKE CONCAT('%', :search, '%')
                                 OR m.composition ILIKE CONCAT('%', :search, '%'))
            ORDER BY m.name
            """,
            countQuery = """
            SELECT COUNT(*) FROM medicines m
            WHERE m.is_active = true
              AND (:categoryId IS NULL OR m.category_id = :categoryId)
              AND (:requiresPrescription IS NULL OR m.requires_prescription = :requiresPrescription)
              AND (:search IS NULL OR m.name ILIKE CONCAT('%', :search, '%')
                                 OR m.manufacturer ILIKE CONCAT('%', :search, '%')
                                 OR m.composition ILIKE CONCAT('%', :search, '%'))
            """,
            nativeQuery = true)

    Page<Medicine> searchMedicines(
            @Param("categoryId") UUID categoryId,
            @Param("search") String search,
            @Param("requiresPrescription") Boolean requiresPrescription,
            Pageable pageable);

    List<Medicine> findTop8ByActiveTrueOrderByCreatedAtDesc();
}

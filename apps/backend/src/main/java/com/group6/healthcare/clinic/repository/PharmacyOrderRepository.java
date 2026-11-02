package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.PharmacyOrder;
import com.group6.healthcare.clinic.entity.PharmacyOrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PharmacyOrderRepository extends JpaRepository<PharmacyOrder, UUID> {

    List<PharmacyOrder> findByPatientIdOrderByCreatedAtDesc(UUID patientId);

    @Query("""
        SELECT o FROM PharmacyOrder o
         WHERE o.status = :status
         ORDER BY o.createdAt ASC
        """)
    List<PharmacyOrder> findByStatus(@Param("status") PharmacyOrderStatus status);

    @Query("""
        SELECT o FROM PharmacyOrder o
         WHERE o.prescriptionId = :prescriptionId
           AND o.status <> com.group6.healthcare.clinic.entity.PharmacyOrderStatus.CANCELLED
        """)
    List<PharmacyOrder> findActiveByPrescriptionId(@Param("prescriptionId") UUID prescriptionId);

    @Query("""
        SELECT o FROM PharmacyOrder o
         WHERE o.prescriptionId IN :prescriptionIds
           AND o.status <> com.group6.healthcare.clinic.entity.PharmacyOrderStatus.CANCELLED
        """)
    List<PharmacyOrder> findActiveByPrescriptionIds(@Param("prescriptionIds") List<UUID> prescriptionIds);
}

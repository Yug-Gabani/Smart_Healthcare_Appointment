package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.PrescriptionItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PrescriptionItemRepository extends JpaRepository<PrescriptionItem, UUID> {

    List<PrescriptionItem> findByPrescriptionIdOrderByPositionAsc(UUID prescriptionId);

    void deleteByPrescriptionId(UUID prescriptionId);
}

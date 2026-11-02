package com.group6.healthcare.clinic.service;

import com.group6.healthcare.clinic.dto.PharmacyOrderResponse;
import com.group6.healthcare.clinic.dto.PrescriptionItemDto;
import com.group6.healthcare.clinic.entity.Doctor;
import com.group6.healthcare.clinic.entity.MealTiming;
import com.group6.healthcare.clinic.entity.PharmacyOrder;
import com.group6.healthcare.clinic.entity.PharmacyOrderStatus;
import com.group6.healthcare.clinic.entity.Prescription;
import com.group6.healthcare.clinic.entity.PrescriptionItem;
import com.group6.healthcare.clinic.entity.PrescriptionStatus;
import com.group6.healthcare.clinic.repository.DoctorRepository;
import com.group6.healthcare.clinic.repository.PharmacyOrderRepository;
import com.group6.healthcare.clinic.repository.PrescriptionItemRepository;
import com.group6.healthcare.clinic.repository.PrescriptionRepository;
import com.group6.healthcare.common.exception.BusinessRuleException;
import com.group6.healthcare.common.exception.ResourceNotFoundException;
import com.group6.healthcare.user.entity.User;
import com.group6.healthcare.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Patient-initiated pharmacy orders. A patient opts in from a SIGNED prescription; the pharmacist
 * then dispenses and marks picked up. Nothing is created automatically on prescription signing.
 */
@Service
public class PharmacyOrderService {

    private final PharmacyOrderRepository orderRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionItemRepository prescriptionItemRepository;
    private final DoctorRepository doctorRepository;
    private final UserRepository userRepository;

    public PharmacyOrderService(PharmacyOrderRepository orderRepository,
                                 PrescriptionRepository prescriptionRepository,
                                 PrescriptionItemRepository prescriptionItemRepository,
                                 DoctorRepository doctorRepository,
                                 UserRepository userRepository) {
        this.orderRepository = orderRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.prescriptionItemRepository = prescriptionItemRepository;
        this.doctorRepository = doctorRepository;
        this.userRepository = userRepository;
    }

    // ---------- patient-side ----------

    @Transactional
    public PharmacyOrderResponse createOrder(UUID patientUserId, UUID prescriptionId) {
        Prescription p = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("Prescription", prescriptionId));
        if (!p.getPatientId().equals(patientUserId)) {
            throw new BusinessRuleException("Cannot order someone else's prescription");
        }
        if (p.getStatus() != PrescriptionStatus.SIGNED) {
            throw new BusinessRuleException("Only SIGNED prescriptions can be ordered");
        }
        if (!orderRepository.findActiveByPrescriptionId(prescriptionId).isEmpty()) {
            throw new BusinessRuleException("An active order already exists for this prescription");
        }
        PharmacyOrder saved = orderRepository.save(PharmacyOrder.builder()
                .prescriptionId(prescriptionId)
                .patientId(patientUserId)
                .status(PharmacyOrderStatus.NEW)
                .build());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PharmacyOrderResponse> listMine(UUID patientUserId) {
        List<PharmacyOrder> rows = orderRepository.findByPatientIdOrderByCreatedAtDesc(patientUserId);
        return hydrate(rows);
    }

    @Transactional
    public PharmacyOrderResponse cancelByPatient(UUID patientUserId, UUID orderId, String reason) {
        PharmacyOrder o = findOrder(orderId);
        if (!o.getPatientId().equals(patientUserId)) {
            throw new BusinessRuleException("Cannot cancel someone else's order");
        }
        if (o.getStatus() != PharmacyOrderStatus.NEW) {
            throw new BusinessRuleException("Only NEW orders can be cancelled by the patient");
        }
        o.setStatus(PharmacyOrderStatus.CANCELLED);
        o.setCancelledAt(OffsetDateTime.now());
        o.setCancelledReason(blankToNull(reason));
        orderRepository.save(o);
        return toResponse(o);
    }

    // ---------- pharmacist-side ----------

    @Transactional(readOnly = true)
    public List<PharmacyOrderResponse> listByStatus(PharmacyOrderStatus status) {
        return hydrate(orderRepository.findByStatus(status));
    }

    @Transactional(readOnly = true)
    public PharmacyOrderResponse getOne(UUID orderId) {
        return toResponse(findOrder(orderId));
    }

    @Transactional
    public PharmacyOrderResponse dispense(UUID pharmacistUserId, UUID orderId) {
        PharmacyOrder o = findOrder(orderId);
        if (o.getStatus() != PharmacyOrderStatus.NEW) {
            throw new BusinessRuleException("Only NEW orders can be dispensed (current: " + o.getStatus() + ")");
        }
        o.setStatus(PharmacyOrderStatus.DISPENSED);
        o.setDispensedAt(OffsetDateTime.now());
        o.setPharmacistId(pharmacistUserId);
        orderRepository.save(o);
        return toResponse(o);
    }

    @Transactional
    public PharmacyOrderResponse markPickedUp(UUID pharmacistUserId, UUID orderId) {
        PharmacyOrder o = findOrder(orderId);
        if (o.getStatus() != PharmacyOrderStatus.DISPENSED) {
            throw new BusinessRuleException("Only DISPENSED orders can be marked picked up (current: " + o.getStatus() + ")");
        }
        o.setStatus(PharmacyOrderStatus.PICKED_UP);
        o.setPickedUpAt(OffsetDateTime.now());
        if (o.getPharmacistId() == null) o.setPharmacistId(pharmacistUserId);
        orderRepository.save(o);
        return toResponse(o);
    }

    @Transactional
    public PharmacyOrderResponse cancelByPharmacist(UUID pharmacistUserId, UUID orderId, String reason) {
        PharmacyOrder o = findOrder(orderId);
        if (o.getStatus() == PharmacyOrderStatus.PICKED_UP || o.getStatus() == PharmacyOrderStatus.CANCELLED) {
            throw new BusinessRuleException("Cannot cancel a " + o.getStatus() + " order");
        }
        o.setStatus(PharmacyOrderStatus.CANCELLED);
        o.setCancelledAt(OffsetDateTime.now());
        o.setCancelledReason(blankToNull(reason));
        if (o.getPharmacistId() == null) o.setPharmacistId(pharmacistUserId);
        orderRepository.save(o);
        return toResponse(o);
    }

    // ---------- helpers ----------

    private PharmacyOrder findOrder(UUID id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pharmacy order", id));
    }

    private String blankToNull(String s) {
        return (s == null || s.trim().isEmpty()) ? null : s.trim();
    }

    private List<PharmacyOrderResponse> hydrate(List<PharmacyOrder> rows) {
        return rows.stream().map(this::toResponse).toList();
    }

    private PharmacyOrderResponse toResponse(PharmacyOrder o) {
        Prescription p = prescriptionRepository.findById(o.getPrescriptionId()).orElse(null);
        List<PrescriptionItemDto> items = List.of();
        String doctorName = null, doctorSpecialty = null, rxNotes = null;
        if (p != null) {
            rxNotes = p.getNotes();
            Doctor d = doctorRepository.findById(p.getDoctorId()).orElse(null);
            if (d != null) {
                doctorName = d.getFullName();
                doctorSpecialty = d.getSpecialty();
            }
            items = prescriptionItemRepository.findByPrescriptionIdOrderByPositionAsc(p.getId()).stream()
                    .map(this::toItemDto).toList();
        }
        String patientName = userRepository.findById(o.getPatientId()).map(User::getFullName).orElse(null);
        String pharmacistName = o.getPharmacistId() == null ? null
                : userRepository.findById(o.getPharmacistId()).map(User::getFullName).orElse(null);
        return new PharmacyOrderResponse(
                o.getId(), o.getPrescriptionId(), o.getPatientId(), patientName,
                o.getPharmacistId(), pharmacistName,
                o.getStatus(), doctorName, doctorSpecialty,
                items, rxNotes,
                o.getDispensedAt(), o.getPickedUpAt(), o.getCancelledAt(), o.getCancelledReason(),
                o.getNotes(), o.getCreatedAt(), o.getUpdatedAt());
    }

    private PrescriptionItemDto toItemDto(PrescriptionItem it) {
        List<MealTiming> timings = it.getMealTimingList() == null ? List.of() : it.getMealTimingList();
        return new PrescriptionItemDto(
                it.getId(), it.getDrugName(), it.getDose(), it.getFrequency(),
                it.getDuration(), it.getInstructions(), timings);
    }

    // ---------- for patient-facing prescription list: which prescriptions already have an active order ----------

    @Transactional(readOnly = true)
    public Map<UUID, PharmacyOrderStatus> activeStatusByPrescription(List<UUID> prescriptionIds) {
        if (prescriptionIds == null || prescriptionIds.isEmpty()) return Map.of();
        Map<UUID, PharmacyOrderStatus> out = new HashMap<>();
        for (PharmacyOrder o : orderRepository.findActiveByPrescriptionIds(prescriptionIds)) {
            out.put(o.getPrescriptionId(), o.getStatus());
        }
        return out;
    }
}

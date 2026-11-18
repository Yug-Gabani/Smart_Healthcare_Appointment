package com.group6.healthcare.clinic.repository;

import com.group6.healthcare.clinic.entity.DoctorSlot;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DoctorSlotRepository extends JpaRepository<DoctorSlot, UUID> {

    @Query("SELECT s FROM DoctorSlot s " +
           "WHERE s.doctorId = :doctorId AND s.booked = false AND s.available = true AND s.slotAt >= :from " +
           "ORDER BY s.slotAt ASC")
    List<DoctorSlot> findOpenSlots(@Param("doctorId") UUID doctorId,
                                   @Param("from") OffsetDateTime from);

    @Query("SELECT s FROM DoctorSlot s " +
           "WHERE s.doctorId = :doctorId AND s.booked = false AND s.available = true AND s.slotAt >= :from " +
           "ORDER BY s.slotAt ASC")
    List<DoctorSlot> findOpenSlotsLimited(@Param("doctorId") UUID doctorId,
                                          @Param("from") OffsetDateTime from,
                                          Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM DoctorSlot s WHERE s.id = :id")
    Optional<DoctorSlot> findForUpdate(@Param("id") UUID id);

    @Query("SELECT s FROM DoctorSlot s " +
           "WHERE s.doctorId = :doctorId AND s.slotAt >= :from AND s.slotAt <= :to " +
           "ORDER BY s.slotAt ASC")
    List<DoctorSlot> findSlotsInRange(@Param("doctorId") UUID doctorId,
                                      @Param("from") OffsetDateTime from,
                                      @Param("to") OffsetDateTime to);

    @Modifying
    @Query("UPDATE DoctorSlot s SET s.available = false " +
           "WHERE s.doctorId = :doctorId AND s.booked = false AND s.slotAt >= :from AND s.slotAt <= :to")
    int markSlotsUnavailableInRange(@Param("doctorId") UUID doctorId,
                                    @Param("from") OffsetDateTime from,
                                    @Param("to") OffsetDateTime to);

    boolean existsByDoctorIdAndSlotAt(UUID doctorId, OffsetDateTime slotAt);

    @Modifying
    @Query("DELETE FROM DoctorSlot s WHERE s.doctorId = :doctorId AND s.booked = false AND s.slotAt > :now")
    int deleteUnbookedFutureSlots(@Param("doctorId") UUID doctorId, @Param("now") OffsetDateTime now);
}
